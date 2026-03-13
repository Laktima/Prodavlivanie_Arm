/**
 * Расчёт плиты на продавливание по СП 63.13330.2018 и отчёту НИИЖБ (Договор №709).
 * Логика соответствует типовому расчёту «41. Пилон в осях» (без привязки к Excel).
 * Использует: Rbt_coef, Rsw_MPa, diam_Asw из calc-data.js; getArmPlacement из arm-placement.js.
 */

(function (global) {
  'use strict';

  /**
   * Расчёт плиты на продавливание: исходные данные, периметр контура, Fb_ult, Fsw, моменты, условие k ≤ 1.
   * @param {Object} input - параметры расчёта (Ax, Ay, h, ax, ay, holes, F_sila, p, Mlocx, Mlocy, …)
   * @returns {{ ok, error, reportText, F, Fult, k, h0, Ub, Fb_ult, … }}
   */
  function runCalc(input) {
    // —— Исходные данные (размеры в мм, усилия в т, т·м, т/м²) ——
    var Ax = input.Ax || 0;       // размер колонны по X, мм
    var Ay = input.Ay || 0;       // размер колонны по Y, мм
    var h = input.h || 0;        // толщина плиты, мм
    var ax = input.ax || 0;       // защитный слой до арматуры по X, мм
    var ay = input.ay || 0;       // защитный слой по Y, мм
    var beton = input.beton || 'B30';
    var armatura = input.armatura || 'А500';
    var diam = input.diam || 8;   // диаметр поперечных стержней, мм
    var gb1 = input.gb1 || 1;     // коэффициент условий работы бетона (СП 63, п. 6.1.12)
    var mkp = input.mkp || 1;     // коэффициент для Rbt (напр. при кратковременной нагрузке)
    var F_sila = input.F_sila || 0;  // вертикальная сила N, т
    var p = input.p || 0;         // равномерная нагрузка на плиту, т/м² (отпор грунта и т.п.)
    var Mlocx = input.Mlocx || 0; // локальный момент по оси X, т·м
    var Mlocy = input.Mlocy || 0; // локальный момент по оси Y, т·м
    var useMx = !!input.useMx;
    var useMy = !!input.useMy;
    var edgeLeft = !!input.edgeLeft;   // колонна у левого края — сторона контура отключена
    var edgeRight = !!input.edgeRight;
    var edgeBottom = !!input.edgeBottom;
    var edgeTop = !!input.edgeTop;
    var x_cx = input.x_cx != null ? Number(input.x_cx) : 0;  // до края по оси Х, мм
    var x_cy = input.x_cy != null ? Number(input.x_cy) : 0;   // до края по оси Y, мм
    var multiContour = !!input.multiContour;  // проверка по контурам 1·h0 … 4·h0 (п. 8.1.47 СП)
    var holes = input.holes || [];  // отверстия: [{ lx, ly, x, y }], x,y — центр от центра колонны, мм
    var stepX = Math.max(1, input.stepX || 60);
    var stepY = Math.max(1, input.stepY || 60);
    var armManual = !!input.armManual;
    var xAlong = armManual ? 'a' : (input.xAlong === 'b' ? 'b' : 'a');
    var xCountCorrection = parseInt(input.xCountCorrection, 10) || 0;

    // Расчётные сопротивления: Rbt — бетон растяжение (МПа), Rsw — арматура (МПа)
    var Rbt_coef = global.Rbt_coef || {};
    var Rsw_MPa = global.Rsw_MPa || {};
    var diam_Asw = global.diam_Asw || {};
    var Rbt = (Rbt_coef[beton] || 0) * gb1 * mkp;
    var Rsw = Rsw_MPa[armatura] || 0;
    // Рабочая высота сечения, мм. Отчёт НИИЖБ ф. 1.13: h0 = ((h−ax)+(h−ay))/2
    var h0 = ((h - ax) + (h - ay)) / 2;

    if (h0 <= 0) {
      return { ok: false, error: 'h0 ≤ 0. Проверьте h, ax, ay.', reportText: '' };
    }

    // Отверстия: учитываем только те, у которых расстояние от грани колонны до грани отверстия ≤ 6·h0
    function minDistColumnHole(Ax, Ay, h) {
      var hlx = h.lx || 0, hly = h.ly || 0, hx = h.x || 0, hy = h.y || 0;
      var colLeft = -Ax / 2, colRight = Ax / 2, colBottom = -Ay / 2, colTop = Ay / 2;
      var holeLeft = hx - hlx / 2, holeRight = hx + hlx / 2, holeBottom = hy - hly / 2, holeTop = hy + hly / 2;
      var gapX = 0;
      if (holeRight < colLeft) gapX = colLeft - holeRight;
      else if (holeLeft > colRight) gapX = holeLeft - colRight;
      var gapY = 0;
      if (holeTop < colBottom) gapY = colBottom - holeTop;
      else if (holeBottom > colTop) gapY = holeBottom - colTop;
      if (gapX === 0 && gapY === 0) return 0;
      if (gapX === 0) return gapY;
      if (gapY === 0) return gapX;
      return Math.sqrt(gapX * gapX + gapY * gapY);
    }
    var holeIncluded = [];
    var holesFiltered = [];
    var limit6h0 = 6 * h0;
    for (var hi = 0; hi < holes.length; hi++) {
      var ho = holes[hi];
      if ((ho.lx || 0) <= 0 || (ho.ly || 0) <= 0) {
        holeIncluded.push(true);
        continue;
      }
      var dist = minDistColumnHole(Ax, Ay, ho);
      if (dist > limit6h0) {
        holeIncluded.push(false);
      } else {
        holeIncluded.push(true);
        holesFiltered.push(ho);
      }
    }

    // Зона отпора (расчётный контур): площадь (Ax+2·h0)·(Ay+2·h0), минус площадь отверстий. Отчёт НИИЖБ ф. 1.3
    var areaZone = (Ax + 2 * h0) * (Ay + 2 * h0);
    var holeArea = 0;
    for (var hi = 0; hi < holesFiltered.length; hi++) {
      if (holesFiltered[hi].lx > 0 && holesFiltered[hi].ly > 0) holeArea += holesFiltered[hi].lx * holesFiltered[hi].ly;
    }
    // Fp — отпор в зоне отпора, т. F = N − Fp — усилие продавливания (ф. 1.8 отчёта НИИЖБ)
    var Fp = p * (areaZone - holeArea) / 1e6;
    if (Fp < 0) Fp = 0;
    var F = F_sila - Fp;

    // Периметр Ub и длины сторон контура с учётом отверстий (модуль punching-ub-holes.js: вычитание участков контура, попадающих в отверстия).
    var computeUb = global.computeUbWithHoles;
    if (typeof computeUb !== 'function') {
      return { ok: false, error: 'Не загружен punching-ub-holes.js (computeUbWithHoles).', reportText: '' };
    }
    var ubResult = computeUb({
      Ax: Ax, Ay: Ay, h0: h0, holes: holesFiltered,
      edgeLeft: edgeLeft, edgeRight: edgeRight, edgeBottom: edgeBottom, edgeTop: edgeTop,
      x_cx: input.x_cx != null ? input.x_cx : 0, x_cy: input.x_cy != null ? input.x_cy : 0
    });
    var lu_sl = ubResult.lu_sl;
    var lu_sp = ubResult.lu_sp;
    var lu_sn = ubResult.lu_sn;
    var lu_sv = ubResult.lu_sv;
    var Ub = ubResult.Ub;
    var holeOverlapLeft = ubResult.holeOverlapLeft;
    var holeOverlapRight = ubResult.holeOverlapRight;
    var holeOverlapBottom = ubResult.holeOverlapBottom;
    var holeOverlapTop = ubResult.holeOverlapTop;

    if (Ub <= 0) {
      return { ok: false, error: 'Периметр контура Ub = 0 (все стороны отключены или вычтены).', reportText: '' };
    }

    // СП 63 ф. 8.88: Fb,ult = Rbt · u · h0. Здесь u = Ub (мм), результат в т: Fb_ult = Rbt(МПа)·Ub(мм)·h0(мм)/10000
    var Fb_ult = Math.floor(Rbt * Ub * h0 / 10000 * 100) / 100;

    // —— Поперечная арматура (Fsw): СП 63, отчёт НИИЖБ. Fsw,ult не более 25% Fb_ult учитывается; ограничение Fsw_accept ≤ Fb_ult
    // Х — кол-во срезов: X вдоль a = 2·(((h0/2 - offsetFirstA)/stepX)+1), X вдоль b = 2·(((h0/2 - offsetFirstB)/stepY)+1)
    var n_stirrups = 0;
    var Fsw_ult = 0;
    var xAlongA_val = 0;
    var xAlongB_val = 0;
    if (typeof global.getArmPlacement === 'function' && h >= 180 && diam && diam_Asw[diam] !== undefined) {
      var plParams = {
        Ax: Ax, Ay: Ay, h: h, ax: ax, ay: ay, stepX: stepX, stepY: stepY,
        holes: holesFiltered, edgeLeft: edgeLeft, edgeRight: edgeRight, edgeBottom: edgeBottom, edgeTop: edgeTop
      };
      if (armManual && input.offsetFirstA != null && input.offsetFirstB != null && input.offsetLastA != null && input.offsetLastB != null) {
        plParams.armManual = true;
        plParams.offsetFirstA = input.offsetFirstA;
        plParams.offsetFirstB = input.offsetFirstB;
        plParams.offsetLastA = input.offsetLastA;
        plParams.offsetLastB = input.offsetLastB;
      }
      var pl = global.getArmPlacement(plParams);
      var offsetFirstA = (pl.poperechka && pl.poperechka.offsetFirstA != null) ? pl.poperechka.offsetFirstA : 0;
      var offsetFirstB = (pl.poperechka && pl.poperechka.offsetFirstB != null) ? pl.poperechka.offsetFirstB : 0;
      if (armManual && pl.total != null && pl.total >= 0) {
        n_stirrups = pl.total;
      } else {
        xAlongA_val = (stepX > 0) ? Math.max(0, 2 * (Math.round(((h0 / 2 - offsetFirstA) / stepX) + 1))) : 0;
        xAlongB_val = (stepY > 0) ? Math.max(0, 2 * (Math.round(((h0 / 2 - offsetFirstB) / stepY) + 1))) : 0;
        n_stirrups = (xAlong === 'b') ? xAlongB_val : xAlongA_val;
      }
    }
    // Количество стержней не может быть меньше 0
    n_stirrups = Math.max(0, Math.floor(n_stirrups + xCountCorrection));
    var Asw_cm2 = (diam_Asw[diam] || 0) * n_stirrups;  // площадь стержней перпендикулярно контуру, см²
    var qsw = 0;
    if (n_stirrups > 0 && diam) {
      qsw = (Rsw / 100) * (Asw_cm2 / 10000) / (diam / 1000000);  // т/м, погонное усилие
    }
    if (n_stirrups > 0 && diam) {
      Fsw_ult = 0.8 * qsw * (Ub / 1000);  // т: Ub в мм → м, ф. Fsw,ult = 0.8·qsw·Ub
    }
    var Fsw_accept = Fsw_ult;
    if (Fsw_accept > 0) {
      if (Fsw_accept > 0.25 * Fb_ult) {
        if (Fsw_accept > Fb_ult) Fsw_accept = Fb_ult;
      } else {
        Fsw_accept = 0;  // по нормам учитывается не более 25% Fb_ult
      }
    }
    var Fult = Fb_ult + Fsw_accept;  // предельное усилие (бетон + арматура), т

    // —— Эксцентриситет центра контура от центра колонны из-за отверстий и краёв плиты (Xc, Yc), мм. Отчёт НИИЖБ ф. 2.6, 3.6, 3.7. Excel: статические моменты как в файле «41. Пилон в осях 2.6_Бс-Вс»
    var Sx_otv = 0, Sy_otv = 0, Xc = 0, Yc = 0, Ibx_otv = 0, Iby_otv = 0, Ibx = 0, Iby = 0, Wbx = 0, Wby = 0, Mbx_ult = 0, Mby_ult = 0;
    var Lx = Ax + h0, Ly = Ay + h0;  // размеры контура по осям, мм
    for (var hi = 0; hi < holesFiltered.length; hi++) {
      var hlx = holesFiltered[hi].lx, hly = holesFiltered[hi].ly, hx = holesFiltered[hi].x, hy = holesFiltered[hi].y;
      if (hlx <= 0 || hly <= 0) continue;
      var a = hlx * hly;  // площадь отверстия, мм²
      Sx_otv += (a * hy) / 100;   // статический момент площади отверстий (как в Excel: /100)
      Sy_otv += (a * hx) / 100;
      Ibx_otv += (hlx * Math.pow(hly, 3) / 12 + a * hy * hy) / 1000;  // момент инерции отв. (мм⁴ → см⁴)
      Iby_otv += (Math.pow(hlx, 3) * hly / 12 + a * hx * hx) / 1000;
    }
    // Вклад отключённых сторон контура (края плиты): lu_сн, lu_св, lu_сп, lu_сл в мм; результат мм³ → см³: /100
    // Слева: Sy_отв = lu_сн*(lu_сн/2 − x_cx) + lu_св*(lu_св/2 − x_cx) + lu_сп*((Ax+h0)/2)
    if (edgeLeft) {
      Sy_otv += (lu_sn * (lu_sn / 2 - x_cx) + lu_sv * (lu_sv / 2 - x_cx) + lu_sp * ((Ax + h0) / 2)) / 100;
    }
    // Справа: Sy_отв = lu_сн*(x_cx − lu_сн/2) + lu_св*(x_cx − lu_св/2) + lu_сл*((Ax+h0)/2)
    if (edgeRight) {
      Sy_otv += (lu_sn * (x_cx - lu_sn / 2) + lu_sv * (x_cx - lu_sv / 2) + lu_sl * ((Ax + h0) / 2)) / 100;
    }
    // Снизу: Sx_отв = lu_сл*(lu_сл/2 − x_cy) + lu_сп*(lu_сп/2 − x_cy) + lu_св*((Ay+h0)/2)
    if (edgeBottom) {
      Sx_otv += (lu_sl * (lu_sl / 2 - x_cy) + lu_sp * (lu_sp / 2 - x_cy) + lu_sv * ((Ay + h0) / 2)) / 100;
    }
    // Сверху: Sx_отв = lu_сл*(x_cy − lu_сл/2) + lu_сп*(x_cy − lu_сп/2) + lu_сн*((Ay+h0)/2)
    if (edgeTop) {
      Sx_otv += (lu_sl * (x_cy - lu_sl / 2) + lu_sp * (x_cy - lu_sp / 2) + lu_sn * ((Ay + h0) / 2)) / 100;
    }
    if (Ub > 0) {
      Xc = -(Sy_otv * 100 / Ub);  // координата центра тяжести контура (минус статический момент / Ub)
      Yc = -(Sx_otv * 100 / Ub);
    }
    // Моменты инерции приведённого контура Ibx, Iby в см³. При «угле» — общая формула, логика угла позже. Формулы граней: мм⁴/1000 → см³.
    var edgeCorner = (edgeLeft || edgeRight) && (edgeTop || edgeBottom);
    if (edgeLeft && !edgeCorner) {
      Ibx = (Math.pow(lu_sv, 3) / 6 + 2 * lu_sv * Math.pow(x_cx + Math.abs(Xc) - lu_sv / 2, 2) + Ly * Math.pow(lu_sv - x_cx - Math.abs(Xc), 2)) / 1000 - Ibx_otv;
    } else if (edgeRight && !edgeCorner) {
      Ibx = (Math.pow(lu_sv, 3) / 6 + 2 * lu_sv * Math.pow(x_cx + Math.abs(Xc) - lu_sv / 2, 2) + Ly * Math.pow(lu_sv - x_cx - Math.abs(Xc), 2)) / 1000 - Ibx_otv;
    } else if (edgeBottom && !edgeCorner) {
      Ibx = (Math.pow(lu_sv, 3) / 12 + (lu_sp * Math.pow(lu_sv, 2)) / 2) / 1000 - Ibx_otv;
    } else if (edgeTop && !edgeCorner) {
      Ibx = (Math.pow(lu_sn, 3) / 12 + (lu_sp * Math.pow(lu_sn, 2)) / 2) / 1000 - Ibx_otv;
    } else {
      Ibx = Math.pow(Ly / 10, 3) / 6 + (Lx / 10) * Math.pow(Ly / 10, 2) / 2 - Ibx_otv - (Ub / 10) * Math.pow(Yc / 10, 2);
    }
    if (edgeLeft && !edgeCorner) {
      Iby = (Math.pow(lu_sp, 3) / 12 + (lu_sn * Math.pow(lu_sp, 2)) / 2) / 1000 - Iby_otv;
    } else if (edgeRight && !edgeCorner) {
      Iby = (Math.pow(lu_sl, 3) / 12 + (lu_sn * Math.pow(lu_sl, 2)) / 2) / 1000 - Iby_otv;
    } else if (edgeBottom && !edgeCorner) {
      Iby = (Math.pow(lu_sp, 3) / 6 + 2 * lu_sp * Math.pow(x_cy + Math.abs(Yc) - lu_sp / 2, 2) + Lx * Math.pow(lu_sp - x_cy - Math.abs(Yc), 2)) / 1000 - Iby_otv;
    } else if (edgeTop && !edgeCorner) {
      Iby = (Math.pow(lu_sl, 3) / 6 + 2 * lu_sl * Math.pow(x_cy + Math.abs(Yc) - lu_sl / 2, 2) + Lx * Math.pow(lu_sl - x_cy - Math.abs(Yc), 2)) / 1000 - Iby_otv;
    } else {
      Iby = Math.pow(Lx / 10, 3) / 6 + (Ly / 10) * Math.pow(Lx / 10, 2) / 2 - Iby_otv - (Ub / 10) * Math.pow(Xc / 10, 2);
    }
    if (Ibx < 0) Ibx = 0;
    if (Iby < 0) Iby = 0;
    var epsI = 1e-6;
    if (Ibx < epsI) Ibx = epsI;
    if (Iby < epsI) Iby = epsI;
    var y_ras = 0, x_ras = 0;
    if ((edgeLeft || edgeRight) && !edgeCorner && Ub > 0) {
      y_ras = (lu_sv * lu_sv) / Ub;
      x_ras = (lu_sv * lu_sv) / Ub;
    }
    if ((edgeBottom || edgeTop) && !edgeCorner && Ub > 0) {
      x_ras = (lu_sp * lu_sp) / Ub;
      y_ras = (lu_sp * lu_sp) / Ub;
    }
    var Xmax = Lx / 2 + Math.abs(Xc), Ymax = Ly / 2 + Math.abs(Yc);
    if ((edgeLeft || edgeRight) && !edgeCorner) {
      if (x_ras > 1e-6) Wbx = Ibx * 10 / x_ras;
      if (Xmax > 1e-6) Wby = Iby * 10 / Xmax;
    } else if ((edgeBottom || edgeTop) && !edgeCorner) {
      if (Ymax > 1e-6) Wbx = Ibx * 10 / Ymax;
      if (y_ras > 1e-6) Wby = Iby * 10 / y_ras;
    } else {
      if (Ymax > 1e-6) Wbx = Ibx * 10 / Ymax;
      if (Xmax > 1e-6) Wby = Iby * 10 / Xmax;
    }
    // Предельные моменты по СП ф. 8.84: Mb,ult = Rbt·W·h0 (размерности: МПа·см³·мм → т·м)
    Mbx_ult = useMx ? Math.floor(Rbt * (Wbx/100) * (h0/1000) * 100) / 100 : 0;
    Mby_ult = useMy ? Math.floor(Rbt * (Wby/100) * (h0/1000) * 100) / 100 : 0;
    var Mx, My;
    if ((edgeLeft || edgeRight) && !edgeCorner) {
      Mx = Math.abs(Mlocx / 2 + F * (Xc / 1000));
      My = useMy ? Math.abs(Mlocy / 2 + F * (Xc / 1000)) : 0;
    } else if ((edgeBottom || edgeTop) && !edgeCorner) {
      Mx = useMx ? Math.abs(Mlocx / 2 + F * (Yc / 1000)) : 0;
      My = Math.abs(Mlocy / 2 + F * (Yc / 1000));
    } else {
      Mx = useMx ? Math.abs(Mlocx / 2 + F * (Yc / 1000)) : 0;
      My = useMy ? Math.abs(Mlocy / 2 + F * (Xc / 1000)) : 0;
    }
    // Предельные моменты от поперечной арматуры (Excel строки 68–71): Msw,ult = 0.8·qsw·W/10000, принимаем не более Mb,ult
    var Msw_x_ult = (useMx && Fsw_ult > 0.25 * Fb_ult && qsw > 0 && Wbx > 0) ? Math.floor(0.8 * qsw * Wbx / 10000 * 100) / 100 : 0;
    var Msw_y_ult = (useMy && Fsw_ult > 0.25 * Fb_ult && qsw > 0 && Wby > 0) ? Math.floor(0.8 * qsw * Wby / 10000 * 100) / 100 : 0;
    var Msw_x_accept = (Msw_x_ult > 0 && Mbx_ult > 0) ? Math.min(Msw_x_ult, Mbx_ult) : Msw_x_ult;
    var Msw_y_accept = (Msw_y_ult > 0 && Mby_ult > 0) ? Math.min(Msw_y_ult, Mby_ult) : Msw_y_ult;
    var Mx_ult = (useMx ? Msw_x_accept + Mbx_ult : 0);  // предельный момент по Х (бетон + арматура), т·м
    var My_ult = (useMy ? Msw_y_accept + Mby_ult : 0);
    var M_ratio = 0;
    if (Fult > 0 && (Mx_ult > 0 || My_ult > 0)) {
      if (Mx_ult > 0 && My_ult > 0) M_ratio = Mx / Mx_ult + My / My_ult;
      else if (Mx_ult > 0) M_ratio = Mx / Mx_ult;
      else M_ratio = My / My_ult;
    }
    var M_accept = M_ratio;
    if (Fult > 0 && M_accept > F / (2 * Fult)) M_accept = F / (2 * Fult);  // ограничение по СП 8.98

    var k = (F / Fult) + M_accept;  // условие прочности СП ф. 8.96: k ≤ 1
    var ok = k <= 1;
    var thicknessOk = F <= 2 * Fb_ult;  // проверка толщины: без усиления допускается F не более 2·Fb_ult
    // Коэф. использования по бетону для неармированного сечения: F/Fb,ult + Mx/Mbx,ult + My/Mby,ult
    var kb = 0;
    if (Fb_ult > 0) kb = F / Fb_ult;
    if (Mbx_ult > 0 && useMx) kb += Mx / Mbx_ult;
    if (Mby_ult > 0 && useMy) kb += My / Mby_ult;

    var text = '';
    text += '═══════════════════════════════════════════════════════════\n';
    text += '  ОТЧЁТ ПО РАСЧЁТУ НА ПРОДАВЛИВАНИЕ\n';
    text += '  СП 63.13330.2018, отчёт НИИЖБ (Договор №709)\n';
    text += '═══════════════════════════════════════════════════════════\n\n';

    text += '1. ИСХОДНЫЕ ДАННЫЕ\n';
    text += '   Колонна: Ax = ' + Ax + ' мм, Ay = ' + Ay + ' мм.\n';
    text += '   Плита: h = ' + h + ' мм, защитные слои ax = ' + ax + ' мм, ay = ' + ay + ' мм.\n';
    if (edgeLeft || edgeRight || edgeBottom || edgeTop) {
      text += '   Край плиты (отключённые стороны): ' + (edgeLeft ? 'слева ' : '') + (edgeRight ? 'справа ' : '') + (edgeBottom ? 'снизу ' : '') + (edgeTop ? 'сверху ' : '') + '\n';
    }
    if (holes.length > 0) {
      for (var hi = 0; hi < holes.length; hi++) {
        var ho = holes[hi];
        if (ho.lx > 0 && ho.ly > 0) {
          text += '   Отверстие ' + (hi + 1) + ': ' + ho.lx + '×' + ho.ly + ' мм, центр (' + ho.x + '; ' + ho.y + ') мм от центра колонны';
          if (holeIncluded[hi] === false) text += ' (не учитывается: расстояние от колонны > 6·h0)';
          text += '.\n';
        }
      }
    }
    text += '   Бетон ' + beton + ', арматура ' + armatura + ', диаметр ' + diam + ' мм. γb1 = ' + gb1 + ', mkp = ' + mkp + '.\n';
    text += '   N = ' + F_sila.toFixed(2) + ' т, p = ' + p.toFixed(2) + ' т/м². Mloc,x = ' + Mlocx.toFixed(2) + ', Mloc,y = ' + Mlocy.toFixed(2) + ' т·м.\n\n';

    text += '2. РАСЧЁТ (формулы по СП и отчёту НИИЖБ)\n\n';
    text += '   2.1. Расчётные сопротивления, МПа:\n';
    text += '        Rbt = Rbt_coef · γb1 · mkp = ' + (Rbt_coef[beton] || 0) + ' · ' + gb1 + ' · ' + mkp + ' = ' + Rbt.toFixed(2) + ' МПа;\n';
    text += '        Rsw = ' + Rsw + ' МПа.\n\n';
    text += '   2.2. Рабочая высота сечения, мм [ф. 1.13]:\n';
    text += '        h0 = ((h − ax) + (h − ay)) / 2 = ' + h0.toFixed(1) + ' мм.\n\n';
    text += '   2.3. Отпор в зоне отпора, т [ф. 1.3]:\n';
    text += '        Площадь зоны = (Ax + 2·h0)·(Ay + 2·h0) = ' + areaZone.toFixed(0) + ' мм²;\n';
    text += '        Площадь отверстий = ' + holeArea.toFixed(0) + ' мм²;\n';
    text += '        Fp = p · (площадь зоны − площадь отв.) / 10⁶ = ' + Fp.toFixed(2) + ' т.\n\n';
    text += '   2.4. Усилие продавливания, т [ф. 1.8]:\n';
    text += '        F = N − Fp = ' + F_sila.toFixed(2) + ' − ' + Fp.toFixed(2) + ' = ' + F.toFixed(2) + ' т.\n\n';
    var fullPerimeter = 2 * (Ay + 2 * h0) + 2 * (Ax + 2 * h0);  // периметр без отверстий и без отключённых сторон
    text += '   2.5. Периметр расчётного контура, мм [СП 63 п. 8.1.46–8.1.52, ф. 2.10, 2.11 НИИЖБ; участки контура, попадающие в отверстия, не учитываются, см. webcad.pro prod_fma_otv]:\n';
    text += '        lu_сл = ' + lu_sl.toFixed(0) + ', lu_сп = ' + lu_sp.toFixed(0) + ', lu_сн = ' + lu_sn.toFixed(0) + ', lu_св = ' + lu_sv.toFixed(0) + ' мм;\n';
    text += '        Ub = lu_сл + lu_сп + lu_сн + lu_св = ' + Ub.toFixed(0) + ' мм.\n';
    if (holesFiltered.length > 0 && !edgeLeft && !edgeRight && !edgeBottom && !edgeTop && Math.abs(Ub - fullPerimeter) < 1) {
      text += '        (Отверстия не пересекают контур — учтены только в Fp; для уменьшения Ub сместите отверстие к колонне.)\n';
    }
    text += '\n';
    text += '   2.6. Предельное усилие, воспринимаемое бетоном, т [ф. 8.88 СП]:\n';
    text += '        Fb,ult = Rbt · Ub · h0 / 10000 = ' + Rbt.toFixed(2) + ' · ' + Ub.toFixed(0) + ' · ' + h0.toFixed(1) + ' / 10000 = ' + Fb_ult.toFixed(2) + ' т (' + (Fb_ult * 10).toFixed(0) + ' кН).\n\n';

    text += '   2.7. Проверка толщины плиты:\n';
    if (thicknessOk) {
      text += '        F ≤ 2·Fb,ult  →  ' + F.toFixed(2) + ' ≤ ' + (2*Fb_ult).toFixed(2) + ' — выполнена.\n\n';
    } else {
      text += '        F > 2·Fb,ult — не выполнена. Рекомендуется увеличить толщину плиты или предусмотреть поперечную арматуру.\n\n';
    }

    if (Fsw_accept > 0) {
      text += '   2.8. Поперечная арматура: шаг ' + stepX + '×' + stepY + ' мм.';
      if (n_stirrups > 0) text += ' Число хомутов (Х ' + (armManual ? 'ручной режим (вдоль a)' : xAlong === 'b' ? 'вдоль b' : 'вдоль a') + (xCountCorrection !== 0 ? ', корректировка ' + (xCountCorrection > 0 ? '+' : '') + xCountCorrection : '') + ') n = ' + n_stirrups + '.';
      text += '\n        Fsw,ult (принято) = ' + Fsw_accept.toFixed(2) + ' т.\n';
      text += '        Fult = Fb,ult + Fsw = ' + Fult.toFixed(2) + ' т.\n\n';
    } else {
      text += '   2.8. Fult = Fb,ult = ' + Fult.toFixed(2) + ' т.\n\n';
    }

    if (useMx || useMy) {
      text += '   2.9. Учёт изгибающих моментов [ф. 3.7, 8.98, 8.84 СП]:\n';
      text += '        Эксцентриситеты: Xc = ' + Xc.toFixed(1) + ' мм, Yc = ' + Yc.toFixed(1) + ' мм.\n';
      text += '        Wbx = ' + Wbx.toFixed(2) + ' см², Wby = ' + Wby.toFixed(2) + ' см²;\n';
      text += '        Mbx,ult = ' + Mbx_ult.toFixed(2) + ' т·м, Mby,ult = ' + Mby_ult.toFixed(2) + ' т·м.\n';
      text += '        Mx = ' + Mx.toFixed(3) + ' т·м, My = ' + My.toFixed(3) + ' т·м; M (с ограничением) = ' + M_accept.toFixed(3) + '.\n\n';
    }

    text += '   2.10. Условие прочности [ф. 8.96 СП]:\n';
    text += '        k = F/Fult + M = ' + F.toFixed(2) + '/' + Fult.toFixed(2) + ' + ' + M_accept.toFixed(3) + ' = ' + k.toFixed(3) + '.\n';
    text += '        Требование: k ≤ 1.\n\n';

    // Проверка по контурам 1·h0 … 4·h0 (СП п. 8.1.47): для каждого контура на расстоянии u·h0 считаем Ub и k
    if (multiContour) {
      text += '3. ПРОВЕРКА ПО НЕСКОЛЬКИМ КОНТУРАМ [п. 8.1.47 СП]\n';
      for (var u = 1; u <= 4; u++) {
        var uh = u * h0;  // расстояние от грани колонны до контура, мм
        var lu_sl_u = edgeLeft ? 0 : Math.max(0, (Ay + 2*uh) - holeOverlapLeft(uh));
        var lu_sp_u = edgeRight ? 0 : Math.max(0, (Ay + 2*uh) - holeOverlapRight(uh));
        var lu_sn_u = edgeBottom ? 0 : Math.max(0, (Ax + 2*uh) - holeOverlapBottom(uh));
        var lu_sv_u = edgeTop ? 0 : Math.max(0, (Ax + 2*uh) - holeOverlapTop(uh));
        var Ub_u = lu_sl_u + lu_sp_u + lu_sn_u + lu_sv_u;
        if (Ub_u <= 0) break;
        var Fb_u = Math.floor(Rbt * Ub_u * h0 / 10000 * 100) / 100;
        var Fult_u = (u === 1) ? Fult : Fb_u;
        var M_u = (u === 1) ? M_accept : 0;
        var k_u = F / Fult_u + M_u;
        text += '   Контур ' + u + '·h0: Ub = ' + Ub_u.toFixed(0) + ' мм, Fb,ult = ' + Fb_u.toFixed(2) + ' т, k = ' + k_u.toFixed(3) + (k_u <= 1 ? ' — условие выполнено.' : '') + '\n';
        if (k_u <= 1) break;
      }
      text += '\n';
    }

    text += '4. ВЫВОД\n';
    if (ok) {
      text += '   Условие k ≤ 1 выполнено. Прочность на продавливание обеспечена.\n';
    } else {
      text += '   k > 1. Требуется увеличить толщину плиты или усилить поперечное армирование.\n';
    }
    text += '\n5. НОРМАТИВНЫЕ ССЫЛКИ\n';
    text += '   СП 63.13330.2018: ф. 8.88, 8.84, 8.96–8.98, п. 8.1.47.\n';
    text += '   Научно-технический отчёт ГУП «НИИЖБ» (Договор №709 от 01.10.2002): ф. 1.3, 1.8, 1.10, 1.13, 2.6, 2.10, 2.11, 3.6, 3.7.\n';

    return {
      ok: ok, error: null, reportText: text,
      thicknessOk: thicknessOk, kb: kb,
      F: F, Fult: Fult, k: k, h0: h0, Ub: Ub, Fb_ult: Fb_ult,
      lu_sl: lu_sl, lu_sp: lu_sp, lu_sn: lu_sn, lu_sv: lu_sv,
      Rbt: Rbt, Rsw: Rsw, Rbt_coef: Rbt_coef[beton], gb1: gb1, mkp: mkp, beton: beton,
      Fp: Fp, Fsw_accept: Fsw_accept, Fsw_ult: Fsw_ult, n_stirrups: n_stirrups,
      xAlong: xAlong, xAlongA_val: xAlongA_val, xAlongB_val: xAlongB_val, xCountCorrection: xCountCorrection,
      Asw_cm2: Asw_cm2, qsw: qsw, areaZone: areaZone, holeArea: holeArea, F_sila: F_sila, p: p,
      Xc: Xc, Yc: Yc, Sx_otv: Sx_otv, Sy_otv: Sy_otv, Ibx_otv: Ibx_otv, Iby_otv: Iby_otv, Ibx: Ibx, Iby: Iby,
      y_ras: y_ras, x_ras: x_ras,
      Wbx: Wbx, Wby: Wby, Mbx_ult: Mbx_ult, Mby_ult: Mby_ult, M_accept: M_accept, Mx: Mx, My: My,
      Msw_x_ult: Msw_x_ult, Msw_y_ult: Msw_y_ult, Msw_x_accept: Msw_x_accept, Msw_y_accept: Msw_y_accept,
      Mx_ult: Mx_ult, My_ult: My_ult,
      useMx: useMx, useMy: useMy,
      holeIncluded: holeIncluded
    };
  }

  global.runCalc = runCalc;
})(typeof window !== 'undefined' ? window : this);
