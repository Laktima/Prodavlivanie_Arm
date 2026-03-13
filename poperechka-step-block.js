/**
 * Расчёт блока шага поперечной арматуры по Excel «Автоматическая_поперечка_)».
 * Полная реализация логики листа Лист1, строки 6–26.
 *
 * СООТВЕТСТВИЕ ЯЧЕЕК EXCEL:
 *   F6 = h0 — рабочая высота сечения, мм
 *   F7 = a  — размер колонны по X (Ax), мм
 *   F8 = b  — размер колонны по Y (Ay), мм
 *   E11 = шаг арматуры вдоль a (X), мм
 *   E12 = шаг арматуры вдоль b (Y), мм
 *   F15 = h0*2/3 — максимальный допустимый шаг по СП 63 (мм)
 *   F16 = h0/3 — минимальный допустимый шаг (мм)
 *   F17 = h0/2
 *   F18 = h0*1.5 — вылет зоны армирования от грани колонны (мм)
 *   F19 = (a+h0/2+h0/2)/4 = (a+h0)/4 — доп. ограничение max шага вдоль a
 *   F20 = (b+h0)/4 — доп. ограничение max шага вдоль b
 *
 * ПРОВЕРКИ (Excel: "Пройдено!" / "Ошибка!"):
 *   - Шаг: step <= h0/3 И step <= (a+h0)/4 (оба — максимумы, row 11: E11<=G11, E11<=F11)
 *   - Отступ до 1-го стержня: h0/3 ≤ offset ≤ h0*2/3
 *   - Отступ до последнего стержня: offset ≥ h0*1.5
 */

