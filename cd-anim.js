// cd-anim.js — runtime for declarative commutative-diagram animations.
//
// Reads .cd-anim containers authored with the \cdanim* / \cdobj / \cdedge /
// \cdface / \cd2cell / \cdkey / \cdat macros, then:
//   * builds an SVG overlay + positions the HTML node/edge/cell labels,
//   * interpolates the FREE parameters (object positions) between keyframes,
//   * re-derives every dependent cell each frame from its faces:
//       - 1-cells (edges): buffered, optionally curved, sticky to endpoints,
//       - 2-cells (\cdface): a filled region bounded by a vertex cycle,
//       - natural transformations (\cd2cell): a transparent lens between two
//         parallel morphisms with a double arrow + label.
//
// Two playback modes: autoplay (optionally looping) and stepped (advance one
// keyframe per user event, wired to reveal fragments so it reads vertically).

(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const VIEW = 100;          // logical coordinate extent (0..100, both axes)
  const DEFAULT_DUR = 1100;  // ms per step
  const HOLD = 500;          // ms hold at each keyframe (autoplay)
  const SAMPLES = 10;        // samples per edge when building a 2-cell lens
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  function svg(name, attrs) {
    const el = document.createElementNS(SVGNS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function hash(s) { let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h || 1; }
  function polyD(pts) { return 'M ' + pts.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ') + ' Z'; }
  function bez(g, t) { const u = 1 - t, a = u * u, b = 2 * u * t, c = t * t; return { x: a * g.p0.x + b * g.m.x + c * g.p1.x, y: a * g.p0.y + b * g.m.y + c * g.p1.y }; }
  function sampleQuad(g, k) { const out = []; for (let i = 0; i <= k; i++) out.push(bez(g, i / k)); return out; }

  // ---- parse the authored DOM into a scene model -------------------------
  function parse(container) {
    const objs = {};
    container.querySelectorAll(':scope > .cda-obj').forEach(el => {
      objs[el.dataset.id] = { id: el.dataset.id, label: el, r: { x: 6, y: 6 } };
    });
    const edges = [];
    container.querySelectorAll(':scope > .cda-edge').forEach(el => {
      edges.push({ id: el.dataset.id, from: el.dataset.from, to: el.dataset.to, curve: parseFloat(el.dataset.curve || '0'), label: el });
    });
    const faces = [];
    container.querySelectorAll(':scope > .cda-face').forEach(el => {
      faces.push({ id: el.dataset.id, verts: (el.dataset.verts || '').split(',').map(s => s.trim()).filter(Boolean), label: el });
    });
    const cells = [];
    container.querySelectorAll(':scope > .cda-2cell').forEach(el => {
      cells.push({ id: el.dataset.id, src: el.dataset.src, tgt: el.dataset.tgt, label: el });
    });
    const keyframes = [];
    container.querySelectorAll(':scope > .cda-kf').forEach(kf => {
      const pos = {};
      kf.querySelectorAll('.cda-at').forEach(a => { pos[a.dataset.obj] = { x: parseFloat(a.dataset.x), y: parseFloat(a.dataset.y) }; });
      keyframes.push(pos);
    });
    return { objs, edges, faces, cells, keyframes };
  }

  // ---- build the SVG overlay (layers: fills < edges < 2-cell arrows) ------
  function build(container, scene) {
    container.classList.add('cda-stage');
    const overlay = svg('svg', { class: 'cda-overlay', viewBox: `0 0 ${VIEW} ${VIEW}` });
    const tag = Math.abs(hash(container.textContent)).toString(36);
    const defs = svg('defs', {});
    const mk = (id, cls) => {
      const m = svg('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '5', markerHeight: '5', markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
      m.appendChild(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: cls }));
      defs.appendChild(m); return id;
    };
    scene.mFg = mk('cda-ah-' + tag, 'cda-ah');
    overlay.appendChild(defs);

    const fills = svg('g', { class: 'cda-fills' });
    const edgesG = svg('g', { class: 'cda-edges' });
    const arrowsG = svg('g', { class: 'cda-2arrows' });
    overlay.appendChild(fills); overlay.appendChild(edgesG); overlay.appendChild(arrowsG);

    scene.faces.forEach(fc => { fc.path = svg('path', { class: 'cda-face-path', 'data-id': fc.id }); fills.appendChild(fc.path); });
    scene.cells.forEach(c => {
      c.lens = svg('path', { class: 'cda-lens', 'data-id': c.id }); fills.appendChild(c.lens);
      c.shaft = svg('path', { class: 'cda-2arrow' });  // two parallel lines, no head
      c.head = svg('path', { class: 'cda-2head' });    // one shared arrowhead
      arrowsG.appendChild(c.shaft); arrowsG.appendChild(c.head);
    });
    scene.paths = {};
    scene.edges.forEach(e => { const p = svg('path', { class: 'cda-edge-path', 'data-id': e.id, 'marker-end': `url(#${scene.mFg})` }); edgesG.appendChild(p); scene.paths[e.id] = p; });

    container.insertBefore(overlay, container.firstChild);
  }

  // ---- measure node half-extents in logical units ------------------------
  function measure(container, scene) {
    const W = container.clientWidth || 1, H = container.clientHeight || 1;
    for (const id in scene.objs) {
      const r = scene.objs[id].label.getBoundingClientRect();
      scene.objs[id].r = { x: Math.max(3, (r.width / 2) / W * VIEW), y: Math.max(3, (r.height / 2) / H * VIEW) };
    }
  }

  // ray from center c in direction (ux,uy): exit point of box (r + buffer)
  function boundary(c, r, ux, uy, buffer) {
    const ex = r.x + buffer, ey = r.y + buffer;
    const tx = Math.abs(ux) < 1e-6 ? Infinity : ex / Math.abs(ux);
    const ty = Math.abs(uy) < 1e-6 ? Infinity : ey / Math.abs(uy);
    return { x: c.x + ux * Math.min(tx, ty), y: c.y + uy * Math.min(tx, ty) };
  }

  // ---- the derived layout: place nodes, re-route edges, fill cells -------
  function layout(scene, pos, buffer) {
    scene._cur = pos;
    let cx = 0, cy = 0, n = 0;
    for (const id in pos) { cx += pos[id].x; cy += pos[id].y; n++; }
    cx /= (n || 1); cy /= (n || 1);

    for (const id in scene.objs) {
      const p = pos[id]; if (!p) continue;
      scene.objs[id].label.style.left = p.x + '%';
      scene.objs[id].label.style.top = p.y + '%';
    }

    scene.geom = {};
    scene.edges.forEach(e => {
      const a = pos[e.from], b = pos[e.to], path = scene.paths[e.id];
      if (!a || !b) { path.removeAttribute('d'); return; }
      const ra = scene.objs[e.from].r, rb = scene.objs[e.to].r;
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist, nx = -uy, ny = ux;
      const p0 = boundary(a, ra, ux, uy, buffer);
      const p1 = boundary(b, rb, -ux, -uy, buffer);
      const apex = e.curve * dist * 0.5;
      const m = { x: (p0.x + p1.x) / 2 + nx * apex, y: (p0.y + p1.y) / 2 + ny * apex };
      path.setAttribute('d', Math.abs(e.curve) < 1e-3 ? `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}` : `M ${p0.x} ${p0.y} Q ${m.x} ${m.y} ${p1.x} ${p1.y}`);
      scene.geom[e.id] = { p0, p1, m, curve: e.curve };
      const od = Math.hypot(m.x - cx, m.y - cy) || 1;
      e.label.style.left = (m.x + (m.x - cx) / od * 5) + '%';
      e.label.style.top = (m.y + (m.y - cy) / od * 5) + '%';
    });

    // 2-cells: filled regions bounded by a vertex cycle
    scene.faces.forEach(fc => {
      const ps = fc.verts.map(id => pos[id]);
      if (ps.some(p => !p) || ps.length < 3) { fc.path.removeAttribute('d'); fc.label.style.opacity = 0; return; }
      let fx = 0, fy = 0; ps.forEach(p => { fx += p.x; fy += p.y; }); fx /= ps.length; fy /= ps.length;
      const inset = fc.verts.map(id => {
        const p = pos[id], r = scene.objs[id] ? scene.objs[id].r : { x: 4, y: 4 };
        const dx = fx - p.x, dy = fy - p.y, d = Math.hypot(dx, dy) || 1, off = Math.max(r.x, r.y) + buffer + 2;
        return { x: p.x + dx / d * off, y: p.y + dy / d * off };
      });
      fc.path.setAttribute('d', polyD(inset));
      fc.label.style.left = fx + '%'; fc.label.style.top = fy + '%'; fc.label.style.opacity = 1;
    });

    // natural transformations: transparent lens + double arrow between 2 edges
    scene.cells.forEach(c => {
      const gs = scene.geom[c.src], gt = scene.geom[c.tgt];
      if (!gs || !gt) { c.lens.removeAttribute('d'); c.shaft.removeAttribute('d'); c.head.removeAttribute('d'); c.label.style.opacity = 0; return; }
      const S = sampleQuad(gs, SAMPLES), T = sampleQuad(gt, SAMPLES);
      c.lens.setAttribute('d', polyD(S.concat(T.slice().reverse())));
      // double-line, single-head arrow (the natural-transformation symbol)
      const Ms = bez(gs, 0.5), Mt = bez(gt, 0.5);
      const dx = Mt.x - Ms.x, dy = Mt.y - Ms.y, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
      const off = 0.9, hLen = 3.0, hHalf = 2.0;
      const A = { x: lerp(Ms.x, Mt.x, 0.30), y: lerp(Ms.y, Mt.y, 0.30) };  // shaft start
      const Tp = { x: lerp(Ms.x, Mt.x, 0.74), y: lerp(Ms.y, Mt.y, 0.74) }; // tip
      const SE = { x: Tp.x - ux * hLen, y: Tp.y - uy * hLen };             // head base
      c.shaft.setAttribute('d',
        `M ${A.x + nx * off} ${A.y + ny * off} L ${SE.x + nx * off} ${SE.y + ny * off} ` +
        `M ${A.x - nx * off} ${A.y - ny * off} L ${SE.x - nx * off} ${SE.y - ny * off}`);
      // open chevron tip (not a filled triangle)
      c.head.setAttribute('d',
        `M ${SE.x + nx * hHalf} ${SE.y + ny * hHalf} L ${Tp.x} ${Tp.y} L ${SE.x - nx * hHalf} ${SE.y - ny * hHalf}`);
      c.label.style.opacity = 1;
      c.label.style.left = ((Ms.x + Mt.x) / 2 + nx * 6) + '%';
      c.label.style.top = ((Ms.y + Mt.y) / 2 + ny * 6) + '%';
    });
  }

  // ---- animation driver --------------------------------------------------
  function tween(scene, from, to, dur, buffer, token) {
    return new Promise(resolve => {
      const t0 = (performance.now ? performance.now() : Date.now());
      function frame(now) {
        if (token.cancelled) return resolve();
        const raw = Math.min(1, (now - t0) / dur), t = ease(raw), cur = {};
        for (const id in to) { const a = from[id] || to[id], b = to[id]; cur[id] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
        layout(scene, cur, buffer);
        if (raw < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }
  function sleep(ms, token) { return new Promise(r => setTimeout(r, ms)).then(() => { if (token.cancelled) throw 0; }); }

  async function playAuto(scene, container, token) {
    const buffer = parseFloat(container.dataset.buffer || '3'), dur = parseFloat(container.dataset.duration || DEFAULT_DUR);
    const loop = container.hasAttribute('data-loop'), kfs = scene.keyframes;
    if (!kfs.length) return;
    do {
      layout(scene, kfs[0], buffer);
      try {
        await sleep(HOLD, token);
        for (let i = 0; i + 1 < kfs.length; i++) { await tween(scene, kfs[i], kfs[i + 1], dur, buffer, token); await sleep(HOLD, token); }
      } catch (e) { return; }
    } while (loop && !token.cancelled);
  }

  function stepTo(scene, container, target) {
    const kfs = scene.keyframes; target = Math.max(0, Math.min(kfs.length - 1, target));
    const buffer = parseFloat(container.dataset.buffer || '3'), dur = parseFloat(container.dataset.duration || DEFAULT_DUR);
    if (container._tok) container._tok.cancelled = true;
    const token = { cancelled: false }; container._tok = token;
    tween(scene, scene._cur || kfs[0], kfs[target], dur, buffer, token);
    container._step = target;
  }

  // ---- lifecycle ---------------------------------------------------------
  let liveToken = { cancelled: true };

  // ---- mouse interaction: drag the FREE parameters (object positions) -----
  // Dragging reuses layout() verbatim — a pointer just sets pos[id], then every
  // dependent cell (edges, faces, 2-cells) re-derives exactly as in a tween.
  // Grabbing a node cancels any running animation; positions are EPHEMERAL —
  // a slide change or reload resets them to the authored keyframes.
  function makeDraggable(container, scene) {
    if (container._draggable) return;
    container._draggable = true;
    const overlay = container.querySelector('.cda-overlay');
    if (overlay) overlay.style.pointerEvents = 'none';   // let node labels win the hit-test
    let drag = null;

    const toLogical = e => {
      const r = container.getBoundingClientRect();
      const x = (e.clientX - r.left) / (r.width || 1) * VIEW;
      const y = (e.clientY - r.top) / (r.height || 1) * VIEW;
      return { x: Math.max(0, Math.min(VIEW, x)), y: Math.max(0, Math.min(VIEW, y)) };
    };
    const buffer = () => parseFloat(container.dataset.buffer || '3');

    for (const id in scene.objs) {
      const el = scene.objs[id].label;
      el.style.cursor = 'grab';
      el.style.touchAction = 'none';                     // we own the gesture, not scroll/zoom
      el.addEventListener('pointerdown', e => {
        e.stopPropagation();                             // reveal must not swipe/navigate
        e.preventDefault();
        if (container._tok) container._tok.cancelled = true;  // cancel a running step-tween
        liveToken.cancelled = true;                           // cancel autoplay
        scene._cur = Object.assign({}, scene._cur || scene.keyframes[0] || {});
        drag = { id, pointerId: e.pointerId };
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';
      });
      el.addEventListener('pointermove', e => {
        if (!drag || drag.id !== id) return;
        e.stopPropagation();
        scene._cur[id] = toLogical(e);
        layout(scene, scene._cur, buffer());             // ← the whole functor, reused
      });
      const release = e => {
        if (!drag || drag.id !== id) return;
        e.stopPropagation();
        try { el.releasePointerCapture(drag.pointerId); } catch (_) {}
        el.style.cursor = 'grab';
        drag = null;
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
    }
  }

  function ensureBuilt(container) {
    if (!container._cdaScene) { const scene = parse(container); build(container, scene); measure(container, scene); container._cdaScene = scene; }
    measure(container, container._cdaScene);
    return container._cdaScene;
  }

  // Turn a stepped diagram's slide into a reveal VERTICAL STACK: one empty
  // sub-slide per keyframe. reveal then provides its native down-arrow control
  // and vertical navigation, and the diagram (a non-section child of the stack)
  // stays visible across the sub-slides.
  function ensureStack(container, scene) {
    if (container._stacked) return;
    container._stacked = true;
    const section = container.closest('section');
    if (!section) return;
    for (let i = 0; i < scene.keyframes.length; i++) {
      const s = document.createElement('section');
      s.className = 'cda-step';
      s.setAttribute('data-cda-step', i);
      section.appendChild(s);
    }
    if (window.Reveal && Reveal.sync) Reveal.sync();
  }

  // When the current slide is a sub-slide of a stepped stack, the diagram lives
  // in the parent stack section.
  function steppedContainerFor(slide) {
    const stack = slide.parentElement;
    if (stack && stack.tagName === 'SECTION') return stack.querySelector(':scope > .cd-anim[data-steps]');
    return null;
  }

  function activate(slide) {
    liveToken.cancelled = true;
    if (!slide) return;

    // Already-stacked stepped diagram: tween to the current vertical index.
    const stepC = steppedContainerFor(slide);
    if (stepC) {
      const scene = ensureBuilt(stepC);
      makeDraggable(stepC, scene);
      const v = (window.Reveal && Reveal.getIndices) ? (Reveal.getIndices().v || 0) : 0;
      if (scene._cur) stepTo(scene, stepC, v);
      else layout(scene, scene.keyframes[v] || scene.keyframes[0], parseFloat(stepC.dataset.buffer || '3'));
      stepC._step = v;
      return;
    }

    const container = slide.querySelector('.cd-anim');
    if (!container) return;
    const scene = ensureBuilt(container);
    makeDraggable(container, scene);
    const buffer = parseFloat(container.dataset.buffer || '3');
    if (container.dataset.steps) {
      // First encounter: show keyframe 0, then convert into a vertical stack.
      layout(scene, scene.keyframes[0], buffer);
      container._step = 0;
      ensureStack(container, scene);
    } else {
      const token = { cancelled: false }; liveToken = token;
      playAuto(scene, container, token);
    }
  }

  function start() {
    activate(window.Reveal && Reveal.getCurrentSlide && Reveal.getCurrentSlide());
    if (window.Reveal && Reveal.on) Reveal.on('slidechanged', e => activate(e.currentSlide));
  }

  if (window.Reveal && Reveal.isReady && Reveal.isReady()) start();
  else if (window.Reveal && Reveal.on) Reveal.on('ready', start);
  else window.addEventListener('load', () => { if (window.Reveal) (Reveal.isReady && Reveal.isReady() ? start() : Reveal.on('ready', start)); });
})();
