/**
 * Порядок и формат строк панели «Расчётные параметры».
 * Порядок соответствует типовому расчёту на продавливание (СП 63, отчёт НИИЖБ).
 */

(function (global) {
  'use strict';

  /**
   * Возвращает массив строк для таблицы параметров в нужном порядке.
   * @param {Object} r - результат runCalc
   * @returns {Array<{name: string, val: string, unit: string, desc: string}>}
   */
  function getCalcParamsRows(r) {
    function v(x, fmt) {
      if (x == null || x === undefined || (typeof x === 'number' && isNaN(x))) return '—';
      var n = Number(x);
      if (fmt === 0) return Math.round(n).toString();
      if (fmt === 1) return n.toFixed(1);
      if (fmt === 2) return n.toFixed(2);
      if (fmt === 3) return n.toFixed(3);
      if (fmt === 4) return n.toFixed(4);
      return String(x);
    }
    var rows = [
      { name: 'Rbt =', val: v(r.Rbt, 2), unit: 'МПа', desc: '1. Расчётное сопротивление бетона;' },
      { name: 'Rsw =', val: v(r.Rsw), unit: 'МПа', desc: '2. Расчётное сопротивление арматуры;' },
      { name: 'h0 =', val: v(r.h0, 1), unit: 'мм', desc: '3. Рабочая высота сечения, ф. 1.13 [2];' },
      { name: 'Fp =', val: v(r.Fp, 2), unit: 'т', desc: '4. Усилия отпора грунта, ф. 1.3 [2];' },
      { name: 'F =', val: v(r.F, 2), unit: 'т', desc: '5. Продавливающая сила за вычетом усилия отпора грунта, ф. 1.8 [2];' },
      { name: 'lu_сл =', val: v(r.lu_sl, 0), unit: 'мм', desc: '6.1 Размер стороны контура расчётного сечения слева, ф. 2.10 [2];' },
      { name: 'lu_сп =', val: v(r.lu_sp, 0), unit: 'мм', desc: '6.2 Размер стороны контура расчётного сечения справа, ф. 2.10 [2];' },
      { name: 'lu_сн =', val: v(r.lu_sn, 0), unit: 'мм', desc: '6.3 Размер стороны контура расчётного сечения снизу, ф. 2.11 [2];' },
      { name: 'lu_св =', val: v(r.lu_sv, 0), unit: 'мм', desc: '6.4 Размер стороны контура расчётного сечения сверху, ф. 2.11 [2];' },
      { name: 'Ub =', val: v(r.Ub, 0), unit: 'мм', desc: '7. Периметр контура бетона расчётного сечения, ф. 1.10 [2];' },
      { name: 'Fb,ult =', val: v(r.Fb_ult, 2), unit: 'т', desc: '8. Предельное усилие, воспринимаемое бетоном, ф. 8.88 [1];' },
      { name: 'Mx =', val: v(r.Mx, 3), unit: 'тм', desc: '9.1 Действующие изгибающие моменты вокруг оси Х;' },
      { name: 'My =', val: r.useMy ? v(r.My, 3) : '0', unit: 'тм', desc: r.useMy ? '9.2 Действующие изгибающие моменты вокруг оси У;' : '9.2 Му=0, т.к. отключён учёт момента Му;' },
      { name: 'Sx_отв =', val: v(r.Sx_otv, 2), unit: 'см³', desc: '10.1 Статические моменты площади отверстий относительно оси Х;' },
      { name: 'Sy_отв =', val: v(r.Sy_otv, 2), unit: 'см³', desc: '10.2 Статические моменты площади отверстий относительно оси У;' },
      { name: 'Xc =', val: v(r.Xc, 1), unit: 'мм', desc: '11.1 Эксцентриситет центра тяжести сечения по оси Х, ф. 3.7 [2];' },
      { name: 'Yс =', val: v(r.Yc, 1), unit: 'мм', desc: '11.2 Эксцентриситет центра тяжести сечения по оси У, ф. 3.7 [2];' },
      { name: 'Ibx_отв =', val: v(r.Ibx_otv, 2), unit: 'см⁴', desc: '12.1 Моменты инерций отверстий относительно оси Х;' },
      { name: 'Ibу_отв =', val: v(r.Iby_otv, 2), unit: 'см⁴', desc: '12.2 Моменты инерций отверстий относительно оси У;' },
      { name: 'Ibx =', val: v(r.Ibx, 2), unit: 'см³', desc: '13.1 Момент инерции бетонного сечения относительно оси Х, ф. 2.6 [2];' },
      { name: 'Ibу =', val: v(r.Iby, 2), unit: 'см³', desc: '13.2 Момент инерции бетонного сечения относительно оси У, ф. 2.6 [2];' },
      { name: 'Wbx =', val: v(r.Wbx, 2), unit: 'см³', desc: '14.1 Момент сопротивления бетонного сечения относительно оси Х, ф. 8.98 [1];' },
      { name: 'Wby =', val: v(r.Wby, 2), unit: 'см³', desc: '14.2 Момент сопротивления бетонного сечения относительно оси У, ф. 8.98 [1];' },
      { name: 'Mx =', val: v(r.Mx, 3), unit: 'тм', desc: '15.1 Учёт эксцентриситета приложения продавливающего момента относительно оси Х, ф. 3.6 [2];' },
      { name: 'My =', val: r.useMy ? v(r.My, 3) : '0', unit: 'тм', desc: r.useMy ? '15.2 Учёт эксцентриситета приложения продавливающего момента относительно оси У;' : '15.2 Му=0, т.к. отключён учёт момента Му;' },
      { name: 'Mbx,ult =', val: v(r.Mbx_ult, 2), unit: 'тм', desc: '16.1 Предельный момент относительно оси Х, воспринимаемый бетоном, ф. 8.84 [1];' },
      { name: 'Mby,ult =', val: r.useMy ? v(r.Mby_ult, 2) : '0', unit: 'тм', desc: r.useMy ? '16.2 Предельный момент относительно оси У, воспринимаемый бетоном;' : '16.2 Мbу,ult=0, т.к. отключён учёт момента Му;' },
      { name: 'Х =', val: v(r.n_stirrups, 0), unit: 'шт', desc: '17.1 Кол-во срезов стержней арматуры перпендикулярно расчётному контуру' + (r.xAlong === 'b' ? ' (X вдоль b: 2·(((h0/2−offsetFirstB)/stepY)+1));' : ' (X вдоль a: 2·(((h0/2−offsetFirstA)/stepX)+1));') + (r.xCountCorrection != null && r.xCountCorrection !== 0 ? ' Корректировка: ' + (r.xCountCorrection > 0 ? '+' : '') + r.xCountCorrection + '.' : '') },
      { name: 'Asw =', val: v(r.Asw_cm2, 3), unit: 'см²', desc: '17.2 Площадь стержней арматуры перпендикулярно расчётному контуру;' },
      { name: 'qswx =', val: v(r.qsw, 2), unit: 'т/м', desc: '18.1 Усилия в поперечной арматуре на единицу длины в направлении X, ф. 8.92 [1];' },
      { name: 'qswy =', val: v(r.qsw, 2), unit: 'т/м', desc: '18.2 Усилия в поперечной арматуре на единицу длины в направлении Y, ф. 8.92 [1];' },
      { name: 'Fsw,ult =', val: v(r.Fsw_ult, 3), unit: 'т', desc: '19.1 Усилие, воспринимаемое поперечной арматурой, ф. 8.91 [1];' }
    ];
    if (r.Fsw_accept > 0) {
      rows.push({ name: 'Принимаем Fsw,ult =', val: v(r.Fsw_accept, 3), unit: 'т', desc: 'т.к. Fsw,ult должно быть более, чем 0,25*Fb,ult=' + (r.Fb_ult * 0.25).toFixed(1) + 'т;' });
    }
    if (r.Fsw_ult > r.Fb_ult && r.Fb_ult > 0) {
      rows.push({ name: 'Принимаем Fsw,ult =', val: v(r.Fb_ult, 2), unit: 'т', desc: 'т.к. Fsw,ult должно быть не более, чем Fb,ult=' + r.Fb_ult.toFixed(1) + 'т;' });
    }
    rows.push({ name: 'Fult =', val: v(r.Fult, 2), unit: 'т', desc: '20. Предельная сила, воспринимаемая сечением;' });
    rows.push({ name: 'Msw,x,ult =', val: r.useMx ? v(r.Msw_x_ult, 2) : '0', unit: 'тм', desc: r.useMx ? '21.1 Предельный изгибающий момент относительно оси Х, воспринимаемый поперечной арматурой;' : '21.1 Мsw,x,ult=0, т.к. отключён учёт момента Мх;' });
    rows.push({ name: 'Msw,y,ult =', val: r.useMy ? v(r.Msw_y_ult, 2) : '0', unit: 'тм', desc: r.useMy ? '21.2 Предельный изгибающий момент относительно оси У, воспринимаемый поперечной арматурой;' : '21.2 Мsw,y,ult=0, т.к. отключён учёт момента Му;' });
    rows.push({ name: 'Принимаем Msw,x,ult =', val: r.useMx ? v(r.Msw_x_accept, 2) : '0', unit: 'тм', desc: r.useMx ? 'не более Mbx,ult=' + v(r.Mbx_ult, 2) + ' тм;' : 'Мх отключён;' });
    rows.push({ name: 'Принимаем Msw,y,ult =', val: r.useMy ? v(r.Msw_y_accept, 2) : '0', unit: 'тм', desc: r.useMy ? 'не более Mby,ult=' + v(r.Mby_ult, 2) + ' тм;' : 'Му отключён;' });
    rows.push({ name: 'Mx,ult =', val: r.useMx ? v(r.Mx_ult, 2) : '0', unit: 'тм', desc: r.useMx ? '22.1 Предельный момент относительно оси Х, воспринимаемый сечением (бетон + арматура);' : '22.1 Мx,ult=0, т.к. отключён учёт момента Мх;' });
    rows.push({ name: 'My,ult =', val: r.useMy ? v(r.My_ult, 2) : '0', unit: 'тм', desc: r.useMy ? '22.2 Предельный момент относительно оси У, воспринимаемый сечением (бетон + арматура);' : '22.2 My,ult=0, т.к. отключён учёт момента Му;' });
    rows.push({ name: 'M =', val: v(r.M_accept, 4), unit: '', desc: (r.useMx && r.useMy) ? '23. Отношение Mx/Mx,ult + My/My,ult;' : r.useMx ? '23. Отношение Mx/Mx,ult;' : r.useMy ? '23. Отношение My/My,ult;' : '23. М=0, т.к. отключён учёт моментов Мх и Му;' });
    rows.push({ name: 'Принимаем M =', val: v(r.M_accept, 4), unit: '', desc: 'т.к. М должно быть не более, чем F/(2*Fult)=' + (r.Fult > 0 ? (r.F / (2 * r.Fult)).toFixed(2) : '—') + ';' });
    rows.push({ name: 'Коэф. использования', val: v(r.k, 3), unit: '', desc: '26. Коэффициент использования, воспринимаемый сечением, ф. 8.96 [1].' });
    rows.push({ name: 'Коэф. использования по бетону', val: v(r.kb, 2), unit: '', desc: '27. Коэффициент использования по бетону' });
    return rows;
  }

  global.getCalcParamsRows = getCalcParamsRows;
})(typeof window !== 'undefined' ? window : this);