(function (global) {
  'use strict';

  /**
   * Расчёт всех параметров расстановки поперечной арматуры.
   * Полная логика Excel «Автоматическая_поперечка_)», строки 6–26.
   *
   * @param {number} h0 - рабочая высота сечения, мм (F6)
   * @param {number} a - размер колонны по X (Ax), мм (F7)
   * @param {number} b - размер колонны по Y (Ay), мм (F8)
   * @param {number} stepA - шаг стержней вдоль оси a (X), мм (E11)
   * @param {number} stepB - шаг стержней вдоль оси b (Y), мм (E12)
   * @returns {Object} все параметры для отображения в блоке шага
   */
  function poperechkaStepBlock(h0, a, b, stepA, stepB) {
    // ═══════════════════════════════════════════════════════════════
    // ГРАНИЦЫ ШАГА (СП 63: h0/3 ≤ s ≤ 2·h0/3)
    // ═══════════════════════════════════════════════════════════════

    // F16: h0/3 — минимальный шаг, мм. Шаг не должен быть меньше.
    var h0_3 = h0 / 3;

    // F15: h0*2/3 — максимальный шаг по норме, мм.
    var h0_23 = h0 * 2 / 3;

    // F17: h0/2 (для справки)
    var h0_2 = h0 / 2;

    // F18: h0*1.5 — вылет зоны армирования от грани колонны, мм.
    // Все стержни должны располагаться в зоне на расстоянии ≤ 1.5·h0 от грани.
    var h0_15 = h0 * 1.5;

    // F19: (a+h0/2+h0/2)/4 = (a+h0)/4 — доп. ограничение max шага вдоль a (Excel).
    var maxStepA_limit = (a + h0) / 4;

    // F20: (b+h0)/4 — доп. ограничение max шага вдоль b.
    var maxStepB_limit = (b + h0) / 4;

    // Итоговый max шаг по Excel: step <= F16 (h0/3) И step <= F19 ((a+h0)/4). Оба — максимумы.
    var stepMaxA = Math.min(h0_3, maxStepA_limit);
    var stepMaxB = Math.min(h0_3, maxStepB_limit);

    // ═══════════════════════════════════════════════════════════════
    // ДЛИНЫ ЗОН (Excel: max длина, min длина)
    // ═══════════════════════════════════════════════════════════════

    // J7 = h0/3, J8 = h0*2/3 для первого стержня (min/max отступ)
    // max длина для первого = F7+J7+J7 = a + 2*(h0/3)
    var maxLenFirstA = a + 2 * h0_3;
    var minLenFirstA = a + 2 * h0_23;
    var maxLenFirstB = b + 2 * h0_3;
    var minLenFirstB = b + 2 * h0_23;

    // R7 = h0*1.5 — для последнего стержня
    // max длина до последнего = F7+R7+R7 = a + 2*(h0*1.5)
    var zoneLenA = a + 2 * h0_15;
    var zoneLenB = b + 2 * h0_15;

    // ═══════════════════════════════════════════════════════════════
    // КОЛИЧЕСТВО ШАГОВ (Excel: Делимое = длина/шаг, Итог = ROUNDDOWN/ROUNDUP)
    // ═══════════════════════════════════════════════════════════════

    // L9 = J9/E11 = maxLenFirstA/stepA, L10 = minLenFirstA/stepA
    // M9 = AVERAGE(L9,L10), N9 = ROUNDDOWN(M9,0) — кол-во шагов до 1-го стержня
    var divFirstA = maxLenFirstA / stepA;
    var divFirstA_min = minLenFirstA / stepA;
    var nStepsA = (divFirstA >= 1 && divFirstA_min >= 1)
      ? Math.floor((divFirstA + divFirstA_min) / 2)
      : Math.max(1, Math.floor(zoneLenA / stepA));

    var divFirstB = maxLenFirstB / stepB;
    var divFirstB_min = minLenFirstB / stepB;
    var nStepsB = (divFirstB >= 1 && divFirstB_min >= 1)
      ? Math.floor((divFirstB + divFirstB_min) / 2)
      : Math.max(1, Math.floor(zoneLenB / stepB));

    // T9 = R9/E11+1 (исправл.), V9 = ROUNDUP(T9,0) — кол-во шагов до последнего
    var nStepsLastA = Math.ceil(zoneLenA / stepA + 1);
    var nStepsLastB = Math.ceil(zoneLenB / stepB + 1);

    // ═══════════════════════════════════════════════════════════════
    // ОТСТУПЫ (Excel: Итог (отступ) = (n*step - a)/2)
    // ═══════════════════════════════════════════════════════════════

    // N12 = (N9*E11-F7)/2 — отступ до 1-го стержня вдоль a
    var offsetFirstA = (nStepsA * stepA - a) / 2;
    var offsetFirstB = (nStepsB * stepB - b) / 2;

    // V12 = (V9*E11-F7)/2 — отступ до последнего стержня вдоль a
    var offsetLastA = (nStepsLastA * stepA - a) / 2;
    var offsetLastB = (nStepsLastB * stepB - b) / 2;

    // ═══════════════════════════════════════════════════════════════
    // ПРОВЕРКИ (Excel: IF(...)=1,"Пройдено!","Ошибка!")
    // ═══════════════════════════════════════════════════════════════

    // Шаг по Excel: E11<=G11 и E11<=F11 — step <= h0/3 И step <= (a+h0)/4 (оба макс.)
    var stepA_ok = stepA <= h0_3 && stepA <= maxStepA_limit;
    var stepB_ok = stepB <= h0_3 && stepB <= maxStepB_limit;

    // Отступ 1-го: h0/3 ≤ offset ≤ h0*2/3 (допуск 2 мм)
    var tol = 2;
    var firstA_ok = offsetFirstA >= h0_3 - tol && offsetFirstA <= h0_23 + tol;
    var firstB_ok = offsetFirstB >= h0_3 - tol && offsetFirstB <= h0_23 + tol;

    // Отступ последнего: offset ≥ h0*1.5
    var lastA_ok = offsetLastA >= h0_15 - tol;
    var lastB_ok = offsetLastB >= h0_15 - tol;

    return {
      // Исходные
      h0: h0, a: a, b: b, stepA: stepA, stepB: stepB,

      // Границы шага
      h0_3: h0_3, h0_23: h0_23, h0_2: h0_2, h0_15: h0_15,
      stepMaxA: stepMaxA, stepMaxB: stepMaxB,
      maxStepA_limit: maxStepA_limit, maxStepB_limit: maxStepB_limit,

      // Зоны
      zoneLenA: zoneLenA, zoneLenB: zoneLenB,
      maxLenFirstA: maxLenFirstA, maxLenFirstB: maxLenFirstB,

      // Количество шагов
      nStepsA: nStepsA, nStepsB: nStepsB,
      nStepsLastA: nStepsLastA, nStepsLastB: nStepsLastB,

      // Отступы
      offsetFirstA: offsetFirstA, offsetFirstB: offsetFirstB,
      offsetLastA: offsetLastA, offsetLastB: offsetLastB,

      // Результаты проверок
      stepA_ok: stepA_ok, stepB_ok: stepB_ok,
      firstA_ok: firstA_ok, firstB_ok: firstB_ok,
      lastA_ok: lastA_ok, lastB_ok: lastB_ok
    };
  }

  global.poperechkaStepBlock = poperechkaStepBlock;
})(typeof window !== 'undefined' ? window : this);
