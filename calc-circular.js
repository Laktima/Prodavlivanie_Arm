/**
 * Расчёт плиты на продавливание при круглой колонне по примеру
 * «05_Круглая колонна в середине плиты» (Примеры продавливания).
 * Контур: u = π·(D + h0); Fb,ult = Rbt·A; поперечная арматура: qsw, Fsw.ult, Fult, Msw.ult, Mult.
 */

(function (global) {
  'use strict';

  /**
   * Расчёт на продавливание для круглой колонны (в kN, kN·m как в примере).
   * @param {Object} input - { D, h, ax, ay, d, beton, armatura, gb1, mkp, F_sila, p, Mx, My, nsw, ssw }
   * @returns {{ ok, error, reportText, F, Fult, k, h0, Ub, Fb_ult, Rbt, Wb, Mb_ult, M, k_comb, Asw_cm2, qsw, Fsw_ult, ... }}
   */
  function runCalcCircular(input) {
    var D = Number(input.D) || 0;   // диаметр колонны, мм
    var h = Number(input.h) || 0;
    var ax = Number(input.ax) || 0;
    var ay = Number(input.ay) || 0;
    var d = Number(input.d) || 0;   // диаметр арматуры плиты, мм (для h0x, h0y и Asw)
    var beton = input.beton || 'B25';
    var armatura = input.armatura || 'А240';
    var gb1 = Number(input.gb1) || 1;
    var mkp = Number(input.mkp) || 1;
    var F_sila = Number(input.F_sila) || 0;  // N, kN
    var p = Number(input.p) || 0;            // отпор, т/м²
    var Mx = Number(input.Mx) || 0;         // kN·m
    var My = Number(input.My) || 0;         // kN·m
    var nsw = Math.max(0, parseInt(input.nsw, 10) || 0);   // кол-во стержней в расчётном контуре
    var ssw = Math.max(1, Number(input.ssw) || 75);         // шаг стержней, мм

    var Rbt_coef = global.Rbt_coef || {};
    var Rbt = (Rbt_coef[beton] || 0) * gb1 * mkp;
    var Rsw_MPa = global.Rsw_MPa || {};
    var Rsw = Rsw_MPa[armatura] != null ? Rsw_MPa[armatura] : 0;
    // Asw: площадь в мм² для qsw, в см² для отчёта (π·d²/4)
    var Asw_mm2 = d > 0 ? (Math.PI * d * d / 4) : 0;
    var Asw_cm2 = d > 0 ? Math.round(Asw_mm2 / 100 * 1000) / 1000 : 0;

    // Рабочая высота как в примере: h0x = t − a − 0.5·d, h0y = t − a − 1.5·d, h0 = 0.5·(h0x + h0y)
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
    if (D <= 0) {
      return { ok: false, error: 'Задайте диаметр колонны D > 0.', reportText: '' };
    }

    // Периметр расчётного контура: u = π·(D + h0), мм
    var Ub = Math.PI * (D + h0);
    // Площадь расчётного контура (боковая поверхность) A = u·h0, м²
    var A_m2 = (Ub / 1000) * (h0 / 1000);
    // Fb,ult = Rbt·A, kN (Rbt МПа, A м² → Fb,ult кН)
    var Fb_ult = Rbt * A_m2 * 1000;
    Fb_ult = Math.round(Fb_ult * 100) / 100;

    // Зона отпора: площадь круга π·(D/2 + h0)², мм² → м²
    var areaZone_mm2 = Math.PI * Math.pow(D / 2 + h0, 2);
    var areaZone_m2 = areaZone_mm2 / 1e6;
    // Fp в kN: p т/м² · area м² · 9.81
    var Fp = p * areaZone_m2 * 9.81;
    if (Fp < 0) Fp = 0;
    var F = F_sila - Fp;

    // Момент сопротивления контура Wb = π·(D + h0)²/4, мм² → м²
    var Wb_mm2 = Math.PI * Math.pow(D + h0, 2) / 4;
    var Wb_m2 = Wb_mm2 / 1e6;
    // Mb,ult = Rbt·Wb·h0 (Rbt МПа, Wb м², h0 м → Mb,ult кН·м)
    var Mb_ult = Rbt * Wb_m2 * (h0 / 1000) * 1000;
    Mb_ult = Math.round(Mb_ult * 1000) / 1000;

    var M = Math.sqrt(Mx * Mx + My * My);
    var k_F = Fb_ult > 0 ? F / Fb_ult : 0;
    var k_M = Mb_ult > 0 ? M / Mb_ult : 0;

    // Поперечная арматура (по примеру 05_Круглая колонна): qsw, Fsw.ult, Fult, Msw.ult, Mult
    var qsw = 0;
    var Fsw_ult = 0;
    var Msw_ult = 0;
    if (nsw > 0 && ssw > 0 && Rsw > 0 && Asw_mm2 > 0) {
      // qsw, кН/м: Rsw (МПа) · Asw (мм²) · nsw / ssw (мм) → N/mm = kN/m
      qsw = Rsw * Asw_mm2 * nsw / ssw;
      qsw = Math.round(qsw * 1000) / 1000;
      // Fsw.ult = 0.8 · qsw · U (U в м)
      Fsw_ult = 0.8 * qsw * (Ub / 1000);
      Fsw_ult = Math.round(Fsw_ult * 1000) / 1000;
      // Msw.ult = 0.8 · qsw · Wb (Wb в м²)
      Msw_ult = 0.8 * qsw * Wb_m2;
      Msw_ult = Math.round(Msw_ult * 1000) / 1000;
    }
    var Fult = (nsw > 0 && Fsw_ult > 0)
      ? Math.min(2 * Fb_ult, Fb_ult + Fsw_ult)
      : Fb_ult;
    Fult = Math.round(Fult * 100) / 100;
    var Mult = (nsw > 0 && Msw_ult > 0)
      ? Math.min(2 * Mb_ult, Mb_ult + Msw_ult)
      : Mb_ult;
    Mult = Math.round(Mult * 1000) / 1000;

    // Итоговый коэффициент по примеру: вклад момента ограничен 0.5·F/Fb,ult (по бетону); с арматурой — по Fult/Mult
    var k_comb = k_F + (k_M <= 0.5 * k_F ? k_M : 0.5 * k_F);
    if (Fult > Fb_ult && Mult > Mb_ult) {
      var kF_arm = F / Fult;
      var kM_arm = M / Mult;
      k_comb = kF_arm + (kM_arm <= 0.5 * kF_arm ? kM_arm : 0.5 * kF_arm);
    }
    k_comb = Math.round(k_comb * 1000) / 1000;

    var k = Fult > 0 ? F / Fult : (F <= 0 ? 0 : 999);
    var ok = k_comb <= 1;
    var thicknessOk = F <= 2 * Fb_ult;

    var text = '';
    text += '═══════════════════════════════════════════════════════════\n';
    text += '  РАСЧЁТ НА ПРОДАВЛИВАНИЕ: КРУГЛАЯ КОЛОННА В СЕРЕДИНЕ ПЛИТЫ\n';
    text += '  По примеру 05_Круглая колонна в середине плиты\n';
    text += '═══════════════════════════════════════════════════════════\n\n';
    text += '1. ИСХОДНЫЕ ДАННЫЕ\n';
    text += '   Усилия: N = ' + F_sila.toFixed(2) + ' кН, Mx = ' + Mx.toFixed(2) + ' кН·м, My = ' + My.toFixed(2) + ' кН·м.\n';
    text += '   Колонна: диаметр D = ' + D + ' мм.\n';
    text += '   Плита: h = ' + h + ' мм, защитные слои ax = ' + ax + ' мм, ay = ' + ay + ' мм, d = ' + d + ' мм.\n';
    text += '   Бетон ' + beton + ', γb1 = ' + gb1 + ', mkp = ' + mkp + ', Rbt = ' + Rbt.toFixed(2) + ' МПа.\n';
    text += '   Арматура ' + armatura + ', Rsw = ' + Rsw + ' МПа; поперечная: nsw = ' + nsw + ', ssw = ' + ssw + ' мм.\n';
    text += '   Отпор p = ' + p.toFixed(2) + ' т/м².\n\n';
    text += '2. РАСЧЁТ\n';
    text += '   2.1. Рабочая высота: h0x = h − ax − 0.5·d = ' + h0x.toFixed(1) + ' мм, h0y = h − ay − 1.5·d = ' + h0y.toFixed(1) + ' мм;\n';
    text += '        h0 = 0.5·(h0x + h0y) = ' + h0.toFixed(1) + ' мм.\n\n';
    text += '   2.2. Периметр расчётного контура: u = π·(D + h0) = ' + Ub.toFixed(2) + ' мм (' + (Ub / 10).toFixed(2) + ' см).\n\n';
    text += '   2.3. Площадь расчётного контура A = u·h0 = ' + A_m2.toFixed(4) + ' м².\n\n';
    text += '   2.4. Fb,ult = Rbt·A = ' + Rbt.toFixed(2) + ' · ' + A_m2.toFixed(4) + ' · 1000 = ' + Fb_ult.toFixed(2) + ' кН.\n\n';
    text += '   2.5. Зона отпора: площадь = π·(D/2 + h0)² = ' + areaZone_mm2.toFixed(0) + ' мм²;\n';
    text += '        Fp = p · площадь · 9.81 / 10⁶ = ' + Fp.toFixed(2) + ' кН;\n';
    text += '        F = N − Fp = ' + F_sila.toFixed(2) + ' − ' + Fp.toFixed(2) + ' = ' + F.toFixed(2) + ' кН.\n\n';
    text += '   2.6. Момент сопротивления контура: Wb = π·(D + h0)²/4 = ' + Wb_m2.toFixed(4) + ' м².\n\n';
    text += '   2.7. Mb,ult = Rbt·Wb·h0 = ' + Mb_ult.toFixed(3) + ' кН·м.\n\n';
    text += '   2.8. M = √(Mx² + My²) = ' + M.toFixed(3) + ' кН·м.\n\n';
    text += '   2.9. Проверка толщины: F ≤ 2·Fb,ult  →  ' + F.toFixed(2) + ' ≤ ' + (2 * Fb_ult).toFixed(2) + ' — ' + (thicknessOk ? 'выполнена' : 'не выполнена') + '.\n\n';
    if (nsw > 0 && ssw > 0 && Rsw > 0) {
      text += '2.10. Поперечная арматура (по примеру 05):\n';
      text += '      Rsw = ' + Rsw + ' МПа, Asw = π·d²/4 = ' + Asw_cm2.toFixed(3) + ' см², nsw = ' + nsw + ', ssw = ' + ssw + ' мм.\n';
      text += '      qsw = Rsw·Asw·nsw/ssw = ' + qsw.toFixed(3) + ' кН/м.\n';
      text += '      Fsw,ult = 0.8·qsw·u = ' + Fsw_ult.toFixed(3) + ' кН.\n';
      text += '      Fult = min(2·Fb,ult, Fb,ult + Fsw,ult) = ' + Fult.toFixed(2) + ' кН.\n';
      text += '      Msw,ult = 0.8·qsw·Wb = ' + Msw_ult.toFixed(3) + ' кН·м.\n';
      text += '      Mult = min(2·Mb,ult, Mb,ult + Msw,ult) = ' + Mult.toFixed(3) + ' кН·м.\n\n';
    }
    text += '3. ПРОВЕРКА ПРОЧНОСТИ\n';
    text += '   k(F) = F / Fb,ult = ' + k_F.toFixed(3) + ';\n';
    text += '   k(M) = M / Mb,ult = ' + k_M.toFixed(3) + ';\n';
    if (Fult > Fb_ult) {
      text += '   С учётом арматуры: k = F/Fult = ' + k.toFixed(3) + ', Fult = ' + Fult.toFixed(2) + ' кН.\n';
    }
    text += '   Итоговый коэффициент k = ' + k_comb.toFixed(3) + '.\n';
    if (ok) {
      text += '   Условие k ≤ 1 выполнено. Прочность обеспечена.\n';
    } else {
      text += '   k > 1. Если > 1 — необходима установка поперечной арматуры;\n';
      text += '   если > 2 — необходима капитель.\n';
    }
    text += '\n4. НОРМАТИВНЫЕ ССЫЛКИ\n';
    text += '   Пример «05_Круглая колонна в середине плиты», СП 63.13330.2018.\n';

    return {
      ok: ok,
      error: null,
      reportText: text,
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
      Wb_m2: Wb_m2,
      Wb_mm2: Wb_mm2,
      Mb_ult: Mb_ult,
      M: M,
      Fp: Fp,
      areaZone_m2: areaZone_m2,
      areaZone_mm2: areaZone_mm2,
      D: D,
      beton: beton,
      armatura: armatura,
      gb1: gb1,
      mkp: mkp,
      F_sila: F_sila,
      p: p,
      Mx: Mx,
      My: My,
      nsw: nsw,
      ssw: ssw,
      Rsw: Rsw,
      Asw_cm2: Asw_cm2,
      qsw: qsw,
      Fsw_ult: Fsw_ult,
      Msw_ult: Msw_ult,
      Mult: Mult
    };
  }

  global.runCalcCircular = runCalcCircular;
})(typeof window !== 'undefined' ? window : this);
