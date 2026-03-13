/**
 * Расчёт расстановки поперечной арматуры по методике из Excel «Автоматическая_поперечка_)».
 * Все формулы и переменные приведены в соответствие с листом Excel (Лист1).
 * Используется для расчёта координат стержней и проверки шагов/отступов.
 *
 * Соответствие ячеек Excel:
 *   F6 = h0 (рабочая высота, мм)
 *   F7 = a (размер сечения по X, мм)
 *   F8 = b (размер сечения по Y, мм)
 *   E11 = шаг арматуры вдоль a, мм
 *   E12 = шаг арматуры вдоль b, мм
 *   F15 = h0*2/3 (max шаг)
 *   F16 = h0/3 (min шаг)
 *   F18 = h0*1.5 (зона армирования)
 *   F19 = (a+h0)/4, F20 = (b+h0)/4 — доп. ограничение шага
 */

(function (global) {
  'use strict';

  /**
   * Расчёт параметров расстановки поперечной арматуры.
   * Логика соответствует Excel «Автоматическая_поперечка_)», строки 6–24.
   *
   * @param {number} h0 - рабочая высота сечения, мм (ячейка F6)
   * @param {number} a - размер колонны по X (Ax), мм (ячейка F7)
   * @param {number} b - размер колонны по Y (Ay), мм (ячейка F8)
   * @param {number} stepA - шаг стержней вдоль оси a (X), мм (ячейка E11)
   * @param {number} stepB - шаг стержней вдоль оси b (Y), мм (ячейка E12)
   * @returns {Object} все параметры расстановки и проверки
   */
  function poperechkaCalc(h0, a, b, stepA, stepB) {
    // === Границы шага (СП 63: h0/3 ≤ s ≤ 2·h0/3) ===
    // F16: h0/3 — минимальный шаг, мм
    var h0_3 = h0 / 3;
    // F15: h0*2/3 — максимальный шаг по норме, мм
    var h0_23 = h0 * 2 / 3;
    // F18: h0*1.5 — вылет зоны армирования от грани колонны, мм
    var h0_15 = h0 * 1.5;
    // F19: (a+h0/2+h0/2)/4 = (a+h0)/4 — доп. ограничение max шага вдоль a
    var maxStepA = (a + h0) / 4;
    // F20: (b+h0)/4 — доп. ограничение max шага вдоль b
    var maxStepB = (b + h0) / 4;

    // === Длина зоны расстановки ===
    // Excel: max длинна = F7+J7+J7 = a + 2*(h0/3) для первого стержня (min отступ)
    //        min длинна = F7+J8+J8 = a + 2*(h0*2/3)
    //        max длинна для последнего = F7+R7+R7 = a + 2*(h0*1.5)
    var zoneLenA = a + 2 * h0_15;
    var zoneLenB = b + 2 * h0_15;

    // === Количество шагов до первого стержня (Excel: L9=J9/E11, L10=J10/E11, M9=AVERAGE(L9,L10), N9=ROUNDDOWN(M9,0)) ===
    var divFirstA = (a + 2 * h0_3) / stepA;
    var divFirstA_min = (a + 2 * h0_23) / stepA;
    var nStepsA = (divFirstA >= 1 && divFirstA_min >= 1)
      ? Math.floor((divFirstA + divFirstA_min) / 2)
      : Math.max(1, Math.floor(zoneLenA / stepA));
    var divFirstB = (b + 2 * h0_3) / stepB;
    var divFirstB_min = (b + 2 * h0_23) / stepB;
    var nStepsB = (divFirstB >= 1 && divFirstB_min >= 1)
      ? Math.floor((divFirstB + divFirstB_min) / 2)
      : Math.max(1, Math.floor(zoneLenB / stepB));

    // === Отступ до первого стержня (Excel N12, N24: =(n*step - a)/2) ===
    var offsetFirstA = (nStepsA * stepA - a) / 2;
    var offsetFirstB = (nStepsB * stepB - b) / 2;

    // === Количество шагов до последнего стержня (Excel: T9=R9/E11+1, V9=ROUNDUP(T9,0)) ===
    var nStepsLastA = Math.ceil(zoneLenA / stepA + 1);
    var nStepsLastB = Math.ceil(zoneLenB / stepB + 1);
    var offsetLastA = (nStepsLastA * stepA - a) / 2;
    var offsetLastB = (nStepsLastB * stepB - b) / 2;

    // === Проверки (Excel row 11: E11<=G11 и E11<=F11 — step<=F19 и step<=F16, оба макс.) ===
    var stepMaxA = Math.min(h0_3, maxStepA);
    var stepMaxB = Math.min(h0_3, maxStepB);
    var stepA_ok = stepA <= h0_3 && stepA <= maxStepA;
    var stepB_ok = stepB <= h0_3 && stepB <= maxStepB;
    var tol = 2;
    var firstA_ok = offsetFirstA >= h0_3 - tol && offsetFirstA <= h0_23 + tol;
    var firstB_ok = offsetFirstB >= h0_3 - tol && offsetFirstB <= h0_23 + tol;
    var lastA_ok = offsetLastA >= h0_15 - tol;
    var lastB_ok = offsetLastB >= h0_15 - tol;

    return {
      h0: h0, a: a, b: b, stepA: stepA, stepB: stepB,
      h0_3: h0_3, h0_23: h0_23, h0_15: h0_15, maxStepA: maxStepA, maxStepB: maxStepB,
      stepMaxA: stepMaxA, stepMaxB: stepMaxB,
      nStepsA: nStepsA, nStepsB: nStepsB, offsetFirstA: offsetFirstA, offsetFirstB: offsetFirstB,
      nStepsLastA: nStepsLastA, nStepsLastB: nStepsLastB, offsetLastA: offsetLastA, offsetLastB: offsetLastB,
      stepA_ok: stepA_ok, stepB_ok: stepB_ok, firstA_ok: firstA_ok, firstB_ok: firstB_ok, lastA_ok: lastA_ok, lastB_ok: lastB_ok
    };
  }

  global.poperechkaCalc = poperechkaCalc;
})(typeof window !== 'undefined' ? window : this);
