/**
 * Расчёт плиты на продавливание у стены/пилона по примерам 04, 06, 07 (Примеры продавливания).
 * Типы: торец в середине плиты, торец на краю плиты, угол стены.
 */

(function (global) {
  'use strict';

  /**
   * Расчёт на продавливание для стены (торец или угол).
   * @param {Object} input - { type, t1, c, a1, a2, h, ax, ay, d, beton, armatura, gb1, mkp, F_sila, p, My, useMy, nsw, ssw }
   *   type: 'torec_mid' | 'torec_edge' | 'ugol'
   * @returns {{ ok, error, reportText, F, Fult, k, h0, Ub, Fb_ult, ... }}
   */
  function runCalcWall(input) {
    var type = input.type || 'torec_mid';
    var t1 = Number(input.t1) || 0;   // толщина торца, мм
    var c = Number(input.c) || 0;     // консоль (торец на краю), мм
    var a1 = Number(input.a1) || 0;  // толщина стены по X (угол), мм
    var a2 = Number(input.a2) || 0;  // толщина стены по Y (угол), мм
    var h = Number(input.h) || 0;
    var ax = Number(input.ax) || 0;
    var ay = Number(input.ay) || 0;
    var d = Number(input.d) || 0;
    var beton = input.beton || 'B25';
    var armatura = input.armatura || 'А240';
    var gb1 = Number(input.gb1) || 1;
    var mkp = Number(input.mkp) || 1;
    var F_sila = Number(input.F_sila) || 0;
    var p = Number(input.p) || 0;
    var My = (input.useMy !== false && input.My != null) ? Number(input.My) || 0 : 0;
    var nsw = Math.max(0, parseInt(input.nsw, 10) || 0);
    var ssw = Math.max(1, Number(input.ssw) || 60);

    var Rbt_coef = global.Rbt_coef || {};
    var Rbt = (Rbt_coef[beton] || 0) * gb1 * mkp;
    var Rsw_MPa = global.Rsw_MPa || {};
    var Rsw = Rsw_MPa[armatura] != null ? Rsw_MPa[armatura] : 0;
    var Asw_mm2 = d > 0 ? (Math.PI * d * d / 4) : 0;
    var Asw_cm2 = d > 0 ? Math.round(Asw_mm2 / 100 * 1000) / 1000 : 0;

    var h0x = h - ax - 0.5 * d;
    var h0y = h - ay - 1.5 * d;
    var h0 = 0.5 * (h0x + h0y);
    if (d <= 0) {
      h0x = h - ax;
      h0y = h - ay;
      h0 = 0.5 * (h0x + h0y);
    }

    if (h0 <= 0) {
      return { ok: false, error: 'h0 ≤ 0. Проверьте h, ax, ay, d.', reportText: '' };
    }

    var Ub = 0;
    var A_m2 = 0;
    var Ly = 0;
    var Lx = 0;
    var Wb_y_m2 = 0;
    var Mb_y_ult = 0;
    var areaZone_m2 = 0;
    var Ib_y_cm4 = 0;
    var U_diag = 0;

    if (type === 'torec_mid') {
      if (t1 <= 0) return { ok: false, error: 'Задайте толщину торца t1 > 0.', reportText: '' };
      Ly = t1 + h0;
      Lx = Ly;
      Ub = 2 * Lx + Ly;
      A_m2 = (Ub / 1000) * (h0 / 1000);
      areaZone_m2 = (Lx / 1000) * (Ly / 1000);
      var Ib_y_mm4 = (7 / 12) * Math.pow(Ly, 3);
      Ib_y_cm4 = Ib_y_mm4 / 10000;
      var Wb_y_mm3 = Ib_y_mm4 / (Ly / 2);
      Wb_y_m2 = (7 / 6) * Math.pow(Ly / 1000, 2);
      Mb_y_ult = Rbt * Wb_y_m2 * (h0 / 1000) * 1000;
      Mb_y_ult = Math.round(Mb_y_ult * 1000) / 1000;
    } else if (type === 'torec_edge') {
      if (t1 <= 0) return { ok: false, error: 'Задайте толщину торца t1 > 0.', reportText: '' };
      Lx = t1 + 0.5 * h0 + c;
      Ly = 0;
      Ub = 2 * Lx;
      A_m2 = (Ub / 1000) * (h0 / 1000);
      areaZone_m2 = (Lx * (t1 + h0)) / 1e6;
      var y_max = 0.5 * (ax + h0);
      var Ib_y_mm4_edge = 2 * Lx * Math.pow(y_max, 2);
      Ib_y_cm4 = Ib_y_mm4_edge / 10000;
      Wb_y_m2 = (2 * Lx * y_max) / 1e6;
      Mb_y_ult = Rbt * Wb_y_m2 * (h0 / 1000) * 1000;
      Mb_y_ult = Math.round(Mb_y_ult * 1000) / 1000;
    } else {
      if (a1 <= 0 || a2 <= 0) return { ok: false, error: 'Задайте a1 > 0 и a2 > 0 для угла стены.', reportText: '' };
      var halfH0 = 0.5 * h0;
      Lx = a1 + halfH0;
      Ly = a2 + halfH0;
      U_diag = Math.sqrt(Math.pow(a1 - halfH0, 2) + Math.pow(a2 - halfH0, 2));
      U_diag = Math.round(U_diag * 100) / 100;
      Ub = 2 * (a1 + a2 + halfH0) + U_diag;
      A_m2 = (Ub / 1000) * (h0 / 1000);
      areaZone_m2 = (Ub * h0) / 1e6 / 2;
    }

    Ub = Math.round(Ub * 100) / 100;
    A_m2 = Math.round(A_m2 * 10000) / 10000;
    var Fb_ult = Rbt * A_m2 * 1000;
    Fb_ult = Math.round(Fb_ult * 100) / 100;

    var Fp = p * areaZone_m2 * 9.81;
    if (Fp < 0) Fp = 0;
    var F = F_sila - Fp;

    var qsw = 0;
    var Fsw_ult = 0;
    var Msw_y_ult = 0;
    if (nsw > 0 && ssw > 0 && Rsw > 0 && Asw_mm2 > 0) {
      qsw = Rsw * Asw_mm2 * nsw / ssw;
      qsw = Math.round(qsw * 1000) / 1000;
      Fsw_ult = 0.8 * qsw * (Ub / 1000);
      Fsw_ult = Math.round(Fsw_ult * 1000) / 1000;
      if (type !== 'ugol' && Wb_y_m2 > 0) {
        Msw_y_ult = 0.8 * qsw * Wb_y_m2;
        Msw_y_ult = Math.round(Msw_y_ult * 1000) / 1000;
      }
    }

    var Fult = (nsw > 0 && Fsw_ult > 0) ? Math.min(2 * Fb_ult, Fb_ult + Fsw_ult) : Fb_ult;
    Fult = Math.round(Fult * 100) / 100;

    var My_ult = Mb_y_ult;
    if (type !== 'ugol' && nsw > 0 && Msw_y_ult > 0) {
      My_ult = Math.min(2 * Mb_y_ult, Mb_y_ult + Msw_y_ult);
      My_ult = Math.round(My_ult * 1000) / 1000;
    }

    var k_F = Fb_ult > 0 ? F / Fb_ult : 0;
    var k_M = (type !== 'ugol' && Mb_y_ult > 0) ? My / Mb_y_ult : 0;
    var k_comb = k_F + (k_M <= 0.5 * k_F ? k_M : 0.5 * k_F);
    if (Fult > Fb_ult && type !== 'ugol' && My_ult > Mb_y_ult) {
      var kF_arm = F / Fult;
      var kM_arm = My / My_ult;
      k_comb = kF_arm + (kM_arm <= 0.5 * kF_arm ? kM_arm : 0.5 * kF_arm);
    }
    if (type === 'ugol') k_comb = F / Fult;
    k_comb = Math.round(k_comb * 1000) / 1000;

    var k = Fult > 0 ? F / Fult : (F <= 0 ? 0 : 999);
    var ok = k_comb <= 1;
    var thicknessOk = F <= 2 * Fb_ult;

    var typeName = type === 'ugol' ? 'Угол стены' : (type === 'torec_edge' ? 'Торец на краю плиты' : 'Торец в середине плиты');
    var text = '';
    text += '═══════════════════════════════════════════════════════════\n';
    text += '  РАСЧЁТ НА ПРОДАВЛИВАНИЕ: ' + typeName.toUpperCase() + '\n';
    text += '  По примерам 04, 06, 07 (Примеры продавливания)\n';
    text += '═══════════════════════════════════════════════════════════\n\n';
    text += '1. ИСХОДНЫЕ ДАННЫЕ\n';
    text += '   N = ' + F_sila.toFixed(2) + ' кН';
    if (type !== 'ugol') text += ', My = ' + My.toFixed(2) + ' кН·м';
    text += '.\n';
    if (type === 'ugol') {
      text += '   Угол: a1 = ' + a1 + ' мм, a2 = ' + a2 + ' мм.\n';
    } else {
      text += '   Толщина торца t1 = ' + t1 + ' мм';
      if (type === 'torec_edge') text += ', консоль c = ' + c + ' мм';
      text += '.\n';
    }
    text += '   Плита: h = ' + h + ' мм, ax = ' + ax + ' мм, ay = ' + ay + ' мм, d = ' + d + ' мм.\n';
    text += '   Бетон ' + beton + ', Rbt = ' + Rbt.toFixed(2) + ' МПа; арматура ' + armatura + ', Rsw = ' + Rsw + ' МПа.\n';
    text += '   nsw = ' + nsw + ', ssw = ' + ssw + ' мм.\n\n';
    text += '2. РАСЧЁТ\n';
    text += '   h0 = 0.5·(h0x + h0y) = ' + h0.toFixed(1) + ' мм.\n';
    if (type === 'torec_mid') {
      text += '   Ly = t1 + h0 = ' + Ly.toFixed(0) + ' мм, Lx = Ly. Периметр u = 2·Lx + Ly = ' + Ub.toFixed(2) + ' мм.\n';
    } else if (type === 'torec_edge') {
      text += '   Lx = t1 + 0.5·h0 + c = ' + Lx.toFixed(0) + ' мм. Периметр u = 2·Lx = ' + Ub.toFixed(2) + ' мм.\n';
    } else {
      text += '   Периметр u = 2·(a1+a2+0.5·h0) + √((a1−0.5·h0)²+(a2−0.5·h0)²) = ' + Ub.toFixed(2) + ' мм.\n';
    }
    text += '   A = u·h0 = ' + A_m2.toFixed(4) + ' м².\n';
    text += '   Fb,ult = Rbt·A = ' + Fb_ult.toFixed(2) + ' кН.\n';
    text += '   F = N − Fp = ' + F.toFixed(2) + ' кН.\n';
    if (type !== 'ugol') {
      text += '   Wb.y = ' + Wb_y_m2.toFixed(4) + ' м², Mb.y,ult = ' + Mb_y_ult.toFixed(3) + ' кН·м.\n';
    }
    if (nsw > 0 && ssw > 0) {
      text += '   qsw = ' + qsw.toFixed(3) + ' кН/м, Fsw,ult = ' + Fsw_ult.toFixed(3) + ' кН.\n';
      text += '   Fult = min(2·Fb,ult, Fb,ult + Fsw,ult) = ' + Fult.toFixed(2) + ' кН.\n';
      if (type !== 'ugol') text += '   Msw.y,ult = ' + Msw_y_ult.toFixed(3) + ' кН·м, My,ult = ' + My_ult.toFixed(3) + ' кН·м.\n';
    }
    text += '\n3. ПРОВЕРКА\n';
    text += '   k(F) = F/Fb,ult = ' + k_F.toFixed(3) + '; итоговый k = ' + k_comb.toFixed(3) + '.\n';
    if (ok) text += '   Условие k ≤ 1 выполнено.\n';
    else text += '   k > 1 — необходима поперечная арматура или капитель.\n';
    text += '\n4. НОРМАТИВНЫЕ ССЫЛКИ\n';
    text += '   Примеры 04, 06, 07 (Торец/Угол стены), СП 63.13330.2018.\n';

    return {
      ok: ok,
      error: null,
      reportText: text,
      type: type,
      thicknessOk: thicknessOk,
      F: F,
      Fult: Fult,
      k: k,
      k_F: k_F,
      k_M: k_M,
      k_comb: k_comb,
      h0: h0,
      h0x: h0x,
      h0y: h0y,
      Ub: Ub,
      A_m2: A_m2,
      Fb_ult: Fb_ult,
      Rbt: Rbt,
      Rsw: Rsw,
      Mb_y_ult: Mb_y_ult,
      My_ult: My_ult,
      My: My,
      Fp: Fp,
      areaZone_m2: areaZone_m2,
      t1: t1,
      c: c,
      a1: a1,
      a2: a2,
      Lx: Lx,
      Ly: Ly,
      Wb_y_m2: Wb_y_m2,
      Ib_y_cm4: Ib_y_cm4,
      U_diag: U_diag,
      nsw: nsw,
      ssw: ssw,
      Asw_cm2: Asw_cm2,
      qsw: qsw,
      Fsw_ult: Fsw_ult,
      Msw_y_ult: Msw_y_ult
    };
  }

  global.runCalcWall = runCalcWall;
})(typeof window !== 'undefined' ? window : this);
