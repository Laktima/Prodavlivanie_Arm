/**
 * Расчёт периметра расчётного контура Ub при наличии отверстий в плите.
 * Ub = сумма 4 линий контура минус «проекция» отверстий на эти линии.
 * Проекция: из центра (0,0) проводятся касательные к прямоугольнику отверстия;
 * вычитаемый отрезок на контуре — между точками пересечения этих лучей с контуром U
 * (логика shearslabcalc: findUIntersectPoints, calculateCutOff, addCornersU).
 *
 * Система координат: центр колонны (0,0). Колонна: [−Ax/2, Ax/2]×[−Ay/2, Ay/2].
 * Периметр расчётного контура — на расстоянии h0/2 от грани колонны (uh = h0/2).
 * Контур U: u_left = −Ax/2−uh, u_right = Ax/2+uh, u_bottom = −Ay/2−uh, u_top = Ay/2+uh.
 * Отверстие: центр (x,y), размеры lx×ly (мм).
 */

(function (global) {
  'use strict';

  /**
   * Объединение интервалов и сумма длин (мм).
   * @param {Array<[number,number]>} intervals - массив [a, b], a < b
   * @returns {number} суммарная длина объединения
   */
  function mergeIntervalsLength(intervals) {
    if (intervals.length === 0) return 0;
    intervals = intervals.slice().filter(function (r) { return r[1] > r[0]; });
    if (intervals.length === 0) return 0;
    intervals.sort(function (a, b) { return a[0] - b[0]; });
    var len = 0, end = intervals[0][0];
    for (var i = 0; i < intervals.length; i++) {
      var a = intervals[i][0], b = intervals[i][1];
      if (a > end) end = a;
      if (b > end) { len += b - end; end = b; }
    }
    return len;
  }

  /**
   * Углы (в градусах 0..360) двух касательных из (0,0) к прямоугольнику отверстия.
   * Касательные ограничивают «клин», в котором лежит отверстие.
   * @param {number} hx - центр отверстия по X, мм
   * @param {number} hy - центр по Y, мм
   * @param {number} hlx - ширина отверстия, мм
   * @param {number} hly - высота отверстия, мм
   * @returns {[number, number]} [angle1, angle2] в градусах (углы лучей из 0,0)
   */
  function getOpeningTangentAngles(hx, hy, hlx, hly) {
    var halfX = hlx / 2, halfY = hly / 2;
    var corners = [
      [hx - halfX, hy - halfY],
      [hx + halfX, hy - halfY],
      [hx + halfX, hy + halfY],
      [hx - halfX, hy + halfY]
    ];
    var angles = [];
    for (var i = 0; i < 4; i++) {
      var cx = corners[i][0], cy = corners[i][1];
      var rad = Math.atan2(cx, cy);
      var deg = (rad * 180 / Math.PI + 360) % 360;
      angles.push(deg);
    }
    angles.sort(function (a, b) { return a - b; });
    var aMin = angles[0], aMax = angles[3];
    if (aMax - aMin <= 180) return [aMin, aMax];
    return [aMax, aMin + 360];
  }

  /**
   * Пересечение луча из (0,0) в направлении angle_deg с прямоугольником U.
   * @param {number} angle_deg - угол в градусах (0 = ось X+, 90 = Y+)
   * @param {number} u_left - левая граница U, мм
   * @param {number} u_right
   * @param {number} u_bottom
   * @param {number} u_top
   * @returns {{ x: number, y: number, side: number }|null} side: 0=left, 1=top, 2=right, 3=bottom
   */
  function rayIntersectRect(angle_deg, u_left, u_right, u_bottom, u_top) {
    var rad = angle_deg * Math.PI / 180;
    var dx = Math.sin(rad), dy = Math.cos(rad);
    var t, x, y;
    if (Math.abs(dx) > 1e-10) {
      t = u_left / dx;
      if (t > 0) {
        y = t * dy;
        if (y >= u_bottom - 1e-6 && y <= u_top + 1e-6) return { x: u_left, y: y, side: 0 };
      }
      t = u_right / dx;
      if (t > 0) {
        y = t * dy;
        if (y >= u_bottom - 1e-6 && y <= u_top + 1e-6) return { x: u_right, y: y, side: 2 };
      }
    }
    if (Math.abs(dy) > 1e-10) {
      t = u_bottom / dy;
      if (t > 0) {
        x = t * dx;
        if (x >= u_left - 1e-6 && x <= u_right + 1e-6) return { x: x, y: u_bottom, side: 3 };
      }
      t = u_top / dy;
      if (t > 0) {
        x = t * dx;
        if (x >= u_left - 1e-6 && x <= u_right + 1e-6) return { x: x, y: u_top, side: 1 };
      }
    }
    return null;
  }

  /**
   * Параметр s точки на периметре U: обход против часовой от (u_left, u_bottom).
   * Стороны: 0=left (вверх), 1=top (вправо), 2=right (вниз), 3=bottom (влево).
   * @param {number} x - координата точки на контуре, мм
   * @param {number} y
   * @param {number} u_left
   * @param {number} u_right
   * @param {number} u_bottom
   * @param {number} u_top
   * @param {number} L0 - длина стороны 0 (left), мм
   * @param {number} L1 - длина стороны 1 (top)
   * @param {number} L2 - длина стороны 2 (right)
   * @param {number} L3 - длина стороны 3 (bottom)
   * @returns {number} s в [0, L0+L1+L2+L3)
   */
  function pointToPerimeterS(x, y, u_left, u_right, u_bottom, u_top, L0, L1, L2, L3) {
    var eps = 1e-6;
    if (Math.abs(x - u_left) <= eps && y >= u_bottom && y <= u_top) return (y - u_bottom);
    if (Math.abs(y - u_top) <= eps && x >= u_left && x <= u_right) return L0 + (x - u_left);
    if (Math.abs(x - u_right) <= eps && y >= u_bottom && y <= u_top) return L0 + L1 + (u_top - y);
    if (Math.abs(y - u_bottom) <= eps && x >= u_left && x <= u_right) return L0 + L1 + L2 + (u_right - x);
    return 0;
  }

  /**
   * Для одного отверстия: интервал(ы) на периметре (параметр s), которые вычитаются (проекция по касательным).
   * При обходе против часовой стрелки дуга от P1 до P2 может оборачиваться через s=0 → два интервала.
   * @param {number} hx - центр отверстия X, мм
   * @param {number} hy - центр Y, мм
   * @param {number} hlx - ширина отверстия, мм
   * @param {number} hly - высота отверстия, мм
   * @param {number} u_left
   * @param {number} u_right
   * @param {number} u_bottom
   * @param {number} u_top
   * @param {number} L0, L1, L2, L3 - длины сторон контура, мм
   * @param {number} L_total
   * @returns {Array<[number,number]>} массив интервалов [s_min, s_max]
   */
  function getOpeningCutInterval(hx, hy, hlx, hly, u_left, u_right, u_bottom, u_top, L0, L1, L2, L3, L_total) {
    var tang = getOpeningTangentAngles(hx, hy, hlx, hly);
    var angle1 = tang[0], angle2 = tang[1];
    var P1 = rayIntersectRect(angle1, u_left, u_right, u_bottom, u_top);
    var P2 = rayIntersectRect(angle2, u_left, u_right, u_bottom, u_top);
    if (!P1 || !P2) return [];
    var s1 = pointToPerimeterS(P1.x, P1.y, u_left, u_right, u_bottom, u_top, L0, L1, L2, L3);
    var s2 = pointToPerimeterS(P2.x, P2.y, u_left, u_right, u_bottom, u_top, L0, L1, L2, L3);
    if (Math.abs(s1 - s2) < 1e-6) return [];
    if (s1 < s2) return [[s1, s2]];
    return [[s1, L_total], [0, s2]];
  }

  /**
   * Разбить объединённые интервалы в s-пространстве по сторонам контура и вернуть длину вырубки по каждой стороне.
   * Сторона 0 (left): s ∈ [0, L0]; 1 (top): [L0, L0+L1]; 2 (right): [L0+L1, L0+L1+L2]; 3 (bottom): [L0+L1+L2, L_total].
   * @param {Array<[number,number]>} sIntervals - интервалы [s_min, s_max] по периметру
   * @param {number} L0, L1, L2, L3 - длины сторон, мм
   * @returns {{ cutLeft: number, cutTop: number, cutRight: number, cutBottom: number }}
   */
  function intervalsToSideCuts(sIntervals, L0, L1, L2, L3) {
    var L_total = L0 + L1 + L2 + L3;
    var s0 = 0, s1 = L0, s2 = L0 + L1, s3 = L0 + L1 + L2;
    function overlapLength(interval, sideStart, sideEnd) {
      var a = Math.max(interval[0], sideStart);
      var b = Math.min(interval[1], sideEnd);
      return Math.max(0, b - a);
    }
    var cutLeft = 0, cutTop = 0, cutRight = 0, cutBottom = 0;
    for (var i = 0; i < sIntervals.length; i++) {
      cutLeft += overlapLength(sIntervals[i], s0, s1);
      cutTop += overlapLength(sIntervals[i], s1, s2);
      cutRight += overlapLength(sIntervals[i], s2, s3);
      cutBottom += overlapLength(sIntervals[i], s3, L_total);
    }
    return { cutLeft: cutLeft, cutTop: cutTop, cutRight: cutRight, cutBottom: cutBottom };
  }

  /**
   * Расчёт вычитаемых отрезков (проекция отверстий по касательным из центра) и приведение к вырубкам по сторонам.
   * Используется в computeUbWithHoles при useTangentProjection = true.
   */
  function computeCutsByTangentProjection(Ax, Ay, uh, holes, edgeLeft, edgeRight, edgeBottom, edgeTop) {
    var u_left = -Ax / 2 - uh;
    var u_right = Ax / 2 + uh;
    var u_bottom = -Ay / 2 - uh;
    var u_top = Ay / 2 + uh;
    var L0 = Ay + 2 * uh;
    var L1 = Ax + 2 * uh;
    var L2 = L0;
    var L3 = L1;
    var L_total = 2 * L0 + 2 * L1;

    var sIntervals = [];
    for (var hi = 0; hi < holes.length; hi++) {
      var ho = holes[hi];
      if (ho.lx <= 0 || ho.ly <= 0) continue;
      var arr = getOpeningCutInterval(ho.x, ho.y, ho.lx, ho.ly, u_left, u_right, u_bottom, u_top, L0, L1, L2, L3, L_total);
      for (var k = 0; k < arr.length; k++) sIntervals.push(arr[k]);
    }
    sIntervals = sIntervals.filter(function (r) { return r[1] > r[0]; });
    if (sIntervals.length === 0) {
      return { cutLeft: 0, cutTop: 0, cutRight: 0, cutBottom: 0 };
    }
    sIntervals.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    var end = sIntervals[0][0];
    for (var j = 0; j < sIntervals.length; j++) {
      var a = sIntervals[j][0], b = sIntervals[j][1];
      if (a > end) end = a;
      if (b > end) {
        merged.push([end, b]);
        end = b;
      }
    }
    var sideCuts = intervalsToSideCuts(merged, L0, L1, L2, L3);
    return sideCuts;
  }

  /**
   * Длина участка левой стороны контура, попадающего в отверстия (метод пересечения прямоугольника с вертикалью).
   * Используется при расчёте без проекции по касательным.
   */
  function holeOverlapLeft(Ax, Ay, uh, holes) {
    var segLeft = -Ax / 2 - uh;
    var yMin = -Ay / 2 - uh;
    var yMax = Ay / 2 + uh;
    var intervals = [];
    for (var hi = 0; hi < holes.length; hi++) {
      var hlx = holes[hi].lx, hly = holes[hi].ly, hx = holes[hi].x, hy = holes[hi].y;
      if (hlx <= 0 || hly <= 0) continue;
      if (hx + hlx / 2 < segLeft || hx - hlx / 2 > segLeft) continue;
      var y1 = Math.max(yMin, hy - hly / 2);
      var y2 = Math.min(yMax, hy + hly / 2);
      if (y2 > y1) intervals.push([y1, y2]);
    }
    return mergeIntervalsLength(intervals);
  }

  function holeOverlapRight(Ax, Ay, uh, holes) {
    var segRight = Ax / 2 + uh;
    var yMin = -Ay / 2 - uh;
    var yMax = Ay / 2 + uh;
    var intervals = [];
    for (var hi = 0; hi < holes.length; hi++) {
      var hlx = holes[hi].lx, hly = holes[hi].ly, hx = holes[hi].x, hy = holes[hi].y;
      if (hlx <= 0 || hly <= 0) continue;
      if (hx - hlx / 2 > segRight || hx + hlx / 2 < segRight) continue;
      var y1 = Math.max(yMin, hy - hly / 2);
      var y2 = Math.min(yMax, hy + hly / 2);
      if (y2 > y1) intervals.push([y1, y2]);
    }
    return mergeIntervalsLength(intervals);
  }

  function holeOverlapBottom(Ax, Ay, uh, holes) {
    var segBottom = -Ay / 2 - uh;
    var xMin = -Ax / 2 - uh;
    var xMax = Ax / 2 + uh;
    var intervals = [];
    for (var hi = 0; hi < holes.length; hi++) {
      var hlx = holes[hi].lx, hly = holes[hi].ly, hx = holes[hi].x, hy = holes[hi].y;
      if (hlx <= 0 || hly <= 0) continue;
      if (hy + hly / 2 < segBottom || hy - hly / 2 > segBottom) continue;
      var x1 = Math.max(xMin, hx - hlx / 2);
      var x2 = Math.min(xMax, hx + hlx / 2);
      if (x2 > x1) intervals.push([x1, x2]);
    }
    return mergeIntervalsLength(intervals);
  }

  function holeOverlapTop(Ax, Ay, uh, holes) {
    var segTop = Ay / 2 + uh;
    var xMin = -Ax / 2 - uh;
    var xMax = Ax / 2 + uh;
    var intervals = [];
    for (var hi = 0; hi < holes.length; hi++) {
      var hlx = holes[hi].lx, hly = holes[hi].ly, hx = holes[hi].x, hy = holes[hi].y;
      if (hlx <= 0 || hly <= 0) continue;
      if (hy - hly / 2 > segTop || hy + hly / 2 < segTop) continue;
      var x1 = Math.max(xMin, hx - hlx / 2);
      var x2 = Math.min(xMax, hx + hlx / 2);
      if (x2 > x1) intervals.push([x1, x2]);
    }
    return mergeIntervalsLength(intervals);
  }

  /**
   * Вычисление периметра Ub с учётом отверстий.
   * useTangentProjection === true: вычитается проекция отверстия на контур (касательные из центра к отверстию, как в shearslabcalc).
   * useTangentProjection === false: вычитаются участки сторон контура, попадающие внутрь прямоугольника отверстия (пересечение контура с отверстием).
   *
   * @param {Object} params - Ax, Ay, h0, holes, edgeLeft, edgeRight, edgeBottom, edgeTop, [uh], [useTangentProjection]
   * @returns {{ Ub, lu_sl, lu_sp, lu_sn, lu_sv, holeOverlapLeft, ... }}
   */
  function computeUbWithHoles(params) {
    var Ax = params.Ax || 0;
    var Ay = params.Ay || 0;
    var h0 = params.h0 || 0;
    var holes = params.holes || [];
    var edgeLeft = !!params.edgeLeft;
    var edgeRight = !!params.edgeRight;
    var edgeBottom = !!params.edgeBottom;
    var edgeTop = !!params.edgeTop;
    var x_cx = params.x_cx != null ? Number(params.x_cx) : 0;
    var x_cy = params.x_cy != null ? Number(params.x_cy) : 0;
    var uh = params.uh != null ? params.uh : h0 / 2;
    var useTangentProjection = params.useTangentProjection !== false;

    var sideVert = Ay + 2 * uh;
    var sideHorz = Ax + 2 * uh;

    var overlapLeft, overlapRight, overlapBottom, overlapTop;

    if (useTangentProjection && holes.length > 0) {
      var cuts = computeCutsByTangentProjection(Ax, Ay, uh, holes, edgeLeft, edgeRight, edgeBottom, edgeTop);
      overlapLeft = edgeLeft ? 0 : cuts.cutLeft;
      overlapRight = edgeRight ? 0 : cuts.cutRight;
      overlapBottom = edgeBottom ? 0 : cuts.cutBottom;
      overlapTop = edgeTop ? 0 : cuts.cutTop;
    } else {
      overlapLeft = holeOverlapLeft(Ax, Ay, uh, holes);
      overlapRight = holeOverlapRight(Ax, Ay, uh, holes);
      overlapBottom = holeOverlapBottom(Ax, Ay, uh, holes);
      overlapTop = holeOverlapTop(Ax, Ay, uh, holes);
    }

    var lu_sl = edgeLeft ? 0 : Math.max(0, sideVert - overlapLeft);
    var lu_sp = edgeRight ? 0 : Math.max(0, sideVert - overlapRight);
    var lu_sn = edgeBottom ? 0 : Math.max(0, sideHorz - overlapBottom);
    var lu_sv = edgeTop ? 0 : Math.max(0, sideHorz - overlapTop);

    // Корректировка при колонне у края плиты: горизонтальные — + (x_cx − lu_sn/2), + (x_cx − lu_sv/2); вертикальные — + (x_cy − lu_sl/2), + (x_cy − lu_sp/2)
    if (edgeLeft || edgeRight) {
      lu_sn = Math.max(0, lu_sn + (x_cx - lu_sn / 2));
      lu_sv = Math.max(0, lu_sv + (x_cx - lu_sv / 2));
    }
    if (edgeBottom || edgeTop) {
      lu_sl = Math.max(0, lu_sl + (x_cy - lu_sl / 2));
      lu_sp = Math.max(0, lu_sp + (x_cy - lu_sp / 2));
    }

    var Ub = lu_sl + lu_sp + lu_sn + lu_sv;

    return {
      Ub: Ub,
      lu_sl: lu_sl,
      lu_sp: lu_sp,
      lu_sn: lu_sn,
      lu_sv: lu_sv,
      holeOverlapLeft: function (u) { return holeOverlapLeft(Ax, Ay, u != null ? u : uh, holes); },
      holeOverlapRight: function (u) { return holeOverlapRight(Ax, Ay, u != null ? u : uh, holes); },
      holeOverlapBottom: function (u) { return holeOverlapBottom(Ax, Ay, u != null ? u : uh, holes); },
      holeOverlapTop: function (u) { return holeOverlapTop(Ax, Ay, u != null ? u : uh, holes); }
    };
  }

  global.mergeIntervalsLength = mergeIntervalsLength;
  global.getOpeningTangentAngles = getOpeningTangentAngles;
  global.rayIntersectRect = rayIntersectRect;
  global.pointToPerimeterS = pointToPerimeterS;
  global.getOpeningCutInterval = getOpeningCutInterval;
  global.computeCutsByTangentProjection = computeCutsByTangentProjection;
  global.holeOverlapLeft = holeOverlapLeft;
  global.holeOverlapRight = holeOverlapRight;
  global.holeOverlapBottom = holeOverlapBottom;
  global.holeOverlapTop = holeOverlapTop;
  global.computeUbWithHoles = computeUbWithHoles;
})(typeof window !== 'undefined' ? window : this);
