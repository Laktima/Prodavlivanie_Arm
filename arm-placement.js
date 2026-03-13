/**
 * Расстановка поперечной арматуры на эскизе.
 * Логика:
 * 1. Первый контур: от грани Ax — offsetFirstB, от грани Ay — offsetFirstA
 * 2. Второй контур: от грани Ax — offsetLastB, от грани Ay — offsetLastA
 * 3. Арматура на пересечениях сетки.
 *    В ручном режиме: мнимая сетка по правилам (X_0 = Ax/2+offsetA, шаг до 0 и до Ax/2+1.5*h0, зеркало);
 *    стержни на пересечениях; убираем стержни внутри колонны, в отверстиях и за границей плиты.
 * 4. Между первым контуром и колонной арматуры нет. Контуры не отображаются.
 */

(function (global) {
  'use strict';

  var poperechkaCalc = global.poperechkaCalc;

  /** Массив значений от from до to с шагом step (включительно) */
  function range(from, to, step) {
    var arr = [];
    var v = from;
    if (step > 0) {
      while (v <= to + 1e-6) { arr.push(v); v += step; }
    } else {
      while (v >= to - 1e-6) { arr.push(v); v += step; }
    }
    return arr;
  }

  /**
   * Позиции вертикалей (по X) для ручного режима.
   * 1) X_0 = halfSize + offsetFirst
   * 2) В положительном направлении от X_0 с шагом step добавляем вертикали; последняя линия — на границе halfSize+offsetLast (1,5·h0) или за ней (координата >= границы).
   * 3) В отрицательном от X_0 с шагом step добавляем вертикали, пока координата не станет <= 0
   * 4) Отражаем все полученные вертикали относительно оси Y (добавляем отрицательные).
   */
  function manualGridPositionsX(halfSize, offsetFirst, step, offsetLast) {
    if (step <= 0) return [];
    var x0 = halfSize + offsetFirst;
    var limitPos = halfSize + offsetLast;
    var positions = [];
    var p = x0;
    while (p < limitPos - 1e-6) {
      positions.push(Math.round(p * 10) / 10);
      p += step;
    }
    positions.push(Math.round(p * 10) / 10);
    p = x0 - step;
    while (p > 1e-6) {
      positions.push(Math.round(p * 10) / 10);
      p -= step;
    }
    var withMirror = [];
    positions.forEach(function (x) { withMirror.push(x); if (Math.abs(x) > 1e-6) withMirror.push(-x); });
    withMirror.sort(function (a, b) { return a - b; });
    var uniq = [];
    for (var i = 0; i < withMirror.length; i++) {
      if (i === 0 || Math.abs(withMirror[i] - withMirror[i - 1]) > 1e-6) uniq.push(withMirror[i]);
    }
    return uniq;
  }

  /**
   * Позиции горизонталей (по Y) для ручного режима — та же логика, что и для X.
   */
  function manualGridPositionsY(halfSize, offsetFirst, step, offsetLast) {
    return manualGridPositionsX(halfSize, offsetFirst, step, offsetLast);
  }

  /**
   * Координаты узлов поперечной арматуры (вид сверху).
   * Система: центр колонны (0,0). Грани: Ax — по X (слева/справа), Ay — по Y (сверху/снизу).
   * @param {Object} params - { Ax, Ay, h, ax, ay, stepX, stepY, holes, edgeLeft, edgeRight, edgeBottom, edgeTop }
   * @returns {{ points, xMin, xMax, yMin, yMax, poperechka, ... }}
   */
  function getArmPlacement(params) {
    var Ax = params.Ax || 200;
    var Ay = params.Ay || 200;
    var h = params.h || 180;
    var ax = params.ax || 40;
    var ay = params.ay || 50;
    var h0 = ((h - ax) + (h - ay)) / 2;
    if (h0 < 0) h0 = 50;
    var stepX = Math.max(1, params.stepX || 60);
    var stepY = Math.max(1, params.stepY || 60);
    var holes = params.holes || [];
    var edgeLeft = !!params.edgeLeft;
    var edgeRight = !!params.edgeRight;
    var edgeBottom = !!params.edgeBottom;
    var edgeTop = !!params.edgeTop;

    var offsetFirstA, offsetFirstB, offsetLastA, offsetLastB;
    var c;
    if (params.armManual && params.offsetFirstA != null && params.offsetFirstB != null && params.offsetLastA != null && params.offsetLastB != null) {
      offsetFirstA = Number(params.offsetFirstA) || 0;
      offsetFirstB = Number(params.offsetFirstB) || 0;
      offsetLastA = Number(params.offsetLastA) || 0;
      offsetLastB = Number(params.offsetLastB) || 0;
      c = { offsetFirstA: offsetFirstA, offsetFirstB: offsetFirstB, offsetLastA: offsetLastA, offsetLastB: offsetLastB };
    } else {
      c = poperechkaCalc(h0, Ax, Ay, stepX, stepY);
      offsetFirstA = c.offsetFirstA;
      offsetFirstB = c.offsetFirstB;
      offsetLastA = c.offsetLastA;
      offsetLastB = c.offsetLastB;
    }

    function inHole(x, y) {
      for (var i = 0; i < holes.length; i++) {
        var ho = holes[i];
        if (ho.lx <= 0 || ho.ly <= 0) continue;
        if (x > ho.x - ho.lx/2 && x < ho.x + ho.lx/2 && y > ho.y - ho.ly/2 && y < ho.y + ho.ly/2) return true;
      }
      return false;
    }
    function onEdgeSide(xx, yy) {
      if (edgeLeft && xx < -Ax/2) return true;
      if (edgeRight && xx > Ax/2) return true;
      if (edgeBottom && yy < -Ay/2) return true;
      if (edgeTop && yy > Ay/2) return true;
      return false;
    }

    // Первый контур: от грани Ax (сверху/снизу) — offsetFirstB, от грани Ay (слева/справа) — offsetFirstA
    var c1_xL = edgeLeft ? -Ax/2 : -Ax/2 - offsetFirstA;
    var c1_xR = edgeRight ? Ax/2 : Ax/2 + offsetFirstA;
    var c1_yB = edgeBottom ? -Ay/2 : -Ay/2 - offsetFirstB;
    var c1_yT = edgeTop ? Ay/2 : Ay/2 + offsetFirstB;
    // В ручном режиме: мнимый контур статичен — колонна + (отступ − 1 мм) со всех сторон; стержни внутри удаляем, за плитой/в отверстиях — в addPoint
    if (params.armManual && params.offsetFirstA != null && params.offsetFirstB != null && params.offsetLastA != null && params.offsetLastB != null) {
      var offA1 = Math.max(0, (offsetFirstA || 0) - 1);
      var offB1 = Math.max(0, (offsetFirstB || 0) - 1);
      c1_xL = -Ax / 2 - offA1;
      c1_xR = Ax / 2 + offA1;
      c1_yB = -Ay / 2 - offB1;
      c1_yT = Ay / 2 + offB1;
    }

    // Второй контур: от грани Ax — offsetLastB, от грани Ay — offsetLastA (в ручном режиме offsetLast = 1,5·h0)
    var c2_xL = edgeLeft ? -Ax/2 : -Ax/2 - offsetLastA;
    var c2_xR = edgeRight ? Ax/2 : Ax/2 + offsetLastA;
    var c2_yB = edgeBottom ? -Ay/2 : -Ay/2 - offsetLastB;
    var c2_yT = edgeTop ? Ay/2 : Ay/2 + offsetLastB;

    // Зона арматуры: на первом контуре или между контурами. НЕ между колонной и первым контуром.
    // Точка (x,y) допустима если вне первого контура: x<=c1_xL OR x>=c1_xR OR y<=c1_yB OR y>=c1_yT
    // И внутри второго (или на нём): c2_xL<=x<=c2_xR AND c2_yB<=y<=c2_yT
    function inArmZone(x, y) {
      if (x < c2_xL - 1e-6 || x > c2_xR + 1e-6 || y < c2_yB - 1e-6 || y > c2_yT + 1e-6) return false;
      return x <= c1_xL + 1e-6 || x >= c1_xR - 1e-6 || y <= c1_yB + 1e-6 || y >= c1_yT - 1e-6;
    }

    var points = [];
    var seen = {};

    function addPoint(x, y) {
      if (onEdgeSide(x, y)) return;
      if (inHole(x, y)) return;
      var key = (Math.round(x * 10) / 10) + ',' + (Math.round(y * 10) / 10);
      if (seen[key]) return;
      if (!inArmZone(x, y)) return;
      seen[key] = true;
      points.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }

    // 1. Углы обоих контуров (8 точек)
    var corners = [
      [c1_xL, c1_yB], [c1_xL, c1_yT], [c1_xR, c1_yB], [c1_xR, c1_yT],
      [c2_xL, c2_yB], [c2_xL, c2_yT], [c2_xR, c2_yB], [c2_xR, c2_yT]
    ];
    corners.forEach(function (p) {
      if (!edgeLeft || p[0] >= -Ax/2) if (!edgeRight || p[0] <= Ax/2)
      if (!edgeBottom || p[1] >= -Ay/2) if (!edgeTop || p[1] <= Ay/2)
        addPoint(p[0], p[1]);
    });

    // 2. Сетка: арматура на пересечениях линий. В ручном режиме — мнимая сетка: X_0 = Ax/2+offsetFirstA, шаг до 0 и до Ax/2+1.5*h0, зеркало; то же по Y.
    var xPos, yPos;
    if (params.armManual && params.offsetFirstA != null && params.offsetFirstB != null && params.offsetLastA != null && params.offsetLastB != null) {
      var halfAx = Ax / 2, halfAy = Ay / 2;
      xPos = manualGridPositionsX(halfAx, offsetFirstA, stepX, offsetLastA);
      yPos = manualGridPositionsY(halfAy, offsetFirstB, stepY, offsetLastB);
      // Сетка статична: второй контур всегда по полному охвату сетки; стержни за плитой/в отверстиях убираем в addPoint (onEdgeSide, inHole)
      var xMinG = Math.min.apply(null, xPos), xMaxG = Math.max.apply(null, xPos);
      var yMinG = Math.min.apply(null, yPos), yMaxG = Math.max.apply(null, yPos);
      c2_xL = xMinG;
      c2_xR = xMaxG;
      c2_yB = yMinG;
      c2_yT = yMaxG;
    } else {
      xPos = range(c2_xL, c2_xR, stepX);
      yPos = range(c2_yB, c2_yT, stepY);
    }
    xPos.forEach(function (xx) {
      yPos.forEach(function (yy) {
        addPoint(xx, yy);
      });
    });

    var pad = 30;
    var xMin = c2_xL - pad, xMax = c2_xR + pad, yMin = c2_yB - pad, yMax = c2_yT + pad;

    return {
      h0: h0, a: Ax, b: Ay, stepX: stepX, stepY: stepY,
      xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax,
      points: points, xPos: xPos, yPos: yPos, total: points.length,
      poperechka: c
    };
  }

  global.getArmPlacement = getArmPlacement;
})(typeof window !== 'undefined' ? window : this);
