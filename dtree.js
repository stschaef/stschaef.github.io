// dtree.js — derivation / parse tree animation.
//
// ONE tree model, TWO renderings sharing a width-aware layout:
//   * measure every label, pack siblings by their actual width (no overlap),
//     center each parent over its children, then scale the whole tree to fit;
//   * "parse" mode: nodes (rule labels) + parent->child edges, grows downward,
//     terminal tokens as leaves;
//   * "inf" mode: each node is an inference rule (conclusion below a bar, premises
//     above, rule name beside the bar), grows upward; tokens live in the
//     conclusion text and are hidden as leaves.
// Both are the SAME authored tree; inference is the parse tree plus rule/
// conclusion structure. Grows by revealing rows top-to-bottom over time.

(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const GAPX = 44;       // px gap between sibling subtrees (room for rule labels)
  const PADX = 14;       // px slack around a label when reserving width
  const FIT_MARGIN = 18; // px margin when scaling to fit the slide
  const ROWDELAY = 750, HOLD = 700, KFDUR = 1100;
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  function svg(name, attrs) { const e = document.createElementNS(SVGNS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  const sz = el => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; };

  function readTree(container) {
    function walk(el) {
      const conclEl = el.querySelector(':scope > .dconcl');
      const kidsWrap = el.querySelector(':scope > .dkids');
      const children = [];
      (kidsWrap ? Array.from(kidsWrap.children) : []).forEach(k => {
        if (k.classList.contains('dnode')) children.push(walk(k));
        else if (k.classList.contains('dtok')) children.push({ kind: 'tok', el: k });
      });
      return { kind: 'node', rule: el.dataset.rule || '', conclEl, el, children };
    }
    const root = container.querySelector(':scope > .dnode');
    return root ? walk(root) : null;
  }

  // Build the node model from a GENERATED JSON spec (a fold of a real inductive
  // term, e.g. Agda's `toSpec : DyckAST → String`). Same shape as readTree, but
  // the label elements are created here rather than authored.
  function fromSpec(j) {
    if (j.tok !== undefined) { const el = document.createElement('div'); el.className = 'dtok'; el.textContent = j.tok; return { kind: 'tok', el }; }
    const conclEl = document.createElement('div'); conclEl.className = 'dconcl'; conclEl.textContent = j.concl || '';
    return { kind: 'node', rule: j.rule || '', conclEl, el: null, children: (j.kids || []).map(fromSpec) };
  }
  function readModel(container) {
    const spec = container.querySelector('script.dt-spec, .dt-spec');
    if (spec) { try { return fromSpec(JSON.parse(spec.textContent)); } catch (e) { console.warn('dtree: spec parse failed', e); } }
    return readTree(container);
  }

  function build(container) {
    const mode = container.dataset.mode === 'inf' ? 'inf' : 'parse';
    const tree = readModel(container);
    if (!tree) return null;

    const stage = document.createElement('div');
    stage.className = 'dt-stage';
    container.appendChild(stage);

    // create rule labels; move every label into the stage so it measures + shows
    const nodes = [], toks = [];
    (function collect(n) {
      nodes.push(n);
      const rl = document.createElement('div'); rl.className = 'drule'; rl.textContent = n.rule; n.ruleEl = rl;
      n.children.forEach(c => { if (c.kind === 'tok') toks.push(c); else collect(c); });
    })(tree);
    nodes.forEach(n => { stage.appendChild(n.conclEl); stage.appendChild(n.ruleEl); });
    toks.forEach(t => stage.appendChild(t.el));
    if (tree.el) tree.el.style.display = 'none';  // hide authoring skeleton (DOM source only)

    // measure (elements are in flow, unpositioned, with final fonts)
    nodes.forEach(n => { const c = sz(n.conclEl), r = sz(n.ruleEl); n.cw = c.w; n.ch = c.h; n.rw = r.w; n.rh = r.h; });
    toks.forEach(t => { const s = sz(t.el); t.w0 = s.w; t.h0 = s.h; });
    let maxH = 1; nodes.forEach(n => maxH = Math.max(maxH, n.ch)); toks.forEach(t => maxH = Math.max(maxH, t.h0));

    const kidsOf = n => n.kind === 'tok' ? [] : (mode === 'inf' ? n.children.filter(c => c.kind === 'node') : n.children);
    const ownW = n => (n.kind === 'tok' ? n.w0 : (mode === 'inf' ? n.cw : n.rw)) + PADX;

    // width-aware packing
    (function width(n) {
      const k = kidsOf(n);
      if (!k.length) { n.w = ownW(n); return n.w; }
      let span = 0; k.forEach((c, i) => { span += width(c); if (i) span += GAPX; });
      n.w = Math.max(ownW(n), span); return n.w;
    })(tree);

    let maxDepth = 0;
    (function depth(n, d) { n.d = d; maxDepth = Math.max(maxDepth, d); kidsOf(n).forEach(c => depth(c, d + 1)); })(tree, 0);

    (function assign(n, left) {
      const k = kidsOf(n);
      if (!k.length) { n.cx = left + n.w / 2; return; }
      let span = 0; k.forEach((c, i) => { span += c.w; if (i) span += GAPX; });
      let cur = left + (n.w - span) / 2;
      k.forEach(c => { assign(c, cur); cur += c.w + GAPX; });
      n.cx = (k[0].cx + k[k.length - 1].cx) / 2;
    })(tree, 0);

    const ROWH = maxH * (mode === 'inf' ? 1.55 : 2.2);
    const rowOf = n => mode === 'inf' ? (maxDepth - n.d) : n.d;
    const cy = n => rowOf(n) * ROWH;   // screen y (inf: root at bottom; parse: root at top)
    const ord = n => n.d;              // reveal order = depth from the root, so growth
                                       // starts at the root: parse grows top-down,
                                       // inference grows bottom-up from the conclusion

    // collect renderables in raw coords, then shift+scale to fit
    const labels = [], lines = [];
    const addLabel = (el, x, y, w, h, row) => labels.push({ el, x, y, w, h, row });

    nodes.forEach(n => {
      if (mode === 'parse') { n.conclEl.style.display = 'none'; addLabel(n.ruleEl, n.cx, cy(n), n.rw, n.rh, ord(n)); }
      else addLabel(n.conclEl, n.cx, cy(n), n.cw, n.ch, ord(n));
    });
    toks.forEach(t => { if (mode === 'parse') addLabel(t.el, t.cx, cy(t), t.w0, t.h0, ord(t)); else t.el.style.display = 'none'; });

    if (mode === 'parse') {
      const halfH = c => (c.kind === 'tok' ? c.h0 : c.rh) / 2;
      nodes.forEach(n => n.children.forEach(c => {
        // trim the edge to each label's boundary so it doesn't cross the text
        const x1 = n.cx, y1 = cy(n), x2 = c.cx, y2 = cy(c);
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        const g0 = n.rh / 2 + 5, g1 = halfH(c) + 5;
        lines.push({ x1: x1 + ux * g0, y1: y1 + uy * g0, x2: x2 - ux * g1, y2: y2 - uy * g1, cls: 'dt-edge', row: ord(c) });
      }));
    } else {
      nodes.forEach(n => {
        const prem = n.children.filter(c => c.kind === 'node');
        // bar must span the full width of all premises AND the conclusion
        let bl, br;
        if (prem.length) { bl = Math.min(...prem.map(p => p.cx - p.cw / 2)); br = Math.max(...prem.map(p => p.cx + p.cw / 2)); }
        else { bl = n.cx - n.cw / 2; br = n.cx + n.cw / 2; }
        bl = Math.min(bl, n.cx - n.cw / 2) - 4;
        br = Math.max(br, n.cx + n.cw / 2) + 4;
        const by = cy(n) - n.ch * 0.8;
        lines.push({ x1: bl, y1: by, x2: br, y2: by, cls: 'dt-bar', row: ord(n) });
        addLabel(n.ruleEl, br + n.rw / 2 + 5, by, n.rw, n.rh, ord(n));
      });
    }

    // bounds (include label half-extents and line endpoints)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    labels.forEach(L => { minX = Math.min(minX, L.x - L.w / 2); maxX = Math.max(maxX, L.x + L.w / 2); minY = Math.min(minY, L.y - L.h / 2); maxY = Math.max(maxY, L.y + L.h / 2); });
    lines.forEach(l => { minX = Math.min(minX, l.x1, l.x2); maxX = Math.max(maxX, l.x1, l.x2); minY = Math.min(minY, l.y1, l.y2); maxY = Math.max(maxY, l.y1, l.y2); });
    const sx = -minX + FIT_MARGIN, sy = -minY + FIT_MARGIN;
    const stageW = (maxX - minX) + 2 * FIT_MARGIN, stageH = (maxY - minY) + 2 * FIT_MARGIN;

    const overlay = svg('svg', { class: 'dt-overlay', width: stageW, height: stageH, viewBox: `0 0 ${stageW} ${stageH}` });
    stage.insertBefore(overlay, stage.firstChild);
    lines.forEach(l => { const e = svg('line', { x1: l.x1 + sx, y1: l.y1 + sy, x2: l.x2 + sx, y2: l.y2 + sy, class: l.cls }); e.dataset.row = l.row; overlay.appendChild(e); });
    labels.forEach(L => { L.el.style.left = (L.x + sx) + 'px'; L.el.style.top = (L.y + sy) + 'px'; L.el.dataset.row = L.row; });

    // size + scale the stage to fit the container
    const W = container.clientWidth || stageW, H = container.clientHeight || stageH;
    const scale = Math.min((W - 2 * FIT_MARGIN) / stageW, (H - 2 * FIT_MARGIN) / stageH, 1);
    stage.style.width = stageW + 'px'; stage.style.height = stageH + 'px';
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;

    return { maxRow: maxDepth };
  }

  // ---- growth ------------------------------------------------------------
  function reveal(container, k) { container.querySelectorAll('[data-row]').forEach(el => { el.style.opacity = (parseInt(el.dataset.row, 10) <= k) ? '1' : '0'; }); }
  const sleep = (ms, token) => new Promise(r => setTimeout(r, ms)).then(() => { if (token.cancelled) throw 0; });

  async function grow(container, info, token) {
    const loop = container.hasAttribute('data-loop');
    do {
      reveal(container, -1);
      try {
        await sleep(ROWDELAY, token);
        for (let r = 0; r <= info.maxRow; r++) { reveal(container, r); await sleep(ROWDELAY, token); }
        await sleep(HOLD, token);
      } catch (e) { return; }
    } while (loop && !token.cancelled);
  }

  // ---- keyframe animation: several tree states, nodes matched by id ------
  // Each keyframe is a JSON spec (a real term, folded). A node id persists
  // across keyframes; its position is the width-aware layout of THAT keyframe
  // (root-anchored), so reordering/regrouping children makes them glide, with
  // edges/bars re-derived every frame. (Two algebras over the same indexed term.)
  function buildKf(container) {
    const mode = container.dataset.mode === 'inf' ? 'inf' : 'parse';
    const specs = Array.from(container.querySelectorAll('script.dt-kf'))
      .map(s => { try { return JSON.parse(s.textContent); } catch (e) { console.warn('dtree kf parse', e); return null; } }).filter(Boolean);
    if (!specs.length) return null;
    const stage = document.createElement('div'); stage.className = 'dt-stage'; container.appendChild(stage);

    // union of ids -> one element each (content from first occurrence)
    const el = {}, ruleEl = {}, meta = {};
    (function () {
      function scan(j) {
        if (j.tok !== undefined) { if (!meta[j.id]) { meta[j.id] = { kind: 'tok' }; const e = document.createElement('div'); e.className = 'dtok'; e.textContent = j.tok; el[j.id] = e; stage.appendChild(e); } return; }
        if (!meta[j.id]) { meta[j.id] = { kind: 'node' }; const c = document.createElement('div'); c.className = 'dconcl'; c.textContent = j.concl || ''; el[j.id] = c; stage.appendChild(c); const r = document.createElement('div'); r.className = 'drule'; r.textContent = j.rule || ''; ruleEl[j.id] = r; stage.appendChild(r); }
        (j.kids || []).forEach(scan);
      }
      specs.forEach(scan);
    })();

    const size = {}; let maxH = 1;
    for (const id in el) { const s = el[id].getBoundingClientRect(); size[id] = { w: s.width, h: s.height }; maxH = Math.max(maxH, s.height); if (ruleEl[id]) { const rs = ruleEl[id].getBoundingClientRect(); size[id].rw = rs.width; size[id].rh = rs.height; } }

    const toTree = j => j.tok !== undefined ? { id: j.id, kind: 'tok' } : { id: j.id, kind: 'node', children: (j.kids || []).map(toTree) };
    function layoutOne(tree) {
      const kidsOf = n => n.kind === 'tok' ? [] : (mode === 'inf' ? n.children.filter(c => c.kind === 'node') : n.children);
      const ownW = n => ((n.kind === 'tok') ? size[n.id].w : (mode === 'inf' ? size[n.id].w : size[n.id].rw)) + PADX;
      (function w(n) { const k = kidsOf(n); if (!k.length) { n.w = ownW(n); return; } let s = 0; k.forEach((c, i) => { w(c); s += c.w; if (i) s += GAPX; }); n.w = Math.max(ownW(n), s); })(tree);
      let maxD = 0; (function d(n, dep) { n.d = dep; maxD = Math.max(maxD, dep); kidsOf(n).forEach(c => d(c, dep + 1)); })(tree, 0);
      (function ax(n, left) { const k = kidsOf(n); if (!k.length) { n.cx = left + n.w / 2; return; } let s = 0; k.forEach((c, i) => { s += c.w; if (i) s += GAPX; }); let cur = left + (n.w - s) / 2; k.forEach(c => { ax(c, cur); cur += c.w + GAPX; }); n.cx = (k[0].cx + k[k.length - 1].cx) / 2; })(tree, 0);
      const ROWH = maxH * (mode === 'inf' ? 1.55 : 2.2);
      const pos = {}, childIds = {}, premIds = {};
      (function rec(n) { const row = mode === 'inf' ? (maxD - n.d) : n.d; pos[n.id] = { x: n.cx, y: row * ROWH }; if (n.kind !== 'tok') { childIds[n.id] = n.children.map(c => c.id); premIds[n.id] = n.children.filter(c => c.kind === 'node').map(c => c.id); n.children.forEach(rec); } })(tree);
      const rx = pos[tree.id].x; for (const id in pos) pos[id].x -= rx;   // anchor the root's x at 0
      return { pos, childIds, premIds };
    }
    const KF = specs.map(s => layoutOne(toTree(s)));

    const edgeSet = new Set(), premU = {};
    KF.forEach(k => { for (const id in k.childIds) { k.childIds[id].forEach(c => edgeSet.add(id + '|' + c)); (premU[id] = premU[id] || new Set()); k.premIds[id].forEach(p => premU[id].add(p)); } });
    const edges = Array.from(edgeSet).map(s => s.split('|'));

    // shared scale/shift over the union of all keyframes; stage transform scales
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    KF.forEach(k => { for (const id in k.pos) { const p = k.pos[id], hw = (size[id].w || 4) / 2, hh = (size[id].h || 4) / 2; minX = Math.min(minX, p.x - hw); maxX = Math.max(maxX, p.x + hw); minY = Math.min(minY, p.y - hh); maxY = Math.max(maxY, p.y + hh); } });
    const sx = -minX + FIT_MARGIN, sy = -minY + FIT_MARGIN;
    const stageW = (maxX - minX) + 2 * FIT_MARGIN, stageH = (maxY - minY) + 2 * FIT_MARGIN;
    const W = container.clientWidth || stageW, H = container.clientHeight || stageH;
    const scale = Math.min((W - 2 * FIT_MARGIN) / stageW, (H - 2 * FIT_MARGIN) / stageH, 1);
    stage.style.width = stageW + 'px'; stage.style.height = stageH + 'px';
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;

    const overlay = svg('svg', { class: 'dt-overlay', width: stageW, height: stageH, viewBox: `0 0 ${stageW} ${stageH}` });
    stage.insertBefore(overlay, stage.firstChild);
    const edgeEl = {}; if (mode === 'parse') edges.forEach(([p, c]) => { const e = svg('line', { class: 'dt-edge' }); overlay.appendChild(e); edgeEl[p + '|' + c] = e; });
    const barEl = {}; if (mode === 'inf') for (const id in meta) if (meta[id].kind === 'node') { const b = svg('line', { class: 'dt-bar' }); overlay.appendChild(b); barEl[id] = b; }

    return { mode, KF, el, ruleEl, meta, size, edges, edgeEl, barEl, premU, sx, sy };
  }

  function frameState(B, ai, bi, t) {
    const A = B.KF[ai].pos, P = B.KF[bi].pos, st = {};
    for (const id in B.meta) { const a = A[id], b = P[id]; if (a && b) st[id] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), op: 1 }; else if (a) st[id] = { x: a.x, y: a.y, op: 1 - t }; else if (b) st[id] = { x: b.x, y: b.y, op: t }; }
    return st;
  }
  function renderKf(B, st) {
    const { el, ruleEl, meta, size, mode, edges, edgeEl, barEl, premU, sx, sy } = B;
    const X = x => x + sx, Y = y => y + sy;
    for (const id in meta) {
      const s = st[id], m = meta[id];
      if (m.kind === 'tok') { const e = el[id]; if (mode === 'inf' || !s) e.style.opacity = 0; else { e.style.left = X(s.x) + 'px'; e.style.top = Y(s.y) + 'px'; e.style.opacity = s.op; } continue; }
      const c = el[id], r = ruleEl[id];
      if (!s) { c.style.opacity = 0; r.style.opacity = 0; continue; }
      if (mode === 'parse') { c.style.opacity = 0; r.style.left = X(s.x) + 'px'; r.style.top = Y(s.y) + 'px'; r.style.opacity = s.op; }
      else { c.style.left = X(s.x) + 'px'; c.style.top = Y(s.y) + 'px'; c.style.opacity = s.op; }
    }
    if (mode === 'parse') {
      edges.forEach(([p, cc]) => {
        const e = edgeEl[p + '|' + cc], sp = st[p], sc = st[cc];
        if (!sp || !sc) { e.style.opacity = 0; return; }
        const dx = sc.x - sp.x, dy = sc.y - sp.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        const g0 = (size[p].rh || size[p].h) / 2 + 5, g1 = (meta[cc].kind === 'tok' ? size[cc].h : size[cc].rh) / 2 + 5;
        e.setAttribute('x1', X(sp.x + ux * g0)); e.setAttribute('y1', Y(sp.y + uy * g0));
        e.setAttribute('x2', X(sc.x - ux * g1)); e.setAttribute('y2', Y(sc.y - uy * g1));
        e.style.opacity = Math.min(sp.op, sc.op);
      });
    } else {
      for (const id in barEl) {
        const b = barEl[id], s = st[id], r = ruleEl[id];
        if (!s) { b.style.opacity = 0; r.style.opacity = 0; continue; }
        const prem = Array.from(premU[id] || []).filter(pid => st[pid] && st[pid].op > 0.05);
        const hw = size[id].w / 2;
        let bl, br;
        if (prem.length) { bl = Math.min(...prem.map(pid => st[pid].x - size[pid].w / 2)); br = Math.max(...prem.map(pid => st[pid].x + size[pid].w / 2)); }
        else { bl = s.x - hw; br = s.x + hw; }
        bl = Math.min(bl, s.x - hw) - 4; br = Math.max(br, s.x + hw) + 4;
        const by = s.y - size[id].h * 0.8;
        b.setAttribute('x1', X(bl)); b.setAttribute('y1', Y(by)); b.setAttribute('x2', X(br)); b.setAttribute('y2', Y(by)); b.style.opacity = s.op;
        r.style.left = X(br + size[id].rw / 2 + 5) + 'px'; r.style.top = Y(by) + 'px'; r.style.opacity = s.op;
      }
    }
  }
  function tweenKf(B, ai, bi, token) {
    return new Promise(res => {
      const t0 = (performance.now ? performance.now() : Date.now());
      function fr(now) { if (token.cancelled) return res(); const raw = Math.min(1, (now - t0) / KFDUR); renderKf(B, frameState(B, ai, bi, ease(raw))); if (raw < 1) requestAnimationFrame(fr); else res(); }
      requestAnimationFrame(fr);
    });
  }
  async function animateKf(B, container, token) {
    const n = B.KF.length;
    if (n === 1) { renderKf(B, frameState(B, 0, 0, 0)); return; }
    const loop = container.hasAttribute('data-loop');
    do {
      try {
        for (let i = 0; i + 1 < n; i++) { await tweenKf(B, i, i + 1, token); await sleep(HOLD, token); }
        if (loop) { await tweenKf(B, n - 1, 0, token); await sleep(HOLD, token); }  // seamless wrap
      } catch (e) { return; }
    } while (loop && !token.cancelled);
  }

  // ---- lifecycle ---------------------------------------------------------
  let liveToken = { cancelled: true };
  function activate(slide) {
    liveToken.cancelled = true;
    if (!slide) return;
    const container = slide.querySelector('.dtree');
    if (!container) return;
    const token = { cancelled: false }; liveToken = token;
    if (container.querySelector('script.dt-kf')) {            // keyframe animation
      if (!container._kf) container._kf = buildKf(container);
      if (container._kf) animateKf(container._kf, container, token);
      return;
    }
    if (!container._dtInfo) container._dtInfo = build(container);
    if (!container._dtInfo) return;
    grow(container, container._dtInfo, token);
  }
  function start() {
    activate(window.Reveal && Reveal.getCurrentSlide && Reveal.getCurrentSlide());
    if (window.Reveal && Reveal.on) Reveal.on('slidechanged', e => activate(e.currentSlide));
  }
  if (window.Reveal && Reveal.isReady && Reveal.isReady()) start();
  else if (window.Reveal && Reveal.on) Reveal.on('ready', start);
  else window.addEventListener('load', () => { if (window.Reveal) (Reveal.isReady && Reveal.isReady() ? start() : Reveal.on('ready', start)); });
})();
