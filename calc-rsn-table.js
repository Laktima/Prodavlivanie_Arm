/**
 * Таблица «Перебор РСН» на вкладке Калькулятор → Колонна.
 * Расчёт kb (коэф. исп. по бетону) по аналогии с Excel: F / Fb_ult,
 * где F = N − Fp (усилие продавливания), Fb_ult = Rbt·Ub·h0/10000.
 * Значения из таблицы в основной расчёт не передаются.
 */

(function (global) {
  'use strict';

  var RSN_IDS = [1, 4, 5, 6, 7];

  /**
   * Вычисляет kb для одной строки РСН.
   * По аналогии с Excel (D76 = IFERROR(D37/D67+D75, 0)): коэф. исп. по бетону = F / Fb_ult.
   * @param {number} N - вертикальная сила, т
   * @param {number} Fp - отпор в зоне отпора, т (из основного расчёта или 0)
   * @param {number} Fb_ult - предельное усилие по бетону, т (Rbt·Ub·h0/10000)
   * @returns {number|null} kb округлённый до 2 знаков или null при невозможности расчёта
   */
  function calcKb(N, Fp, Fb_ult) {
    if (Fb_ult == null || Fb_ult <= 0) return null;
    var F = (Number(N) || 0) - (Number(Fp) || 0);
    if (F < 0) F = 0;
    return Math.round((F / Fb_ult) * 100) / 100;
  }

  /**
   * Читает из результата runCalc параметры для расчёта kb (Rbt, h0, Ub, Fp).
   * Если основного расчёта не было или ошибка — возвращает null.
   * @param {Object} [params] - результат runCalc (должен содержать ok, Rbt, h0, Ub, Fp)
   * @returns {{ Rbt: number, h0: number, Ub: number, Fp: number }|null}
   */
  function getParamsFromCalc(params) {
    if (!params || !params.ok || params.h0 <= 0 || params.Ub <= 0) return null;
    var Rbt = params.Rbt != null ? params.Rbt : 0;
    if (!Rbt) return null;
    return {
      Rbt: Rbt,
      h0: params.h0,
      Ub: params.Ub,
      Fp: params.Fp != null ? params.Fp : 0
    };
  }

  /**
   * Fb_ult по СП 63: Rbt·Ub·h0/10000, т.
   */
  function getFbUlt(Rbt, Ub, h0) {
    if (!Rbt || !Ub || !h0) return null;
    return Math.floor(Rbt * Ub * h0 / 10000 * 100) / 100;
  }

  /**
   * Обновляет ячейки kb в таблице. Параметры (Rbt, h0, Ub, Fp) передаются снаружи
   * (после основного расчёта или при ручном вводе — тогда вызывающий код должен их подготовить).
   * @param {Object} calcParams - { Rbt, h0, Ub, Fp } или null (тогда показываем «—»)
   */
  function updateKbCells(calcParams) {
    var Fb_ult = null;
    var Fp = 0;
    if (calcParams && calcParams.Ub > 0 && calcParams.h0 > 0) {
      Fb_ult = getFbUlt(calcParams.Rbt, calcParams.Ub, calcParams.h0);
      Fp = calcParams.Fp != null ? calcParams.Fp : 0;
    }

    RSN_IDS.forEach(function (id) {
      var cell = document.getElementById('rsn_kb_' + id);
      if (!cell) return;
      if (Fb_ult == null || Fb_ult <= 0) {
        cell.textContent = '—';
        return;
      }
      var nInput = document.getElementById('rsn_N_' + id);
      var N = nInput && nInput.value !== '' ? parseFloat(nInput.value) : null;
      if (N == null || isNaN(N)) {
        cell.textContent = '—';
        return;
      }
      var kb = calcKb(N, Fp, Fb_ult);
      cell.textContent = kb != null ? String(kb) : '—';
    });
  }

  /**
   * Подписка на изменение полей таблицы и на результат основного расчёта.
   * Вызывается из app.js после загрузки DOM.
   */
  function initRsnTable() {
    var inputs = [];
    RSN_IDS.forEach(function (id) {
      ['N', 'Mx', 'My'].forEach(function (key) {
        var el = document.getElementById('rsn_' + key + '_' + id);
        if (el) inputs.push(el);
      });
    });
    function onInput() {
      var params = global.lastCalcParamsForRsn || null;
      updateKbCells(params);
    }
    inputs.forEach(function (el) {
      el.addEventListener('input', onInput);
      el.addEventListener('change', onInput);
    });
    updateKbCells(global.lastCalcParamsForRsn || null);
  }

  global.calcRsnTable = {
    calcKb: calcKb,
    getParamsFromCalc: getParamsFromCalc,
    getFbUlt: getFbUlt,
    updateKbCells: updateKbCells,
    initRsnTable: initRsnTable,
    RSN_IDS: RSN_IDS
  };
})(typeof window !== 'undefined' ? window : this);
