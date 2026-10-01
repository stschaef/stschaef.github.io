// Glyphcraft: ornament as the composition of higher-order asset generators.
//
// A *thing* is a function from an environment to a drawing. The environment carries the random
// stream, the palette and the depth; a drawing is a list of glyphs placed round an origin (in
// glyph units: 1 = one glyph) with its radius. Combinators take things (and numbers) and return
// things, so art is written as expressions:
//
//   burst(5, burst(3, alt(4, 'β', 'ζ')))          a string is shorthand for tok('…')
//   flower(rosette('✿', '∀'), { stem: 6, leaves: 4 })
//   solid('icosahedron', { face: ring(5, '·') })
//
// Every combinator sizes itself from its children's radii, so composition nests to any depth.
// Colour follows depth unless a subtree is tinted, so recursive structures come out in layers.
//
// Laws, kept by the combinators themselves (no expression can break them):
//  - A part containing a hooked glyph (∃, Σ, ⊏, ∈, ¬, ⊸, …) is never turned round a centre: it
//    stands upright wherever it is placed. (Turned outward four-fold, such glyphs make a swastika.)
//  - Plant parts are anchored at their base and grow upward (toward −y); radial parts are centred.
(function (global) {
  "use strict";
  const TAU = Math.PI * 2, DEG = 180 / Math.PI;
  const COLOURS = ["var(--accent)", "var(--accent-2, #5f8f4e)", "var(--accent-3, #3f6fb3)", "var(--accent-4, #b8860b)", "var(--accent-5, var(--accent))"];
  const NAMED = { accent: COLOURS[0], red: COLOURS[0], green: COLOURS[1], blue: COLOURS[2], gold: COLOURS[3], violet: COLOURS[4],
    ink: "var(--ink, currentColor)", muted: "var(--muted, #888)" };
  const HOOKED = /[∃ƎΣ⊏⊐∈∋¬⌐Γ⅃⊸⊢⊣ℲⅎЕЭ]/;
  const colour = c => c == null ? null : NAMED[c] || (/^accent-\d$/.test(c) ? "var(--" + c + ")" : c);

  // ---------------------------------------------------------------- drawings and environments
  function drawing(items, extra) {
    let r = 0;
    for (const it of items) r = Math.max(r, Math.hypot(it.x, it.y) + 0.5 * (it.s || 1));
    return Object.assign({ items, r }, extra);
  }
  const EMPTY = { items: [], r: 0 };
  // place a drawing's items: scale k, turn by a (radians; glyphs turn too unless upright), then shift
  function place(items, o) {
    const k = o.k == null ? 1 : o.k, a = o.a || 0, c = Math.cos(a), s = Math.sin(a), dx = o.x || 0, dy = o.y || 0;
    return items.map(it => Object.assign({}, it, {
      x: k * (it.x * c - it.y * s) + dx, y: k * (it.x * s + it.y * c) + dy, s: (it.s || 1) * k,
      rot: it.upright ? (it.rot || 0) : (it.rot || 0) + a * DEG,
    }));
  }
  const hooked = d => d.items.some(it => HOOKED.test(it.tok));
  // things that grow (plants, shoots) carry a tip; a centred thing put where a growing one is
  // expected is moved out by its radius, so it stands on the anchor instead of covering it
  const anchored = d => d.tip ? d : { items: d.items.map(it => Object.assign({}, it, { y: it.y - d.r })), r: 2 * d.r, tip: { x: 0, y: -2 * d.r, a: 0 } };
  // the random stream: a seeded generator (mulberry32 over a string hash), or Math.random
  function rng(seed) {
    if (seed == null) return Math.random;
    let h = 1779033703 ^ String(seed).length;
    for (const ch of String(seed)) { h = Math.imul(h ^ ch.codePointAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function env(o) { o = o || {}; return { rng: typeof o.rng === "function" ? o.rng : rng(o.seed), cols: (o.cols || COLOURS).map(colour), col: colour(o.col), depth: o.depth || 0 }; }
  const down = e => Object.assign({}, e, { depth: e.depth + 1 });
  // run a thing (a string is a glyph; a number is empty space of that radius)
  function run(t, e) {
    if (typeof t === "function") return t(e);
    if (typeof t === "string") return tok(t)(e);
    if (typeof t === "number") return { items: [], r: t };
    return t && t.items ? t : EMPTY;
  }
  const colourAt = e => e.col || e.cols[e.depth % e.cols.length];

  // ---------------------------------------------------------------- primitives
  // tok(glyph, {s, rot, col, upright}): one glyph
  const tok = (g, o) => e => { o = o || {};
    return drawing([{ tok: g, x: 0, y: 0, s: o.s || 1, rot: o.rot || 0, col: colour(o.col) || colourAt(e), upright: !!o.upright || HOOKED.test(g) }]); };
  // over(...things): superposed, sharing their origin
  const over = (...ts) => e => { const ds = ts.map(t => run(t, e)); return drawing(ds.flatMap(d => d.items), { tip: ds.find(d => d.tip) && ds.find(d => d.tip).tip }); };
  const tint = (c, t) => e => run(t, Object.assign({}, e, { col: colour(c) }));
  // a random colour from the palette for the whole subtree
  const anyColour = t => e => run(t, Object.assign({}, e, { col: e.cols[Math.floor(e.rng() * e.cols.length)] }));
  const size = (k, t) => e => { const d = run(t, e); return drawing(place(d.items, { k }), d.tip && { tip: { x: d.tip.x * k, y: d.tip.y * k, a: d.tip.a } }); };
  const turn = (deg, t) => e => drawing(place(run(t, e).items, { a: deg / DEG }));
  const shift = (x, y, t) => e => drawing(place(run(t, e).items, { x, y }));
  const mirror = t => e => { const d = run(t, e);
    return drawing(d.items.map(it => Object.assign({}, it, { x: -it.x, rot: -(it.rot || 0), reflect: !it.reflect })), d.tip && { tip: { x: -d.tip.x, y: d.tip.y, a: -d.tip.a } }); };
  const upright = t => e => { const d = run(t, e); return drawing(d.items.map(it => Object.assign({}, it, { upright: true })), d); };
  // choose(...things): one of them, at random, each time it is drawn
  const choose = (...ts) => e => run(ts[Math.floor(e.rng() * ts.length)], e);
  // pad(r, t): t with room round it (for spacing in rings)
  const pad = (p, t) => e => { const d = run(t, e); return Object.assign({}, d, { r: d.r + p }); };
  // ---------------------------------------------------------------- radial
  // ring(n, thing, {r, min, gap, offset, upright, cols}): n copies round a circle, each turned so
  // its top points outward; radius fitted so neighbours don't touch (or fixed by r / at least min).
  const ring = (n, t, o) => e => { o = o || {};
    if (Array.isArray(t)) return alt(n, ...t)(e);   // a list: the ring cycles through it
    const d = run(t, down(e)), still = o.upright || hooked(d), gap = o.gap == null ? 0.15 : o.gap;
    const fit = d.r > 0 && n > 1 ? (d.r + gap) / Math.sin(Math.PI / n) : 0;
    const R = o.r != null ? o.r : Math.max(o.min || 0, fit), a0 = (o.turn || 0) / DEG + (o.offset ? Math.PI / n : 0);
    let items = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + k * TAU / n;
      let part = place(d.items, { a: still ? 0 : a + Math.PI / 2, x: R * Math.cos(a), y: R * Math.sin(a) });
      if (o.cols) { const c = colour(o.cols[k % o.cols.length]); part = part.map(it => Object.assign({}, it, { col: c })); }
      items = items.concat(part);
    }
    return drawing(items); };
  // alt(n, ...things): a ring of n slots cycling through the things
  const alt = (n, ...ts) => e => {
    const ds = ts.map(t => run(t, down(e))), mr = Math.max(...ds.map(d => d.r)), R = mr > 0 ? (mr + 0.15) / Math.sin(Math.PI / n) : 0;
    let items = [];
    for (let k = 0; k < n; k++) { const d = ds[k % ds.length], a = k * TAU / n; items = items.concat(place(d.items, { a: hooked(d) ? 0 : a + Math.PI / 2, x: R * Math.cos(a), y: R * Math.sin(a) })); }
    return drawing(items); };
  // burst(n, thing, o) or burst([t1, …, tn], o): rays from a centre, a thing at the end of each;
  // o: {centre, len, ray (glyph or null), step, r}
  const burst = (a, b, c) => e => {
    const tips = Array.isArray(a) ? a : Array.from({ length: a }, (_, k) => Array.isArray(b) ? b[k % b.length] : b), o = (Array.isArray(a) ? b : c) || {}, n = tips.length;
    const seen = new Map(), ds = tips.map(t => { if (!seen.has(t)) seen.set(t, run(t, down(e))); return seen.get(t); });
    const cd = o.centre ? run(o.centre, down(e)) : null, inner = cd ? cd.r + 0.35 : 0.7, mr = Math.max(...ds.map(d => d.r));
    const R = o.r != null ? o.r : Math.max(inner + (o.len == null ? 1.6 : o.len) + mr, n > 1 ? (mr + 0.2) / Math.sin(Math.PI / n) : 0);
    let items = cd ? cd.items.slice() : [];
    const ray = o.ray === undefined ? "∣" : o.ray, rc = colour(o.rayCol) || colourAt(e);
    for (let k = 0; k < n; k++) {
      const ang = (o.turn || 0) / DEG + k * TAU / n, ca = Math.cos(ang), sa = Math.sin(ang), r0 = inner + 0.3, r1 = R - ds[k].r - 0.25;
      if (ray != null && r1 > r0) items = items.concat(lineItems(t => [ca * (r0 + (r1 - r0) * t), sa * (r0 + (r1 - r0) * t)], ray, { step: o.step, s: 0.85, col: rc }, e));
      items = items.concat(place(ds[k].items, { a: hooked(ds[k]) ? 0 : ang + Math.PI / 2, x: ca * R, y: sa * R }));
    }
    return drawing(items); };
  // lineItems(P, ln, o, e): the line along P: a glyph repeated every o.step (turned to follow it), a
  // thing laid along it, or nothing (ln null)
  function lineItems(P, ln, o, e) {
    if (ln == null) return [];
    if (typeof ln !== "string") return layAlong(P, run(ln, down(e)), { gap: o.gap });
    const L = Math.hypot(P(1)[0] - P(0)[0], P(1)[1] - P(0)[1]), a = Math.atan2(P(1)[1] - P(0)[1], P(1)[0] - P(0)[0]), out = [], st = o.step || 1;
    for (let q = 0; q <= L + 0.01; q += st) { const f = L ? q / L : 0, x = P(0)[0] + (P(1)[0] - P(0)[0]) * f, y = P(0)[1] + (P(1)[1] - P(0)[1]) * f;
      out.push({ tok: ln, x, y, s: o.s || 1, rot: a * DEG + 90, col: o.col, line: true }); }
    return out;
  }
  // rays(n, len, {line, tip, from, alternate}): lines outward (a glyph or a thing); alternate rays shorter
  const rays = (n, len, o) => e => { o = o || {};
    const g = o.line || o.glyph || "∣", tip = o.tip ? run(o.tip, down(e)) : null, from = o.from == null ? 1.2 : o.from, c = colourAt(e);
    let items = [];
    for (let k = 0; k < n; k++) {
      const a = (o.turn || 0) / DEG + k * TAU / n, L = o.alternate && k % 2 ? from + (len - from) * o.alternate : len, ca = Math.cos(a), sa = Math.sin(a);
      items = items.concat(lineItems(t => [ca * (from + (L - from) * t), sa * (from + (L - from) * t)], g, { step: o.step, col: c }, e));
      if (tip && !(o.alternate && k % 2)) items = items.concat(place(tip.items, { a: hooked(tip) ? 0 : a + Math.PI / 2, x: Math.cos(a) * (L + tip.r + 0.2), y: Math.sin(a) * (L + tip.r + 0.2) }));
    }
    return drawing(items); };
  // ---------------------------------------------------------------- lines and geometry
  // glyphs along a segment; `along`: turned to follow it (for strokes like ∣)
  function segment(x1, y1, x2, y2, g, step, along, col, s) {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(L / step)), a = Math.atan2(y2 - y1, x2 - x1), out = [];
    for (let k = 0; k <= n; k++) out.push({ tok: g, x: x1 + (x2 - x1) * k / n, y: y1 + (y2 - y1) * k / n, s: s || 1, rot: along ? a * DEG + 90 : 0, col });
    return out;
  }
  const line = (x1, y1, x2, y2, o) => e => { o = o || {}; return drawing(segment(x1, y1, x2, y2, o.glyph || "·", o.step || 0.8, !!o.along, colour(o.col) || colourAt(e), o.s)); };
  // polygon(n, r, {glyph, step, vertex, skip}): outline of a regular n-gon ({n/skip} star when skip > 1)
  const polygon = (n, r, o) => e => { o = o || {};
    const c = colour(o.col) || colourAt(e), sk = o.skip || 1, vs = Array.from({ length: n }, (_, k) => { const a = (o.turn || -90) / DEG + k * TAU / n; return [r * Math.cos(a), r * Math.sin(a)]; });
    let items = [];
    const edge = o.edge != null && typeof o.edge !== "string" ? run(o.edge, down(e)) : null;
    for (let k = 0; k < n; k++) { const [x1, y1] = vs[k], [x2, y2] = vs[(k + sk) % n];
      items = items.concat(edge ? layAlong(t => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], edge, {}) : segment(x1, y1, x2, y2, o.edge || o.glyph || "·", o.step || 0.8, false, c, o.s).slice(0, -1)); }
    if (o.vertex) { const vds = (Array.isArray(o.vertex) ? o.vertex : [o.vertex]).map(v => run(v, down(e)));
      vs.forEach(([x, y], k) => { const vd = vds[k % vds.length]; items = items.concat(place(vd.items, { a: hooked(vd) ? 0 : Math.atan2(y, x) + Math.PI / 2, x, y })); }); }
    return drawing(items); };
  // ---------------------------------------------------------------- plants
  // Plants are base-anchored (they start at the origin and grow toward −y). Stems are strokes: a
  // curve sampled by arc length, with overlapping strokes (∣) turned along it, tapering to the tip.
  const STEMC = "var(--accent-2, #5f8f4e)";
  // points along a curve P(t), t ∈ [0, 1], every `sp` glyphs of arc length: {x, y, a (tangent), f}
  function along(P, sp) {
    const N = 160, pts = [P(0)], acc = [0];
    for (let i = 1; i <= N; i++) { const q = P(i / N); acc.push(acc[i - 1] + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1])); pts.push(q); }
    const L = acc[N], out = [];
    if (L < 1e-6) return out;
    for (let d = 0, i = 1; d <= L + 1e-9; d += sp) {
      while (i < N && acc[i] < d) i++;
      const f0 = acc[i] - acc[i - 1] > 0 ? (d - acc[i - 1]) / (acc[i] - acc[i - 1]) : 0, p0 = pts[i - 1], p1 = pts[i];
      out.push({ x: p0[0] + (p1[0] - p0[0]) * f0, y: p0[1] + (p1[1] - p0[1]) * f0, a: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), f: d / L });
    }
    return out;
  }
  const strokeItems = (P, o) => along(P, o.sp || 0.34).map(q => ({ tok: o.glyph || "∣", x: q.x, y: q.y, s: (o.s0 || 0.75) + ((o.s1 || 0.5) - (o.s0 || 0.75)) * q.f, rot: q.a * DEG + 90, col: o.col, line: true }));
  // Any line can be made of things: laid along a path, each turned to follow it (its top pointing
  // along the path), spaced by its own size, tapered like a stroke. A string is a glyph stroke.
  function layAlong(P, d, o) {
    if (!d.items.length) return [];
    if (o.byRadius) {   // parts scaled by their distance from the centre, spaced to match
      const pts = along(P, 0.05), R0 = Math.max(...pts.map(q => Math.hypot(q.x, q.y))) || 1, gap = o.gap == null ? 0.12 : o.gap;
      let items = [], next = 0, dist = 0;
      for (let i = 0; i < pts.length; i++) {
        if (i) dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        const q = pts[i], k = Math.max(o.minK || 0.3, Math.hypot(q.x, q.y) / R0);
        if (dist + 1e-9 < next) continue;
        items = items.concat(place(d.items, { k, a: hooked(d) ? 0 : q.a + Math.PI / 2, x: q.x, y: q.y }));
        next = dist + (2 * Math.max(0.3, d.r) + gap) * k;
      }
      return items.map(it => Object.assign(it, { line: true }));
    }
    const sp = 2 * Math.max(0.3, d.r) + (o.gap == null ? 0.08 : o.gap), taper = o.taper == null ? 1 : o.taper;
    let items = [];
    for (const q of along(P, sp)) items = items.concat(place(d.items, { k: 1 - (1 - taper) * q.f, a: hooked(d) ? 0 : q.a + Math.PI / 2, x: q.x, y: q.y }));
    // a line of things counts as a line when decluttering: what sits on it wins
    return items.map(it => Object.assign(it, { line: true }));
  }
  // strokeOr(P, line, o, e): the stroke of a string glyph (default ∣), or a thing laid along P
  function strokeOr(P, ln, o, e) {
    if (ln == null || typeof ln === "string") return strokeItems(P, Object.assign({}, o, { glyph: ln || o.glyph }));
    return layAlong(P, run(ln, down(e)), { taper: (o.s1 || 0.5) / (o.s0 || 0.75), gap: o.gap });
  }
  // laid(path, thing, {gap, taper}): a thing laid along a path; paths: [x1, y1, x2, y2] (a segment),
  // a function t ↦ [x, y], or {arc: r, from: deg, to: deg}
  // a closed polyline as a path, parameterised by arc length
  function polyline(pts) {
    const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = acc[acc.length - 1];
    return t => { const d = t * L; let i = 1; while (i < pts.length - 1 && acc[i] < d) i++; const f = (d - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; };
  }
  // the Koch snowflake: depth d, circumradius r
  function kochPts(d, r) {
    let pts = [0, 1, 2, 0].map(k => [r * Math.cos(-Math.PI / 2 + k * TAU / 3), r * Math.sin(-Math.PI / 2 + k * TAU / 3)]);
    for (let q = 0; q < d; q++) { const nx = [pts[0]];
      for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], dx = (x1 - x0) / 3, dy = (y1 - y0) / 3;
        const a = [x0 + dx, y0 + dy], b = [x0 + 2 * dx, y0 + 2 * dy], c = [a[0] + dx * 0.5 + dy * Math.sqrt(3) / 2, a[1] + dy * 0.5 - dx * Math.sqrt(3) / 2];
        nx.push(a, c, b, [x1, y1]); }
      pts = nx; }
    return pts;
  }
  const pathOf = p => typeof p === "function" ? p : Array.isArray(p) ? (t => [p[0] + (p[2] - p[0]) * t, p[1] + (p[3] - p[1]) * t])
    : p && p.rose != null ? (t => { const th = t * (p.rose % 2 ? Math.PI : TAU), r = (p.r || 6) * Math.cos(p.rose * th); return [r * Math.cos(th), r * Math.sin(th)]; })
    : p && p.lissajous != null ? (t => { const [a, b] = p.lissajous, th = t * TAU; return [(p.r || 6) * Math.sin(a * th + (p.phase == null ? Math.PI / 2 : p.phase)), (p.r || 6) * Math.sin(b * th)]; })
    : p && p.logspiral != null ? (t => { const th = t * p.logspiral * TAU, r = (p.r || 6) * Math.exp(-(p.grow || 0.3) * th) ; return [r * Math.cos(th), r * Math.sin(th)]; })
    : p && p.koch != null ? polyline(kochPts(p.koch, p.r || 6))
    : p && p.spiral != null ? (t => { const th = t * p.spiral * TAU, r = (p.r || 6) * (1 - t * (1 - (p.inner || 0.12))); return [r * Math.cos(th), r * Math.sin(th)]; })
    : p && p.arc != null ? (t => { const a = ((p.from || 0) + ((p.to == null ? 360 : p.to) - (p.from || 0)) * t) / DEG; return [p.arc * Math.cos(a), p.arc * Math.sin(a)]; }) : (t => [0, -t]);
  const laid = (p, t, o) => e => { o = Object.assign({}, o); if (p && (p.spiral != null || p.logspiral != null) && o.scale !== false) o.byRadius = true;
    return drawing(layAlong(pathOf(p), run(t, down(e)), o)); };
  // a cubic Bézier with its derivative
  const cubic = (p0, p1, p2, p3) => t => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };
  const tangent = (P, t) => { const a = P(Math.max(0, t - 0.004)), b = P(Math.min(1, t + 0.004)); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  // stroke(len, {bend, s0, s1, glyph}): a bare stem
  const stroke = (len, o) => e => { o = o || {}; const b = o.bend || 0, P = cubic([0, 0], [b * len * 0.35, -len * 0.33], [b * len * 0.75, -len * 0.66], [b * len * 0.6, -len]);
    return drawing(strokeOr(P, o.stem, Object.assign({ col: colour(o.col) || STEMC }, o), e), { tip: { x: b * len * 0.6, y: -len, a: tangent(P, 1) + Math.PI / 2 } }); };
  // leaf(len, w, {col, veins, glyph}): an outlined leaf with a midrib, pointing up from its base
  const leaf = (len, w, o) => e => { o = o || {}; len = len || 1.8; w = w || len * 0.48;
    const c = colour(o.col) || STEMC, g = o.glyph || "∙", items = o.rib === null ? [] : strokeOr(t => [0, -len * 0.9 * t], o.rib, { sp: 0.3, s0: 0.5, s1: 0.32, col: c }, e);
    for (const side of [1, -1]) for (const q of along(t => [side * (w / 2) * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.9), -len * t], 0.3)) if (q.f > 0.02) items.push({ tok: g, x: q.x, y: q.y, s: 0.62, rot: 0, col: c });
    if (o.veins !== false && len >= 1.6) for (let k = 1; k <= Math.floor(len / 0.7); k++) { const t = k / (Math.floor(len / 0.7) + 1), y = -len * t * 0.9;
      for (const side of [1, -1]) items.push({ tok: g, x: side * w * 0.22 * Math.sin(Math.PI * t), y: y - 0.18, s: 0.45, rot: 0, col: c }); }
    return drawing(items, { tip: { x: 0, y: -len, a: 0 } }); };
  const defaultLeaf = k => leaf(1.7 * k, 0.8 * k);
  // stalk(len, head, {bend, leaves, leaf, leafSize, leafAngle, s0, s1, base, upright}): a curved stem
  // with `head` on it (centred heads sit on the tip with the stem running into them; base-anchored
  // ones, o.base, start there) and `leaves` alternating up it, shrinking toward the top
  const stalk = (len, head, o) => e => { o = o || {};
    const b = o.bend == null ? 0.18 : o.bend, sc = colour(o.col) || STEMC;
    const P = cubic([0, 0], [b * len * 0.35, -len * 0.33], [b * len * 0.75, -len * 0.66], [b * len * 0.6, -len]);
    let items = strokeOr(P, o.stem, { s0: o.s0 || 0.78, s1: o.s1 || 0.52, col: sc }, e);
    const nl = o.leaves || 0, la = (o.leafAngle || 48) / DEG, ls = o.leafSize || 1;
    for (let q = 0; q < nl; q++) {
      const t = 0.14 + 0.66 * (q + 0.5) / nl, [x, y] = P(t), side = q % 2 ? -1 : 1, k = ls * (1 - 0.35 * t);
      const l0 = Array.isArray(o.leaf) ? o.leaf[q % o.leaf.length] : o.leaf;
      const lf = l0 == null ? defaultLeaf(k) : typeof l0 === "string" ? tok(l0, { col: sc, s: k }) : size(k, l0);
      const ld = anchored(run(lf, down(e))), part = place(ld.items, { a: tangent(P, t) + Math.PI / 2 + side * la, x, y });
      items = items.concat(side < 0 ? part.map(it => Object.assign({}, it, { reflect: !it.reflect })) : part);
    }
    const [hx, hy] = P(1), ha = tangent(P, 1) + Math.PI / 2;
    if (head != null) { const hd = run(head, down(e)), off = o.base ? 0 : Math.min(hd.r * 0.35, 0.9);
      items = items.concat(place(hd.items, { a: o.upright ? 0 : ha, x: hx + Math.sin(ha) * off, y: hy - Math.cos(ha) * off })); }
    return drawing(items, { tip: { x: hx, y: hy, a: ha } }); };
  // phyllotaxis(n, thing, {c, grow}): n copies at the golden angle, radius √k — a sunflower's seeds
  // (t may be an array: the seeds cycle through its things, so the spirals alternate)
  const phyllotaxis = (n, t, o) => e => { o = o || {}; const c = o.c || 0.42, ga = Math.PI * (3 - Math.sqrt(5)); let items = [];
    const ds = (Array.isArray(t) ? t : [t]).map(x => run(x, down(e)));
    for (let k = 1; k <= n; k++) { const d = ds[k % ds.length], r = c * Math.sqrt(k), a = k * ga, sc = o.grow ? 0.6 + 0.5 * k / n : 1; items = items.concat(place(d.items, { k: sc, a: hooked(d) ? 0 : a + Math.PI / 2, x: r * Math.cos(a), y: r * Math.sin(a) })); }
    return drawing(items); };
  // sprig(n, leaf, tip): a short stem with n leaf pairs and a bud
  const sprig = (n, lf, tip) => stalk(1.2 + n * 0.9, tip || "•", { leaves: 2 * n, leaf: lf, bend: 0.15, leafSize: 0.7, s0: 0.55, s1: 0.42 });
  // ---------------------------------------------------------------- stems and leaves as parts
  // shoot(len, parts, {mode, every, angle, bend, stem, head}): a stem carrying parts (a thing or a
  // list, cycled) at nodes every `every` glyphs: alternate (one per node, sides alternating),
  // opposite (a pair per node), whorl (a ring of `n` per node) or spiral (one per node, turning at the
  // golden angle, seen side-on: its reach and side follow the turn). Parts are base-anchored.
  const shoot = (len, parts, o) => e => { o = Object.assign({ mode: "alternate", every: 1.3, angle: 55, bend: 0.12, n: 5 }, o || {});
    const b = o.bend, P = cubic([0, 0], [b * len * 0.35, -len * 0.33], [b * len * 0.75, -len * 0.66], [b * len * 0.6, -len]);
    let items = strokeOr(P, o.stem, { s0: 0.78, s1: 0.5, col: STEMC }, e);
    const list = Array.isArray(parts) ? parts : [parts], la = o.angle / DEG, ga = Math.PI * (3 - Math.sqrt(5));
    const nodes = Math.max(1, Math.floor((len - 0.8) / o.every));
    for (let q = 0; q < nodes; q++) {
      const t = (q + 0.6) / (nodes + 0.4), [x, y] = P(t), up = tangent(P, t) + Math.PI / 2, k = 1 - 0.4 * t;
      const pd = anchored(run(size(k, list[q % list.length]), down(e)));
      const put1 = (a, flip) => { const pl = place(pd.items, { a, x, y }); items = items.concat(flip ? pl.map(it => Object.assign({}, it, { reflect: !it.reflect })) : pl); };
      if (o.mode === "opposite") { put1(up + la); put1(up - la, true); }
      else if (o.mode === "whorl") { for (let j = 0; j < o.n; j++) put1(up + (j / (o.n - 1) - 0.5) * 2 * la * 1.3); }
      else if (o.mode === "spiral") { const th = q * ga, side = Math.sin(th) >= 0 ? 1 : -1, reach = 0.45 + 0.55 * Math.abs(Math.sin(th));
        const pl = place(place(pd.items, { k: reach }), { a: up + side * la, x, y }); items = items.concat(side < 0 ? pl.map(it => Object.assign({}, it, { reflect: !it.reflect })) : pl); }
      else { const side = q % 2 ? -1 : 1; put1(up + side * la, side < 0); }
    }
    if (o.head != null) { const [hx, hy] = P(1), hd = run(o.head, down(e)); items = items.concat(place(hd.items, { a: tangent(P, 1) + Math.PI / 2, x: hx, y: hy })); }
    const [tx, ty] = P(1);
    return drawing(items, { tip: { x: tx, y: ty, a: tangent(P, 1) + Math.PI / 2 } }); };
  // ---------------------------------------------------------------- recursion, symmetry, tracery, tilings
  // recurse(n, f, base): f applied n times, starting from base: recurse(3, x => burst(4, x), '⊗')
  const recurse = (n, f, base) => n <= 0 ? base : f(recurse(n - 1, f, base));
  // kaleido(n, t, {r}): n turns of t, every other one mirrored (an asymmetric thing becomes a snowflake)
  const kaleido = (n, t, o) => e => { o = o || {}; const d = anchored(run(t, down(e))); let items = [];
    for (let k = 0; k < 2 * n; k++) { const a = k * Math.PI / n, part = k % 2 ? d.items.map(it => Object.assign({}, it, { x: -it.x, rot: -(it.rot || 0), reflect: !it.reflect })) : d.items;
      items = items.concat(place(part, { a, x: (o.r || 0) * Math.sin(a), y: -(o.r || 0) * Math.cos(a) })); }
    return drawing(items); };
  // lattice(cols, rows, t, {dx, dy, hex}): a tiling of things, centred
  const lattice = (cols, rows, t, o) => e => { o = o || {}; const ts = Array.isArray(t) ? t : [t], ds = ts.map(x => run(x, down(e))), mr = Math.max(...ds.map(d => d.r));
    const dx = o.dx || 2 * mr + 0.3, dy = o.dy || (o.hex ? dx * Math.sqrt(3) / 2 : dx); let items = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const d = ds[(i + j) % ds.length];
      items = items.concat(place(d.items, { x: (i - (cols - 1) / 2 + (o.hex && j % 2 ? 0.5 : 0)) * dx, y: (j - (rows - 1) / 2) * dy })); }
    return drawing(items); };
  // hat(r, {edge, vertex, flip}): the "hat", an aperiodic monotile (Smith, Myers, Kaplan and
  // Goodman-Strauss, 2023): a 13-sided polykite, eight kites of the hexagonal grid, that tiles the plane
  // but never periodically. Its outline (after Kaplan's hatviz), `r` glyphs across its widest.
  const HAT = [[0, 0], [-1, -1], [0, -2], [2, -2], [2, -1], [4, -2], [5, -1], [4, 0], [3, 0], [2, 2], [0, 3], [0, 2], [-1, 2]]
    .map(([x, y]) => [x + 0.5 * y, 0.8660254037844386 * y]);
  const hat = (r, o) => e => { o = Object.assign({ edge: pad(0.05, "·") }, o || {});
    const xs = HAT.map(p => p[0]), ys = HAT.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const k = (r || 12) / (Math.max(...xs) - Math.min(...xs)), V = HAT.map(([x, y]) => [(o.flip ? -1 : 1) * (x - cx) * k, (y - cy) * k]);
    const ed = typeof o.edge === "string" ? null : run(o.edge, down(e)), c = colourAt(e);
    let items = [];
    for (let i = 0; i < V.length; i++) { const [x1, y1] = V[i], [x2, y2] = V[(i + 1) % V.length];
      items = items.concat(ed ? layAlong(t => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], ed, {}) : segment(x1, y1, x2, y2, o.edge, 0.8, false, c).slice(0, -1)); }
    if (o.vertex) { const vds = (Array.isArray(o.vertex) ? o.vertex : [o.vertex]).map(v => run(v, down(e))); V.forEach(([x, y], i) => { items = items.concat(place(vds[i % vds.length].items, { x, y })); }); }
    return drawing(items); };

  // hats(level, {unit, edge, colours}): a patch of the aperiodic hat tiling, grown by the substitution system
  // of Smith, Myers, Kaplan and Goodman-Strauss (four metatiles H, T, P, F), after Kaplan's hatviz. Every
  // hat's outline is drawn with `edge`, coloured by kind if `colours` says: {H, H1, T, P, F} (H1 is the
  // reflected hat). `unit`: glyphs per kite edge.
  const HAT_TILING = (() => {
    const hr3 = 0.8660254037844386, pt = (x, y) => ({ x, y }), hexPt = (x, y) => pt(x + 0.5 * y, hr3 * y);
    const mul = (A, B) => [A[0] * B[0] + A[1] * B[3], A[0] * B[1] + A[1] * B[4], A[0] * B[2] + A[1] * B[5] + A[2], A[3] * B[0] + A[4] * B[3], A[3] * B[1] + A[4] * B[4], A[3] * B[2] + A[4] * B[5] + A[5]];
    const inv = T => { const d = T[0] * T[4] - T[1] * T[3]; return [T[4] / d, -T[1] / d, (T[1] * T[5] - T[2] * T[4]) / d, -T[3] / d, T[0] / d, (T[2] * T[3] - T[0] * T[5]) / d]; };
    const trot = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0], ttrans = (x, y) => [1, 0, x, 0, 1, y];
    const rotAbout = (p, a) => mul(ttrans(p.x, p.y), mul(trot(a), ttrans(-p.x, -p.y)));
    const tp = (M, P) => pt(M[0] * P.x + M[1] * P.y + M[2], M[3] * P.x + M[4] * P.y + M[5]);
    const add = (p, q) => pt(p.x + q.x, p.y + q.y), sub = (p, q) => pt(p.x - q.x, p.y - q.y);
    const matchSeg = (p, q) => [q.x - p.x, p.y - q.y, p.x, q.y - p.y, q.x - p.x, p.y];
    const matchTwo = (p1, q1, p2, q2) => mul(matchSeg(p2, q2), inv(matchSeg(p1, q1)));
    const intersect = (p1, q1, p2, q2) => { const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y), uA = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d; return pt(p1.x + uA * (q1.x - p1.x), p1.y + uA * (q1.y - p1.y)); };
    const hatO = [[0, 0], [-1, -1], [0, -2], [2, -2], [2, -1], [4, -2], [5, -1], [4, 0], [3, 0], [2, 2], [0, 3], [0, 2], [-1, 2]].map(([x, y]) => hexPt(x, y));
    const Hat = label => ({ label, hat: true });
    class Meta {
      constructor(shape, width) { this.shape = shape; this.width = width; this.children = []; }
      add(T, geom) { this.children.push({ T, geom }); }
      ev(n, i) { return tp(this.children[n].T, this.children[n].geom.shape[i]); }
      recentre() { let cx = 0, cy = 0; for (const p of this.shape) { cx += p.x; cy += p.y; } cx /= this.shape.length; cy /= this.shape.length;
        this.shape = this.shape.map(p => pt(p.x - cx, p.y - cy)); const M = ttrans(-cx, -cy); for (const ch of this.children) ch.T = mul(M, ch.T); }
    }
    const H1h = Hat("H1"), Hh = Hat("H"), Th = Hat("T"), Ph = Hat("P"), Fh = Hat("F");
    const initH = () => { const o = [pt(0, 0), pt(4, 0), pt(4.5, hr3), pt(2.5, 5 * hr3), pt(1.5, 5 * hr3), pt(-0.5, hr3)], m = new Meta(o, 2);
      m.add(matchTwo(hatO[5], hatO[7], o[5], o[0]), Hh); m.add(matchTwo(hatO[9], hatO[11], o[1], o[2]), Hh); m.add(matchTwo(hatO[5], hatO[7], o[3], o[4]), Hh);
      m.add(mul(ttrans(2.5, hr3), mul([-0.5, -hr3, 0, hr3, -0.5, 0], [0.5, 0, 0, 0, -0.5, 0])), H1h); return m; };
    const initT = () => { const m = new Meta([pt(0, 0), pt(3, 0), pt(1.5, 3 * hr3)], 2); m.add([0.5, 0, 0.5, 0, 0.5, hr3], Th); return m; };
    const initP = () => { const m = new Meta([pt(0, 0), pt(4, 0), pt(3, 2 * hr3), pt(-1, 2 * hr3)], 2);
      m.add([0.5, 0, 1.5, 0, 0.5, hr3], Ph); m.add(mul(ttrans(0, 2 * hr3), mul([0.5, hr3, 0, -hr3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), Ph); return m; };
    const initF = () => { const m = new Meta([pt(0, 0), pt(3, 0), pt(3.5, hr3), pt(3, 2 * hr3), pt(-1, 2 * hr3)], 2);
      m.add([0.5, 0, 1.5, 0, 0.5, hr3], Fh); m.add(mul(ttrans(0, 2 * hr3), mul([0.5, hr3, 0, -hr3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), Fh); return m; };
    const RULES = [["H"], [0, 0, "P", 2], [1, 0, "H", 2], [2, 0, "P", 2], [3, 0, "H", 2], [4, 4, "P", 2], [0, 4, "F", 3], [2, 4, "F", 3], [4, 1, 3, 2, "F", 0],
      [8, 3, "H", 0], [9, 2, "P", 0], [10, 2, "H", 0], [11, 4, "P", 2], [12, 0, "H", 2], [13, 0, "F", 3], [14, 2, "F", 1], [15, 3, "H", 4], [8, 2, "F", 1],
      [17, 3, "H", 0], [18, 2, "P", 0], [19, 2, "H", 2], [20, 4, "F", 3], [20, 0, "P", 2], [22, 0, "H", 2], [23, 4, "F", 3], [23, 0, "F", 3], [16, 0, "P", 2],
      [9, 4, 0, 2, "T", 2], [4, 0, "F", 3]];
    const patch = (H, T, P, F) => { const ret = new Meta([], H.width), sh = { H, T, P, F };
      for (const r of RULES) {
        if (r.length === 1) ret.add([1, 0, 0, 0, 1, 0], sh[r[0]]);
        else if (r.length === 4) { const ch = ret.children[r[0]], poly = ch.geom.shape, P1 = tp(ch.T, poly[(r[1] + 1) % poly.length]), Q1 = tp(ch.T, poly[r[1]]), n = sh[r[2]], np = n.shape;
          ret.add(matchTwo(np[r[3]], np[(r[3] + 1) % np.length], P1, Q1), n); }
        else { const cP = ret.children[r[0]], cQ = ret.children[r[2]], P1 = tp(cQ.T, cQ.geom.shape[r[3]]), Q1 = tp(cP.T, cP.geom.shape[r[1]]), n = sh[r[4]], np = n.shape;
          ret.add(matchTwo(np[r[5]], np[(r[5] + 1) % np.length], P1, Q1), n); }
      }
      return ret; };
    const metas = pc => {
      const b1 = pc.ev(8, 2), b2 = pc.ev(21, 2), rb = tp(rotAbout(b1, -2 * Math.PI / 3), b2), p72 = pc.ev(7, 2), p252 = pc.ev(25, 2);
      const llc = intersect(b1, rb, pc.ev(6, 2), p72); let w = sub(pc.ev(6, 2), llc);
      const Ho = [llc, b1]; w = tp(trot(-Math.PI / 3), w); Ho.push(add(Ho[1], w)); Ho.push(pc.ev(14, 2)); w = tp(trot(-Math.PI / 3), w); Ho.push(sub(Ho[3], w)); Ho.push(pc.ev(6, 2));
      const nH = new Meta(Ho, pc.width * 2); for (const c of [0, 9, 16, 27, 26, 6, 1, 8, 10, 15]) nH.add(pc.children[c].T, pc.children[c].geom);
      const nP = new Meta([p72, add(p72, sub(b1, llc)), b1, llc], pc.width * 2); for (const c of [7, 2, 3, 4, 28]) nP.add(pc.children[c].T, pc.children[c].geom);
      const nF = new Meta([b2, pc.ev(24, 2), pc.ev(25, 0), p252, add(p252, sub(llc, b1))], pc.width * 2); for (const c of [21, 20, 22, 23, 24, 25]) nF.add(pc.children[c].T, pc.children[c].geom);
      const A = Ho[2], B = add(Ho[1], sub(Ho[4], Ho[5])), C = tp(rotAbout(B, -Math.PI / 3), A);
      const nT = new Meta([B, C, A], pc.width * 2); nT.add(pc.children[11].T, pc.children[11].geom);
      for (const m of [nH, nP, nF, nT]) m.recentre();
      return [nH, nT, nP, nF];
    };
    const cache = {};
    // the hats of the level-n H metatile: [{label, pts: [[x, y] …]}]
    return level => {
      if (cache[level]) return cache[level];
      let tiles = [initH(), initT(), initP(), initF()];
      for (let i = 0; i < level; i++) tiles = metas(patch(...tiles));
      const out = [], walk = (g, M) => { if (g.hat) { out.push({ label: g.label, pts: hatO.map(p => { const q = tp(M, p); return [q.x, q.y]; }) }); return; } for (const ch of g.children) walk(ch.geom, mul(M, ch.T)); };
      walk(tiles[0], [1, 0, 0, 0, 1, 0]);
      return (cache[level] = out);
    };
  })();
  const hats = (level, o) => e => { o = Object.assign({ unit: 1.1, edge: "∣" }, o || {});
    const H = HAT_TILING(level || 1), u = o.unit, c = colourAt(e);
    const ed = typeof o.edge === "string" ? null : run(o.edge, down(e));
    let items = [];
    for (const h of H) {
      const P = h.pts.map(([x, y]) => [x * u, -y * u]), col = o.colours && o.colours[h.label] ? colour(o.colours[h.label]) : c;
      for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
        // a glyph edge is a continuous stroke along the side (∣ turned to follow it); a thing is laid along it
        items = items.concat(ed ? layAlong(t => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], ed, { gap: 0.15 }) : strokeItems(t => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], { glyph: o.edge, sp: 0.36, s0: 0.62, s1: 0.62, col })); }
    }
    return drawing(items); };

  // ---------------------------------------------------------------- the catalog
  // The shape kinds the margins and the divider draw, written as combinators. Each is a function
  // of the room it has (radius R, in glyphs) and options (quad: counts a multiple of four, for the
  // half shapes; of: the kind of a composite's parts), returning a thing.
  const BLOOM = ["✿", "❀", "⊕", "⊗", "✦"], PETAL = ["∀", "Π", "π", "λ", "α", "σ", "∧", "∨", "⊤", "⊥", "+", "×"], LEAF = ["❧", "❦", "λ", "α", "β", "η"], FILLER = ["•", "·", "⋆", "∘", "✧", "+", "×"];
  const one = xs => choose(...xs);
  const q4 = n => Math.max(4, Math.round(n / 4) * 4);
  const count = (rad, step, o, min) => { const n = Math.max(min || 5, Math.floor(TAU * rad / step)); return o.quad ? q4(n) : n === 4 ? 5 : n; };
  const ringAt = (rad, n, t, o) => ring(n, t, Object.assign({ r: rad }, o));
  const KINDS = {
    rosette: (R, o) => over(size(1.3, one(BLOOM)), anyColour(ringAt(R - 0.55, count(R - 0.55, 1.2, o), one(PETAL)))),
    double: (R, o) => R - 0.55 - 1.15 >= 1.45
      ? over(size(1.2, one(BLOOM)), anyColour(ringAt(R - 0.55, count(R - 0.55, 1.2, o), one(PETAL))), anyColour(ringAt(Math.max(1.45, (R - 0.55) / 2), count(Math.max(1.45, (R - 0.55) / 2), 1.2, o), one(FILLER), { offset: true, upright: true })))
      : KINDS.rosette(R, o),
    alternating: (R, o) => { const n = count(R - 0.55, 1.2, o, 6); return over(size(1.3, one(BLOOM)), e => alt(n + (n % 2), anyColour(one(PETAL)), anyColour(tok(BLOOM[Math.floor(e.rng() * BLOOM.length)], { upright: true })))(e)); },
    leafy: (R, o) => over(size(1.2, one(BLOOM)), tint("green", ringAt(R - 0.55, count(R - 0.55, 1.2, o), one(LEAF))), ...(R - 0.55 - 1.15 >= 1.45 ? [anyColour(ringAt(Math.max(1.45, (R - 0.55) * 0.52), count(Math.max(1.45, (R - 0.55) * 0.52), 1.2, o), one(PETAL), { offset: true }))] : [])),
    layered: (R, o) => { const outer = R - 0.55, n = Math.max(1, Math.min(4, Math.floor(outer / 1.2))), specs = [];
      for (let q = 0; q < n; q++) { const rad = outer - q * 1.2; if (rad < 1.45) break; specs.push(anyColour(ringAt(rad, count(rad, 1.2, o), one(q % 2 ? FILLER : PETAL), { offset: q % 2 === 1, upright: q % 2 === 1 }))); }
      return over(size(1.25, one(BLOOM)), ...specs); },
    star: (R, o) => e => { const k = o.quad ? [4, 8, 8][Math.floor(e.rng() * 3)] : [5, 7, 5, 7, 6, 8][Math.floor(e.rng() * 6)];
      return over(size(1.3, one(BLOOM)), anyColour(rays(k, R - 1.5, { from: 1.45, glyph: one(FILLER)(e).items[0].tok, tip: one(["∧", "✦", "⋆", "∀"]) })))(e); },
    // two rings of strokes, the inner one turned half a step: long and short rays
    sunburst: (R, o) => { const n0 = Math.max(8, Math.floor(TAU * R * 0.7 / 0.95)), n = (o.quad ? q4(n0) : n0 + (n0 % 2)) / 2;
      return over(size(1.3, one(["⋆", "✿", "⊕", "✦"])), anyColour(over(ringAt(R - 0.5, n, "∣"), ringAt(R * 0.55, n, "∣", { offset: true })))); },
    snowflake: (R, o) => over(size(1.2, one(["✦", "⊗", "⋆"])), anyColour(rays(o.quad ? 8 : 6, R - 0.5, { from: 1.45, tip: "∗" }))),
    snowflake4: (R, o) => over(size(1.2, one(["✦", "⊗", "⋆", "✿"])), anyColour(burst(o.quad ? 8 : 6, sprig(1, one(["λ", "∨", "β"]), one(["∗", "✦", "⋆"])), { ray: "∣", r: Math.max(1.6, R - 1.4) }))),
    orbit: (R, o) => e => { const rs = R >= 4.5 ? 1.25 : 0.62, ro = R - rs, room = Math.floor(TAU * ro / (2 * rs * 1.1)), ks = (o.quad ? [4, 8, 12] : [5, 6, 7, 8, 9, 10, 12]).filter(k => k <= room);
      if (!ks.length || rs * 2.2 >= R) return KINDS.rosette(R, o)(e);
      const k = ks[Math.floor(ks.length * (0.5 + 0.5 * e.rng()))] || ks[ks.length - 1];
      const motif = rs > 1 ? over(shift(0, -0.55, one(BLOOM)), shift(-0.5, 0.45, tint("green", size(0.85, one(LEAF)))), shift(0.5, 0.45, tint("green", mirror(size(0.85, one(LEAF)))))) : one(BLOOM);
      const inner = ro - rs - 0.27;
      return over(anyColour(ringAt(ro, k, motif, o)), inner >= 1.75 ? KINDS[["rosette", "layered", "alternating"][Math.floor(e.rng() * 3)]](inner, o) : size(1.2, one(BLOOM)))(e); },
    doubled: (R, o) => e => { const k = o.quad ? [4, 6, 8][Math.floor(e.rng() * 3)] : [5, 6, 7, 8][Math.floor(e.rng() * 4)];
      return over(size(1.3, one(BLOOM)), anyColour(rays(2 * k, R - 0.5, { from: 1.45, tip: one(["∧", "✦", "∀"]), alternate: 0.55 })))(e); },
    wheel: (R, o) => { const rad = R - 0.6, n = o.quad ? (rad > 2.5 ? 8 : 4) : Math.max(5, Math.min(8, Math.floor(TAU * rad / 2.2)));
      return over(size(1.2, one(BLOOM)), anyColour(ringAt(rad * 0.8, n, sprig(1, one(LEAF), one(BLOOM))))); },
    starburst: (R, o) => { const inner = Math.max(1.45, Math.min(R * 0.42, 2.05)), n = o.quad ? q4(Math.max(8, Math.floor(TAU * R * 0.8))) : Math.max(8, Math.floor(TAU * R * 0.8)) & ~1;
      return over(size(1.3, one(BLOOM)), anyColour(ringAt(inner, count(inner, 1.2, o), one(PETAL))), anyColour(rays(n, R - 0.5, { from: inner + 0.9, alternate: 0.5, tip: one(["✦", "✿", "⋆", "⊕"]) }))); },
    compass: (R, o) => { const L1 = R - 0.5; return over(size(1.3, one(["✦", "⊕", "✿", "⋆"])), anyColour(rays(4, L1 - 0.5, { from: 1.45, tip: "∧" })),
      anyColour(rays(4, 1.45 + (L1 - 1.45) * 0.62, { from: 1.45, tip: "⋆", turn: 45 })), ...(L1 > 2.6 ? [anyColour(rays(8, 1.45 + (L1 - 1.45) * 0.32, { from: 1.45, tip: "·", turn: 22.5 }))] : [])); },
    mandala: (R, o) => { const outer = R - 0.5, plan = [PETAL, FILLER, BLOOM, PETAL], specs = []; let rad = 1.45, q = 0;
      for (; rad <= outer - 1.05 && q < plan.length; rad += 1.2, q++) specs.push(anyColour(ringAt(rad, count(rad, 1.2, o), one(plan[q]), { offset: q % 2 === 1, upright: plan[q] !== PETAL })));
      if (rad <= outer + 0.2) specs.push(anyColour(ringAt(Math.min(rad, outer), count(Math.min(rad, outer), 1.2, o), "∣")));
      return over(size(1.25, one(BLOOM)), ...specs); },
    corona: (R, o) => { const rs = Math.max(1.3, Math.min(2.0, R * 0.3)), ro = R - rs - 0.2, k0 = Math.min(10, Math.floor(TAU * ro / (2 * rs * 1.05))), k = o.quad ? Math.floor(k0 / 4) * 4 : k0;
      if (k < (o.quad ? 4 : 5)) return KINDS.starburst(R, o);
      const inner = ro - rs - 0.35;
      return over(ringAt(ro, k, KINDS.sunburst(rs, {})), inner >= 2 ? KINDS.starburst(inner, o) : size(1.25, one(BLOOM))); },
    nested: (R, o) => e => { const rs = Math.max(1.45, Math.min(2.4, R * 0.34)), ro = R - rs - 0.15, k0 = Math.min(9, Math.floor(TAU * ro / (2 * rs * 1.08))), k = o.quad ? Math.floor(k0 / 4) * 4 : k0;
      if (k < (o.quad ? 4 : 5)) return KINDS.orbit(R, o)(e);
      const kind = ["rosette", "star", "doubled", "alternating", "sunburst"][Math.floor(e.rng() * 5)], inner = ro - rs - 0.27;
      return over(ringAt(ro, k, KINDS[kind](rs, {})), inner >= 2 ? KINDS[["layered", "rosette", "doubled"][Math.floor(e.rng() * 3)]](inner, o) : size(1.25, one(BLOOM)))(e); },
    halo: (R, o) => over(e => drawing(run(KINDS.orbit(R, o), e).items.filter(g => Math.hypot(g.x, g.y) > R * 0.62)), KINDS.layered(Math.max(1.5, R * 0.55), o)),
    // composites: any kind made of any other (parts drawn finer, at 72% glyph size)
    burst: (R, o) => e => { const kind = o.of && KINDS[o.of] ? o.of : PARTS[Math.floor(e.rng() * PARTS.length)];
      const rc = Math.max(1.2, R * 0.3), s1 = Math.max(1.15, R * 0.2), d1 = rc + 0.27 + s1;
      if (d1 + s1 > R) return KINDS.starburst(R, o)(e);
      const n = o.quad ? 8 : [5, 6, 7, 8][Math.floor(e.rng() * 4)], s2 = s1 * 0.62, d2 = d1 + s1 + s2 + 0.1;
      const part = r => size(0.72, KINDS[kind](r / 0.72, {}));
      const far = d2 + s2 <= R ? ring(n, part(s2), { r: d2 }) : 0;
      return over(burst(n, part(s1), { r: d1, centre: part(rc), ray: null }), far)(e); },
    circlet: (R, o) => e => { const kind = o.of && KINDS[o.of] ? o.of : PARTS[Math.floor(e.rng() * PARTS.length)];
      const rs = Math.max(1.2, Math.min(R * 0.36, 3.2)), ro = R - rs - 0.14, k0 = Math.min(12, Math.floor(TAU * ro / (2 * rs * 1.05))), k = o.quad ? Math.floor(k0 / 4) * 4 : k0;
      if (k < (o.quad ? 4 : 5)) return KINDS.starburst(R, o)(e);
      const part = r => size(0.72, KINDS[kind](r / 0.72, {})), inner = ro - rs - 0.27;
      return over(ringAt(ro, k, part(rs)), inner >= 1.85 ? part(inner) : size(1.25, one(BLOOM)))(e); },
  };
  for (const k of ["radial", "jewel", "medallion", "rays", "stars", "flower", "snowflake", "wallpaper", "wreath", "frame", "pinwheel", "nest", "hats", "rays4", "rays8", "nest4", "nest8", "hub", "gflower", "gburst", "gstar", "gsnow", "gfleur", "gtree"]) KINDS[k] = (R, o) => KINDS.rosette(R, o);   // (drawn by shape(), below)
  const BUDGET = 220;
  for (const name of ["burst", "circlet"]) { const make = KINDS[name];
    KINDS[name] = (R, o) => e => { const d = run(make(R, o), e); return d.items.length > BUDGET && o.of !== "rosette" ? run(make(R, Object.assign({}, o, { of: "rosette" })), e) : d; }; }
  const PARTS = ["rosette", "double", "layered", "alternating", "leafy", "star", "sunburst", "doubled", "wheel", "snowflake4", "starburst", "compass", "mandala", "corona", "orbit"];
  // The primitives, documented: [group, name, signature, what it does, an example]. The primitives tree and the
  // playground's reference are drawn from this list.
  const DOCS = [
    ["Glyphs and transforms", "tok", "tok(g, {s, col, rot})", "One glyph. A bare string 'g' means the same.", "over(tok('⊗', {s: 2}), ring(8, 'λ'))"],
    ["Glyphs and transforms", "over", "over(a, b, …)", "Things superposed, sharing their origin.", "over('⊕', ring(6, 'α'), ring(12, '·', {r: 3}))"],
    ["Glyphs and transforms", "tint", "tint(colour, t)", "Colours a subtree: accent, gold, green, blue, violet, ink, muted, or any CSS colour.", "over(tint('accent', '⊗'), tint('gold', ring(8, '+')))"],
    ["Glyphs and transforms", "anyColour", "anyColour(t)", "One random palette colour for the whole subtree.", "alt(8, anyColour('⊗'), anyColour('α'))"],
    ["Glyphs and transforms", "size", "size(k, t)", "Scales positions and glyphs.", "over(size(2, '⊗'), ring(10, size(0.6, 'λ')))"],
    ["Glyphs and transforms", "turn", "turn(deg, t)", "Rotates.", "over(ring(5, 'λ'), turn(36, ring(5, 'α', {r: 2.6})))"],
    ["Glyphs and transforms", "shift", "shift(x, y, t)", "Moves.", "over('⊗', shift(3, 0, '⊕'), shift(-3, 0, '⊕'))"],
    ["Glyphs and transforms", "mirror", "mirror(t)", "Reflects left–right.", "over(shift(-1, 0, stroke(7, {bend: 0.6, stem: pad(0.05, 'λ')})), shift(1, 0, mirror(stroke(7, {bend: 0.6, stem: pad(0.05, 'λ')}))))"],
    ["Glyphs and transforms", "upright", "upright(t)", "Keeps glyphs unturned wherever t is placed.", "over(ring(8, 'λ'), ring(8, upright('λ'), {r: 3.4}))"],
    ["Glyphs and transforms", "choose", "choose(a, b, …)", "One of them at random, each time it is drawn.", "phyllotaxis(55, choose('⊗', '⊕', 'λ'), {c: 0.7})"],
    ["Glyphs and transforms", "pad", "pad(r, t)", "t with extra room round it: spacing in rings and chains.", "over(ring(8, 'λ'), ring(8, pad(0.8, '⊗'), {r: 0.1, min: 3.5}))"],
    ["Radial", "ring", "ring(n, t or [t, …], {r, min, gap, offset, upright, cols})", "n copies round a circle, each turned outward, fitted so neighbours don't touch. A list cycles.", "over('⊗', ring(10, 'λ'))"],
    ["Radial", "alt", "alt(n, a, b, …)", "A ring of n slots cycling through things.", "alt(12, '⊕', 'λ', '×')"],
    ["Radial", "burst", "burst(n, t or [t, …], {centre, len, r, ray}) or burst([t₁, …, tₙ])", "Rays from a centre with a thing at each end. The ray is a glyph, a thing, or null.", "burst(6, over('⊕', ring(4, 'α')), {centre: '⊗', ray: pad(0.05, '↑'), len: 2.5})"],
    ["Radial", "rays", "rays(n, len, {line, tip, from, alternate})", "Lines outward, a glyph or a thing, alternate ones shorter, with a thing at each tip.", "rays(12, 5, {line: pad(0.05, '·'), tip: '⊗', alternate: 0.5})"],
    ["Radial", "phyllotaxis", "phyllotaxis(n, t or [t, …], {c, grow})", "n copies at the golden angle, at radius √k: a sunflower's seeds.", "phyllotaxis(89, ['⊗', '⊕'], {c: 0.6, grow: true})"],
    ["Lines and paths", "laid", "laid(path, t, {gap, scale})", "A thing laid along a path, turned to follow it. Paths: [x₁, y₁, x₂, y₂], {arc: r, from, to}, {spiral: turns, r}, {rose: k, r}, {lissajous: [a, b], r}, {logspiral: turns, r, grow}, {koch: depth, r}, or a function.", "laid({rose: 5, r: 8}, pad(0.05, 'λ'))"],
    ["Lines and paths", "line", "line(x₁, y₁, x₂, y₂, {glyph, step, along})", "Glyphs along a segment.", "over(line(-5, 0, 5, 0, {glyph: '+'}), line(0, -5, 0, 5, {glyph: '×'}))"],
    ["Lines and paths", "polygon", "polygon(n, r, {edge, vertex, skip})", "A regular n-gon. The edge is a glyph or a thing; vertices can be things (a list cycles).", "polygon(6, 6, {edge: pad(0.05, '↑'), vertex: '⊗'})"],
    ["Stems", "stroke", "stroke(len, {bend, stem})", "A bare curved stem; the stem is a glyph or a thing.", "stroke(8, {bend: 0.4, stem: pad(0.05, 'λ')})"],
    ["Stems", "shoot", "shoot(len, parts or [parts, …], {mode, every, angle, head, stem})", "A stem carrying parts: alternate, opposite, in whorls, or spirally.", "shoot(9, 'λ', {mode: 'opposite', head: '⊗', stem: pad(0.05, '↑')})"],
    ["Recursion, symmetry and tiling", "recurse", "recurse(n, f, base)", "f applied n times to its own result.", "recurse(3, x => burst(4, x, {len: 1}), '⊗')"],
    ["Recursion, symmetry and tiling", "kaleido", "kaleido(n, t, {r})", "n turns of t, every other one mirrored.", "kaleido(6, stroke(6, {bend: 0.6, stem: pad(0.05, 'λ')}))"],
    ["Recursion, symmetry and tiling", "lattice", "lattice(cols, rows, t or [t, …], {dx, dy, hex})", "A tiling of things, square or hexagonal.", "lattice(5, 4, ['⊗', '⊕', 'α'], {hex: true, dx: 2})"],
    ["Recursion, symmetry and tiling", "hat", "hat(r, {edge, vertex, flip})", "The hat, an aperiodic monotile.", "hat(14, {edge: pad(0.05, '↑'), vertex: '⊗'})"],
    ["Recursion, symmetry and tiling", "hats", "hats(level, {unit, edge, colours: {H, H1, T, P, F}})", "A patch of the aperiodic hat tiling, outlines coloured by kind (H1: the reflected hats).", "hats(1, {unit: 1.4, colours: {H1: 'accent'}})"],
    ["Layout", "sparse", "sparse(t, gap)", "Removes overlapping glyphs.", "sparse(over(ring(12, 'λ'), ring(12, 'α')))"],
    ["Layout", "grid", "grid(t, cw, ch)", "Every glyph in a character cell, unturned, as text in an editor.", "grid(phyllotaxis(89, ['⊗', '⊕'], {c: 0.6}))"],
  ];
  // shape(kind, R, rng, palette, half, of): the items of a catalog shape (Ornament.shape's contract)
  // kinds drawn by the generators of theme/glyphgen.js (glyph art, set in the mono font it is measured in);
  // a half is cut along a mirror line, so those use an even order of symmetry
  const GENERATED = {
    // the grammar's structures (theme/glyphgen.js grow): each grows to fill the disc it is given
    gflower: (seed, half, R) => global.GlyphGen.grow(seed, "flower", { maxR: R }),
    gburst: (seed, half, R) => global.GlyphGen.grow(seed, "burst", { maxR: R }),
    gstar: (seed, half, R) => global.GlyphGen.grow(seed, "star", { maxR: R }),
    gsnow: (seed, half, R) => global.GlyphGen.grow(seed, "snowflake", { maxR: R }),
    gfleur: (seed, half, R) => global.GlyphGen.grow(seed, "fleur", { maxR: R }),
    gtree: (seed, half, R) => global.GlyphGen.grow(seed, "tree", { maxR: R }),
    // for the dividers: starbursts of order 4 or 8 only, alone or nested (and, of order 1, a single glyph)
    rays4: (seed, half, R) => global.GlyphGen.starburst(seed, { order: 4, even: true, maxR: R }),
    rays8: (seed, half, R) => global.GlyphGen.starburst(seed, { order: 8, even: true, maxR: R }),
    nest4: (seed, half, R) => global.GlyphGen.nest(seed, { order: 4, even: true, core: "starburst", maxR: R * 1.05 }),
    nest8: (seed, half, R) => global.GlyphGen.nest(seed, { order: 8, even: true, core: "starburst", maxR: R * 1.05 }),
    hub: (seed, half, R) => global.GlyphArt.glyph(global.GlyphGen.SYM.hub[seed % global.GlyphGen.SYM.hub.length], Math.max(1.3, Math.min(2.2, R * 0.9))),
    // (n: the order of symmetry, chosen by fitted() below, so what wraps the shape keeps it)
    nest: (seed, half, R, n) => global.GlyphGen.nest(seed, { order: n, even: half, maxR: R, budget: 420 }),   // grown ring by ring to fill its hole (a gasket)
    hats: (seed, half, R) => global.GlyphGen.hatdisc(seed, R),
    wallpaper: (seed, half, R) => R < 7 ? global.GlyphGen.star(seed, { even: half }) : global.GlyphGen.wallpaper(seed, { rings: 1.6 }),
    wreath: (seed, half, R, n) => R < 5 ? global.GlyphGen.pinwheel(seed, { order: n }) : global.GlyphGen.wreath(seed, { n: 2 * n > 16 ? n : 2 * n }),
    frame: (seed, half, R, n) => R < 6 ? global.GlyphGen.pinwheel(seed, { order: n }) : global.GlyphGen.frame(seed, { n: n > 7 ? [5, 6, 7][n % 3] : n }),
    pinwheel: (seed, half, R, n) => half ? global.GlyphGen.starburst(seed, { order: n, even: true }) : global.GlyphGen.pinwheel(seed, { order: n }),
    // (a starburst's order: 5 to 9 rays, never so many they crowd)
    rays: (seed, half, R, n) => global.GlyphGen.starburst(seed, { order: n, even: half, maxR: R }),
    stars: (seed, half, R, n) => global.GlyphGen.star(seed, { order: n, even: half }),
    flower: (seed, half, R, n) => global.GlyphGen.cflower(seed, { n, maxR: R }),
    snowflake: (seed, half, R, n) => global.GlyphGen.snowflake(seed, { n, maxR: R }),
    jewel: (seed, half, R, n) => global.GlyphGen.srosette(seed, { order: n, fill: true, even: half, budget: Math.min(90, Math.round(3 * R * R + 10)), maxR: R, rings: 3 }),
    radial: (seed, half, R, n) => global.GlyphGen.srosette(seed, { order: n, fill: true, even: half, budget: Math.min(90, Math.round(3 * R * R + 10)), maxR: R, rings: 3, colours: false }),
    medallion: (seed, half, R, n) => R < 5 ? global.GlyphGen.srosette(seed, { order: n, fill: true, even: half, maxR: R, rings: 3 }) : R < 8 ? global.GlyphGen.compound(seed) : global.GlyphGen.smedallion(seed),
  };
  // the order of symmetry of what a kind draws (whatever wraps it keeps it): from the kind's own range; a half
  // (for a divider) is cut along a mirror line, so it takes an even order
  const ORDERS = { rays: [5, 6, 7, 7, 8, 9], flower: [5, 5, 6, 7, 7, 8, 9], snowflake: [5, 6, 6, 6, 7, 8, 9], stars: [5, 5, 7, 7, 9, 11, 6, 8, 10], pinwheel: [3, 5, 5, 7, 9, 6], wreath: [5, 6, 7, 8], frame: [3, 5, 5, 7, 4, 6], medallion: [12] };
  const orderFor = (name, r, half) => { const xs = (ORDERS[name] || []).filter(n => !half || n % 2 === 0); return xs.length ? r.pick(xs) : global.GlyphGen.order(r, half); };
  // fitted(name, seed, half, R): a shape that fills the disc of radius R, as a gasket's circle must: the kind's
  // largest draw (of a few) that stays inside it, wrapped (by nest) in further rings of its own order of symmetry
  // until it reaches the rim. A kind that can't be drawn that small gives way to a nest grown only as far as R.
  const GROWN = new Set(["flower", "snowflake", "rays", "stars", "pinwheel"]);
  function fitted(name, seed, half, R) {
    const GG = global.GlyphGen, r = GG.rng(seed), n = orderFor(name, r, half);
    let best = null;
    for (let t = 0; t < 3; t++) {
      const a = GENERATED[name](seed + t * 7919, half, R, n), rad = a.radius();
      if (rad <= R * 1.02 && (!best || rad > best.rad)) best = { a, rad };
      if (best && best.rad >= R * 0.88) break;
    }
    if (!best) return GROWN.has(name) ? GG.starburst(seed, { order: n, even: half, maxR: R }) : GG.nest(seed, { order: n, even: half, maxR: R, budget: 420 });
    // flowers, snowflakes and stars grow in their own way (longer petals, arms and rays) and are never ringed
    // round (that makes mandalas): one a little small for its hole is drawn a little larger, glyphs and all
    if (GROWN.has(name)) return best.rad < R * 0.85 && best.rad > 0.5 ? global.GlyphArt.scale(Math.min(1.3, R * 0.95 / best.rad), best.a) : best.a;
    if (best.rad < R * 0.88 && R - best.rad > 1.1) {   // room for another ring: wrap it
      const wn = name === "medallion" || name === "wallpaper" ? (half ? 6 : 12) : n;
      return GG.nest(seed + 1, { core: best.a, order: wn, even: half, maxR: R, budget: 420 });
    }
    return best.a;
  }

  // ---- the shape pool: generating a made-to-measure shape (growing it glyph by glyph) is the costly
  // part of drawing the margins, and a long page asks for hundreds. So each (kind, size, half,
  // palette) keeps POOL_N variants, grown once and reused on every page: the visit's random stream
  // still picks which variant a hole gets (one draw, as before), so layouts vary as ever. Sizes are
  // rounded down to a quarter em (a shape never outgrows its hole); variants are re-seeded weekly.
  // The pool persists in localStorage under the theme's version (helia/theme-version.js), so
  // editing any theme script starts it afresh.
  const POOL_N = 4, POOL_MAX = 1.5e6;
  const WEEK = Math.floor(Date.now() / 6048e5);
  const POOL_KEY = "glyph-pool:" + (global.heliaThemeVersion || "dev") + ":" + WEEK;
  let pool = null, poolDirty = false, poolSize = 0;
  function poolLoad() {
    if (pool) return pool;
    pool = new Map();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {                   // earlier versions and weeks
        const k = localStorage.key(i);
        if (k && k.startsWith("glyph-pool:") && k !== POOL_KEY) localStorage.removeItem(k);
      }
      const saved = localStorage.getItem(POOL_KEY);
      if (saved) { poolSize = saved.length; for (const [k, v] of Object.entries(JSON.parse(saved))) pool.set(k, v); }
    } catch (e) {}
    return pool;
  }
  function poolSave() {
    if (!poolDirty) return;
    poolDirty = false;
    try {
      const text = JSON.stringify(Object.fromEntries(pool));
      if (text.length > POOL_MAX) { pool.clear(); localStorage.removeItem(POOL_KEY); poolSize = 0; return; }
      localStorage.setItem(POOL_KEY, text); poolSize = text.length;
    } catch (e) {}
  }
  if (typeof addEventListener === "function") {
    addEventListener("pagehide", poolSave);
    addEventListener("visibilitychange", () => { if (typeof document !== "undefined" && document.visibilityState === "hidden") poolSave(); });
  }
  const copyItems = items => items.map(it => Object.assign({}, it));
  function generated(name, R, r, pal, side) {
    const pick = Math.floor((r || Math.random)() * POOL_N);
    const Rq = Math.max(1.2, Math.floor(R * 4) / 4);
    const key = name + "|" + Rq + "|" + (side || "") + "|" + (pal && pal.length ? pal.join(",") : "") + "|" + pick;
    const P = poolLoad(), hit = P.get(key);
    if (hit) return copyItems(hit);
    const items = grow(name, Rq, pal, side, hash(key + "|" + WEEK));
    // (shapes grown before the web fonts loaded are measured in a fallback font: not kept)
    const fontsReady = typeof document === "undefined" || !document.fonts || document.fonts.status === "loaded";
    if (fontsReady) { P.set(key, items); poolDirty = true; }
    return copyItems(items);
  }
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function grow(name, R, pal, side, seed) {
    const A = global.GlyphArt;
    let a = /^(rays4|rays8|nest4|nest8|hub|hats|gflower|gburst|gstar|gsnow|gfleur|gtree)$/.test(name) ? GENERATED[name](seed, !!side, R) : fitted(name, seed, !!side, R); let rad = a.radius();
    // too big for the room: never shrunk (the glyphs would be too small to read), but replaced with a rosette
    // grown only as far as the room allows, or (in the smallest holes) a single symbol
    if (rad > R * 1.2) { a = global.GlyphGen.srosette(seed, { even: !!side, maxR: R, rings: 3, budget: 90 }); rad = a.radius(); }
    if (rad > R * 1.3) { a = A.glyph(global.GlyphGen.SYM.hub[seed % global.GlyphGen.SYM.hub.length], Math.max(1, Math.min(1.8, R * 1.1))); }
    if (!side) return A.render(a, pal && pal.length ? pal : null).items;
    // a half keeps the whole ornament's centre as its origin, so it hangs from (or stands on) the line through it
    const c = A.centred(a), keep = new A.Art(c.glyphs.filter(g => side === "below" ? g.y >= -0.3 : g.y <= 0.3));
    return A.render(keep, pal && pal.length ? pal : null, { origin: true }).items;
  }
  // the old catalog's kinds (thin strokes, sprigs and small glyphs) are retired: each name now draws its nearest
  // generated counterpart, so nothing asks for them any more, whatever pattern or grammar names them
  const RETIRED = { orbit: "nest", nested: "nest", halo: "nest", corona: "nest", burst: "nest", circlet: "nest", mandala: "nest", wheel: "nest",
    sunburst: "rays", starburst: "rays", doubled: "rays", compass: "rays", star: "stars", snowflake4: "snowflake",
    rosette: "jewel", double: "jewel", layered: "jewel", alternating: "jewel", leafy: "jewel" };
  function shape(name, R, r, pal, side, of) {
    if (RETIRED[name] && global.GlyphGen) name = RETIRED[name];
    if (GENERATED[name]) { if (global.GlyphGen && global.GlyphArt) return generated(name, Math.max(1.2, R), r, pal, side); name = "rosette"; }
    const e = env({ rng: r || Math.random, cols: pal && pal.length ? pal : COLOURS });
    const d = run((KINDS[name] || KINDS.rosette)(Math.max(1.2, R), { quad: !!side, of }), e);
    let items = d.items;
    if (items.length < 2) items = run(KINDS.rosette(Math.max(1.2, R), { quad: !!side }), e).items;
    if (side) items = items.filter(it => side === "above" ? it.y <= 0.55 : it.y >= -0.55);
    return items.map(it => ({ tok: it.tok, x: it.x, y: it.y, s: it.s || 1, rot: it.rot || 0, col: it.col || null, reflect: it.reflect || undefined }));
  }

  // declutter(items, gap): no two glyphs overlap. Larger glyphs are kept first (then earlier ones);
  // a glyph closer than `gap` (in glyph diameters) to a kept one is dropped. Strokes (continuous
  // lines) may overlap each other, but anything else on them wins.
  function declutter(items, gap) {
    gap = gap == null ? 0.95 : gap;
    const cell = 1, grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663, kept = [];
    const order = items.map((it, i) => i).sort((a, b) => (items[b].line ? 0 : 1) - (items[a].line ? 0 : 1) || (items[b].s || 1) - (items[a].s || 1) || a - b);
    for (const i of order) {
      const it = items[i], r = 0.5 * (it.s || 1), gi = Math.floor(it.x / cell), gj = Math.floor(it.y / cell);
      let clash = false;
      for (let di = -2; di <= 2 && !clash; di++) for (let dj = -2; dj <= 2 && !clash; dj++) {
        for (const o of grid.get(key(gi + di, gj + dj)) || []) {
          if (it.line && o.line) continue;
          if (Math.hypot(it.x - o.x, it.y - o.y) < gap * (r + 0.5 * (o.s || 1))) { clash = true; break; }
        }
      }
      if (clash) continue;
      const k = key(gi, gj); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(it); kept.push(i);
    }
    kept.sort((a, b) => a - b);
    return kept.map(i => items[i]);
  }
  // onGrid(items, cw, ch): every glyph snapped to a character cell (cw × ch glyphs), unturned, one per
  // cell (the larger, then the earlier, keeps it), as text in an editor
  function onGrid(items, cw, ch) {
    cw = cw || 0.95; ch = ch || 1.2;
    const cells = new Map(), order = items.map((it, i) => i).sort((a, b) => (items[b].line ? 0 : 1) - (items[a].line ? 0 : 1) || (items[b].s || 1) - (items[a].s || 1) || a - b);
    for (const i of order) { const it = items[i], gx = Math.round(it.x / cw), gy = Math.round(it.y / ch), k = gx + "," + gy;
      if (!cells.has(k)) cells.set(k, Object.assign({}, it, { x: gx * cw, y: gy * ch, rot: 0, s: 1, reflect: undefined })); }
    return [...cells.values()];
  }
  const grid = (t, cw, ch) => e => drawing(onGrid(run(t, e).items, cw, ch));
  // sparse(t, gap): t with overlapping glyphs removed
  const sparse = (t, gap) => e => drawing(declutter(run(t, e).items, gap));
  // render(thing, {seed, cols, overlap}): (decluttered unless overlap: true) the drawing, as Ornament.renderInto wants it ({ items, w, h })
  // (the box is the drawing's bounds, so base-anchored plants don't waste the half below them)
  function render(t, o) {
    const d0 = run(t, env(o)); if (!d0.items.length) return { items: [], w: 1, h: 1 };
    const d = o && o.overlap ? d0 : { items: declutter(d0.items) };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const it of d.items) { const h = 0.55 * (it.s || 1); x0 = Math.min(x0, it.x - h); x1 = Math.max(x1, it.x + h); y0 = Math.min(y0, it.y - h); y1 = Math.max(y1, it.y + h); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { items: d.items.map(it => Object.assign({}, it, { x: it.x - cx, y: it.y - cy })), w: x1 - x0, h: y1 - y0 };
  }
  // evaluate an expression written with the combinators (the tree's examples)
  const API = { tok, over, tint, anyColour, size, turn, shift, mirror, upright, choose, pad, ring, alt, burst, rays, phyllotaxis, line, laid, polygon, stroke, shoot, recurse, kaleido, lattice, hat, hats, grid, sparse };
  function evaluate(src) { return new Function(...Object.keys(API), '"use strict"; return (' + src + ");")(...Object.values(API)); }
  // evaluateProgram(src): an expression, or statements (const bindings, …) ending in `return <thing>`
  // (extra: more names for the program, e.g. {S: the reader's symbols}; an extra name shadows a primitive of that name)
  function evaluateProgram(src, extra) {
    const scope = Object.assign({}, API, extra), names = Object.keys(scope), vals = Object.values(scope);
    try { return new Function(...names, '"use strict"; return (\n' + src + "\n);")(...vals); } catch (err) { if (!(err instanceof SyntaxError)) throw err; }
    const t = new Function(...names, '"use strict";\n' + src)(...vals);
    if (t == null) throw new Error("the program must end with `return <thing>`");
    return t;
  }

  global.Glyphcraft = Object.assign({ DOCS, HAT_TILING, KINDS, KIND_NAMES: Object.keys(KINDS), PARTS, shape, render, evaluate, evaluateProgram, env, run, drawing, rng, HOOKED, COLOURS }, API);
})(typeof window !== "undefined" ? window : globalThis);
