// glyphgen.js: generators of glyph art (theme/glyphart.js). A generator takes a random stream (from rng(seed))
// and returns art; its choices are weighted, and the weights and ranges are the knobs that shape what it tends
// to make. Subtypes:
//   radial  — radially symmetric ornaments (rings of parts round a centre), whole or halved
//   leaf    — a pointed leaf, mirror-symmetric, growing up from its base
//   fleur   — a folk-art flower head seen from the side (a tulip): mirror-symmetric, never below its base
//   calyx   — the cup under a head, with a point above for the head and below for the stem
//   stem    — a stem growing up from its base, meandering a little, with leaves and offshoots at its nodes and
//             a head at its end; offshoots are stems too, and end in a bud or flower
//   bouquet — a mirror-symmetric composition of stems, flowers and leaves, like a folk-art panel
(function (global) {
  const A = global.GlyphArt;

  // ---- randomness
  function rng(seed) {
    let h = 1779033703 ^ String(seed).length;
    for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.range = (lo, hi) => lo + (hi - lo) * r();
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.chance = p => r() < p;
    r.pick = (xs, ws) => { if (!ws) return xs[Math.floor(r() * xs.length)]; const t = ws.reduce((m, w) => m + w, 0); let u = r() * t; for (let i = 0; i < xs.length; i++) if ((u -= ws[i]) < 0) return xs[i]; return xs[xs.length - 1]; };
    r.fork = tag => rng(seed + "/" + tag + "/" + Math.floor(r() * 1e9));
    return r;
  }
  const R = x => typeof x === "function" && x.pick ? x : rng(x == null ? Math.random() : x);

  // ---- glyph pools (none hooked: hooked glyphs never turn round a centre)
  const POOLS = {
    centre: ["⊗", "⊕", "⊙", "⊛", "✦", "⋆", "◈", "◎"],
    petal: ["λ", "∀", "Π", "Ψ", "∧", "↑", "⇑", "†", "⊤", "Y", "α", "σ", "π", "∨", "⊥"],
    fill: ["·", "•", "∘", "+", "×", "⋆", "∗"],
    tip: ["⋆", "✦", "•", "∘", "⊙", "◇", "+", "·"],
    stroke: ["│", "∣", "|"],
  };
  const pool = (r, name) => r.pick(POOLS[name]);

  // ---- radial: a centre, then rings of parts, each ring round everything so far. The ornament has one order of
  // symmetry k; each ring holds as many parts as fit round it, rounded down to a multiple of k (or just k, for
  // an open ring). Parts are glyphs, short rays, small rosettes, mirrored pairs, petals, leaves or small heads.
  function part(r, q, folk, airy) {
    const k = r.pick(["glyph", "ray", "rosette", "pair", "fan", "petal", "leaf", "head"], airy ? (folk ? [3, 1, 1, 2, 2, 3, 3, 0] : [6, 3, 2, 2, 2, 0, 0, 0]) : folk ? [2, 1, 1, 1, 1, 4, 3, 2] : [5, 3, 2, 2, 2, 2, 2, 1]);
    const st = airy ? "sparse" : "line";
    const g = pool(r, "petal");
    if (k === "glyph") return A.glyph(g, r.pick([1, 1, 1.2, 0.85]));
    if (k === "ray") return A.attach(A.along([[0, 0], [0, -r.range(0.8, 1.6)]], pool(r, "fill"), 0.05, 60, 0.7), "end", A.glyph(g, 0.9), 0.05);
    if (k === "rosette") return A.scale(r.range(0.5, 0.7), A.around(r.pick([4, 5, 6]), pool(r, "centre"), g));
    if (k === "fan") return A.union(A.rotate(-22, g), A.shift(0, -0.25, A.glyph(pool(r, "fill"), 0.7)), A.rotate(22, g));
    if (k === "petal") return A.scale(r.range(0.45, 0.7), petal(r.fork("p" + q), { style: st, stripes: airy ? 0 : null }));
    if (k === "leaf") return A.scale(r.range(0.5, 0.75), leaf(r.fork("l" + q), { style: st, veins: !airy && r.chance(0.4), rib: !airy }));
    if (k === "head") return A.scale(r.range(0.35, 0.5), fleur(r.fork("f" + q)));
    const t = A.rotate(r.range(15, 35), g); return A.beside(A.mirror(t), t, 0.02);
  }
  function radial(seed, o) {
    const r = R(seed); o = Object.assign({ rings: r.pick([2, 3, 3, 4]), budget: 1400, folk: r.chance(0.5) }, o || {});
    const sym = o.even ? r.pick([6, 8, 8, 10, 12]) : r.pick([5, 6, 6, 8, 8, 10, 12]);
    let a = A.role("centre", A.glyph(pool(r, "centre"), r.pick([1.3, 1.5, 1.7])));
    for (let q = 0; q < o.rings; q++) {
      const p0 = q === 0 && r.chance(0.5) ? A.glyph(pool(r, "fill"), 0.8) : part(r, q, o.folk, o.airy), gap = o.airy ? r.pick([0.35, 0.5, 0.7]) : r.pick([0.1, 0.15, 0.25]);
      const reach = Math.max(...[0, 45, 90, 135, 180, 225, 270, 315].map(t => a.extent(t))), wide = p0.width + gap;
      const fit = Math.floor(2 * Math.PI * (reach + gap + p0.extent(180)) / wide);
      let n = Math.max(sym, sym * Math.floor(fit / sym)); if (r.chance(o.airy ? 0.5 : 0.25)) n = sym;
      const pairs = r.chance(0.25) && n % 2 === 0, ring = m => pairs && m % 2 === 0 ? A.dihedral(m / 2, a, p0, gap) : A.around(m, a, p0, gap);
      let next = ring(n);
      if (next.glyphs.length > o.budget && n > sym) next = ring(sym);               // too heavy: an open ring instead
      if (next.glyphs.length > o.budget || (o.maxR && q > 0 && next.radius() > o.maxR)) break;   // too heavy, or past the room it has
      a = next;
      if (r.chance(0.3) && q < o.rings - 1) a = A.attach(a, "tip", A.glyph(pool(r, "tip"), 0.7), 0.08);
    }
    if (r.chance(0.45)) a = A.attach(a, "tip", A.glyph(pool(r, "tip"), 0.75), 0.08);
    return A.seal(a);
  }
  // halfRadial(seed, side): a radial ornament halved along a mirror line, for the divider
  const halfRadial = (seed, side) => A.half(side || "above", radial(seed));

  // ---- light drawing: light(f) runs f with lines dashed, outlines sparse and no stripes or veins (fewer glyphs,
  // for ornaments drawn many at a time)
  let LIGHT = false;
  const light = f => { const was = LIGHT; LIGHT = true; try { return f(); } finally { LIGHT = was; } };
  // ---- lines and outlines
  // line(P, size, glyph): a continuous line along the path, of stroke glyphs just overlapping
  const line = (P, size, g, taper, spread) => { const s = A.glyph(g || "│", size || 1); return A.along(P, s, LIGHT ? 0.12 : -0.5 * s.height, spread == null ? 60 : spread, taper); };
  // dotted(P, size, glyph): glyphs along the path, just apart
  const dotted = (P, size, g, gap) => A.along(P, A.glyph(g || "·", size || 1), gap == null ? 0.04 : gap, 60);
  const outline = (r, style, P, size) => LIGHT ? dotted(P, size * 1.2, "·", 0.35) : style === "dots" ? dotted(P, size * 1.1, "•", 0.02) : style === "sparse" ? dotted(P, size * 1.2, "·", 0.35) : style === "glyph" ? dotted(P, size * 0.9, r.pick(["λ", "∧", "α"]), 0.02) : line(P, size);

  // ---- leaf(seed, {len, width, style}): a pointed leaf growing up from its base: two mirrored edges and a midrib
  function leaf(seed, o) {
    const r = R(seed); o = Object.assign({ len: r.range(2.2, 3.6), style: r.pick(["line", "line", "dots"], [3, 1, 1]) }, o || {});
    const L = o.len, W = o.width || L * r.range(0.24, 0.34), sz = Math.max(0.45, L / 5);
    const edge = A.curve([[0, 0], [W * 0.95, -L * 0.28], [W * 0.8, -L * 0.62], [0, -L]]);
    const parts = [A.role("leaf", A.bilateral(outline(r, o.style, edge, sz)))];
    if (o.rib !== false && !LIGHT) parts.push(A.role("vein", A.deepen(line([[0, -0.25 * sz], [0, -L * 0.8]], sz * 0.75), 1)));
    if (o.veins && !LIGHT) for (let t = 0.22; t < 0.72; t += 0.16) parts.push(A.role("vein", A.deepen(A.bilateral(line([[0.1, -L * t], [W * 0.55 * Math.sin(Math.PI * (t + 0.1)), -L * (t + 0.14)]], sz * 0.5)), 1)));
    return A.seal(A.union(...parts));
  }
  // petal(seed, {len, width, lobes}): a broad rounded petal from its base, for round flowers
  function petal(seed, o) {
    const r = R(seed); o = Object.assign({ len: r.range(2, 3), style: r.pick(["line", "dots"], [3, 1]) }, o || {});
    const L = o.len, W = o.width || L * r.range(0.35, 0.5), sz = Math.max(0.45, L / 5), notch = o.notch == null ? r.chance(0.4) : o.notch;
    const edge = A.curve(notch ? [[0, 0], [W * 0.8, -L * 0.3], [W, -L * 0.7], [W * 0.55, -L], [0.01, -L * 0.88]] : [[0, 0], [W * 0.85, -L * 0.3], [W * 0.9, -L * 0.72], [0, -L]]);
    const parts = [A.role("petal", A.bilateral(outline(r, o.style, edge, sz)))];
    const stripes = LIGHT ? 0 : o.stripes == null ? r.pick([1, 2, 3]) : o.stripes;
    for (let q = 0; q < stripes; q++) { const f = (q + 1) / (stripes + 1);
      parts.push(A.role("detail", A.deepen(A.bilateral(line(A.curve([[W * 0.08 * f, -L * 0.18], [W * 0.55 * f, -L * 0.45], [W * 0.5 * f, -L * (0.78 - 0.1 * f)]]), sz * 0.55)), 1))); }
    if (stripes % 2 === 1) parts.push(A.role("detail", A.deepen(line([[0, -L * 0.2], [0, -L * 0.7]], sz * 0.55), 1)));
    return A.seal(A.union(...parts));
  }
  // fleur(seed, {height, style}): a flower head from the side: outer lobes, a centre lobe, and inner stripes;
  // mirror-symmetric, growing up (never below) its base
  function fleur(seed, o) {
    const r = R(seed); o = Object.assign({ height: r.range(3, 4.6), style: r.pick(["tulip", "crown", "bell", "flame"]) }, o || {});
    const H = o.height, W = H * r.range(0.5, 0.7), sz = Math.max(0.5, H / 6), parts = [];
    const lobe = P => A.role("petal", A.bilateral(line(A.curve(P), sz)));
    if (o.style === "tulip") {
      parts.push(lobe([[0.1, 0], [W * 0.6, -H * 0.15], [W * 0.62, -H * 0.6], [W * 0.3, -H]]));
      parts.push(A.deepen(lobe([[0.01, -H * 0.1], [W * 0.3, -H * 0.5], [0.01, -H * 1.08]]), 1));
    } else if (o.style === "crown") {
      parts.push(lobe([[0.1, 0], [W * 0.55, -H * 0.2], [W * 0.75, -H * 0.62], [W * 0.95, -H * 0.95]]));
      parts.push(A.deepen(lobe([[0.02, -H * 0.12], [W * 0.28, -H * 0.55], [W * 0.18, -H * 0.8], [0.01, -H * 1.05]]), 1));
    } else if (o.style === "bell") {
      parts.push(lobe([[0.1, 0], [W * 0.45, -H * 0.2], [W * 0.5, -H * 0.7], [W * 0.8, -H * 0.95]]));
      parts.push(A.deepen(A.bilateral(dotted(A.curve([[W * 0.15, -H * 0.25], [W * 0.25, -H * 0.6], [W * 0.3, -H * 0.85]]), sz * 0.8, "·", 0.05)), 1));
    } else {
      parts.push(lobe([[0.1, 0], [W * 0.7, -H * 0.25], [W * 0.45, -H * 0.7], [0.01, -H * 1.1]]));
      parts.push(A.deepen(lobe([[0.01, -H * 0.2], [W * 0.3, -H * 0.45], [0.01, -H * 0.85]]), 1));
    }
    if (r.chance(0.6)) parts.push(A.role("centre", A.deepen(A.shift(0, -H * 0.02, A.glyph(r.pick(["⊙", "◇", "•", "∘"]), sz)), 2)));
    return A.seal(A.role("detail", A.union(...parts)));
  }
  // calyx(seed, {size}): the small cup under a head: a bowl with a sepal tip at each end
  function calyx(seed, o) {
    const r = R(seed), k = (o && o.size) || r.range(1.1, 1.4), sz = 0.6 * k;
    const bowl = A.bilateral(line(A.curve([[0, 0], [0.35 * k, -0.12 * k], [0.7 * k, -0.55 * k]]), sz));
    const tip = A.bilateral(A.shift(0.78 * k, -0.78 * k, A.turn(35, A.glyph(r.pick(["∧", "•", "◇"]), sz))));
    return A.seal(A.role("calyx", A.union(bowl, A.deepen(tip, 1))));
  }
  // head(seed): a fleur on its calyx
  const head = (seed, o) => { const r = R(seed); return A.above(fleur(r.fork("fleur"), o), calyx(r.fork("calyx")), 0.05); };
  // bloom(seed, {petals}): a round folk flower: petals round a centre ringed with dots
  function bloom(seed, o) {
    const r = R(seed); o = Object.assign({ petals: r.pick([5, 6, 6, 8]) }, o || {});
    const c0 = A.role("centre", A.glyph(r.pick(["⊙", "⊗", "⊛", "◎"]), r.range(1.1, 1.5)));
    const centre = r.chance(0.7) ? A.role("detail", A.around(r.pick([8, 10, 12]), c0, A.glyph(r.pick(["·", "•", "∘"]), 0.7), 0.08)) : c0;
    return A.seal(A.around(o.petals, centre, petal(r.fork("petal"), o.petal), 0.1));
  }

  // bud(seed, size): what an offshoot ends in: a small head, a small bloom, or a cluster
  function bud(seed, size) {
    const r = R(seed), k = size || 1, t = r.pick(["head", "bloom", "cluster", "fleur"], [3, 2, 2, 2]);
    if (t === "head") return A.scale(0.45 * k, head(r.fork("h")));
    if (t === "fleur") return A.scale(0.5 * k, fleur(r.fork("f"), { height: 2.4 }));
    if (t === "bloom") return A.scale(0.32 * k, bloom(r.fork("b"), { petals: r.pick([5, 6]) }));
    return A.seal(A.scale(0.8 * k, A.around(r.pick([5, 6]), A.role("centre", r.pick(["⊙", "•", "◎"])), A.role("petal", A.glyph(r.pick(["·", "∘", "•"]), 0.8)), 0.05)));
  }
  // stem(seed, {len, bend, wander, size, head, pattern, every, leaf, shoots, depth}): a stem growing up from its
  // base, turning `bend` degrees in all and wandering a little, with leaves at its nodes (opposite pairs or
  // alternating), `shoots` symmetric pairs of offshoots (stems themselves, ending in buds), and a head at its end
  function stem(seed, o) {
    const r = R(seed);
    o = Object.assign({ len: r.range(6, 10), bend: r.range(-25, 25), wander: 3, size: 0.8, pattern: r.pick(["opposite", "alternate"]), every: r.int(2, 3),
      leafLen: null, shoots: 0, depth: 1, head: "auto", taper: 0.7, spread: r.range(45, 62), leaves: 1 }, o || {});
    const h = 0.4, n = Math.max(3, Math.round(o.len / h)); let heading = 0;
    const P = A.walk(n, h, i => { const t = o.bend / n + r.range(-o.wander, o.wander) - 0.1 * (heading - o.bend * i / n); heading += t; return t; });
    const st = A.role("stem", line(P, o.size, "│", o.taper, o.spread));
    // choose the nodes: one per `every` copies, from a third of the way up to near the top
    const m = (st.points.length - 1) / 2, pts = [], end = st.points[st.points.length - 1];
    const nodes = []; for (let k = Math.round(m * 0.3); k < m * 0.88; k += o.every) nodes.push(k);
    const shootAt = new Set(); for (let q = 0; q < o.shoots && nodes.length; q++) shootAt.add(nodes[Math.min(nodes.length - 1, Math.round((q + 0.5) * nodes.length / Math.max(1, o.shoots)) - 1 + (q % 2))]);
    nodes.forEach((k, q) => {
      const L = st.points[2 * k], Rr = st.points[2 * k + 1];
      if (shootAt.has(k)) { pts.push(Object.assign({}, L, { kind: "shootL" }), Object.assign({}, Rr, { kind: "shootR" })); return; }
      if (!r.chance(o.leaves)) return;
      if (o.pattern === "opposite") pts.push(Object.assign({}, L, { kind: "leafL" }), Object.assign({}, Rr, { kind: "leafR" }));
      else pts.push(Object.assign({}, q % 2 ? L : Rr, { kind: q % 2 ? "leafL" : "leafR" }));
    });
    pts.push(Object.assign({}, end, { kind: "end" }));
    let a = new A.Art(st.glyphs, pts);
    const hd = o.head === "auto" ? (o.depth > 0 ? r.pick([head, bloom, fleur], [3, 2, 1])(r.fork("head")) : bud(r.fork("bud"))) : typeof o.head === "function" ? o.head(r.fork("head")) : o.head;
    if (hd) a = A.attach(a, "end", o.head === "auto" && o.depth > 0 && hd.width > 6 ? A.scale(6 / hd.width, hd) : hd, 0.05);
    if (o.shoots) {
      const sh = stem(r.fork("shoot"), { len: o.len * r.range(0.35, 0.5), bend: -r.range(10, 30), size: o.size * 0.8, pattern: o.pattern, every: o.every, shoots: 0, depth: o.depth - 1, head: o.depth - 1 > 0 ? "auto" : bud(r.fork("sbud")), leaves: 0.8 });
      a = A.attach(A.attach(a, "shootR", sh, 0.08), "shootL", A.mirror(sh), 0.08);
    }
    const lf0 = leaf(r.fork("leaf"), { len: o.leafLen || r.range(1.8, 2.8) * o.size, veins: o.veins == null ? r.chance(0.5) : o.veins }), pet = 0.25 + 0.12 * lf0.height;
    const lf = A.union(A.role("stem", line([[0, 0], [0, -pet]], o.size * 0.6)), A.shift(0, -pet - 0.05, lf0));   // on a short stalk, clear of the stem
    a = A.attach(A.attach(a, "leafR", A.turn(8, lf), 0.1), "leafL", A.mirror(A.turn(8, lf)), 0.1);
    return A.seal(a);
  }

  // ---- composition
  // symmetric(a): exactly mirror-symmetric: a's right half (and anything on the axis), with its reflection
  const symmetric = a => { a = A.art(a); return A.bilateral(new A.Art(a.glyphs.filter(g => g.x >= -0.05), [])); };
  // placeAt(a, x, y, deg, k): a (grown from its origin) turned deg about its origin, scaled k, its origin moved to (x, y)
  const put = (a, x, y, deg, k) => A.transform(A.art(a), { rot: deg || 0, k: k || 1, dx: x, dy: y });
  // bouquet(seed, {height}): a folk-art panel, mirror-symmetric about its vertical axis: a central column (a small
  // head at the foot, a large bloom on a leafy stem, a head above it), two leafy branches arching from the foot,
  // then flowering stems, buds and sprigs placed in the left half wherever they touch nothing (each mirrored to
  // the right), and small things filling what room is left
  function bouquet(seed, o) {
    const r = R(seed); o = Object.assign({ height: r.range(44, 56) }, o || {});
    const H = o.height, W = H * r.range(0.68, 0.8), space = new A.Space(2), out = [], GAP = 0.3;
    const addPair = a => { space.add(a); out.push(a); const m = A.reflect(a); space.add(m); out.push(m); };
    const addOne = a => { space.add(a); out.push(a); };
    const inside = (a, left) => { const b = a.box; return b.x0 >= -W / 2 && b.y0 >= -H && b.y1 <= 0.5 && (!left || b.x1 <= -0.4); };
    // the column
    const foot = symmetric(stem(r.fork("foot"), { len: H * 0.1, bend: 0, wander: 0, pattern: "opposite", every: 2, head: A.scale(1.1, head(r.fork("fh"))), leafLen: 2.6 }));
    const main = symmetric(stem(r.fork("main"), { len: H * 0.26, bend: 0, wander: 0, pattern: "opposite", every: r.int(4, 5), leafLen: r.range(5, 6.5), size: 1.2, veins: true,
      head: A.scale(r.range(1.5, 1.8), bloom(r.fork("mb"), { petals: r.pick([5, 6, 6, 8]), petal: { len: 3.4, stripes: 3 } })), shoots: r.pick([0, 0, 1]) }));
    const top = symmetric(stem(r.fork("top"), { len: H * 0.12, bend: 0, wander: 0, pattern: "opposite", every: 3, leafLen: 3, head: A.scale(1.5, head(r.fork("th"))) }));
    let y = 0;
    for (const c of [foot, main, top]) { const pl = put(c, 0, y - c.box.y1); if (pl.box.y0 < -H) break; addOne(pl); y = pl.box.y0 - GAP; }
    // the arches
    const arch = stem(r.fork("arch"), { len: H * r.range(0.42, 0.55), bend: r.range(40, 60), wander: 2, pattern: r.pick(["opposite", "alternate"]), every: 2, leafLen: r.range(2, 2.6), head: r.chance(0.5) ? bud(r.fork("ab")) : null, taper: 0.6 });
    for (const deg of [-62, -70, -55, -78]) { const a = put(arch, -0.8, -0.2, deg); if (inside(a, true) && !space.hits(a, GAP)) { addPair(a); break; } }
    // flowering stems, then buds and sprigs, then small things
    const kinds = [
      { n: 5, make: q => stem(r.fork("fs" + q), { len: r.range(7, 11), bend: r.range(-30, 10), shoots: r.pick([0, 1]), head: r.pick([bloom, head, fleur], [3, 3, 1])(r.fork("fh" + q)), leafLen: r.range(1.8, 2.4) }), k: [0.6, 1] },
      { n: 6, make: q => stem(r.fork("bs" + q), { len: r.range(4, 7), bend: r.range(-30, 30), head: bud(r.fork("bb" + q), 1.3), depth: 0, leafLen: 1.8 }), k: [0.6, 1] },
      { n: 10, make: q => r.pick([() => A.scale(0.5, bloom(r.fork("sb" + q))), () => bud(r.fork("sd" + q), 1.2), () => A.union(leaf(r.fork("sl" + q), { len: 2.2 }), A.turn(40, leaf(r.fork("sm" + q), { len: 1.8 })))])(), k: [0.6, 1] },
    ];
    for (const kd of kinds) for (let q = 0; q < kd.n; q++) {
      const a0 = kd.make(q);
      for (let t = 0; t < 40; t++) {
        const a = put(a0, r.range(-W / 2, -2), r.range(-H, -1), r.range(-60, 20), r.range(kd.k[0], kd.k[1]));
        if (inside(a, true) && !space.hits(a, GAP)) { addPair(a); break; }
      }
    }
    return A.seal(A.union(...out));
  }

  // ---- ornament: the mathematical glyphs as material. Lines are chains of glyphs, flowers are rosettes of them in
  // colours of their own, and curls (tendrils winding into a spiral, trailed by dots) join everything up.
  const ACCENTS = ["accent", "green", "blue", "gold", "violet"];
  const MATH = {
    line: ["∘", "·", "∼", "λ", "∫", "≀"],
    dot: ["·", "•", "∘", "∙"],
    spike: ["∣", "†", "∧", "↑", "⊤", "ı"],
    centre: ["⊗", "⊕", "⊙", "⊛", "⊚", "◈", "✦", "⋆", "⊞", "⊘"],
    leaf: ["λ", "∧", "α", "γ", "ν"],
  };
  const LYING = /[∼≈~⋯]/;                                    // glyphs whose length is across: turned to lie along a line
  // jewel(r, n): n different colours from the palette, for one flower
  const jewel = (r, n) => { const cs = ACCENTS.slice(); for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; } return cs.slice(0, n || 3); };
  // chain(P, g, size, gap, taper): glyph g along the path
  const chain = (P, g, size, gap, taper) => { const b = LYING.test(g) ? A.rotate(90, A.glyph(g, size || 1)) : A.glyph(g, size || 1);
    return A.along(P, b, (gap == null ? (LYING.test(g) ? -0.2 : 0.03) : gap) + (LIGHT ? 0.22 : 0), 60, taper); };
  // trail(P, d, g, size): dots beside a path, d to its right (negative: its left)
  const trail = (P, d, g, size) => A.along(A.offset(P, d), A.glyph(g || "·", size || 0.5), LIGHT ? 0.6 : 0.3, 60);

  // rosette(seed, {size, rings, kind}): a flower of maths glyphs in colours of its own: rings round a centre, a
  // many-rayed star, or a daisy of spikes
  function rosette(seed, o) {
    const r = R(seed); o = Object.assign({ size: 1, kind: r.pick(["rings", "star", "daisy"], [4, 2, 2]) }, o || {});
    o.size = Math.max(0.6, o.size); const cols = jewel(r, 3), c = A.glyph(r.pick(MATH.centre), 1.3);
    let a;
    if (o.kind === "star") {
      const n = r.pick([8, 10, 12, 16]), core = A.around(r.pick([6, 8]), c, A.glyph(r.pick(MATH.dot), 0.6), 0.08);
      const ray = A.attach(chain([[0, 0], [0, -r.range(1, 1.8)]], r.pick(["·", "∘", "∣"]), 0.7, 0.05, 0.6), "end", A.glyph(r.pick(["⋆", "✦", "∘", "•", "◇"]), 0.8), 0.05);
      a = A.around(n, core, ray, 0.1);
    } else if (o.kind === "daisy") {
      const core = A.around(r.pick([8, 10, 12]), c, A.glyph(r.pick(MATH.dot), 0.65), 0.06);
      a = A.around(r.pick([12, 16, 18, 20]), core, A.scale(r.range(0.8, 1.1), A.glyph(r.pick(MATH.spike), 1.2)), 0.05);
      if (r.chance(0.6)) a = A.attach(a, "tip", A.glyph(r.pick(MATH.dot), 0.55), 0.05);
    } else a = radial(r.fork("rings"), { rings: o.rings || r.pick([2, 2, 3]), folk: false, budget: 400 });
    return A.seal(A.palette(cols, A.scale(o.size, a)));
  }
  // curl(seed, {size, turns, glyph}): a tendril from its base, heading up and winding into a spiral, trailed by dots
  // on its outer side, perhaps with a small rosette at its heart
  function curl(seed, o) {
    const r = R(seed); o = Object.assign({ size: r.range(0.8, 1.1), turns: r.range(1, 1.6), glyph: r.pick(["∘", "∼", "λ", "∫", "≀"]), dir: r.pick([1, -1]) }, o || {});
    const n = 30, t0 = 2, dt = (360 * o.turns - n * t0) * 2 / (n * n), h = 0.42 * o.size * 1.3;
    const P = A.walk(n, h, i => o.dir * (t0 + i * dt)), parts = [];
    parts.push(A.tint("green", chain(P, o.glyph, o.size * 0.85, null, 0.7)));
    if (r.chance(0.7)) parts.push(A.tint(r.pick(["gold", "accent", "violet"]), trail(P.slice(0, Math.round(n * 0.75)), -o.dir * 0.55 * o.size, r.pick(MATH.dot), 0.45 * o.size)));
    let a = A.union(...parts);
    return A.seal(a);
  }
  // mleaf(seed, {len, style}): a leaf drawn in maths glyphs: an outline chain with a midrib, a herringbone of
  // glyphs, or one large glyph
  function mleaf(seed, o) {
    const r = R(seed); o = Object.assign({ len: r.range(1.4, 2.4), style: r.pick(["outline", "herring", "glyph"], [3, 2, 1]), col: r.pick(["green", "green", "blue"]) }, o || {});
    const L = o.len, W = L * 0.34, sz = Math.max(0.55, L / 4.5);
    let a;
    if (o.style === "glyph") a = A.glyph(r.pick(MATH.leaf), Math.max(1.2, L * 0.7));
    else if (o.style === "herring") {
      const rib = chain([[0, 0], [0, -L]], "·", sz * 0.8, 0.05), g = r.pick(["∧", "λ", "ν"]);
      const barbs = []; for (let t = 0.22; t < 0.85; t += 0.2) { const k = Math.max(0.6, sz * 1.3 * (1 - t * 0.4)); barbs.push(A.bilateral(A.shift(k * 0.45, -L * t, A.turn(40, A.glyph(g, k))))); }
      a = A.union(rib, A.tint(o.col, A.union(...barbs)));
    } else {
      const edge = A.curve([[0, 0], [W * 0.95, -L * 0.3], [W * 0.75, -L * 0.65], [0, -L]]);
      a = A.union(A.bilateral(chain(edge, r.pick(["·", "∘", "•"]), sz * 1.1, 0.02)), A.tint(r.pick(ACCENTS), chain([[0, -0.2], [0, -L * 0.8]], r.pick(["·", "λ"]), sz * 0.7, 0.04)));
    }
    return A.seal(A.tint(o.col, a));
  }
  // branch(seed, {len, bend, size, glyph, head, depth, pattern}): a line of glyphs growing up from its base with
  // leaves, curls and (while depth lasts) smaller branches at its nodes, and a head (a rosette) at its end
  function branch(seed, o) {
    const r = R(seed);
    o = Object.assign({ len: r.range(4, 7), bend: r.range(-30, 30), wander: 2, size: 0.9, glyph: r.pick(["∘", "∼", "∫", "λ"]), depth: 1, pattern: r.pick(["opposite", "alternate"]), every: 2,
      head: null, leaf: null, curls: 0.25, twigs: 0.35, spread: r.range(45, 65) }, o || {});
    const h = 0.4, n = Math.max(3, Math.round(o.len / h)); let heading = 0;
    const P = A.walk(n, h, i => { const t = o.bend / n + r.range(-o.wander, o.wander) - 0.1 * (heading - o.bend * i / n); heading += t; return t; });
    const st = A.tint("green", chain(P, o.glyph, o.size, null, 0.85));
    const pts = st.points, m = (pts.length - 1) / 2, keep = [];
    for (let k = Math.max(1, Math.round(m * 0.25)), q = 0; k < m * 0.9; k += o.every, q++) {
      const what = () => o.depth > 0 && r.chance(o.twigs) ? "twig" : r.chance(o.curls) ? "curl" : "leaf";
      if (o.pattern === "opposite") { const w = what(); keep.push(Object.assign({}, pts[2 * k], { kind: w + "L" }), Object.assign({}, pts[2 * k + 1], { kind: w + "R" })); }
      else { const sd = q % 2; keep.push(Object.assign({}, pts[2 * k + sd], { kind: what() + (sd ? "R" : "L") })); }
    }
    keep.push(Object.assign({}, pts[pts.length - 1], { kind: "end" }));
    let a = new A.Art(st.glyphs, keep);
    if (o.head !== false) a = A.attach(a, "end", o.head || rosette(r.fork("head"), { size: r.range(0.75, 0.95), rings: 2 }), 0.05);
    const tw = o.depth > 0 ? branch(r.fork("twig"), { len: o.len * r.range(0.4, 0.55), bend: -r.range(10, 35), size: Math.max(0.7, o.size * 0.85), glyph: o.glyph, depth: o.depth - 1,
      head: rosette(r.fork("th"), { size: r.range(0.6, 0.75), rings: 1 + (r() < 0.4) }) }) : null;
    const cu = curl(r.fork("curl"), { size: Math.max(0.75, o.size * 0.85) }), lf = o.leaf || mleaf(r.fork("leaf"), { len: 1.5 * o.size + 0.6 });
    if (tw) a = A.attach(A.attach(a, "twigR", tw, 0.08), "twigL", A.mirror(tw), 0.08);
    a = A.attach(A.attach(a, "curlR", cu, 0.08), "curlL", A.mirror(cu), 0.08);
    a = A.attach(A.attach(a, "leafR", lf, 0.08), "leafL", A.mirror(lf), 0.08);
    return A.seal(a);
  }
  // bush(seed, {height}): a symmetric flowering bush, after Mughal ornament: a line of glyphs sending out pairs of
  // branches that curve up and end in rosettes, dense with leaves and curls, a large rosette at the top and
  // leaves and curls spreading from the foot
  function bush(seed, o) {
    const r = R(seed); o = Object.assign({ height: r.range(12, 18) }, o || {});
    const H = o.height, g = r.pick(["∘", "·", "∼", "∫"]);
    const main = branch(r.fork("main"), { len: H * 0.75, bend: 0, wander: 0, size: 1, glyph: g, depth: 2, pattern: "opposite", every: r.int(3, 4), twigs: 0.7, curls: 0.3,
      head: rosette(r.fork("top"), { size: r.range(0.9, 1.2) }), spread: r.range(50, 65) });
    const footL = r.pick([curl(r.fork("fc"), { size: 1.1 }), mleaf(r.fork("fl"), { len: 3, style: "outline" })]);
    const foot = A.union(A.transform(footL, { rot: 70, dx: 0.4, dy: -0.2 }), A.transform(mleaf(r.fork("fl2"), { len: 2.4 }), { rot: 45, dx: 0.4, dy: -1.2 }));
    const sp = new A.Space().add(main), f = sp.hits(foot, 0.1) ? A.art(null) : foot;
    return A.seal(symmetric(A.union(main, f)));
  }
  // medallion(seed): a rosette with bushes round it, facing out, and a ring of curls or rosettes beyond
  function medallion(seed, o) {
    const r = R(seed), n = r.pick([4, 5, 6]);
    const b = branch(r.fork("b"), { len: r.range(4, 6), bend: 0, wander: 0, depth: 0, pattern: "opposite", every: 3, curls: 0.2 });
    let a = A.around(n, rosette(r.fork("c"), { size: r.range(1.1, 1.4), kind: "rings", rings: 2 }), symmetric(b), 0.2);
    if (r.chance(0.5)) a = A.around(n, a, curl(r.fork("k"), { turns: 1.3, size: 1 }), 0.25);
    return A.seal(a);
  }
  // panel(seed, {height}): a mirror-symmetric panel: a bush at the foot of the axis with a medallion or a large
  // rosette above it, then branches, rosettes, curls, leaves and a scatter of dots and stars, each placed in the
  // left half where it touches nothing and mirrored to the right, largest first
  function panel(seed, o) {
    const r = R(seed); o = Object.assign({ height: r.range(34, 44) }, o || {});
    const H = o.height, W = H * r.range(0.72, 0.85), space = new A.Space(2), out = [], GAP = 0.25;
    const inside = (a, left) => { const b = a.box; return b.x0 >= -W / 2 && b.y0 >= -H && b.y1 <= 0.3 && (!left || b.x1 <= -0.3); };
    const add = (a, pair) => { space.add(a); out.push(a); if (pair) { const m = A.reflect(a); space.add(m); out.push(m); } };
    const b = bush(r.fork("bush"), { height: H * r.range(0.42, 0.52) }); add(A.transform(b, { dy: -b.box.y1 }));
    const topper = r.chance(0.5) ? medallion(r.fork("med")) : rosette(r.fork("top"), { size: r.range(1.6, 2.2), kind: "rings", rings: 3 });
    for (const y of [-H * 0.8, -H * 0.75, -H * 0.85]) { const t = A.transform(A.centred(topper), { dy: y }); if (inside(t) && !space.hits(t, GAP)) { add(t); break; } }
    const kinds = [
      [4, () => branch(r.fork("br"), { len: r.range(6, 10), depth: 1 }), [-55, 25]],
      [8, () => rosette(r.fork("ro"), { size: r.range(0.8, 1.3) }), [-180, 180]],
      [10, () => curl(r.fork("cu"), { size: r.range(0.9, 1.3) }), [-180, 180]],
      [12, () => mleaf(r.fork("le"), { len: r.range(1.6, 2.6) }), [-180, 180]],
      [60, () => A.tint(r.pick(ACCENTS), A.glyph(r.pick(["·", "•", "∘", "⋆", "✦", "+", "×"]), r.range(0.55, 0.9))), [0, 0]],
    ];
    for (const [cnt, make, rot] of kinds) for (let q = 0; q < cnt; q++) {
      const a0 = make();
      for (let t = 0; t < 36; t++) { const a = A.transform(a0, { rot: r.range(rot[0], rot[1]), dx: r.range(-W / 2, -1), dy: r.range(-H, 0) });
        if (inside(a, true) && !space.hits(a, GAP)) { add(a, true); break; } }
    }
    return A.seal(A.union(...out));
  }
  // field(seed, {width, height}): the ornaments scattered to fill a field, largest first, each where it touches nothing
  function field(seed, o) {
    const r = R(seed); o = Object.assign({ width: 40, height: 28 }, o || {});
    const W = o.width, H = o.height, space = new A.Space(2), out = [];
    const kinds = [[3, () => bush(r.fork("b"), { height: r.range(8, 11) })], [6, () => branch(r.fork("r"), { len: r.range(5, 9), depth: 1 })], [10, () => rosette(r.fork("o"), { size: r.range(0.75, 1.1) })],
      [10, () => curl(r.fork("c"), { size: r.range(0.7, 1.2) })], [12, () => mleaf(r.fork("l"))], [30, () => A.tint(r.pick(ACCENTS), A.glyph(r.pick(MATH.dot.concat(["⋆", "✦"])), r.range(0.5, 0.9)))]];
    for (const [cnt, make] of kinds) for (let q = 0; q < cnt; q++) {
      const a0 = make();
      for (let t = 0; t < 30; t++) { const a = A.transform(a0, { rot: r.range(-35, 35), dx: r.range(-W / 2, W / 2), dy: r.range(-H / 2, H / 2) }), b = a.box;
        if (b.x0 >= -W / 2 && b.x1 <= W / 2 && b.y0 >= -H / 2 && b.y1 <= H / 2 && !space.hits(a, 0.2)) { space.add(a); out.push(a); break; } }
    }
    return A.seal(A.union(...out));
  }

  // ---- symbols: ornaments that show their glyphs. Every glyph is drawn at a readable size (at least MIN), there
  // are no lines of small glyphs, and the structure is the arrangement of distinct symbols, each rosette in
  // colours of its own.
  const MIN = 1.4;
  const SYM = {
    common: ["Σ", "Π", "σ", "π", "β", "η", "λ", "→", "⇒", "⊸", "≅", "よ", "⊎", "ℕ", "∀", "∃", "⊤", "⊥", "⊢", "Γ", "Δ"],
    rare: ["Φ", "α", "&", "⅋", "⊗", "+", "×", "⟜", "≡", "∫", "∪", "∩", "ℝ", "≃", "≈", "#"],
    // delimiters, each with what may go between: semantic brackets round a term or type, braces round a set's
    // elements, the ceiling round a number or variable. A delimited symbol is set as one upright unit.
    delimited: [["⟦", "⟧", ["M", "N", "A", "B", "λ", "Π", "⊤"]], ["{", "}", ["x", "∗", "x, y", "⊤", "A"]], ["⌈", "⌉", ["x", "n", "π", "½"]]],
    fleuron: ["✿", "❀", "❁", "❦", "❧", "⚘", "☙", "🞴", "🞷", "᪥", "✾", "❋", "✤", "❃", "⌘"],
    hub: ["⊗", "⊕", "✦", "⊙", "⊛", "◈", "✿", "❀", "❁", "❋", "✾", "🞴", "🞷", "᪥", "⌘"],
    fill: ["·", "•", "∘", "+", "×", "⋆"],
  };
  // expressions: short judgements and equations, each one upright unit of text
  SYM.exprs = ["∙ ⊢ M : A", "Γ ⊢ M : A", "Γ ⊢ A type", "Γ ⊢ Δ ctx", "1 + 1 = 2", "よ(A × B) ≅ よA × よB", "Γ, x : A ⊢ M : B", "λx. M", "A ⊸ B", "A ⊗ B ⊢ C",
    "Σ x : A. B", "Π x : A. B", "f ∘ g", "F ⊣ G", "η : 1 ⇒ GF", "A ≃ B", "ℕ ≅ 1 + ℕ", "⊤ ⊢ A", "A ⊢ ⊥", "a ≡ b", "M ⇒ V", "∀ x. P x", "∃ x. P x"];
  SYM.ray = SYM.common.concat(SYM.rare); SYM.leaf = ["λ", "β", "η", "σ", "π", "∫", "α", "Φ"];
  // chiral symbols stand upright wherever they are placed, so where parts are turned (rings, lattices, friezes)
  // they would break the symmetry: there only the achiral ones are used; the chiral ones go large at the hubs
  const achiral = xs => xs.filter(t => !A.HOOKED.test(t));
  SYM.commonA = achiral(SYM.common); SYM.rareA = achiral(SYM.rare); SYM.chiral = SYM.common.concat(SYM.rare).filter(t => A.HOOKED.test(t));
  // delimited(r): a delimiter pair round what it may enclose, as one unit (turned with its ring, like any glyph)
  const delimited = r => { const [op, cl, ins] = r.pick(SYM.delimited); return A.glyph(op + r.pick(ins) + cl, MIN); };
  // a symbol for a part: the common ones three times as likely as the rare
  const sym = r => r.chance(0.75) ? r.pick(SYM.commonA) : r.pick(SYM.rareA);
  // a hub: a round one, a fleuron, or (large, upright) one of the chiral symbols
  const hubSym = r => r.chance(0.2) ? r.pick(SYM.chiral) : r.chance(0.5) ? r.pick(SYM.fleuron.filter(t => SYM.hub.includes(t))) : r.pick(SYM.hub);
  const sg = (t, k) => A.glyph(t, MIN);   // (every glyph one size: structure, not scale, carries the design)
  // an order of symmetry: odd ones as likely as even (even only, where it must be halved)
  const order = (r, even) => even ? r.pick([6, 8, 8, 10, 12]) : r.pick([5, 5, 7, 7, 9, 11, 13, 6, 8, 10, 12]);
  // motif(r, k): a part for a ring, pointing outward: one symbol, a mirrored pair, a trident, a stack, or a
  // symbol crowned with a small one
  function motif(r, k) {
    const t = sym(r), kind = r.pick(["one", "pair", "trident", "stack", "crowned", "delimited", "fleuron"], [6, 2, 2, 2, 2, 3, 3]);
    if (kind === "one") return sg(t, k);
    if (kind === "fleuron") return sg(r.pick(SYM.fleuron), k * 1.1);
    if (kind === "delimited") return delimited(r);
    if (kind === "pair") { const q = A.rotate(r.range(18, 32), sg(t, k)); return A.beside(A.mirror(q), q, 0.04); }
    if (kind === "trident") { const q = A.rotate(28, sg(t, k * 0.9)); return A.row([A.mirror(q), sg(sym(r), k * 1.1), q], 0.02); }
    if (kind === "stack") return A.above(sg(sym(r), k * 0.85), sg(t, k), 0.12);
    return A.above(sg(r.pick(SYM.fill), MIN), sg(t, k), 0.1);
  }
  // srosette(seed, {rings, even, budget, maxR, colours, order, fill}) (with an order, each ring holds just that many,
  // unless fill: then as many as fit, a multiple of it): a hub, perhaps a ring of beads, then rings of motifs,
  // each holding as many as fit round it, rounded to a multiple of the rosette's order of symmetry
  function srosette(seed, o) {
    const r = R(seed); o = Object.assign({ rings: r.pick([1, 2, 2, 3]), budget: 90, colours: true }, o || {});
    const k0 = o.order || order(r, o.even);
    let a = sg(o.roundHub || o.even ? r.pick(SYM.hub) : hubSym(r), o.hub || r.pick([1.8, 2.1, 2.5]));
    const ring = (part, gap, open) => {
      const reach = Math.max(...[0, 45, 90, 135, 180, 225, 270, 315].map(t => a.extent(t))), fit = Math.floor(2 * Math.PI * (reach + gap + part.extent(180)) / (part.width + gap));
      const n = open ? k0 : Math.max(k0, k0 * Math.floor(fit / k0));
      if (o.chiral) return A.around(n, a, A.rotate(o.chiral, part), gap);                 // turned, never mirrored
      return !o.plain && r.chance(0.25) && n % 2 === 0 ? A.dihedral(n / 2, a, part, gap) : A.around(n, a, part, gap);
    };
    if (r.chance(0.5)) a = ring(sg(r.pick(SYM.fill), 0.9), 0.1, !!o.order && !o.fill);
    for (let q = 0; q < o.rings; q++) {
      const next = ring(o.chiral ? sg(sym(r), r.range(1, 1.3)) : motif(r, r.range(1, 1.4)), r.pick([0.15, 0.3, 0.5]), o.order && !o.fill ? true : r.chance(0.3));
      if (next.glyphs.length > o.budget || (o.maxR && q > 0 && next.radius() > o.maxR)) break;
      a = next;
    }
    if (r.chance(0.4) && a.glyphs.length * 2 < o.budget) a = A.attach(a, "tip", sg(r.pick(SYM.fill), 0.9), 0.08);
    a = A.seal(a);
    return o.colours ? A.palette(jewel(r, 3), a) : a;
  }
  // ray(r, n, k): a ray of n symbols, largest at its foot, pointing outward
  const ray = (r, n, k) => A.column(Array.from({ length: n }, (_, i) => sg(i === 0 ? r.pick(SYM.fill.concat(["⋆", "✦"])) : sym(r), k * (0.85 + 0.2 * i / Math.max(1, n - 1)))), 0.4);
  // starburst(seed, {even}): long rays alternating with short ones round a hub (perhaps ringed with beads)
  function starburst(seed, o) {
    const r = R(seed); o = o || {};
    const n = o.order || order(r, o.even), tight = o.maxR != null && o.maxR < 3;
    const hub = sg(o.roundHub || o.even ? r.pick(SYM.hub) : hubSym(r), tight ? 1.05 : r.pick([1.6, 2, 2.4]));
    const core = !tight && r.chance(0.3) ? A.around(n, hub, sg(r.pick(SYM.fill), 0.9), 0.1) : hub;
    // (with maxR, the rays are as long as the room allows: that many symbols)
    const room = o.maxR ? o.maxR - core.radius() - 0.3 : null, longN = room != null ? Math.max(1, Math.min(5, Math.floor(room / 1.45))) : r.pick([2, 3, 3, 4]);
    const long = ray(r, longN, r.range(1, room != null ? 1.1 : 1.3)), short = longN <= 2 || r.chance(0.5) ? sg(r.pick(SYM.fill), 1) : ray(r, Math.min(2, longN - 1), 1);
    let a = A.around(2 * n, core, [long, short], r.pick([0.25, 0.4]));
    return A.seal(A.palette(jewel(r, 3), a));
  }
  // star(seed, {even}): a star of n points built of symbols tapering outward, perhaps with smaller points
  // between them
  function star(seed, o) {
    const r = R(seed); o = o || {};
    const n = o.order || (o.even ? r.pick([6, 8, 10]) : r.pick([5, 5, 7, 7, 9, 11]));
    const pt = k => A.column([sg(r.pick(SYM.fill), 0.85), sg(sym(r), k), sg(sym(r), k * 1.25)], 0.3), hub = sg(o.roundHub || o.even ? r.pick(SYM.hub) : hubSym(r), r.pick([1.8, 2.2]));
    let a = A.around(n, hub, pt(1), 0.12);
    if (r.chance(0.25)) {                                        // layered: smaller points between the large
      const inner = A.around(n, hub, A.column([sg(r.pick(SYM.fill), 0.85), sg(sym(r), 0.9)], 0.1), 0.12);
      a = A.around(n, A.rotate(180 / n, inner), pt(1.1), 0.12);
    }
    return A.seal(A.palette(jewel(r, 3), a));
  }
  // compound(seed): a rosette ringed with smaller rosettes (alternating with motifs, sometimes)
  function compound(seed, o) {
    const r = R(seed), c = r.chance(0.4) ? star(r.fork("c")) : srosette(r.fork("c"), { rings: r.pick([1, 2]) }), s1 = r.chance(0.5) ? star(r.fork("s"), { order: r.pick([5, 6, 7]), roundHub: true }) : srosette(r.fork("s"), { rings: 1, budget: 30 });
    const n = r.pick([5, 7, 9, 6, 8]), parts = r.chance(0.5) ? [s1, A.palette(jewel(r, 2), motif(r, 1.3))] : s1;
    return A.seal(A.around(Array.isArray(parts) ? 2 * n : n, c, parts, 0.25));
  }
  // smedallion(seed): a compound with a further ring of motifs, or of rosettes and motifs alternately
  function smedallion(seed) {
    const r = R(seed); let a = compound(r.fork("c"));
    const n = r.pick([9, 11, 13, 10, 12]); a = A.around(n, a, A.palette(jewel(r, 2), motif(r, r.range(1.2, 1.6))), 0.3);
    return A.seal(a);
  }
  // spanel(seed, {height}): a mirror-symmetric panel of symbols: a medallion or compound on the axis, then
  // rosettes, large single symbols and motifs placed in the left half where they touch nothing and mirrored,
  // largest first, with a scatter of small symbols between
  function spanel(seed, o) {
    const r = R(seed); o = Object.assign({ height: r.range(30, 38) }, o || {});
    const H = o.height, W = H * r.range(0.72, 0.85), space = new A.Space(2), out = [], GAP = 0.6;
    const inside = (a, left) => { const b = a.box; return b.x0 >= -W / 2 && b.x1 <= W / 2 && b.y0 >= -H / 2 && b.y1 <= H / 2 && (!left || b.x1 <= -0.3); };
    const add = (a, pair) => { space.add(a); out.push(a); if (pair) { const m = A.reflect(a); space.add(m); out.push(m); } };
    add(A.centred(r.chance(0.5) ? smedallion(r.fork("m")) : compound(r.fork("m"))));
    for (const y of [-H * 0.36, H * 0.36]) { const t = A.transform(A.centred(srosette(r.fork("ax" + y), { rings: 2 })), { dy: y }); if (inside(t) && !space.hits(t, GAP)) add(t); }
    const kinds = [
      [4, () => compound(r.fork("co")), 0], [4, () => starburst(r.fork("sb")), 0], [4, () => star(r.fork("st")), 0], [8, () => srosette(r.fork("ro"), { rings: r.pick([1, 2]) }), 0],
      [10, () => A.tint(r.pick(["green", "green", "blue", "gold"]), sg(r.pick(SYM.leaf), r.range(1.6, 2.6))), 180],
      [10, () => A.palette(jewel(r, 2), motif(r, r.range(1.2, 1.7))), 180],
      [18, () => A.tint(r.pick(ACCENTS), sg(r.pick(SYM.fill.concat(SYM.ray)), r.range(0.9, 1.2))), 180],
    ];
    for (const [cnt, make, rot] of kinds) for (let q = 0; q < cnt; q++) {
      const a0 = make();
      for (let t = 0; t < 40; t++) { const a = A.transform(a0, { rot: r.range(-rot, rot), dx: r.range(-W / 2, -1), dy: r.range(-H / 2, H / 2) });
        if (inside(a, true) && !space.hits(a, GAP)) { add(a, true); break; } }
    }
    return A.seal(A.union(...out));
  }

  // ---- beyond the circle: symmetries with translations (lattices, friezes), polygons, pinwheels, aperiodic tilings.
  // Each class of site gets colours of its own, so the structure of the symmetry shows.
  const at = (a, x, y, deg) => A.transform(A.centred(a), { rot: deg || 0, dx: x, dy: y });
  // spread(build): build(m) gives the parts of a composite with its spacing scaled by m; the least m (from 1, in
  // steps of 8%) at which no two parts touch
  function spread(build) {
    let parts = [];
    for (let m = 1, t = 0; t < 14; t++, m *= 1.08) {
      parts = build(m); const sp = new A.Space(2); let ok = true;
      for (const p of parts) { if (sp.hits(p, 0.06)) { ok = false; break; } sp.add(p); }
      if (ok) break;
    }
    return A.union(...parts);
  }
  // dyad(r, k): a two-fold element: a motif and its half-turn, back to back along the vertical
  const dyad = (r, k) => { const m = A.centred(sg(sym(r), k || 1)), d = m.extent(180) + 0.12; return A.union(A.shift(0, -d, m), A.turn(180, A.shift(0, -d, m))); };
  // site(r, n, o): an element of exactly n-fold symmetry (mirror-symmetric too, unless o.chiral)
  const site = (r, n, o) => n === 2 ? dyad(r, 1.1)
    : o && o.chiral ? (r.chance(0.5) ? A.seal(pinwheel(r.fork("pw" + n), { order: n })) : srosette(r.fork("site" + n), Object.assign({ order: n, rings: 2, roundHub: true, colours: false, hub: 1.6 }, o)))
    : n >= 4 && r.chance(0.5) ? (r.chance(0.5) ? star(r.fork("st" + n), { order: n, roundHub: true }) : starburst(r.fork("sb" + n), { order: n, roundHub: true }))
    : srosette(r.fork("site" + n), Object.assign({ order: n, rings: n <= 3 ? 2 : r.pick([1, 1, 2]), roundHub: true, colours: false, hub: n === 3 ? 1.6 : 1.8 }, o || {}));
  // wallpaper(seed, {group, rings}): a round patch of a wallpaper pattern: p6m, p6 and p3 on the hexagonal lattice,
  // p4m and p4g on the square, pmm and cmm on rectangles. Six-, four-, three- and two-fold sites each carry an
  // element of that symmetry (chiral in p6 and p3), in colours of their own
  function wallpaper(seed, o) {
    const r = R(seed); o = Object.assign({ group: r.pick(["p6m", "p6m", "p6", "p3", "p4m", "p4m", "pmm", "cmm"]) }, o || {});
    const G = o.group, chiral = G === "p6" || G === "p3" ? r.pick([20, 28, -24]) : 0, gap = 0.45;
    const cols = [jewel(r, 3), jewel(r, 3), jewel(r, 2), jewel(r, 2)], sites = [];
    const el = (n, i) => A.palette(cols[i], site(r, n, chiral ? { chiral } : {}));
    let v1, v2, cls;
    if (G === "p6m" || G === "p6" || G === "p3") {
      const a6 = el(G === "p3" ? 3 : 6, 0), a3 = el(3, 1), a3b = G === "p3" ? el(3, 3) : a3, a2 = G === "p3" ? null : el(2, 2);
      const R6 = a6.radius(), R3 = a3.radius(), R2 = a2 ? a2.radius() : 0;
      const a = Math.max(2 * R6 + (a2 ? 2 * R2 : 0) + 2 * gap, Math.sqrt(3) * (R6 + Math.max(R3, a3b.radius()) + gap), 2 * Math.max(R3, a3b.radius()) * Math.sqrt(3) / 1.5 + gap);
      v1 = [a, 0]; v2 = [a / 2, a * Math.sqrt(3) / 2];
      cls = [[0, 0, a6, 0], [1 / 3, 1 / 3, a3, 0], [2 / 3, 2 / 3, a3b, 60]];
      if (a2) cls.push([0.5, 0, a2, 90], [0, 0.5, a2, 150], [0.5, 0.5, a2, 30]);
    } else if (G === "p4m") {
      const a4 = el(4, 0), b4 = el(4, 1), a2 = el(2, 2), R4 = a4.radius(), Rb = b4.radius(), R2 = a2.radius();
      const a = Math.max(2 * R4 + 2 * R2 + 2 * gap, Math.SQRT2 * (R4 + Rb + gap));
      v1 = [a, 0]; v2 = [0, a]; cls = [[0, 0, a4, 0], [0.5, 0.5, b4, 45], [0.5, 0, a2, 90], [0, 0.5, a2, 0]];
    } else {
      const a2 = el(2, 0), b2 = el(2, 1), c2 = el(2, 2), R0 = a2.radius();
      const ax = 2 * R0 + 2 * c2.radius() + 2 * gap, ay = 2 * R0 * r.range(1.3, 1.8) + 2 * gap;
      v1 = [ax, 0]; v2 = [0, ay];
      cls = G === "pmm" ? [[0, 0, a2, 0], [0.5, 0.5, b2, 0], [0.5, 0, c2, 90], [0, 0.5, c2, 0]] : [[0, 0, a2, 0], [0.5, 0.5, a2, 0], [0.25, 0.25, c2, 45], [0.75, 0.25, c2, -45], [0.25, 0.75, c2, -45], [0.75, 0.75, c2, 45]];
    }
    const L = Math.hypot(...v1), rings = o.rings || r.pick([1.6, 2, 2.5]);
    return A.seal(spread(m => { const out = [], Rc = L * rings * m;
      for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) for (const [u, w, e, deg] of cls) {
        const x = m * ((i + u) * v1[0] + (j + w) * v2[0]), y = m * ((i + u) * v1[1] + (j + w) * v2[1]);
        if (Math.hypot(x, y) + e.radius() <= Rc) out.push(at(e, x, y, deg));
      }
      return out; }));
  }
  // sprig(r): an asymmetric little group of symbols (a large one leaning, a smaller one beside it, a dot), the
  // motif a frieze repeats: asymmetric, so that each symmetry of the frieze shows
  const sprig = r => { const a = A.rotate(r.range(18, 38), sg(sym(r), r.range(1.2, 1.5))), b = sg(sym(r), 0.9);
    return A.union(a, A.shift(a.width / 2 + 0.55, 0.3, b), A.shift(-0.2, a.height / 2 + 0.45, sg(r.pick(SYM.fill), 0.9))); };
  // frieze(seed, {group, cells}): a band of one motif under one of the seven frieze groups: translation (p1),
  // a half-turn (p2), mirrors across the band (p11m) or along it (p1m1), a glide (p11g), a mirror with a glide
  // (p2mg), or both mirrors (p2mm)
  function frieze(seed, o) {
    const r = R(seed); o = Object.assign({ group: r.pick(["p1", "p2", "p11m", "p1m1", "p11g", "p2mg", "p2mm"]), cells: r.int(5, 8) }, o || {});
    const cols = jewel(r, 3), m0 = sprig(r);
    const m = A.centred(A.palette(cols, m0)), flipV = a => A.turn(180, A.mirror(a)), h = m.height / 2 + 0.25;
    const cell = k => {
      switch (o.group) {
        case "p1": return [[m, 0]];
        case "p2": return [[k % 2 ? A.turn(180, m) : m, 0]];
        case "p11m": return [[m, -h], [flipV(m), h]];
        case "p1m1": return [[k % 2 ? A.mirror(m) : m, 0]];
        case "p11g": return [[k % 2 ? flipV(m) : m, k % 2 ? h : -h]];
        case "p2mg": return [[k % 2 ? A.mirror(flipV(m)) : m, k % 2 ? h : -h]];
        default: return [[k % 2 ? A.mirror(m) : m, -h], [k % 2 ? A.mirror(flipV(m)) : flipV(m), h]];   // p2mm
      }
    };
    const w = m.width + 0.3;
    return A.seal(spread(mm => { const parts = []; for (let k = 0; k < o.cells; k++) for (const [a, y] of cell(k)) parts.push(at(a, k * w * mm, y * mm)); return parts; }));
  }
  // wreath(seed, {group, n}): a frieze bent round a circle: n cells of a motif, under a frieze group's
  // symmetries turned into the circle's (glides become alternately inward and outward motifs, and so on)
  function wreath(seed, o) {
    const r = R(seed); o = Object.assign({ group: r.pick(["p2", "p11m", "p1m1", "p11g", "p2mg", "p2mm"]), n: r.pick([10, 12, 14, 16]) }, o || {});
    const cols = jewel(r, 3), m = A.centred(A.palette(cols, sprig(r))), flipV = a => A.turn(180, A.mirror(a)), h = m.height / 2 + 0.2;
    const cells = []; for (let k = 0; k < o.n; k++) {
      const g = o.group, alt = k % 2;
      if (g === "p2") cells.push([[alt ? A.turn(180, m) : m, 0]]);
      else if (g === "p11m") cells.push([[m, h], [flipV(m), -h]]);
      else if (g === "p1m1") cells.push([[alt ? A.mirror(m) : m, 0]]);
      else if (g === "p11g") cells.push([[alt ? flipV(m) : m, alt ? -h : h]]);
      else if (g === "p2mg") cells.push([[alt ? A.mirror(flipV(m)) : m, alt ? -h : h]]);
      else cells.push([[alt ? A.mirror(m) : m, h], [alt ? A.mirror(flipV(m)) : flipV(m), -h]]);
    }
    const Rr0 = Math.max(o.n * (m.width + 0.35) / (2 * Math.PI), 3), core = A.palette(jewel(r, 3), srosette(r.fork("c"), { order: o.n / 2, rings: 1, roundHub: true, colours: false }));
    return A.seal(spread(mm => { const Rr = Rr0 * mm, parts = core.radius() <= Rr - 2 * h - 0.4 ? [core] : [];
      cells.forEach((cs, k) => { const deg = k * 360 / o.n; for (const [a, y] of cs) { const u = A.dir(deg), d = Rr + y; parts.push(at(a, d * u.x, d * u.y, deg)); } });
      return parts; }));
  }
  // frame(seed, {n}): a regular n-gon of rosettes, motifs along its edges facing out, a rosette of order n (or 2n)
  // at its centre, and sometimes a second polygon turned half a step inside
  function frame(seed, o) {
    const r = R(seed), n = (o && o.n) || r.pick([3, 5, 5, 7, 4, 6]), cols = [jewel(r, 3), jewel(r, 3), jewel(r, 2)];
    const corner = A.palette(cols[0], site(r, 2 * n > 12 ? n : 2 * n, { rings: 1 })), edgeM = A.palette(cols[2], sg(sym(r), 1.15)), centre = A.palette(cols[1], srosette(r.fork("c"), { order: n * r.pick([1, 2]), rings: r.pick([1, 2]), roundHub: true, colours: false }));
    const Rc = corner.radius(), per = r.pick([1, 2, 3]), em = edgeM.radius(), side = Math.max(2 * Rc + per * (2 * em + 0.3) + 0.6, 2 * (centre.radius() + Rc + 0.6) * Math.tan(Math.PI / n));
    const R00 = side / (2 * Math.sin(Math.PI / n));
    let a = spread(m => { const R0 = R00 * m, parts = [centre];
      const V = k => { const u = A.dir(k * 360 / n); return [R0 * u.x, R0 * u.y]; };
      for (let k = 0; k < n; k++) {
        const [x0, y0] = V(k), [x1, y1] = V(k + 1); parts.push(at(corner, x0, y0, k * 360 / n));
        const mid = (k + 0.5) * 360 / n;
        for (let q = 0; q < per; q++) { const t = (q + 1) / (per + 1); parts.push(at(edgeM, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, mid)); }
      }
      return parts; });
    const R0 = a.radius() - Rc;
    if (r.chance(0.4)) { const inner = A.palette(cols[2], sg(sym(r), 1)), rr = R0 * Math.cos(Math.PI / n) * 0.62;
      for (let k = 0; k < n; k++) { const u = A.dir((k + 0.5) * 360 / n); const t = at(inner, rr * u.x, rr * u.y, (k + 0.5) * 360 / n); if (!new A.Space().add(a).hits(t, 0.2)) a = A.union(a, t); } }
    return A.seal(a);
  }
  // pinwheel(seed): n-fold rotation without reflection (n odd, or 6): arms of symbols, each set turning the same way
  function pinwheel(seed, o) {
    const r = R(seed), n = (o && o.order) || r.pick([3, 5, 5, 7, 9, 6]), cols = jewel(r, 3), turnBy = r.pick([1, -1]) * r.range(18, 34);
    const g = sym(r), arm = A.column([sg(r.pick(SYM.fill), 0.9), sg(g, 1.1), sg(g, 1.35)], 0.1);
    let a = A.around(n, sg(r.pick(SYM.hub), 1.8), A.rotate(turnBy, arm), 0.15);
    a = A.around(n * r.pick([1, 2]), a, A.rotate(turnBy * 1.5, sg(sym(r), 1.1)), 0.3);
    return A.seal(A.palette(cols, a));
  }
  // hatpatch(seed, {level}): a patch of the aperiodic hat tiling with a symbol at the heart of every hat, turned
  // as the hat is, and chosen and coloured by the hat's kind (H1, the reflected hat, gets a mirrored symbol)
  function hatpatch(seed, o) {
    const r = R(seed), T = global.Glyphcraft && global.Glyphcraft.HAT_TILING; if (!T) return A.art(null);
    const hats = T((o && o.level) || 1), u = (o && o.unit) || 1.1, kinds = ["H", "H1", "T", "P", "F"], pick = {}, col = {};
    const base = sym(r); kinds.forEach((k, i) => { pick[k] = k === "H1" ? base : i === 0 ? base : sym(r); col[k] = ACCENTS[i % ACCENTS.length]; });
    const parts = hats.map(h => {
      let cx = 0, cy = 0; for (const [x, y] of h.pts) { cx += x; cy += y; } cx = cx / h.pts.length * u; cy = -cy / h.pts.length * u;
      const [x0, y0] = h.pts[0], [x1, y1] = h.pts[1], deg = Math.atan2(x1 - x0, y1 - y0) / Math.PI * 180;
      let g = A.tint(col[h.label] || "accent", sg(pick[h.label] || base, (o && o.size) || 1.5)); if (h.label === "H1") g = A.mirror(g);
      return at(g, cx, cy, deg);
    });
    return A.seal(A.union(...parts));
  }

  // nest(seed, {order, depth, even, core}): a star, starburst, pinwheel or rosette of order n (most often a star),
  // wrapped `depth` times, each wrapping a ring round everything so far whose count is a multiple of n: satellite
  // stars or rosettes, stellating points, a ring of fleurons, long and short rays, motifs, or beads. Each wrapping has colours of its own, so what is nested shows.
  function nest(seed, o) {
    // (with maxR it keeps wrapping, up to six times, until another ring would pass maxR: it fills its room)
    const r = R(seed); o = Object.assign({ depth: o && o.maxR ? 6 : r.pick([2, 2, 3]), budget: 700 }, o || {});
    const n = o.order || order(r, o.even);
    const cores = [() => star(r.fork("s"), { order: n, roundHub: !!o.even }), () => starburst(r.fork("b"), { order: n, roundHub: !!o.even }), () => srosette(r.fork("r"), { order: n, rings: 1, roundHub: !!o.even })];
    if (!o.even && n !== 4) cores.push(() => pinwheel(r.fork("p"), { order: n }));
    // (given room, the core is sized to about half of it: a starburst or a rosette, which the rings then grow out to fill)
    const sized = o.maxR ? () => (o.core === "starburst" || r.chance(0.65) ? starburst(r.fork("b"), { order: n, roundHub: !!o.even, maxR: o.maxR * r.range(0.45, 0.6) })
      : srosette(r.fork("r"), { order: n, rings: 2, roundHub: !!o.even, maxR: o.maxR * 0.55, budget: 60 })) : null;
    // (o.core may also be an Art: an ornament of order n to wrap, ring by ring, out to maxR)
    let a = o.core && typeof o.core === "object" ? A.centred(o.core) : sized ? sized() : o.core === "starburst" ? starburst(r.fork("b"), { order: n, roundHub: !!o.even }) : r.pick(cores, cores.map((_, i) => [5, 3, 2, 1][i]))();
    for (let q = 0; q < o.depth; q++) {
      const cols = jewel(r, r.pick([2, 3])), gap = r.pick([0.2, 0.3, 0.45]);
      let w = r.pick(["beads", "motifs", "rays", "satellites", "points", "petals"], [1, 2, 2, 4, 4, 3]);
      const fitCount = part => { const reach = Math.max(...[0, 45, 90, 135, 180, 225, 270, 315].map(t => a.extent(t))), fit = Math.floor(2 * Math.PI * (reach + gap + part.extent(180)) / (part.width + gap)); return Math.max(n, n * Math.floor(fit / n)); };
      let next;
      if (w === "rays") { const lo = ray(r, r.pick([2, 3]), 1.1), sh = ray(r, 1, 1); next = A.around(2 * Math.max(n, n * Math.floor(fitCount(lo) / (2 * n))), a, [A.palette(cols, lo), A.palette(cols, sh)], gap); }
      let sat0 = null;
      if (w === "satellites") {                                  // only if n of them fit snugly round what is there (else a wide empty band)
        sat0 = r.chance(0.6) ? star(r.fork("sat" + q), { order: r.pick([5, 6, 7, 8]), roundHub: !!o.even }) : srosette(r.fork("sat" + q), { rings: 1, budget: 30, roundHub: !!o.even });
        const reach = Math.max(...[0, 45, 90, 135, 180, 225, 270, 315].map(t => a.extent(t)));
        if (Math.floor(2 * Math.PI * (reach + gap + sat0.extent(180)) / (sat0.width + gap)) < n) w = "petals";
      }
      if (w === "satellites") { const sat = sat0; next = A.around(n * (r.chance(0.3) && 2 * n <= Math.floor(2 * Math.PI * (Math.max(...[0, 90, 180, 270].map(t => a.extent(t))) + gap + sat.extent(180)) / (sat.width + gap)) ? 2 : 1), a, sat, gap); }
      else if (w === "points") { const pt = A.column([sg(r.pick(SYM.fill), 1), sg(sym(r), 1.1), sg(sym(r), 1.35)], 0.1); next = A.around(n * r.pick([1, 2]), a, A.palette(cols, pt), gap); }
      else if (w === "petals") { const pet = sg(r.pick(SYM.fleuron), r.range(1.15, 1.4)); next = A.around(fitCount(pet), a, A.palette(cols, pet), gap); }   // a ring of fleurons
      else { const part = w === "beads" ? sg(r.pick(SYM.fill), 1) : motif(r, 1.15); next = A.around(fitCount(part), a, A.palette(cols, part), gap); }
      if (next.glyphs.length > o.budget || (o.maxR && next.radius() > o.maxR)) {
        // too wide: a ring of beads instead (the slimmest), so the room left is filled, not wasted
        if (!o.maxR || w === "beads") break;
        const bead = sg(r.pick(SYM.fill), 1); next = A.around(fitCount(bead), a, A.palette(cols, bead), 0.2);
        if (next.glyphs.length > o.budget || next.radius() > o.maxR) break;
      }
      a = next;
    }
    return A.seal(a);
  }
  // hatdisc(seed, R): a round patch of radius R of the aperiodic hat tiling, a glyph in every hat: filler
  function hatdisc(seed, Rr) {
    const r = R(seed), a = A.centred(hatpatch(r.fork("h"), { level: Rr > 6 ? 2 : 1, unit: r.range(0.95, 1.15), size: 1 }));
    return A.seal(new A.Art(a.glyphs.filter(g => Math.hypot(g.x, g.y) + 0.55 <= Rr)));
  }

  // ---- dihedral compounds: a motif mirror-symmetric about its own radial axis, repeated n times round a centre,
  // has dihedral symmetry of order 2n (n turns and n mirrors), for any n: flowers and snowflakes of 5, 7 or 9
  const mirrorPair = (a, x, y, deg) => { const t = A.transform(A.centred(a), { rot: deg, dx: x, dy: y }); return A.union(t, A.reflect(t)); };
  // arm(r, {len, side}): a snowflake's arm: a spine of symbols running outward (up), with mirrored side branches
  // of symbols every other step, shorter toward the tip, and a star or fleuron at the end
  function arm(r, o) {
    o = Object.assign({ len: r.int(3, 5), side: r.int(1, 3), angle: r.pick([58, 62, 66]) }, o || {});
    const spineG = sym(r), sideG = sym(r), tipG = r.pick(SYM.fleuron.concat(["✦", "⋆", "✧"])), step = 1.25, parts = [];
    for (let k = 0; k < o.len; k++) parts.push(A.shift(0, -k * step, sg(k === 0 ? r.pick(SYM.fill) : spineG, k === 0 ? 1 : 1.05)));
    for (let k = 1; k < o.len - 1; k += 2) {
      const m = Math.max(1, Math.min(o.side, o.len - k - 1)), u = A.dir(o.angle);
      for (let j = 1; j <= m; j++) parts.push(mirrorPair(A.rotate(o.angle, sg(sideG, 1)), u.x * j * 1.3, -k * step + u.y * j * 1.3, 0));
    }
    parts.push(A.shift(0, -o.len * step - 0.1, sg(tipG, 1.15)));
    return A.union(...parts);
  }
  // cpetal(r): a petal of symbols: rows across the ray, narrow at its base, widest in the middle, to a tip
  // (m rows: a longer petal, for a larger flower, swelling wider in the middle)
  function cpetal(r, m) {
    const edge = sym(r), inner = r.pick(SYM.fill.concat(SYM.fleuron)), tip = r.pick(SYM.fleuron.concat([sym(r)])), parts = [];
    // (row widths, centre to centre: a pair is at least 1.3 apart, and a row holds a centre glyph only when 2.4 wide)
    const peak = m >= 6 ? 3.7 : 2.5, rows = !m ? r.pick([[0, 1.3, 2.4, 1.3], [0, 1.4, 2.5, 2.5, 1.4], [1.3, 2.4, 1.3]])
      : Array.from({ length: m }, (_, k) => k === 0 && m > 3 ? 0 : [1.3, 2.5, 3.7].filter(w => w <= peak).reduce((b, w) => Math.abs(w - (1.3 + (peak - 1.3) * Math.sin(Math.PI * (k + 0.5) / m))) < Math.abs(b - (1.3 + (peak - 1.3) * Math.sin(Math.PI * (k + 0.5) / m))) ? w : b, 1.3));
    rows.forEach((w, k) => { const y = -k * 1.2;
      if (w === 0) parts.push(A.shift(0, y, sg(inner, 1)));
      else { parts.push(mirrorPair(A.rotate(-12, sg(edge, 1)), w / 2, y, 0)); if (w >= 2.4 && w < 3.6) parts.push(A.shift(0, y, sg(inner, 1)));
        if (w >= 3.6) parts.push(mirrorPair(sg(inner, 1), 0.6, y, 0)); } });
    parts.push(A.shift(0, -rows.length * 1.2 - 0.05, sg(tip, 1.1)));
    return A.union(...parts);
  }
  // snowflake(seed, {n}): n arms round a hub (ringed, perhaps, with n or 2n beads): dihedral of order 2n
  // (with maxR: the arms as long as the room allows, and branched more the longer they are)
  function snowflake(seed, o) {
    o = o || {};
    const r = R(seed), n = o.n || r.pick([3, 5, 6, 6, 7, 9]), cols = jewel(r, 3);
    let core = sg(r.pick(SYM.hub), r.pick([1.5, 1.8]));
    if (r.chance(0.6)) core = A.around(n * r.pick([1, 2]), core, sg(r.pick(SYM.fill), 1), 0.1);
    if (!o.maxR) return A.seal(A.palette(cols, A.around(n, core, arm(r, o), 0.15)));
    const armSeed = r.fork("arm"), angle = r.pick([58, 62, 66]);
    let len = Math.max(2, Math.min(8, Math.floor((o.maxR - core.radius() - 1.2) / 1.25))), a;
    for (; ; len--) {
      const ar = R(armSeed + "/" + len);
      a = A.around(n, core, arm(ar, { len, side: Math.max(1, Math.min(4, Math.floor(len / 2))), angle }), 0.15);
      if (len <= 2 || a.radius() <= o.maxR) break;
    }
    return A.seal(A.palette(cols, a));
  }
  // cflower(seed, {n}): n compound petals round a hub, perhaps a second ring of smaller ones between them
  // (with maxR: petals as long as the room allows)
  function cflower(seed, o) {
    o = o || {};
    const r = R(seed), n = o.n || r.pick([5, 5, 6, 7, 7, 9]), cols = jewel(r, 3);
    let core = sg(r.pick(SYM.hub), o.maxR && o.maxR > 6 ? r.pick([1.9, 2.3]) : r.pick([1.6, 1.9]));
    if (r.chance(0.7)) core = A.around(n, core, sg(r.pick(SYM.fill), 1), 0.1);
    let a;
    if (o.maxR) { const ps = r.fork("petal");
      for (let m = Math.max(2, Math.min(9, Math.floor((o.maxR - core.radius() - 1.5) / 1.2))); ; m--) {
        a = A.around(n, core, A.palette(cols, cpetal(R(ps + "/" + m), m)), 0.12);
        if (m <= 2 || a.radius() <= o.maxR) break;
      } }
    else a = A.around(n, core, A.palette(cols, cpetal(r)), 0.12);
    if (r.chance(0.5)) { const small = A.palette(jewel(r, 2), A.column([sg(r.pick(SYM.fleuron), 1.1), sg(sym(r), 1)], 0.1));
      const ring = A.rotate(180 / n, A.around(n, core, small, 0.9));
      const bare = new A.Art(ring.glyphs.filter(g => Math.hypot(g.x, g.y) > 1.2));   // (the core is shared: test only the new petals)
      if (!new A.Space().add(a).hits(bare, 0.05)) a = A.union(a, bare); }
    return A.seal(a);
  }

  // ---- the grammar: intricate structures from nested rules. Every structure grows inside the radius R it is given
  // (the room it has), so it fills its hole; nesting spends the room inward. Rules:
  //   flower    := glyph | ring of n flowers (3 ≤ n ≤ 9) round a flower | two flowers alternating, 2n round a flower
  //                (2 ≤ n ≤ 7) | ring of n bilaterals round a flower | star round a flower | burst round a flower
  //                | mandala: a tight circle of many small flowers round a flower
  //   burst     := glyph | n rays from a burst, each ending in a burst | n rays each ending in a flower | 2n rays,
  //                long and short alternately
  //   bilateral := (mirror-symmetric, pointing outward) a mirrored pair | a trident | a petal of rows | a snowflake's
  //                arm | a flower on a stalk | a symbol between delimiters
  //   star      := tapering points of symbols round a flower;   snowflake := arms round a flower
  // Each ring has colours of its own; parts are sized to the ring they sit in, and a structure that would outgrow its
  // room is tried again with smaller parts. Glyphs are never smaller than MIN; where parts turn, symbols are achiral.
  const GBUDGET = 700;
  const leafGlyph = (r, R, hub) => sg(hub ? (r.chance(0.4) ? sym(r) : r.pick(SYM.hub)) : r.chance(0.15) ? r.pick(SYM.fleuron) : sym(r));   // (maths first)
  // the room round a centre c: how many parts of radius rp fit in a ring just outside it
  const ringFit = (c, rp, gap) => { const d = c.radius() + gap + rp; return rp <= 0 ? 0 : Math.floor(Math.PI / Math.asin(Math.min(1, (rp + gap / 2) / d))); };
  // (a ring holds as many as fit, within the rule's range, most of the time; else a random count)
  let DENSE = 0.75;
  const clampN = (n, lo, hi, fit, r) => Math.max(lo, Math.min(hi, fit, r && r() < DENSE ? hi : n));
  // every ring records its order of symmetry (ord); a ring round a centre of order k holds a multiple of k
  const ringOf = (c, parts, n, gap) => { const a = A.around(n, c, parts, gap); a.ord = n; return a; };
  const ordOf = c => (c && c.ord) || 1;
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  // a count for a ring round c: a multiple of c's order (and of step), within [lo, hi] and what fits; as many as fit,
  // mostly (r null: the most that fit)
  const countFor = (c, lo, hi, fit, r, step) => {
    const st = step || 1, k = ordOf(c) * st / gcd(ordOf(c), st), xs = [];
    for (let m = k; m <= Math.max(hi, k); m += k) if (m >= Math.min(lo, k) && m <= Math.max(fit, k)) xs.push(m);
    if (GRID) { const ok = xs.filter(m => m % 4 === 0 || (m <= 6 && GRID_RARE)); if (ok.length) xs.splice(0, xs.length, ...ok); else return Math.max(4, k - k % 4 || 4); }
    if (!xs.length) return k;
    return !r || r() < DENSE ? xs[xs.length - 1] : xs[Math.floor(r() * xs.length)];
  };
  // grid mode (grow with o.grid): counts that sit on a grid (multiples of 4; now and then 3 or 6), and no pieces whose
  // look depends on turning
  let GRID = false, GRID_RARE = false;
  function gflowerR(r, R, d, top) {
    if (R < 1.3 || d <= 0) return leafGlyph(r, R, true);
    // (at the top: petals and pieces pointing out, not rings of round things, so it reads as a flower, not a mandala)
    const rule = top ? r.pick(["bilateral", "alt", "ring"], [6, 3, 1]) : r.pick(["ring", "alt", "bilateral", "star", "burst", "mandala", "glyph"], [4, 4, 4, 3, 3, 1, d > 2 ? 0 : 1]);
    if (rule === "glyph") return leafGlyph(r, R, true);
    for (let t = 0; t < 3; t++) {
      const shrink = Math.pow(0.78, t), c = gflowerR(r.fork("c"), R * (top ? r.range(0.22, 0.32) : r.range(0.3, 0.45)) * shrink, d - 1), gap = r.pick([0.15, 0.25, 0.35]);
      const room = Math.max(0.6, (R - c.radius() - gap) * shrink), cols = jewel(r, r.pick([2, 3]));
      let a;
      if (rule === "star") a = gstarR(r, R * shrink, d, c);
      else if (rule === "burst") a = gburstR(r, R * shrink, d, c);
      else if (rule === "mandala") { const rp = Math.max(0.7, Math.min(1.5, room / 2)), part = A.palette(cols, gflowerR(r.fork("m"), rp, d - 2)); a = ringOf(c, part, countFor(c, 6, 24, Math.max(6, ringFit(c, part.radius(), gap)), null), gap); }
      else if (rule === "bilateral") { const part = A.palette(cols, gbilateralR(r.fork("b"), room / 2, d - 1, top)); const fit = ringFit(c, part.width / 2, gap); a = ringOf(c, part, countFor(c, 3, 9, fit, r), gap); }
      else if (rule === "alt") { const p1 = A.palette(cols, gflowerR(r.fork("a"), room / 2, d - 1)), p2 = A.palette(jewel(r, 2), r.chance(0.5) ? gburstR(r.fork("q"), room / 2.6, d - 1) : gflowerR(r.fork("b"), room / 2.6, d - 1));
        // (alternation reads only with many: 10, 12 or 14 in all; where that many don't fit, one kind in a ring)
        const fit = ringFit(c, Math.max(p1.radius(), p2.radius()), gap), n2 = countFor(c, 10, 14, fit, r, 2);
        a = n2 >= 10 && n2 <= fit ? ringOf(c, [p1, p2], n2, gap) : ringOf(c, p1, countFor(c, 3, 9, ringFit(c, p1.radius(), gap), r), gap); }
      else { const part = A.palette(cols, gflowerR(r.fork("p"), room / 2, d - 1)); a = ringOf(c, part, countFor(c, 3, 9, ringFit(c, part.radius(), gap), r), gap); }
      if (a.glyphs.length <= GBUDGET && a.radius() <= R * 1.12) return a;
    }
    return leafGlyph(r, R, true);
  }
  function gburstR(r, R, d, centre) {
    if (!centre && (R < 1.3 || d <= 0)) return leafGlyph(r, R, false);
    const c = centre || (r.chance(0.5) ? gburstR(r.fork("c"), R * 0.35, d - 1) : leafGlyph(r, R * 0.35, true)), gap = r.pick([0.12, 0.2]);
    const endKind = r.pick(["burst", "flower", "none"], [3, 3, 2]), room = R - c.radius() - gap;
    for (let t = 0; t < 3; t++) {
      const er = endKind === "none" ? 0 : Math.max(0.6, room * r.range(0.25, 0.4) * Math.pow(0.75, t));
      const end = endKind === "none" ? null : A.palette(jewel(r, 2), endKind === "burst" ? gburstR(r.fork("e"), er, d - 1) : gflowerR(r.fork("e"), er, d - 1));
      const len = Math.max(1, Math.min(4, Math.floor((room - (end ? 2 * end.radius() : 0)) / 1.15))), g = sym(r);
      const rayArt = A.column([...(end ? [end] : [sg(r.pick(SYM.fill.concat(["✦", "⋆"])), 1)]), ...Array.from({ length: len }, (_, i) => sg(i === len - 1 ? r.pick(SYM.fill) : g, 1))], 0.1);
      const cols = jewel(r, 2), fit = ringFit(c, rayArt.width / 2 + 0.2, gap), alt = r.chance(0.4);
      let a;
      if (alt) { const short = sg(sym(r), 1); a = ringOf(c, [A.palette(cols, rayArt), A.palette(cols, short)], countFor(c, 6, 18, fit, r, 2), gap); }
      else a = ringOf(c, A.palette(cols, rayArt), countFor(c, 3, 12, fit, r), gap);
      if (a.glyphs.length <= GBUDGET && a.radius() <= R * 1.12) return a;
    }
    return c;
  }
  function gbilateralR(r, R, d, top) {
    const k = top ? r.pick(["petal", "stalk", "arm"], [4, R > 1.6 ? 4 : 0, 1]) : GRID ? r.pick(["petal", "arm", "stalk"], [3, 2, d > 0 && R > 1.6 ? 3 : 0])
      : r.pick(["pair", "trident", "petal", "arm", "stalk", "delimited", "fleur"], [2, 2, 3, 2, d > 0 && R > 1.6 ? 3 : 0, 2, R > 2 ? 3 : 0]);
    if (k === "fleur") { const f = gfleurR(r, R, d); return A.centred(f); }   // (in a ring: small, of glyphs)
    if (k === "pair") { const q = A.rotate(r.range(18, 32), sg(sym(r), 1.1)); return A.beside(A.mirror(q), q, 0.04); }
    if (k === "trident") { const q = A.rotate(28, sg(sym(r), 1)); return A.row([A.mirror(q), sg(sym(r), 1.15), q], 0.02); }
    if (k === "delimited") return delimited(r);
    if (k === "petal") return cpetal(r, Math.max(2, Math.min(7, Math.floor(2 * R / 1.2))));
    if (k === "arm") { const len = Math.max(2, Math.min(7, Math.floor(2 * R / 1.25))); return arm(r, { len, side: Math.max(1, Math.min(3, len >> 1)) }); }
    const head = gflowerR(r.fork("h"), R * 0.55, d - 1), g = sym(r);   // a flower on a stalk
    return A.column([head, ...Array.from({ length: Math.max(1, Math.round(R * 0.6)) }, () => sg(g, 1))], 0.12);
  }
  function gstarR(r, R, d, centre) {
    const c = centre || gflowerR(r.fork("c"), R * 0.4, d - 1), room = R - c.radius() - 0.15;
    const L = Math.max(1, Math.min(4, Math.floor(room / 1.15))), g1 = sym(r), g2 = sym(r);
    const pt = A.column(Array.from({ length: L }, (_, i) => sg(i === 0 ? r.pick(SYM.fill.concat(["✦"])) : i % 2 ? g1 : g2, 1 + 0.15 * (L - 1 - i) / Math.max(1, L - 1) * 2)), 0.08);
    const n = countFor(c, 3, 12, ringFit(c, pt.width / 2 + 0.15, 0.12), r);
    let a = ringOf(c, A.palette(jewel(r, 2), pt), n, 0.12);
    if (r.chance(0.5) && L >= 2) {   // smaller points between the large
      const small = A.palette(jewel(r, 2), A.column([sg(r.pick(SYM.fill), 1), sg(g2, 1)], 0.08)), ring = A.rotate(180 / n, ringOf(c, small, n, 0.12));
      const bare = new A.Art(ring.glyphs.filter(gl => Math.hypot(gl.x, gl.y) > c.radius() + 0.2));
      if (!new A.Space().add(a).hits(bare, 0.05)) a = A.union(a, bare);
    }
    a.ord = n; return a;
  }
  function gsnowR(r, R, d) {
    const c = gflowerR(r.fork("c"), R * 0.35, d - 1), len = Math.max(2, Math.min(7, Math.floor((R - c.radius() - 0.3) / 1.25)));
    const cols = jewel(r, 3), want = r.pick([5, 6, 6, 7, 8, 9]);
    for (let L = len; ; L--) {
      const ar = arm(rng(r.fork("arm") + "/" + L), { len: L, side: Math.max(1, Math.min(3, L >> 1)) }), n = countFor(c, 3, 9, ringFit(c, ar.width / 2, 0.15), r);
      const a = ringOf(c, A.palette(cols, ar), n, 0.15);
      if (L <= 2 || a.radius() <= R * 1.05) return a;
    }
  }
  // fleur: a fleur-de-lis of symbols, mirror-symmetric about its upright axis (not radial): a tall centre spike, two
  // side petals curving out and down, a band across, and a foot. tree: a stem of symbols with mirrored pairs of small
  // flowers or bursts up it, and a flower at the top. Both are fitted to the room R (their half-height).
  // a compound fleur-de-lis: every part a structure of the grammar, placed on the fleur-de-lis's outline (spike, two
  // curling petals, band, foot), parts sized to the room and anything that would touch another left out
  function gfleurCompound(r, R, d) {
    const out = [], sp = new A.Space(), cols = [jewel(r, 2), jewel(r, 2), jewel(r, 2), jewel(r, 3)];
    const put = (art, x, y, pad) => { const a = A.transform(A.centred(art), { dx: x, dy: y }); if (sp.hits(a, pad == null ? 0.12 : pad)) return false; sp.add(a); out.push(a); return true; };
    const mirrorPut = (art, x, y) => { const a = A.transform(A.centred(art), { dx: x, dy: y }), b = A.reflect(a);
      if (sp.hits(a, 0.12) || sp.hits(b, 0.12) || (Math.abs(x) < 0.5 ? false : new A.Space().add(a).hits(b, 0.12))) return false;
      sp.add(a); out.push(a); if (Math.abs(x) >= 0.5) { sp.add(b); out.push(b); } return true; };
    // key points first, larger structures
    const P = (x, y) => [x * R, y * R];
    const tipAt = P(0, -0.92), curlAt = P(0.74, 0.02), bandAt = P(0, 0.26), footAt = P(0, 0.72);
    put(A.palette(cols[3], gstarR(r.fork("tip"), Math.max(1.8, R * 0.13), 2)), ...tipAt);
    mirrorPut(A.palette(cols[3], gburstR(r.fork("curl"), Math.max(1.6, R * 0.11), 2)), ...curlAt);
    put(A.palette(cols[2], gflowerR(r.fork("band"), Math.max(1.8, R * 0.13), 2)), ...bandAt);
    put(A.palette(cols[3], gburstR(r.fork("foot"), Math.max(1.4, R * 0.1), 1)), ...footAt);
    // the outline, traced with beads: one small flower per curve, repeated along it
    const bead = (tag, k) => A.palette(cols[k], gflowerR(r.fork(tag), 1.35, 1));
    const trace = (pts, art, mirror) => { const C = A.curve(pts.map(([x, y]) => [x * R, y * R])), L = A.pathLength(C), step = 2 * art.radius() + 0.15;
      for (let s0 = 0; s0 <= L; s0 += step) { const f = A.pathAt(C, s0); mirror ? mirrorPut(art, f.x, f.y) : put(art, f.x, f.y); } };
    trace([[0.06, 0.16], [0.2, -0.3], [0.12, -0.66], [0, -0.82]], bead("centre", 0), true);              // the centre petal's edges
    trace([[0.14, 0.16], [0.42, -0.18], [0.66, -0.34], [0.86, -0.2], [0.84, 0.02]], bead("side", 1), true);  // each side petal, curling over
    trace([[-0.5, 0.26], [0.5, 0.26]], bead("bar", 2), false);                                            // the band
    trace([[0.1, 0.36], [0.3, 0.5], [0.34, 0.66]], bead("foot", 1), true);                                 // the foot's two lobes
    const b = A.centred(A.union(...out)); b.ord = 1; return b;
  }
  function gfleurR(r, R, d) {
    if (R >= 6) return gfleurCompound(r, R, Math.max(d, 2));   // (large: always compound)
    const u = 1.25 * MIN / 1.4, steps = Math.max(2, Math.min(6, Math.floor(R / u) - 1)), spineG = sym(r), petalG = sym(r), cols = jewel(r, 3), parts = [];
    const compound = d > 1 && R > 4 && r.chance(0.7);
    const tip = compound ? A.palette(jewel(r, 2), gflowerR(r.fork("tip"), Math.min(2.2, R * 0.3), d - 1)) : A.palette([cols[0]], r.chance(0.5) ? sg(r.pick(SYM.fleuron)) : leafGlyph(r, 1, true));
    for (let k = 0; k < steps; k++) parts.push(A.palette([cols[0]], A.shift(0, -(k + 1) * u, sg(spineG))));
    parts.push(compound ? A.transform(A.centred(tip), { dy: -(steps + 0.6) * u - tip.radius() }) : A.shift(0, -(steps + 1) * u, tip));
    // the side petals: up and out from the band, then curling over and down
    const arc = Array.from({ length: steps + 1 }, (_, k) => { const t = k / steps, a = Math.PI * (0.15 + 0.95 * t);
      return [u * (1 + 1.6 * Math.sin(a) * (steps / 3)), -u * (0.4 + 1.9 * (1 - Math.cos(a)) * (steps / 4))]; });
    let last = null;
    for (const [x, y] of arc) { if (last && Math.hypot(x - last[0], y - last[1]) < u * 0.95) continue; const g = A.palette([cols[1]], A.shift(x, y, sg(petalG))); parts.push(g, A.reflect(g)); last = [x, y]; }
    if (compound && last) { const end = A.palette(jewel(r, 2), gburstR(r.fork("end"), Math.min(1.8, R * 0.22), d - 1)), e = A.transform(A.centred(end), { dx: last[0] + end.radius() * 0.6, dy: last[1] + end.radius() }); parts.push(e, A.reflect(e)); }
    const band = sym(r), bw = Math.max(1, Math.round(steps / 2));
    for (let k = -bw; k <= bw; k++) parts.push(A.palette([cols[2]], A.shift(k * u, u * 0.6, sg(k === 0 ? r.pick(SYM.hub) : band))));
    const foot = sym(r); parts.push(A.palette([cols[1]], A.shift(0, u * 1.8, sg(foot))));
    for (const sgn of [1, -1]) parts.push(A.palette([cols[1]], A.shift(sgn * u, u * 2.1, sg(r.pick(SYM.fill)))));
    const a = A.union(...parts); a.ord = 1;
    // drop anything that clashes (the petals' curl near the spike), keeping the spike
    const sp = new A.Space(), kept = [];
    for (const g of a.glyphs) { const one = new A.Art([g]); if (!sp.hits(one, 0.05)) { sp.add(one); kept.push(g); } }
    const b = new A.Art(kept); b.ord = 1; return b;
  }
  function gtreeR(r, R, d) {
    const u = 1.25 * MIN / 1.4, n = Math.max(2, Math.min(5, Math.floor(R / (u * 1.4)))), stemG = sym(r), cols = jewel(r, 3), parts = [];
    for (let k = 0; k <= 2 * n; k++) parts.push(A.palette([cols[0]], A.shift(0, R - (k + 0.5) * u, sg(stemG))));
    const top = A.palette(cols, gflowerR(r.fork("top"), Math.min(R * 0.35, 3), d - 1));
    parts.push(A.transform(A.centred(top), { dy: R - (2 * n + 1) * u - top.radius() }));
    for (let k = 1; k < n; k++) {
      const leaf = A.palette([cols[1 + (k % 2)]], r.chance(0.5) ? gburstR(r.fork("l" + k), Math.min(1.6, R * 0.2), 1) : gflowerR(r.fork("l" + k), Math.min(1.6, R * 0.2), 1));
      const y = R - (2 * k + 0.5) * u, x = leaf.radius() + u * 0.8, one = A.transform(A.centred(leaf), { dx: x, dy: y });
      parts.push(one, A.reflect(one));
    }
    const sp = new A.Space(), kept = [];
    for (const g of A.union(...parts).glyphs) { const o1 = new A.Art([g]); if (!sp.hits(o1, 0.05)) { sp.add(o1); kept.push(g); } }
    const b = A.centred(new A.Art(kept)); b.ord = 1; return b;
  }
  // entry points: grow(seed, kind, {maxR, depth})
  function grow(seed, kind, o) {
    const r = R(seed); o = Object.assign({ maxR: r.range(5, 9) }, o || {});
    const was = [GRID, GRID_RARE]; GRID = !!o.grid; GRID_RARE = GRID && r.chance(0.2);
    try { return growIn(r, kind, o); } finally { [GRID, GRID_RARE] = was; }
  }
  function growIn(r, kind, o) {
    const d = o.depth || (o.maxR > 7 ? 4 : o.maxR > 4 ? 3 : 2);
    const f = { flower: gflowerR, burst: gburstR, star: gstarR, snowflake: gsnowR, bilateral: gbilateralR, fleur: gfleurR, tree: gtreeR }[kind] || gflowerR;
    // the structure itself fills the room (longer rays, points, petals); only now and then is one ring added round it
    const wrap = o.wrap !== false && kind !== "fleur" && kind !== "tree" && r.chance(0.2);   // (the upright kinds are never ringed)
    let a = kind === "flower" ? gflowerR(r, o.maxR * (wrap ? 0.8 : 1), d, true) : f(r, o.maxR * (wrap ? 0.8 : 1), d);
    for (let q = 0; wrap && q < 1; q++) {
      const room = o.maxR - a.radius() - 0.3; if (room < 1.2) break;
      const rp = Math.min(room / 2, r.range(0.9, 2.2)), k = r.pick(["flower", "burst", "bilateral", "glyph"], [3, 2, 3, 2]), cols = jewel(r, r.pick([2, 3]));
      const part = A.palette(cols, k === "glyph" ? leafGlyph(r, rp, false) : k === "bilateral" ? gbilateralR(r.fork("w" + q), rp, d - 1) : k === "burst" ? gburstR(r.fork("w" + q), rp, d - 1) : gflowerR(r.fork("w" + q), rp, d - 1));
      const fit = ringFit(a, (k === "bilateral" ? part.width / 2 : part.radius()), 0.25), m = countFor(a, 3, 60, fit, null);
      if (m > fit || m < 3) break;
      const next = ringOf(a, part, m, 0.25);
      if (next.radius() > o.maxR * 1.05 || next.glyphs.length > GBUDGET) break;
      a = next;
    }
    // (o.grid: snapped to a grid of character cells, glyphs unturned; cw × ch in glyph units)
    if (o.grid) a = A.snap(a, o.grid[0], o.grid[1]);
    return A.seal(a);
  }
  // expressions in structures: a flower with an expression at its centre (rings round it), or a ring of upright
  // expressions round a flower. An expression is one glyph item: the whole string, set upright (never turned).
  const exprArt = (r, e) => { const a = A.glyph(e || r.pick(SYM.exprs), MIN * 0.8); a.glyphs[0].level = true; return a; };   // (text: never turned)
  function exprflower(seed, o) {
    const r = R(seed); o = Object.assign({ maxR: 8 }, o || {});
    const kind = r.pick(["centre", "ring"], [1, 1]), gap = 0.3;
    let a;
    if (kind === "centre") {
      a = exprArt(r); a.ord = 2;
      for (let q = 0; q < 3; q++) {
        const room = o.maxR - a.radius() - gap; if (room < 1.2) break;
        const part = A.palette(jewel(r, 2), r.chance(0.5) ? leafGlyph(r, 1, false) : gflowerR(r.fork("p" + q), Math.min(room / 2, r.range(1, 1.8)), 1));
        const fit = ringFit(a, part.radius(), gap), n = countFor(a, 4, 40, fit, null);
        if (n > fit) break;
        const next = ringOf(a, part, n, gap); if (next.radius() > o.maxR * 1.05) break; a = next;
      }
    } else {
      const c = gflowerR(r.fork("c"), o.maxR * 0.3, 2), e = exprArt(r), n = countFor(c, 3, 8, ringFit(c, e.width / 2, gap), r);
      a = ringOf(c, e, Math.min(n, 8), gap);
    }
    if (o.grid) a = A.snap(a, o.grid[0], o.grid[1]);
    return A.seal(a);
  }
  const gflower = (seed, o) => grow(seed, "flower", o), gburst = (seed, o) => grow(seed, "burst", o), gstar = (seed, o) => grow(seed, "star", o), gsnow = (seed, o) => grow(seed, "snowflake", o);

  global.GlyphGen = { MIN, grow, exprflower, gflower, gburst, gstar, gsnow, rng, order, light, POOLS, radial, halfRadial, leaf, petal, fleur, calyx, head, bloom, bud, stem, bouquet, symmetric, line, dotted, rosette, curl, mleaf, branch, bush, medallion, panel, field, chain, trail, jewel, MATH, SYM, motif, srosette, compound, smedallion, spanel, starburst, star, wallpaper, frieze, wreath, frame, pinwheel, hatpatch, dyad, sprig, nest, hatdisc, arm, cpetal, snowflake, cflower };
})(typeof window !== "undefined" ? window : globalThis);
