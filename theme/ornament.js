// ornament.js: a small composable grammar for glyph ornament.
//
// A library is a list of definitions, one per line:   name = expression
//
//   glyphs        ✿   λ   "C-c"          any word that is not a defined name is a glyph (quote to force)
//   choice        a | b | c   (or  a b c)  a disjunction: every use draws one disjunct at random;
//                 a*3 | b                  weights (default 1)
//   ring(child, n=8, center=…, r=auto, turn=yes, same=yes, size=0.8)
//                                          n copies of child round a centre (a rosette); `same` draws
//                                          the child once and repeats it (symmetric), `turn` turns
//                                          each copy outward
//   row(a, b, …, gap=0.15)   stack(a, b, …, gap=0.15)      side by side / one above another
//   mirror(child, gap=0)                   child and its mirror image, side by side
//   flip(child)                            the mirror image (paired glyphs swap: ❧ ☙, ⊸ ⟜, → ←)
//   scale(k, child)   tint(colour, child)  size and colour (accent, accent-2..4, ink, muted, or CSS)
//   picture(id, cell=…)                    a glyph-art picture; its brushes are expressions too
//   repeat(child, n, gap=0.15)             n draws of child in a row
//   scatter(child, n=7, w=6, h=5, gap=1)   n draws of child at random, at least `gap` apart
//   links(child, mode=mst, dash=yes)       join child's pieces with faint lines: mst (a minimum
//                                          spanning tree: constellation-like), chain (in order), near
//   quilt(child, cols=4, rows=3, cell=4, frame=yes)
//                                          a patchwork: a fresh draw of child in each square
//   solid(shape, size=18, ramp=…, tilt=…, turn=…)
//                                          a lit, shaded surface drawn with a density ramp of glyphs
//                                          (light to dark): torus, sphere, klein, mobius, trefoil, cube
//   moon(phase, size=9)                    phase 0 (new) .. 0.5 (full) .. 1, or today
//   orbit(r=3) doubled(r=3) sunburst(r=3) rosette(r=3) …   shapes made to measure (also shape(kind, r=…));
//                                          r=fit takes the radius the place it is drawn has room for
//   vertical(child)                        set sideways (for a signature running down a margin)
//   reflect(child)                         a mirror image of the drawing itself (glyphs unchanged,
//                                          shown mirrored; for pictures like ᓚᘏᗢ)   bold(child)
//
// Realizing an expression gives a drawing: { items: [{tok, x, y, s, rot, col, ...}], w, h },
// centred on the origin, in em. Rendering is left to the caller (the margin engine, widgets).
(function (global) {
  "use strict";

  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let t = hash(String(seed)) || 1;
    return function () { t += 0x6D2B79F5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }


  // ---------------------------------------------------------------- shapes
  // Shapes made to measure: a rosette, star, snowflake, ... of radius R (em), glyphs 1em, centred on
  // the origin. The margin engine fills gaps with them; the grammar has them as shape(kind, r=…) and
  // as functions of their own (orbit(r=3), doubled(r=3), ...). Never four-fold.
  // The radial shapes (rosette, orbit, corona, burst, …) are written with the combinators of
  // theme/glyphcraft.js (loaded first): shape() draws one from its catalog. half: "below" or
  // "above", for the divider; of: the kind of a composite's parts.
  const SHAPE_KINDS = global.Glyphcraft ? global.Glyphcraft.KIND_NAMES : ["rosette"];
  function shape(kind, R, r, palette, half, of) {
    return global.Glyphcraft ? global.Glyphcraft.shape(kind, R, r, palette, half, of) : [{ tok: "✦", x: 0, y: 0, s: 1, rot: 0, col: null }];
  }


  // ---------------------------------------------------------------- constellations
  // Real constellations: stars by right ascension (hours), declination (degrees) and magnitude, and
  // the usual stick figure. constellation(name) draws one north-up (east to the left, as on a sky
  // chart), `size` em across its longer side; bright stars are larger. constellation(any) picks one.
  const SKY = {
    orion: { s: [[5.919, 7.41, 0.5], [5.242, -8.2, 0.1], [5.419, 6.35, 1.6], [5.796, -9.67, 2.1], [5.679, -1.94, 1.8], [5.604, -1.2, 1.7], [5.533, -0.3, 2.2], [5.585, 9.93, 3.4]],
      l: [[7, 0], [7, 2], [0, 4], [2, 6], [4, 5], [5, 6], [4, 3], [6, 1]] },
    "ursa-major": { s: [[11.062, 61.75, 1.8], [11.031, 56.38, 2.4], [11.897, 53.69, 2.4], [12.257, 57.03, 3.3], [12.9, 55.96, 1.8], [13.399, 54.93, 2.2], [13.792, 49.31, 1.9]],
      l: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]] },
    cassiopeia: { s: [[0.153, 59.15, 2.3], [0.675, 56.54, 2.2], [0.945, 60.72, 2.2], [1.43, 60.24, 2.7], [1.907, 63.67, 3.4]], l: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    cygnus: { s: [[20.69, 45.28, 1.3], [20.37, 40.26, 2.2], [19.512, 27.96, 3.1], [20.77, 33.97, 2.5], [19.75, 45.13, 2.9]], l: [[0, 1], [1, 2], [4, 1], [1, 3]] },
    lyra: { s: [[18.616, 38.78, 0.0], [18.739, 39.67, 4.7], [18.746, 37.61, 4.3], [18.908, 36.9, 4.3], [18.982, 32.69, 3.2], [18.835, 33.36, 3.5]], l: [[0, 1], [0, 2], [2, 3], [3, 4], [4, 5], [5, 2]] },
    leo: { s: [[10.139, 11.97, 1.4], [10.122, 16.76, 3.5], [10.333, 19.84, 2.0], [10.278, 23.42, 3.4], [9.879, 26.01, 3.9], [9.764, 23.77, 3.0], [11.235, 20.52, 2.6], [11.237, 15.43, 3.3], [11.818, 14.57, 2.1]],
      l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 8], [8, 7], [7, 0]] },
    scorpius: { s: [[16.49, -26.43, 1.0], [16.353, -25.59, 2.9], [16.006, -22.62, 2.3], [16.091, -19.81, 2.6], [15.981, -26.11, 2.9], [16.598, -28.22, 2.8], [16.836, -34.29, 2.3], [16.864, -38.05, 3.0],
      [16.91, -42.36, 3.6], [17.203, -43.24, 3.3], [17.622, -43.0, 1.9], [17.793, -40.13, 3.0], [17.708, -39.03, 2.4], [17.56, -37.1, 1.6]],
      l: [[3, 2], [2, 4], [2, 1], [1, 0], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]] },
    gemini: { s: [[7.577, 31.89, 1.6], [7.755, 28.03, 1.1], [6.629, 16.4, 1.9], [6.732, 25.13, 3.0], [6.383, 22.51, 2.9], [7.335, 21.98, 3.5], [7.74, 24.4, 3.6]],
      l: [[0, 1], [0, 3], [3, 4], [1, 6], [1, 5], [5, 2]] },
    taurus: { s: [[4.599, 16.51, 0.9], [5.438, 28.61, 1.7], [5.627, 21.14, 3.0], [4.33, 15.63, 3.6], [4.382, 17.54, 3.8], [4.477, 19.18, 3.5], [4.011, 12.49, 3.5],
      [3.791, 24.11, 2.9], [3.819, 24.05, 3.6], [3.748, 24.11, 3.7], [3.763, 24.37, 3.9], [3.772, 23.95, 4.2], [3.753, 24.47, 4.3]],
      l: [[0, 2], [0, 3], [3, 6], [3, 4], [4, 5], [5, 1]] },
    aquila: { s: [[19.846, 8.87, 0.8], [19.771, 10.61, 2.7], [19.922, 6.41, 3.7], [19.425, 3.11, 3.4], [19.09, 13.86, 3.0], [20.188, -0.82, 3.2], [19.104, -4.88, 3.4]],
      l: [[1, 0], [0, 2], [0, 3], [3, 6], [3, 4], [0, 5]] },
    "canis-major": { s: [[6.752, -16.72, -1.5], [6.378, -17.96, 2.0], [6.977, -28.97, 1.5], [7.14, -26.39, 1.8], [7.401, -29.3, 2.4], [6.338, -30.06, 3.0]],
      l: [[0, 1], [0, 3], [3, 2], [3, 4], [2, 5]] },
    pegasus: { s: [[23.079, 15.21, 2.5], [23.063, 28.08, 2.4], [0.221, 15.18, 2.8], [0.14, 29.09, 2.1], [21.736, 9.88, 2.4], [22.691, 10.83, 3.4]],
      l: [[0, 1], [1, 3], [3, 2], [2, 0], [0, 5], [5, 4]] },
    delphinus: { s: [[20.661, 15.91, 3.8], [20.626, 14.6, 3.6], [20.777, 16.12, 3.9], [20.724, 15.07, 4.4], [20.554, 11.3, 4.0]], l: [[4, 1], [1, 0], [0, 2], [2, 3], [3, 1]] },
    bootes: { s: [[14.261, 19.18, -0.05], [13.911, 18.4, 2.7], [14.75, 27.07, 2.4], [15.258, 33.31, 3.5], [15.032, 40.39, 3.5], [14.535, 38.31, 3.0], [14.53, 30.37, 3.6]],
      l: [[0, 1], [0, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]] },
    "corona-borealis": { s: [[15.549, 31.36, 4.1], [15.464, 29.11, 3.7], [15.578, 26.71, 2.2], [15.713, 26.3, 3.8], [15.826, 26.07, 4.6], [15.96, 26.88, 4.2], [16.024, 29.85, 4.9]],
      l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
    hercules: { s: [[17.004, 30.93, 3.9], [16.688, 31.6, 2.8], [16.715, 38.92, 3.5], [17.251, 36.81, 3.2], [16.504, 21.49, 2.8], [17.25, 24.84, 3.1]],
      l: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [0, 5]] },
    sagittarius: { s: [[18.403, -34.38, 1.8], [18.35, -29.83, 2.7], [18.466, -25.42, 2.8], [18.761, -26.99, 3.2], [18.921, -26.3, 2.0], [19.116, -27.67, 3.3], [19.043, -29.88, 2.6], [18.097, -30.42, 3.0]],
      l: [[7, 1], [1, 0], [0, 7], [1, 2], [2, 3], [3, 1], [3, 4], [4, 5], [5, 6], [6, 3], [6, 0]] },
    andromeda: { s: [[0.14, 29.09, 2.1], [0.655, 30.86, 3.3], [1.162, 35.62, 2.1], [2.065, 42.33, 2.2], [0.946, 38.5, 3.9], [0.83, 41.08, 4.5]],
      l: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]] },
    perseus: { s: [[3.405, 49.86, 1.8], [3.136, 40.96, 2.1], [3.715, 47.79, 3.0], [3.964, 40.01, 2.9], [3.902, 31.88, 2.9], [3.08, 53.51, 2.9], [2.845, 55.9, 3.8]],
      l: [[6, 5], [5, 0], [0, 2], [2, 3], [3, 4], [0, 1]] },
    auriga: { s: [[5.278, 46.0, 0.1], [5.992, 44.95, 1.9], [5.995, 37.21, 2.6], [5.438, 28.61, 1.7], [4.95, 33.17, 2.7]], l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
    virgo: { s: [[13.42, -11.16, 1.0], [12.694, -1.45, 2.7], [12.927, 3.4, 3.4], [13.036, 10.96, 2.8], [13.578, -0.6, 3.4], [11.845, 1.76, 3.6], [12.332, -0.67, 3.9]],
      l: [[5, 6], [6, 1], [1, 2], [2, 3], [1, 0], [2, 4], [4, 0]] },
    draco: { s: [[17.943, 51.49, 2.2], [17.507, 52.3, 2.8], [17.892, 56.87, 3.8], [17.536, 55.18, 4.9], [19.209, 67.66, 3.1], [17.146, 65.71, 3.2], [16.4, 61.51, 2.7], [16.031, 58.57, 4.0],
      [15.415, 58.97, 3.3], [14.073, 64.38, 3.7], [12.558, 69.79, 3.9], [11.523, 69.33, 3.8]],
      l: [[0, 1], [1, 3], [3, 2], [2, 0], [2, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11]] },
    crux: { s: [[12.443, -63.1, 0.8], [12.795, -59.69, 1.3], [12.519, -57.11, 1.6], [12.252, -58.75, 2.8], [12.356, -60.4, 3.6]], l: [[0, 2], [1, 3]] },
    corvus: { s: [[12.263, -17.54, 2.6], [12.573, -23.4, 2.7], [12.498, -16.52, 2.9], [12.169, -22.62, 3.0], [12.14, -24.73, 4.0]], l: [[0, 2], [2, 1], [1, 3], [3, 0], [3, 4]] },
    cepheus: { s: [[21.31, 62.59, 2.5], [21.478, 70.56, 3.2], [23.656, 77.63, 3.2], [22.828, 66.2, 3.5], [22.181, 58.2, 3.4]], l: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 3]] },
    aries: { s: [[2.833, 27.26, 3.6], [2.12, 23.46, 2.0], [1.911, 20.81, 2.6], [1.892, 19.29, 3.9]], l: [[0, 1], [1, 2], [2, 3]] },
    capricornus: { s: [[20.3, -12.54, 3.6], [20.35, -14.78, 3.1], [20.768, -25.27, 4.1], [20.864, -26.92, 4.1], [21.444, -22.41, 3.7], [21.784, -16.13, 2.9], [21.668, -16.66, 3.7], [21.099, -17.23, 4.1]],
      l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]] },
    "ursa-minor": { s: [[2.53, 89.26, 2.0], [17.537, 86.59, 4.4], [16.766, 82.04, 4.2], [15.734, 77.79, 4.3], [14.845, 74.16, 2.1], [15.345, 71.83, 3.0], [16.292, 75.76, 5.0]],
      l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  };
  // The moon's phase on a date (days since the new moon of 2000-01-06 18:14 UTC, mod the synodic
  // month): its name, how much is lit, and a glyph (ink = lit, northern-hemisphere view).
  function moonPhase(date) {
    const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5, p = ((days / 29.530588853) % 1 + 1) % 1;
    const lit = (1 - Math.cos(2 * Math.PI * p)) / 2;
    const [name, glyph] = p < 0.03 || p > 0.97 ? ["new moon", "○"] : p < 0.22 ? ["waxing crescent", "☽"] : p < 0.28 ? ["first quarter", "◑"] : p < 0.47 ? ["waxing gibbous", "◑"]
      : p < 0.53 ? ["full moon", "●"] : p < 0.72 ? ["waning gibbous", "◐"] : p < 0.78 ? ["last quarter", "◐"] : ["waning crescent", "☾"];
    return { p, lit, name, glyph };
  }
  // The moon's place (low-precision series, ~0.3°) and its rise and set for an observer, by sampling
  // its altitude through the day. lat/lon in degrees (east positive).
  function moonPos(date) {
    const d = date.getTime() / 864e5 - 10957.5, rad = Math.PI / 180;
    const L = (218.316 + 13.176396 * d) * rad, M = (134.963 + 13.064993 * d) * rad, F = (93.272 + 13.22935 * d) * rad;
    const l = L + 6.289 * rad * Math.sin(M), b = 5.128 * rad * Math.sin(F), e = 23.4397 * rad;
    const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)), dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    return { ra, dec, d };
  }
  function moonAltitude(date, lat, lon) {
    const rad = Math.PI / 180, p = moonPos(date), lst = (280.16 + 360.9856235 * p.d) * rad + lon * rad, H = lst - p.ra;
    return Math.asin(Math.sin(lat * rad) * Math.sin(p.dec) + Math.cos(lat * rad) * Math.cos(p.dec) * Math.cos(H)) / rad;
  }
  function moonTimes(day, lat, lon) {   // the local calendar day of `day`
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()), h0 = 0.133, out = {};
    let prev = moonAltitude(start, lat, lon) - h0;
    for (let m = 10; m <= 1440; m += 10) {
      const t = new Date(start.getTime() + m * 6e4), a = moonAltitude(t, lat, lon) - h0;
      if (prev < 0 && a >= 0 && !out.rise) out.rise = new Date(t.getTime() - 6e5 * a / (a - prev));
      if (prev >= 0 && a < 0 && !out.set) out.set = new Date(t.getTime() - 6e5 * a / (a - prev));
      prev = a;
    }
    return out;
  }
  function constellation(name, size, r) {
    const keys = Object.keys(SKY), k = SKY[name] ? name : keys[Math.floor((r || Math.random)() * keys.length)];
    const C = SKY[k];
    // gnomonic projection about the figure's centre (unit vectors, so the pole and RA 0h are fine)
    const vec = ([ra, de]) => { const a = ra * Math.PI / 12, d = de * Math.PI / 180; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; };
    const V = C.s.map(vec), c = V.reduce((m, v) => [m[0] + v[0], m[1] + v[1], m[2] + v[2]], [0, 0, 0]), cl = Math.hypot(...c), n = c.map(x => x / cl);
    const east = (() => { const e = [-n[1], n[0], 0], l = Math.hypot(...e) || 1; return e.map(x => x / l); })();
    const north = [n[1] * east[2] - n[2] * east[1], n[2] * east[0] - n[0] * east[2], n[0] * east[1] - n[1] * east[0]];
    const P = V.map(v => { const dt = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; return [-(v[0] * east[0] + v[1] * east[1] + v[2] * east[2]) / dt, -(v[0] * north[0] + v[1] * north[1] + v[2] * north[2]) / dt]; });
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), w0 = Math.max(...xs) - Math.min(...xs), h0 = Math.max(...ys) - Math.min(...ys);
    const k2 = (size || 7) / Math.max(w0, h0, 1e-6), cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const pts = P.map(p => [(p[0] - cx) * k2, (p[1] - cy) * k2]);
    const items = [];
    for (const [a, b] of C.l) items.push({ seg: true, tok: "", x: pts[a][0], y: pts[a][1], dx: pts[b][0] - pts[a][0], dy: pts[b][1] - pts[a][1], col: null, dash: true });
    // stars vary: each brightness has a few glyphs, picked per star
    const rr = r || Math.random, BRIGHT = ["✦", "✸", "✶", "✹", "★"], MID = ["✦", "✧", "⋆", "✶", "∗"], FAINT = ["⋆", "∗", "✧", "•"], DIM = ["•", "∘", "⋆"];
    const pk = xs => xs[Math.floor(rr() * xs.length)];
    C.s.forEach((st, i) => { const m = st[2];
      items.push({ tok: m < 1.5 ? pk(BRIGHT) : m < 2.6 ? pk(MID) : m < 3.6 ? pk(FAINT) : pk(DIM), x: pts[i][0], y: pts[i][1], s: m < 1.5 ? 1.55 : m < 2.6 ? 1.2 : m < 3.6 ? 1.05 : 1.1, rot: 0,
        col: m < 1.5 ? "var(--accent-4)" : m < 2.6 ? "var(--accent-3)" : "var(--accent-2)", name: i === 0 ? k : undefined }); });
    return { items, w: w0 * k2 + 1, h: h0 * k2 + 1 };
  }

  // ---------------------------------------------------------------- parsing
  const PUNCT = "()|,=*";
  function lex(src) {
    const out = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "#" && (i === 0 || /\s/.test(src[i - 1])) && (i + 1 >= src.length || /\s/.test(src[i + 1]))) break;   // "# comment" (not #hex)
      if (PUNCT.includes(c)) { out.push({ p: c }); i++; continue; }
      if (c === '"') { let j = i + 1; while (j < src.length && src[j] !== '"') j++; out.push({ w: src.slice(i + 1, j), q: true }); i = j + 1; continue; }
      let j = i; while (j < src.length && !/\s/.test(src[j]) && !PUNCT.includes(src[j])) j++;
      out.push({ w: src.slice(i, j) }); i = j;
    }
    return out;
  }
  const MATHFONT = '"Helia Math", "New Computer Modern Math", "STIX Two Math", "Cambria Math", serif';
  function parse(src) {
    const ts = lex(src); let k = 0;
    const peek = () => ts[k], isP = p => ts[k] && ts[k].p === p;
    const expect = p => { if (!isP(p)) throw new Error("expected " + p + " in: " + src); k++; };
    function choice() {
      const alts = [weighted()];
      while (isP("|")) { k++; alts.push(weighted()); }
      return alts.length === 1 ? alts[0].e : { t: "choice", alts };
    }
    function weighted() {
      let e = seq(), w = 1;
      if (isP("*")) { k++; const n = peek(); if (!n || n.w == null) throw new Error("expected a weight after *"); w = parseFloat(n.w) || 1; k++; }
      return { e, w };
    }
    function seq() {                                           // several atoms side by side: a bag (a choice)
      const xs = [];
      while (peek() && peek().w != null || isP("(")) xs.push(atom());
      if (!xs.length) throw new Error("expected something in: " + src);
      return xs.length === 1 ? xs[0] : { t: "choice", alts: xs.map(e => ({ e, w: 1 })) };
    }
    function atom() {
      if (isP("(")) { k++; const e = choice(); expect(")"); return e; }
      const tok = ts[k++];
      if (tok.q) return { t: "lit", w: tok.w };
      if (isP("(")) {                                          // a call
        k++; const pos = [], kw = {};
        if (!isP(")")) for (;;) {
          if (ts[k] && ts[k].w != null && !ts[k].q && ts[k + 1] && ts[k + 1].p === "=") { const key = ts[k].w; k += 2; kw[key] = choice(); }
          else pos.push(choice());
          if (isP(",")) { k++; continue; }
          break;
        }
        expect(")");
        return { t: "call", f: tok.w, pos, kw };
      }
      return { t: "word", w: tok.w };
    }
    const e = choice();
    if (k < ts.length) throw new Error("unexpected " + (ts[k].p || ts[k].w) + " in: " + src);
    return e;
  }
  // A library: "name = expr" lines (and blank lines, # comments). Returns { defs, errors }.
  function library(lines) {
    const defs = {}, errors = [];
    for (const raw of lines) {
      const line = raw.replace(/^\s+|\s+$/g, "");
      if (!line || line[0] === "#") continue;
      const m = /^([A-Za-z][\w-]*)\s*=\s*(.*)$/.exec(line);
      if (!m) { errors.push("not a definition: " + line); continue; }
      try { defs[m[1]] = { src: m[2], e: parse(m[2]) }; }
      catch (x) {
        // a top-level list (`place = a, b, c`) reads as list(a, b, c)
        try { defs[m[1]] = { src: m[2], e: parse("list(" + m[2] + ")") }; } catch (y) { errors.push(m[1] + ": " + x.message); }
      }
    }
    return { defs, errors };
  }

  // ---------------------------------------------------------------- realizing
  const PAIRS = [["⊸", "⟜"], ["→", "←"], ["⟦", "⟧"], ["⟨", "⟩"], ["⊢", "⊣"], ["◁", "▷"], ["❧", "☙"], ["↦", "↤"], ["⇒", "⇐"], ["(", ")"], ["[", "]"]];
  const PARTNER = new Map(); for (const [a, b] of PAIRS) { PARTNER.set(a, b); PARTNER.set(b, a); }
  const partner = tok => Array.from(tok).reverse().map(c => PARTNER.get(c) || c).join("");
  const COLOUR = c => (/^(accent(-[234])?|ink|muted|rule|paper)$/.test(c) ? "var(--" + c + ")" : c);
  const width = tok => (Array.from(tok).length > 1 ? 0.55 * Array.from(tok).length : 1);
  const one = (tok, extra) => Object.assign({ tok, x: 0, y: 0, s: 1, rot: 0, col: null }, extra || {});
  const D = (items, w, h) => ({ items, w, h });
  function transform(d, f) { return D(d.items.map(f), d.w, d.h); }
  function num(ctx, e, dflt) {
    if (!e) return dflt;
    if (e.t === "word" || e.t === "lit") { const n = parseFloat(e.w); return isNaN(n) ? dflt : n; }
    return dflt;
  }
  function word(e) { return e && (e.t === "word" || e.t === "lit") ? e.w : null; }
  const BUILTIN_PATTERNS = ["vine", "rosettes-classic", "lattice", "interlace", "tiles", "sampler", "frieze", "tree", "lace", "constellation", "chain", "border", "scatter"];

  function realize(e, ctx) {
    ctx.depth = (ctx.depth || 0) + 1;
    if (ctx.depth > 40) { ctx.depth--; return D([], 0, 0); }
    let d;
    switch (e.t) {
      case "lit": d = D([one(e.w, { col: ctx.col || null })], width(e.w), 1); break;
      case "word":
        if (ctx.defs[e.w]) d = realize(ctx.defs[e.w].e, ctx);
        else d = D([one(e.w, { col: ctx.col || null })], width(e.w), 1);
        break;
      case "choice": {
        const total = e.alts.reduce((a, x) => a + x.w, 0); let pick = ctx.r() * total, alt = e.alts[e.alts.length - 1];
        for (const x of e.alts) { if ((pick -= x.w) < 0) { alt = x; break; } }
        d = realize(alt.e, ctx); break;
      }
      case "call": d = call(e, ctx); break;
      default: d = D([], 0, 0);
    }
    ctx.depth--;
    return d;
  }
  function call(e, ctx) {
    const P = e.pos, K = e.kw, f = e.f;
    const sub = (x, patch) => realize(x, patch ? Object.assign(Object.create(ctx), patch) : ctx);
    if (f === "ring") {
      // never four round a centre (four-fold rotational symmetry can read as a swastika): four becomes five
      let n = Math.max(1, Math.round(num(ctx, K.n || P[1], 8))); if (n === 4) n = 5;
      const size = num(ctx, K.size, 0.8);
      const same = word(K.same) !== "no", turn = word(K.turn) !== "no";
      const c = K.center ? sub(K.center) : D([], 0, 0);
      let first = same ? scaled(sub(P[0]), size) : null;
      const cw = first ? Math.max(first.w, first.h) : size;
      const R = num(ctx, K.r, Math.max(Math.max(c.w, c.h) / 2 + cw / 2 + 0.12, (n * cw * 1.05) / (2 * Math.PI)));
      const items = c.items.slice();
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, pd = first || scaled(sub(P[0]), size);
        const ca = Math.cos(turn ? a + Math.PI / 2 : 0), sa = Math.sin(turn ? a + Math.PI / 2 : 0);
        for (const it of pd.items) {
          const x = it.x * ca - it.y * sa, y = it.x * sa + it.y * ca;
          items.push(Object.assign({}, it, { x: x + Math.cos(a) * R, y: y + Math.sin(a) * R, rot: (it.rot || 0) + (turn ? (a * 180) / Math.PI + 90 : 0) }));
        }
      }
      const ext = 2 * R + cw;
      return D(items, Math.max(ext, c.w), Math.max(ext, c.h));
    }
    if (f === "row" || f === "stack" || f === "repeat") {
      const gap = num(ctx, K.gap, 0.15);
      const parts = f === "repeat" ? Array.from({ length: Math.max(1, Math.round(num(ctx, P[1], 3))) }, () => sub(P[0])) : P.map(x => sub(x));
      const horiz = f !== "stack";
      const total = parts.reduce((a, p) => a + (horiz ? p.w : p.h), 0) + gap * Math.max(0, parts.length - 1);
      let at = -total / 2; const items = [];
      for (const p of parts) {
        const off = at + (horiz ? p.w : p.h) / 2;
        for (const it of p.items) items.push(Object.assign({}, it, horiz ? { x: it.x + off } : { y: it.y + off }));
        at += (horiz ? p.w : p.h) + gap;
      }
      return horiz ? D(items, total, Math.max(0, ...parts.map(p => p.h))) : D(items, Math.max(0, ...parts.map(p => p.w)), total);
    }
    if (f === "flip") return flip(sub(P[0]));
    if (f === "mirror") {
      const d = sub(P[0]), gap = num(ctx, K.gap, 0);
      const l = transform(d, it => Object.assign({}, it, { x: it.x - d.w / 2 - gap / 2 })), r = flip(d);
      return D(l.items.concat(r.items.map(it => Object.assign({}, it, { x: it.x + d.w / 2 + gap / 2 }))), 2 * d.w + gap, d.h);
    }
    if (f === "scale") return scaled(sub(P[1]), num(ctx, P[0], 1));
    if (f === "tint") return sub(P[1], { col: COLOUR(word(P[0]) || "ink") });
    if (f === "vertical") { const d = sub(P[0]); return D(d.items.map(it => Object.assign({}, it, { vertical: true })), 1, d.w); }
    if (f === "scatter") {
      const n = Math.max(1, Math.round(num(ctx, K.n || P[1], 7))), w = num(ctx, K.w, 6), h = num(ctx, K.h, 5), gap = num(ctx, K.gap, 1);
      const pts = [], items = [];
      for (let t = 0; t < n * 30 && pts.length < n; t++) {
        const x = (ctx.r() - 0.5) * w, y = (ctx.r() - 0.5) * h;
        if (pts.every(p => Math.hypot(p[0] - x, p[1] - y) >= gap)) pts.push([x, y]);
      }
      for (const [x, y] of pts) for (const it of sub(P[0]).items) items.push(Object.assign({}, it, { x: it.x + x, y: it.y + y }));
      return D(items, w + 1, h + 1);
    }
    if (f === "links") {
      const d = sub(P[0]), mode = word(K.mode) || "mst", dash = word(K.dash) !== "no";
      const pts = d.items.filter(it => !it.seg).map(it => [it.x, it.y]), lines = [];
      if (mode === "chain") for (let i = 1; i < pts.length; i++) lines.push([pts[i - 1], pts[i]]);
      else if (pts.length > 1) {                                // Prim's minimum spanning tree
        const inT = [0], rest = pts.map((_, i) => i).slice(1);
        while (rest.length) {
          let best = null;
          for (const a of inT) for (const b of rest) { const dd = Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]); if (!best || dd < best[2]) best = [a, b, dd]; }
          lines.push([pts[best[0]], pts[best[1]]]); inT.push(best[1]); rest.splice(rest.indexOf(best[1]), 1);
        }
        if (mode === "near") for (let i = 0; i < pts.length; i++) { // plus each star's nearest neighbour
          let bj = -1, bd = 1e9; for (let j = 0; j < pts.length; j++) if (j !== i) { const dd = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (dd < bd) { bd = dd; bj = j; } }
          if (bj >= 0) lines.push([pts[i], pts[bj]]);
        }
      }
      const segs = lines.map(([a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, k = 0.38 / L;
        return seg(a[0] + dx * k, a[1] + dy * k, dx * (1 - 2 * k), dy * (1 - 2 * k), ctx.col, dash); });
      return D(segs.concat(d.items), d.w, d.h);
    }
    if (f === "quilt") {
      const cols = Math.round(num(ctx, K.cols, 4)), rows = Math.round(num(ctx, K.rows, 3)), cell = num(ctx, K.cell, 4), frame = word(K.frame) !== "no";
      const items = [], W = cols * cell, Hh = rows * cell;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const d = sub(P[0]), k = Math.min(1, (cell * 0.82) / Math.max(d.w, d.h, 0.5)), cx = (i + 0.5) * cell - W / 2, cy = (j + 0.5) * cell - Hh / 2;
        for (const it of scaled(d, k).items) items.push(Object.assign({}, it, { x: it.x + cx, y: it.y + cy }));
      }
      if (frame) {
        for (let i = 0; i <= cols; i++) items.push(seg(i * cell - W / 2, -Hh / 2, 0, Hh, "var(--rule)", true));
        for (let j = 0; j <= rows; j++) items.push(seg(-W / 2, j * cell - Hh / 2, W, 0, "var(--rule)", true));
      }
      return D(items, W, Hh);
    }
    if (f === "solid") {
      const ramp = K.ramp ? (word(K.ramp) ? word(K.ramp).split("") : glyphList(K.ramp, ctx)) : ["·", "∙", "∘", "○", "⊙", "⊕", "⊗", "◉", "●"];
      return solid(word(P[0]) || "torus", num(ctx, K.size, 18), ramp, num(ctx, K.tilt, 1.05), num(ctx, K.turn, 0.5), ctx.col);
    }
    if (f === "moon") {
      const ph = word(P[0]) === "today" || !P[0] ? moonPhaseToday() : num(ctx, P[0], 0.5);
      const ramp = K.ramp ? glyphList(K.ramp, ctx) : ["●", "◉", "⊙", "○", "∘"];
      return moon(ph, num(ctx, K.size, 9), ramp, ctx.col || "var(--accent-4)");
    }
    if (f === "reflect") { const d = sub(P[0]); return D(d.items.map(it => Object.assign({}, it, { x: -it.x, rot: -(it.rot || 0), reflect: !it.reflect })), d.w, d.h); }
    if (f === "lunar") { const m = moonPhase(new Date()); return D([one(m.glyph, { moon: true })], 1, 1); }   // today's moon, as a glyph
    if (f === "constellation") { const d = constellation(word(P[0]) || "any", num(ctx, K.size, 7), ctx.r); return D(d.items, d.w, d.h); }
    if (f === "shape" || SHAPE_KINDS.includes(f)) {
      // r=fit: the radius the caller has room for (ctx.fitR, in em), else 3
      const re = K.r || (f === "shape" ? P[1] : P[0]), kind = f === "shape" ? (word(P[0]) || "rosette") : f;
      const R = word(re) === "fit" ? (ctx.fitR || 3) : num(ctx, re, 3);
      const half = word(K.half), of = word(K.of);   // of: the kind of a composite's parts (burst, circlet)
      return D(shape(kind, R, ctx.r, undefined, half === "below" || half === "above" ? half : null, of && SHAPE_KINDS.includes(of) ? of : undefined), 2 * R, 2 * R);
    }
    if (f === "bold") { const d = sub(P[0]); return D(d.items.map(it => Object.assign({}, it, { bold: true })), d.w, d.h); }
    if (f === "code") { const d = sub(P[0]); return D(d.items.map(it => Object.assign({}, it, { code: true })), d.w, d.h); }   // set in the code font
    if (f === "math") { const d = sub(P[0]); return D(d.items.map(it => Object.assign({}, it, { math: true })), d.w, d.h); }   // set in the math font
    if (f === "picture") {
      const id = word(P[0]), pic = ctx.pictures && ctx.pictures[id];
      if (!pic) return D([one("?", { col: "var(--muted)" })], 1, 1);
      const cell = num(ctx, K.cell, pic.cell || 1), rows = pic.rows, w = Math.max(...rows.map(r => Array.from(r).length));
      const items = [];
      rows.forEach((row, j) => Array.from(row).forEach((ch, i) => {
        const b = pic.brushes[ch]; if (!b) return;
        const d = sub(b.e, b.col ? { col: COLOUR(b.col) } : null);
        for (const it of d.items) items.push(Object.assign({}, it, { x: it.x + (i - (w - 1) / 2) * cell, y: it.y + (j - (rows.length - 1) / 2) * cell }));
      }));
      return D(items, w * cell, rows.length * cell);
    }
    // a built-in margin pattern used as a structure: stands for itself (the engine draws it)
    if (BUILTIN_PATTERNS.indexOf(f) >= 0) return D([one("·")], 1, 1);
    return D([one(f, { col: "var(--muted)" })], width(f), 1);           // unknown: shown as a word
  }
  // the glyphs of a choice, in order (a ramp): "· ∘ ⊙ ●" or a | b | c
  function glyphList(e, ctx) {
    if (!e) return [];
    if (e.t === "lit") return [e.w];
    if (e.t === "word") return ctx.defs[e.w] ? glyphList(ctx.defs[e.w].e, ctx) : [e.w];
    if (e.t === "choice") return e.alts.reduce((a, x) => a.concat(glyphList(x.e, ctx)), []);
    return [];
  }
  function scaled(d, k) { return D(d.items.map(it => Object.assign({}, it, { x: it.x * k, y: it.y * k, s: (it.s || 1) * k }, it.seg ? { dx: it.dx * k, dy: it.dy * k } : {})), d.w * k, d.h * k); }
  const seg = (x, y, dx, dy, col, dash) => ({ seg: true, tok: "", x, y, dx, dy, col: col || null, dash: dash !== false });

  // ---- procedural surfaces: parametric, rotated, z-buffered onto a grid, shaded by the light
  const SURF = {
    torus: (u, v) => [(2 + Math.cos(v)) * Math.cos(u), (2 + Math.cos(v)) * Math.sin(u), Math.sin(v)],
    sphere: (u, v) => [Math.cos(u) * Math.sin(v / 2) * 2, Math.sin(u) * Math.sin(v / 2) * 2, Math.cos(v / 2) * 2],
    klein: (u, v) => {                                          // the figure-8 immersion
      const r = 2.2, c = Math.cos(u / 2), s = Math.sin(u / 2), a = r + c * Math.sin(v) - s * Math.sin(2 * v);
      return [a * Math.cos(u) * 0.8, a * Math.sin(u) * 0.8, (s * Math.sin(v) + c * Math.sin(2 * v)) * 0.8];
    },
    mobius: (u, v) => { const w = (v / Math.PI - 1) * 0.9; return [(2 + w * Math.cos(u / 2)) * Math.cos(u), (2 + w * Math.cos(u / 2)) * Math.sin(u), w * Math.sin(u / 2)]; },
    trefoil: (u, v) => {
      const c = [Math.sin(u) + 2 * Math.sin(2 * u), Math.cos(u) - 2 * Math.cos(2 * u), -Math.sin(3 * u)];
      const e = 1e-3, c2 = [Math.sin(u + e) + 2 * Math.sin(2 * (u + e)), Math.cos(u + e) - 2 * Math.cos(2 * (u + e)), -Math.sin(3 * (u + e))];
      const t = norm(sub3(c2, c)), n1 = norm(cross(t, [0, 0, 1])), n2 = cross(t, n1), r = 0.42;
      return [0, 1, 2].map(i => (c[i] + r * (Math.cos(v) * n1[i] + Math.sin(v) * n2[i])) * 0.62);
    },
    cube: (u, v) => {                                           // six faces from (u, v) in [0, 2π)²
      const f = Math.floor(u / (Math.PI / 3)), a = (u % (Math.PI / 3)) / (Math.PI / 3) * 2 - 1, b = v / Math.PI - 1, k = 1.35;
      return [[k, a * k, b * k], [-k, a * k, b * k], [a * k, k, b * k], [a * k, -k, b * k], [a * k, b * k, k], [a * k, b * k, -k]][f];
    },
  };
  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function solid(shape, size, ramp, tilt, turn, col) {
    const f = SURF[shape] || SURF.torus, W = Math.max(6, Math.round(size)), H = W;
    const ct = Math.cos(tilt), st = Math.sin(tilt), cz = Math.cos(turn), sz = Math.sin(turn);
    const rot = p => { let [x, y, z] = p; [x, y] = [x * cz - y * sz, x * sz + y * cz]; [y, z] = [y * ct - z * st, y * st + z * ct]; return [x, y, z]; };
    const zb = new Float32Array(W * H).fill(-1e9), lum = new Float32Array(W * H).fill(-1);
    const L = norm([-0.5, 0.7, 0.9]), N = 180, e = 1e-3, scale = W / 7.2;
    for (let i = 0; i < N; i++) for (let j = 0; j < N / 2; j++) {
      const u = (i / N) * 2 * Math.PI, v = (j / (N / 2)) * 2 * Math.PI;
      const p = rot(f(u, v)), pu = rot(f(u + e, v)), pv = rot(f(u, v + e));
      let n = norm(cross(sub3(pu, p), sub3(pv, p)));
      if (n[2] < 0) n = n.map(x => -x);                         // light both sides (one-sided surfaces)
      const X = Math.round(W / 2 + p[0] * scale), Y = Math.round(H / 2 - p[1] * scale);
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const k = Y * W + X;
      if (p[2] > zb[k]) { zb[k] = p[2]; lum[k] = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]); }
    }
    const items = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let l = lum[y * W + x]; if (l < 0) continue;
      l = 0.22 + 0.78 * l;                                      // some ambient light
      const g = ramp[Math.min(ramp.length - 1, Math.floor((1 - l) * ramp.length))];   // lit = light glyphs
      items.push(one(g, { x: x - (W - 1) / 2, y: y - (H - 1) / 2, s: 0.95, col }));
    }
    return D(items, W, H);
  }
  // the moon: a disk lit from the right (waxing) or left (waning); phase 0 new, 0.5 full
  function moonPhaseToday() { const d = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000; return ((d % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853; }
  function moon(phase, size, ramp, col) {
    const W = Math.max(5, Math.round(size)), R = (W - 1) / 2, items = [], k = Math.cos(phase * 2 * Math.PI);  // 1 new .. -1 full
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const X = (x - R) / R, Y = (y - R) / R; if (X * X + Y * Y > 1) continue;
      const edge = Math.sqrt(Math.max(0, 1 - Y * Y)), term = k * edge;       // terminator's x at this height
      const lit = phase < 0.5 ? X > term : X < -term;
      const shade = lit ? ramp[Math.min(ramp.length - 1, Math.floor(((X * X + Y * Y) ** 2) * 1.2))] : ramp[ramp.length - 1];
      items.push(one(lit ? shade : "·", { x: x - R, y: y - R, s: 0.95, col: lit ? col : "var(--rule)" }));
    }
    return D(items, W, W);
  }
  function flip(d) { return D(d.items.map(it => it.seg ? Object.assign({}, it, { x: -it.x, dx: -it.dx }) : Object.assign({}, it, { x: -it.x, rot: -(it.rot || 0), tok: partner(it.tok) })), d.w, d.h); }

  // The disjuncts of a definition that is a choice (e.g. `patterns`), as names/sources.
  function disjuncts(lib, name) {
    const d = lib.defs[name]; if (!d) return [];
    const e = d.e, alts = e.t === "choice" ? e.alts : [{ e, w: 1 }];
    return alts.map(a => ({ name: a.e.t === "word" ? a.e.w : null, e: a.e, w: a.w, builtin: a.e.t === "word" && BUILTIN_PATTERNS.indexOf(a.e.w) >= 0 && !lib.defs[a.e.w] }));
  }
  // The items of a list definition (e.g. `place = a, b, c`): parsed as call args of an implicit list.
  function list(lib, name) {
    const d = lib.defs[name]; if (!d) return [];
    return d.e.t === "call" && d.e.f === "list" ? d.e.pos : [d.e];
  }

  // Render a drawing into a box (HTML), fitted to `px` per em; used by the widgets and previews.
  function renderInto(doc, box, d, px, opts) {
    opts = opts || {};
    box.textContent = "";
    box.style.position = "relative";
    box.style.width = Math.max(1, d.w) * px + "px"; box.style.height = Math.max(1, d.h) * px + "px";
    for (const it of d.items) {
      const e = doc.createElement("span");
      if (it.seg) {                                            // a line segment (links, frames)
        const len = Math.hypot(it.dx, it.dy) * px;
        e.style.cssText = "position:absolute;height:0;border-top:" + (it.dash ? "1px dotted" : "1px solid") + " currentColor;opacity:.55;transform-origin:0 0;left:" + ((it.x + Math.max(1, d.w) / 2) * px).toFixed(1) + "px;top:" + ((it.y + Math.max(1, d.h) / 2) * px).toFixed(1) + "px;width:" + len.toFixed(1) + "px;rotate:" + (Math.atan2(it.dy, it.dx) * 180 / Math.PI).toFixed(1) + "deg";
        e.style.color = it.col || "var(--muted)";
        box.appendChild(e); continue;
      }
      e.textContent = it.tok;
      e.style.cssText = "position:absolute;line-height:1;white-space:nowrap;translate:-50% -50%;left:" + ((it.x + Math.max(1, d.w) / 2) * px).toFixed(1) + "px;top:" + ((it.y + Math.max(1, d.h) / 2) * px).toFixed(1) + "px;font-size:" + (px * (it.s || 1)).toFixed(1) + "px";
      if (it.col) e.style.color = it.col; else if (opts.colour) e.style.color = opts.colour(it.tok);
      if (it.rot) e.style.rotate = it.rot.toFixed(1) + "deg";
      if (it.vertical) e.style.writingMode = "vertical-rl";
      if (it.bold) e.style.fontWeight = "700";
      if (it.math) e.style.fontFamily = MATHFONT;
      if (it.code) e.style.fontFamily = "var(--helia-font-mono, monospace)";
      if (it.reflect) e.style.transform = "scaleX(-1)";
      box.appendChild(e);
    }
    return box;
  }

  global.Ornament = { parse, library, realize, disjuncts, list, renderInto, rng, partner, COLOUR, BUILTIN_PATTERNS, shape, SHAPE_KINDS, SKY, moonPhase, moonTimes };
})(typeof window !== "undefined" ? window : globalThis);
