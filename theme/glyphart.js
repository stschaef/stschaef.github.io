// glyphart.js: glyph art as values.
//
// An Art is a set of placed glyphs together with its open points: frames (a position, a direction, a scale and
// an index) where more art can go. Its geometry is computed from the glyphs themselves: its centre, how far it
// reaches in any direction (extent), and its radius. Combinators use that geometry to place things without
// collisions, and carry the open points through, so composition is continuation-passing: `then(a, k)` fills
// every open point of a with k(point), and the result's open points are whatever k leaves open.
//
// Units are glyphs (a size-1 glyph is one em). Angles are degrees, clockwise, 0 pointing up.
// A string anywhere an Art is expected is one glyph.
//
// Colour comes from a palette. Every glyph records its depth in the structure (what `around` places round a
// centre, or `then` places at a point, is one level deeper), and is drawn in the palette's colour for its depth.
// `palette(cols, a)` chooses the palette inside a; `tint(col, a)` fixes one colour outright. The glyphs are set
// in a monospace font (FONT).
(function (global) {
  const DEG = Math.PI / 180;
  const HOOKED = /[∃ƎΣ⊏⊐∈∋¬⌐Γ⅃⊸⟜⊢⊣ℲⅎЕЭよf√&⅋]/;   // (and other chiral glyphs that would make pinwheels)   // turned round a centre these make swastikas: they stay upright
  const RG = 0.42;                           // the footprint of a glyph that can't be measured: a box of half-side RG
  const GAP = 0.15;                          // the default clearance between things
  // the theme's colours, by name; a palette is a list of these (or any CSS colours)
  const NAMED = { accent: "var(--accent)", green: "var(--accent-2, #5f8f4e)", blue: "var(--accent-3, #3f6fb3)", gold: "var(--accent-4, #b8860b)",
    violet: "var(--accent-5, var(--accent))", ink: "var(--ink, currentColor)", muted: "var(--muted, #888)" };
  const colour = c => NAMED[c] || c;
  // a palette is a list (colours by depth), or { roles: {role: colour}, depth: [...] } (colours by role, where a
  // glyph has one, else by depth); `pale(c)` is c washed toward the paper
  const pale = (c, k) => "color-mix(in srgb, " + colour(c) + " " + (k || 55) + "%, var(--paper, #fff))";
  const PALETTES = { theme: ["accent", "green", "blue", "gold", "violet"], warm: ["accent", "gold", "violet"], cool: ["blue", "green", "violet"],
    garden: ["green", "accent", "gold"], ink: ["ink", "muted"], mono: ["ink"],
    folk: { roles: { stem: pale("accent"), vein: pale("accent"), calyx: pale("accent"), leaf: "accent", petal: "green", detail: pale("green", 50), centre: "accent" }, depth: ["accent", "green"] },
    meadow: { roles: { stem: "green", vein: pale("green"), calyx: "green", leaf: "green", petal: "accent", detail: pale("accent", 50), centre: "gold" }, depth: ["accent", "gold", "green"] },
    ink2: { roles: { stem: "muted", vein: "muted", calyx: "muted", leaf: "ink", petal: "accent", detail: "muted", centre: "accent" }, depth: ["ink", "accent"] } };
  const PALETTE = PALETTES.theme;
  // the font glyphs are measured in: the page's own text font (read from the page when first needed), unless set
  let FONT = null;
  const fontNow = () => FONT || (FONT = typeof document !== "undefined" && document.body ? getComputedStyle(document.body).fontFamily : "serif");
  const FONT_CSS = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;800&family=Fira+Mono:wght@400;700&display=swap";

  // ---- ink: each glyph's inked box in the font, measured in the browser (a size-1 glyph is 1em). A glyph's
  // position is the centre of its ink, not of its font box, so things line up by what is actually drawn.
  // {cx, cy}: the ink centre's offset from the centre of the glyph's line box (as Ornament.renderInto draws it);
  // {hw, hh}: the half-width and half-height of the ink.
  const INK = new Map(); let ctx = null;
  function ink(tok) {
    let m = INK.get(tok);
    if (m) return m;
    m = { cx: 0, cy: 0, hw: RG, hh: RG };
    try {
      if (!ctx && typeof document !== "undefined") ctx = document.createElement("canvas").getContext("2d");
      if (ctx) {
        ctx.font = "100px " + fontNow(); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        const t = ctx.measureText(tok), A = t.fontBoundingBoxAscent, D = t.fontBoundingBoxDescent;
        const x0 = -t.actualBoundingBoxLeft, x1 = t.actualBoundingBoxRight, bl = (A - D) / 2, y0 = bl - t.actualBoundingBoxAscent, y1 = bl + t.actualBoundingBoxDescent;
        if (x1 > x0 && y1 > y0 && isFinite(A)) m = { cx: (x0 + x1) / 200, cy: (y0 + y1) / 200, hw: Math.max(0.06, (x1 - x0) / 200), hh: Math.max(0.06, (y1 - y0) / 200) };
      }
    } catch (e) {}
    INK.set(tok, m); return m;
  }
  // setFont(family): the font glyphs are measured (and should be drawn) in
  const setFont = family => { FONT = family; INK.clear(); };
  // a glyph's turned ink box: its axes and half-extents
  const axes = g => { const r = (g.rot || 0) * DEG; return [Math.cos(r), Math.sin(r)]; };
  const support = (g, ux, uy) => { const k = ink(g.tok), [c, s] = axes(g); return g.s * (k.hw * Math.abs(ux * c + uy * s) + k.hh * Math.abs(-ux * s + uy * c)); };

  class Art {
    constructor(glyphs, points) { this.glyphs = glyphs; this.points = points || []; this._box = null; }
    get box() {
      if (!this._box) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const g of this.glyphs) { const ex = support(g, 1, 0), ey = support(g, 0, 1); x0 = Math.min(x0, g.x - ex); x1 = Math.max(x1, g.x + ex); y0 = Math.min(y0, g.y - ey); y1 = Math.max(y1, g.y + ey); }
        this._box = this.glyphs.length ? { x0, x1, y0, y1 } : { x0: 0, x1: 0, y0: 0, y1: 0 };
      }
      return this._box;
    }
    get centre() { const b = this.box; return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }
    get width() { return this.box.x1 - this.box.x0; }
    get height() { return this.box.y1 - this.box.y0; }
    // how far the glyphs reach from `from` (default: the centre) in direction deg
    extent(deg, from) {
      if (!this.glyphs.length) return 0;
      const o = from || this.centre, u = dir(deg); let m = -Infinity;
      for (const g of this.glyphs) m = Math.max(m, (g.x - o.x) * u.x + (g.y - o.y) * u.y + support(g, u.x, u.y));
      return m;
    }
    // the distance from `from` (default: the centre) that clears every glyph
    radius(from) {
      const o = from || this.centre; let m = 0;
      for (const g of this.glyphs) { const k = ink(g.tok); m = Math.max(m, Math.hypot(g.x - o.x, g.y - o.y) + g.s * Math.hypot(k.hw, k.hh)); }
      return m;
    }
  }
  const dir = deg => ({ x: Math.sin(deg * DEG), y: -Math.cos(deg * DEG) });

  // ---- coercion and transforms
  function glyph(tok, size) {
    const s = size || 1;
    return new Art([{ tok, x: 0, y: 0, s, rot: 0, d: 0 }], [{ x: 0, y: -ink(tok).hh * s, a: 0, s, i: 0, d: 0, kind: "tip" }]);
  }
  function art(x) {
    if (x instanceof Art) return x;
    if (typeof x === "string") return glyph(x);
    if (x == null) return nothing;
    throw new TypeError("not glyph art: " + (typeof x === "function" ? "a function (did you forget to apply it?)" : String(x)));
  }
  // the one transform everything uses: about `o`, flip (left–right), scale k, turn deg, then move by (dx, dy)
  function transform(a, t) {
    const o = t.about || { x: 0, y: 0 }, k = t.k == null ? 1 : t.k, r = (t.rot || 0) * DEG, c = Math.cos(r), s = Math.sin(r), f = t.flip ? -1 : 1;
    const pt = (x, y) => { const px = f * (x - o.x) * k, py = (y - o.y) * k; return [o.x + px * c - py * s + (t.dx || 0), o.y + px * s + py * c + (t.dy || 0)]; };
    const glyphs = a.glyphs.map(g => { const [x, y] = pt(g.x, g.y), up = HOOKED.test(g.tok) || g.level;   // (chiral glyphs, and text marked level, never turn)
      return Object.assign({}, g, { x, y, s: g.s * k, rot: up ? g.rot : f * g.rot + (t.rot || 0), reflect: t.flip ? !g.reflect : g.reflect }); });
    const points = a.points.map(p => { const [x, y] = pt(p.x, p.y); return Object.assign({}, p, { x, y, a: f * p.a + (t.rot || 0), s: p.s * k }); });
    return new Art(glyphs, points);
  }
  const centred = a => { a = art(a); const c = a.centre; return transform(a, { dx: -c.x, dy: -c.y }); };
  const rotate = (deg, a) => { a = art(a); return transform(a, { rot: deg, about: a.centre }); };
  const scale = (k, a) => { a = art(a); return transform(a, { k, about: a.centre }); };
  const mirror = a => { a = art(a); return transform(a, { flip: true, about: a.centre }); };
  const shift = (dx, dy, a) => transform(art(a), { dx, dy });
  const turn = (deg, a) => transform(art(a), { rot: deg });                   // about the origin, not the centre
  const tint = (col, a) => { a = art(a); return new Art(a.glyphs.map(g => Object.assign({}, g, { col: colour(col) })), a.points); };
  // palette(cols, a): the colours a's glyphs take by depth (a palette set further in wins)
  const palette = (cols, a) => { a = art(a); const pal = asPalette(cols);
    return new Art(a.glyphs.map(g => g.pal ? g : Object.assign({}, g, { pal })), a.points); };
  // role(name, a): what a's glyphs are (stem, leaf, petal, …), for palettes that colour by role (inner roles win)
  const role = (name, a) => { a = art(a); return new Art(a.glyphs.map(g => g.role ? g : Object.assign({}, g, { role: name })), a.points); };
  function asPalette(p) {
    if (typeof p === "string") p = PALETTES[p] || [p];
    if (Array.isArray(p)) return { roles: {}, depth: p.map(colour) };
    const roles = {}; for (const k in p.roles || {}) roles[k] = colour(p.roles[k]);
    return { roles, depth: (p.depth || PALETTE).map(colour) };
  }
  // depth: one level deeper for everything in a, by k
  const deepen = (a, k) => k ? new Art(a.glyphs.map(g => Object.assign({}, g, { d: (g.d || 0) + k })), a.points.map(p => Object.assign({}, p, { d: (p.d || 0) + k }))) : a;
  const depthOf = a => a.glyphs.reduce((m, g) => Math.max(m, g.d || 0), 0);
  // place a at frame p: its centre on the point, turned and scaled by the frame
  const placeAt = (a, p) => transform(centred(a), { k: p.s, rot: p.a, dx: p.x, dy: p.y });
  const nothing = new Art([], [{ x: 0, y: 0, a: 0, s: 1, i: 0 }]);
  const index = pts => pts.map((p, i) => Object.assign({}, p, { i }));

  // ---- collisions
  function collide(A, B, gap) {
    const a = A.box, b = B.box;
    if (a.x1 + gap < b.x0 || b.x1 + gap < a.x0 || a.y1 + gap < b.y0 || b.y1 + gap < a.y0) return false;
    for (const g of A.glyphs) for (const h of B.glyphs) if (overlap(g, h, gap)) return true;
    return false;
  }
  // two glyphs' ink boxes closer than gap? (no axis of either box separates them by gap)
  function overlap(g, h, gap) {
    const dx = h.x - g.x, dy = h.y - g.y, kg = ink(g.tok), kh = ink(h.tok), rg = g.s * Math.hypot(kg.hw, kg.hh), rh = h.s * Math.hypot(kh.hw, kh.hh);
    if (Math.hypot(dx, dy) >= rg + rh + gap) return false;
    const [c1, s1] = axes(g), [c2, s2] = axes(h);
    for (const [ux, uy] of [[c1, s1], [-s1, c1], [c2, s2], [-s2, c2]]) if (Math.abs(dx * ux + dy * uy) >= support(g, ux, uy) + support(h, ux, uy) + gap) return false;
    return true;
  }
  // the least d >= lo for which free(d) holds, assuming it stays true once it does
  function least(lo, step, free) {
    if (free(lo)) return lo;
    let hi = lo + step; while (!free(hi)) { lo = hi; hi += step; step *= 2; }
    for (let q = 0; q < 14; q++) { const m = (lo + hi) / 2; if (free(m)) hi = m; else lo = m; }
    return hi;
  }

  // ---- composition
  // over(a, b, …): superposed, centres together
  const over = (...as) => { const cs = as.map(centred); return new Art([].concat(...cs.map(c => c.glyphs)), index([].concat(...cs.map(c => c.points)))); };
  // beside(a, b, gap): b to the right of a, just clear of it; above(a, b, gap): a above b
  function beside(a, b, gap) {
    a = centred(a); b = centred(b); const g = gap == null ? GAP : gap;
    const d = a.extent(90) + b.extent(270) + g, B = transform(b, { dx: d });
    return centred(new Art(a.glyphs.concat(B.glyphs), index(a.points.concat(B.points))));
  }
  function above(a, b, gap) {
    a = centred(a); b = centred(b); const g = gap == null ? GAP : gap;
    const d = a.extent(180) + b.extent(0) + g, B = transform(b, { dy: d });
    return centred(new Art(a.glyphs.concat(B.glyphs), index(a.points.concat(B.points))));
  }
  const row = (as, gap) => as.map(art).reduce((acc, b) => beside(acc, b, gap));
  const column = (as, gap) => as.map(art).reduce((acc, b) => above(acc, b, gap));

  // around(n, x, y, gap): n copies of y round x, each turned to face outward, as close as they can be without
  // touching x (clear of x's reach in every direction a copy sits) or each other. Open points: n × y's.
  function around(n, x, y, gap) {
    x = centred(x); const ys = (Array.isArray(y) ? y : [y]).map(centred), g = gap == null ? GAP : gap, Y = k => ys[k % ys.length];
    const angles = Array.from({ length: n }, (_, k) => k * 360 / n);
    const reach = x.glyphs.length ? Math.max(...angles.map(t => x.extent(t))) + g : 0;
    const lo = reach + Math.max(...ys.map(b => b.extent(180)));
    const copy = (k, d) => { const u = dir(angles[k]); return transform(Y(k), { rot: angles[k], dx: d * u.x, dy: d * u.y }); };
    // (a part that stays level, such as a chiral glyph or text, faces the centre differently in every place: then
    // every copy is checked against the centre, and against its neighbours)
    const level = ys.some(b => b.glyphs.some(gl => HOOKED.test(gl.tok) || gl.level));
    const free = d => ys.every((_, j) => !collide(copy(j, d), copy(j + 1, d), g)) && (!level || angles.every((_, k) => !collide(copy(k, d), x, g) && !collide(copy(k, d), copy((k + 1) % n, d), g)));
    const d = n < 2 && !level ? lo : least(lo, Math.max(0.5, Math.max(...ys.map(b => b.radius())) / 2), free);
    const deeper = x.glyphs.length ? depthOf(x) + 1 : 0, copies = angles.map((_, k) => deepen(copy(k, d), deeper));
    return new Art(x.glyphs.concat(...copies.map(c => c.glyphs)), index([].concat(...copies.map(c => c.points))));
  }
  const ring = (n, y, gap) => around(n, new Art([]), y, gap);

  // then(a, k, gap): at every open point p (the i-th), k(p, i) standing on it, turned and scaled with it.
  // k may also be a plain Art. Open points: those of everything placed.
  function then(a, k, gap) {
    a = art(a); const g = gap == null ? GAP : gap, f = typeof k === "function" ? k : () => k;
    const parts = a.points.map((p, i) => { const b = centred(f(p, i));   // lift b so it stands on the point, then move it there
      return deepen(transform(transform(b, { dy: -(b.extent(180) + g) }), { k: p.s, rot: p.a, dx: p.x, dy: p.y }), (p.d || 0) + 1); });
    return new Art(a.glyphs.concat(...parts.map(b => b.glyphs)), index([].concat(...parts.map(b => b.points))));
  }
  // at(a, k): the same, but centred on each point rather than standing on it
  function at(a, k) {
    a = art(a); const f = typeof k === "function" ? k : () => k;
    const parts = a.points.map((p, i) => deepen(placeAt(f(p, i), p), (p.d || 0) + 1));
    return new Art(a.glyphs.concat(...parts.map(b => b.glyphs)), index([].concat(...parts.map(b => b.points))));
  }

  // ---- composition that keeps origins (for art built round a base point, like a stem or a petal)
  // union(a, b, …): together, nothing moved
  const union = (...as) => { as = as.map(art); return new Art([].concat(...as.map(a => a.glyphs)), index([].concat(...as.map(a => a.points)))); };
  // reflect(a): mirrored in the vertical line through the origin; bilateral(a): a and its reflection
  const reflect = a => transform(art(a), { flip: true });
  // (a glyph on the axis itself is kept once)
  const bilateral = a => { a = art(a); const m = reflect(a); return union(a, new Art(m.glyphs.filter(g => Math.abs(g.x) > 0.12), m.points)); };
  // dihedral(n, x, y, gap): 2n copies of y round x, alternately mirrored (dihedral symmetry, of order 2n)
  const dihedral = (n, x, y, gap) => around(2 * n, x, [y, mirror(y)], gap);
  // kind(k, a): every open point of a is of kind k; points(k, a): only the open points of kind k
  const kind = (k, a) => { a = art(a); return new Art(a.glyphs, a.points.map(p => Object.assign({}, p, { kind: k }))); };
  const points = (k, a) => { a = art(a); return new Art(a.glyphs, index(a.points.filter(p => p.kind === k))); };

  // Space: an index of placed glyphs, for asking whether new art would touch any of them
  class Space {
    constructor(cell) { this.c = cell || 1.5; this.m = new Map(); }
    cells(g, pad, f) { const k = ink(g.tok), r = g.s * Math.hypot(k.hw, k.hh) + pad, c = this.c;
      for (let i = Math.floor((g.x - r) / c); i <= Math.floor((g.x + r) / c); i++) for (let j = Math.floor((g.y - r) / c); j <= Math.floor((g.y + r) / c); j++) if (f(i + "," + j) === true) return true; return false; }
    add(a) { for (const g of art(a).glyphs) this.cells(g, 0, key => { let b = this.m.get(key); if (!b) this.m.set(key, b = []); b.push(g); }); return this; }
    // (skip(h): glyphs already placed that may be touched)
    hits(a, gap, skip) { const G = gap == null ? GAP : gap; return art(a).glyphs.some(g => this.cells(g, G, key => (this.m.get(key) || []).some(h => !(skip && skip(h)) && overlap(g, h, G)))); }
  }
  // attach(a, kind, k, gap): at every open point of that kind, k(p, i) standing on it, as then does, but only
  // where it touches nothing already there (it is shrunk, then left out, if it would). Other points stay open.
  function attach(a, kd, k, gap) {
    a = art(a); const g = gap == null ? GAP : gap, f = typeof k === "function" ? k : () => k, space = new Space().add(a), host = new Set(a.glyphs);
    const glyphs = a.glyphs.slice(), pts = a.points.filter(p => p.kind !== kd);
    a.points.filter(p => p.kind === kd).forEach((p, i) => {
      let b = f(p, i); if (b == null) return; b = centred(b);
      let owner = null, od = Infinity; for (const h of a.glyphs) { const d = Math.hypot(h.x - p.x, h.y - p.y); if (d < od) { od = d; owner = h; } }
      for (const sh of [1, 0.8, 0.64]) {
        const c = deepen(transform(transform(b, { dy: -(b.extent(180) + g) }), { k: p.s * sh, rot: p.a, dx: p.x, dy: p.y }), (p.d || 0) + 1);
        const near = h => h === owner;                                              // it may touch what it grows from, and only that
        if (!space.hits(c, g * 0.5, near)) { space.add(c); glyphs.push(...c.glyphs); pts.push(...c.points); return; }
      }
    });
    return new Art(glyphs, index(pts));
  }

  // ---- paths: lists of points [x, y], walked from the first
  // walk(n, h, turn): a turtle's path from the origin, heading up, n steps of length h, turning turn(i) degrees
  // (or turn degrees) before step i
  function walk(n, h, turn) {
    const t = typeof turn === "function" ? turn : () => turn || 0, pts = [[0, 0]]; let a = 0, x = 0, y = 0;
    for (let i = 0; i < n; i++) { a += t(i); const u = dir(a); x += h * u.x; y += h * u.y; pts.push([x, y]); }
    return pts;
  }
  // arc(r, from, to): part of the circle of radius r round the origin, from angle `from` to `to`
  const arc = (r, from, to) => { const n = Math.max(8, Math.ceil(Math.abs(to - from) / 4)); return Array.from({ length: n + 1 }, (_, i) => { const u = dir(from + (to - from) * i / n); return [r * u.x, r * u.y]; }); };
  // curve(pts): a smooth path through the points (Catmull–Rom)
  function curve(P) {
    if (P.length < 3) return P.slice();
    const out = [], q = i => P[Math.max(0, Math.min(P.length - 1, i))];
    for (let i = 0; i < P.length - 1; i++) for (let k = 0; k < 8; k++) { const t = k / 8, [p0, p1, p2, p3] = [q(i - 1), q(i), q(i + 1), q(i + 2)];
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t))); }
    out.push(P[P.length - 1]); return out;
  }
  const pathLength = P => P.reduce((m, p, i) => i ? m + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]) : 0, 0);
  // the point and heading at distance s along P
  function pathAt(P, s) {
    for (let i = 1; i < P.length; i++) { const [x0, y0] = P[i - 1], [x1, y1] = P[i], l = Math.hypot(x1 - x0, y1 - y0);
      if (s <= l || i === P.length - 1) { const t = l ? Math.min(1, s / l) : 0; return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, a: Math.atan2(x1 - x0, -(y1 - y0)) / DEG }; } s -= l; }
    return { x: P[0][0], y: P[0][1], a: 0 };
  }
  // along(path, a, gap, spread, taper): copies of a laid along the path, each turned to follow it and just clear
  // of the last by gap (negative: overlapping, for a continuous line), scaled from 1 down to taper at the end.
  // Open points: at every copy, "left" and "right" ones leaning `spread` degrees off the path's heading (90:
  // square to it), and an "end" one past the last copy, heading on.
  function along(P, a, gap, spread, taper) {
    a = centred(a); const g = gap == null ? GAP : gap, sp = spread == null ? 60 : spread, tp = taper == null ? 1 : taper, L = pathLength(P);
    const up = a.extent(0), down = a.extent(180), side = Math.max(a.extent(90), a.extent(270));
    const glyphs = [], pts = []; let s = down, last = null;              // the first copy starts at the path's start
    if (L < up + down) s = L / 2;
    while (s <= L - up * (1 - (1 - tp) * s / Math.max(L, 1e-9)) + 1e-6 || last === null) {
      const f = pathAt(P, s), k = 1 - (1 - tp) * (L ? s / L : 0), c = transform(a, { k, rot: f.a, dx: f.x, dy: f.y });
      glyphs.push(...c.glyphs);
      for (const [kd, sg] of [["left", -1], ["right", 1]]) { const u = dir(f.a + sg * 90), o = side * k + 0.05;
        pts.push({ x: f.x + o * u.x, y: f.y + o * u.y, a: f.a + sg * sp, s: k, d: 0, kind: kd }); }
      last = { f, k, s }; const step = k * (up + down) + g; if (step <= 0.01) break; s += step;
      if (s > L - up * k + 1e-6 && last.s + up * k < L - 0.3 * step) s = L - up * k;   // end flush with the path, if a copy would fit
    }
    if (last) { const u = dir(last.f.a), o = last.k * up; pts.push({ x: last.f.x + o * u.x, y: last.f.y + o * u.y, a: last.f.a, s: last.k, d: 0, kind: "end" }); }
    return new Art(glyphs, index(pts));
  }
  // offset(P, d): the path moved d to its right (negative: its left), point by point
  function offset(P, d) {
    return P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [p[0] - d * dy / l, p[1] + d * dx / l]; });
  }
  // half(a, side): only the glyphs of a above ("above") or below ("below") its centre line, for half ornaments
  const half = (side, a) => { a = centred(a); return new Art(a.glyphs.filter(g => side === "below" ? g.y >= -1e-6 : g.y <= 1e-6), []); };

  // snap(a, cw, ch): every glyph put in a character cell of a grid (cw wide, ch tall, one cell at the origin),
  // unturned and unmirrored, as text in an editor. Where two land in one cell, the one nearer its own place stays.
  function snap(a, cw, ch) {
    a = art(a); const cells = new Map();
    for (const g of a.glyphs) {
      const i = Math.round(g.x / cw), j = Math.round(g.y / ch), key = i + "," + j, d = Math.hypot(g.x - i * cw, g.y - j * ch), cur = cells.get(key);
      if (!cur || d < cur.d) cells.set(key, { d, g: Object.assign({}, g, { x: i * cw, y: j * ch, rot: 0, reflect: false }) });
    }
    return new Art([...cells.values()].map(c => c.g), a.points);
  }

  // ---- iteration
  // spiral(n, step, f): f(i) at frame i, where frame 0 is the origin and frame i + 1 = step(frame i, i).
  // Each element is centred on its frame and turned with it. Open points: every element's.
  function spiral(n, step, f) {
    const g = typeof f === "function" ? f : () => f; let F = { x: 0, y: 0, a: 0, s: 1, i: 0 }; const parts = [];
    for (let i = 0; i < n; i++) { parts.push(placeAt(g(i), F)); F = Object.assign({ i: i + 1 }, step(F, i)); }
    return new Art([].concat(...parts.map(b => b.glyphs)), index([].concat(...parts.map(b => b.points))));
  }
  // steps: golden(c) is Vogel's sunflower (the golden angle, radius c√i); swirl(deg, grow, r0) a logarithmic
  // spiral (turn deg about the origin and grow the radius, and the element, by `grow` each step)
  const golden = c => (F, i) => { const k = i + 1, a = k * 137.50776405, r = (c || 1) * Math.sqrt(k), u = dir(a); return { x: r * u.x, y: r * u.y, a, s: F.s }; };
  const swirl = (deg, grow, r0) => (F, i) => { const r = i === 0 ? (r0 || 1) : Math.hypot(F.x, F.y) * grow, a = F.a + deg, u = dir(a); return { x: r * u.x, y: r * u.y, a, s: i === 0 ? F.s : F.s * grow }; };
  // sunflower(n, f, gap): the golden spiral, spaced from the size of its elements so none of them touch
  function sunflower(n, f, gap) {
    const g = typeof f === "function" ? f : () => f, arts = Array.from({ length: n }, (_, i) => centred(g(i)));
    const r = Math.max(...arts.map(a => a.radius()), 0.3), c = (2 * r + (gap == null ? GAP : gap)) / 0.9;
    return spiral(n, golden(c), i => arts[i]);
  }
  // repeat(n, f, x): f applied n times, starting from x
  const repeat = (n, f, x) => { let a = x; for (let i = 0; i < n; i++) a = f(a, i); return a; };
  // cycle(a, b, …): i ↦ the (i mod n)-th, for varying the elements of a spiral or the parts at points
  const cycle = (...xs) => i => xs[i % xs.length];

  // ---- open points
  const seal = a => new Art(art(a).glyphs, []);                                   // no open points
  const every = (k, a) => { a = art(a); return new Art(a.glyphs, index(a.points.filter((_, i) => i % k === 0))); };
  const centrePoint = a => { a = art(a); const c = a.centre; return new Art(a.glyphs, [{ x: c.x, y: c.y, a: 0, s: 1, i: 0, d: depthOf(a) }]); };

  // ---- output: { items, w, h } as Ornament.renderInto wants it, centred
  // (pal: the palette for glyphs that have none of their own, default the theme's; opts.points: mark the open points;
  // opts.bold: heavy strokes (items also carry ix, iy: the ink centre, for callers that centre on ink themselves); opts.origin: keep the art's own origin rather than centring it)
  function render(a, pal, opts) {
    a = opts && opts.origin ? art(a) : centred(a); const base = asPalette(pal || PALETTE);
    const col = g => { if (g.col) return g.col; const p = g.pal || base; return (g.role && p.roles[g.role]) || p.depth[(g.d || 0) % p.depth.length]; };
    const items = a.glyphs.map(g => { const k = ink(g.tok), [c, sn] = axes(g), ox = (g.reflect ? -k.cx : k.cx) * g.s, oy = k.cy * g.s;
      return { tok: g.tok, x: g.x - (ox * c - oy * sn), y: g.y - (ox * sn + oy * c), ix: g.x, iy: g.y, s: g.s, rot: ((g.rot % 360) + 360) % 360, col: col(g), reflect: g.reflect || undefined, bold: opts && opts.bold || undefined }; });
    if (opts && opts.points) for (const p of a.points) items.push({ tok: "•", x: p.x, y: p.y, s: 0.45, rot: 0, col: "var(--muted, #888)" });
    return { items, w: Math.max(1, a.width), h: Math.max(1, a.height), font: fontNow() };
  }
  // ready(doc): the fonts loaded, and the metrics measured in them (art built before this used guesses)
  function ready(doc) {
    const fams = fontNow().split(",").map(f => f.trim()).filter(f => /^['"]/.test(f));
    return Promise.all([].concat(...fams.map(f => doc.fonts ? [doc.fonts.load("16px " + f, "⊗λ│"), doc.fonts.load("800 16px " + f, "⊗λ│")] : []))).catch(() => {}).then(() => { INK.clear(); });
  }
  // loadFont(doc): the glyphs' font, once per page
  function loadFont(doc) {
    if (doc.querySelector("link[data-glyphart-font]")) return;
    const l = doc.createElement("link"); l.rel = "stylesheet"; l.href = FONT_CSS; l.dataset.glyphartFont = ""; doc.head.appendChild(l);
  }

  const API = { glyph, art, nothing, rotate, scale, mirror, shift, turn, tint, palette, role, over, beside, above, row, column, around, ring, dihedral, union, reflect, bilateral, kind, points, attach, walk, arc, curve, along, offset, half, snap, then, at, spiral, golden, swirl, sunflower, repeat, cycle, seal, every, centrePoint };
  // evaluateProgram(src, extra): an expression, or statements ending in `return …`, with the API (and extra) in scope
  function evaluateProgram(src, extra) {
    const scope = Object.assign({}, API, extra), names = Object.keys(scope), vals = Object.values(scope);
    try { return new Function(...names, '"use strict"; return (\n' + src + "\n);")(...vals); } catch (err) { if (!(err instanceof SyntaxError)) throw err; }
    return new Function(...names, '"use strict";\n' + src)(...vals);
  }
  // [group, name, signature, what it does, an example]
  const DOCS = [
    ["Art", "glyph", "glyph(tok, size)", "One glyph; a bare string means the same. Its open point is its top.", "row(['⊗', glyph('λ', 2), '⊕'])"],
    ["Art", "over", "over(a, b, …)", "Superposed, centres together.", "over(glyph('◯', 3), '⊗')"],
    ["Art", "rotate", "rotate(deg, a)", "Turned about its centre.", "row([rotate(0, 'λ'), rotate(90, 'λ'), rotate(180, 'λ'), rotate(270, 'λ')])"],
    ["Art", "scale", "scale(k, a)", "Scaled about its centre.", "row([scale(0.5, '⊗'), '⊗', scale(2, '⊗')])"],
    ["Art", "mirror", "mirror(a)", "Reflected left to right.", "row(['λ', mirror('λ')])"],
    ["Colour", "palette", "palette(cols, a)", "The colours a's glyphs take by depth: a list (accent, green, blue, gold, violet, ink, muted, or any CSS colour), or a named palette: theme, warm, cool, garden, ink, mono.", "palette('warm', around(8, around(4, '⊗', 'α'), 'λ'))"],
    ["Colour", "tint", "tint(colour, a)", "One colour outright, whatever the depth.", "around(8, tint('gold', '⊗'), 'λ')"],
    ["Juxtaposition", "beside", "beside(a, b, gap)", "b just clear of a, on its right.", "beside('⊗', around(6, '⊕', 'λ'))"],
    ["Juxtaposition", "above", "above(a, b, gap)", "a just clear of b, above it.", "above('⊗', around(6, '⊕', 'λ'))"],
    ["Juxtaposition", "row", "row([a, b, …], gap)", "In a row, each just clear of the last.", "row(['⊗', '⊕', '⊗'])"],
    ["Juxtaposition", "column", "column([a, b, …], gap)", "In a column.", "column(['⊗', '⊕', '⊗'])"],
    ["Radial", "around", "around(n, x, y, gap)", "n copies of y facing outward round x, as close as they can be without touching. Open points: n × y's.", "around(6, '⊗', 'λ')"],
    ["Radial", "ring", "ring(n, y, gap)", "around with nothing in the middle.", "ring(8, '∀')"],
    ["Composition", "then", "then(a, k, gap)", "At every open point p (the i-th) of a, k(p, i) standing on it. k may be plain art.", "then(around(6, '⊗', 'λ'), '⋆')"],
    ["Composition", "at", "at(a, k)", "Like then, but centred on each point.", "at(ring(6, 'λ'), '·')"],
    ["Composition", "seal", "seal(a)", "The same art with no open points.", "beside(then(around(4, '⊗', 'λ'), '⋆'), then(seal(around(4, '⊗', 'λ')), '⋆'), 1)"],
    ["Composition", "every", "every(k, a)", "Only every k-th open point.", "then(every(2, around(8, '⊗', 'λ')), '⋆')"],
    ["Composition", "centrePoint", "centrePoint(a)", "One open point, at the centre.", "then(centrePoint(ring(8, 'λ')), '⊗')"],
    ["Iteration", "spiral", "spiral(n, step, f)", "f(i) at the i-th frame of a walk: frame i + 1 = step(frame i, i).", "spiral(24, swirl(30, 1.06, 1.2), cycle('λ', '⊕'))"],
    ["Iteration", "golden", "golden(c)", "A step: the golden angle, at radius c√i (Vogel's sunflower).", "spiral(55, golden(0.9), cycle('⊗', '⊕'))"],
    ["Iteration", "swirl", "swirl(deg, grow, r0)", "A step: turn deg and grow by `grow` (a logarithmic spiral).", "spiral(30, swirl(24, 1.05, 1.5), 'λ')"],
    ["Iteration", "sunflower", "sunflower(n, f, gap)", "The golden spiral, spaced from the size of its elements.", "sunflower(21, i => i % 4 ? '·' : around(4, '⊗', 'λ'))"],
    ["Iteration", "repeat", "repeat(n, f, x)", "f applied n times, starting from x.", "repeat(2, x => around(5, '⊗', scale(0.6, x)), 'λ')"],
    ["Iteration", "cycle", "cycle(a, b, …)", "i ↦ the (i mod n)-th: varies elements.", "sunflower(34, cycle('⊗', '⊕', 'λ'))"],
    ["Art", "turn", "turn(deg, a)", "Turned about the origin (for art grown from a base point), not its centre.", "row([turn(0, 'λ'), turn(45, 'λ')])"],
    ["Colour", "role", "role(name, a)", "What a's glyphs are (stem, leaf, vein, petal, detail, centre, calyx), for palettes that colour by role, like folk.", "palette('folk', union(role('petal', 'λ'), shift(1.5, 0, role('leaf', 'λ')), shift(3, 0, role('centre', '⊙'))))"],
    ["Symmetry", "dihedral", "dihedral(n, x, y, gap)", "2n copies of y round x, alternately mirrored.", "dihedral(4, '⊗', rotate(20, 'λ'))"],
    ["Symmetry", "bilateral", "bilateral(a)", "a and its reflection in the vertical line through the origin.", "bilateral(along(curve([[0, 0], [1.5, -1], [1, -3]]), '│', -0.4))"],
    ["Symmetry", "reflect", "reflect(a)", "Mirrored in the vertical line through the origin.", "union(shift(1, 0, 'λ'), reflect(shift(1, 0, 'λ')))"],
    ["Symmetry", "union", "union(a, b, …)", "Together, nothing moved: for art built round a base point.", "union('⊗', shift(2, 0, 'λ'))"],
    ["Symmetry", "half", "half(side, a)", "Only the half of a above or below its centre line: half ornaments for a divider.", "half('below', around(8, '⊗', 'λ'))"],
    ["Paths", "walk", "walk(n, h, turn)", "A turtle's path from the origin, heading up: n steps of length h, turning turn(i) degrees before each.", "along(walk(12, 0.5, 6), '│', -0.4)"],
    ["Paths", "arc", "arc(r, from, to)", "Part of a circle round the origin.", "along(arc(3, -90, 90), 'λ')"],
    ["Paths", "curve", "curve(points)", "A smooth path through the points.", "along(curve([[0, 0], [2, -1], [0, -3], [2, -4]]), '·', 0.1)"],
    ["Paths", "along", "along(path, a, gap, spread, taper)", "Copies of a laid along a path, turned to follow it (gap < 0: a continuous line). Open points: left and right of every copy, and one at the end.", "along(walk(8, 0.6, 5), '│', -0.4, 60)"],
    ["Composition", "kind", "kind(k, a)", "Every open point of a is of kind k.", "then(kind('x', ring(6, 'λ')), '⋆')"],
    ["Composition", "points", "points(k, a)", "Only the open points of kind k.", "then(points('end', along(walk(8, 0.6, 5), '│', -0.4)), '⊗')"],
    ["Composition", "attach", "attach(a, kind, k, gap)", "k(p, i) standing on every open point of that kind, as then does, but only where it touches nothing already there (it is shrunk, then left out, if it would). Other points stay open.", "attach(along(walk(10, 0.5, 4), '│', -0.4, 55), 'left', 'λ')"]
  ];

  global.GlyphArt = Object.assign({ Art, Space, API, DOCS, collide, centred, transform, deepen, pathAt, pathLength, dir, render, evaluateProgram, loadFont, ready, setFont, ink, HOOKED, PALETTES, NAMED }, API);
  Object.defineProperty(global.GlyphArt, "FONT", { get: fontNow });
})(typeof window !== "undefined" ? window : globalThis);
