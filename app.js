/**
 * Основной скрипт приложения калькулятора продавливания.
 * Инициализация UI, обработка форм, отрисовка эскиза, экспорт DXF.
 */

(function () {
  'use strict';

  function num(id) { return Number(document.getElementById(id).value) || 0; }
  function sel(id) { return document.getElementById(id).value; }

  /** Безопасное вычисление выражения после "=": только числа и + - * / ( ) пробелы, точка и e для степени. */
  function safeEvalFormula(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim();
    if (s.charAt(0) !== '=') return null;
    var expr = s.slice(1).trim();
    if (!expr.length) return null;
    if (!/^[\d\s+\-*/().eE]+$/.test(expr)) return null;
    try {
      var result = Function('"use strict"; return (' + expr + ')')();
      if (typeof result !== 'number' || !isFinite(result)) return null;
      return result;
    } catch (e) {
      return null;
    }
  }

  /** Если в поле введено "=...", вычисляет выражение и подставляет результат; вызывает input и change для обновления формы. */
  function applyFormulaToInput(inp) {
    if (!inp || !inp.value || typeof inp.value !== 'string') return;
    var val = inp.value.trim();
    if (val.charAt(0) !== '=') return;
    var result = safeEvalFormula(inp.value);
    if (result === null) return;
    var rounded = Math.round(result * 1e10) / 1e10;
    inp.value = String(rounded);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Делает числовые поля способными принимать "=" и формулы: type="text" + inputmode="decimal". */
  function allowFormulaInNumberInputs() {
    document.querySelectorAll('input[type=number]').forEach(function (inp) {
      inp.setAttribute('type', 'text');
      inp.setAttribute('inputmode', 'decimal');
    });
  }

  function getHolesRaw() {
    var list = document.getElementById('holeList');
    if (!list) return [];
    var rows = list.querySelectorAll('.hole-row');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var lx = parseFloat(document.getElementById('hole' + i + '_lx').value) || 0;
      var ly = parseFloat(document.getElementById('hole' + i + '_ly').value) || 0;
      var xOffset = parseFloat(document.getElementById('hole' + i + '_x').value);
      var yOffset = parseFloat(document.getElementById('hole' + i + '_y').value);
      if (isNaN(xOffset)) xOffset = 0;
      if (isNaN(yOffset)) yOffset = 0;
      out.push({ lx: lx, ly: ly, xOffset: xOffset, yOffset: yOffset });
    }
    return out;
  }

  /** Координаты центра отверстия = смещение от центра колонны (xOffset, yOffset). */
  function holesFromFacesToCenter(rows, Ax, Ay) {
    return rows.map(function (h) {
      var lx = h.lx || 0, ly = h.ly || 0;
      var x = (h.xOffset != null ? h.xOffset : (h.xFromFace != null ? h.xFromFace : 0));
      var y = (h.yOffset != null ? h.yOffset : (h.yFromFace != null ? h.yFromFace : 0));
      return { lx: lx, ly: ly, x: x, y: y };
    });
  }

  document.querySelectorAll('.sidebar-nav .nav-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var panelId = this.getAttribute('data-panel');
      document.querySelectorAll('.main .panel').forEach(function (p) { p.classList.remove('active'); });
      var panel = document.getElementById('panel-' + panelId);
      if (panel) panel.classList.add('active');
      document.querySelectorAll('.sidebar-nav .nav-link').forEach(function (l) { l.classList.remove('active'); });
      this.classList.add('active');
    });
  });

  document.addEventListener('change', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text'))) applyFormulaToInput(e.target);
  }, true);
  document.addEventListener('blur', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text'))) applyFormulaToInput(e.target);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
      applyFormulaToInput(e.target);
      e.target.blur();
    }
  }, true);
  allowFormulaInNumberInputs();

  function isArmManual() {
    return document.querySelector('.arm-tab.active[data-tab="manual"]') != null;
  }

  function getInputFromForm() {
    var Ax = num('Ax'), Ay = num('Ay');
    var showHole = sel('holeShow') === 'Да';
    var rawHoles = showHole ? getHolesRaw() : [];
    var holes = holesFromFacesToCenter(rawHoles, Ax, Ay);
    var armManual = isArmManual();
    var stepX = armManual ? Math.max(1, num('stepX_manual')) : Math.max(1, num('stepX'));
    var stepY = armManual ? Math.max(1, num('stepY_manual')) : Math.max(1, num('stepY'));
    var out = {
      Ax: Ax, Ay: Ay, h: num('h'), ax: num('ax'), ay: num('ay'),
      beton: sel('beton'), armatura: sel('armatura'), diam: num('diam'), gb1: num('gb1'), mkp: num('mkp'),
      F_sila: num('F'), p: num('p'), Mlocx: num('Mlocx'), Mlocy: num('Mlocy'),
      useMx: sel('useMx') === 'Да', useMy: sel('useMy') === 'Да',
      edgeLeft: document.getElementById('edgeLeft').checked,
      edgeRight: document.getElementById('edgeRight').checked,
      edgeBottom: document.getElementById('edgeBottom').checked,
      edgeTop: document.getElementById('edgeTop').checked,
      x_cx: num('x_cx') || 0,
      x_cy: num('x_cy') || 0,
      multiContour: document.getElementById('multiContour').checked,
      holes: holes,
      stepX: stepX, stepY: stepY,
      armManual: armManual,
      xCountCorrection: parseInt(document.getElementById('xCountCorrection') && document.getElementById('xCountCorrection').value, 10) || 0
    };
    if (armManual) {
      var h0Manual = ((out.h - out.ax) + (out.h - out.ay)) / 2;
      if (h0Manual < 0) h0Manual = 50;
      out.offsetFirstA = num('offsetFirstA_manual');
      out.offsetFirstB = num('offsetFirstB_manual');
      out.offsetLastA = h0Manual * 1.5;
      out.offsetLastB = h0Manual * 1.5;
    } else {
      out.xAlong = (document.querySelector('input[name="xAlong"]:checked') || {}).value || 'a';
    }
    return out;
  }

  function getDiagramParams() {
    var Ax = num('Ax'), Ay = num('Ay');
    var showHole = sel('holeShow') === 'Да';
    var rawHoles = showHole ? getHolesRaw() : [];
    var holes = holesFromFacesToCenter(rawHoles, Ax, Ay);
    var armManual = isArmManual();
    var stepX = armManual ? Math.max(1, num('stepX_manual')) : Math.max(1, num('stepX'));
    var stepY = armManual ? Math.max(1, num('stepY_manual')) : Math.max(1, num('stepY'));
    var params = {
      Ax: Ax, Ay: Ay, h: num('h'), ax: num('ax'), ay: num('ay'),
      stepX: stepX, stepY: stepY,
      holes: holes,
      edgeLeft: document.getElementById('edgeLeft').checked,
      edgeRight: document.getElementById('edgeRight').checked,
      edgeBottom: document.getElementById('edgeBottom').checked,
      edgeTop: document.getElementById('edgeTop').checked,
      x_cx: num('x_cx') || 0,
      x_cy: num('x_cy') || 0,
      armManual: armManual
    };
    if (armManual) {
      var h0Manual = ((params.h - params.ax) + (params.h - params.ay)) / 2;
      if (h0Manual < 0) h0Manual = 50;
      params.offsetFirstA = num('offsetFirstA_manual');
      params.offsetFirstB = num('offsetFirstB_manual');
      params.offsetLastA = h0Manual * 1.5;
      params.offsetLastB = h0Manual * 1.5;
    }
    return params;
  }

  function updateDiagram() {
    updateParamsAndInfo();
    if (typeof updateEdgeBcVisibility === 'function') updateEdgeBcVisibility();
    if (typeof applyHoleConstraints === 'function') applyHoleConstraints();
    var Ax = num('Ax') || 400, Ay = num('Ay') || 500, h = num('h') || 300;
    var ax = num('ax') || 36, ay = num('ay') || 48;
    var h0 = ((h - ax) + (h - ay)) / 2;
    if (h0 < 0) h0 = 50;
    var params = getDiagramParams();
    var holes = params.holes || [];
    var stepX = params.stepX || 60, stepY = params.stepY || 60;
    var diam = num('diam') || 8;
    var edgeLeft = params.edgeLeft, edgeRight = params.edgeRight, edgeBottom = params.edgeBottom, edgeTop = params.edgeTop;
    var optArm = document.getElementById('optArm') ? document.getElementById('optArm').checked : true;
    var optContourCalc = document.getElementById('optContourCalc') ? document.getElementById('optContourCalc').checked : true;
    var optContourFact = document.getElementById('optContourFact') ? document.getElementById('optContourFact').checked : true;
    var optContour15 = document.getElementById('optContour15') ? document.getElementById('optContour15').checked : true;
    var optSlabEdge = document.getElementById('optSlabEdge') ? document.getElementById('optSlabEdge').checked : true;

    var uh_half = h0 / 2;
    var uh_15 = h0 * 1.5;
    var cx_calc = -Ax/2 - uh_half, cy_calc = -Ay/2 - uh_half, cw_calc = Ax + h0, ch_calc = Ay + h0;
    var cx_fact = -Ax/2 - h0, cy_fact = -Ay/2 - h0, cw_fact = Ax + 2*h0, ch_fact = Ay + 2*h0;
    var cx_15 = -Ax/2 - uh_15, cy_15 = -Ay/2 - uh_15, cw_15 = Ax + 2*uh_15, ch_15 = Ay + 2*uh_15;
    var minX = cx_15, maxX = cx_15 + cw_15, minY = cy_15, maxY = cy_15 + ch_15;
    for (var hi = 0; hi < holes.length; hi++) {
      var ho = holes[hi];
      if (ho.lx <= 0 || ho.ly <= 0) continue;
      minX = Math.min(minX, ho.x - ho.lx/2);
      maxX = Math.max(maxX, ho.x + ho.lx/2);
      minY = Math.min(minY, ho.y - ho.ly/2);
      maxY = Math.max(maxY, ho.y + ho.ly/2);
    }
    var pl = (typeof getArmPlacement === 'function') ? getArmPlacement(params) : null;
    if (pl && (pl.xMin != null || pl.points)) {
      minX = Math.min(minX, pl.xMin != null ? pl.xMin : -Ax/2 - 1.5*h0);
      maxX = Math.max(maxX, pl.xMax != null ? pl.xMax : Ax/2 + 1.5*h0);
      minY = Math.min(minY, pl.yMin != null ? pl.yMin : -Ay/2 - 1.5*h0);
      maxY = Math.max(maxY, pl.yMax != null ? pl.yMax : Ay/2 + 1.5*h0);
    }
    var pad = 60;
    var modelW = Math.max(maxX - minX, 200) + 2 * pad;
    var modelH = Math.max(maxY - minY, 200) + 2 * pad;
    var modelSize = Math.max(modelW, modelH);
    var size = 720;
    var scale = size / modelSize;
    var ox = -minX * scale + pad * scale;
    var oy = maxY * scale + pad * scale;
    function mx(x) { return ox + x * scale; }
    function my(y) { return oy - y * scale; }

    var svg = document.getElementById('diagram');
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    var ns = 'http://www.w3.org/2000/svg';

    var axLen = (Math.max(Ax, Ay) / 2 + h0 + 30) * scale;
    var lineX = document.createElementNS(ns, 'line');
    lineX.setAttribute('x1', ox); lineX.setAttribute('y1', oy); lineX.setAttribute('x2', ox + axLen); lineX.setAttribute('y2', oy);
    lineX.setAttribute('stroke', '#cbd5e1'); lineX.setAttribute('stroke-width', 1); lineX.setAttribute('stroke-dasharray', '4,2');
    svg.appendChild(lineX);
    var lineY = document.createElementNS(ns, 'line');
    lineY.setAttribute('x1', ox); lineY.setAttribute('y1', oy); lineY.setAttribute('x2', ox); lineY.setAttribute('y2', oy - axLen);
    lineY.setAttribute('stroke', '#cbd5e1'); lineY.setAttribute('stroke-width', 1); lineY.setAttribute('stroke-dasharray', '4,2');
    svg.appendChild(lineY);
    var txtX = document.createElementNS(ns, 'text');
    txtX.setAttribute('x', ox + axLen + 8); txtX.setAttribute('y', oy + 4); txtX.setAttribute('font-size', 12); txtX.setAttribute('fill', '#64748b');
    txtX.textContent = 'X';
    svg.appendChild(txtX);
    var txtY = document.createElementNS(ns, 'text');
    txtY.setAttribute('x', ox - 24); txtY.setAttribute('y', oy - axLen - 4); txtY.setAttribute('font-size', 12); txtY.setAttribute('fill', '#64748b');
    txtY.textContent = 'Y';
    svg.appendChild(txtY);

    function contourLine(x1, y1, x2, y2, color, dashed) {
      var l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', mx(x1)); l.setAttribute('y1', my(y1)); l.setAttribute('x2', mx(x2)); l.setAttribute('y2', my(y2));
      l.setAttribute('stroke', color || '#94a3b8');
      l.setAttribute('stroke-width', Math.max(2, 2*scale/80));
      if (dashed) l.setAttribute('stroke-dasharray', '6,4');
      svg.appendChild(l);
    }
    function drawContour(cx, cy, cw, ch, color, dashed) {
      if (!edgeLeft) contourLine(cx, cy, cx, cy + ch, color, dashed); else contourLine(cx, cy, cx, cy + ch, '#94a3b8', true);
      if (!edgeRight) contourLine(cx + cw, cy, cx + cw, cy + ch, color, dashed); else contourLine(cx + cw, cy, cx + cw, cy + ch, '#94a3b8', true);
      if (!edgeBottom) contourLine(cx, cy, cx + cw, cy, color, dashed); else contourLine(cx, cy, cx + cw, cy, '#94a3b8', true);
      if (!edgeTop) contourLine(cx, cy + ch, cx + cw, cy + ch, color, dashed); else contourLine(cx, cy + ch, cx + cw, cy + ch, '#94a3b8', true);
    }
    if (optContourCalc) {
      drawContour(cx_calc, cy_calc, cw_calc, ch_calc, 'rgb(255, 0, 0)', false);
      var labelCalc = document.createElementNS(ns, 'text');
      labelCalc.setAttribute('x', mx(cx_calc + cw_calc/2)); labelCalc.setAttribute('y', my(cy_calc - 8));
      labelCalc.setAttribute('text-anchor', 'middle'); labelCalc.setAttribute('font-size', 10);
      labelCalc.setAttribute('fill', 'rgb(255, 0, 0)'); labelCalc.setAttribute('font-weight', '600');
      labelCalc.textContent = 'Расчётный контур (h0/2 = ' + Math.round(uh_half) + ' мм)';
      svg.appendChild(labelCalc);
    }
    if (optContourFact) {
      drawContour(cx_fact, cy_fact, cw_fact, ch_fact, 'rgb(255, 127, 0)', false);
      var labelFact = document.createElementNS(ns, 'text');
      labelFact.setAttribute('x', mx(cx_fact + cw_fact/2)); labelFact.setAttribute('y', my(cy_fact + ch_fact + 18));
      labelFact.setAttribute('text-anchor', 'middle'); labelFact.setAttribute('font-size', 10);
      labelFact.setAttribute('fill', 'rgb(255, 127, 0)'); labelFact.setAttribute('font-weight', '600');
      labelFact.textContent = 'Фактический контур продавливания (h0 = ' + Math.round(h0) + ' мм)';
      svg.appendChild(labelFact);
    }
    if (optContour15) {
      drawContour(cx_15, cy_15, cw_15, ch_15, '#94a3b8', false);
      var label15 = document.createElementNS(ns, 'text');
      label15.setAttribute('x', mx(cx_15 + cw_15/2)); label15.setAttribute('y', my(cy_15 - 8));
      label15.setAttribute('text-anchor', 'middle'); label15.setAttribute('font-size', 10);
      label15.setAttribute('fill', '#64748b'); label15.setAttribute('font-weight', '600');
      label15.textContent = '1,5·h0 = ' + Math.round(uh_15) + ' мм';
      svg.appendChild(label15);
    }

    var hasEdge = edgeLeft || edgeRight || edgeBottom || edgeTop;
    if (optSlabEdge && hasEdge) {
      var x_cx_val = params.x_cx != null ? Number(params.x_cx) : 0;
      var x_cy_val = params.x_cy != null ? Number(params.x_cy) : 0;
      if (isNaN(x_cx_val)) x_cx_val = 0;
      if (isNaN(x_cy_val)) x_cy_val = 0;
      var slabStroke = '#2563eb';
      var slabW = Math.max(2.5, 2.5 * scale / 80);
      var y1Slab = cy_15, y2Slab = cy_15 + ch_15;
      var x1Slab = cx_15, x2Slab = cx_15 + cw_15;
      if (edgeLeft) {
        var slabXLeft = -Ax / 2 - x_cx_val;
        var lL = document.createElementNS(ns, 'line');
        lL.setAttribute('x1', mx(slabXLeft)); lL.setAttribute('y1', my(y1Slab)); lL.setAttribute('x2', mx(slabXLeft)); lL.setAttribute('y2', my(y2Slab));
        lL.setAttribute('stroke', slabStroke); lL.setAttribute('stroke-width', slabW); lL.setAttribute('stroke-dasharray', '8,5');
        svg.appendChild(lL);
      }
      if (edgeRight) {
        var slabXRight = Ax / 2 + x_cx_val;
        var lR = document.createElementNS(ns, 'line');
        lR.setAttribute('x1', mx(slabXRight)); lR.setAttribute('y1', my(y1Slab)); lR.setAttribute('x2', mx(slabXRight)); lR.setAttribute('y2', my(y2Slab));
        lR.setAttribute('stroke', slabStroke); lR.setAttribute('stroke-width', slabW); lR.setAttribute('stroke-dasharray', '8,5');
        svg.appendChild(lR);
      }
      if (edgeBottom) {
        var slabYBottom = -Ay / 2 - x_cy_val;
        var lB = document.createElementNS(ns, 'line');
        lB.setAttribute('x1', mx(x1Slab)); lB.setAttribute('y1', my(slabYBottom)); lB.setAttribute('x2', mx(x2Slab)); lB.setAttribute('y2', my(slabYBottom));
        lB.setAttribute('stroke', slabStroke); lB.setAttribute('stroke-width', slabW); lB.setAttribute('stroke-dasharray', '8,5');
        svg.appendChild(lB);
      }
      if (edgeTop) {
        var slabYTop = Ay / 2 + x_cy_val;
        var lT = document.createElementNS(ns, 'line');
        lT.setAttribute('x1', mx(x1Slab)); lT.setAttribute('y1', my(slabYTop)); lT.setAttribute('x2', mx(x2Slab)); lT.setAttribute('y2', my(slabYTop));
        lT.setAttribute('stroke', slabStroke); lT.setAttribute('stroke-width', slabW); lT.setAttribute('stroke-dasharray', '8,5');
        svg.appendChild(lT);
      }
    }

    var col = document.createElementNS(ns, 'rect');
    col.setAttribute('x', mx(-Ax/2)); col.setAttribute('y', my(Ay/2));
    col.setAttribute('width', Ax * scale); col.setAttribute('height', Ay * scale);
    col.setAttribute('fill', '#ffffff'); col.setAttribute('stroke', '#cbd5e1'); col.setAttribute('stroke-width', 2); col.setAttribute('rx', 2);
    svg.appendChild(col);

    for (var hi = 0; hi < holes.length; hi++) {
      var ho = holes[hi];
      if (ho.lx <= 0 || ho.ly <= 0) continue;
      var hr = document.createElementNS(ns, 'rect');
      hr.setAttribute('x', mx(ho.x - ho.lx/2)); hr.setAttribute('y', my(ho.y + ho.ly/2));
      hr.setAttribute('width', ho.lx * scale); hr.setAttribute('height', ho.ly * scale);
      hr.setAttribute('fill', '#f59e0b'); hr.setAttribute('fill-opacity', '0.85'); hr.setAttribute('stroke', '#d97706');
      svg.appendChild(hr);
    }

    if (optArm && pl && pl.points) {
      var rModel = diam / 2;
      pl.points.forEach(function (p) {
        var circ = document.createElementNS(ns, 'circle');
        circ.setAttribute('cx', mx(p.x)); circ.setAttribute('cy', my(p.y));
        circ.setAttribute('r', Math.max(2, rModel * scale * 0.4));
        circ.setAttribute('fill', '#0d9488'); circ.setAttribute('stroke', '#0f766e');
        svg.appendChild(circ);
      });
      var offsetFirstA = pl.poperechka && pl.poperechka.offsetFirstA !== undefined ? pl.poperechka.offsetFirstA : 0;
      var offsetFirstB = pl.poperechka && pl.poperechka.offsetFirstB !== undefined ? pl.poperechka.offsetFirstB : 0;
      var firstBarX = Ax/2 + offsetFirstA;
      var firstBarY = Ay/2 + offsetFirstB;
      var lineFirstA = document.createElementNS(ns, 'line');
      lineFirstA.setAttribute('x1', mx(Ax/2)); lineFirstA.setAttribute('y1', my(firstBarY));
      lineFirstA.setAttribute('x2', mx(firstBarX)); lineFirstA.setAttribute('y2', my(firstBarY));
      lineFirstA.setAttribute('stroke', '#0d9488'); lineFirstA.setAttribute('stroke-width', 2);
      lineFirstA.setAttribute('stroke-dasharray', '4,3');
      svg.appendChild(lineFirstA);
      var lineFirstB = document.createElementNS(ns, 'line');
      lineFirstB.setAttribute('x1', mx(firstBarX)); lineFirstB.setAttribute('y1', my(Ay/2));
      lineFirstB.setAttribute('x2', mx(firstBarX)); lineFirstB.setAttribute('y2', my(firstBarY));
      lineFirstB.setAttribute('stroke', '#0d9488'); lineFirstB.setAttribute('stroke-width', 2);
      lineFirstB.setAttribute('stroke-dasharray', '4,3');
      svg.appendChild(lineFirstB);
      var labelA = document.createElementNS(ns, 'text');
      labelA.setAttribute('x', mx((Ax/2 + firstBarX) / 2)); labelA.setAttribute('y', my(firstBarY) - 6);
      labelA.setAttribute('text-anchor', 'middle'); labelA.setAttribute('font-size', 10);
      labelA.setAttribute('fill', '#0d9488'); labelA.setAttribute('font-weight', '600');
      labelA.textContent = Math.round(offsetFirstA);
      svg.appendChild(labelA);
      var labelB = document.createElementNS(ns, 'text');
      labelB.setAttribute('x', mx(firstBarX) + 12); labelB.setAttribute('y', my((Ay/2 + firstBarY) / 2));
      labelB.setAttribute('dominant-baseline', 'middle'); labelB.setAttribute('font-size', 10);
      labelB.setAttribute('fill', '#0d9488'); labelB.setAttribute('font-weight', '600');
      labelB.textContent = Math.round(offsetFirstB);
      svg.appendChild(labelB);
      var capEl = document.getElementById('firstBarDistanceCaption');
      if (capEl) capEl.textContent = 'Отступ до 1-го стержня вдоль a: ' + Math.round(offsetFirstA) + ', вдоль b: ' + Math.round(offsetFirstB);
    } else {
      var capEl = document.getElementById('firstBarDistanceCaption');
      if (capEl) capEl.textContent = '';
    }

    var t1 = document.createElementNS(ns, 'text');
    t1.setAttribute('x', mx(0)); t1.setAttribute('y', my(-Ay/2 - 14)); t1.setAttribute('text-anchor', 'middle');
    t1.setAttribute('font-size', 10); t1.setAttribute('fill', '#475569'); t1.textContent = 'Ax ' + Ax;
    svg.appendChild(t1);
    var t2 = document.createElementNS(ns, 'text');
    t2.setAttribute('x', mx(-Ax/2 - 14)); t2.setAttribute('y', my(0)); t2.setAttribute('dominant-baseline', 'middle');
    t2.setAttribute('font-size', 10); t2.setAttribute('fill', '#475569'); t2.textContent = 'Ay ' + Ay;
    svg.appendChild(t2);

    if (typeof updateStepChecks === 'function') updateStepChecks();
  }

  function updateStepChecks() {
    var el = document.getElementById('stepChecks');
    if (!el) return;
    var h = num('h') || 180, ax = num('ax') || 40, ay = num('ay') || 50;
    var h0 = ((h - ax) + (h - ay)) / 2;
    if (h0 < 0) h0 = 50;
    var a = num('Ax') || 200, b = num('Ay') || 200;
    var manual = isArmManual();
    var stepA = manual ? Math.max(1, num('stepX_manual') || 60) : Math.max(1, num('stepX') || 60);
    var stepB = manual ? Math.max(1, num('stepY_manual') || 60) : Math.max(1, num('stepY') || 60);
    var c;
    if (manual) {
      var offsetFirstA = num('offsetFirstA_manual') || 0, offsetFirstB = num('offsetFirstB_manual') || 0;
      var h0_3 = h0 / 3, h0_23 = h0 * 2 / 3, h0_15 = h0 * 1.5;
      var offsetLastA = h0_15, offsetLastB = h0_15;
      var maxStepA = (a + h0) / 4, maxStepB = (b + h0) / 4;
      var tol = 2;
      // Сетка: nSteps = floor((size + 2*offset) / step), центральный шаг = остаток
      var totalSpanA = a + 2 * offsetFirstA, totalSpanB = b + 2 * offsetFirstB;
      var nStepsA = stepA > 0 ? Math.floor(totalSpanA / stepA) : 0;
      var nStepsB = stepB > 0 ? Math.floor(totalSpanB / stepB) : 0;
      var nStepsLastA = stepA > 0 ? Math.floor((2 * offsetLastA + a) / stepA) : 0;
      var nStepsLastB = stepB > 0 ? Math.floor((2 * offsetLastB + b) / stepB) : 0;
      c = {
        h0: h0, h0_3: h0_3, h0_23: h0_23, h0_15: h0_15,
        maxStepA_limit: maxStepA, maxStepB_limit: maxStepB,
        stepA_ok: stepA <= h0_3 && stepA <= maxStepA, stepB_ok: stepB <= h0_3 && stepB <= maxStepB,
        offsetFirstA: offsetFirstA, offsetFirstB: offsetFirstB, offsetLastA: offsetLastA, offsetLastB: offsetLastB,
        firstA_ok: offsetFirstA >= h0_3 - tol && offsetFirstA <= h0_23 + tol,
        firstB_ok: offsetFirstB >= h0_3 - tol && offsetFirstB <= h0_23 + tol,
        lastA_ok: offsetLastA >= h0_15 - tol, lastB_ok: offsetLastB >= h0_15 - tol,
        nStepsA: nStepsA, nStepsB: nStepsB, nStepsLastA: nStepsLastA, nStepsLastB: nStepsLastB
      };
    } else {
      c = (typeof poperechkaStepBlock === 'function') ? poperechkaStepBlock(h0, a, b, stepA, stepB) : {
        stepA_ok: true, stepB_ok: true, stepMaxA: 0, stepMaxB: 0,
        offsetFirstA: 0, offsetFirstB: 0, offsetLastA: 0, offsetLastB: 0,
        firstA_ok: true, firstB_ok: true, lastA_ok: true, lastB_ok: true,
        h0_3: h0/3, h0_23: h0*2/3, h0_15: h0*1.5, maxStepA_limit: (a+h0)/4, maxStepB_limit: (b+h0)/4,
        nStepsA: 0, nStepsB: 0, nStepsLastA: 0, nStepsLastB: 0
      };
    }
    var lines = [
      'h0 = ' + Math.round(c.h0 || h0) + ' мм  |  h0/3 = ' + Math.round(c.h0_3 || h0/3) + ' мм  |  h0×2/3 = ' + Math.round(c.h0_23 || h0*2/3) + ' мм  |  зона 1,5·h0 = ' + Math.round(c.h0_15 || h0*1.5) + ' мм',
      'Шаг вдоль a (X): ' + (c.stepA_ok ? '✓' : '✗') + ' (max h0/3 = ' + Math.round(c.h0_3 || h0/3) + ' мм, max (a+h0)/4 = ' + Math.round(c.maxStepA_limit || (a+h0)/4) + ' мм)',
      'Шаг вдоль b (Y): ' + (c.stepB_ok ? '✓' : '✗') + ' (max h0/3 = ' + Math.round(c.h0_3 || h0/3) + ' мм, max (b+h0)/4 = ' + Math.round(c.maxStepB_limit || (b+h0)/4) + ' мм)',
      'Отступ до 1-го стержня вдоль a: ' + Math.round(c.offsetFirstA || 0) + ' мм (n = ' + (c.nStepsA != null ? c.nStepsA : '-') + ') — ' + (c.firstA_ok ? '✓' : '✗') + ' (должен быть h0/3…h0×2/3)',
      'Отступ до 1-го стержня вдоль b: ' + Math.round(c.offsetFirstB || 0) + ' мм (n = ' + (c.nStepsB != null ? c.nStepsB : '-') + ') — ' + (c.firstB_ok ? '✓' : '✗') + ' (должен быть h0/3…h0×2/3)',
      'Граница расстановки вдоль a: ' + Math.round(c.offsetLastA || 0) + ' мм (1,5·h0, n = ' + (c.nStepsLastA != null ? c.nStepsLastA : '-') + ')',
      'Граница расстановки вдоль b: ' + Math.round(c.offsetLastB || 0) + ' мм (1,5·h0, n = ' + (c.nStepsLastB != null ? c.nStepsLastB : '-') + ')'
    ];
    if (manual && c.X_manual != null) {
      lines.unshift('Х, шт = ' + c.X_manual + ' (рассчитано по отступу и шагу вдоль a)');
    }
    el.innerHTML = lines.map(function (line) { return '<p class="' + (line.indexOf('✗') !== -1 ? 'check-err' : 'check-ok') + '">' + line + '</p>'; }).join('');
  }

  /** Заполняет панель информации и предупреждений (6 проверок из calc-info-messages.js). */
  function fillCalcInfoPanel(result) {
    var panel = document.getElementById('calcInfoPanel');
    var listEl = document.getElementById('calcInfoList');
    var empty = panel ? panel.querySelector('.calc-info-empty') : null;
    if (!panel || !listEl || !empty) return;
    if (result.error) {
      listEl.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Ошибка: ' + result.error;
      return;
    }
    var messages = typeof getCalcInfoMessages === 'function' ? getCalcInfoMessages(result) : [];
    if (messages.length === 0) {
      listEl.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Нет сообщений.';
      return;
    }
    empty.style.display = 'none';
    listEl.style.display = 'flex';
    listEl.innerHTML = messages.map(function (m) {
      return '<div class="calc-info-msg ' + (m.type || 'ok') + '">' + m.text + '</div>';
    }).join('');
  }

  /**
   * Проверка условия для деления блока «Расчётные параметры» на две части (Колонна у края).
   * Условие: включена хотя бы одна галочка Слева/Справа/Снизу/Сверху и
   * — при одной галочке Слева/Справа: (x_cx − Ax/2) > h0/2;
   * — при одной галочке Сверху/Снизу: (x_cy − Ay/2) > h0/2;
   * — при двух галочках (по разным осям): оба неравенства.
   */
  function shouldSplitCalcParams(input, h0) {
    if (!input || h0 == null || h0 <= 0) return false;
    var edgeLeft = !!input.edgeLeft;
    var edgeRight = !!input.edgeRight;
    var edgeBottom = !!input.edgeBottom;
    var edgeTop = !!input.edgeTop;
    var hasEdge = edgeLeft || edgeRight || edgeBottom || edgeTop;
    if (!hasEdge) return false;
    var Ax = Number(input.Ax) || 0;
    var Ay = Number(input.Ay) || 0;
    var x_cx = input.x_cx != null ? Number(input.x_cx) : 0;
    var x_cy = input.x_cy != null ? Number(input.x_cy) : 0;
    var h0_2 = h0 / 2;
    var hasX = edgeLeft || edgeRight;
    var hasY = edgeBottom || edgeTop;
    var condX = (x_cx - Ax / 2) > h0_2;
    var condY = (x_cy - Ay / 2) > h0_2;
    return (!hasX || condX) && (!hasY || condY);
  }

  /** Заполняет панель расчётных параметров (порядок из calc-params-rows.js). */
  function fillCalcParamsPanel(result, input) {
    var panel = document.getElementById('calcParamsPanel');
    var table = document.getElementById('calcParamsTable');
    var empty = panel ? panel.querySelector('.calc-params-empty') : null;
    var splitEl = document.getElementById('calcParamsSplit');
    if (!panel || !table || !empty) return;
    if (result.error) {
      if (splitEl) splitEl.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Ошибка: ' + result.error;
      return;
    }
    var rows = typeof getCalcParamsRows === 'function' ? getCalcParamsRows(result) : [];
    if (rows.length === 0) {
      if (splitEl) splitEl.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Нажмите «Рассчитать» — здесь появятся значения Rbt, h0, Ub, Fb,ult и др.';
      return;
    }
    empty.style.display = 'none';
    if (splitEl) {
      splitEl.style.display = '';
      var isKolonna = document.getElementById('calcTabKolonna') && document.getElementById('calcTabKolonna').classList.contains('active');
      var showSplit = isKolonna && shouldSplitCalcParams(input, result.h0);
      splitEl.classList.toggle('single', !showSplit);
    }
    var html = rows.map(function (r) {
      var v = r.val + (r.unit ? ' ' + r.unit : '');
      return '<tr><td>' + r.name + '</td><td>' + v + '</td><td>' + r.desc + '</td></tr>';
    }).join('');
    table.innerHTML = html;
  }

  /** Показывает в блоке «Отверстия» подпись «Отверстие не учитывается» для отверстий с расстоянием от колонны > 6·h0; объединяет с подсказкой по ограничению (центр не внутри колонны). */
  function updateHoleStatus(holeIncluded) {
    document.querySelectorAll('.hole-status[data-hole-index]').forEach(function (p) {
      var i = parseInt(p.getAttribute('data-hole-index'), 10);
      var constraintHint = typeof getHoleConstraintHint === 'function' ? getHoleConstraintHint(i) : '';
      var notIncluded = holeIncluded && Array.isArray(holeIncluded) && i >= 0 && i < holeIncluded.length && holeIncluded[i] === false;
      var parts = [];
      if (constraintHint) parts.push(constraintHint);
      if (notIncluded) parts.push('Отверстие не учитывается');
      p.textContent = parts.join(' ');
      p.style.color = constraintHint ? '#b91c1c' : (notIncluded ? '#b45309' : '');
    });
  }

  /** Обновляет панели параметров и информации (вызывается при загрузке и при изменении входных данных). */
  function updateParamsAndInfo() {
    var input = getInputFromForm();
    var result = runCalc(input);
    fillCalcParamsPanel(result, input);
    fillCalcInfoPanel(result);
    updateHoleStatus(result.holeIncluded);
    if (window.calcRsnTable) {
      window.lastCalcParamsForRsn = window.calcRsnTable.getParamsFromCalc(result);
      window.calcRsnTable.updateKbCells(window.lastCalcParamsForRsn);
    }
  }

  /** Форматирует число с заданным числом знаков после запятой (для отчёта). */
  function fmt(v, dec) {
    if (v == null || typeof v !== 'number' || !isFinite(v)) return '—';
    return v.toFixed(dec);
  }

  /** Строит краткий отчёт в 2 колонки из результата расчёта (колонна). Возвращает { html, text }. */
  function buildShortReport(result) {
    var r = result;
    var h0 = r.h0 != null ? r.h0 : 0;
    var Ub = r.Ub != null ? r.Ub : 0;
    var Fb_ult = r.Fb_ult != null ? r.Fb_ult : 0;
    var F = r.F != null ? r.F : 0;
    var Fsw_ult = r.Fsw_accept != null ? r.Fsw_accept : (r.Fsw_ult != null ? r.Fsw_ult : 0);
    var Mbx_ult = r.Mbx_ult != null ? r.Mbx_ult : 0;
    var Mby_ult = r.Mby_ult != null ? r.Mby_ult : 0;
    var Msw_x_ult = r.Msw_x_ult != null ? r.Msw_x_ult : 0;
    var Msw_y_ult = r.Msw_y_ult != null ? r.Msw_y_ult : 0;
    var Mb_ult = (Mbx_ult > 0 && Mby_ult > 0) ? Math.min(Mbx_ult, Mby_ult) : (Mbx_ult || Mby_ult);
    var Fb_dop = 0.67 * Fb_ult;
    var Fsw_dop = 1.5 * Fsw_ult;
    var Mb_ult_067 = 0.67 * Mb_ult;
    var Mb_ult_15 = 1.5 * Mb_ult;
    var perMmFb = Ub > 0 ? (0.67 * Fb_ult / Ub) : 0;
    var perMmFsw = Ub > 0 ? (1.5 * Fsw_ult / Ub) : 0;
    var kb = r.kb != null ? r.kb : (Fb_ult > 0 ? F / Fb_ult : 0);
    var k_sw = r.k != null ? r.k : 0;

    var left = [
      'Исходные усилия по наиудшему РСН',
      'p = ' + fmt(r.p, 2) + ' т/м²',
      'N  = ' + fmt(r.F_sila != null ? r.F_sila : r.F + (r.Fp || 0), 2) + ' т',
      'Mx = ' + fmt(r.Mx, 3) + ' т·м',
      'My = ' + fmt(r.My, 3) + ' т·м',
      '',
      'Характеристики контура',
      'h0 = ' + fmt(h0, 1) + ' мм',
      '6*h0 = ' + fmt(6 * h0, 1) + ' мм',
      'h0/2 = ' + fmt(h0 / 2, 1) + ' мм',
      'Ub = ' + fmt(Ub, 0) + ' мм',
      '',
      'Несущая способность без армирования',
      'Fb,ult = ' + fmt(Fb_ult, 2) + ' т',
      '2*Fb,ult = ' + fmt(2 * Fb_ult, 2) + ' т',
      'Mbx,ult = ' + fmt(Mbx_ult, 2) + ' т·м',
      'Mby,ult = ' + fmt(Mby_ult, 2) + ' т·м',
      '',
      'Несущая способность с армированием',
      'Fsw,ult = ' + fmt(Fsw_ult, 2) + ' т',
      'Msw,x,ult = ' + fmt(Msw_x_ult, 2) + ' т·м',
      'Msw,y,ult = ' + fmt(Msw_y_ult, 2) + ' т·м',
      '',
      'Коэффициент использования',
      'k_b = ' + fmt(kb, 3),
      'k_sw = ' + fmt(k_sw, 3)
    ].join('\n');

    var right = [
      'Бетон: ' + (r.beton || '—'),
      'Арматура: ' + (r.armatura || '—'),
      'h = ' + fmt(r.h, 0) + ' мм',
      'h0 = ' + fmt(h0, 1) + ' мм',
      'h0/2 = ' + fmt(h0 / 2, 1) + ' мм',
      'Fb,ult = ' + fmt(Fb_ult, 2) + ' т',
      'Fb,доп = 0,67*Fb,ult = ' + fmt(Fb_dop, 2) + ' т',
      '0,67*Mb,ult = ' + fmt(Mb_ult_067, 2) + ' т·м',
      'Fsw,доп = 1,5*Fsw,ult = ' + fmt(Fsw_dop, 2) + ' т',
      '1,5*Mb,ult = ' + fmt(Mb_ult_15, 2) + ' т·м',
      '2*Fb,ult = ' + fmt(2 * Fb_ult, 2) + ' т',
      'lu_факт = ' + fmt(Ub, 0),
      'F факт = ' + fmt(F, 2),
      'k_b = ' + fmt(kb, 3),
      'k_sw = ' + fmt(k_sw, 3),
      '0,67*Fb,ult (1мм шва) = ' + fmt(perMmFb, 4) + ' т',
      '1,5*Fsw,ult (1мм шва) = ' + fmt(perMmFsw, 4) + ' т'
    ].join('\n');

    var html = '<div class="result-col result-col-left">' + left.replace(/\n/g, '<br>') + '</div><div class="result-col result-col-right">' + right.replace(/\n/g, '<br>') + '</div>';
    var text = 'Левая колонка:\n' + left + '\n\nПравая колонка:\n' + right;
    return { html: html, text: text };
  }

  function runCalculation() {
    var input = getInputFromForm();
    var result = runCalc(input);
    var el = document.getElementById('result');
    if (result.error) {
      el.innerHTML = '';
      el.appendChild(document.createTextNode('Ошибка: ' + result.error));
      el.className = 'err';
      el.removeAttribute('data-report-text');
    } else {
      var report = buildShortReport(result);
      el.innerHTML = report.html;
      el.setAttribute('data-report-text', report.text);
      el.className = (result.ok ? 'ok' : 'err') + ' result-two-cols';
    }
    updateHoleStatus(result.holeIncluded);
    updateDiagram();
  }

  /** По умолчанию отверстий нет. */
  var holesData = [];

  /** Возвращает текст подсказки по ограничению для отверстия i (центр не внутри колонны: |X| >= Ax/2 + |lx|/2, |Y| >= Ay/2 + |ly|), или пустую строку. */
  function getHoleConstraintHint(i) {
    var Ax = num('Ax') || 0, Ay = num('Ay') || 0;
    var inpLx = document.getElementById('hole' + i + '_lx');
    var inpLy = document.getElementById('hole' + i + '_ly');
    var inpX = document.getElementById('hole' + i + '_x');
    var inpY = document.getElementById('hole' + i + '_y');
    if (!inpX || !inpY) return '';
    var lx = (inpLx && inpLx.value !== '') ? parseFloat(inpLx.value, 10) : 0;
    var ly = (inpLy && inpLy.value !== '') ? parseFloat(inpLy.value, 10) : 0;
    if (isNaN(lx)) lx = 0;
    if (isNaN(ly)) ly = 0;
    var x = parseFloat(inpX.value, 10);
    var y = parseFloat(inpY.value, 10);
    if (isNaN(x)) x = 0;
    if (isNaN(y)) y = 0;
    var minX = Ax / 2 + Math.abs(lx) / 2;
    var minY = Ay / 2 + Math.abs(ly);
    var badX = minX > 0 && Math.abs(x) < minX;
    var badY = minY > 0 && Math.abs(y) < minY;
    if (!badX && !badY) return '';
    var parts = [];
    if (badX) parts.push('|X| ≥ Ax/2 + |lx|/2 = ' + Math.round(minX) + ' мм');
    if (badY) parts.push('|Y| ≥ Ay/2 + |ly| = ' + Math.round(minY) + ' мм');
    return 'Рекомендуется: ' + parts.join(', ') + ' (центр отверстия не внутри колонны)';
  }

  /** Обновляет подсказки под блоками отверстий (только подсветка, ввод не блокируется). */
  function applyHoleConstraints() {
    for (var i = 0; i < holesData.length; i++) {
      var statusEl = document.querySelector('.hole-status[data-hole-index="' + i + '"]');
      if (!statusEl) continue;
      var hint = getHoleConstraintHint(i);
      if (hint) {
        statusEl.textContent = hint;
        statusEl.style.color = '#b91c1c';
      } else {
        statusEl.textContent = '';
        statusEl.style.color = '';
      }
    }
  }

  function renderHoles() {
    var list = document.getElementById('holeList');
    if (!list) return;
    list.innerHTML = '';
    for (var i = 0; i < holesData.length; i++) {
      var d = holesData[i];
      var xVal = d.xOffset !== undefined ? d.xOffset : (d.x !== undefined ? d.x : '');
      var yVal = d.yOffset !== undefined ? d.yOffset : (d.y !== undefined ? d.y : '');
      var row = document.createElement('div');
      row.className = 'hole-row';
      row.innerHTML =
        '<label class="hole-cap">Отверстие ' + (i + 1) + '</label>' +
        '<input type="number" id="hole' + i + '_lx" value="' + (d.lx || '') + '" min="0" placeholder="Длина по X, мм">' +
        '<input type="number" id="hole' + i + '_ly" value="' + (d.ly || '') + '" min="0" placeholder="Длина по Y, мм">' +
        '<input type="number" id="hole' + i + '_x" value="' + xVal + '" step="any" placeholder="X от центра (±)">' +
        '<input type="number" id="hole' + i + '_y" value="' + yVal + '" step="any" placeholder="Y от центра (±)">' +
        '<button type="button" class="btn-remove" data-index="' + i + '">Удалить</button>' +
        '<p class="hole-status" data-hole-index="' + i + '" style="grid-column: 1 / -1; font-size: 0.8rem; color: #64748b; margin: 4px 0 0 0;"></p>';
      list.appendChild(row);
    }
    list.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-index'), 10);
        holesData.splice(i, 1);
        renderHoles();
        updateDiagram();
      });
    });
    list.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', updateDiagram);
      inp.addEventListener('change', function () { applyHoleConstraints(); updateDiagram(); });
    });
    allowFormulaInNumberInputs();
  }
  document.getElementById('addHoleBtn').addEventListener('click', function () {
    holesData.push({ lx: 0, ly: 0, xOffset: 0, yOffset: 0 });
    renderHoles();
    applyHoleConstraints();
    updateDiagram();
  });
  document.getElementById('holeShow').addEventListener('change', function () {
    document.getElementById('holeList').style.display = this.value === 'Да' ? '' : 'none';
    document.getElementById('addHoleBtn').style.display = this.value === 'Да' ? '' : 'none';
    updateDiagram();
  });
  renderHoles();
  document.getElementById('holeList').style.display = document.getElementById('holeShow').value === 'Да' ? '' : 'none';
  document.getElementById('addHoleBtn').style.display = document.getElementById('holeShow').value === 'Да' ? '' : 'none';

  document.querySelectorAll('.arm-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.arm-tab').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      var tab = this.getAttribute('data-tab');
      document.getElementById('armTabAuto').style.display = tab === 'auto' ? '' : 'none';
      document.getElementById('armTabManual').style.display = tab === 'manual' ? '' : 'none';
      updateDiagram();
    });
  });

  ['Ax', 'Ay', 'h', 'ax', 'ay', 'stepX', 'stepY', 'stepX_manual', 'stepY_manual', 'offsetFirstA_manual', 'offsetFirstB_manual', 'diam', 'xCountCorrection', 'optArm', 'optContourCalc', 'optContourFact', 'optContour15', 'optSlabEdge'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', updateDiagram); el.addEventListener('change', updateDiagram); }
  });
  ['edgeLeft', 'edgeRight', 'edgeBottom', 'edgeTop', 'x_cx', 'x_cy', 'multiContour'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', updateDiagram); el.addEventListener('change', updateDiagram); }
  });

  function updateEdgeBcVisibility() {
    var edgeLeft = document.getElementById('edgeLeft').checked;
    var edgeRight = document.getElementById('edgeRight').checked;
    var edgeBottom = document.getElementById('edgeBottom').checked;
    var edgeTop = document.getElementById('edgeTop').checked;
    var showXcx = edgeLeft || edgeRight;
    var showXcy = edgeBottom || edgeTop;
    var row = document.getElementById('x_cx_cy_Row');
    var x_cxWrap = document.getElementById('x_cxWrap');
    var x_cyWrap = document.getElementById('x_cyWrap');
    var x_cxInput = document.getElementById('x_cx');
    var x_cyInput = document.getElementById('x_cy');
    var x_cxHint = document.getElementById('x_cx_hint');
    var x_cyHint = document.getElementById('x_cy_hint');
    var Ax = num('Ax') || 0, Ay = num('Ay') || 0;
    var halfAx = Ax / 2, halfAy = Ay / 2;
    if (row) row.style.display = (showXcx || showXcy) ? '' : 'none';
    if (x_cxWrap) {
      x_cxWrap.style.display = showXcx ? '' : 'none';
      if (x_cxInput) {
        x_cxInput.disabled = !showXcx;
        x_cxInput.setAttribute('min', 0);
      }
      if (x_cxHint) {
        if (!showXcx) {
          x_cxHint.textContent = '';
          x_cxHint.style.color = '';
        } else {
          var vx = parseFloat(x_cxInput && x_cxInput.value, 10);
          if (isNaN(vx)) vx = 0;
          if (Ax > 0 && vx < halfAx) {
            x_cxHint.textContent = 'Рекомендуется x_cx ≥ Ax/2 = ' + Math.round(halfAx) + ' мм (граница плиты не внутри колонны)';
            x_cxHint.style.color = '#b91c1c';
          } else {
            x_cxHint.textContent = '';
            x_cxHint.style.color = '';
          }
        }
      }
    }
    if (x_cyWrap) {
      x_cyWrap.style.display = showXcy ? '' : 'none';
      if (x_cyInput) {
        x_cyInput.disabled = !showXcy;
        x_cyInput.setAttribute('min', 0);
      }
      if (x_cyHint) {
        if (!showXcy) {
          x_cyHint.textContent = '';
          x_cyHint.style.color = '';
        } else {
          var vy = parseFloat(x_cyInput && x_cyInput.value, 10);
          if (isNaN(vy)) vy = 0;
          if (Ay > 0 && vy < halfAy) {
            x_cyHint.textContent = 'Рекомендуется x_cy ≥ Ay/2 = ' + Math.round(halfAy) + ' мм (граница плиты не внутри колонны)';
            x_cyHint.style.color = '#b91c1c';
          } else {
            x_cyHint.textContent = '';
            x_cyHint.style.color = '';
          }
        }
      }
    }
  }
  ['edgeLeft', 'edgeRight', 'edgeBottom', 'edgeTop'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', updateEdgeBcVisibility);
  });
  // Блоки «Колонна у края плиты» и «Отверстия» в реальном времени реагируют на Ax, Ay из блока «Колонна»
  ['Ax', 'Ay'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', function () { updateEdgeBcVisibility(); applyHoleConstraints(); });
      el.addEventListener('change', function () { updateEdgeBcVisibility(); applyHoleConstraints(); });
    }
  });
  updateEdgeBcVisibility();
  applyHoleConstraints();

  function updateColumnTypeLabel() {
    var lab = document.getElementById('columnTypeLabel');
    if (!lab) return;
    var AxVal = parseFloat(document.getElementById('Ax').value, 10) || 0;
    var AyVal = parseFloat(document.getElementById('Ay').value, 10) || 0;
    var a = Math.min(AxVal, AyVal);
    var b = Math.max(AxVal, AyVal);
    if (a <= 0) {
      lab.textContent = '—';
      return;
    }
    var ratio = b / a;
    if (ratio <= 2.5) lab.textContent = 'Колонна';
    else if (ratio <= 4) lab.textContent = 'Пилон';
    else lab.textContent = 'Стена';
  }
  ['Ax', 'Ay'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', updateColumnTypeLabel); el.addEventListener('change', updateColumnTypeLabel); }
  });
  updateColumnTypeLabel();

  document.querySelectorAll('.calc-sub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.getAttribute('data-calc-tab');
      document.querySelectorAll('.calc-sub-tab').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.calc-sub-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var panel = document.getElementById('calcTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
      if (panel) panel.classList.add('active');
      if (tab === 'kruglaya') updateCircParamsAndInfo();
      if (tab === 'stena') updateWallParamsAndInfo();
    });
  });

  document.getElementById('holeList').addEventListener('input', updateDiagram);
  document.getElementById('holeList').addEventListener('change', updateDiagram);
  var xAlongEl = document.getElementById('xAlongGroup');
  if (xAlongEl) xAlongEl.addEventListener('change', updateDiagram);

  document.getElementById('btnCalc').addEventListener('click', runCalculation);

  if (window.calcRsnTable && window.calcRsnTable.initRsnTable) {
    window.calcRsnTable.initRsnTable();
  }

  document.getElementById('btnReportTxt').addEventListener('click', function () {
    var el = document.getElementById('result');
    var text = el.getAttribute('data-report-text') || el.textContent || '';
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'otchet_prodavlivanie.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function numCirc(id) { return Number(document.getElementById(id) && document.getElementById(id).value) || 0; }
  function selCirc(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function getCircInput() {
    var useMx = selCirc('circ_useMx') === 'Да';
    var useMy = selCirc('circ_useMy') === 'Да';
    return {
      D: numCirc('circ_D'),
      h: numCirc('circ_h'),
      ax: numCirc('circ_ax'),
      ay: numCirc('circ_ay'),
      d: parseInt(selCirc('circ_d') || '10', 10) || 10,
      beton: selCirc('circ_beton') || 'B25',
      armatura: selCirc('circ_armatura') || 'А240',
      gb1: numCirc('circ_gb1') || 1,
      mkp: numCirc('circ_mkp') || 1,
      F_sila: numCirc('circ_F'),
      p: numCirc('circ_p'),
      Mx: useMx ? numCirc('circ_Mx') : 0,
      My: useMy ? numCirc('circ_My') : 0,
      nsw: parseInt(numCirc('circ_nsw'), 10) || 0,
      ssw: numCirc('circ_ssw') || 75
    };
  }
  function fillCircInfoPanel(result) {
    var panel = document.getElementById('circInfoPanel');
    var listEl = document.getElementById('circInfoList');
    var empty = panel ? panel.querySelector('.calc-info-empty') : null;
    if (!panel || !listEl || !empty) return;
    if (result.error) {
      listEl.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Ошибка: ' + result.error;
      return;
    }
    var messages = typeof getCalcInfoMessagesCircular === 'function' ? getCalcInfoMessagesCircular(result) : [];
    if (messages.length === 0) {
      listEl.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Нет сообщений.';
      return;
    }
    empty.style.display = 'none';
    listEl.style.display = 'flex';
    listEl.innerHTML = messages.map(function (m) {
      return '<div class="calc-info-msg ' + (m.type || 'ok') + '">' + m.text + '</div>';
    }).join('');
  }

  function fillCircParamsPanel(result) {
    var panel = document.getElementById('circParamsPanel');
    var table = document.getElementById('circParamsTable');
    var empty = panel && panel.querySelector('.calc-params-empty');
    if (!panel || !table || !empty) return;
    if (result.error) {
      table.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Ошибка: ' + result.error;
      return;
    }
    var v = function (x, d) { return (x != null && x !== '') ? Number(x).toFixed(d) : '—'; };
    var rows = [
      { name: 'Rbt =', val: v(result.Rbt, 2), unit: 'МПа', desc: 'Расчётное сопротивление бетона растяжению' },
      { name: 'Rsw =', val: v(result.Rsw, 0), unit: 'МПа', desc: 'Расчётное сопротивление поперечной арматуры' },
      { name: 'h0 =', val: v(result.h0, 1), unit: 'мм', desc: 'Рабочая высота сечения 0.5·(h0x + h0y)' },
      { name: 'u =', val: v(result.Ub, 2), unit: 'мм', desc: 'Периметр расчётного контура π·(D + h0)' },
      { name: 'A =', val: v(result.A_m2, 4), unit: 'м²', desc: 'Площадь расчётного контура u·h0' },
      { name: 'Fp =', val: v(result.Fp, 2), unit: 'кН', desc: 'Отпор в зоне' },
      { name: 'F =', val: v(result.F, 2), unit: 'кН', desc: 'Усилие продавливания N − Fp' },
      { name: 'Fb,ult =', val: v(result.Fb_ult, 2), unit: 'кН', desc: 'Предельное усилие контура по бетону' },
      { name: 'Wb =', val: v(result.Wb_m2, 3), unit: 'м²', desc: 'Момент сопротивления контура π·(D+h0)²/4' },
      { name: 'Mb,ult =', val: v(result.Mb_ult, 3), unit: 'кН·м', desc: 'Несущая способность контура по моменту' },
      { name: 'M =', val: v(result.M, 3), unit: 'кН·м', desc: '√(Mx² + My²)' },
      { name: 'k(F) =', val: v(result.k_F, 3), unit: '', desc: 'F / Fb,ult' },
      { name: 'k(M) =', val: v(result.k_M, 3), unit: '', desc: 'M / Mb,ult' }
    ];
    if (result.nsw > 0 && result.ssw > 0) {
      rows.push({ name: 'Asw =', val: v(result.Asw_cm2, 3), unit: 'см²', desc: 'Площадь сечения одного стержня π·d²/4' });
      rows.push({ name: 'qsw =', val: v(result.qsw, 3), unit: 'кН/м', desc: 'Несущая способность арматуры на 1 ед. контура' });
      rows.push({ name: 'Fsw,ult =', val: v(result.Fsw_ult, 3), unit: 'кН', desc: 'Несущая способность контура по арматуре' });
      rows.push({ name: 'Msw,ult =', val: v(result.Msw_ult, 3), unit: 'кН·м', desc: 'Несущая способность по арматуре для момента' });
      rows.push({ name: 'Mult =', val: v(result.Mult, 3), unit: 'кН·м', desc: 'Предельный момент (бетон + арматура)' });
    }
    rows.push({ name: 'Fult =', val: v(result.Fult, 2), unit: 'кН', desc: 'Предельное усилие (с учётом арматуры)' });
    rows.push({ name: 'k (итог) =', val: v(result.k_comb, 3), unit: '', desc: 'Условие прочности с ограничением вклада момента' });
    empty.style.display = 'none';
    table.style.display = '';
    table.innerHTML = rows.map(function (r) {
      var val = r.val + (r.unit ? ' ' + r.unit : '');
      return '<tr><td>' + r.name + '</td><td>' + val + '</td><td>' + (r.desc || '') + '</td></tr>';
    }).join('');
  }
  function updateCircParamsAndInfo() {
    if (typeof runCalcCircular !== 'function') return;
    var input = getCircInput();
    var result = runCalcCircular(input);
    fillCircParamsPanel(result);
    fillCircInfoPanel(result);
    if (document.getElementById('circ_diagram')) updateCircDiagram();
  }

  function updateCircDiagram() {
    var svg = document.getElementById('circ_diagram');
    if (!svg) return;
    var D = numCirc('circ_D') || 400;
    var h = numCirc('circ_h') || 200;
    var ax = numCirc('circ_ax') || 30;
    var ay = numCirc('circ_ay') || 30;
    var d = parseInt(selCirc('circ_d') || '10', 10) || 10;
    var h0x = h - ax - 0.5 * d;
    var h0y = h - ay - 1.5 * d;
    var h0 = 0.5 * (h0x + h0y);
    if (h0 < 0) h0 = 50;
    var rCol = D / 2;
    var rContour = rCol + h0;
    var r15 = rCol + 1.5 * h0;
    var size = 720;
    var pad = 60;
    var modelR = Math.max(r15, 80);
    var scale = (size - 2 * pad) / (2 * modelR);
    var cx = size / 2;
    var cy = size / 2;
    function mx(x) { return cx + x * scale; }
    function my(y) { return cy - y * scale; }
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    var ns = 'http://www.w3.org/2000/svg';
    var circle = function (r, stroke, fill, dash) {
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', cx);
      c.setAttribute('cy', cy);
      c.setAttribute('r', r * scale);
      c.setAttribute('fill', fill || 'none');
      c.setAttribute('stroke', stroke);
      c.setAttribute('stroke-width', Math.max(2, 2 * scale / 60));
      if (dash) c.setAttribute('stroke-dasharray', '6,4');
      svg.appendChild(c);
    };
    circle(r15, '#94a3b8', 'none', true);
    circle(rContour, 'rgb(255, 127, 0)');
    circle(rCol, '#cbd5e1', '#fff');
    var lineX = document.createElementNS(ns, 'line');
    lineX.setAttribute('x1', cx); lineX.setAttribute('y1', cy);
    lineX.setAttribute('x2', mx(ax + 30)); lineX.setAttribute('y2', cy);
    lineX.setAttribute('stroke', '#94a3b8'); lineX.setAttribute('stroke-width', 1); lineX.setAttribute('stroke-dasharray', '4,2');
    svg.appendChild(lineX);
    var txtX = document.createElementNS(ns, 'text');
    txtX.setAttribute('x', mx(ax + 40)); txtX.setAttribute('y', cy + 4); txtX.setAttribute('font-size', 12); txtX.setAttribute('fill', '#64748b');
    txtX.textContent = 'X';
    svg.appendChild(txtX);
    var txtY = document.createElementNS(ns, 'text');
    txtY.setAttribute('x', cx - 20); txtY.setAttribute('y', my(ax + 40)); txtY.setAttribute('font-size', 12); txtY.setAttribute('fill', '#64748b');
    txtY.textContent = 'Y';
    svg.appendChild(txtY);
  }

  function runCalculationCircular() {
    if (typeof runCalcCircular !== 'function') return;
    var input = getCircInput();
    var result = runCalcCircular(input);
    var el = document.getElementById('circ_result');
    if (el) {
      if (result.error) {
        el.textContent = 'Ошибка: ' + result.error;
        el.className = 'err';
      } else {
        el.textContent = result.reportText;
        el.className = result.ok ? 'ok' : 'err';
      }
    }
    updateCircParamsAndInfo();
  }
  var circBtn = document.getElementById('circ_btnCalc');
  if (circBtn) circBtn.addEventListener('click', runCalculationCircular);
  var circReportBtn = document.getElementById('circ_btnReportTxt');
  if (circReportBtn) {
    circReportBtn.addEventListener('click', function () {
      var pre = document.getElementById('circ_result');
      var text = pre ? pre.textContent : '';
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'otchet_prodavlivanie_kruglaya.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
  function exportCircDXF() {
    var D = numCirc('circ_D') || 400;
    var h = numCirc('circ_h') || 200;
    var ax = numCirc('circ_ax') || 30;
    var ay = numCirc('circ_ay') || 30;
    var d = parseInt(selCirc('circ_d') || '10', 10) || 10;
    var h0x = h - ax - 0.5 * d;
    var h0y = h - ay - 1.5 * d;
    var h0 = 0.5 * (h0x + h0y);
    if (h0 < 0) h0 = 50;
    var rCol = D / 2;
    var rContour = rCol + h0;
    var layer = '0';
    function dxfCircle(cxc, cyc, r) {
      return '0\nCIRCLE\n8\n' + layer + '\n10\n' + Number(cxc).toFixed(4) + '\n20\n' + Number(cyc).toFixed(4) + '\n30\n0\n40\n' + Number(r).toFixed(4) + '\n';
    }
    var circles = [
      dxfCircle(0, 0, rCol),
      dxfCircle(0, 0, rContour)
    ];
    var extR = rContour + 20;
    var dxf = '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$INSUNITS\n70\n4\n';
    dxf += '9\n$ACADVER\n1\nAC1009\n';
    dxf += '9\n$EXTMIN\n10\n' + Number(-extR).toFixed(4) + '\n20\n' + Number(-extR).toFixed(4) + '\n30\n0\n';
    dxf += '9\n$EXTMAX\n10\n' + Number(extR).toFixed(4) + '\n20\n' + Number(extR).toFixed(4) + '\n30\n0\n';
    dxf += '0\nENDSEC\n';
    dxf += '0\nSECTION\n2\nENTITIES\n';
    circles.forEach(function (s) { dxf += s; });
    dxf += '0\nENDSEC\n0\nEOF\n';
    var blob = new Blob([dxf], { type: 'application/dxf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scheme_punching_circular.dxf';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  var circDxfBtn = document.getElementById('circ_btnDxf');
  if (circDxfBtn) circDxfBtn.addEventListener('click', exportCircDXF);

  ['circ_D', 'circ_h', 'circ_ax', 'circ_ay', 'circ_beton', 'circ_d', 'circ_armatura', 'circ_gb1', 'circ_mkp', 'circ_ssw', 'circ_nsw', 'circ_F', 'circ_p', 'circ_Mx', 'circ_My', 'circ_useMx', 'circ_useMy'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateCircParamsAndInfo);
      el.addEventListener('change', updateCircParamsAndInfo);
    }
  });

  function numWall(id) { return Number(document.getElementById(id) && document.getElementById(id).value) || 0; }
  function selWall(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function getWallInput() {
    var type = selWall('wall_type') || 'torec_mid';
    var useMy = selWall('wall_useMy') === 'Да';
    return {
      type: type,
      t1: numWall('wall_t1'),
      c: numWall('wall_c'),
      a1: numWall('wall_a1'),
      a2: numWall('wall_a2'),
      h: numWall('wall_h'),
      ax: numWall('wall_ax'),
      ay: numWall('wall_ay'),
      d: parseInt(selWall('wall_d') || '10', 10) || 10,
      beton: selWall('wall_beton') || 'B30',
      armatura: selWall('wall_armatura') || 'А500',
      gb1: numWall('wall_gb1') || 1,
      mkp: numWall('wall_mkp') || 1,
      F_sila: numWall('wall_F'),
      p: numWall('wall_p'),
      My: useMy ? numWall('wall_My') : 0,
      useMy: useMy,
      nsw: parseInt(numWall('wall_nsw'), 10) || 0,
      ssw: numWall('wall_ssw') || 60
    };
  }
  function updateWallTypeVisibility() {
    var type = selWall('wall_type') || 'torec_mid';
    var cardTorec = document.getElementById('wallCardTorec');
    var cardUgol = document.getElementById('wallCardUgol');
    var cRow = document.getElementById('wall_c_row');
    var myRow = document.getElementById('wall_My_row');
    if (cardTorec) cardTorec.style.display = type === 'ugol' ? 'none' : '';
    if (cardUgol) cardUgol.style.display = type === 'ugol' ? '' : 'none';
    if (cRow) cRow.style.display = type === 'torec_edge' ? '' : 'none';
    if (myRow) myRow.style.display = type === 'ugol' ? 'none' : '';
  }
  function fillWallInfoPanel(result) {
    var panel = document.getElementById('wallInfoPanel');
    var listEl = document.getElementById('wallInfoList');
    var empty = panel ? panel.querySelector('.calc-info-empty') : null;
    if (!panel || !listEl || !empty) return;
    if (result.error) {
      listEl.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Ошибка: ' + result.error;
      return;
    }
    var messages = typeof getCalcInfoMessagesWall === 'function' ? getCalcInfoMessagesWall(result) : [];
    if (messages.length === 0) {
      listEl.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Нет сообщений.';
      return;
    }
    empty.style.display = 'none';
    listEl.style.display = 'flex';
    listEl.innerHTML = messages.map(function (m) {
      return '<div class="calc-info-msg ' + (m.type || 'ok') + '">' + m.text + '</div>';
    }).join('');
  }
  function fillWallParamsPanel(result) {
    var panel = document.getElementById('wallParamsPanel');
    var table = document.getElementById('wallParamsTable');
    var empty = panel && panel.querySelector('.calc-params-empty');
    if (!panel || !table || !empty) return;
    if (result.error) {
      table.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Ошибка: ' + result.error;
      return;
    }
    var v = function (x, d) { return (x != null && x !== '') ? Number(x).toFixed(d) : '—'; };
    var rows = [
      { name: 'Rbt =', val: v(result.Rbt, 2), unit: 'МПа', desc: 'Расчётное сопротивление бетона растяжению' },
      { name: 'Rsw =', val: v(result.Rsw, 0), unit: 'МПа', desc: 'Расчётное сопротивление поперечной арматуры' },
      { name: 'h0x =', val: v(result.h0x, 1), unit: 'мм', desc: 'Рабочая высота до ц.т. армирования по X' },
      { name: 'h0y =', val: v(result.h0y, 1), unit: 'мм', desc: 'Рабочая высота до ц.т. армирования по Y' },
      { name: 'h0 =', val: v(result.h0, 1), unit: 'мм', desc: 'Рабочая высота 0.5·(h0x + h0y)' }
    ];
    if (result.type === 'torec_mid') {
      rows.push({ name: 'Lx =', val: v(result.Lx, 0), unit: 'мм', desc: 'Длина участка контура в направлении X' });
      rows.push({ name: 'Ly =', val: v(result.Ly, 0), unit: 'мм', desc: 'Длина участка контура в направлении Y (t1 + h0)' });
    } else if (result.type === 'torec_edge') {
      rows.push({ name: 'Lx =', val: v(result.Lx, 0), unit: 'мм', desc: 'Длина участка контура (t1 + 0.5·h0 + c)' });
    } else {
      rows.push({ name: 'a1 =', val: v(result.a1, 0), unit: 'мм', desc: 'Толщина стены в направлении X' });
      rows.push({ name: 'a2 =', val: v(result.a2, 0), unit: 'мм', desc: 'Толщина стены в направлении Y' });
      rows.push({ name: 'Lx =', val: v(result.Lx, 2), unit: 'мм', desc: 'a1 + 0.5·h0' });
      rows.push({ name: 'Ly =', val: v(result.Ly, 2), unit: 'мм', desc: 'a2 + 0.5·h0' });
      rows.push({ name: 'U_diag =', val: v(result.U_diag, 2), unit: 'мм', desc: 'Диагональный участок контура √((a1−0.5·h0)²+(a2−0.5·h0)²)' });
    }
    rows.push({ name: 'u =', val: v(result.Ub, 2), unit: 'мм', desc: 'Периметр расчётного контура' });
    rows.push({ name: 'A =', val: v(result.A_m2, 4), unit: 'м²', desc: 'Площадь расчётного контура u·h0' });
    rows.push({ name: 'Fp =', val: v(result.Fp, 2), unit: 'кН', desc: 'Отпор в зоне' });
    rows.push({ name: 'F =', val: v(result.F, 2), unit: 'кН', desc: 'Усилие продавливания N − Fp' });
    rows.push({ name: 'Fb,ult =', val: v(result.Fb_ult, 2), unit: 'кН', desc: 'Предельное усилие контура по бетону' });
    if (result.type !== 'ugol') {
      if (result.Ib_y_cm4 != null && result.Ib_y_cm4 > 0) {
        rows.push({ name: 'Ib.y =', val: v(result.Ib_y_cm4, 2), unit: 'см⁴', desc: 'Момент инерции контура в направлении Y' });
      }
      rows.push({ name: 'Wb.y =', val: v(result.Wb_y_m2, 4), unit: 'м²', desc: 'Момент сопротивления контура в направлении Y' });
      rows.push({ name: 'Mb.y,ult =', val: v(result.Mb_y_ult, 3), unit: 'кН·м', desc: 'Несущая способность контура по My' });
      rows.push({ name: 'My =', val: v(result.My, 3), unit: 'кН·м', desc: 'Изгибающий момент в направлении Y' });
      var kMy = result.Mb_y_ult > 0 ? result.My / result.Mb_y_ult : 0;
      rows.push({ name: 'My / Mb.y,ult =', val: v(kMy, 3), unit: '', desc: 'Коэфф. использования по My' });
    }
    if (result.nsw > 0) {
      rows.push({ name: 'Asw =', val: v(result.Asw_cm2, 3), unit: 'см²', desc: 'Площадь сечения одного стержня' });
      rows.push({ name: 'ssw =', val: v(result.ssw, 0), unit: 'мм', desc: 'Шаг стержней' });
      rows.push({ name: 'nsw =', val: v(result.nsw, 0), unit: 'шт', desc: 'Кол-во стержней в контуре' });
      rows.push({ name: 'qsw =', val: v(result.qsw, 3), unit: 'кН/м', desc: 'Несущая способность арматуры на 1 ед. контура' });
      rows.push({ name: 'Fsw,ult =', val: v(result.Fsw_ult, 3), unit: 'кН', desc: 'Несущая способность контура по арматуре' });
      if (result.type !== 'ugol') {
        rows.push({ name: 'Msw.y,ult =', val: v(result.Msw_y_ult, 3), unit: 'кН·м', desc: 'Несущая способность по арматуре для My' });
        rows.push({ name: 'My,ult =', val: v(result.My_ult, 3), unit: 'кН·м', desc: 'Предельный момент (бетон + арматура)' });
      }
    }
    rows.push({ name: 'Fult =', val: v(result.Fult, 2), unit: 'кН', desc: 'Предельное усилие с учётом арматуры' });
    rows.push({ name: 'k = F/Fult =', val: v(result.k, 3), unit: '', desc: 'Коэфф. использования' });
    rows.push({ name: 'k (итог) =', val: v(result.k_comb, 3), unit: '', desc: 'Итоговый коэфф. с ограничением вклада момента' });
    empty.style.display = 'none';
    table.style.display = '';
    table.innerHTML = rows.map(function (r) {
      return '<tr><td>' + r.name + '</td><td>' + r.val + (r.unit ? ' ' + r.unit : '') + '</td><td>' + (r.desc || '') + '</td></tr>';
    }).join('');
  }
  function updateWallDiagram() {
    var svg = document.getElementById('wall_diagram');
    if (!svg) return;
    var type = selWall('wall_type') || 'torec_mid';
    var t1 = numWall('wall_t1') || 300;
    var c = numWall('wall_c') || 300;
    var a1 = numWall('wall_a1') || 200;
    var a2 = numWall('wall_a2') || 200;
    var h = numWall('wall_h') || 200;
    var ax = numWall('wall_ax') || 30;
    var d = parseInt(selWall('wall_d') || '10', 10) || 10;
    var h0x = h - ax - 0.5 * d;
    var h0y = h - numWall('wall_ay') - 1.5 * d;
    var h0 = 0.5 * (h0x + h0y);
    if (h0 < 0) h0 = 50;
    var size = 720;
    var pad = 60;
    var ns = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    function line(x1, y1, x2, y2, stroke) {
      var l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('stroke', stroke || '#334155'); l.setAttribute('stroke-width', 2);
      svg.appendChild(l);
    }
    var Lx, Ly, scale, ox, oy;
    if (type === 'ugol') {
      var halfH0 = 0.5 * h0;
      var u = 2 * (a1 + a2 + halfH0) + Math.sqrt(Math.pow(a1 - halfH0, 2) + Math.pow(a2 - halfH0, 2));
      var modelSize = Math.max(a1 + a2 + h0, 200);
      scale = (size - 2 * pad) / modelSize;
      ox = pad + (a1 + h0 * 0.5) * scale;
      oy = size - pad - (a2 + h0 * 0.5) * scale;
      var rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', ox - a1 * scale);
      rect.setAttribute('y', oy);
      rect.setAttribute('width', a1 * scale);
      rect.setAttribute('height', a2 * scale);
      rect.setAttribute('fill', '#e2e8f0');
      rect.setAttribute('stroke', '#94a3b8');
      svg.appendChild(rect);
      var px = ox + halfH0 * scale;
      var py = oy - halfH0 * scale;
      line(ox, oy, px, oy, 'rgb(255, 127, 0)');
      line(ox, oy, ox, py, 'rgb(255, 127, 0)');
      var diag = Math.sqrt(Math.pow(a1 - halfH0, 2) + Math.pow(a2 - halfH0, 2));
      var dx = (a1 - halfH0) / diag * diag * scale;
      var dy = -(a2 - halfH0) / diag * diag * scale;
      line(ox, oy, ox + dx, oy + dy, 'rgb(255, 127, 0)');
    } else {
      if (type === 'torec_edge') {
        Lx = t1 + 0.5 * h0 + c;
        Ly = 0;
      } else {
        Ly = t1 + h0;
        Lx = Ly;
      }
      var modelW = (type === 'torec_edge') ? Lx * 2 : Lx + h0;
      var modelH = Ly + h0 || Lx + h0;
      scale = (size - 2 * pad) / Math.max(modelW, modelH, 300);
      ox = pad + h0 * 0.5 * scale;
      oy = size - pad - (Ly || Lx) * scale - h0 * 0.5 * scale;
      var w = (type === 'torec_edge') ? t1 * scale : Lx * scale;
      var wallH = (Ly || Lx) * scale;
      var wallRect = document.createElementNS(ns, 'rect');
      wallRect.setAttribute('x', ox);
      wallRect.setAttribute('y', oy);
      wallRect.setAttribute('width', w);
      wallRect.setAttribute('height', wallH);
      wallRect.setAttribute('fill', '#e2e8f0');
      wallRect.setAttribute('stroke', '#94a3b8');
      svg.appendChild(wallRect);
      var cx = ox + w;
      var cy = oy + wallH / 2;
      line(cx, cy, cx + h0 * scale, cy, 'rgb(255, 127, 0)');
      line(cx, cy - wallH / 2, cx, cy + wallH / 2, 'rgb(255, 127, 0)');
      if (type === 'torec_mid') {
        line(cx + h0 * scale, cy - wallH / 2, cx + h0 * scale, cy + wallH / 2, 'rgb(255, 127, 0)');
      }
    }
  }
  function updateWallParamsAndInfo() {
    if (typeof runCalcWall !== 'function') return;
    var input = getWallInput();
    var result = runCalcWall(input);
    fillWallParamsPanel(result);
    fillWallInfoPanel(result);
    if (document.getElementById('wall_diagram')) updateWallDiagram();
  }
  function runCalculationWall() {
    if (typeof runCalcWall !== 'function') return;
    var input = getWallInput();
    var result = runCalcWall(input);
    var el = document.getElementById('wall_result');
    if (el) {
      if (result.error) {
        el.textContent = 'Ошибка: ' + result.error;
        el.className = 'err';
      } else {
        el.textContent = result.reportText;
        el.className = result.ok ? 'ok' : 'err';
      }
    }
    updateWallParamsAndInfo();
  }
  var wallTypeEl = document.getElementById('wall_type');
  if (wallTypeEl) {
    wallTypeEl.addEventListener('change', function () {
      updateWallTypeVisibility();
      updateWallParamsAndInfo();
    });
  }
  updateWallTypeVisibility();
  var wallBtn = document.getElementById('wall_btnCalc');
  if (wallBtn) wallBtn.addEventListener('click', runCalculationWall);
  var wallReportBtn = document.getElementById('wall_btnReportTxt');
  if (wallReportBtn) {
    wallReportBtn.addEventListener('click', function () {
      var pre = document.getElementById('wall_result');
      var text = pre ? pre.textContent : '';
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'otchet_prodavlivanie_stena.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
  function exportWallDXF() {
    var type = selWall('wall_type') || 'torec_mid';
    var t1 = numWall('wall_t1') || 300;
    var c = numWall('wall_c') || 300;
    var a1 = numWall('wall_a1') || 200;
    var a2 = numWall('wall_a2') || 200;
    var h = numWall('wall_h') || 200;
    var ax = numWall('wall_ax') || 30;
    var d = parseInt(selWall('wall_d') || '10', 10) || 10;
    var h0 = 0.5 * (h - ax - 0.5 * d + h - numWall('wall_ay') - 1.5 * d);
    if (h0 < 0) h0 = 50;
    var layer = '0';
    function dxfLine(x1, y1, x2, y2) {
      return '0\nLINE\n8\n' + layer + '\n10\n' + Number(x1).toFixed(4) + '\n20\n' + Number(y1).toFixed(4) + '\n30\n0\n11\n' + Number(x2).toFixed(4) + '\n21\n' + Number(y2).toFixed(4) + '\n31\n0\n';
    }
    var lines = [];
    if (type === 'ugol') {
      var halfH0 = 0.5 * h0;
      lines.push(dxfLine(0, 0, a1 + halfH0, 0));
      lines.push(dxfLine(0, 0, 0, -(a2 + halfH0)));
      var diag = Math.sqrt(Math.pow(a1 - halfH0, 2) + Math.pow(a2 - halfH0, 2));
      lines.push(dxfLine(0, 0, (a1 - halfH0), -(a2 - halfH0)));
    } else {
      var Lx = type === 'torec_edge' ? t1 + 0.5 * h0 + c : t1 + h0;
      var Ly = type === 'torec_edge' ? 0 : t1 + h0;
      var x0 = 0, y0 = 0;
      lines.push(dxfLine(x0, y0, x0 + Lx, y0));
      lines.push(dxfLine(x0 + Lx, y0, x0 + Lx, y0 + (Ly || Lx)));
      if (type === 'torec_mid') lines.push(dxfLine(x0 + Lx, y0 + (Ly || Lx), x0, y0 + (Ly || Lx)));
    }
    var xMin = -20, xMax = 500, yMin = -500, yMax = 20;
    var dxf = '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n9\n$ACADVER\n1\nAC1009\n';
    dxf += '9\n$EXTMIN\n10\n' + xMin + '\n20\n' + yMin + '\n30\n0\n';
    dxf += '9\n$EXTMAX\n10\n' + xMax + '\n20\n' + yMax + '\n30\n0\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
    lines.forEach(function (s) { dxf += s; });
    dxf += '0\nENDSEC\n0\nEOF\n';
    var blob = new Blob([dxf], { type: 'application/dxf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scheme_punching_wall.dxf';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  var wallDxfBtn = document.getElementById('wall_btnDxf');
  if (wallDxfBtn) wallDxfBtn.addEventListener('click', exportWallDXF);
  ['wall_t1', 'wall_c', 'wall_a1', 'wall_a2', 'wall_h', 'wall_ax', 'wall_ay', 'wall_beton', 'wall_d', 'wall_armatura', 'wall_gb1', 'wall_mkp', 'wall_ssw', 'wall_nsw', 'wall_F', 'wall_p', 'wall_My', 'wall_useMy'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateWallParamsAndInfo);
      el.addEventListener('change', updateWallParamsAndInfo);
    }
  });

  /** Слои DXF: только ASCII-имена для совместимости с AutoCAD R12 (ANSI). */
  var DXF_LAYERS = [
    { name: '0', color: 7 },
    { name: 'Kolonna', color: 1 },
    { name: 'Armatura', color: 3 },
    { name: 'Otverstie', color: 2 },
    { name: 'Kray_plity', color: 5 },
    { name: 'Raschetny_kontur', color: 6 },
    { name: '1_5_h0', color: 7 },
    { name: 'Fakt_kontur', color: 30 },
    { name: 'Text', color: 7 }
  ];

  /** Возвращает содержимое DXF (текст). Используется для скачивания и для отладки. */
  function buildDxfString() {
    var Ax = num('Ax') || 200, Ay = num('Ay') || 200, h = num('h') || 180;
    var ax = num('ax') || 40, ay = num('ay') || 50;
    var h0 = ((h - ax) + (h - ay)) / 2;
    if (h0 < 0) h0 = 50;
    var params = getDiagramParams();
    var holes = params.holes || [];
    var diam = num('diam') || 8;
    var edgeLeft = params.edgeLeft, edgeRight = params.edgeRight, edgeBottom = params.edgeBottom, edgeTop = params.edgeTop;
    var x_cx = (params.x_cx != null && !isNaN(params.x_cx)) ? Number(params.x_cx) : 0;
    var x_cy = (params.x_cy != null && !isNaN(params.x_cy)) ? Number(params.x_cy) : 0;
    var uh_half = h0 / 2, uh_15 = h0 * 1.5;
    var cx_calc = -Ax/2 - uh_half, cy_calc = -Ay/2 - uh_half, cw_calc = Ax + h0, ch_calc = Ay + h0;
    var cx_fact = -Ax/2 - h0, cy_fact = -Ay/2 - h0, cw_fact = Ax + 2*h0, ch_fact = Ay + 2*h0;
    var cx_15 = -Ax/2 - uh_15, cy_15 = -Ay/2 - uh_15, cw_15 = Ax + 2*uh_15, ch_15 = Ay + 2*uh_15;

    function dxfLine(x1, y1, x2, y2, layer) {
      return '0\nLINE\n8\n' + layer + '\n10\n' + Number(x1).toFixed(4) + '\n20\n' + Number(y1).toFixed(4) + '\n30\n0\n11\n' + Number(x2).toFixed(4) + '\n21\n' + Number(y2).toFixed(4) + '\n31\n0\n';
    }
    function dxfCircle(cxc, cyc, r, layer) {
      return '0\nCIRCLE\n8\n' + layer + '\n10\n' + Number(cxc).toFixed(4) + '\n20\n' + Number(cyc).toFixed(4) + '\n30\n0\n40\n' + Number(r).toFixed(4) + '\n';
    }
    function contourLines(cx, cy, cw, ch, layer) {
      var out = [];
      if (!edgeLeft) out.push(dxfLine(cx, cy, cx, cy + ch, layer));
      if (!edgeRight) out.push(dxfLine(cx + cw, cy, cx + cw, cy + ch, layer));
      if (!edgeBottom) out.push(dxfLine(cx, cy, cx + cw, cy, layer));
      if (!edgeTop) out.push(dxfLine(cx, cy + ch, cx + cw, cy + ch, layer));
      if (edgeLeft) out.push(dxfLine(cx, cy, cx, cy + ch, layer));
      if (edgeRight) out.push(dxfLine(cx + cw, cy, cx + cw, cy + ch, layer));
      if (edgeBottom) out.push(dxfLine(cx, cy, cx + cw, cy, layer));
      if (edgeTop) out.push(dxfLine(cx, cy + ch, cx + cw, cy + ch, layer));
      return out;
    }

    var entities = [];
    var layerKolonna = 'Kolonna', layerArmatura = 'Armatura', layerOtverstie = 'Otverstie', layerKray = 'Kray_plity';
    var layerRaschet = 'Raschetny_kontur', layer15 = '1_5_h0', layerFakt = 'Fakt_kontur';

    [[-Ax/2, -Ay/2, Ax/2, -Ay/2], [Ax/2, -Ay/2, Ax/2, Ay/2], [Ax/2, Ay/2, -Ax/2, Ay/2], [-Ax/2, Ay/2, -Ax/2, -Ay/2]].forEach(function (l) {
      entities.push(dxfLine(l[0], l[1], l[2], l[3], layerKolonna));
    });
    contourLines(cx_fact, cy_fact, cw_fact, ch_fact, layerFakt).forEach(function (s) { entities.push(s); });
    contourLines(cx_calc, cy_calc, cw_calc, ch_calc, layerRaschet).forEach(function (s) { entities.push(s); });
    contourLines(cx_15, cy_15, cw_15, ch_15, layer15).forEach(function (s) { entities.push(s); });

    if (edgeLeft || edgeRight || edgeBottom || edgeTop) {
      var x1S = cx_15, x2S = cx_15 + cw_15, y1S = cy_15, y2S = cy_15 + ch_15;
      if (edgeLeft) entities.push(dxfLine(-Ax/2 - x_cx, y1S, -Ax/2 - x_cx, y2S, layerKray));
      if (edgeRight) entities.push(dxfLine(Ax/2 + x_cx, y1S, Ax/2 + x_cx, y2S, layerKray));
      if (edgeBottom) entities.push(dxfLine(x1S, -Ay/2 - x_cy, x2S, -Ay/2 - x_cy, layerKray));
      if (edgeTop) entities.push(dxfLine(x1S, Ay/2 + x_cy, x2S, Ay/2 + x_cy, layerKray));
    }

    for (var hi = 0; hi < holes.length; hi++) {
      var ho = holes[hi];
      if (ho.lx <= 0 || ho.ly <= 0) continue;
      var hx = ho.x - ho.lx/2, hy = ho.y - ho.ly/2;
      entities.push(dxfLine(hx, hy, hx + ho.lx, hy, layerOtverstie));
      entities.push(dxfLine(hx + ho.lx, hy, hx + ho.lx, hy + ho.ly, layerOtverstie));
      entities.push(dxfLine(hx + ho.lx, hy + ho.ly, hx, hy + ho.ly, layerOtverstie));
      entities.push(dxfLine(hx, hy + ho.ly, hx, hy, layerOtverstie));
    }

    var getArm = (typeof window !== 'undefined' && window.getArmPlacement) ? window.getArmPlacement : (typeof getArmPlacement === 'function' ? getArmPlacement : null);
    if (getArm) {
      try {
        var pl = getArm(params);
        var rArm = Math.max(0.5, diam / 2);
        if (pl.points && pl.points.length) {
          pl.points.forEach(function (p) {
            entities.push(dxfCircle(p.x, p.y, rArm, layerArmatura));
          });
        }
      } catch (e) { }
    }

    var textX = Ax/2 + uh_15 + 80;
    var textY = 0;
    var textLines = [];
    try {
      var input = getInputFromForm();
      var result = runCalc(input);
      if (!result.error && typeof buildShortReport === 'function') {
        var report = buildShortReport(result);
        var parts = (report.text || '').split('\n\nПравая колонка:\n');
        var leftT = (parts[0] || '').replace(/^Левая колонка:\n/, '');
        var rightT = (parts[1] || '');
        textLines = leftT.split('\n').filter(Boolean).concat(['']).concat((rightT || '').split('\n').filter(Boolean));
      }
    } catch (e) { }
    if (textLines.length === 0) textLines = ['Результаты расчёта (выполните расчёт)'];
    var lineH = 25;
    for (var ti = 0; ti < textLines.length; ti++) {
      var txt = (textLines[ti] || '').substring(0, 255);
      var ty = textY - ti * lineH * 1.2;
      entities.push('0\nTEXT\n8\nText\n10\n' + Number(textX).toFixed(4) + '\n20\n' + Number(ty).toFixed(4) + '\n30\n0\n40\n' + lineH + '\n1\n' + txt + '\n');
    }

    var xMin = Math.min(cx_15, -Ax/2), xMax = Math.max(cx_15 + cw_15, Ax/2, textX + 400), yMin = Math.min(cy_15, -Ay/2), yMax = Math.max(cy_15 + ch_15, Ay/2, textY + 100);
    var dxf = '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1009\n';
    dxf += '9\n$DWGCODEPAGE\n3\nANSI_1251\n';
    dxf += '9\n$INSUNITS\n70\n4\n';
    dxf += '9\n$EXTMIN\n10\n' + Number(xMin).toFixed(4) + '\n20\n' + Number(yMin).toFixed(4) + '\n30\n0\n';
    dxf += '9\n$EXTMAX\n10\n' + Number(xMax).toFixed(4) + '\n20\n' + Number(yMax).toFixed(4) + '\n30\n0\n';
    dxf += '0\nENDSEC\n';

    dxf += '0\nSECTION\n2\nTABLES\n';
    dxf += '0\nTABLE\n2\nLTYPE\n70\n1\n';
    dxf += '0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';
    dxf += '0\nENDTAB\n';
    dxf += '0\nTABLE\n2\nLAYER\n70\n' + DXF_LAYERS.length + '\n';
    DXF_LAYERS.forEach(function (lyr) {
      dxf += '0\nLAYER\n2\n' + lyr.name + '\n70\n0\n62\n' + lyr.color + '\n6\nCONTINUOUS\n';
    });
    dxf += '0\nENDTAB\n';
    dxf += '0\nTABLE\n2\nSTYLE\n70\n1\n';
    dxf += '0\nSTYLE\n2\nSTANDARD\n70\n0\n40\n0\n41\n1\n50\n0\n71\n0\n42\n2.5\n3\ntxt\n4\n\n0\nENDTAB\n';
    dxf += '0\nENDSEC\n';

    dxf += '0\nSECTION\n2\nENTITIES\n';
    entities.forEach(function (s) { dxf += s; });
    dxf += '0\nENDSEC\n0\nEOF\n';
    return dxf;
  }

  /** Таблица Unicode -> Windows-1251 (байты 0x80–0xFF по WHATWG). */
  var WIN1251 = [
    0x0402, 0x0403, 0x201A, 0x0453, 0x201E, 0x2026, 0x2020, 0x2021, 0x20AC, 0x2030, 0x0409, 0x2039, 0x040A, 0x040C, 0x040B, 0x040F,
    0x0452, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x0098, 0x2122, 0x0459, 0x203A, 0x045A, 0x045C, 0x045B, 0x045F,
    0x00A0, 0x040E, 0x045E, 0x0408, 0x00A4, 0x0490, 0x00A6, 0x00A7, 0x0401, 0x00A9, 0x0404, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x0407,
    0x00B0, 0x00B1, 0x0406, 0x0456, 0x0491, 0x00B5, 0x00B6, 0x00B7, 0x0451, 0x2116, 0x0454, 0x00BB, 0x0458, 0x0405, 0x0455, 0x0457,
    0x0410, 0x0411, 0x0412, 0x0413, 0x0414, 0x0415, 0x0416, 0x0417, 0x0418, 0x0419, 0x041A, 0x041B, 0x041C, 0x041D, 0x041E, 0x041F,
    0x0420, 0x0421, 0x0422, 0x0423, 0x0424, 0x0425, 0x0426, 0x0427, 0x0428, 0x0429, 0x042A, 0x042B, 0x042C, 0x042D, 0x042E, 0x042F,
    0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0437, 0x0438, 0x0439, 0x043A, 0x043B, 0x043C, 0x043D, 0x043E, 0x043F,
    0x0440, 0x0441, 0x0442, 0x0443, 0x0444, 0x0445, 0x0446, 0x0447, 0x0448, 0x0449, 0x044A, 0x044B, 0x044C, 0x044D, 0x044E, 0x044F
  ];
  /** Замена символов, которых нет в Windows-1251, на ASCII-эквиваленты для DXF. */
  function dxfReplaceUnits(str) {
    return str
      .replace(/\u00B2/g, '2')   // ² -> 2
      .replace(/\u00B3/g, '3')   // ³ -> 3
      .replace(/\u00D7/g, '*')   // × -> *
      .replace(/\u00B7/g, '*')   // · -> *
      .replace(/\u2212/g, '-')   // − (минус) -> -
      .replace(/\u2013/g, '-')   // – (тире) -> -
      .replace(/\u2014/g, '-'); // — (длинное тире) -> -
  }

  function stringToWin1251(str) {
    var map = {};
    for (var i = 0; i < WIN1251.length; i++) map[WIN1251[i]] = 0x80 + i;
    var out = [];
    for (var j = 0; j < str.length; j++) {
      var c = str.charCodeAt(j);
      if (c < 128) out.push(c);
      else if (map[c] !== undefined) out.push(map[c]);
      else out.push(63);
    }
    return new Uint8Array(out);
  }

  function exportDXF() {
    var dxf = buildDxfString();
    dxf = dxfReplaceUnits(dxf);
    var dxfCrlf = dxf.replace(/\n/g, '\r\n');
    var bytes = stringToWin1251(dxfCrlf);
    var blob = new Blob([bytes], { type: 'application/dxf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scheme_punching.dxf';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  document.getElementById('btnDxf').addEventListener('click', exportDXF);

  /** Тест 1: при заданных входных данных ожидаются Fb,ult = 79,4 т и Ub = 2676 мм. */
  function runTest1() {
    var testInput = {
      Ax: 400, Ay: 500, h: 300, ax: 36, ay: 48,
      beton: 'B30', armatura: 'А500', diam: 8, gb1: 1, mkp: 1,
      F_sila: 0, p: 0, Mlocx: 0, Mlocy: 0,
      useMx: false, useMy: false,
      edgeLeft: false, edgeRight: false, edgeBottom: false, edgeTop: false,
      multiContour: true,
      holes: [{ lx: 300, ly: 400, x: -1350, y: -1050 }],
      stepX: 60, stepY: 60
    };
    var result = runCalc(testInput);
    var fbOk = result.Fb_ult !== undefined && Math.abs(result.Fb_ult - 79.4) < 0.1;
    var ubOk = result.Ub !== undefined && Math.abs(result.Ub - 2676) < 1;
    if (fbOk && ubOk) {
      console.log('тест 1 пройден');
    } else {
      console.log('Тест 1 не пройден');
    }
  }

  /** Тест 2: входные Ax:500, Ay:800, h:220, ax:30, ay:30, beton B30, А240, diam 6, F_sila:80, Mlocx:13, Mlocy:5.7, stepX/Y:60. */
  function runTest2() {
    var testInput = {
      Ax: 500, Ay: 800, h: 220, ax: 30, ay: 30,
      beton: 'B30', armatura: 'А240', diam: 6, gb1: 1, mkp: 1,
      F_sila: 80, p: 0, Mlocx: 13, Mlocy: 5.7,
      useMx: true, useMy: true,
      edgeLeft: false, edgeRight: false, edgeBottom: false, edgeTop: false,
      multiContour: true,
      stepX: 60, stepY: 60,
      xAlong: 'a', xCountCorrection: 0
    };
    var result = runCalc(testInput);
    if (result.error) {
      console.log('Тест 2 не пройден: ' + result.error);
      return;
    }
    var aswOne = (typeof diam_Asw !== 'undefined' && diam_Asw[testInput.diam] != null) ? diam_Asw[testInput.diam] : (result.n_stirrups > 0 ? result.Asw_cm2 / result.n_stirrups : 0);
    var tol = 0.02;
    var tol2 = 0.05;
    var tol3 = 0.01;
    var tolInt = 2;
    var checkNames = [
      'Rbt', 'Rsw', 'h0', 'Fp', 'F', 'lu_sl', 'lu_sp', 'lu_sn', 'lu_sv', 'Ub',
      'Fb_ult', 'Mx', 'My', 'Sx_otv', 'Sy_otv', 'Xc', 'Yc', 'Ibx_otv', 'Iby_otv',
      'Ibx', 'Iby', 'Wbx', 'Wby', 'Mbx_ult', 'Mby_ult', 'n_stirrups', 'Asw_cm2', 'qsw',
      'Fsw_ult', 'Fsw_accept', 'Fult', 'Msw_x_ult', 'Msw_y_ult', 'Msw_x_accept', 'Msw_y_accept',
      'Mx_ult', 'My_ult', 'M_accept', 'k', 'kb'
    ];
    var checks = [
      [result.Rbt, 1.15, tol],
      [result.Rsw, 170, 1],
      [result.h0, 190, 1],
      [result.Fp, 0, tol],
      [result.F, 80, tol],
      [result.lu_sl, 990, tolInt],
      [result.lu_sp, 990, tolInt],
      [result.lu_sn, 690, tolInt],
      [result.lu_sv, 690, tolInt],
      [result.Ub, 3360, tolInt],
      [result.Fb_ult, 73.41, tol2],
      [result.Mx, 6.5, tol2],
      [result.My, 2.85, tol2],
      [result.Sx_otv, 0, tol],
      [result.Sy_otv, 0, tol],
      [result.Xc, 0, tol],
      [result.Yc, 0, tol],
      [result.Ibx_otv, 0, tol],
      [result.Iby_otv, 0, tol],
      [result.Ibx, 499851, 100],
      [result.Iby, 290421, 100],
      [result.Wbx, 10098, 10],
      [result.Wby, 8418, 10],
      [result.Mbx_ult, 22.06, tol2],
      [result.Mby_ult, 18.39, tol2],
      [result.n_stirrups, 2, 0],
      [result.Asw_cm2, 0.566, 0.6],
      [result.qsw, 16.04, tol2],
      [result.Fsw_ult, 43.107, tol2],
      [result.Fsw_accept, 43.107, tol2],
      [result.Fult, 116.52, tol2],
      [result.Msw_x_ult, 12.95, tol2],
      [result.Msw_y_ult, 10.79, tol2],
      [result.Msw_x_accept, 12.95, tol2],
      [result.Msw_y_accept, 10.79, tol2],
      [result.Mx_ult, 35.01, tol2],
      [result.My_ult, 29.18, tol2],
      [result.M_accept, 0.2833, tol3],
      [result.k, 0.97, tol2],
      [result.kb, 1.54, tol2]
    ];
    var allOk = true;
    for (var i = 0; i < checks.length; i++) {
      if (Math.abs(checks[i][0] - checks[i][1]) > checks[i][2]) allOk = false;
    }
    if (allOk) {
      console.log('тест 2 пройден');
    } else {
      console.log('Тест 2 не пройден');
      for (var j = 0; j < checks.length; j++) {
        var actual = checks[j][0];
        var expected = checks[j][1];
        var tolerance = checks[j][2];
        if (Math.abs(actual - expected) > tolerance) {
          console.log('  ' + checkNames[j] + ': получено ' + actual + ', ожидалось ' + expected + ', допуск ' + tolerance);
        }
      }
    }
  }

  /** Тест 3: колонна у края «Слева», B25, N=15, Mlocx=17, x_cx=500. Проверка формул грани. */
  function runTest3() {
    var testInput = {
      Ax: 500, Ay: 400, h: 230, ax: 30, ay: 30,
      beton: 'B25', armatura: 'А500', diam: 8, gb1: 1, mkp: 1,
      F_sila: 15, p: 0, Mlocx: 17, Mlocy: 0,
      useMx: true, useMy: false,
      edgeLeft: true, edgeRight: false, edgeBottom: false, edgeTop: false,
      x_cx: 500, x_cy: 0,
      multiContour: true,
      holes: [], stepX: 60, stepY: 60
    };
    var result = runCalc(testInput);
    if (result.error) {
      console.log('Тест 3 не пройден: ' + result.error);
      return;
    }
    var tol = 0.02;
    var tol2 = 0.05;
    var tolXc = 0.5;
    var checks = [
      [result.Rbt, 1.05, tol],
      [result.h0, 200, 0],
      [result.F, 15, tol],
      [result.lu_sl, 0, 0],
      [result.lu_sp, 600, 0],
      [result.lu_sn, 850, 0],
      [result.lu_sv, 850, 0],
      [result.Ub, 2300, 0],
      [result.Fb_ult, 48.30, tol2],
      [result.Sy_otv, 825, 1],
      [result.Xc, -35.9, tolXc],
      [result.Ibx, 182457.43, 10],
      [result.Iby, 171000, 10],
      [result.Wbx, 5808.33, 1],
      [result.Mx, 7.962, tol],
      [result.Mbx_ult, 12.19, tol2],
      [result.y_ras, 314.13, 0.02]
    ];
    var checkNames = ['Rbt', 'h0', 'F', 'lu_sl', 'lu_sp', 'lu_sn', 'lu_sv', 'Ub', 'Fb_ult', 'Sy_otv', 'Xc', 'Ibx', 'Iby', 'Wbx', 'Mx', 'Mbx_ult', 'y_ras'];
    var allOk = true;
    for (var i = 0; i < checks.length; i++) {
      if (Math.abs(checks[i][0] - checks[i][1]) > checks[i][2]) allOk = false;
    }
    if (allOk) {
      console.log('тест 3 пройден');
    } else {
      console.log('Тест 3 не пройден');
      for (var j = 0; j < checks.length; j++) {
        var actual = checks[j][0];
        var expected = checks[j][1];
        var tolerance = checks[j][2];
        if (Math.abs(actual - expected) > tolerance) {
          console.log('  ' + checkNames[j] + ': получено ' + actual + ', ожидалось ' + expected + ', допуск ' + tolerance);
        }
      }
    }
  }

  /** Тест 4: круглая колонна (пример 05). D=400, h=200, ax=ay=30, B30, А500, d=10, N=500, Mx=My=10, nsw=2, ssw=75. */
  function runTest4() {
    if (typeof runCalcCircular !== 'function') return;
    var testInput = {
      D: 400, h: 200, ax: 30, ay: 30, d: 10,
      beton: 'B30', armatura: 'А500', gb1: 1, mkp: 1,
      F_sila: 500, p: 0, Mx: 10, My: 10,
      nsw: 2, ssw: 75
    };
    var result = runCalcCircular(testInput);
    if (result.error) {
      console.log('Тест 4 не пройден: ' + result.error);
      return;
    }
    var tol = 0.02;
    var tol3 = 0.005;
    var checks = [
      [result.Ub, 1759.29, 0.1],
      [result.Fb_ult, 323.71, 0.05],
      [result.k_F, 1.545, tol3],
      [result.M, 14.142, 0.01],
      [result.Mb_ult, 45.319, 0.02],
      [result.Wb_m2, 0.246, 0.001],
      [result.k_M, 0.312, tol3],
      [result.Asw_cm2, 0.785, 0.01],
      [result.qsw, 628.319, 0.5],
      [result.Fsw_ult, 884.317, 0.5]
    ];
    var checkNames = ['u (Ub)', 'Fb,ult', 'F/Fb,ult (k_F)', 'M', 'Mb,ult', 'Wb', 'M/Mb,ult (k_M)', 'Asw', 'qsw', 'Fsw,ult'];
    var allOk = true;
    for (var i = 0; i < checks.length; i++) {
      if (Math.abs(checks[i][0] - checks[i][1]) > checks[i][2]) allOk = false;
    }
    if (allOk) {
      console.log('тест 4 пройден');
    } else {
      console.log('Тест 4 не пройден');
      for (var j = 0; j < checks.length; j++) {
        var actual = checks[j][0];
        var expected = checks[j][1];
        var tolerance = checks[j][2];
        if (Math.abs(actual - expected) > tolerance) {
          console.log('  ' + checkNames[j] + ': получено ' + actual + ', ожидалось ' + expected + ', допуск ' + tolerance);
        }
      }
    }
  }

  /** Тест 5: стена — торец в середине плиты (пример 04). t1=300, h=200, ax=ay=30, B30, А500, d=10, ssw=60, nsw=2, N=500, My=10. */
  function runTest5() {
    if (typeof runCalcWall !== 'function') return;
    var testInput = {
      type: 'torec_mid',
      t1: 300, h: 200, ax: 30, ay: 30, d: 10,
      beton: 'B30', armatura: 'А500', gb1: 1, mkp: 1,
      F_sila: 500, p: 0, My: 10, useMy: true,
      nsw: 2, ssw: 60
    };
    var result = runCalcWall(testInput);
    if (result.error) {
      console.log('Тест 5 не пройден: ' + result.error);
      return;
    }
    var tol = 0.02;
    var tol3 = 0.005;
    var checks = [
      [result.Ub, 1380, 1],
      [result.Fb_ult, 253.92, 0.05],
      [result.k_F, 1.969, tol3],
      [result.Mb_y_ult, 45.423, 0.02],
      [result.Wb_y_m2, 0.247, 0.001],
      [result.My / (result.Mb_y_ult || 1), 0.22, tol3],
      [result.Asw_cm2, 0.785, 0.01],
      [result.qsw, 785.398, 0.5],
      [result.Fsw_ult, 867.08, 0.5],
      [result.Fult, 507.84, 0.05]
    ];
    var checkNames = ['u', 'Fb,ult', 'F/Fb,ult (k_F)', 'Mb,y,ult', 'Wb,y', 'My/Mb,y,ult', 'Asw', 'qsw', 'Fsw,ult', 'Fult'];
    var allOk = true;
    for (var i = 0; i < checks.length; i++) {
      if (Math.abs(checks[i][0] - checks[i][1]) > checks[i][2]) allOk = false;
    }
    if (allOk) {
      console.log('тест 5 пройден');
    } else {
      console.log('Тест 5 не пройден');
      for (var j = 0; j < checks.length; j++) {
        var actual = checks[j][0];
        var expected = checks[j][1];
        var tolerance = checks[j][2];
        if (Math.abs(actual - expected) > tolerance) {
          console.log('  ' + checkNames[j] + ': получено ' + actual + ', ожидалось ' + expected + ', допуск ' + tolerance);
        }
      }
    }
  }

  /** Тест 6: стена — торец на краю плиты (пример 06). t1=300, c=300, h=200, ax=ay=30, B30, А500, d=10, ssw=60, nsw=2, N=350, My=10. */
  function runTest6() {
    if (typeof runCalcWall !== 'function') return;
    var testInput = {
      type: 'torec_edge',
      t1: 300, c: 300, h: 200, ax: 30, ay: 30, d: 10,
      beton: 'B30', armatura: 'А500', gb1: 1, mkp: 1,
      F_sila: 350, p: 0, My: 10, useMy: true,
      nsw: 2, ssw: 60
    };
    var result = runCalcWall(testInput);
    if (result.error) {
      console.log('Тест 6 не пройден: ' + result.error);
      return;
    }
    var tol = 0.02;
    var tol3 = 0.005;
    var kMy = result.Mb_y_ult > 0 ? result.My / result.Mb_y_ult : 0;
    var checks = [
      [result.Ub, 1360, 1],
      [result.Fb_ult, 250.24, 0.05],
      [result.k_F, 1.399, tol3],
      [result.Mb_y_ult, 23.773, 0.02],
      [result.Wb_y_m2, 0.129, 0.001],
      [kMy, 0.421, tol3],
      [result.Asw_cm2, 0.785, 0.01],
      [result.qsw, 785.398, 0.5],
      [result.Fsw_ult, 854.513, 0.5],
      [result.Fult, 500.48, 0.05]
    ];
    var checkNames = ['u', 'Fb,ult', 'F/Fb,ult (k_F)', 'Mb,y,ult', 'Wb,y', 'My/Mb,y,ult', 'Asw', 'qsw', 'Fsw,ult', 'Fult'];
    var allOk = true;
    for (var i = 0; i < checks.length; i++) {
      if (Math.abs(checks[i][0] - checks[i][1]) > checks[i][2]) allOk = false;
    }
    if (allOk) {
      console.log('тест 6 пройден');
    } else {
      console.log('Тест 6 не пройден');
      for (var j = 0; j < checks.length; j++) {
        var actual = checks[j][0];
        var expected = checks[j][1];
        var tolerance = checks[j][2];
        if (Math.abs(actual - expected) > tolerance) {
          console.log('  ' + checkNames[j] + ': получено ' + actual + ', ожидалось ' + expected + ', допуск ' + tolerance);
        }
      }
    }
  }

  /** Тест 7: стена — угол стены (пример 07). a1=a2=200, h=200, ax=ay=30, B30, А500, d=10, ssw=60, nsw=2, N=400. */
  function runTest7() {
    if (typeof runCalcWall !== 'function') return;
    var testInput = {
      type: 'ugol',
      a1: 200, a2: 200, h: 200, ax: 30, ay: 30, d: 10,
      beton: 'B30', armatura: 'А500', gb1: 1, mkp: 1,
      F_sila: 400, p: 0, My: 0, useMy: false,
      nsw: 2, ssw: 60
    };
    var result = runCalcWall(testInput);
    if (result.error) {
      console.log('Тест 7 не пройден: ' + result.error);
      return;
    }
    var tol = 0.02;
    var tol3 = 0.005;
    var kFult = result.Fult > 0 ? result.F / result.Fult : 0;
    var checks = [
      [result.Ub, 1129.71, 1],
      [result.Fb_ult, 207.866, 0.05],
      [result.k_F, 1.924, tol3],
      [result.Asw_cm2, 0.785, 0.01],
      [result.qsw, 785.398, 0.5],
      [result.Fsw_ult, 709.815, 0.5],
      [result.Fult, 415.732, 0.05],
      [kFult, 0.962, tol3]
    ];
    var checkNames = ['u', 'Fb,ult', 'F/Fb,ult (k_F)', 'Asw', 'qsw', 'Fsw,ult', 'Fult', 'F/Fult'];
    var allOk = true;
    for (var i = 0; i < checks.length; i++) {
      if (Math.abs(checks[i][0] - checks[i][1]) > checks[i][2]) allOk = false;
    }
    if (allOk) {
      console.log('тест 7 пройден');
    } else {
      console.log('Тест 7 не пройден');
      for (var j = 0; j < checks.length; j++) {
        var actual = checks[j][0];
        var expected = checks[j][1];
        var tolerance = checks[j][2];
        if (Math.abs(actual - expected) > tolerance) {
          console.log('  ' + checkNames[j] + ': получено ' + actual + ', ожидалось ' + expected + ', допуск ' + tolerance);
        }
      }
    }
  }

  updateDiagram();
  if (typeof updateCircParamsAndInfo === 'function') updateCircParamsAndInfo();
  if (typeof updateWallParamsAndInfo === 'function') updateWallParamsAndInfo();
  runTest1();
  runTest2();
  runTest3();
  runTest4();
  runTest5();
  runTest6();
  runTest7();
})();
