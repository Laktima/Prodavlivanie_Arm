/**
 * Информационные сообщения и предупреждения (6 проверок).
 * Логика и формулировки соответствуют типовому расчёту на продавливание.
 * [1] СП 63.13330.2018, [2] Отчёт НИИЖБ.
 */

(function (global) {
  'use strict';

  /**
   * Формирует 6 информационных сообщений по результату расчёта.
   * Порядок и формулировки фиксированы.
   * @param {Object} result - результат runCalc
   * @returns {Array<{type: string, text: string}>}
   */
  function getCalcInfoMessages(result) {
    var list = [];
    if (!result) return list;

    if (result.error) {
      list.push({ type: 'error', text: result.error });
      return list;
    }

    var F = result.F, Fb_ult = result.Fb_ult, Fsw_ult = result.Fsw_ult || 0;
    var Fult = result.Fult, k = result.k, kb = result.kb != null ? result.kb : (Fb_ult > 0 ? F / Fb_ult : 0);
    var twoFb = 2 * Fb_ult;

    // 1. F меньше/больше 2*Fb,ult
    if (F <= twoFb) {
      var diff1 = (twoFb - F).toFixed(2);
      list.push({
        type: 'ok',
        text: '1. F = ' + F.toFixed(2) + 'т меньше на ' + diff1 + 'т, 2*Fb,ult=' + twoFb.toFixed(1) + 'т, условие выполнено!'
      });
    } else {
      var diff1b = (F - twoFb).toFixed(2);
      list.push({
        type: 'warning',
        text: '1. F = ' + F.toFixed(2) + 'т больше на ' + diff1b + 'т, 2*Fb,ult=' + twoFb.toFixed(1) + 'т, условие не выполнено!'
      });
    }

    // 2. F меньше/больше Fb,ult
    if (F <= Fb_ult) {
      var diff2 = (Fb_ult - F).toFixed(2);
      list.push({
        type: 'ok',
        text: '2. F = ' + F.toFixed(2) + 'т меньше на ' + diff2 + 'т, Fb,ult=' + Fb_ult.toFixed(1) + 'т, армирование не требуется.'
      });
    } else {
      var diff2b = (F - Fb_ult).toFixed(2);
      list.push({
        type: 'warning',
        text: '2. F = ' + F.toFixed(2) + 'т больше на ' + diff2b + 'т, Fb,ult=' + Fb_ult.toFixed(1) + 'т, требуется армирование!'
      });
    }

    // 3. Fsw,ult и 0,25*Fb,ult
    var q25 = 0.25 * Fb_ult;
    if (Fsw_ult <= q25) {
      list.push({
        type: 'ok',
        text: '3. Fsw,ult = ' + Fsw_ult.toFixed(2) + 'т меньше или равно 0,25*Fb,ult=' + q25.toFixed(2) + 'т, условие учтено.'
      });
    } else {
      var diff3 = (Fsw_ult - q25).toFixed(2);
      list.push({
        type: 'ok',
        text: '3. Fsw,ult = ' + Fsw_ult.toFixed(2) + 'т больше на ' + diff3 + 'т, 0,25*Fb,ult=' + q25.toFixed(2) + 'т, условие выполнено!'
      });
    }

    // 4. Fsw,ult и Fb,ult (переармирование)
    if (Fsw_ult <= Fb_ult) {
      list.push({
        type: 'ok',
        text: '4. Fsw,ult = ' + Fsw_ult.toFixed(2) + 'т не более Fb,ult=' + Fb_ult.toFixed(1) + 'т, армирование в норме.'
      });
    } else {
      var diff4 = (Fsw_ult - Fb_ult).toFixed(2);
      list.push({
        type: 'warning',
        text: '4. Fsw,ult = ' + Fsw_ult.toFixed(2) + 'т больше на ' + diff4 + 'т, Fb,ult=' + Fb_ult.toFixed(1) + 'т, переармировано, можно уменьшить армирование!'
      });
    }

    // 5. kb — Коэф. использования по бетону (неармированное сечение)
    if (kb <= 0.8) {
      list.push({
        type: 'ok',
        text: '5. kb (Коэф. использования по бетону) = ' + kb.toFixed(2) + ', не больше 0,8, конструктивное армирование не требуется.'
      });
    } else {
      list.push({
        type: 'warning',
        text: '5. kb (Коэф. использования по бетону) = ' + kb.toFixed(2) + ', больше 0,8, требуется конструктивное армирование!'
      });
    }

    // 6. ksw (Коэф. использования) — прочность, ф. 8.96 [1]
    if (k <= 1) {
      list.push({
        type: 'ok',
        text: '6. ksw (Коэф. использования) = ' + k.toFixed(2) + ', требуемая прочность обеспечена!, ф. 8.96 [1]'
      });
    } else {
      list.push({
        type: 'warning',
        text: '6. ksw (Коэф. использования) = ' + k.toFixed(2) + ', требуемая прочность не обеспечена!, ф. 8.96 [1]'
      });
    }

    return list;
  }

  /**
   * Информационные сообщения для вкладки «Колонна круглая» (те же по смыслу проверки: F vs 2·Fb,ult, F vs Fb,ult, k, k_comb).
   * @param {Object} result - результат runCalcCircular
   * @returns {Array<{type: string, text: string}>}
   */
  function getCalcInfoMessagesCircular(result) {
    var list = [];
    if (!result) return list;
    if (result.error) {
      list.push({ type: 'error', text: result.error });
      return list;
    }
    var F = result.F, Fb_ult = result.Fb_ult, k_F = result.k_F != null ? result.k_F : (Fb_ult > 0 ? F / Fb_ult : 0), k_comb = result.k_comb;
    var twoFb = 2 * Fb_ult;

    if (F <= twoFb) {
      list.push({ type: 'ok', text: '1. F = ' + F.toFixed(2) + ' кН меньше 2·Fb,ult = ' + twoFb.toFixed(1) + ' кН — условие выполнено.' });
    } else {
      list.push({ type: 'warning', text: '1. F = ' + F.toFixed(2) + ' кН больше 2·Fb,ult = ' + twoFb.toFixed(1) + ' кН — условие не выполнено!' });
    }
    if (F <= Fb_ult) {
      list.push({ type: 'ok', text: '2. F = ' + F.toFixed(2) + ' кН ≤ Fb,ult = ' + Fb_ult.toFixed(1) + ' кН — армирование не требуется.' });
    } else {
      list.push({ type: 'warning', text: '2. F = ' + F.toFixed(2) + ' кН > Fb,ult = ' + Fb_ult.toFixed(1) + ' кН — требуется поперечная арматура!' });
    }
    if (k_F <= 0.8) {
      list.push({ type: 'ok', text: '3. k(F) = ' + k_F.toFixed(2) + ' ≤ 0,8 — конструктивное армирование не требуется.' });
    } else {
      list.push({ type: 'warning', text: '3. k(F) = ' + k_F.toFixed(2) + ' > 0,8 — рекомендуется конструктивное армирование!' });
    }
    if (k_comb <= 1) {
      list.push({ type: 'ok', text: '4. Итоговый коэффициент k = ' + (k_comb != null ? k_comb.toFixed(3) : '—') + ' ≤ 1 — прочность обеспечена (ф. 8.96 [1]).' });
    } else {
      list.push({ type: 'warning', text: '4. Итоговый коэффициент k = ' + (k_comb != null ? k_comb.toFixed(3) : '—') + ' > 1 — прочность не обеспечена; при k > 2 необходима капитель.' });
    }
    return list;
  }

  /**
   * Информационные сообщения для вкладки «Стена» (торец/угол).
   */
  function getCalcInfoMessagesWall(result) {
    var list = [];
    if (!result) return list;
    if (result.error) {
      list.push({ type: 'error', text: result.error });
      return list;
    }
    var F = result.F, Fb_ult = result.Fb_ult, k_F = result.k_F != null ? result.k_F : (Fb_ult > 0 ? F / Fb_ult : 0), k_comb = result.k_comb;
    var twoFb = 2 * Fb_ult;
    if (F <= twoFb) {
      list.push({ type: 'ok', text: '1. F = ' + F.toFixed(2) + ' кН ≤ 2·Fb,ult = ' + twoFb.toFixed(1) + ' кН — условие выполнено.' });
    } else {
      list.push({ type: 'warning', text: '1. F = ' + F.toFixed(2) + ' кН > 2·Fb,ult = ' + twoFb.toFixed(1) + ' кН — условие не выполнено!' });
    }
    if (F <= Fb_ult) {
      list.push({ type: 'ok', text: '2. F ≤ Fb,ult — армирование не требуется.' });
    } else {
      list.push({ type: 'warning', text: '2. F > Fb,ult — требуется поперечная арматура!' });
    }
    if (k_F <= 0.8) {
      list.push({ type: 'ok', text: '3. k(F) = ' + k_F.toFixed(2) + ' ≤ 0,8.' });
    } else {
      list.push({ type: 'warning', text: '3. k(F) = ' + k_F.toFixed(2) + ' > 0,8 — рекомендуется армирование!' });
    }
    if (k_comb <= 1) {
      list.push({ type: 'ok', text: '4. Итоговый k = ' + (k_comb != null ? k_comb.toFixed(3) : '—') + ' ≤ 1 — прочность обеспечена.' });
    } else {
      list.push({ type: 'warning', text: '4. Итоговый k = ' + (k_comb != null ? k_comb.toFixed(3) : '—') + ' > 1; при k > 2 — капитель или увеличение размеров.' });
    }
    return list;
  }

  global.getCalcInfoMessages = getCalcInfoMessages;
  global.getCalcInfoMessagesCircular = getCalcInfoMessagesCircular;
  global.getCalcInfoMessagesWall = getCalcInfoMessagesWall;
})(typeof window !== 'undefined' ? window : this);
