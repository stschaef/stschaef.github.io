/* glyphs.js — printer's-flowers ornament from Unicode glyphs (prototype, v2).
 *
 * Seeded and aperiodic, built from type: set in the margins beside the text
 * column, as a symmetric headpiece above the title, and (optionally) as a
 * "sea" that thickens down the page and floods the full width past the end of
 * the content. Every glyph is a span: it prints as text, scales crisply and
 * takes its colour from the theme.
 *
 *   Glyphs.init({
 *     alphabet: "→ ∀ ∃ Σ Π × ⊕ ⊗ ⟦-⟧ ⊸ ⟜ よ ⊤ ⊥",   // whitelist (space-separated tokens); default: fleurons
 *     margins: 'chain'|'scatter'|'border'|'off', headpiece: 'pyramid'|'row'|'rule'|'off',
 *     palette: 'theme'|'rubric'|'folk'|'ink', density: 1, size: 1, seed,
 *     sea: true, seaDepth: 1.2,             // extra height (viewport heights) flooded below the content
 *   }) -> { destroy(), rebuild() }
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------- randomness
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(String(seed)) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

  // ---------------------------------------------------------------- the type case
  const FLEURONS = {
    flower: ["✿", "❀", "❁", "✾", "❃", "✽", "⚘"],
    leaf: ["❧", "❦", "☙", "❥"],
    star: ["✦", "✧", "✳", "✴", "✵", "❈"],
    mark: ["⚜", "✠", "☩", "⸙"],
    dot: ["·", "•", "⁂", "⁕"],
  };

  // Mirror partners: a symmetric headpiece uses the partner on the right, never a
  // CSS flip, so letters are never reversed. Unpaired tokens repeat as they are.
  const PAIRS = [["⊸", "⟜"], ["→", "←"], ["⟦", "⟧"], ["⟨", "⟩"], ["⊢", "⊣"], ["◁", "▷"], ["⊲", "⊳"],
    ["↦", "↤"], ["⇒", "⇐"], ["≤", "≥"], ["⊂", "⊃"], ["⊆", "⊇"], ["⊏", "⊐"], ["❧", "☙"],
    ["(", ")"], ["[", "]"], ["{", "}"], ["<", ">"]];
  const PARTNER = new Map();
  for (const [a, b] of PAIRS) { PARTNER.set(a, b); PARTNER.set(b, a); }
  function partner(tok) { return Array.from(tok).reverse().map(c => PARTNER.get(c) || c).join(""); }

  const THEME = ["var(--accent, #a52a1f)", "var(--ink, #231c15)", "var(--accent-2, var(--accent, #a52a1f))",
    "var(--accent-3, var(--muted, #6c5e4c))", "var(--accent-4, var(--accent, #a52a1f))", "var(--accent-5, var(--accent-3, #6c5e4c))"];
  const PALETTES = {
    theme: null, // per-token: hash of the token picks a theme colour, so a glyph keeps its colour everywhere
    rubric: ["var(--accent, #a52a1f)", "var(--accent, #a52a1f)", "var(--ink, #231c15)"],
    folk: ["#d9707a", "#4f7fbf", "#e8b93a", "#5f8f4e", "#c46a7a"],
    ink: ["var(--ink, #231c15)"],
  };
  function colour(o, tok, r) {
    const pal = PALETTES[o.palette];
    return pal ? pick(r, pal) : THEME[hash(tok) % THEME.length];
  }
  const RULE = o => (o.palette === "ink" ? "var(--ink, #231c15)" : "var(--accent, #a52a1f)");

  const FONT = '"STIX Two Math", "STIX Two Text", "EB Garamond", "Noto Sans Symbols 2", "Noto Sans Symbols", ' +
    '"Euphemia UCAS", "Noto Sans Canadian Aboriginal", "Noto Sans Phoenician", ' +
    '"Apple Symbols", "Hiragino Mincho ProN", "Noto Serif JP", serif';

  function tokens(o) {
    if (o.alphabet && String(o.alphabet).trim()) return String(o.alphabet).trim().split(/\s+/);
    return [].concat(FLEURONS.flower, FLEURONS.leaf, FLEURONS.star, FLEURONS.mark, FLEURONS.dot);
  }

  // Roles for structured ornament. Paired tokens (⊸/⟜, ⟦/⟧) make leaves; thin single glyphs make
  // stems; single glyphs make petals and bloom centres; multi-character tokens (⟦-⟧, C-c, :wq) and
  // dots are fillers. `decor` (0..1) blends the classic fleurons into each role.
  const THIN = new Set(["→", "←", "×", "·", "∘", "⊤", "⊥", "−", "~", "∼", "⋅", "∙", "↦", "⇒", "-", "—", "–", "|"]);
  function roles(o, r) {
    const toks = tokens(o), user = !!(o.alphabet && String(o.alphabet).trim());
    const single = toks.filter(t => Array.from(t).length === 1);
    const R = {
      stem: single.filter(t => THIN.has(t)),
      leaf: toks.filter(t => partner(t) !== t && Array.from(t).length === 1),
      bloom: single.filter(t => !THIN.has(t) && partner(t) === t),
      petal: single.filter(t => partner(t) === t),
      filler: toks.filter(t => Array.from(t).length > 1),
    };
    if (!R.stem.length) R.stem = ["·"];
    if (!R.bloom.length) R.bloom = single.length ? single : ["✿"];
    if (!R.petal.length) R.petal = R.bloom;
    if (!R.leaf.length) R.leaf = ["❧"];
    if (!R.filler.length) R.filler = ["·"];
    const d = user ? o.decor : 1;
    const mix = (xs, extra) => d <= 0 ? xs : d >= 1 ? extra : xs.concat(...Array.from({ length: Math.max(1, Math.round(xs.length * d / (1 - d) / extra.length)) }, () => extra));
    R.bloom = mix(R.bloom, FLEURONS.flower);
    R.bud = R.leaf.filter(t => !"❧☙❦❥".includes(t)).concat(R.bloom).slice(0, 12);
    R.leaf = ["❧", "☙", "❦"];                        // leaves read as leaves only when they are fleurons
    R.petal = mix(R.petal, ["❀", "✿", "✦"]);
    R.filler = mix(R.filler, FLEURONS.dot.concat(FLEURONS.star));
    // configured bags (the ornament-bags glyph-art entry) replace the derived ones, role by role
    if (o.bags) for (const k of Object.keys(o.bags)) if (o.bags[k] && o.bags[k].length) R[k] = o.bags[k].slice();
    return R;
  }

  function span(doc, tok, o, r, size, extra) {
    const s = doc.createElement("span");
    s.textContent = tok;
    s.className = "glyph-orn";
    s.style.color = colour(o, tok, r);
    s.style.whiteSpace = "nowrap";
    // Keyboard tokens (C-c, RET, :wq): monospace, a little smaller, like keys in a manual.
    const key = tok.length > 1 && /^[\x21-\x7e]+$/.test(tok) && /[A-Za-z]/.test(tok);
    if (key) { s.style.fontFamily = 'var(--helia-font-mono, "JetBrains Mono", ui-monospace, monospace)'; size = (size || 1) * 0.62; s.style.letterSpacing = ".02em"; }
    if (size && size !== 1) s.style.fontSize = size + "em";
    if (extra) Object.assign(s.style, extra);
    return s;
  }

  // ---------------------------------------------------------------- layout helpers
  function column(doc) {
    const el = doc.querySelector(".helia-article, .helia-page > main, main, article, .helia-page") || doc.body;
    const r = el.getBoundingClientRect(), sy = doc.defaultView.scrollY;
    return { left: r.left, right: r.right, top: r.top + sy, bottom: r.bottom + sy };
  }
  function layer(doc, cls, css) {
    const d = doc.createElement("div");
    d.className = "glyph-layer " + cls;
    d.setAttribute("aria-hidden", "true");
    d.style.cssText = "pointer-events:none;font-family:" + FONT + ";line-height:1;" + (css || "");
    return d;
  }
  // Long pages carry thousands of glyphs, so a chunked layer (the margins) files each glyph in a
  // band of CHUNK px with `content-visibility: auto`: the browser skips style, layout, paint and
  // animation for bands off screen. Bands overlap by PAD so glyphs near an edge aren't clipped.
  // Each glyph keeps its page position in `_x`/`_y` for the pointer effects.
  const CHUNK = 1000, PAD = 140, CHUNK_PAD = PAD;   // (CHUNK_PAD: for code where PAD means something else)
  function chunkBand(L, i) {
    L._bands = L._bands || [];
    if (!L._bands[i]) {
      const b = L.ownerDocument.createElement("div");
      b.className = "glyph-band";
      b.style.cssText = "position:absolute;left:0;width:100%;top:" + (i * CHUNK - PAD) + "px;height:" + (CHUNK + 2 * PAD) + "px;" +
        "content-visibility:auto;contain-intrinsic-size:auto " + (CHUNK + 2 * PAD) + "px;pointer-events:none";
      L.appendChild(b);
      L._bands[i] = b;
    }
    return L._bands[i];
  }
  // Ink centring: a glyph's text box is not where its ink is (symbol fonts put the ink well off
  // the box centre, differently per glyph), so rings of petals looked lopsided. Measure the ink
  // with canvas text metrics (cached per glyph, font and size) and centre, and rotate, on it.
  // Line-height is 1, so the baseline sits (size + ascent − descent) / 2 below the box top.
  const INK = new Map();
  let inkCtx = null;
  function ink(doc, text, family, px) {
    const key = text + "|" + family + "|" + px.toFixed(1);
    if (INK.has(key)) return INK.get(key);
    if (!inkCtx) inkCtx = doc.createElement("canvas").getContext("2d");
    inkCtx.font = px.toFixed(2) + "px " + family;
    const m = inkCtx.measureText(text);
    let v = null;
    if (m.actualBoundingBoxAscent != null && m.fontBoundingBoxAscent != null) {
      const baseline = (px + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
      v = { x: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, y: baseline + (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2 };
      if (!(isFinite(v.x) && isFinite(v.y)) || m.width === 0) v = null;
    }
    INK.set(key, v);
    return v;
  }
  function centreOnInk(L, el) {
    if (el.childElementCount || el.style.writingMode) return false;
    const base = parseFloat(L.style.fontSize) || parseFloat(L.ownerDocument.defaultView.getComputedStyle(L).fontSize) || 22;
    const px = base * (parseFloat(el.style.fontSize) || 1);
    const v = ink(L.ownerDocument, el.textContent, el.style.fontFamily || FONT, px);
    if (!v) return false;
    el._bx = -v.x; el._by = -v.y;
    el.style.translate = (-v.x).toFixed(2) + "px " + (-v.y).toFixed(2) + "px";
    el.style.transformOrigin = v.x.toFixed(2) + "px " + v.y.toFixed(2) + "px";
    return true;
  }
  function place(L, el, x, y) {
    el.style.position = "absolute";
    el.style.lineHeight = "1";
    if (!centreOnInk(L, el)) el.style.translate = "-50% -50%";
    el._x = x; el._y = y;
    if (L._chunked) {
      const i = Math.max(0, Math.floor(y / CHUNK));
      el.style.left = x + "px";
      el.style.top = (y - i * CHUNK + PAD) + "px";
      chunkBand(L, i).appendChild(el);
    } else {
      el.style.left = x + "px";
      el.style.top = y + "px";
      L.appendChild(el);
    }
  }

  // Density multiplier by depth: flat for the top of the page, then rising over the last
  // `ramp` fraction toward `peak` — the margins thicken as the sea approaches.
  function depthGain(o, y, H) {
    if (!o.sea || !o.hint) return 1;
    const t = Math.max(0, (y / H - (1 - o.ramp)) / o.ramp);
    return 1 + (o.peak - 1) * t * t;
  }

  // ---------------------------------------------------------------- margins
  // `from` + `into`: extend an existing layer downward from height `from` (the page grew),
  // leaving everything already drawn above it untouched.
  function margins(doc, o, H, from, into, fullH) {
    // (stowaways are added at the end, once the margin's own glyphs have claimed their spots)
    const L = into || layer(doc, "glyph-margins", "position:absolute;left:0;top:0;width:100%;z-index:0");
    L._chunked = true;
    // the bands overhang their glyphs; clip to the page so they never add scroll length
    L.style.height = H + "px"; L.style.overflow = "hidden"; L.style.overflow = "clip";
    if (!into) {
      const snap = doc.querySelector(".glyph-margins[data-folio-snap]");
      if (snap) snap.replaceWith(L); else doc.body.appendChild(L);
    }
    if (from != null) o = Object.assign({}, o, { seed: o.seed + "|from" + Math.round(from) });
    const col = column(doc);
    // Each margin band sits midway between the text column and the page edge (not hugging the
    // text), as wide as the room allows up to 160px.
    const gap = 34, pageW = doc.documentElement.clientWidth;
    const roomL = col.left - gap, roomR = pageW - col.right - gap;
    const band = Math.min(420, Math.min(roomL, roomR) - 12);   // grows with the room (wide screens, zoomed out)
    if (band < 28) { L._none = true; return L; }   // no room for margins
    L._none = false;
    const base = 22 * o.size;
    L.style.fontSize = base + "px";
    const toks = tokens(o);
    const sides = [{ x: roomL / 2, dir: -1, key: "L", edge: col.left - 14 }, { x: col.right + gap + roomR / 2, dir: 1, key: "R", edge: col.right + 14 }];
    const y0 = from != null ? Math.max(col.top + 10, from) : col.top + 10, y1 = H - 20, yEnd = (fullH || H) - 20;
    // With a gasket layout the required placements (o.place) are laid out first, horizontally, and
    // the margins are packed around them; stowaways() then puts them where they were reserved.
    // (an extension keeps the first call's reservations, which span the whole page)
    if (from == null) { L._reserve = null; o._reserve = null; } else o._reserve = L._reserve;
    if (o.margins === "compose" && o.composeLayout !== "pack" && o.place && o.place.length && from == null && o.stowaways !== false) {
      const rr = rng(o.visit + "|stow"), res = [];
      o.place.forEach((make, idx) => {
        let d = make(rr); if (!d || !d.items.length) return;
        if (d.items.some(it => it.vertical)) d = Object.assign({}, d, { w: d.h, h: d.w, items: d.items.map(it => Object.assign({}, it, { vertical: false, x: it.y, y: it.x })) });
        // the real inked width of text (estimates run short for wide scripts), measured on a canvas
        const cv = doc.createElement("canvas").getContext("2d");
        let tw = 0; for (const it of d.items) if (!it.seg && it.tok) { cv.font = ((it.s || 1) * base * (it.code ? 0.82 : 1)) + "px " + (it.math ? '"Helia Math", serif' : it.code ? '"JetBrains Mono", monospace' : FONT); tw = Math.max(tw, cv.measureText(it.tok).width + Math.abs(it.x || 0) * base * 2); }
        const w = Math.max(d.w * base, tw) + 6, h = Math.max(d.h, 0.6) * base + 4;
        for (let t = 0; t < 60; t++) {
          const side = sides[(idx + (t % 2)) % 2];
          const lo = side.x - band / 2 + w / 2, hi = side.x + band / 2 - w / 2; if (hi < lo) continue;
          const x = lo + rr() * (hi - lo), y = y0 + 160 + rr() * Math.max(1, yEnd - y0 - 320);
          if (res.every(q => Math.abs(q.y - y) > (q.h + h) / 2 + 60 || q.side !== side.key)) { res.push({ idx, d, side: side.key, x, y, w, h }); break; }
        }
      });
      L._reserve = res; o._reserve = res;
    }

    for (const side of sides) {
      const r = rng(o.seed + "|" + side.key);
      if (["vine", "rosettes", "lattice", "interlace", "tiles", "sampler", "frieze", "tree", "lace", "constellation", "compose", "hats", "aperiodic"].includes(o.margins)) {
        structured(L, doc, o, side, y0, y1, H, band, base);
      } else if (o.margins === "chain" || o.margins === "border") {
        // A seeded motif "word" repeated down the margin with substitutions, so the
        // rhythm is regular but the sequence never repeats; paired tokens alternate
        // with their mirror (⊸ ⟜ ⊸ …) like leaves turning along a vine.
        const x = o.margins === "border" ? side.x + side.dir * (band / 2 - base * 0.8) : side.x;
        if (o.margins === "border") {
          for (const [off, op] of [[0.95, 0.55], [1.2, 0.3]]) {
            const rule = doc.createElement("div");
            rule.style.cssText = "position:absolute;width:1px;background:" + RULE(o) + ";opacity:" + op;
            rule.style.left = (x + side.dir * base * off) + "px"; rule.style.top = y0 + "px"; rule.style.height = (y1 - y0) + "px";
            L.appendChild(rule);
          }
        }
        const word = [pick(r, toks), pick(r, toks), pick(r, toks), pick(r, toks)];
        let i = 0, turn = 0, y = y0;
        while (y < y1) {
          if (i % word.length === 0 && r() < 0.35) word[Math.floor(r() * word.length)] = pick(r, toks);
          let tok = word[i % word.length];
          turn ^= 1;
          if (turn && partner(tok) !== tok) tok = partner(tok);
          const size = 0.85 + 0.45 * r();
          place(L, span(doc, tok, o, r, size), x + (o.margins === "chain" ? (r() - 0.5) * base * 0.35 : 0), y);
          // near the bottom, extra glyphs crowd in beside the chain
          const g = depthGain(o, y, H);
          for (let k = 1; k < g; k++) {
            if (r() < g - k) place(L, span(doc, pick(r, toks), o, r, 0.7 + 0.6 * r()), side.x + (r() - 0.5) * band, y + (r() - 0.5) * base);
          }
          y += base * 1.4 / Math.max(0.4, o.density);
          i++;
        }
      } else if (o.margins === "scatter") {
        const pts = [];
        const step = base * 1.2;
        for (let y = y0; y < y1; y += step) {
          const want = (band * step) / (base * base * 3.4) * o.density * depthGain(o, y, H);
          for (let k = 0; k < want * 5 && k < 60; k++) {
            if (r() > want / (want * 5)) continue;
            const x = side.x + (r() - 0.5) * band, yy = y + r() * step, size = 0.7 + 0.8 * r(), rad = base * size * 0.55;
            if (pts.some(p => (p.x - x) ** 2 + (p.y - yy) ** 2 < (p.r + rad) ** 2)) continue;
            pts.push({ x, y: yy, r: rad });
            place(L, span(doc, pick(r, toks), o, r, size), x, yy);
          }
          while (pts.length && pts[0].y < y - step * 3) pts.shift();
        }
      }
    }
    L._geom = { band, base, sides, y0: L._geom ? L._geom.y0 : y0, y1 };
    return L;
  }

  // Stowaways, placed by the time-seeded rng so they move between visits: two cats (ᓚᘏᗢ, one
  // orange, one grey) curled in free spots of the margin, and the author's
  // name in Phoenician, set sideways along the margin like a scribe's note.
  const CAT = "ᓚᘏᗢ", NAME = "𐤎𐤕𐤅𐤍 𐤔𐤐𐤓";
  const CAT_COLOURS = ["#d98a3d", "#c46f24", "#7f7a74", "#969089"];
  function stowaways(doc, o, L, need) {
    if (o.stowaways === false) return;
    need = need || { o: true, g: true, name: true };
    const r = rng(o.visit + "|stow");                   // fixed for this visit, so rebuilds don't reshuffle
    const g = L && L._geom, pageW = doc.documentElement.clientWidth;
    const taken = [], els = [];
    if (g) for (const e of L.querySelectorAll(".glyph-orn")) if (e._y != null) { taken.push([e._x, e._y]); els.push(e); }
    const free = (x, y, rx, ry) => !taken.some(([tx, ty]) => Math.abs(tx - x) < rx && Math.abs(ty - y) < ry);
    // in the aperiodic tiling a stowaway takes the place of one tile, scaled to fit it: node(w, h) clears a tile
    // (away from the top and foot) and gives its centre and the scale that fits a w × h box into it
    const tiles = o.margins === "aperiodic" && L && L._hatD && g ? Array.prototype.filter.call(L.querySelectorAll('.glyph-orn[data-hat="1"]'), e => e._y > g.y0 + 200 && e._y < g.y1 - 200) : null;
    const node = (w, h) => {
      if (!tiles || !tiles.length) return null;
      const i = Math.floor(r() * tiles.length), e = tiles.splice(i, 1)[0]; e.remove();
      return [e._x, e._y, Math.min(1, L._hatD / Math.max(w, h))];
    };
    const fit = (el, at) => { if (at && at[2] != null && at[2] < 1) el.style.scale = at[2].toFixed(3); };
    // a free spot in a margin, with the whole (w × h) box inside the band and the page
    const spot = (w, h) => {
      if (!g) return null;
      for (let k = 0; k < 120; k++) {
        const side = g.sides[Math.floor(r() * g.sides.length)];
        const lo = Math.max(side.x - g.band / 2 + w / 2, w / 2 + 6), hi = Math.min(side.x + g.band / 2 - w / 2, pageW - w / 2 - 6);
        if (hi < lo) continue;
        const x = lo + r() * (hi - lo), y = g.y0 + 200 + r() * Math.max(1, g.y1 - g.y0 - 400);
        if (free(x, y, w * 0.75, h)) { taken.push([x, y]); return [x, y]; }
      }
      // a full margin: of many spots, take the one crossing the fewest ornament glyphs, and clear
      // those few to make room (only if it's a handful; else the caller perches it on the foot rule)
      let best = null;
      for (let k = 0; k < 160; k++) {
        const side = g.sides[Math.floor(r() * g.sides.length)];
        const lo = Math.max(side.x - g.band / 2 + w / 2, w / 2 + 6), hi = Math.min(side.x + g.band / 2 - w / 2, pageW - w / 2 - 6);
        if (hi < lo) continue;
        const x = lo + r() * (hi - lo), y = g.y0 + 200 + r() * Math.max(1, g.y1 - g.y0 - 400);
        const hit = [];
        const pad = o.margins === "aperiodic" ? base * 0.7 : 8;   // (a clean border of paper round the piece)
        for (let i = 0; i < taken.length; i++) if (Math.abs(taken[i][0] - x) < w / 2 + pad && Math.abs(taken[i][1] - y) < h / 2 + pad) hit.push(i);
        if (!best || hit.length < best.hit.length) best = { x, y, hit };
      }
      // (the aperiodic tiling fills its margins edge to edge: there a hole is always cut, however many tiles it takes)
      if (best && best.hit.length <= (o.margins === "aperiodic" ? 400 : 8)) {
        for (const i of best.hit) { if (els[i]) { els[i].remove(); els[i] = null; } taken[i] = [-1e9, -1e9]; }
        taken.push([best.x, best.y]); return [best.x, best.y];
      }
      return null;
    };
    // where there's no room in the margins, the cats perch on the foot rule (left and right of it)
    const host = doc.querySelector(".glyph-tailpiece");
    let perched = 0;
    // no room in the margins (phones): they gather in a row beneath the foot rule, spaced apart and
    // wrapping onto a second line when there are many, so none ever overlaps another
    const perch = e => {
      if (!host) return false;
      let row = host.querySelector(".glyph-perch-row");
      if (!row) { row = doc.createElement("div"); row.className = "glyph-perch-row"; host.appendChild(row); }
      e.style.position = "relative"; e.style.left = ""; e.style.bottom = ""; e.style.translate = "";
      row.appendChild(e);
      perched++;
      return true;
    };
    const base = g ? g.base : 22 * o.size;
    // Guaranteed placements from the ornament grammar: each structure placed once, as one group,
    // in a free spot of a margin, else perched on the foot rule.
    if (o.place) {
      o.place.forEach((make, idx) => {
        if (need.any && !need[idx]) return;
        const rv = L && L._reserve && L._reserve.find(q => q.idx === idx);
        let d = rv ? rv.d : make(r); if (!d || !d.items.length) return;
        let wpx = Math.max(d.w, 0.6) * base, hpx = Math.max(d.h, 0.6) * base;
        // no room in the margins: it perches on the foot rule, and anything written vertically
        // lies down there, reading sideways along the rule
        const at = rv ? [rv.x, rv.y] : node(wpx, hpx) || spot(wpx, hpx);
        if (!at && d.items.some(it => it.vertical)) {
          d = Object.assign({}, d, { w: d.h, h: d.w, items: d.items.map(it => Object.assign({}, it, { vertical: false, x: it.y, y: it.x })) });
          wpx = Math.max(d.w, 0.6) * base; hpx = Math.max(d.h, 0.6) * base;
        }
        const grp = doc.createElement("span");
        grp.className = "glyph-orn glyph-stow"; grp.dataset.stow = idx;
        grp.style.cssText = "display:inline-block;width:" + wpx.toFixed(1) + "px;height:" + hpx.toFixed(1) + "px;font-size:" + base + "px";
        for (const it of d.items) {
          const e = doc.createElement("span");
          if (it.seg) {
            e.style.cssText = "position:absolute;height:0;border-top:1px dotted " + (it.col || RULE(o)) + ";opacity:.55;transform-origin:0 0;left:" + (wpx / 2 + it.x * base).toFixed(1) + "px;top:" + (hpx / 2 + it.y * base).toFixed(1) + "px;width:" + (Math.hypot(it.dx, it.dy) * base).toFixed(1) + "px;rotate:" + (Math.atan2(it.dy, it.dx) * 180 / Math.PI).toFixed(1) + "deg";
            grp.appendChild(e); continue;
          }
          e.textContent = it.tok;
          e.style.cssText = "position:absolute;line-height:1;white-space:nowrap;translate:-50% -50%;left:" + (wpx / 2 + it.x * base).toFixed(1) + "px;top:" + (hpx / 2 + it.y * base).toFixed(1) + "px;font-size:" + (it.s || 1) + "em;font-family:" + FONT;
          e.style.color = it.col || colour(o, it.tok, r);
          if (it.rot) e.style.rotate = it.rot.toFixed(1) + "deg";
          if (it.vertical) e.style.writingMode = "vertical-rl";
          if (it.bold) e.style.fontWeight = "700";
          if (it.math) e.style.fontFamily = '"Helia Math", "New Computer Modern Math", "STIX Two Math", "Cambria Math", serif';
          if (it.code) { e.style.fontFamily = "var(--helia-font-mono, monospace)"; e.style.fontSize = ((it.s || 1) * 0.82) + "em"; }
          if (it.moon) e.dataset.moon = "1";
          if (it.reflect) e.style.transform = "scaleX(-1)";
          grp.appendChild(e);
        }
        grp.style.position = "relative";
        if (at) { place(L, grp, at[0], at[1]); fit(grp, at); } else perch(grp);
      });
      return;
    }
    // cats: always one orange and one grey
    for (const [kind, cols] of [["o", CAT_COLOURS.slice(0, 2)], ["g", CAT_COLOURS.slice(2)]]) {
      const colour = pick(r, cols);
      if (!need[kind]) continue;
      const e = span(doc, CAT, o, r, 1.35, { color: colour, letterSpacing: "-.04em", fontWeight: "700", fontFamily: "\"Noto Sans Canadian Aboriginal\", \"Euphemia UCAS\", sans-serif" });
      e.classList.add("glyph-cat"); e.dataset.cat = kind;
      if (r() < 0.5) {                                  // facing the other way (it's a drawing, not letters);
        const inner = doc.createElement("span");        // flipped inside, so sway/magnify keep the outer transform
        inner.textContent = CAT; inner.style.cssText = "display:inline-block;transform:scaleX(-1)";
        e.textContent = ""; e.appendChild(inner);
      }
      const at = node(base * 1.35 * 2.6, base * 1.1) || spot(base * 1.35 * 2.6, base * 1.1);
      if (at) { place(L, e, at[0], at[1]); fit(e, at); } else perch(e);
    }
    // the name, once per page: sideways in a margin, or else as a signature under the foot rule
    if (!need.name) return;
    const e = span(doc, NAME, o, r, 0.85, { color: "var(--accent, #a52a1f)", opacity: "0.85" });
    e.classList.add("glyph-name");
    e.title = "Steven Schaefer, in Phoenician";
    const at = node(base * 1.2, base * 4.2) || spot(base * 1.2, base * 4.2);
    if (at) { e.style.writingMode = "vertical-rl"; place(L, e, at[0], at[1]); fit(e, at); }
    else {
      const foot = doc.querySelector(".glyph-tailpiece");
      if (foot) { e.style.display = "block"; e.style.textAlign = "center"; e.style.marginTop = ".5em"; e.style.fontSize = ".6em"; foot.appendChild(e); }
    }
  }


  // A rosette: a centre glyph ringed by petals turned outward, optionally a second ring of dots.
  function rosette(L, doc, o, r, R, cx, cy, radius, occ) {
    // Contents (which glyphs, how many petals, spin) come from a per-visit random stream when
    // `live` is on, so the blooms change each time while the vine's shape stays put.
    const q = o.live ? o.liveRng : r;
    const centre = pick(q, R.bloom), petal = pick(q, R.petal), n = 5 + Math.floor(q() * 4);
    const spin = q() * 360;
    // No clipping: petals sit far enough out to clear the centre glyph, and the ring's
    // circumference fits n petal widths.
    const base = parseFloat(L.style.fontSize) || 22, petalW = base * 0.95 * 0.95, centreR = base * 1.35 * 0.55;
    radius = Math.max(radius, centreR + petalW * 0.62, (n * petalW * 1.08) / (2 * Math.PI));
    place(L, span(doc, centre, o, r, 1.35), cx, cy);
    for (let k = 0; k < n; k++) {
      const a = (spin + (360 * k) / n) * Math.PI / 180;
      const e = span(doc, petal, o, r, 0.95);
      e.style.rotate = ((spin + (360 * k) / n) + 90) + "deg";
      place(L, e, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    }
    if (r() < 0.6) {
      const m = n * 2, dot = pick(r, R.filler.filter(t => Array.from(t).length === 1).concat(["·"]));
      for (let k = 0; k < m; k++) {
        const a = (spin + (360 * (k + 0.5)) / m) * Math.PI / 180;
        place(L, span(doc, dot, o, r, 0.55), cx + Math.cos(a) * radius * 1.65, cy + Math.sin(a) * radius * 1.65);
      }
    }
    occ && occ.push({ x: cx, y: cy, r: radius * 1.8 + base * 0.3 });
  }


  // Decorative motifs beyond the rosette. Each draws around (cx, cy); `dir` is the direction
  // the branch was growing (radians), so fans and crescents open the right way.
  function motif(L, doc, o, r, R, cx, cy, radius, occ, dir) {
    const q = o.live ? o.liveRng : r, base = parseFloat(L.style.fontSize) || 22;
    const kinds = ["rosette", "rosette", "palmette", "star", "star", "cluster", "quatrefoil", "wreathlet", "crescent"];   // (no spirals)
    const kind = pick(q, kinds);
    const put = (tok, x, y, size, rot) => { const e = span(doc, tok, o, q, size); if (rot != null) e.style.rotate = rot + "deg"; place(L, e, x, y); };
    const deg = a => a * 180 / Math.PI;
    dir = dir == null ? -Math.PI / 2 : dir;
    const glyph = () => pick(q, R.petal), small = () => pick(q, R.filler.filter(t => Array.from(t).length === 1).concat(["·"]));
    let extent = radius;
    if (kind === "rosette") { rosette(L, doc, o, r, R, cx, cy, radius, occ); return; }
    if (kind === "palmette") {                      // a fan opening along dir
      const n = 5 + Math.floor(q() * 3), g = glyph(), R0 = Math.max(radius, base * 0.9);
      put(pick(q, R.bloom), cx, cy, 1.15);
      for (let k = 0; k < n; k++) {
        const a = dir - 1.2 + (2.4 * k) / (n - 1), rr = R0 * (1 + 0.25 * Math.sin(Math.PI * k / (n - 1)));
        put(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.85, deg(a) + 90);
      }
      extent = R0 * 1.3;
    } else if (kind === "star") {                   // alternating outer and inner points
      const n = 5 + Math.floor(q() * 3), gi = glyph(), go = pick(q, R.bloom), R0 = Math.max(radius * 1.15, base * 1.1), spin = q() * 6.283;
      put(small(), cx, cy, 0.8);
      for (let k = 0; k < 2 * n; k++) {
        const a = spin + (Math.PI * k) / n, out = k % 2 === 0, rr = out ? R0 : R0 * 0.52;
        put(out ? go : gi, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, out ? 0.9 : 0.6, out ? deg(a) + 90 : null);
      }
      extent = R0 * 1.15;
    } else if (kind === "spiral") {                 // glyphs shrinking along a curl
      const g = glyph(), turn = q() < 0.5 ? 1 : -1; let a = dir, rr = radius * 1.4, sz = 1.05;
      for (let k = 0; k < 11; k++) { put(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, sz, deg(a) + 90); a += turn * 0.62; rr *= 0.84; sz *= 0.9; }
      put(pick(q, R.bloom), cx, cy, 0.6);
      extent = radius * 1.5;
    } else if (kind === "cluster") {                // a hanging bunch (1, 2, 3, 4 rows), pointing along dir
      const g = pick(q, R.bloom.concat(R.petal)), step = base * 0.62;
      const ux = Math.cos(dir), uy = Math.sin(dir), vx = -uy, vy = ux;
      for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) {
        const along = (3 - row) * step * 0.9, across = (k - row / 2) * step;
        put(g, cx + ux * along + vx * across, cy + uy * along + vy * across, 0.72 - row * 0.03);
      }
      extent = step * 3;
    } else if (kind === "quatrefoil") {             // four petals, four diagonal accents, a centre
      const g = glyph(), d = pick(q, R.bloom), R0 = Math.max(radius, base * 0.95), spin = q() < 0.5 ? 0 : Math.PI / 4;
      put(d, cx, cy, 1.05);
      for (let k = 0; k < 4; k++) {
        const a = spin + (Math.PI * k) / 2, b = a + Math.PI / 4;
        put(g, cx + Math.cos(a) * R0, cy + Math.sin(a) * R0, 1, deg(a) + 90);
        put(small(), cx + Math.cos(b) * R0 * 0.85, cy + Math.sin(b) * R0 * 0.85, 0.6);
      }
      extent = R0 * 1.2;
    } else if (kind === "wreathlet") {              // a ring of small glyphs around one glyph
      const n = 10 + Math.floor(q() * 5), g = small(), R0 = Math.max(radius, base * 0.95);
      put(pick(q, R.bloom), cx, cy, 1.1);
      for (let k = 0; k < n; k++) { const a = (6.283 * k) / n; put(k % 3 ? g : glyph(), cx + Math.cos(a) * R0, cy + Math.sin(a) * R0, k % 3 ? 0.55 : 0.75, deg(a) + 90); }
      extent = R0 * 1.15;
    } else {                                        // crescent: an arc opening along dir
      const n = 7, g = glyph(), R0 = Math.max(radius, base * 1.0);
      for (let k = 0; k < n; k++) {
        const a = dir + Math.PI - 1.4 + (2.8 * k) / (n - 1), sz = 0.6 + 0.4 * Math.sin(Math.PI * k / (n - 1));
        put(g, cx + Math.cos(a) * R0, cy + Math.sin(a) * R0, sz, deg(a) + 90);
      }
      put(small(), cx + Math.cos(dir) * R0 * 0.2, cy + Math.sin(dir) * R0 * 0.2, 0.7);
      extent = R0 * 1.1;
    }
    occ && occ.push({ x: cx, y: cy, r: extent + base * 0.3 });
  }


  // The hat: the aperiodic monotile of Smith, Myers, Kaplan and Goodman-Strauss (2023). A patch is
  // grown by their metatile substitution (after Kaplan's hatviz): H, T, P, F metatiles made of hats,
  // assembled into a bigger patch, from which bigger metatiles are cut, and so on. Flattened once
  // to a list of hats: {pts: [[x, y], ...], c: [x, y], label} (label H1 is the mirrored hat).
  let HATS = null, HAT_AREA = 1;
  function hatPatch(levels) {
    const hr3 = Math.sqrt(3) / 2, PI = Math.PI;
    const pt = (x, y) => ({ x, y }), hexPt = (x, y) => pt(x + 0.5 * y, hr3 * y);
    const add = (p, q) => pt(p.x + q.x, p.y + q.y), sub = (p, q) => pt(p.x - q.x, p.y - q.y);
    const mul = (A, B) => [A[0] * B[0] + A[1] * B[3], A[0] * B[1] + A[1] * B[4], A[0] * B[2] + A[1] * B[5] + A[2],
      A[3] * B[0] + A[4] * B[3], A[3] * B[1] + A[4] * B[4], A[3] * B[2] + A[4] * B[5] + A[5]];
    const inv = T => { const d = T[0] * T[4] - T[1] * T[3]; return [T[4] / d, -T[1] / d, (T[1] * T[5] - T[2] * T[4]) / d, -T[3] / d, T[0] / d, (T[2] * T[3] - T[0] * T[5]) / d]; };
    const ident = [1, 0, 0, 0, 1, 0], ttrans = (x, y) => [1, 0, x, 0, 1, y];
    const rot = a => { const c = Math.cos(a), si = Math.sin(a); return [c, -si, 0, si, c, 0]; };
    const rotAbout = (p, a) => mul(ttrans(p.x, p.y), mul(rot(a), ttrans(-p.x, -p.y)));
    const tp = (M, P) => pt(M[0] * P.x + M[1] * P.y + M[2], M[3] * P.x + M[4] * P.y + M[5]);
    const matchSeg = (p, q) => [q.x - p.x, p.y - q.y, p.x, q.y - p.y, q.x - p.x, p.y];
    const matchTwo = (p1, q1, p2, q2) => mul(matchSeg(p2, q2), inv(matchSeg(p1, q1)));
    const intersect = (p1, q1, p2, q2) => {
      const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y);
      const uA = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d;
      return pt(p1.x + uA * (q1.x - p1.x), p1.y + uA * (q1.y - p1.y));
    };
    const hat = [hexPt(0, 0), hexPt(-1, -1), hexPt(0, -2), hexPt(2, -2), hexPt(2, -1), hexPt(4, -2), hexPt(5, -1), hexPt(4, 0),
      hexPt(3, 0), hexPt(2, 2), hexPt(0, 3), hexPt(0, 2), hexPt(-1, 2)];
    const Hat = label => ({ label, hat: true });
    const Meta = (shape, width) => ({ shape, width, children: [] });
    const addChild = (m, T, geom) => m.children.push({ T, geom });
    const evalChild = (m, n, i) => tp(m.children[n].T, m.children[n].geom.shape[i]);
    const recentre = m => {
      let cx = 0, cy = 0; for (const p of m.shape) { cx += p.x; cy += p.y; } cx /= m.shape.length; cy /= m.shape.length;
      const tr = pt(-cx, -cy); m.shape = m.shape.map(p => add(p, tr));
      const M = ttrans(-cx, -cy); for (const ch of m.children) ch.T = mul(M, ch.T);
    };
    const H_hat = Hat("H"), H1_hat = Hat("H1"), T_hat = Hat("T"), P_hat = Hat("P"), F_hat = Hat("F");
    const Ho = [pt(0, 0), pt(4, 0), pt(4.5, hr3), pt(2.5, 5 * hr3), pt(1.5, 5 * hr3), pt(-0.5, hr3)], H = Meta(Ho, 2);
    addChild(H, matchTwo(hat[5], hat[7], Ho[5], Ho[0]), H_hat);
    addChild(H, matchTwo(hat[9], hat[11], Ho[1], Ho[2]), H_hat);
    addChild(H, matchTwo(hat[5], hat[7], Ho[3], Ho[4]), H_hat);
    addChild(H, mul(ttrans(2.5, hr3), mul([-0.5, -hr3, 0, hr3, -0.5, 0], [0.5, 0, 0, 0, -0.5, 0])), H1_hat);
    const T = Meta([pt(0, 0), pt(3, 0), pt(1.5, 3 * hr3)], 2);
    addChild(T, [0.5, 0, 0.5, 0, 0.5, hr3], T_hat);
    const P = Meta([pt(0, 0), pt(4, 0), pt(3, 2 * hr3), pt(-1, 2 * hr3)], 2);
    addChild(P, [0.5, 0, 1.5, 0, 0.5, hr3], P_hat);
    addChild(P, mul(ttrans(0, 2 * hr3), mul([0.5, hr3, 0, -hr3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), P_hat);
    const F = Meta([pt(0, 0), pt(3, 0), pt(3.5, hr3), pt(3, 2 * hr3), pt(-1, 2 * hr3)], 2);
    addChild(F, [0.5, 0, 1.5, 0, 0.5, hr3], F_hat);
    addChild(F, mul(ttrans(0, 2 * hr3), mul([0.5, hr3, 0, -hr3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), F_hat);
    const rules = [["H"], [0, 0, "P", 2], [1, 0, "H", 2], [2, 0, "P", 2], [3, 0, "H", 2], [4, 4, "P", 2], [0, 4, "F", 3], [2, 4, "F", 3],
      [4, 1, 3, 2, "F", 0], [8, 3, "H", 0], [9, 2, "P", 0], [10, 2, "H", 0], [11, 4, "P", 2], [12, 0, "H", 2], [13, 0, "F", 3], [14, 2, "F", 1],
      [15, 3, "H", 4], [8, 2, "F", 1], [17, 3, "H", 0], [18, 2, "P", 0], [19, 2, "H", 2], [20, 4, "F", 3], [20, 0, "P", 2], [22, 0, "H", 2],
      [23, 4, "F", 3], [23, 0, "F", 3], [16, 0, "P", 2], [9, 4, 0, 2, "T", 2], [4, 0, "F", 3]];
    const patch = (H, T, P, F) => {
      const ret = Meta([], H.width), shapes = { H, T, P, F };
      for (const r of rules) {
        if (r.length === 1) { addChild(ret, ident, shapes[r[0]]); continue; }
        let Pp, Qq, n;
        if (r.length === 4) {
          const ch = ret.children[r[0]], poly = ch.geom.shape;
          Pp = tp(ch.T, poly[(r[1] + 1) % poly.length]); Qq = tp(ch.T, poly[r[1]]); n = shapes[r[2]];
          addChild(ret, matchTwo(n.shape[r[3]], n.shape[(r[3] + 1) % n.shape.length], Pp, Qq), n);
        } else {
          const cP = ret.children[r[0]], cQ = ret.children[r[2]];
          Pp = tp(cQ.T, cQ.geom.shape[r[3]]); Qq = tp(cP.T, cP.geom.shape[r[1]]); n = shapes[r[4]];
          addChild(ret, matchTwo(n.shape[r[5]], n.shape[(r[5] + 1) % n.shape.length], Pp, Qq), n);
        }
      }
      return ret;
    };
    const metatiles = pa => {
      const bps1 = evalChild(pa, 8, 2), bps2 = evalChild(pa, 21, 2), rbps = tp(rotAbout(bps1, -2 * PI / 3), bps2);
      const p72 = evalChild(pa, 7, 2), p252 = evalChild(pa, 25, 2);
      const llc = intersect(bps1, rbps, evalChild(pa, 6, 2), p72);
      let w = sub(evalChild(pa, 6, 2), llc);
      const Hs = [llc, bps1]; w = tp(rot(-PI / 3), w); Hs.push(add(Hs[1], w)); Hs.push(evalChild(pa, 14, 2));
      w = tp(rot(-PI / 3), w); Hs.push(sub(Hs[3], w)); Hs.push(evalChild(pa, 6, 2));
      const nH = Meta(Hs, pa.width * 2); for (const c of [0, 9, 16, 27, 26, 6, 1, 8, 10, 15]) addChild(nH, pa.children[c].T, pa.children[c].geom);
      const nP = Meta([p72, add(p72, sub(bps1, llc)), bps1, llc], pa.width * 2); for (const c of [7, 2, 3, 4, 28]) addChild(nP, pa.children[c].T, pa.children[c].geom);
      const nF = Meta([bps2, evalChild(pa, 24, 2), evalChild(pa, 25, 0), p252, add(p252, sub(llc, bps1))], pa.width * 2);
      for (const c of [21, 20, 22, 23, 24, 25]) addChild(nF, pa.children[c].T, pa.children[c].geom);
      const A = Hs[2], B = add(Hs[1], sub(Hs[4], Hs[5])), Cc = tp(rotAbout(B, -PI / 3), A);
      const nT = Meta([B, Cc, A], pa.width * 2); addChild(nT, pa.children[11].T, pa.children[11].geom);
      [nH, nP, nF, nT].forEach(recentre);
      return [nH, nT, nP, nF];
    };
    let tiles = [H, T, P, F];
    for (let i = 0; i < levels; i++) tiles = metatiles(patch(...tiles));
    // local bounding boxes, bottom-up (memoised on the shared geometry), so a query only walks the
    // supertiles that meet its rectangle
    const bb = g => {
      if (g._bb) return g._bb;
      const ps = [];
      if (g.hat) ps.push(...hat);
      else for (const ch of g.children) { const b = bb(ch.geom); for (const q of [pt(b[0], b[1]), pt(b[2], b[1]), pt(b[0], b[3]), pt(b[2], b[3])]) ps.push(tp(ch.T, q)); }
      return (g._bb = [Math.min(...ps.map(p => p.x)), Math.min(...ps.map(p => p.y)), Math.max(...ps.map(p => p.x)), Math.max(...ps.map(p => p.y))]);
    };
    const root = tiles[0], rb = bb(root);
    return {
      box: rb,
      query(x0, y0, x1, y1) {
        const out = [];
        const walk = (g, M) => {
          const b = bb(g), cs = [tp(M, pt(b[0], b[1])), tp(M, pt(b[2], b[1])), tp(M, pt(b[0], b[3])), tp(M, pt(b[2], b[3]))];
          if (Math.max(...cs.map(p => p.x)) < x0 || Math.min(...cs.map(p => p.x)) > x1 || Math.max(...cs.map(p => p.y)) < y0 || Math.min(...cs.map(p => p.y)) > y1) return;
          if (g.hat) { const pts = hat.map(p => tp(M, p)); let cx = 0, cy = 0; for (const p of pts) { cx += p.x; cy += p.y; }
            out.push({ pts: pts.map(p => [p.x, p.y]), c: [cx / pts.length, cy / pts.length], label: g.label }); return; }
          for (const ch of g.children) walk(ch.geom, mul(M, ch.T));
        };
        walk(root, ident);
        return out;
      },
    };
  }

  function motifKind(L, doc, o, r, R, cx, cy, radius, kind) {
    const saved = Math.random; let first = true;
    // pick() inside motif() takes the kind from its rng; wrap the rng so the first draw selects `kind`
    const kinds = ["rosette", "rosette", "palmette", "star", "star", "cluster", "quatrefoil", "wreathlet", "crescent"];   // (no spirals)
    const idx = kinds.indexOf(kind), forced = () => { if (first) { first = false; return (idx + 0.5) / kinds.length; } return r(); };
    const o2 = Object.assign({}, o, { live: false });
    motif(L, doc, o2, forced, R, cx, cy, radius, null, Math.PI / 2);
  }

  // A smooth, never-repeating curve down a margin: a sum of three sines with seeded periods and phases.
  function curve(r, cx, amp) {
    const ps = [1, 0.47, 0.23].map(w => ({ w, P: 380 + r() * 520, ph: r() * 6.283 }));
    const f = y => cx + amp * ps.reduce((acc, p) => acc + p.w * Math.sin((6.283 * y) / p.P * (0.6 + p.w) + p.ph), 0) / 1.7;
    return { x: f, dx: y => (f(y + 1) - f(y - 1)) / 2 };
  }

  function structured(L, doc, o, side, y0, y1, H, band, base) {
    const r = rng(o.seed + "|" + o.margins + "|" + side.key), R = roles(o, r), occ = [];
    const free = (x, y, rad) => !occ.some(p => Math.abs(p.y - y) < 120 && (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + rad) ** 2);
    if (o.margins === "vine") {
      // A grown vine: the stem is a tapering SVG line from a steered random walk; side branches
      // split off and curl ever tighter, ending in a rosette or a spiral tendril; glyph leaves grow
      // along stems and branches at the growth angle, alternating sides; fillers take the gaps.
      const NS = "http://www.w3.org/2000/svg";
      const svg = doc.createElementNS(NS, "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
      svg.setAttribute("width", "1"); svg.setAttribute("height", "1");
      L.appendChild(svg);
      const stroke = RULE(o);
      const path = (pts, w0, w1) => {                 // tapering stroke: a few segments of decreasing width
        const n = 4, per = Math.ceil(pts.length / n);
        for (let k = 0; k < n; k++) {
          const seg = pts.slice(k * per, (k + 1) * per + 1);
          if (seg.length < 2) continue;
          const e = doc.createElementNS(NS, "path");
          e.setAttribute("d", "M" + seg.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L"));
          e.setAttribute("fill", "none"); e.setAttribute("stroke", stroke);
          e.setAttribute("stroke-width", (w0 + (w1 - w0) * k / (n - 1)).toFixed(2));
          e.setAttribute("stroke-linecap", "round"); e.setAttribute("stroke-linejoin", "round");
          svg.appendChild(e);
        }
      };
      const inBand = (x, rad) => x - rad >= side.x - band / 2 && x + rad <= side.x + band / 2;
      const leafAt = (x, y, heading, sgn, scale) => {
        const bud = r() < 0.2;                          // now and then a math bud instead of a leaf
        let tok = bud ? pick(r, R.bud) : pick(r, R.leaf); if (sgn < 0 && partner(tok) !== tok) tok = partner(tok);
        const a = heading + sgn * (0.55 + r() * 0.35), d = base * (0.42 + 0.18 * scale);
        const lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d, rad = base * 0.38 * scale;
        if (!inBand(lx, rad) || !free(lx, ly, rad)) return;
        occ.push({ x: lx, y: ly, r: rad });
        const e = span(doc, tok, o, r, 0.7 + 0.35 * scale);
        if (!bud) e.style.rotate = (a * 180 / Math.PI + (sgn > 0 ? -90 : 90)) + "deg";
        place(L, e, lx, ly);
      };
      // a single blossom on a short pedicel off a stem
      const blossomAt = (x, y, heading, sgn, scale) => {
        const a = heading + sgn * (0.8 + r() * 0.5), d = base * (0.55 + 0.15 * scale);
        const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d, rad = base * 0.45 * scale;
        if (!inBand(fx, rad) || !free(fx, fy, rad)) return false;
        path([[x, y], [x + Math.cos(a) * d * 0.55, y + Math.sin(a) * d * 0.55]], 0.8, 0.6);
        occ.push({ x: fx, y: fy, r: rad });
        place(L, span(doc, pick(r, R.bloom), o, r, 0.75 + 0.3 * scale), fx, fy);
        return true;
      };
      // a branch: starts at (x,y) with heading h, curling with increasing curvature; it forks into
      // smaller branches curling the other way, and carries leaves and blossoms along its length
      const branch = (x, y, h, turn, len, depth) => {
        const pts = [[x, y]]; let k = 0.05 + r() * 0.05, since = 0, fork = 2 + r() * 3;
        for (let i = 0; i < len; i++) {
          const out = (x - side.x) / (band / 2);         // -1 .. 1 across the band
          if (Math.abs(out) > 0.62 && Math.sign(Math.cos(h)) === Math.sign(out)) {   // heading out near the edge: curl in
            turn = Math.sign(out); k = Math.max(k, 0.22);               // swing down and back toward the stem
          }
          h += turn * k; k *= 1.1;                    // curl tightens into a scroll
          x += Math.cos(h) * base * 0.35; y += Math.sin(h) * base * 0.35;
          pts.push([x, y]);
          if (!inBand(x, base * 0.3)) { pts.pop(); break; }
          if (depth < 3 && --fork <= 0 && i < len - 3 && (depth === 1 || r() < 0.5)) {
            fork = 3 + r() * 3;
            branch(x, y, h - turn * (0.6 + r() * 0.5), -turn, Math.max(4, Math.floor(len * (0.45 + r() * 0.2))), depth + 1);
            continue;
          }
          if (++since > 1 + r() * 2 && i < len - 2) {
            since = 0;
            const sg = (i % 2 ? 1 : -1);
            if (!(r() < 0.35 && blossomAt(x, y, h, sg, 1 - depth * 0.2))) leafAt(x, y, h, sg, 0.9 - depth * 0.15);
          }
        }
        path(pts, [0, 1.7, 1.2, 0.9][depth] || 0.8, [0, 0.9, 0.7, 0.6][depth] || 0.5);
        const [ex, ey] = pts[pts.length - 1];
        const bx = ex + Math.cos(h) * base * 0.9, by = ey + Math.sin(h) * base * 0.9;
        if (depth === 1 && r() < 0.7 && inBand(bx, base * 1.1) && free(bx, by, base * 1.4)) motif(L, doc, o, r, R, bx, by, base * (0.55 + 0.2 * r()), occ, h);
        else if (inBand(ex, base * 0.4) && free(ex, ey, base * 0.5)) { place(L, span(doc, pick(r, r() < 0.6 ? R.bloom : R.bud), o, r, 0.95 - depth * 0.1), ex, ey); occ.push({ x: ex, y: ey, r: base * 0.5 }); }
      };
      // a stem: steered random walk downwards; the main stem, then a thinner one twining round it
      const stem = (x, w0, w1, every, wander, leafEvery) => {
      let y = y0, h = Math.PI / 2, curv = 0, pts = [[x, y]], since = 0, nextBranch = r() * every, alt = r() < 0.5 ? 1 : -1;
      let guard = 0;
      while (y < y1 && guard++ < 20000) {
        // Heading control: aim downward, leaning back toward the band's centre, plus smooth wander
        // (curvature is a low-pass-filtered noise, so bends are gentle and never snap).
        curv = curv * 0.92 + (r() - 0.5) * 0.05 * wander;
        const lean = Math.max(-0.7, Math.min(0.7, (side.x - x) / (band * 0.5) * 0.6));
        const target = Math.PI / 2 - lean + curv * 6;
        h += (target - h) * 0.12;
        x += Math.cos(h) * base * 0.4; y += Math.sin(h) * base * 0.4;
        x = Math.max(side.x - band * 0.22, Math.min(side.x + band * 0.22, x));   // keep to the middle, room to branch
        pts.push([x, y]);
        occ.push({ x, y, r: base * 0.2 });
        if (++since > leafEvery + r() * 1.5) { since = 0; leafAt(x, y, h, r() < 0.5 ? 1 : -1, w0 > 2 ? 1 : 0.8); }
        nextBranch -= 0.4;
        if (nextBranch <= 0) {
          nextBranch = (every * 0.6 + r() * every) / Math.max(0.5, o.density);
          // alternate sides, leaning toward the roomier one
          const sgn = (alt = -alt) * (r() < 0.15 ? -1 : 1);
          const small = r() < 0.45;                                 // many short sprigs among the long branches
          branch(x, y, h + sgn * (0.7 + r() * 0.4), sgn, small ? 5 + Math.floor(r() * 4) : 11 + Math.floor(r() * 10), small ? 2 : 1);
        }
      }
      path(pts, w0, w1);
      return pts;
      };
      const pts = stem(side.x + (r() - 0.5) * band * 0.2, 2.6, 1.6, 1.5, 1, 2);
      // fillers in the gaps
      for (let k = 0; k < (y1 - y0) / base * 0.45 * o.density; k++) {
        const fy = y0 + r() * (y1 - y0), fx = side.x + (r() - 0.5) * band, rad = base * 0.45;
        if (!free(fx, fy, rad)) continue;
        occ.push({ x: fx, y: fy, r: rad });
        place(L, span(doc, pick(r, R.filler), o, r, 0.6 + 0.2 * r()), fx, fy);
      }
    } else if (o.margins === "rosettes") {
      const gapY = base * 4.6 / Math.max(0.5, o.density);
      let y = y0 + base * 1.5, i = 0;
      while (y < y1) {
        const x = side.x + (i % 2 ? 1 : -1) * band * 0.18;
        motif(L, doc, o, r, R, x, y, base * (0.8 + 0.25 * r()), occ, Math.PI / 2);
        // link to the next with a short zigzag of stem glyphs and a pair of leaves
        const nx = side.x + (i % 2 ? -1 : 1) * band * 0.18, ny = y + gapY, n = 4;
        for (let k = 1; k < n; k++) {
          const t = k / n, lx = x + (nx - x) * t, ly = y + base * 1.8 + (ny - y - base * 3.6) * t;
          const st = span(doc, pick(r, R.stem), o, r, 0.65); st.style.rotate = (Math.atan2(ny - y, nx - x) * 180 / Math.PI) + "deg";
          place(L, st, lx, ly);
        }
        const my = (y + ny) / 2, mx = (x + nx) / 2, tok = pick(r, R.leaf);
        place(L, span(doc, tok, o, r, 0.85), mx - base * 0.8, my);
        place(L, span(doc, partner(tok), o, r, 0.85), mx + base * 0.8, my);
        y = ny; i++;
      }
    } else if (o.margins === "interlace" || o.margins === "tiles") {
      const NS = "http://www.w3.org/2000/svg", svg = doc.createElementNS(NS, "svg");
      svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none"; svg.setAttribute("width", "1"); svg.setAttribute("height", "1");
      L.appendChild(svg);
      const line = (pts, colour, w) => { const e = doc.createElementNS(NS, "path"); e.setAttribute("d", "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L"));
        e.setAttribute("fill", "none"); e.setAttribute("stroke", colour); e.setAttribute("stroke-width", w); e.setAttribute("stroke-linecap", "round"); svg.appendChild(e); };
      if (o.margins === "interlace") {
        // Two strands weaving (over/under shown by a paper-coloured gap), glyph knots at the crossings,
        // and a motif in each lens between them. The period drifts, so it never repeats.
        const amp = Math.min(band * 0.36, base * 2.6), cols = ["var(--accent, #a52a1f)", "var(--accent-2, var(--ink, #231c15))"];
        let y = y0, P = base * 7, phase = 0; const A = [], B = [], cross = [];
        while (y < y1) { const sA = Math.sin(phase); A.push([side.x + amp * sA, y]); B.push([side.x - amp * sA, y]);
          const prev = Math.sin(phase - 6.283 / P * 3);
          if (A.length > 1 && Math.sign(sA) !== Math.sign(prev) && sA !== 0) cross.push(y);
          y += 3; phase += 6.283 / P * 3; if (r() < 0.004) P = base * (6 + r() * 3); }
        line(A, cols[0], 2.2); line(B, cols[1], 2.2);
        for (let k = 0; k < cross.length; k++) {
          const cy = cross[k];
          const gap = doc.createElement("div");          // the "under" strand is interrupted at each crossing
          gap.style.cssText = "position:absolute;width:" + (base * 0.9) + "px;height:" + (base * 0.9) + "px;border-radius:50%;background:var(--paper,#fff);translate:-50% -50%";
          gap.style.left = side.x + "px"; gap.style.top = cy + "px"; L.appendChild(gap);
          place(L, span(doc, pick(r, R.bloom), o, r, 0.95), side.x, cy);
          if (k + 1 < cross.length) {
            const my = (cy + cross[k + 1]) / 2;
            if (r() < 0.8) motif(L, doc, o, r, R, side.x, my, base * 0.5, null, Math.PI / 2);
            else place(L, span(doc, pick(r, R.petal), o, r, 1.1), side.x, my);
          }
        }
      } else {
        // Star tiles: a ruled band; diamonds of lattice lines; alternating star and quatrefoil
        // motifs in the cells, with small glyphs at the lattice nodes.
        const ncol = band >= base * 6.4 ? 2 : 1, w = Math.min(band * 0.94 / ncol, base * 4.4), hgt = w;
        for (let c = 0; c < ncol; c++) {
        const x0 = side.x + (c - (ncol - 1) / 2) * w;
        if (c === 0) line([[x0 - w / 2, y0], [x0 - w / 2, y1]], "var(--accent, #a52a1f)", 1);
        line([[x0 + w / 2, y0], [x0 + w / 2, y1]], "var(--accent, #a52a1f)", 1);
        let y = y0, k = c;
        while (y + hgt <= y1) {
          line([[x0 - w / 2, y + hgt / 2], [x0, y], [x0 + w / 2, y + hgt / 2], [x0, y + hgt], [x0 - w / 2, y + hgt / 2]], "var(--rule, #bda985)", 1);
          place(L, span(doc, pick(r, R.filler.filter(t => Array.from(t).length === 1).concat(["·"])), o, r, 0.7), x0, y);
          const save = o.live; o.live = false;
          const q0 = r; const m = k % 2 ? "quatrefoil" : "star";
          // force the kind by drawing via a tiny shim
          const R2 = Object.assign({}, R);
          const kinds = m;
          motifKind(L, doc, o, r, R2, x0, y + hgt / 2, w * 0.2, kinds);
          o.live = save;
          y += hgt; k++;
        }
        }
      }
    } else if (o.margins === "hats") {
      // Aperiodic monotile in glyphs: one hat tiling runs unbroken down each margin (a different
      // stretch of it on each side). Every hat is filled with a math symbol on a fine lattice; the
      // colour follows the hat's metatile, the symbol is swapped from tile to tile, and the rare
      // mirrored hats are in the accent.
      const cell = base * 0.52, CH = 400;
      if (!HATS) {
        HATS = hatPatch(2); const q = HATS.query(-1e9, -1e9, 1e9, 1e9)[0].pts;
        HAT_AREA = Math.abs(q.reduce((a, p, i) => { const n = q[(i + 1) % q.length]; return a + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;
      }
      const w = Math.min(band * 0.92, base * 6.4), x0 = side.x - w / 2;
      const unit = w / 5.8;                                                                      // a hat is about a third of the strip
      const need = (H + 2000) / unit;                                                            // patch height wanted, in tile units
      for (let lv = 3; lv <= 9 && (!HATS.lv || HATS.lv < lv) && HATS.box[3] - HATS.box[1] < need; lv++) { HATS = Object.assign(hatPatch(lv), { lv }); }
      // four colours, given greedily so that touching hats differ; each hat one symbol
      const COLS = ["var(--accent-3, #3b6fb6)", "var(--accent-2, #3f7a3a)", "var(--accent-4, #d9a520)", "color-mix(in srgb, var(--accent, #a52a1f) 45%, var(--ink, #231c15))"];
      const SYMS = ["⊕", "⊗", "⊙", "⊛", "⊚", "⊜", "⊝", "⊘"], FLOWERS = ["✿", "❀", "✾"];
      // where this margin's strip sits in the patch: its centre line, from near the patch's top
      const bx = HATS.box, sx = (bx[0] + bx[2]) / 2 + (side.key === "L" ? -1 : 1) * Math.min((bx[2] - bx[0]) / 5, 3 * w / unit), sy = bx[1] + (bx[3] - bx[1] - need) / 2 + 1000 / unit;
      const toPatch = (px, py) => [sx + (px - side.x) / unit, sy + py / unit];
      const toPage = (qx, qy) => [side.x + (qx - sx) * unit, (qy - sy) * unit];
      const inside = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
      const look = new Map(), keyOf = h => h.c[0].toFixed(2) + "," + h.c[1].toFixed(2);
      const colour = hats => {                           // hats sorted top to bottom; neighbours = centres within 2.6 units
        hats.sort((a, b) => a.c[1] - b.c[1] || a.c[0] - b.c[0]);
        for (const h of hats) {
          const key = keyOf(h); if (look.has(key)) continue;
          const rr = rng(o.seed + "|hat|" + key);
          if (h.label === "H1") { look.set(key, { g: FLOWERS[Math.floor(rr() * 3)], col: "var(--accent, #a52a1f)", ci: -1 }); continue; }
          const used = new Set();
          for (const n of hats) { const l = look.get(keyOf(n)); if (l && Math.hypot(n.c[0] - h.c[0], n.c[1] - h.c[1]) < 2.6) { used.add(l.ci); used.add("g" + l.g); } }
          const free = [0, 1, 2, 3].filter(i => !used.has(i)), ci = free.length ? free[Math.floor(rr() * free.length)] : Math.floor(rr() * 4);
          const gs = SYMS.filter(g => !used.has("g" + g)), g = (gs.length ? gs : SYMS)[Math.floor(rr() * (gs.length || SYMS.length))];
          look.set(key, { g, col: COLS[ci], ci });
        }
      };
      const lookOf = h => look.get(keyOf(h));
      for (let cy0 = y0; cy0 < y1; cy0 += CH) {
        const cy1 = Math.min(y1, cy0 + CH), [qa, qb] = toPatch(x0, cy0), [qc, qd] = toPatch(x0 + w, cy1);
        const hats = HATS.query(qa - 3, qb - 3, qc + 3, qd + 3);
        colour(hats);
        const row0 = Math.ceil(cy0 / (cell * 0.866));
        for (let row = row0; row * cell * 0.866 < cy1; row++) {
          const py = row * cell * 0.866;
          for (let px = x0 + cell * (row % 2 ? 1 : 0.5); px < x0 + w - cell * 0.3; px += cell) {
            const [qx, qy] = toPatch(px, py);
            let hit = null;
            for (const h of hats) if (Math.abs(h.c[0] - qx) < 3 && Math.abs(h.c[1] - qy) < 3 && inside(qx, qy, h.pts)) { hit = h; break; }
            if (!hit) continue;
            const lk = lookOf(hit);
            place(L, span(doc, lk.g, o, r, 0.62, { color: lk.col }), px, py);
          }
        }
      }
    } else if (o.margins === "aperiodic") {
      // An aperiodic tiling of glyphs: one hat tiling runs down each margin (a different stretch of it on each
      // side), and every hat holds one glyph, drawn at random from the maths symbols and the fleurons, turned as
      // its hat is (a mirrored hat holds a mirrored glyph; chiral symbols stay upright), coloured so that touching
      // hats differ.
      // (tiles about 2.7em across: large enough that each of the page's stowaways, the cats and the name, can
      // take the place of one tile)
      const CH = 400, unit = base * 1.45; L._hatD = unit * 1.85;
      if (!HATS) { HATS = hatPatch(2); }
      const w = band * 0.94, x0 = side.x - w / 2, need = (H + 2000) / unit;
      for (let lv = 3; lv <= 9 && (!HATS.lv || HATS.lv < lv) && HATS.box[3] - HATS.box[1] < need; lv++) { HATS = Object.assign(hatPatch(lv), { lv }); }
      const GG = window.GlyphGen, GA = window.GlyphArt;
      const SYMS = GG ? GG.SYM.common.concat(GG.SYM.common, GG.SYM.rare, GG.SYM.fleuron) : ["λ", "Π", "Σ", "∀", "⊗", "⊕", "β", "η", "✿", "❀"];
      const HOOK = GA ? GA.HOOKED : /[∃Σ⊢Γ⊸]/;
      const COLS = ["var(--accent, #a52a1f)", "var(--accent-2, #3f7a3a)", "var(--accent-3, #3b6fb6)", "var(--accent-4, #d9a520)", "var(--accent-5, #7a4f86)"];
      const bx = HATS.box, sx = (bx[0] + bx[2]) / 2 + (side.key === "L" ? -1 : 1) * Math.min((bx[2] - bx[0]) / 5, 3 * w / unit), sy = bx[1] + (bx[3] - bx[1] - need) / 2 + 1000 / unit;
      const toPatch = (px, py) => [sx + (px - side.x) / unit, sy + py / unit];
      const toPage = (qx, qy) => [side.x + (qx - sx) * unit, (qy - sy) * unit];
      const look = new Map(), keyOf = h => h.c[0].toFixed(2) + "," + h.c[1].toFixed(2);
      const choose = hats => {
        hats.sort((a, b) => a.c[1] - b.c[1] || a.c[0] - b.c[0]);
        for (const h of hats) {
          const key = keyOf(h); if (look.has(key)) continue;
          const rr = rng(o.seed + "|aperiodic|" + key), used = new Set();
          for (const n of hats) { const l = look.get(keyOf(n)); if (l && Math.hypot(n.c[0] - h.c[0], n.c[1] - h.c[1]) < 2.4) used.add(l.ci); }
          const free = [0, 1, 2, 3, 4].filter(i => !used.has(i)), ci = free.length ? free[Math.floor(rr() * free.length)] : Math.floor(rr() * 5);
          look.set(key, { g: SYMS[Math.floor(rr() * SYMS.length)], ci });
        }
      };
      for (let cy0 = y0; cy0 < y1; cy0 += CH) {
        const cy1 = Math.min(y1, cy0 + CH), [qa, qb] = toPatch(x0, cy0), [qc, qd] = toPatch(x0 + w, cy1);
        const hats = HATS.query(qa - 3, qb - 3, qc + 3, qd + 3);
        choose(hats);
        for (const h of hats) {
          const [px, py] = toPage(h.c[0], h.c[1]);
          if (px < x0 + base * 0.4 || px > x0 + w - base * 0.4 || py < cy0 || py >= cy1) continue;
          const lk = look.get(keyOf(h)), [p0, p1] = h.pts, deg = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;
          const e = span(doc, lk.g, o, r, 1.6, { color: COLS[lk.ci] }); e.dataset.hat = "1";
          if (!HOOK.test(lk.g)) e.style.rotate = deg.toFixed(1) + "deg";
          if (h.label === "H1") e.style.scale = "-1 1";
          place(L, e, px, py);
        }
      }
    } else if (o.margins === "sampler") {
      // Cross-stitch sampler: little pixel motifs (tulip, heart, bird, star, cat, house) stitched
      // on a strict grid with one stitch glyph, separated by stitched bands, each motif in one colour.
      const M = {
        tulip: ["..x.x..", ".xx.xx.", ".xxxxx.", "..xxx..", "...x...", "x..x..x", ".x.x.x.", "..xxx..", "...x..."],
        heart: [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."],
        bird: ["...xx..", "..xxxx.", "xxxxx..", ".xxxxx.", "..xxx..", "..x.x.."],
        star: ["...x...", "x..x..x", ".xxxxx.", "xxx.xxx", ".xxxxx.", "x..x..x", "...x..."],
        cat: ["x...x..", "xxxxx..", "x.x.x..", "xxxxx..", ".xxx..x", "xxxxx.x", "xxxxxx."],
        house: ["...x...", "..xxx..", ".xxxxx.", "xxxxxxx", ".x.x.x.", ".xxxxx.", ".xx.xx."],
      };
      const order = ["tulip", "heart", "bird", "star", "cat", "tulip", "house", "heart", "star", "bird"];
      const cell = base * 0.62;
      // stitched in the alphabet's symbols: one symbol set per motif, alternating across the grid
      const singles = tokens(o).filter(t => Array.from(t).length === 1 && !THIN.has(t));
      const stitchSets = [["⊕", "⊗"], ["λ", "β", "η"], ["∀", "Σ"], ["∃", "Π"]].map(set => set.filter(t => singles.includes(t))).filter(set => set.length);
      if (!stitchSets.length) stitchSets.push(singles.length ? singles.slice(0, 3) : ["×"]);
      const cols = PALETTES[o.palette] || THEME;  // one colour per motif
      let y = y0 + base, k = Math.floor(r() * order.length);
      const band_ = (yy, c) => { for (let i = -3; i <= 3; i += 2) place(L, span(doc, "·", o, r, 0.5, { color: c }), side.x + i * cell, yy); };
      // configured motifs (glyph-art entries tagged ornament-sampler), each cell stitched from its
      // own brush's bag in its brush's colour
      const custom = (o.motifs || []).filter(m => m.rows && m.rows.length);
      if (custom.length) {
        k = Math.floor(r() * custom.length);
        const colourOf = c => (/^(accent(-[234])?|ink|muted|rule|paper)$/.test(c) ? "var(--" + c + ")" : c);
        while (y < y1 - cell * 10) {
          band_(y, RULE(o)); y += cell * 1.6;
          const m = custom[k++ % custom.length], flip = r() < 0.5, w = Math.max(...m.rows.map(x => Array.from(x).length));
          m.rows.forEach((row, j) => Array.from(row).forEach((ch, i) => {
            const b = m.brushes[ch]; if (!b || !b.glyphs.length) return;
            const ii = flip ? w - 1 - i : i;
            place(L, span(doc, b.glyphs[(i + j) % b.glyphs.length], o, r, 0.6, { color: colourOf(b.color) }), side.x + (ii - (w - 1) / 2) * cell, y + j * cell);
          }));
          y += m.rows.length * cell + cell * 1.6;
        }
        y = y1;
      }
      while (y < y1 - cell * 10) {
        band_(y, RULE(o)); y += cell * 1.6;
        const m = M[order[k++ % order.length]], c = pick(r, cols), flip = r() < 0.5, set = pick(r, stitchSets);
        m.forEach((row, j) => Array.from(row).forEach((ch, i) => {
          if (ch !== "x") return;
          const ii = flip ? row.length - 1 - i : i;
          place(L, span(doc, set[(i + j) % set.length], o, r, 0.6, { color: c }), side.x + (ii - (row.length - 1) / 2) * cell, y + j * cell);
        }));
        y += m.length * cell + cell * 1.6;
      }
    } else if (o.margins === "frieze") {
      // Frieze: a woven diamond chain drawn with ╲ ╱ strokes. The diamonds vary a little in
      // size, and their contents cycle (a bloom, a petal, a math glyph, a star, a pair of leaves),
      // some with a small inner diamond; the side pockets alternate dots, petals and stitches.
      const wMax = Math.min(band * 0.42, base * 1.6);
      const fill = [
        () => [[pick(r, R.bloom), 1.1]],
        () => [[pick(r, R.petal), 0.95]],
        () => [[pick(r, R.stem.concat(R.bud)), 0.9]],
        () => [["✦", 0.85]],
        () => [[pick(r, R.leaf), 0.8, -0.28], [partner(pick(r, ["❧"])), 0.8, 0.28]],
      ];
      let y = y0 + base, i = 0, k = Math.floor(r() * fill.length);
      while (y < y1 - base * 3) {
        const h = base * (2.1 + 0.6 * r()), w = wMax * (0.82 + 0.18 * r()), steps = 6;
        for (let t = 1; t < steps; t++) {
          const f = t / steps, dx = w * (1 - Math.abs(1 - 2 * f)), yy = y + f * h;
          const a = f < 0.5 ? "╲" : "╱", b = f < 0.5 ? "╱" : "╲";
          place(L, span(doc, b, o, r, 0.95, { color: RULE(o) }), side.x - dx, yy);
          place(L, span(doc, a, o, r, 0.95, { color: RULE(o) }), side.x + dx, yy);
        }
        const cy = y + h / 2, items = fill[k++ % fill.length]();
        for (const [tok, sz, off] of items) place(L, span(doc, tok, o, r, sz), side.x + (off || 0) * w, cy);
        if (i % 3 === 2) {                                   // a small inner diamond round the centre
          for (const [dx2, dy2, g] of [[0, -0.55, "·"], [0, 0.55, "·"], [-0.5, 0, "·"], [0.5, 0, "·"]]) place(L, span(doc, g, o, r, 0.6, { color: RULE(o) }), side.x + dx2 * w, cy + dy2 * h * 0.5);
        }
        const pocket = i % 3 === 0 ? "·" : i % 3 === 1 ? pick(r, R.petal) : "×";
        place(L, span(doc, pocket, o, r, pocket === "·" ? 0.7 : 0.6), side.x - w * 1.05, y);
        place(L, span(doc, pocket, o, r, pocket === "·" ? 0.7 : 0.6), side.x + w * 1.05, y);
        y += h; i++;
      }
    } else if (o.margins === "tree") {
      // Tree of life: a straight trunk with mirrored branch pairs (bilateral symmetry, the
      // defining trait of folk trees), leaves turned outward, blooms and paired birds at the tips.
      const NS = "http://www.w3.org/2000/svg", svg = doc.createElementNS(NS, "svg");
      svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none"; svg.setAttribute("width", "1"); svg.setAttribute("height", "1");
      L.appendChild(svg);
      const line = (d, wdt) => { const e = doc.createElementNS(NS, "path"); e.setAttribute("d", d); e.setAttribute("fill", "none"); e.setAttribute("stroke", RULE(o)); e.setAttribute("stroke-width", wdt); e.setAttribute("stroke-linecap", "round"); svg.appendChild(e); };
      line(`M${side.x} ${y0} L${side.x} ${y1}`, 2);
      const S = base * 2.1, leaf = pick(r, R.leaf), bloom = pick(r, R.bloom), bird = pick(r, R.leaf.concat(R.bud));
      let lvl = 0;
      for (let y = y0 + base; y < y1 - base; y += S, lvl++) {
        const w = band * (0.26 + 0.14 * Math.sin(lvl * 0.9));
        for (const sg of [-1, 1]) {
          const ex = side.x + sg * w, ey = y - S * 0.35;
          line(`M${side.x} ${y} Q${side.x + sg * w * 0.5} ${y} ${ex} ${ey}`, 1.1);
          const tipTok = lvl % 3 === 1 ? bloom : (sg < 0 ? leaf : partner(leaf));
          const e = span(doc, tipTok, o, r, lvl % 3 === 1 ? 0.95 : 0.8);
          if (lvl % 3 !== 1) e.style.rotate = (sg < 0 ? -25 : 25) + "deg";
          place(L, e, ex + sg * base * 0.3, ey);
          if (lvl % 5 === 3) { const b = sg < 0 ? bird : partner(bird); place(L, span(doc, b, o, r, 0.75), side.x + sg * w * 0.55, y - S * 0.6); }
        }
        place(L, span(doc, "·", o, r, 0.7), side.x, y);
      }
    } else if (o.margins === "lace") {
      // Lace: scallops of small dots hanging off the text column's edge, a bloom at the lowest
      // point of each, and a second fainter row inside, like a crocheted edging.
      const ex = side.edge, S = base * 2.2, A = base * 1.0 * (side.dir), dot = pick(r, ["·", "∘", "•"]);
      const bloom = pick(r, R.bloom);
      let y = y0 + base, i = 0;
      while (y < y1 - S) {
        const n = 7;
        for (let t = 0; t <= n; t++) {
          const f = t / n, x = ex + A * Math.sin(f * Math.PI), yy = y + f * S;
          place(L, span(doc, dot, o, r, 0.55, { color: RULE(o) }), x, yy);
          if (t % 2 === 1) place(L, span(doc, "·", o, r, 0.4, { color: RULE(o), opacity: ".6" }), ex + A * 0.55 * Math.sin(f * Math.PI), yy);
        }
        place(L, span(doc, i % 2 ? bloom : pick(r, R.petal), o, r, 0.85), ex + A * 1.45, y + S / 2);
        y += S; i++;
      }
    } else if (o.margins === "constellation") {
      // Constellation: sparse stars (and the odd alphabet glyph) joined to their nearest
      // neighbours by faint lines, like a star chart; best in dark mode.
      const NS = "http://www.w3.org/2000/svg", svg = doc.createElementNS(NS, "svg");
      svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none"; svg.setAttribute("width", "1"); svg.setAttribute("height", "1");
      L.appendChild(svg);
      const pts = [], step = base * 1.9 / Math.max(0.5, o.density);
      for (let y = y0 + base; y < y1 - base; y += step) {
        if (r() < 0.25) continue;
        pts.push([side.x + (r() - 0.5) * band * 0.85, y + (r() - 0.5) * step * 0.8]);
      }
      pts.forEach(([x, y], i) => {
        const near = pts.slice(i + 1, i + 5).map(q => [q, Math.hypot(q[0] - x, q[1] - y)]).sort((a, b) => a[1] - b[1]).slice(0, r() < 0.3 ? 2 : 1);
        for (const [q, d] of near) if (d < base * 5) {
          const e = doc.createElementNS(NS, "path"); e.setAttribute("d", `M${x} ${y} L${q[0]} ${q[1]}`);
          e.setAttribute("stroke", RULE(o)); e.setAttribute("stroke-width", ".7"); e.setAttribute("opacity", ".45"); svg.appendChild(e);
        }
        const tok = r() < 0.18 ? pick(r, R.bloom) : pick(r, ["✦", "✧", "⋆", "∗", "✶", "·"]);
        place(L, span(doc, tok, o, r, 0.5 + r() * 0.55), x, y);
      });
    } else if (o.margins === "compose" && o.composeLayout !== "pack") {
      // A composed pattern laid out like an Apollonian gasket: the required placements (cats, the
      // signature) are reserved first; then, again and again, the largest empty circle left in the
      // band gets the largest piece that fits it, so gaps fill with ever smaller pieces down to
      // single glyphs, and the margin ends up evenly packed. Every glyph is drawn at one size.
      // o.gasketEmpty (0..1) keeps that share of holes empty, for a lighter layout.
      const GLYPH = 13, G = 5, MINR = 8, PAD = 3.5;
      const left = side.x - band / 2, cols = Math.max(2, Math.ceil(band / G) + 1), rows = Math.max(2, Math.ceil((y1 - y0) / G) + 1);
      const dist = new Float32Array(cols * rows);
      // The edge toward the text: the band keeps its full width, and only large pieces (≥ BIG) may
      // reach past it by up to OV, so the edge is shaped by a few big shapes, never by small ones.
      const inward = side.dir < 0 ? 1 : -1, OV = Math.min(band * 0.2, GLYPH * 2.6), BIG = GLYPH * 3;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = left + i * G, y = y0 + j * G;
        dist[j * cols + i] = Math.min(x - left, left + band - x, y - y0, y1 - y);
      }
      const BR = 40, blocks = Math.ceil(rows / BR), bmax = new Float32Array(blocks), barg = new Int32Array(blocks);
      const reblock = b => { let m = -1, a = 0; for (let j = b * BR; j < Math.min(rows, (b + 1) * BR); j++) for (let i = 0; i < cols; i++) { const v = dist[j * cols + i]; if (v > m) { m = v; a = j * cols + i; } } bmax[b] = m; barg[b] = a; };
      // an obstacle: a circle (or, with hw/hh, a box) — lower the distance field around it
      // (distances never exceed half the band, so only points within size + band/2 can change; and
      // points already inside something (≤ 0) never change again)
      const HALF = band / 2 + 1;
      const obstacle = (cx, cy, R, hw, hh) => {
        const box = hw != null, reach = (box ? Math.max(hw, hh) : R) + HALF;
        const j0 = Math.max(0, Math.floor((cy - reach - y0) / G)), j1 = Math.min(rows - 1, Math.ceil((cy + reach - y0) / G));
        const i0 = Math.max(0, Math.floor((cx - reach - left) / G)), i1 = Math.min(cols - 1, Math.ceil((cx + reach - left) / G));
        for (let j = j0; j <= j1; j++) {
          const y = y0 + j * G, ay = Math.abs(y - cy), row = j * cols;
          for (let i = i0; i <= i1; i++) {
            const k = row + i, cur = dist[k]; if (cur <= 0) continue;
            const ax = Math.abs(left + i * G - cx);
            let d;
            if (box) { const ox = ax - hw, oy = ay - hh; d = ox > 0 || oy > 0 ? Math.hypot(Math.max(0, ox), Math.max(0, oy)) : Math.max(ox, oy); }
            else d = Math.hypot(ax, ay) - R;
            if (d < cur) dist[k] = d;
          }
        }
        for (let b = Math.floor(j0 / BR); b <= Math.floor(j1 / BR); b++) reblock(b);
      };
      for (let b = 0; b < blocks; b++) reblock(b);
      for (const rv of (o._reserve || []).filter(q => q.side === side.key)) obstacle(rv.x, rv.y, 0, rv.w / 2 + PAD * 2, rv.h / 2 + PAD * 2);
      // a later chunk: whatever the chunk above already drew near the join is an obstacle
      for (const e of L.querySelectorAll(".glyph-orn")) {
        if (e._y == null || e._y < y0 - HALF - GLYPH * 6 || e._y > y0 + GLYPH * 6 || e._x < left - GLYPH || e._x > left + band + GLYPH) continue;
        obstacle(e._x, e._y, GLYPH * 0.62 + PAD);
      }
      // a pool of pieces, measured once (radius at the fixed glyph size), largest first
      const med = d => { const ss = d.items.filter(it => !it.seg).map(it => it.s || 1).sort((a, b) => a - b); return ss[Math.floor(ss.length / 2)] || 1; };
      const pool = [];
      for (let t = 0; t < 70; t++) {
        const d = o.compose(side.key + "|g" + t); if (!d || !d.items.length) continue;
        const fit = GLYPH / (base * med(d)), w = d.w * base * fit, h = d.h * base * fit;
        if (w > band * 0.96) continue;
        pool.push({ d, fit, hw: w / 2 + PAD, hh: h / 2 + PAD, R: Math.min(w, h) / 2 + PAD, area: w * h, key: d.items.map(it => it.tok).join("") });
      }
      pool.sort((a, b) => b.area - a.area);
      const uses = new Map();   // per distinct piece (the pool holds several draws of the same one)
      // does a piece's box fit, centred at (x, y)? every grid point under it must be clear
      const fitsAt = (pc, x, y, over) => {
        const lo = left - 1 - (over && inward < 0 ? over : 0), hi = left + band + 1 + (over && inward > 0 ? over : 0);
        if (x - pc.hw < lo || x + pc.hw > hi || y - pc.hh < y0 || y + pc.hh > y1) return false;
        const i0 = Math.max(0, Math.floor((x - pc.hw - left) / G)), i1 = Math.min(cols - 1, Math.ceil((x + pc.hw - left) / G));
        const j0 = Math.max(0, Math.floor((y - pc.hh - y0) / G)), j1 = Math.min(rows - 1, Math.ceil((y + pc.hh - y0) / G));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (dist[j * cols + i] < 1) return false;
        return true;
      };
      const fillers = (o.gasketFill && o.gasketFill.length ? o.gasketFill : [].concat(R.bloom || [], R.filler || [], R.leaf || [])).filter(t => Array.from(t).length === 1);
      // Shapes made to measure for a hole of radius Rp (px), from the grammar (Ornament.shape), in
      // px about the centre, every glyph at the fixed size.
      const S1 = GLYPH / base;
      const pal = (PALETTES[o.palette] || THEME).filter(c => !/--ink|--muted/.test(c));
      const GEN = {};
      // measure glyphs in the font the margins draw them in (else wide glyphs are packed as if narrow, and clip)
      { const GA = doc.defaultView.GlyphArt, sample = span(doc, "·", o, r, 1); L.appendChild(sample); const fam = getComputedStyle(sample).fontFamily; sample.remove();
        if (GA && fam && GA.FONT !== fam) GA.setFont(fam); }
      // (organic: each drawn turned by a random angle; chiral glyphs and text keep level, as ever)
      const turnItems = (its, deg) => { const c = Math.cos(deg * Math.PI / 180), s0 = Math.sin(deg * Math.PI / 180), H = doc.defaultView.GlyphArt ? doc.defaultView.GlyphArt.HOOKED : /$^/;
        return its.map(it => Object.assign({}, it, { x: it.x * c - it.y * s0, y: it.x * s0 + it.y * c, rot: H.test(it.tok) ? (it.rot || 0) : (it.rot || 0) + deg })); };
      for (const k of doc.defaultView.Ornament.SHAPE_KINDS) GEN[k] = Rp => turnItems( doc.defaultView.Ornament.shape(k, Rp / GLYPH, r, pal).map(it => Object.assign({}, it, { x: (it.ix != null ? it.ix : it.x) * GLYPH, y: (it.iy != null ? it.iy : it.y) * GLYPH, s: (it.s || 1) * S1 })), ["gfleur", "gtree"].includes(k) ? (r() - 0.5) * 40 : r() * 360);   // (placed by their ink centres: place() centres each glyph on its ink)
      const GENS = Object.keys(GEN), useGen = o.gasketShapes !== false;
      const W = (o.gasketWeights || []).filter(([k]) => GEN[k]), WT = W.reduce((a, [, w]) => a + w, 0);
      // Without a library weighting, compound shapes (orbits, layered, doubled, double) are favoured
      // over the simple ones: fewer, richer pieces. Shapes of shapes (nested, halo) stay rare: they
      // cost many times the glyphs, and a long page would take too long to draw.
      const DEFW = { gflower: 4, gstar: 4, gburst: 4, gsnow: 2, gfleur: 2, gtree: 1 };   // flowers, stars and bursts evenly; fewer snowflakes, fleurs-de-lis and trees
      const DW = GENS.map(k => [k, DEFW[k] || 1]), DWT = DW.reduce((a, [, w]) => a + w, 0);
      const pickGen = () => { if (!WT) { let x = r() * DWT; for (const [k, w] of DW) { x -= w; if (x < 0) return k; } return DW[DW.length - 1][0]; } let x = r() * WT; for (const [k, w] of W) { x -= w; if (x < 0) return k; } return W[W.length - 1][0]; };
      const shapes = L._shapes || (L._shapes = new Map());   // generated shapes by id, so a click can redraw one
      L._reroll = pid => {
        const q = L._shapes.get(pid); if (!q) return;
        L.querySelectorAll('[data-piece="' + pid + '"]').forEach(e => e.remove());
        if (q.redraw) { q.redraw(pid); doc.dispatchEvent(new CustomEvent("glyphs-changed")); return; }
        // (drawn again for the same hole, from the same weighted kinds: as large as the hole allows, no larger)
        const items = q.gen[pickGen()](q.Rp);
        q.draw(items, q.cx, q.cy, pid, q.Rp);
        doc.dispatchEvent(new CustomEvent("glyphs-changed"));   // so the pointer effects pick up the new glyphs
      };
      // how far a made-to-measure shape's ink reaches from its centre (px): what the packing works round
      const reachOf = items => items.reduce((m, it) => Math.max(m, Math.hypot(it.x, it.y) + 0.5 * (it.s || 1) * base), 0);
      const drawItems = (items, cx, cy, pidIn, Rp) => { const pid = pidIn || "g" + side.key + nextId(); shapes.set(pid, { Rp: Rp || 0, cx, cy, gen: GEN, draw: drawItems }); for (const it of items) { const e = span(doc, it.tok, o, r, it.s, it.col ? { color: it.col } : null); if (it.rot) e.style.rotate = it.rot.toFixed(1) + "deg"; if (it.reflect) e.style.scale = "-1 1"; e.dataset.piece = pid; place(L, e, cx + it.x, cy + it.y); } };
      // each piece's glyphs share an id (data-piece), unique across the whole layer (both margins,
      // every rebuild), so a click redraws just that piece and tests can tell pieces apart
      const nextId = () => (L._pieceCount = (L._pieceCount || 0) + 1);
      const drawAt = (pc, cx, cy, pidIn) => {
        const mirror = r() < 0.5 && !pc.d.items.some(it => it.seg), pid = pidIn || side.key + nextId();
        for (const it0 of pc.d.items) {
          if (it0.seg) {   // a line (a constellation's figure), faint and dotted
            const P2 = pc.pfit || pc.fit, it = mirror ? Object.assign({}, it0, { x: -it0.x, dx: -it0.dx }) : it0, len = Math.hypot(it.dx, it.dy) * base * P2;
            const e = doc.createElement("span");
            e.style.cssText = "position:absolute;height:0;border-top:1px " + (it.dash ? "dotted" : "solid") + " " + (it.col || RULE(o)) + ";opacity:.6;transform-origin:0 0;pointer-events:none;width:" + len.toFixed(1) + "px;rotate:" + (Math.atan2(it.dy, it.dx) * 180 / Math.PI).toFixed(1) + "deg";
            const x = cx + it.x * base * P2, y2 = cy + it.y * base * P2, i2 = Math.max(0, Math.floor(y2 / CHUNK));
            e.style.left = x.toFixed(1) + "px"; e.style.top = (y2 - i2 * CHUNK + CHUNK_PAD).toFixed(1) + "px"; e.dataset.piece = pid;
            chunkBand(L, i2).appendChild(e);
            continue;
          }
          const it = mirror ? Object.assign({}, it0, { x: -it0.x, rot: it0.rot ? -it0.rot : it0.rot }) : it0;
          const e = span(doc, it.tok, o, r, (it.s || 1) * pc.fit, it.col ? { color: it.col } : null);
          if (it.rot) e.style.rotate = it.rot.toFixed(1) + "deg";
          if (it.bold) e.style.fontWeight = "700";
          if (it.reflect) { const inner = doc.createElement("span"); inner.textContent = e.textContent; inner.style.cssText = "display:inline-block;transform:scaleX(-1)"; e.textContent = ""; e.appendChild(inner); }
          e.dataset.piece = pid;
          place(L, e, cx + it.x * base * (pc.pfit || pc.fit), cy + it.y * base * (pc.pfit || pc.fit));
        }
        return pid;
      };
      // share of holes left empty (<pattern>-empty), moved by the reader's density
      const empty0 = o.gasketEmpty != null ? o.gasketEmpty : 0.12;   // a little air between pieces
      const empty = empty0 >= 0.9 ? empty0 : o.densityLevel === "sparse" ? Math.max(empty0, 0.62) : o.densityLevel === "dense" ? 0 : empty0;
      const sparse = o.densityLevel === "sparse" && empty0 < 0.9, dense = o.densityLevel === "dense";
      // Rinse and repeat: a random unoccupied spot; the biggest thing that fits there (a library
      // piece whose box fits, or a shape made to measure, or now and then nothing); every tile at
      // most MAXR across (large: a gasket's first circles are big). Stops when no spot is left roomy enough for a glyph.
      // (BUF: extra clearance round a large structure, so the big circles stand apart)
      const GSIZE = (doc.defaultView.GlyphGen && doc.defaultView.GlyphGen.MIN) || 1.4;   // every glyph in the margins this size (as the structures')
      const BUF = Rp => Rp > GLYPH * 3 ? GLYPH * 0.9 * Math.min(1, (Rp - GLYPH * 3) / (GLYPH * 3)) + GLYPH * 0.3 : 0;
      const MAXR = Math.min(band * 0.5, GLYPH * 12), MAXEMPTY = empty >= 0.9 ? band : sparse ? band * 0.55 : GLYPH * 3;   // a mostly empty pattern keeps whole gaps empty   // room for four layers (more for compound-heavy patterns)
      const placed = [];
      let misses = 0;
      // Planted first (o.gasketFirst): as many as fit, down the band, each at a random place across
      // it, a little apart; everything else then packs round them.
      if (o.gasketFirst) {
        let ys = y0 + r() * GLYPH * 3, n = 0;
        while (ys < y1 && n < 400) {
          let d = null;
          // constellations: deal the named ones from a shuffled deck (shared by both margins), so none
          // repeats until all have been used; other planted pieces draw as usual
          if (o.gasketFirstSky) {
            if (!L._deck) { const dk = Object.keys(doc.defaultView.Ornament.SKY); for (let i = dk.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [dk[i], dk[j]] = [dk[j], dk[i]]; } L._deck = dk; }
            if (!L._deck.length) break;                  // each constellation once a page; then empty sky
            // spread the deck over the page: the next one comes after a gap sized to what's left
            if (n > 0) { const perSide = Math.max(1, L._deck.length / (side.key === "L" ? 2 : 1)); ys += Math.max(0, (y1 - ys) / (perSide + 1) - band * 1.2) * r(); }
            d = o.gasketFirstSky(L._deck.pop(), side.key + "|" + n++);
          } else d = o.gasketFirst(side.key + "|" + n++);
          if (!d || !d.items.length) break;
          const fit = GLYPH / (base * med(d)), figure = d.items.some(it => it.seg);
          // a figure with lines (a constellation) is spread to fill the band, its stars kept at glyph size
          const pfit = figure ? Math.min((band - 2 * PAD - GLYPH * 1.6) / (d.w * base), 2.2 * band / (d.h * base)) : fit;   // spread wide, yet always inside the band
          const w = d.w * base * pfit, h = d.h * base * pfit;
          const pc = { d, fit, pfit, hw: w / 2 + PAD, hh: h / 2 + PAD };
          let done = false;
          for (let t = 0; t < 12 && !done; t++) {
            const ov = Math.min(pc.hw, pc.hh) >= BIG ? OV : 0, room = Math.max(0, band - 2 * pc.hw) + ov;
            const x = inward > 0 ? left + pc.hw + r() * room : left + band - pc.hw - r() * room, y = ys + pc.hh + r() * GLYPH;
            if (fitsAt(pc, x, y, ov)) { const pid = drawAt(pc, x, y);
              const box = { hw: pc.hw, hh: pc.hh, x, y };
              shapes.set(pid, { redraw: () => {   // another of the planted kind (a flower for a flower), fitting the same space
                let best = null;
                const was = (L._shapes.get(pid) || {}).key;
                for (let t = 0; t < 30; t++) {
                  const d2 = o.gasketFirst(side.key + "|re|" + Date.now() + "|" + t); if (!d2 || !d2.items.length) continue;
                  if (d2.items.map(it => it.tok).join("") === was) continue;   // a different one
                  const f2 = GLYPH / (base * med(d2)), hw = d2.w * base * f2 / 2 + PAD, hh = d2.h * base * f2 / 2 + PAD;
                  if (hw <= box.hw + 2 && hh <= box.hh + 2) { best = { d: d2, fit: f2, hw, hh }; if (r() < 0.5) break; }
                }
                const use = best || pc; drawAt(use, box.x, box.y, pid);
                L._shapes.get(pid).key = use.d.items.map(it => it.tok).join("");
              }, key: pc.d.items.map(it => it.tok).join("") }); obstacle(x, y, 0, pc.hw, pc.hh); ys = y + pc.hh + GLYPH * (figure ? 4 + r() * 6 : 0.4 + r() * 1.6); done = true; }
          }
          if (!done) ys += GLYPH * 3;
        }
      }
      // A few big elements first, spaced irregularly down the band (a layered rosette, a star, a
      // snowflake, as large as the band allows), so the packing has large pieces to work round.
      if (useGen) {
        const BIGR = Math.min((band + OV) / 2 - PAD - 1, GLYPH * 13);   // (the first circles as big as fits: the band, and past its inner edge by up to OV)
        for (let ys = y0 + 60 + r() * 380; ys < y1 - BIGR; ys += 300 + r() * 900) {   // (irregularly spaced)
          const Rp = BIGR * (0.6 + 0.4 * r()), room = Math.max(0, band - 2 * Rp) + OV;   // may reach past the inner edge
          const x = inward > 0 ? left + Rp + r() * room : left + band - Rp - r() * room;
          if (!fitsAt({ hw: Rp + PAD, hh: Rp + PAD }, x, ys, OV)) continue;
          // (a click redraws it within the radius it actually reached: what was placed after may stand just outside it)
          const its = GEN[pickGen()](Rp), reach0 = Math.min(Rp, reachOf(its)); drawItems(its, x, ys, null, reach0); obstacle(x, ys, reach0 + PAD + BUF(Rp));
        }
      }
      // (<pattern>-empty = 1: nothing after the planted pieces and seeds — an empty sky)
      for (let guard = 0; guard < (empty >= 1 ? 0 : 30000) && misses < 400; guard++) {
        let k = -1;
        // an Apollonian gasket: always the largest empty circle left (one of the few nearly as large, at random)
        { let mx = -1; for (let q = 0; q < blocks; q++) if (bmax[q] > mx) mx = bmax[q]; const big = []; for (let q = 0; q < blocks; q++) if (bmax[q] >= mx * (useGen ? 0.94 : 0.8)) big.push(q); if (mx >= MINR) k = barg[big[Math.floor(r() * big.length)]]; }
        if (k < 0) {   // few spots left: take the roomiest
          let mx = -1, b = 0; for (let q = 0; q < blocks; q++) if (bmax[q] > mx) { mx = bmax[q]; b = q; }
          if (mx < MINR) break; k = barg[b];
        }
        // toward the inner edge, things may be bigger and small gaps are mostly left empty, so the
        // edge takes its shape from big pieces: bulges where they land, bays between them
        let cy = y0 + Math.floor(k / cols) * G, cx = left + (k % cols) * G;
        const edgeNear = Math.max(0, 1 - (inward > 0 ? left + band - cx : cx - left) / (band * 0.45));   // 1 at the inner edge .. 0 by mid-band
        const hole = Math.min(dist[k], MAXR * (1 + 0.35 * edgeNear));
        if (!dense && edgeNear > 0 && hole < GLYPH * 1.6 && r() < 0.85 * edgeNear) { obstacle(cx, cy, dist[k] + 0.5); continue; }
        if (sparse && hole < GLYPH * 1.6) { obstacle(cx, cy, dist[k] + 0.5); continue; }   // sparse: no small fill
        if ((hole > GLYPH * 1.2 && (hole < GLYPH * 3.2 || empty >= 0.5) || empty >= 0.9) && r() < empty) { obstacle(cx, cy, empty >= 0.9 ? dist[k] : Math.min(MAXEMPTY, hole * (0.4 + 0.6 * r()))); continue; }
        // library pieces whose box fits here, largest first with some chance, least used favoured
        let got = null;
        const cand = pool.filter(pc => pc.R <= dist[k]).map(pc => ({ pc, sc: pc.area * (0.35 + 1.3 * r()) / (1 + 1.6 * (uses.get(pc.key) || 0)) })).sort((a, b) => b.sc - a.sc).map(c => c.pc).slice(0, 10);
        const genR = useGen && hole >= GLYPH * 1.7 ? hole : 0;   // no tiny shapes: small holes get a glyph or stay empty
        for (let q = 0; q < cand.length && !got; q++) {
          const pc = cand[q];
          if (genR) break;   // a made-to-measure shape (a flower, snowflake or starburst) fills any hole it can
          for (let t = 0; t < 6 && !got; t++) {
            const px = t < 5 ? cx + (r() - 0.5) * 2 * Math.max(0, dist[k] - pc.hw) : cx, py = t < 5 ? cy + (r() - 0.5) * 2 * Math.max(0, dist[k] - pc.hh) : cy;
            if (fitsAt(pc, px, py)) got = { pc, px, py };
          }
        }
        if (got) {
          uses.set(got.pc.key, (uses.get(got.pc.key) || 0) + 1);
          const pid0 = drawAt(got.pc, got.px, got.py);
          shapes.set(pid0, { Rp: Math.max(GLYPH * 1.3, Math.min(got.pc.hw, got.pc.hh) - PAD), cx: got.px, cy: got.py, gen: GEN, draw: drawItems });
          obstacle(got.px, got.py, 0, got.pc.hw, got.pc.hh); misses = 0;
          placed.push({ x: got.px, y: got.py, R: Math.max(got.pc.hw, got.pc.hh), hw: got.pc.hw, hh: got.pc.hh });
        } else if (genR && genR < GLYPH * 2.4) {   // the gasket's smallest circles: one large glyph each
          const GG = doc.defaultView.GlyphGen, pool1 = GG ? GG.SYM.fleuron.concat(GG.SYM.hub, GG.SYM.common) : fillers;
          place(L, span(doc, pick(r, pool1), o, r, S1 * GSIZE), cx, cy); obstacle(cx, cy, GLYPH * GSIZE * 0.6 + PAD); misses = 0;   // (one size, as the structures' glyphs)
        } else if (genR) {
          // (organic: not every structure fills its hole: drawn smaller by varying amounts, and set off-centre within it)
          let Rp = genR * (genR > GLYPH * 4 ? 0.6 + 0.4 * r() : 1), g = pickGen();
          if (Rp < genR) { const a0 = r() * 6.283, sl = (genR - Rp) * r(); cx += Math.cos(a0) * sl; cy += Math.sin(a0) * sl; }
          // a big one near the inner edge may grow past it (only big ones)
          if (Rp >= BIG * 0.9 && r() < 0.6) {
            const nearIn = inward > 0 ? left + band - cx : cx - left;
            if (nearIn < Rp + GLYPH) { const Rb = Math.min(MAXR * 1.1, Rp + OV * 0.8), sh = inward * (Rb - Rp); if (fitsAt({ hw: Rb + PAD, hh: Rb + PAD }, cx + sh, cy, OV)) { Rp = Rb; cx += sh; } }
          }
          const its = GEN[g](Rp), reach = Math.min(Rp, reachOf(its)); drawItems(its, cx, cy, null, reach); obstacle(cx, cy, reach + PAD + BUF(Rp)); misses = 0;
          placed.push({ x: cx, y: cy, R: reach + PAD });
        } else if (dist[k] >= GLYPH * 0.6 * GSIZE && fillers.length && (dense || r() < 0.7)) {   // stray glyphs (often a fleuron) in the gaps
          const GG1 = doc.defaultView.GlyphGen;
          place(L, span(doc, GG1 && r() < 0.5 ? pick(r, GG1.SYM.fleuron) : pick(r, fillers), o, r, S1 * GSIZE), cx, cy);
          obstacle(cx, cy, GLYPH * 0.55 + PAD); misses = 0;
          if (r() < 0.35) placed.push({ x: cx, y: cy, R: GLYPH * 0.55 + PAD });
        } else { obstacle(cx, cy, dist[k] + 0.5); misses++; }
      }
    } else if (o.margins === "compose") {
      // A composed pattern (theme/ornament.js): structures from o.compose(key), packed down the band
      // organically: each at a slightly varied size, dropped where the skyline of what's already
      // placed is lowest among a few random spots across the band, with uneven gaps, so pieces
      // stagger and nestle beside each other, close but never touching.
      const MINPX = 10, small = d => Math.min(...d.items.filter(it => !it.seg).map(it => it.s || 1));
      const NB = 12, left = side.x - band * 0.47, bw = band * 0.94 / NB, sky = new Array(NB).fill(y0 + base * 0.4);
      const boxes = [], pad = base * 0.22;
      let n = 0;
      while (Math.min(...sky) < y1 - base * 2 && n < 60 + (y1 - y0) / base * 2) {   // (a guard, scaled to the page)
        // every glyph at one size (GLYPH px, whatever the piece); a piece too wide for the band at
        // that size is passed over for another draw
        const GLYPH = 13, med = d => { const ss = d.items.filter(it => !it.seg).map(it => it.s || 1).sort((a, b) => a - b); return ss[Math.floor(ss.length / 2)] || 1; };
        let d = null, fit = 1, ok = false;
        for (let t = 0; t < 8 && !ok; t++) {
          d = o.compose(side.key + "|" + n + (t ? "|" + t : ""));
          if (!d || !d.items.length) break;
          fit = GLYPH / (base * med(d));
          ok = d.w * base * fit <= band * 0.94;
        }
        if (!d || !d.items.length) break;
        if (!ok) { n++; continue; }
        const sw = d.w * base * fit, sh = d.h * base * fit, span_ = Math.max(1, Math.min(NB, Math.ceil((sw + pad) / bw)));
        // a few candidate columns; take the lowest landing spot (with a little randomness)
        let best = null;
        for (let c = 0; c < 6; c++) {
          const b0 = Math.floor(r() * (NB - span_ + 1));
          const top = Math.max(...sky.slice(b0, b0 + span_)) + pad + r() * base * 0.5;
          if (!best || top + r() * base * 0.6 < best.top) best = { b0, top };
        }
        n++;
        if (best.top + sh > y1) { for (let b = best.b0; b < best.b0 + span_; b++) sky[b] = y1; continue; }
        const slack = span_ * bw - sw;
        const cx = left + best.b0 * bw + Math.max(0, slack) * r() + sw / 2, cy = best.top + sh / 2;
        for (let b = best.b0; b < best.b0 + span_; b++) sky[b] = best.top + sh;
        boxes.push([cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2]);
        const fx = r() < 0.5 ? -1 : 1;                   // half the pieces are laid out mirrored (the glyphs themselves stay as they are)
        for (const it0 of d.items) {
          const it = fx > 0 ? it0 : Object.assign({}, it0, { x: -it0.x, dx: it0.seg ? -it0.dx : it0.dx, rot: it0.rot ? -it0.rot : it0.rot, reflect: it0.reflect });
          if (it.seg) {                                      // a line (constellation links, quilt frames)
            const e = doc.createElement("span"), len = Math.hypot(it.dx, it.dy) * base * fit;
            e.style.cssText = "position:absolute;height:0;border-top:1px " + (it.dash ? "dotted" : "solid") + " " + (it.col || RULE(o)) + ";opacity:.55;transform-origin:0 0;pointer-events:none;width:" + len.toFixed(1) + "px;rotate:" + (Math.atan2(it.dy, it.dx) * 180 / Math.PI).toFixed(1) + "deg";
            const x = cx + it.x * base * fit, y2 = cy + it.y * base * fit, i2 = Math.max(0, Math.floor(y2 / CHUNK));
            e.style.left = x.toFixed(1) + "px"; e.style.top = (y2 - i2 * CHUNK + PAD).toFixed(1) + "px";
            chunkBand(L, i2).appendChild(e);
            continue;
          }
          const e = span(doc, it.tok, o, r, (it.s || 1) * fit, it.col ? { color: it.col } : null);
          if (it.rot) e.style.rotate = it.rot.toFixed(1) + "deg";
          if (it.bold) e.style.fontWeight = "700";
          if (it.reflect) {                               // mirrored inside, so sway/magnify keep the outer transform
            const inner = doc.createElement("span");
            inner.textContent = e.textContent; inner.style.cssText = "display:inline-block;transform:scaleX(-1)";
            e.textContent = ""; e.appendChild(inner);
          }
          place(L, e, cx + it.x * base * fit, cy + it.y * base * fit);
        }
      }
      // fillers in the gaps: small blooms, leaves and dots, clear of every structure
      const clear = (x, y, m) => !boxes.some(b => x > b[0] - m && x < b[2] + m && y > b[1] - m && y < b[3] + m);
      for (let k = 0; k < (y1 - y0) / base * 2.4 * o.density; k++) {
        const fy = y0 + r() * (y1 - y0), fx = side.x + (r() - 0.5) * band * 0.92, rad = base * 0.36;
        if (!clear(fx, fy, rad) || !free(fx, fy, rad)) continue;
        occ.push({ x: fx, y: fy, r: rad });
        const bag = r() < 0.35 ? R.bloom : r() < 0.6 ? R.leaf : R.filler;
        const e = span(doc, pick(r, bag), o, r, 0.5 + 0.25 * r());
        if (bag === R.leaf) e.style.rotate = Math.floor(r() * 360) + "deg";
        place(L, e, fx, fy);
      }
    } else if (o.margins === "lattice") {
      // A diamond lattice frieze between two rules: corner glyphs, centre glyphs, and mirrored pairs
      // on the diagonals. The geometry is regular; the glyph in each cell is seeded, so it never repeats.
      const w = Math.min(band * 0.8, base * 4), h = w, x0 = side.x;
      for (const off of [-w / 2 - base * 0.5, w / 2 + base * 0.5]) {
        const rule = doc.createElement("div");
        rule.style.cssText = "position:absolute;width:1px;background:" + RULE(o) + ";opacity:.5";
        rule.style.left = (x0 + off) + "px"; rule.style.top = y0 + "px"; rule.style.height = (y1 - y0) + "px";
        L.appendChild(rule);
      }
      let y = y0 + h / 2, cell = 0;
      const leaf = pick(r, R.leaf);
      while (y < y1) {
        const g = depthGain(o, y, H), big = cell % 2 === 0;
        place(L, span(doc, big ? pick(r, R.bloom) : pick(r, R.petal), o, r, big ? 1.25 : 0.9), x0, y);
        for (const sgn of [-1, 1]) {                  // diagonal leaves, mirrored across the axis
          const tok = sgn < 0 ? leaf : partner(leaf);
          const e = span(doc, tok, o, r, 0.75); e.style.rotate = (sgn * 45) + "deg";
          place(L, e, x0 + sgn * w * 0.25, y - h * 0.25);
          const e2 = span(doc, tok, o, r, 0.75); e2.style.rotate = (sgn * -45) + "deg";
          place(L, e2, x0 + sgn * w * 0.25, y + h * 0.25);
          place(L, span(doc, pick(r, R.filler.filter(t => Array.from(t).length === 1).concat(["·"])), o, r, 0.6), x0 + sgn * w * 0.5, y);
          if (g > 1.5 && r() < (g - 1) / 3) place(L, span(doc, pick(r, R.petal), o, r, 0.7), x0 + sgn * w * 0.5, y - h * 0.5);
        }
        y += h; cell++;
      }
    }
  }

  // ---------------------------------------------------------------- headpiece
  function row(doc, o, r, half, centre, size) {
    const d = doc.createElement("div");
    d.style.cssText = "display:flex;justify-content:center;align-items:center;gap:.32em;font-size:" + size + "em";
    for (const t of half.slice().reverse()) d.appendChild(span(doc, t, o, r, 1));
    if (centre) d.appendChild(span(doc, centre, o, r, 1.4));
    for (const t of half) d.appendChild(span(doc, partner(t), o, r, 1));
    return d;
  }
  // An ornate band, like a printer's headpiece made of flowers: an Oxford rule (thick over thin)
  // on each side ending in a lozenge, a long symmetric run of glyphs tapering outward from a
  // central bloom, all on one line so it stays short. `tail` flips the rules (thin over thick) for
  // the foot of the page.
  function ornate(doc, o, r, tail) {
    if (tail && o.tailBand) { const band = o.tailBand(doc); if (band) return band; }   // the home page's own foot band
    if (o.ruleBand) { const band = o.ruleBand(doc, tail); if (band) return band; }      // the site's own rules (folio.js)
    const R0 = roles(o, r), toks = tokens(o).filter(t => Array.from(t).length === 1);
    const one = xs => { const ys = xs.filter(t => Array.from(t).length === 1); return ys.length ? ys : toks.length ? toks : ["✦"]; };
    const R = {}; for (const k in R0) R[k] = one(R0[k]);
    const bead = pick(r, [" ✦ · ", " ◆ · ", " ❀ · ", " ✧ ∙ ", " • ◦ "]);
    const wrap = doc.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:.18em";
    const colourOf = t => colour(o, t, r);
    const rule = side => {
      const box = doc.createElement("span");
      box.style.cssText = "flex:1;display:flex;align-items:center;gap:.3em;min-width:1.5em;flex-direction:" + (side < 0 ? "row" : "row-reverse");
      const cap = span(doc, "◆", o, r, 0.55); cap.style.color = RULE(o);
      // a beaded rule: a chain of tiny glyphs running between a thick and a thin line
      const lines = doc.createElement("span");
      const c = RULE(o), thick = tail ? "bottom" : "top", thin = tail ? "top" : "bottom";
      // the rule is drawn like the boxes' border (--box-rule: double, heavy or solid with the box style)
      lines.style.cssText = "flex:1;min-width:0;height:0;border-top:var(--box-rule, 6px double " + c + ")";
      const dot = span(doc, pick(r, ["·", "∙", "⋅"]), o, r, 0.9); dot.style.color = c;
      box.append(lines);   // plain, like the boxes' border (no lozenge or bead)
      return box;
    };
    // the main run, from the centre outward: a pattern of roles so it reads as a garland, not noise
    const PATTERN = ["petal", "leaf", "bud", "filler", "petal", "leaf", "stem", "bloom", "filler", "leaf", "petal"];
    const n = 8 + Math.floor(r() * 4), run = [];
    for (let k = 0; k < n; k++) { const role = PATTERN[k % PATTERN.length]; run.push(pick(r, R[role] && R[role].length ? R[role] : toks)); }
    const main = doc.createElement("div");
    main.style.cssText = "display:flex;align-items:center;gap:.26em;width:100%";
    const side = sgn => {
      const d = doc.createElement("span");
      d.style.cssText = "display:flex;align-items:center;gap:.26em";
      const seq = run.map((t, k) => ({ t: sgn < 0 ? t : partner(t), k }));
      if (sgn < 0) seq.reverse();
      for (const { t, k } of seq) d.appendChild(span(doc, t, o, r, Math.max(0.62, 1.18 - k * 0.06)));
      return d;
    };
    // the centre: a structure from the ornament grammar when configured (o.headCentre), else the
    // garland of glyphs from the bags
    const made = o.headCentre ? o.headCentre(tail) : null;
    if (made && made.items.length) {
      const px = 1.35 * 16 * o.size, d = made, k = Math.min(1, 2.6 / Math.max(d.h, 0.5));
      const box2 = doc.createElement("span");
      box2.style.cssText = "position:relative;display:inline-block;flex:none;margin:0 .4em;width:" + (d.w * px * k).toFixed(1) + "px;height:" + (d.h * px * k).toFixed(1) + "px";
      for (const it of d.items) {
        if (it.seg) continue;
        const e = span(doc, it.tok, o, r, (it.s || 1) * k, it.col ? { color: it.col } : null);
        e.style.position = "absolute"; e.style.left = ((d.w / 2 + it.x) * px * k).toFixed(1) + "px"; e.style.top = ((d.h / 2 + it.y) * px * k).toFixed(1) + "px";
        e.style.translate = "-50% -50%"; if (it.rot) e.style.rotate = it.rot + "deg";
        box2.appendChild(e);
      }
      main.append(rule(-1), box2, rule(1));
    } else {
      const centre = span(doc, pick(r, R.bloom), o, r, 1.45);
      main.append(rule(-1), side(-1), centre, side(1), rule(1));
    }
    wrap.appendChild(main);
    return wrap;
  }

  function headpiece(doc, o, tail) {
    const r = rng(o.seed + (tail ? "|tail" : "|head")), toks = tokens(o);
    const box = layer(doc, tail ? "glyph-tailpiece" : "glyph-headpiece", "text-align:center;margin:" + (tail ? "2.2rem auto 0" : "1rem auto 1.3rem") + ";line-height:1.2;font-size:" + (1.35 * o.size) + "rem");
    if (o.headpiece === "ornate") { box.appendChild(ornate(doc, o, r, tail)); return box; }
    const centre = pick(r, toks);
    const half = n => Array.from({ length: n }, () => pick(r, toks));
    if (o.headpiece === "wreath") {
      // glyphs on an arch around a centre glyph: leaves mirrored left/right, a bloom at the top
      // positions in px: an em offset on a glyph would scale with that glyph's own size
      const R = roles(o, r), px = 1.35 * 16 * o.size, W = 11 * px, Hh = 4.2 * px;
      const wrap = doc.createElement("div");
      wrap.style.cssText = "position:relative;height:" + (Hh + px) + "px;width:" + W + "px;margin:0 auto";
      const put = (tok, x, y, size, rot) => { const e = span(doc, tok, o, r, size); e.style.position = "absolute"; e.style.left = x + "px"; e.style.top = y + "px"; e.style.translate = "-50% -50%"; if (rot) e.style.rotate = rot + "deg"; wrap.appendChild(e); };
      put(pick(r, R.bloom), W / 2, Hh * 0.62, 1.7);
      const leaf = pick(r, R.leaf), petal = pick(r, R.petal), n = 7;
      for (let k = 0; k <= n; k++) {
        const t = k / n, a = Math.PI * (1 - t), x = W / 2 + Math.cos(a) * W * 0.42, y = Hh * 0.95 - Math.sin(a) * Hh * 0.8;
        const left = x < W / 2 - 0.1, tok = k % 2 ? petal : (left ? leaf : partner(leaf));
        put(tok, x, y, k % 2 ? 0.8 : 1, 90 - a * 180 / Math.PI);
      }
      box.appendChild(wrap);
    } else if (o.headpiece === "pyramid") {
      const h = half(4);
      box.appendChild(row(doc, o, r, h, centre, 1));
      box.appendChild(row(doc, o, r, h.slice(0, 2), pick(r, toks), 0.8));
      box.appendChild(row(doc, o, r, [], pick(r, toks), 0.65));
    } else if (o.headpiece === "row") {
      box.appendChild(row(doc, o, r, half(6), centre, 1));
    } else {
      const d = doc.createElement("div");
      d.style.cssText = "display:flex;align-items:center;gap:.5em";
      const line = () => { const l = doc.createElement("span"); l.style.cssText = "flex:1;height:1px;background:" + RULE(o) + ";opacity:.7"; return l; };
      d.appendChild(line()); d.appendChild(row(doc, o, r, half(3 + Math.floor(r() * 2)), centre, 1)); d.appendChild(line());
      box.appendChild(d);
    }
    return box;
  }

  // ---------------------------------------------------------------- the sea
  // Past the end of the content: a full-width region whose glyphs go from sparse to
  // completely packed (and slightly larger), so scrolling down wades into a sea.
  function sea(doc, o) {
    const vh = doc.defaultView.innerHeight, W = doc.documentElement.clientWidth;
    const S = layer(doc, "glyph-sea", "position:relative;width:" + W + "px;overflow:hidden;" +
      "left:50%;transform:translateX(-50%);margin-top:" + Math.round(vh * o.seaGap) + "px;" +
      "opacity:0;transition:opacity 1.6s ease");
    // run to the very bottom: eat the body's bottom padding
    const padB = parseFloat(doc.defaultView.getComputedStyle(doc.body).paddingBottom) || 0;
    S.style.marginBottom = -padB + "px";
    const r = rng(o.seed + "|sea"), toks = tokens(o), base = 22 * o.size;
    S.style.fontSize = base + "px";
    // Ramp from sparse to packed over `seaDepth` screens, then one more full screen that is
    // completely covered (tight cells, overlapping, larger glyphs), so the last scroll position
    // shows nothing but the sea.
    const ramp = Math.round(vh * o.seaDepth);
    S.style.height = (ramp + vh) + "px";
    const rowH = base * 1.0;
    for (let y = rowH / 2, i = 0; y < ramp + vh + rowH; y += rowH, i++) {
      const t = Math.min(1, y / ramp);
      const fill = y > ramp ? 1 : 0.03 + 0.97 * Math.pow(t, 1.8);
      const grow = 0.8 + 0.6 * t;
      const cell = base * (1.25 - 0.45 * t);
      const shift = (i % 2) * cell / 2;
      for (let x = shift - cell; x < W + cell; x += cell) {
        if (r() > fill) continue;
        const sz = grow * (0.85 + 0.45 * r());
        const e = span(doc, pick(r, toks), o, r, sz);
        if (t >= 1 && r() < 0.25) e.style.rotate = (r() * 60 - 30) + "deg";
        place(S, e, x + (r() - 0.5) * cell * 0.35, y + (r() - 0.5) * rowH * 0.35);
      }
    }
    // the surprise: fade in once it scrolls into view
    const IO = doc.defaultView.IntersectionObserver;
    if (IO) { const ob = new IO(es => { if (es.some(e => e.isIntersecting)) { S.style.opacity = "1"; ob.disconnect(); } }, { threshold: 0.02 }); ob.observe(S); }
    else S.style.opacity = "1";
    return S;
  }

  // ---------------------------------------------------------------- init
  function options(doc, opts) {
    const o = Object.assign({ alphabet: "", margins: "chain", headpiece: "pyramid", palette: "theme", density: 1, size: 1,
      sea: false, seaDepth: 1.2, seaGap: 0.75, hint: false, live: true, ramp: 0.35, peak: 4, decor: 0.3, seed: doc.defaultView.location.pathname }, opts || {});
    o.visit = o.visit || (o.live ? String(Date.now()) : o.seed + "|live");   // (given: a precomputed visit, see precompute)
    o.liveRng = rng(o.visit);
    return o;
  }
  // The first screens a build draws reach down to H0 (the rest follows in idle-time chunks);
  // `firstH` fixes it, so a precomputed visit and its live build draw the same thing.
  const firstReach = (doc, o, HM) => Math.min(HM, o.firstH || Math.max(2400, doc.defaultView.scrollY + doc.defaultView.innerHeight * 2.5));
  const reachOfMargins = (doc, o) => {
    const H = doc.documentElement.scrollHeight;
    return o.sea ? H - Math.round(doc.defaultView.innerHeight * (o.seaDepth + o.seaGap + 1)) : H;
  };

  // Precompute a visit: the headpiece and the margins' first screens as a build would draw them for
  // `opts.visit` (with the same `firstH`), detached from the page, as HTML. folio-early.js puts them
  // in the page before its first paint; the live build (given the same visit) draws the same
  // glyphs and takes their place (see margins and build), so they are there with the text.
  function precompute(opts) {
    const doc = (opts && opts.document) || document;
    const o = options(doc, opts);
    if (o.sea || !o.margins || o.margins === "off") return null;
    const out = {};
    const hd = doc.querySelector(".helia-article > .helia-header");
    if (o.headpiece && o.headpiece !== "off" && hd && doc.querySelector(".helia-page")) {
      const h = headpiece(doc, o); h.setAttribute("data-folio-snap", ""); out.head = h.outerHTML;
    }
    const HM = reachOfMargins(doc, o), H0 = firstReach(doc, o, HM);
    const L = layer(doc, "glyph-margins", "position:absolute;left:0;top:0;width:100%;z-index:0");
    margins(doc, o, H0, null, L, HM);
    if (L._none) return null;
    L.style.height = HM + "px";
    stowaways(doc, o, L);
    // only the bands around where the reader will be are kept (the live build still draws, and
    // the snapshot's glyphs match, everything from the top)
    // (and the top screen: before restoring a scroll position the browser may paint the top)
    if (o.keepFrom != null) (L._bands || []).forEach((b, i) => {
      const top = i * CHUNK - PAD, bottom = (i + 1) * CHUNK + PAD;
      const near = top <= o.keepTo && bottom >= o.keepFrom, first = top <= doc.defaultView.innerHeight;
      if (b && !near && !first) b.remove();
    });
    L.setAttribute("data-folio-snap", "");
    out.margins = L.outerHTML;
    out.fullH = HM;
    return out;
  }

  function init(opts) {
    const doc = (opts && opts.document) || document;
    const o = options(doc, opts);
    const made = [];
    let dead = false, Lm = null, genH = 0;
    let tw = null, buildGen = 0, firstBuilt = false;
    function build() {
      if (dead) return;                               // a late font/resize rebuild after destroy()
      tw = null;
      INK.clear();                                    // metrics measured before the fonts loaded are stale
      made.splice(0).forEach(e => e.remove());
      if (o.headpiece && o.headpiece !== "off") {
        const pg = doc.querySelector(".helia-page");
        // on a note it closes the title block (the byline sits on it), in room the block reserves
        // (folio.css), so nothing moves when it is drawn; elsewhere it heads the page
        const hd = doc.querySelector(".helia-article > .helia-header");
        if (pg) {
          const h = headpiece(doc, o), snap = doc.querySelector(".glyph-headpiece[data-folio-snap]");
          if (snap) snap.replaceWith(h); else if (hd) hd.appendChild(h); else pg.insertBefore(h, pg.firstChild);
          made.push(h);
        }
        if (o.tailpiece) {                             // the very end of the page, after backlinks etc.
          const t = headpiece(doc, o, true); pg.appendChild(t); made.push(t);
        }
      }
      if (o.sea) { const s = sea(doc, o); doc.body.appendChild(s); made.push(s); }
      let L = null;
      // the margins are drawn progressively: the first screens at once, the rest in small chunks
      // after, so a long page doesn't hold up loading
      // (a precomputed visit was drawn for the page as it was then: its first build takes that
      // page height, so it draws the same glyphs; follow() then fits the margins to the page now)
      const realHM = reachOfMargins(doc, o), HM = o.firstFullH || realHM, H0 = firstReach(doc, o, HM);
      if (o.firstFullH && HM !== realHM) setTimeout(() => follow(), 0);
      o.firstH = 0; o.firstFullH = 0;                 // (a precomputed visit holds for the first build only)
      if (o.margins && o.margins !== "off") { L = margins(doc, o, H0, null, null, HM); L.style.height = HM + "px"; made.push(L); }
      doc.querySelectorAll("[data-folio-snap]").forEach(e => e.remove());   // a snapshot nothing replaced
      Lm = L; genH = H0;
      // No room for margins (a narrow screen): none of the ornament shows — not the placed things,
      // not the rules at the top and foot, and (by the class) not the home wreath or its dividers.
      const none = !L || L._none;
      doc.documentElement.classList.toggle("glyph-no-margins", none);
      if (none) { made.filter(e => e !== L).forEach(e => e.remove()); if (o.onBuild) o.onBuild(); return; }
      stowaways(doc, o, L);
      // (the page as this first build measured it is what the next load's build will measure;
      // it can change right after, so a precompute of the next visit happens here)
      if (o.afterFirstBuild && !firstBuilt) { firstBuilt = true; o.afterFirstBuild(); }
      if (o.onBuild) o.onBuild();                     // e.g. to mark which glyphs animate
      const gen = ++buildGen;
      const more = () => {
        if (dead || gen !== buildGen || !Lm || genH >= HM - 10) return;
        const to = Math.min(HM, genH + 2200);
        margins(doc, o, to, genH - 40, Lm, HM); Lm.style.height = HM + "px"; genH = to;
        if (o.onBuild) o.onBuild();
        (doc.defaultView.requestIdleCallback || (f => setTimeout(f, 16)))(more);
      };
      if (L && genH < HM - 10) (doc.defaultView.requestIdleCallback || (f => setTimeout(f, 16)))(more);
    }
    // What the drawing depends on that web fonts can change: the column's box and the glyph
    // font's metrics. When the fonts finish loading the ornament is redrawn only if these moved
    // (with the fonts already cached, as on every page after the first, they have not).
    const fingerprint = () => {
      const c = column(doc);
      if (!inkCtx) inkCtx = doc.createElement("canvas").getContext("2d");
      inkCtx.font = "22px " + FONT;
      const m = inkCtx.measureText("❦❧✿⁂※⊗∀∃⟦⟧");
      return [c.left, c.right, c.top, m.width, m.actualBoundingBoxAscent, m.actualBoundingBoxDescent].map(v => Math.round(v * 10)).join(",");
    };
    let built = fingerprint();
    build();
    let t = null;
    // a change of width redraws everything (the margins' room changed); its own timer, so the
    // content-height follower below (triggered by the same reflow) can't cancel it
    let lastW = doc.documentElement.clientWidth;
    const onResize = () => { const w = doc.documentElement.clientWidth; if (w === lastW) return; lastW = w; clearTimeout(tw); clearTimeout(t); tw = setTimeout(() => { built = fingerprint(); build(); }, 150); };
    doc.defaultView.addEventListener("resize", onResize);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => setTimeout(() => {
      const now = fingerprint();
      if (now !== built) { built = now; build(); }
    }, 50));
    // Follow the content's height without redrawing what is already there: when the page
    // shrinks (a long query folded) the margins are clipped to it, and hidden, not removed; when
    // it grows, what was drawn before shows again, and only a stretch never drawn is generated.
    // A cat or the name left below the new end moves up into view.
    let ro = null, lastH = 0;
    const page = doc.querySelector(".helia-page") || doc.body;
    const contentH = () => {
      const w = doc.defaultView, b = page.getBoundingClientRect().bottom + w.scrollY;
      return Math.max(Math.ceil(b + (parseFloat(w.getComputedStyle(doc.body).paddingBottom) || 0)), w.innerHeight);
    };
    const follow = () => {
      if (dead) return;
      if (!Lm || o.sea) { build(); return; }
      const H = contentH();
      Lm.style.height = H + "px";
      if (H > genH + 10) { margins(doc, o, H, genH - 40, Lm); genH = H; }
      const g = Lm._geom, gone = e => e._y != null && e._y > H - 30;
      const need = { o: false, g: false, name: false, any: false };
      for (const e of Lm.querySelectorAll(".glyph-cat, .glyph-name, .glyph-stow")) if (gone(e)) {
        need[e.dataset.stow != null ? e.dataset.stow : e.dataset.cat || "name"] = true; need.any = e.dataset.stow != null || need.any; e.remove();
      }
      if (g && (need.o || need.g || need.name || need.any)) { const y1 = g.y1; g.y1 = H - 20; stowaways(doc, o, Lm, need); g.y1 = y1; }
      if (o.onBuild) o.onBuild();
    };
    if (doc.defaultView.ResizeObserver) {
      lastH = page.offsetHeight;
      ro = new doc.defaultView.ResizeObserver(() => {
        const h = page.offsetHeight;
        if (Math.abs(h - lastH) < 40) return;
        lastH = h; if (tw) return; clearTimeout(t); t = setTimeout(follow, 200);
      });
      ro.observe(page);
    }
    return { destroy() { dead = true; doc.documentElement.classList.remove("glyph-no-margins"); clearTimeout(t); clearTimeout(tw); if (ro) ro.disconnect(); doc.defaultView.removeEventListener("resize", onResize); made.splice(0).forEach(e => e.remove()); }, rebuild: build };
  }

  global.Glyphs = { init, partner, precompute };
})(typeof window !== "undefined" ? window : globalThis);

// ---------------------------------------------------------------------------
// Folio: the site's ornament, with the design lab's "Steven v2" settings.
// Motion is kept cheap on long pages: glyphs live in bands the browser skips
// off screen, only bands on screen animate (IntersectionObserver), only some
// glyphs move at all, and the pointer/scroll springs touch nearby glyphs only.
// A switch under the footer picks "moving", "still" or "off" (remembered per
// device; "still" by default when the system asks for reduced motion).
(function () {
  "use strict";
  var OPTS = {
    alphabet: "→ ∀ ∃ Σ Π × ⊕ ⊗ ⟦-⟧ ⊸ ⟜ よ ⊤ ⊥ λ β η",
    decor: 0.25, margins: "geometric", headpiece: "ornate", tailpiece: true,
    palette: "folk", density: 0.8, size: 0.95, sea: false, live: true,
  };
  var KEY = "folio-ornament", MODES = [["full", "moving"], ["still", "still"], ["off", "off"]];
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mode = "still";   // motion off unless a reader turns it on (">motion on")
  try { var saved = localStorage.getItem(KEY); if (saved === "full" || saved === "still" || saved === "off") mode = saved; } catch (e) {}
  // density of the margins: sparse, normal or dense (">density …")
  var density = "normal"; try { density = localStorage.getItem("folio-density") || "normal"; } catch (e) {}
  OPTS.densityLevel = density;

  var G = null, io = null, fx = null, sw = null;
  var hash = function (k) { return ((k * 2654435761) >>> 0) / 4294967296; };
  var BLOOM = /^[✿❀❁✾✽❃❋✻✼✺✹✸✷✶✵✴✳⁂⚘❖◈✦✧✥✤]$/;

  // The glyphs no longer sway or pulse on their own (continuous animation cost style work every
  // frame across thousands of glyphs); they only react to the pointer and to scrolling.
  function prep() {
    var els = document.querySelectorAll(".glyph-orn");
    for (var i = 0; i < els.length; i++) els[i].classList.remove("folio-sway", "folio-pulse");
    if (io) io.disconnect();
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (x) { x.target.classList.toggle("glyph-on", x.isIntersecting); });
      }, { rootMargin: "200px 0px" });
      document.querySelectorAll(".glyph-band, .glyph-headpiece, .glyph-tailpiece").forEach(function (b) { io.observe(b); });
    } else {
      document.querySelectorAll(".glyph-band, .glyph-headpiece, .glyph-tailpiece").forEach(function (b) { b.classList.add("glyph-on"); });
    }
    if (fx) fx.measure();
    placeSwitch();
  }

  // Pointer and scroll: glyphs near the pointer swell for a moment (magnify), and glyphs on
  // screen lag behind a scroll and spring back. Positions come from placement, not layout.
  function effects() {
    var R = 150, LAG = 0.075, LAGMAX = 26;
    var mx = -1e4, my = -1e4, raf = 0, items = [], vel = 0, lastY = scrollY, lastT = performance.now(), energy = 0, lastMove = 0;
    var live = new Set();
    function measure() {
      items = Array.prototype.map.call(document.querySelectorAll(".glyph-orn"), function (e, k) {
        var x = e._x, y = e._y;
        if (x == null) { var b = e.getBoundingClientRect(); x = b.left + b.width / 2 + scrollX; y = b.top + b.height / 2 + scrollY; if (!e.style.display) e.style.display = "inline-block"; }
        return { e: e, abs: e.style.position === "absolute", bx: e._bx, by: e._by, x: x, y: y, dx: 0, dy: 0, vx: 0, vy: 0, sc: 1, vs: 0,
          wt: 0.55 + hash(k) * 0.9, sw: (((k * 40503) >>> 0) % 200 - 100) / 100 };
      }).sort(function (a, b) { return a.y - b.y; });
      live.clear();
    }
    function lower(y) { var lo = 0, hi = items.length; while (lo < hi) { var m = (lo + hi) >> 1; if (items[m].y < y) lo = m + 1; else hi = m; } return lo; }
    function range(y0, y1, into) { for (var k = lower(y0); k < items.length && items[k].y <= y1; k++) into.add(items[k]); }
    function tick() {
      raf = 0; var moving = false;
      if (performance.now() - lastT > 80) vel *= 0.8;
      if (Math.abs(vel) < 0.01) vel = 0; else moving = true;
      var lag = Math.max(-LAGMAX, Math.min(LAGMAX, -vel * LAG * 1000 / 16));
      var idle = performance.now() - lastMove;
      energy = idle < 350 ? 1 : Math.max(0, energy * 0.9 - 0.004);
      if (energy > 0) moving = true;
      var work = new Set(live);
      if (mx > -1e4 && energy > 0) range(my - R, my + R, work);
      if (lag) range(scrollY - 60, scrollY + innerHeight + 60, work);
      work.forEach(function (it) {
        var tx = 0, ty = 0, ts = 1, dist = Math.hypot(it.x - mx, it.y - my);
        if (dist < R) ts = 1 + 0.9 * Math.pow(1 - dist / R, 2) * energy;
        if (lag) { ty += lag * it.wt; tx += lag * it.sw * 0.25; }
        it.vs = (it.vs + (ts - it.sc) * 0.16) * 0.72;
        it.vx = (it.vx + (tx - it.dx) * 0.09) * 0.82; it.vy = (it.vy + (ty - it.dy) * 0.09) * 0.82;
        var busy = false;
        if (Math.abs(it.vs) > 0.001 || Math.abs(ts - it.sc) > 0.002) { busy = true; it.sc += it.vs; it.e.style.scale = it.sc.toFixed(3); }
        if (Math.abs(it.vx) > 0.01 || Math.abs(it.vy) > 0.01 || Math.abs(tx - it.dx) > 0.05 || Math.abs(ty - it.dy) > 0.05) {
          busy = true; it.dx += it.vx; it.dy += it.vy;
          it.e.style.translate = it.bx != null ? (it.bx + it.dx).toFixed(2) + "px " + (it.by + it.dy).toFixed(2) + "px"
            : it.abs ? "calc(-50% + " + it.dx.toFixed(2) + "px) calc(-50% + " + it.dy.toFixed(2) + "px)" : it.dx.toFixed(2) + "px " + it.dy.toFixed(2) + "px";
        }
        if (busy) { moving = true; live.add(it); } else live.delete(it);
      });
      if (moving) raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    function onMove(ev) { mx = ev.clientX + scrollX; my = ev.clientY + scrollY; lastMove = performance.now(); kick(); }
    function onLeave() { mx = my = -1e4; kick(); }
    function onScroll() { var t = performance.now(), dt = Math.max(8, t - lastT); vel = vel * 0.6 + ((scrollY - lastY) / dt) * 0.4; lastY = scrollY; lastT = t; kick(); }
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    addEventListener("scroll", onScroll, { passive: true });
    measure();
    return {
      measure: measure,
      stop: function () {
        document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseleave", onLeave);
        removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf);
        items.forEach(function (it) { it.e.style.scale = ""; });
      },
    };
  }

  function placeSwitch() {}   // (the ornament switch moved into the ⚄ panel)

  function setMode(m) {
    mode = m;
    try { localStorage.setItem(KEY, m); } catch (e) {}
    apply();
  }

  function apply() {
    var root = document.documentElement;
    root.classList.toggle("folio-moving", mode === "full");
    root.classList.toggle("folio-plain", mode === "off");   // ornament off: the wreath and the dividers' shapes go too
    if (fx && mode !== "full") { fx.stop(); fx = null; }
    if (mode === "off") {
      if (G) { G.destroy(); G = null; }
      if (io) { io.disconnect(); io = null; }
      placeSwitch();
      return;
    }
    if (!G) {
      G = window.Glyphs.init(Object.assign({ onBuild: prep, visit: VISIT, firstH: SNAP ? SNAP.firstH : 0, firstFullH: SNAP ? SNAP.fullH : 0, afterFirstBuild: schedulePrecompute }, OPTS));
      SNAP = null;
    }
    if (mode === "full" && !fx && !reduced) { fx = effects(); }
    prep();
  }

  // Colour schemes and the ⚙ panel (for visitors): a gear beside Search opens a small panel to pick or shuffle
  // the colour scheme and to turn the ornament or its motion off (all remembered per device).
  var SCHEMES = [["folk", "Classic", ["#c2413b", "#4f7d3f", "#3f6fb3", "#b8860b", "#7d4f9e"]], ["verdant", "Forest", ["#2f6b3a", "#b8860b", "#8a3a2e", "#4f7fa0", "#7a4f86"]], ["celadon", "Sage", ["#2e6e5e", "#7a9a3a", "#b5654a", "#3f6f9a", "#c29a2e"]], ["moss", "Olive", ["#4d5a1f", "#a6802a", "#7a4a2a", "#3b5a4a", "#a5512e"]], ["lapis", "Royal blue", ["#1f3f95", "#b08a2e", "#a0302a", "#3f7a5a", "#6a3f8f"]], ["prussian", "Navy", ["#274b7a", "#b58a2e", "#9a4a6a", "#3f7a7a", "#b0603a"]], ["cyanotype", "Blueprint", ["#1d5c9c", "#1d5c9c", "#6f9ccc", "#10304f", "#5a8fc4"]], ["delft", "Blue and white", ["#1f4ea3", "#2f65c0", "#6b8fd1", "#1d2a4a", "#0f2f6f"]], ["gilt", "Crimson and gold", ["#8e1b1b", "#1d3f8f", "#b08a2e", "#2f5a33", "#5e3a7a"]], ["dala", "Rust", ["#b5452a", "#2f7a78", "#d19a2a", "#5b7a3a", "#2e5a9a"]], ["matyo", "Bright", ["#d6243e", "#1f7a4d", "#2458b8", "#f2a900", "#8e3fa8"]], ["vyshyvanka", "Red and black", ["#b3121f", "#1a1714", "#b3121f", "#6b645a", "#7a0f18"]], ["otomi", "Vivid", ["#d6127a", "#0a8f8f", "#ef6c1a", "#6a3fb5", "#3f9a2f"]], ["night-garden", "Lavender", ["#7a4fa3", "#b8547a", "#b89a3a", "#3f7a6f", "#3f5fa3"]], ["riso", "Pink and blue", ["#ff48b0", "#0078bf", "#ff48b0", "#0078bf", "#f2c200"]], ["sampler", "Linen", ["#b0635a", "#6f8a6a", "#6f7fa3", "#b58f5a", "#8a6a8f"]], ["cmyk", "CMYK", ["#e6007e", "#00a0e3", "#f5c400", "#111111", "#e5332a"]]];
  var PATTERNS = [["rosettes", "Rosettes"], ["vine", "Vine"], ["sampler", "Sampler"], ["frieze", "Frieze"], ["tree", "Tree of life"],
    ["lace", "Lace"], ["constellation", "Constellation"], ["interlace", "Interlace"], ["tiles", "Star tiles"], ["hats", "Hats"], ["aperiodic", "Aperiodic"]];
  var MASTHEADS = [["flanked", "Flanked"], ["fraktur", "Fraktur"], ["arch", "Arch"], ["wreath", "Wreath"], ["both", "Arch and wreath"]];
  var keys = function (xs) { return xs.map(function (x) { return x[0]; }); };
  // Small drawn previews of the patterns for the ⚙ panel (in the scheme's colours).
  var PREVIEW = (function () {
    var A = "var(--accent)", G = "var(--accent-2)", B = "var(--accent-3)", Y = "var(--accent-4)", R = "var(--rule)";
    var t = function (x, y, ch, c, sz, rot) { return '<text x="' + x + '" y="' + y + '" fill="' + c + '" font-size="' + (sz || 9) + '" text-anchor="middle" dominant-baseline="central"' + (rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : "") + ">" + ch + "</text>"; };
    var ln = function (d, c, w) { return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + (w || 1.2) + '" stroke-linecap="round"/>'; };
    var ring = function (n, r, ch, c, sz) { var o = ""; for (var i = 0; i < n; i++) { var a = i * 2 * Math.PI / n; o += t((22 + Math.cos(a) * r).toFixed(1), (22 + Math.sin(a) * r).toFixed(1), ch, c, sz, (a * 180 / Math.PI + 90).toFixed(0)); } return o; };
    var P = {
      rosettes: ring(8, 12, "λ", G, 8) + t(22, 22, "✿", A, 15),
      vine: ln("M22 3 C 12 12, 32 20, 22 29 S 14 38, 22 43", G, 1.6) + t(14, 11, "❧", G, 9) + t(30, 21, "☙", G, 9) + t(13, 33, "❧", G, 9) + t(29, 9, "✿", A, 10) + t(31, 36, "✿", B, 9),
      sampler: (function () { var m = [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."], o = ""; m.forEach(function (row, j) { Array.from(row).forEach(function (ch, i) { if (ch === "x") o += t(22 + (i - 3) * 5, 10 + j * 5, "×", A, 7.5); }); }); return o + t(22, 40, "⊕", B, 8); })(),
      frieze: (function () { var o = ""; for (var k = 0; k < 2; k++) { var y = 4 + k * 19; o += ln("M22 " + y + " L13 " + (y + 9.5) + " L22 " + (y + 19) + " L31 " + (y + 9.5) + " Z", R, 1.2) + t(22, y + 9.5, k ? "β" : "✿", k ? G : A, 9); } return o; })(),
      tree: ln("M22 4 V42", A, 1.5) + [8, 18, 28].map(function (y, i) { return ln("M22 " + (y + 6) + " Q 16 " + (y + 6) + " 11 " + y, A, 1.1) + ln("M22 " + (y + 6) + " Q 28 " + (y + 6) + " 33 " + y, A, 1.1) + t(10, y - 1, i === 1 ? "✿" : "❧", i === 1 ? Y : G, 8) + t(34, y - 1, i === 1 ? "✿" : "☙", i === 1 ? Y : G, 8); }).join(""),
      lace: (function () { var o = ""; for (var k = 0; k < 3; k++) { var y0 = 3 + k * 13; for (var i = 0; i <= 6; i++) { var f = i / 6; o += t((14 + 12 * Math.sin(f * Math.PI)).toFixed(1), (y0 + f * 13).toFixed(1), "·", "var(--muted)", 12); } o += t(31, y0 + 6.5, k % 2 ? "⊕" : "✿", k % 2 ? B : A, 8); } return ln("M11 2 V44", R, 0.8) + o; })(),
      constellation: ln("M10 9 L24 16 L17 30 L33 36", R, 0.8) + ln("M24 16 L34 8", R, 0.8) + t(10, 9, "✦", B, 8) + t(24, 16, "✦", Y, 10) + t(17, 30, "✧", A, 8) + t(33, 36, "✦", B, 9) + t(34, 8, "⋆", A, 9),
      interlace: ln("M14 2 C 34 12, 34 20, 22 23 S 10 34, 30 44", A, 1.6) + ln("M30 2 C 10 12, 10 20, 22 23 S 34 34, 14 44", B, 1.6) + t(22, 12, "·", R, 10) + t(22, 34, "✿", Y, 8),
      hats: (function () {   // one hat, stitched in glyphs, with a sliver of a neighbour
        var H = [[0, 0], [-1.5, -0.866], [-1, -1.732], [1, -1.732], [1.5, -0.866], [3, -1.732], [4.5, -0.866], [4, 0], [3, 0], [3, 1.732], [1.5, 2.598], [1, 1.732], [0, 1.732]];
        var P2 = H.map(function (p) { return [(p[0] + 1.5) * 6.2 + 3.4, (p[1] + 1.732) * 6.2 + 8.6]; });
        var inside = function (x, y) { var c = false; for (var i = 0, j = P2.length - 1; i < P2.length; j = i++) { var a = P2[i], b = P2[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
        var o = "";
        for (var row = 0, y = 2.5; y < 43; row++, y += 3.5) for (var x = 2 + (row % 2) * 2; x < 43; x += 4) o += inside(x, y) ? t(x, y, "⊕", B, 4.2) : (y > 30 && x < 20 ? t(x, y, "⊙", Y, 4.2) : "");
        return o;
      })(),
      tiles: ln("M22 3 L39 22 L22 41 L5 22 Z", R, 1) + ln("M22 13 L31 22 L22 31 L13 22 Z", R, 0.8) + t(22, 22, "✦", A, 12) + t(22, 6, "·", B, 8) + t(22, 38, "·", B, 8) + t(8, 22, "·", G, 8) + t(36, 22, "·", G, 8),
    };
    return function (k) { return '<svg class="folio-pattern-preview" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" font-family="\'Noto Sans Symbols 2\', \'Apple Symbols\', serif">' + (P[k] || "") + "</svg>"; };
  })();
  // what the ⚙ panel offers and ⚄ Randomise draws from, the masthead and boxes: the site's configuration
  var BOXES = [["double", "Double rule"], ["heavy", "Heavy double"], ["filled", "Filled"]];
  // The site's configuration (what visitors get). The private settings page (entries/settings.hel)
  // previews changes in one browser and prints a replacement for this object.
  var HYPHENS = [["free", "Free"], ["penalty", "Heavy penalty"], ["none", "None (ragged right)"]];
  // patterns: null means every disjunct of the library's `patterns`; place: the guaranteed placements
  var SITE = { schemes: keys(SCHEMES), patterns: null, masthead: "flanked", boxes: "double", hyphens: "penalty", place: true };
  var CKEY = "folio-config", config = JSON.parse(JSON.stringify(SITE));
  try { var cs = JSON.parse(localStorage.getItem(CKEY) || "null"); if (cs) for (var ck in cs) config[ck] = cs[ck]; } catch (e) {}
  function saveConfig() { try { localStorage.setItem(CKEY, JSON.stringify(config)); } catch (e) {} }
  var SKEY = "folio-scheme", scheme = "matyo", PKEY = "folio-pattern", pattern = OPTS.margins;
  try { var ss = localStorage.getItem(SKEY); if (ss && SCHEMES.some(function (x) { return x[0] === ss; })) scheme = ss; } catch (e) {}
  var storedPattern = null;   // may name a library pattern, known only once the library loads
  try { storedPattern = localStorage.getItem(PKEY); if (storedPattern && PATTERNS.some(function (x) { return x[0] === storedPattern; })) pattern = storedPattern; } catch (e) {}
  // A visit precomputed by an earlier load (folio-early.js has put its glyphs in the page): this
  // load draws that visit, so its glyphs take the snapshot's place unchanged (see precomputeNext).
  var SNAP = window.__folioSnap || null;
  var VISIT = (SNAP && SNAP.visit) || String(Date.now()), LIB = null, PICS = {};
  // the settings page's choice, limited to the patterns the library still offers (a saved list can
  // name patterns since deleted); patterns added since the list was saved are on by default
  var enabledPatterns = function () {
    var all = keys(PATTERNS);
    if (!config.patterns) return all;
    var seen = config.patternsSeen || config.patterns;
    return all.filter(function (k) { return config.patterns.indexOf(k) >= 0 || seen.indexOf(k) < 0; });
  };
  // a pattern name -> the engine's margin mode: built-in procedural patterns by name, anything
  // the library defines is composed (tiled down the margins)
  var ALIASES = { "cross-stitch": "sampler", "night-sky": "constellation" };   // plainer names for built-in patterns
  function modeOf(k) {
    if (LIB && LIB.defs[k]) return "compose";
    if (ALIASES[k]) return ALIASES[k];
    return k === "rosettes-classic" ? "rosettes" : k;
  }
  function usePattern(k) {
    OPTS.margins = modeOf(k);
    // the library's `generated` lists the patterns that also get made-to-measure shapes (rosettes,
    // stars, sunbursts, snowflakes, wheels) in the gasket layout; picture patterns keep to their pieces
    var gen = LIB && LIB.defs.generated ? window.Ornament.disjuncts(LIB, "generated").map(function (d) { return d.name; }) : null;
    OPTS.gasketShapes = !gen || gen.indexOf(k) >= 0;
    // `<pattern>-shapes` weights which made-to-measure shapes it draws (e.g. nested*4 | halo*3 | ...)
    // `<pattern>-first`: pieces planted before anything else, as many as fit (e.g. the tall flowers)
    // a pattern whose planted pieces are constellations gets them by name (see the gasket layout)
    var firstSrc = LIB && LIB.defs[k + "-first"] ? String(LIB.defs[k + "-first"].src || "") : "";
    var skySize = (/constellation\(any[^)]*size=([\d.]+)/.exec(firstSrc) || [])[1];
    OPTS.gasketFirstSky = /constellation\(any/.test(firstSrc) ? function (name, key) { return window.Ornament.realize(window.Ornament.parse("constellation(" + name + ", size=" + (skySize || 10) + ")"), { defs: LIB.defs, r: window.Ornament.rng(VISIT + "|sky|" + key), pictures: PICS }); } : null;
    OPTS.gasketFirst = LIB && LIB.defs[k + "-first"] ? function (key) { return window.Ornament.realize(LIB.defs[k + "-first"].e, { defs: LIB.defs, r: window.Ornament.rng(VISIT + "|first|" + k + "|" + key), pictures: PICS }); } : null;
    // `<pattern>-fill`: the single glyphs that fill small gaps; `<pattern>-empty`: share of holes left empty
    var realizeK = function (name, i) { return window.Ornament.realize(LIB.defs[name].e, { defs: LIB.defs, r: window.Ornament.rng(VISIT + "|" + name + "|" + i), pictures: PICS }); };
    OPTS.gasketFill = LIB && LIB.defs[k + "-fill"] ? (function () { var t = []; for (var i = 0; i < 24; i++) realizeK(k + "-fill", i).items.forEach(function (it) { if (it.tok && t.indexOf(it.tok) < 0) t.push(it.tok); }); return t; })() : null;
    OPTS.gasketEmpty = LIB && LIB.defs[k + "-empty"] ? parseFloat((realizeK(k + "-empty", 0).items[0] || {}).tok) : null;
    OPTS.gasketWeights = LIB && LIB.defs[k + "-shapes"] ? window.Ornament.disjuncts(LIB, k + "-shapes").filter(function (d) { return d.name; }).map(function (d) { return [d.name, d.w || 1]; }) : null;
    OPTS.compose = OPTS.margins === "compose" ? function (key) { return window.Ornament.realize(LIB.defs[k].e, { defs: LIB.defs, r: window.Ornament.rng(VISIT + "|" + k + "|" + key), pictures: PICS }); } : null;
  }
  OPTS.margins = pattern;
  var redrawMasthead = null;
  function applyBoxes() {
    document.documentElement.setAttribute("data-folio-box", config.boxes || "double");
    document.documentElement.setAttribute("data-folio-hyphens", config.hyphens || "penalty");
  }
  function setBoxes(k) { config.boxes = k; saveConfig(); applyBoxes(); syncPanel(); }
  applyBoxes();
  function applyScheme() {
    var root = document.documentElement;
    if (scheme === "folk") root.removeAttribute("data-folio-scheme"); else root.setAttribute("data-folio-scheme", scheme);
    FOLK = scheme === "folk" ? FOLK_HEX : FOLK_VARS;
    OPTS.palette = scheme === "folk" ? "folk" : "theme";
  }
  function redraw() {
    if (G) { G.destroy(); G = null; }
    apply();
    if (redrawMasthead) redrawMasthead();
    syncPanel();
  }
  function setScheme(k) { scheme = k; try { localStorage.setItem(SKEY, k); } catch (e) {} applyScheme(); redraw(); }
  function setPattern(k) { pattern = k; usePattern(k); applyPlace(); try { localStorage.setItem(PKEY, k); } catch (e) {} redraw(); }
  function shuffle() {
    VISIT = String(Date.now()) + "|" + Math.random();   // a fresh draw of everything: the wreath, the dividers, the rules
    var pick = function (xs, cur) { var o = xs.filter(function (x) { return x !== cur; }); return o.length ? o[Math.floor(Math.random() * o.length)] : cur; };
    scheme = pick(config.schemes.length ? config.schemes : ["folk"], scheme);
    var en = enabledPatterns().filter(function (x) { return x !== pattern; });
    if (en.length) {
      var wt = {}; if (LIB) window.Ornament.disjuncts(LIB, "patterns").forEach(function (d) { if (d.name) wt[d.name] = d.w; });
      var tot = en.reduce(function (a, x) { return a + (wt[x] || 1); }, 0), roll = Math.random() * tot;
      pattern = en[en.length - 1];
      for (var ei = 0; ei < en.length; ei++) { roll -= wt[en[ei]] || 1; if (roll < 0) { pattern = en[ei]; break; } }
    }
    usePattern(pattern); applyPlace();
    try { localStorage.setItem(SKEY, scheme); localStorage.setItem(PKEY, pattern); } catch (e) {}
    applyScheme(); redraw();
  }
  applyScheme();

  var pop = null;
  function syncPanel() {
    if (!pop) return;
    Array.prototype.forEach.call(pop.querySelectorAll("[data-scheme]"), function (b) { var k = b.getAttribute("data-scheme"); b.setAttribute("aria-pressed", k === scheme ? "true" : "false"); b.hidden = k !== scheme && config.schemes.indexOf(k) < 0; });
    Array.prototype.forEach.call(pop.querySelectorAll("[data-pattern]"), function (b) { var k = b.getAttribute("data-pattern"); b.setAttribute("aria-pressed", k === pattern ? "true" : "false"); b.hidden = k !== pattern && enabledPatterns().indexOf(k) < 0; });
    Array.prototype.forEach.call(pop.querySelectorAll("[data-box]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-box") === (config.boxes || "double") ? "true" : "false"); });
    Array.prototype.forEach.call(pop.querySelectorAll("[data-orn]"), function (b) { b.setAttribute("aria-pressed", (b.getAttribute("data-orn") === "on") === (mode !== "off") ? "true" : "false"); });
    Array.prototype.forEach.call(pop.querySelectorAll("[data-motion]"), function (b) { b.setAttribute("aria-pressed", (b.getAttribute("data-motion") === "on") === (mode === "full") ? "true" : "false"); b.disabled = mode === "off"; });
  }
  function panel() {
    if (pop) return pop;
    pop = document.createElement("div");
    pop.className = "folio-pop"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Page settings");
    var row = function (label) { var r = document.createElement("div"); r.className = "folio-pop-row"; if (label) { var l = document.createElement("span"); l.className = "folio-pop-label"; l.textContent = label; r.appendChild(l); } pop.appendChild(r); return r; };
    var btn = function (parent, text, attr, val, fn) { var b = document.createElement("button"); b.type = "button"; b.textContent = text; if (attr) b.setAttribute(attr, val); b.addEventListener("click", fn); parent.appendChild(b); return b; };
    var r1 = row(null), chips = document.createElement("div"); chips.className = "folio-chips"; r1.appendChild(chips);
    SCHEMES.forEach(function (sc) {
      var b = btn(chips, "", "data-scheme", sc[0], function () { setScheme(sc[0]); });
      b.className = "folio-chip"; b.title = sc[1]; b.setAttribute("aria-label", sc[1]);
      var sw = document.createElement("span"); sw.className = "folio-sw";
      sc[2].forEach(function (c) { var i = document.createElement("i"); i.style.background = c; sw.appendChild(i); });
      b.appendChild(sw);   // the palette alone
    });
    var rp = row(null), pchips = document.createElement("div"); pchips.className = "folio-chips folio-pattern-chips"; rp.appendChild(pchips);
    PATTERNS.forEach(function (pt) {
      var b = btn(pchips, "", "data-pattern", pt[0], function () { setPattern(pt[0]); });
      b.className = "folio-pattern-chip"; b.title = pt[1]; b.setAttribute("aria-label", pt[1]);
      if (LIB && LIB.defs[pt[0]]) {
        var d = window.Ornament.realize(LIB.defs[LIB.defs[pt[0] + "-preview"] ? pt[0] + "-preview" : pt[0]].e, { defs: LIB.defs, r: window.Ornament.rng("preview|" + pt[0]), pictures: PICS });
        // the whole drawing when it fits at a readable size, else a detail from its middle; kept inside the chip
        var holder = document.createElement("span"); holder.className = "folio-pattern-preview";
        var box = document.createElement("span"); box.style.display = "block"; box.style.flex = "none";
        var picture = d.items.some(function (it) { return it.col; });
        window.Ornament.renderInto(document, box, d, Math.max(6, Math.min(18, 38 / Math.max(d.w, d.h, 1))), picture ? {} : { colour: function () { return "var(--accent)"; } });
        box.style.margin = "auto"; holder.style.display = "flex"; holder.style.overflow = "hidden"; holder.style.alignItems = "center"; holder.style.justifyContent = "center";
        holder.appendChild(box); b.appendChild(holder);
      } else b.innerHTML = PREVIEW(modeOf(pt[0]));
    });
    var sh = btn(pop, "⚄ Randomise", null, null, shuffle);
    sh.className = "folio-shuffle";
    var r2 = row("Ornament");
    btn(r2, "On", "data-orn", "on", function () { setMode(mode === "off" ? (reduced ? "still" : "full") : mode); syncPanel(); });
    btn(r2, "Off", "data-orn", "off", function () { setMode("off"); syncPanel(); });
    var r3 = row("Motion");
    btn(r3, "On", "data-motion", "on", function () { if (mode !== "off") { setMode("full"); syncPanel(); } });
    btn(r3, "Off", "data-motion", "off", function () { if (mode !== "off") { setMode("still"); syncPanel(); } });
    document.body.appendChild(pop);
    document.addEventListener("click", function (ev) { if (!pop.hidden && !pop.contains(ev.target) && !ev.target.closest(".folio-dice")) pop.hidden = true; });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") pop.hidden = true; });
    return pop;
  }
  function openPanel(anchor) {
    var p = panel();
    if (!p.hidden) { p.hidden = true; return; }
    syncPanel(); p.hidden = false;
    // phones: a sheet along the bottom (CSS); wider screens: under the gear, kept on screen
    if (matchMedia("(max-width: 760px)").matches) { p.style.top = p.style.left = ""; return; }
    var r = anchor.getBoundingClientRect(), vw = document.documentElement.clientWidth, w = p.offsetWidth, h = p.offsetHeight;
    var top = r.bottom + 8; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
    p.style.top = Math.round(top) + "px";
    p.style.left = Math.round(Math.max(12, Math.min(vw - w - 12, r.right - w))) + "px";
  }
  function dice(cls) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "folio-dice" + (cls ? " " + cls : ""); b.innerHTML = '<span class="folio-gear-icon" aria-hidden="true"></span>';   // drawn like the search magnifier
    b.setAttribute("aria-label", "Page settings: colours, ornament, motion"); b.title = "Colours, ornament, motion";
    b.addEventListener("click", function (ev) { ev.stopPropagation(); openPanel(b); });
    return b;
  }
  // the settings gear lives after the footer, tucked to the side (not in the top bar)
  function placeDice() {
    return;   // (the settings are commands in the search palette now: type ">")
    if (document.querySelector(".folio-gear-foot")) return;
    var foot = document.createElement("div"); foot.className = "folio-gear-foot";
    foot.appendChild(dice("folio-dice-foot"));
    document.body.appendChild(foot);
  }

  // The home masthead's slots in the ornament library. Each is a grammar expression: a choice is
  // drawn afresh each visit, a list (`a, b, c`) is used in turn along a row (counted from the
  // centre, so both sides match), and picture(art-…) swaps in any glyph-art picture. These are
  // the defaults, for slots the library leaves undefined (see its comments).
  var MASTHEAD_SLOTS = {
    "masthead-crown": "tulip*4 | orbit(r=fit) | layered(r=fit) | crown-flower*6",   // (crown-flower: see the library)
    "masthead-shoulder": "bird*3 | doubled(r=fit) | rosette(r=fit)",
    "masthead-foot": "heart*3 | foot-motif*2 | rosette(r=fit) | sunburst(r=fit) | doubled(r=fit) | orbit(r=fit) | layered(r=fit) | alternating(r=fit)",
    "foot-motif": "picture(sampler-strawberry) | small-strawberry",
    "masthead-arch": "leaf, petal, flower, tint(accent-4, ✦)",
    "masthead-gold": null,
    "masthead-edging": null,
    "masthead-centre": "ring(tint(accent-4, ✦), n=8, center=tint(accent, flower), size=0.62)",
    "masthead-corner": "orbit(r=fit) | sunburst(r=fit) | doubled(r=fit) | rosette(r=fit) | layered(r=fit) | snowflake4(r=fit)",
    "masthead-knot": "ring(tint(accent-4, •), n=10, center=tint(accent-3, flower), size=0.42)",
    "masthead-fill": "orbit(r=fit) | rosette(r=fit) | sunburst(r=fit) | doubled(r=fit) | layered(r=fit) | alternating(r=fit) | star(r=fit) | snowflake(r=fit)",
    "masthead-fill-glyph": "tint(accent, ✿ | ❀) | tint(accent-3, ⊕ | ⊗ | + | ×) | tint(accent-4, ✦ | ✧ | ⋆) | tint(accent-2, λ | α | β | η | σ | π) | tint(\"var(--accent-5, var(--accent))\", ∀ | ∃ | Σ | Π)",
    "masthead-scroll": null,
    "masthead-divider": "nest(r=fit) | stars(r=fit) | rays(r=fit)",
    "masthead-divider-side": "stars(r=fit) | jewel(r=fit) | rays(r=fit)",
    "masthead-divider-end": "none",
    "masthead-divider-bead": "stars(r=fit) | jewel(r=fit)",
    // the divider band's shapes: halves (hanging below the line; the foot flips them to stand on it)
    "band-centre": "nest(r=fit, half=below) | stars(r=fit, half=below) | rays(r=fit, half=below) | nest(r=fit, half=below) | jewel(r=fit, half=below)",
    "band-side": "stars(r=fit, half=below) | rays(r=fit, half=below) | nest(r=fit, half=below) | jewel(r=fit, half=below)",
    "band-bead": "stars(r=fit, half=below) | jewel(r=fit, half=below) | rays(r=fit, half=below)",
    // a pattern may have its own: `<pattern>-band-centre` and so on (the night sky's is stars)
    "night-sky-band-centre": "stars(r=fit, half=below) | rays(r=fit, half=below)",
    "night-sky-band-side": "stars(r=fit, half=below)",
    "night-sky-band-bead": "stars(r=fit, half=below)",
    "masthead-middle": "leaf, petal, flower, leaf, tint(accent-4, ✦)",
    "masthead-rule": "tint(accent-4, •), tint(accent, ·)",
    "sampler-flower": "picture(sampler-rose) | picture(sampler-tulip-purple) | picture(sampler-sunflower) | picture(sampler-iris) | picture(sampler-poppy) | picture(sampler-cornflower)",
    "crown-flower": "sampler-flower*2 | crown-garden*2 | sunflower | rose | peony | iris | lotus | coneflower | tall-iris",
    "crown-garden": "small-daisy | small-tulip | small-forget-me-not | small-rose",
    "rule-centre": "masthead-divider",
    "rule-side": "masthead-divider-side",
    "rule-bead": "masthead-divider-bead",
  };
  var MS = { GILT: "var(--accent-4, #b8860b)", RED: "var(--accent)", BLUE: "var(--accent-3, #3f6fb3)", GREEN: "var(--accent-2, #5f8f4e)" };
  MS.INKS = [MS.RED, MS.BLUE, MS.GILT, MS.GREEN, MS.RED];
  var BAND = null;   // the divider under the masthead's name, as last drawn (the page's foot repeats it)
  // the radii (em, glyphs 1em) that the divider's shapes written r=fit are made to
  var BAND_FIT = { centre: 3.4, centreNarrow: 3.2, side: 1.9 }, BAND_SEQ = 0;
  var MVAR = {}, KEEP_BAND = false, PART_SIG = {};   // slots drawn afresh by a click (a variant of their key); keep the divider as it is
  function mastheadSlots() {
    var O = window.Ornament, defs = Object.create(null);
    Object.keys(MASTHEAD_SLOTS).forEach(function (k) { if (MASTHEAD_SLOTS[k]) defs[k] = O.library([k + " = " + MASTHEAD_SLOTS[k]]).defs[k]; });
    var base = LIB ? LIB.defs : O.library(["flower = ✿ | ❀ | ❁ | ✾", "leaf = ❧ | ❦", "petal = ⊕ | ⊗ | + | × | ∀ | ∃ | Σ | Π | π | λ | α | σ"]).defs;
    Object.keys(base).forEach(function (k) { defs[k] = base[k]; });
    var resolve = function (e) { for (var i = 0; e && e.t === "word" && defs[e.w] && i < 20; i++) e = defs[e.w].e; return e; };
    // fit: the radius (em) that shapes written r=fit are made to
    var real = function (e, key, fit) { var d = O.realize(e, { defs: defs, r: O.rng(VISIT + "|" + key), pictures: PICS, fitR: fit }); return d.items.length ? d : null; };
    return {
      defined: function (name) { return !!(LIB && LIB.defs[name]); },
      has: function (name) { return !!defs[name]; },   // (built in, or the library's)
      one: function (name, key, fit) { return defs[name] ? real(defs[name].e, name + "|" + key, fit) : null; },
      at: function (name, k, key) {
        var e = resolve(defs[name] && defs[name].e); if (!e) return null;
        var xs = e.t === "call" && e.f === "list" ? e.pos : [e];
        return real(xs[k % xs.length], name + "|" + key + "|" + k);
      },
    };
  }
  var leafyTok = function (tok) { return /[❧❦☙]/.test(tok) || !!(OPTS.bags && OPTS.bags.leaf && OPTS.bags.leaf.indexOf(tok) >= 0); };
  function leafy(d) { return d.items.length === 1 && leafyTok(d.items[0].tok); }
  // a size for a slot's drawing by what it is: a bloom, a leaf, anything else (structures a little larger)
  function glyphSize(d, bloom, leaf, other) {
    if (d.items.length > 1) return bloom * 1.15;
    var t = d.items[0].tok;
    return leafyTok(t) ? leaf : BLOOM.test(t) ? bloom : other;
  }
  // a drawing centred at (x, y), `size` glyph-heights tall, turned by rot degrees, mirrored when
  // flip; items with no colour of their own take col (leaves green)
  function placeDrawing(d, x, y, size, rot, flip, col, emit, px) {
    var u = px * size / Math.max(d.h, 1), c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
    d.items.forEach(function (it) {
      if (it.seg) return;
      var ix = it.x * u * (flip ? -1 : 1), iy = it.y * u, tok = flip ? window.Ornament.partner(it.tok) : it.tok;
      emit(tok, x + ix * c - iy * s, y + ix * s + iy * c, (it.s || 1) * u / px, (flip ? -(it.rot || 0) : (it.rot || 0)) + rot, it.col || (leafyTok(tok) ? MS.GREEN : col));
    });
  }
  // The divider under the name, the wreath's footing, after the beaded rule at the top of notes:
  // a straight double rule (thick over thin) threaded with beads (masthead-rule, in turn) and
  // capped by masthead-divider-end, and in the middle a centrepiece (masthead-divider) between two
  // runs of masthead-middle, mirrored exactly and tapering outward. `tail` is the page's foot:
  // the same band upside down (thin over thick, leaves hanging), with footer-divider as its
  // centrepiece when the library defines one. p: the glyph size in px; width: the band's width.
  // opt (the rules of notes): centre, side (slot names), runAt(k, v) (the runs' glyphs), fit, g.
  // The divider: none on the home page; on a note, a small simple one: a thin rule across the column with one
  // small star at its middle
  function dividerBand(doc, S, p, width, tail, opt) {
    var band = doc.createElement("div"); band.className = "folio-band";
    if (doc.querySelector(".folio-masthead")) { band.hidden = true; return band; }
    band.setAttribute("aria-hidden", "true");
    band.style.cssText = "display:flex;align-items:center;gap:.6em;width:" + Math.round(width) + "px;max-width:100%;margin:0 auto;color:" + MS.RED;
    var rule = function () { var l = doc.createElement("span"); l.style.cssText = "flex:1;height:0;border-top:1px solid currentColor;opacity:.8"; return l; };
    var star = doc.createElement("span"); star.textContent = "✦"; star.style.cssText = "font-size:" + (p * 0.8).toFixed(1) + "px;line-height:1";
    band.append(rule(), star, rule());
    return band;
  }

  // the page's foot on the home page: the same divider, upside down (see the glyph engine's tailpiece)
  OPTS.tailBand = function (doc) {
    if (!BAND || !document.querySelector(".folio-masthead")) return null;
    var pg = doc.querySelector(".helia-page");
    return dividerBand(doc, mastheadSlots(), BAND.p, Math.min(BAND.width, pg ? pg.clientWidth : innerWidth), true);
  };

  // The home page's masthead: no top bar; the name centred in blackletter inside an arch
  // (a half circle of glyphs), a wreath (two branches curving up from a knot of flowers), or
  // both; the nav as a small row beneath. Preview with ?masthead=arch|wreath|both|none.
  var MASTHEAD = config.masthead || "flanked";

  function masthead() {
    if (!document.querySelector(".helia-home-hero")) return;
    var q = /[?&]masthead=(\w+)/.exec(location.search), kind = q ? q[1] : MASTHEAD;
    if (kind === "none") return;
    var bar = document.querySelector(".helia-topbar"), page = document.querySelector(".helia-page");
    if (!bar || !page) return;
    document.documentElement.classList.add("folio-home");
    // The home page's template writes the masthead (name and nav) so the first paint is already
    // right; only its ornaments are drawn here. Without one, it is built from the top bar.
    var box = document.querySelector(".folio-masthead"), art, name, nav;
    if (box) {
      box.className = box.className.replace(/folio-masthead-\w+/g, "").trim() + " folio-masthead-" + kind;
      art = box.querySelector(".folio-masthead-art");
      name = box.querySelector(".folio-masthead-name");
      nav = box.querySelector(".folio-masthead-nav");
    } else {
      box = document.createElement("header");
      box.className = "folio-masthead folio-masthead-" + kind;
      art = document.createElement("div");
      art.className = "folio-masthead-art glyph-on";
      art.setAttribute("aria-hidden", "true");
      name = document.createElement("h1");
      name.className = "folio-masthead-name";
      name.textContent = (bar.querySelector(".helia-home") || {}).textContent || document.title;
      art.appendChild(name);
      box.appendChild(art);
      // the nav: the top bar's links, then a search link that opens the palette
      nav = document.createElement("nav");
      nav.className = "folio-masthead-nav";
      Array.prototype.forEach.call(bar.querySelectorAll(".helia-nav-links a"), function (a) {
        var l = document.createElement("a"); l.href = a.getAttribute("href"); l.textContent = a.textContent; nav.appendChild(l);
      });
      var sl = document.createElement("a"); sl.href = "#search"; sl.textContent = "Search";
      nav.appendChild(sl);
      box.appendChild(nav);
      page.parentNode.insertBefore(box, page);
    }
    // clicking the name reloads the page (a fresh draw of everything)
    name.setAttribute("role", "link"); name.tabIndex = 0; name.title = "Reload";
    name.addEventListener("click", function () { location.reload(); });
    name.addEventListener("keydown", function (ev) { if (ev.key === "Enter") location.reload(); });
    var srch = nav && nav.querySelector('a[href="#search"]');
    if (srch) srch.addEventListener("click", function (ev) { ev.preventDefault(); var b = document.querySelector(".helia-search-button"); if (b) b.click(); });
    draw(art, kind);
    redrawMasthead = function () { draw(art, kind); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(art, kind); });
    var t = null;
    addEventListener("resize", function () { clearTimeout(t); t = setTimeout(function () { draw(art, kind); }, 150); });
  }

  // Glyphs for the frame: the site's alphabet (single characters) and fleurons, in the folk colours.
  var FOLK_HEX = ["#d9707a", "#4f7fbf", "#e8b93a", "#5f8f4e", "#8a5aa8"];
  var FOLK_VARS = ["var(--accent)", "var(--accent-3)", "var(--accent-4)", "var(--accent-2)", "var(--accent-5, var(--accent))"];
  var FOLK = FOLK_HEX;
  function draw(art, kind) {
    Array.prototype.forEach.call(art.querySelectorAll(".glyph-orn, .folio-masthead-rays"), function (e) { e.remove(); });
    var W = art.clientWidth, px = Math.max(13, Math.min(22, W / 34));
    var name = art.querySelector(".folio-masthead-name"), nw = name.offsetWidth, nh = name.offsetHeight;
    var alpha = OPTS.alphabet.split(/\s+/).filter(function (t) { return Array.from(t).length === 1; });
    var blooms = ["✿", "❀", "❁", "✾"].concat(alpha.filter(function (t) { return /[⊕⊗Σ∀∃Π]/.test(t); }));
    var leaves = ["❧", "❦"], petals = alpha.length ? alpha : ["✦"];
    if (OPTS.bags) {                                   // the library's glyph bags
      if (OPTS.bags.bloom && OPTS.bags.bloom.length) blooms = OPTS.bags.bloom;
      if (OPTS.bags.leaf && OPTS.bags.leaf.length) leaves = OPTS.bags.leaf;
      if (OPTS.bags.petal && OPTS.bags.petal.length) petals = OPTS.bags.petal;
    }
    var k = 0, cx = W / 2, H, nameTop;
    var box = null;   // the name's box (with a margin): nothing is drawn inside it
    var boxes = [];   // more keep-out boxes (stitched motifs), for the glyphs drawn after them
    function outside(b, x, y, h) { return x + h < b[0] || x - h > b[2] || y + h < b[1] || y - h > b[3]; }
    var dots = [];    // keep-out points (the glyphs of stitched motifs): [x, y, clearance]
    function clear(x, y, size) {
      var h = px * size * 0.6;
      return (!box || outside(box, x, y, h)) && boxes.every(function (b) { return outside(b, x, y, h); }) &&
        dots.every(function (d) { return Math.abs(d[0] - x) > d[2] + h || Math.abs(d[1] - y) > d[2] + h || Math.hypot(d[0] - x, d[1] - y) > d[2] + px * size * 0.5; });
    }
    // Each element of the masthead (the crown, the pair of birds, an arch glyph and its mirror
    // image, a piece of the gasket, ...) is one piece: its glyphs share a data-piece id, and a
    // click on any of them draws it anew (art._reroll) — in place, or, for the crown, birds and
    // hearts (the gasket is packed round them), the whole masthead with that slot drawn afresh.
    var cur = null, redrawing = false, EL = Object.create(null), FULL = Object.create(null);
    var element = function (pid, fn) { EL[pid] = fn; cur = pid; fn(""); cur = null; };
    art.setAttribute("data-reroll-host", "");
    art._reroll = function (pid) {
      if (FULL[pid]) { MVAR[FULL[pid]] = "|" + Math.random(); KEEP_BAND = true; draw(art, kind); KEEP_BAND = false; return; }
      var fn = EL[pid]; if (!fn) return;
      var mine = function () { return art.querySelectorAll('[data-piece="' + pid + '"]'); };
      var text = function () { return Array.prototype.map.call(mine(), function (e) { return e.textContent; }).join(""); }, was = text();
      cur = pid; redrawing = true;
      try {
        for (var t = 0; t < 8; t++) {   // something different, if the slot has anything different to give
          Array.prototype.forEach.call(mine(), function (e) { e.remove(); });
          fn("|" + Math.random());
          if (text() !== was) break;
        }
      } finally { cur = null; redrawing = false; }
      document.dispatchEvent(new Event("glyphs-changed"));
    };
    function put(tok, x, y, size, rot, colour, force) {   // force: placed where it was fitted, unchecked
      if (!force && !redrawing && !clear(x, y, size)) return;
      var e = document.createElement("span");
      e.className = "glyph-orn"; e.textContent = tok;
      e.style.cssText = "position:absolute;left:" + x.toFixed(1) + "px;top:" + y.toFixed(1) + "px;translate:-50% -50%;line-height:1;font-size:" + (px * size).toFixed(1) + "px;color:" + (colour || FOLK[k++ % FOLK.length]);
      if (rot) e.style.rotate = rot.toFixed(1) + "deg";
      e._mx = x; e._my = y;   // masthead-relative (not the page positions the pointer effects read)
      if (cur) e.dataset.piece = cur;
      art.appendChild(e);
    }
    // an elliptical arch of glyphs over (cx, cy), spaced evenly along the curve: mirrored, a big
    // bloom at the crown, leaves turned along it
    function arch(rx, ry, cy, dots) {
      var per = Math.PI * Math.sqrt((rx * rx + ry * ry) / 2), n = Math.max(15, Math.round(per / (px * 1.35))) | 1;
      for (var i = 0; i <= n; i++) {
        var f = i / n, a = Math.PI * (1 - f), x = cx + Math.cos(a) * rx, y = cy - Math.sin(a) * ry;
        var left = f < 0.5, crown = Math.abs(f - 0.5) < 0.5 / n + 1e-9;
        var slope = Math.atan2(-Math.cos(a) * ry, Math.sin(a) * rx) * 180 / Math.PI;   // the curve's direction
        var tok = crown ? blooms[0] : i % 3 === 0 ? blooms[(i / 3) % blooms.length] : i % 3 === 1 ? (left ? leaves[0] : window.Glyphs.partner(leaves[0])) : petals[(i * 7) % petals.length];
        put(tok, x, y, crown ? 1.7 : i % 3 === 0 ? 1.15 : 0.95, i % 3 === 1 ? slope : 0);
        if (dots && i % 2) put("·", cx + Math.cos(a) * (rx - px * 0.9), cy - Math.sin(a) * (ry - px * 0.9), 0.7, 0, "var(--rule)");
      }
    }
    // an inner row along a smaller ellipse, spaced `gap` glyph-widths apart
    function ring(rx, ry, cy, gap, pickTok, size, turn) {
      if (rx <= 0 || ry <= 0) return;
      var per = Math.PI * Math.sqrt((rx * rx + ry * ry) / 2), n = Math.max(9, Math.round(per / (px * gap)));
      for (var i = 0; i <= n; i++) {
        var f = i / n, a = Math.PI * (1 - f), x = cx + Math.cos(a) * rx, y = cy - Math.sin(a) * ry;
        var slope = Math.atan2(-Math.cos(a) * ry, Math.sin(a) * rx) * 180 / Math.PI;
        put(pickTok(i, f < 0.5), x, y, size, turn ? slope : 0);
      }
    }
    // two branches rising from a knot under the name, round an ellipse (rx, ry) about (cx, cy),
    // `reach` of the way up each side
    function wreath(rx, ry, cy, reach) {
      var m = Math.max(8, Math.round(rx / px * 0.9));
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        for (var t = 1; t <= m; t++) {
          var ang = Math.PI / 2 + sgn * (t / m) * Math.PI * reach;
          var x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry, tip = t === m;
          var lf = sgn < 0 ? leaves[t % 2] : window.Glyphs.partner(leaves[t % 2]);
          put(tip ? blooms[1 % blooms.length] : lf, x, y, tip ? 1.3 : 0.95, tip ? 0 : ang * 180 / Math.PI + (sgn < 0 ? 0 : 180), tip ? null : "#5f8f4e");
          if (t % 3 === 2) put(petals[(t * 5) % petals.length], cx + Math.cos(ang) * rx * 0.86, cy + Math.sin(ang) * ry * 0.8, 0.7);
        }
      }
      put(blooms[0], cx, cy + ry + px * 0.1, 1.4);   // the knot
      put("❦", cx - px * 1.3, cy + ry - px * 0.2, 0.9, 20, "#5f8f4e");
      put("❦", cx + px * 1.3, cy + ry - px * 0.2, 0.9, -20, "#5f8f4e");
    }
    if (kind === "arch") {
      // A tympanum over the name, symmetric about the centre: a mirrored outer arch, a scalloped
      // lace band inside it, rays of dots fanning up from the name (a sunburst), a rosette under
      // the crown. Nothing is drawn over the name.
      var ax = nw / 2 + px * 2.4, ay = Math.max(nh * 2.4, ax * 0.72), cy = px * 1.8 + ay;
      nameTop = cy - nh * 0.78; H = nameTop + nh + px * 0.4;
      var m = px * 0.5; box = [cx - nw / 2 - m, nameTop - m, cx + nw / 2 + m, nameTop + nh + m];
      var E = function (a, dx, dy) { return [cx + Math.cos(a) * (ax - dx), cy - Math.sin(a) * (ay - dy)]; };
      // the outer arch: glyph and colour chosen by distance from the crown, so both sides match
      var per = Math.PI * Math.sqrt((ax * ax + ay * ay) / 2), n = Math.max(16, Math.round(per / (px * 1.3))), mid;
      if (n % 2) n++;
      mid = n / 2;   // even, so one glyph sits at the crown
      for (var i = 0; i <= n; i++) {
        var a = Math.PI * (1 - i / n), p0 = E(a, 0, 0), j = Math.round(Math.abs(i - mid) * 2) / 2, jj = Math.floor(Math.abs(i - mid));
        var slope = Math.atan2(-Math.cos(a) * ay, Math.sin(a) * ax) * 180 / Math.PI;
        var col = FOLK[jj % FOLK.length], left = i < mid;
        if (j < 1) put(blooms[0], p0[0], p0[1], 1.7, 0, FOLK[2]);
        else if (jj % 3 === 0) put(blooms[(jj / 3) % blooms.length], p0[0], p0[1], 1.1, 0, col);
        else if (jj % 3 === 1) put(left ? leaves[0] : window.Glyphs.partner(leaves[0]), p0[0], p0[1], 1, slope, "#5f8f4e");
        else put(petals[jj % petals.length], p0[0], p0[1], 0.85, 0, col);
      }
      // the lace band: small scallops of dots hanging inside the arch
      var sc = Math.round(n / 2) * 2, per2 = sc * 6;
      for (var t = 0; t <= per2; t++) {
        var f = t / per2, a2 = Math.PI * (1 - f), bump = Math.abs(Math.sin(f * sc * Math.PI)) * px * 0.55;
        var p2 = E(a2, px * 1.3 + bump, px * 1.3 + bump);
        put(t % 6 === 3 ? "∘" : "·", p2[0], p2[1], t % 6 === 3 ? 0.7 : 0.62, 0, t % 6 === 3 ? FOLK[0] : "var(--muted)");
      }
      var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "folio-masthead-rays"); svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "position:absolute;left:0;top:0;width:100%;height:" + H + "px;overflow:visible;pointer-events:none";
      art.insertBefore(svg, art.firstChild);
      var path = function (pts, w) {
        var e = document.createElementNS(NS, "path");
        e.setAttribute("d", "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L"));
        e.setAttribute("fill", "none"); e.setAttribute("stroke", "#5f8f4e"); e.setAttribute("stroke-width", w); e.setAttribute("stroke-linecap", "round");
        svg.appendChild(e);
      };
      // the centrepiece: a full rosette under the crown, on a short stem with a pair of leaves
      var top = cy - ay, rc = [cx, top + px * 4.2], gapBelow = nameTop - rc[1];
      path([[cx, rc[1] + px * 1.2], [cx, nameTop - px * 0.6]], 1.6);
      if (gapBelow > px * 3.2) {
        var ly = rc[1] + Math.min(px * 2.6, gapBelow * 0.55);
        put(leaves[0], cx - px * 0.85, ly, 0.9, -35, "#5f8f4e");
        put(window.Glyphs.partner(leaves[0]), cx + px * 0.85, ly, 0.9, 35, "#5f8f4e");
      }
      for (var q = 0; q < 12; q++) {                        // outer ring of dots
        var aq = q * Math.PI / 6; put("·", rc[0] + Math.cos(aq) * px * 2.15, rc[1] + Math.sin(aq) * px * 2.15, 0.6, 0, FOLK[q % 2 ? 0 : 2]);
      }
      for (var q2 = 0; q2 < 8; q2++) {                      // petals and leaves, alternating, turned outward
        var a8 = q2 * Math.PI / 4, xx = rc[0] + Math.cos(a8) * px * 1.35, yy = rc[1] + Math.sin(a8) * px * 1.35;
        if (q2 % 2) put(leaves[1], xx, yy, 0.75, a8 * 180 / Math.PI + 90, "#5f8f4e");
        else put(petals[(q2 * 3) % petals.length], xx, yy, 0.72, 0, FOLK[(q2 / 2) % 2 ? 1 : 4]);
      }
      put(blooms[1 % blooms.length], rc[0], rc[1], 1.6, 0, FOLK[0]);
      // two mirrored sprays curving out from the centrepiece along the inside of the arch
      var sx = ax - px * 3.4, sy = ay - px * 3.4;
      for (var sg = -1; sg <= 1; sg += 2) {
        var pts = [], steps = 40;
        for (var u = 0; u <= steps; u++) {
          var f2 = u / steps, th = Math.PI / 2 - sg * (0.1 + 0.95 * f2) * (Math.PI / 2) * 0.93;
          var shrink = 1 - 0.06 * Math.sin(f2 * Math.PI);                  // a slight inward sag
          var pt = [cx + Math.cos(th) * sx * shrink, cy - Math.sin(th) * sy * shrink];
          if (pt[1] > nameTop - px * 1.1) break;                         // stop above the name
          pts.push(pt);
        }
        steps = pts.length - 1;
        if (steps < 6) continue;
        // glyphs only, no drawn stem: leaves alternating either side of the curve, flowers between
        for (var v = 2; v < steps; v += 2) {
          var p1 = pts[v], p0 = pts[v - 1], ang2 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), side = (v / 2) % 2 ? 1 : -1;
          var nx = -Math.sin(ang2) * side * px * 0.55, ny = Math.cos(ang2) * side * px * 0.55;
          if ((v / 2) % 4 === 2) put(petals[(v * 2) % petals.length], p1[0], p1[1], 0.7, 0, FOLK[(v / 2) % FOLK.length]);
          else put(sg < 0 ? leaves[0] : window.Glyphs.partner(leaves[0]), p1[0] + nx, p1[1] + ny, 0.75, ang2 * 180 / Math.PI + (side > 0 ? 90 : -90), "#5f8f4e");
        }
        var e2 = pts[steps];
        put(blooms[2 % blooms.length], e2[0], e2[1], 1.1, 0, FOLK[3]);
      }
    } else if (kind === "flanked") {
      // The name alone, no arch or crown over it, flanked each side: nearest the name a shape
      // from masthead-foot as tall as the name, then (with room) a smaller masthead-corner
      // shape. Mirrored; each is one piece (a click redraws the pair).
      var SF = mastheadSlots(), gpx = px * 0.6;
      // the stylesheet lays the name out (and sizes the art) before any of this runs: draw round
      // it where it is, so nothing moves
      nameTop = name.offsetTop; H = art.offsetHeight;
      var mgF = px * 0.45; box = [cx - nw / 2 - mgF, nameTop - mgF, cx + nw / 2 + mgF, nameTop + nh + mgF];
      var hyF = nameTop + nh * 0.5, sideRoom = W / 2 - nw / 2 - px * 1.4;
      // a drawing h px tall from `slot`, at the name's height, its near edge `gap` px out from x0;
      // returns its width (0 if nothing fits)
      var flank = function (pid, slot, h, x0, v) {
        var d = SF.one(slot, "flank-" + pid + v, h / (2 * gpx));
        if (!d) return 0;
        var w = d.w * h / Math.max(d.h, 0.5);
        if (x0 + w > W / 2 - px * 0.4) return 0;   // no room this side of the page
        for (var sg = -1; sg <= 1; sg += 2) placeDrawing(d, cx + sg * (x0 + w / 2), hyF, h / px, 0, sg > 0, "var(--accent)", put, px);
        return w;
      };
      var innerW = 0;
      element("mh-flank", function (v) { innerW = flank("in", "masthead-foot", Math.min(nh * 1.15, sideRoom), nw / 2 + px * 1.2, v); });
      element("mh-flank-out", function (v) { if (innerW) flank("out", "masthead-corner", nh * 0.75, nw / 2 + px * 1.2 + innerW + px * 1.1, v); });
      var heroF = document.querySelector(".helia-home-hero");
      BAND = { p: Math.max(16, px * 0.9), width: heroF && heroF.offsetWidth ? heroF.offsetWidth : Math.min(W, nw + px * 12) };
      var hostF = art.parentNode, oldF = hostF && hostF.querySelector(".folio-band");
      if (oldF && !KEEP_BAND) oldF.remove();
      var navF = hostF && hostF.querySelector(".folio-masthead-nav");   // the nav sits between the name and the divider
      if (hostF && (!oldF || !KEEP_BAND)) hostF.insertBefore(dividerBand(document, SF, BAND.p, BAND.width, false), navF ? navF.nextSibling : art.nextSibling);
    } else if (kind === "fraktur") {
      // A folk title page, after Pennsylvania-German fraktur and cross-stitch samplers: the
      // mirrored glyph arch with its lace band, a tall stitched tulip crowning the name, two
      // stitched birds on the arch's shoulders facing it, stitched hearts at its feet.
      // stitched in the site's math symbols, a set per colour: blossoms ⊕ ⊗, leaves λ β η,
      // bird bodies ∀ Σ, wings ∃ Π (alternating across the grid for texture)
      var narrow = W < 600;
      var cell = px * (narrow ? 0.38 : 0.42), ST = { r: ["⊕", "⊗"], g: ["λ", "β", "η"], y: ["∀", "Σ"], b: ["∃", "Π"] };
      var CC = { r: "var(--accent)", g: "var(--accent-2, #5f8f4e)", y: "var(--accent-4, #b8860b)", b: "var(--accent-3, #3f6fb3)" };
      var TULIP = [".....r.....", "...r.r.r...", "..rr.r.rr..", "..rrryrrr..", "..rrryrrr..", "...rrrrr...", "....rrr....",
                   "g....g....g", "gg...g...gg", ".gg..g..gg.", "..ggggggg..", ".....g.....", ".....g....."];
      var BIRD = ["......yy.", ".....yyyr", "yy..yyyy.", ".yyyyyyy.", "..bbyyy..", "...bbb...", "....g.g.."];
      var HEART = [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."];
      var stitch = function (M, x0, y0, flip) {                   // (x0, y0): the motif's centre
        var w = M[0].length, h = M.length, mine = [];
        M.forEach(function (row, j) { Array.from(row).forEach(function (ch, i) {
          if (ch === ".") return;
          var ii = flip ? w - 1 - i : i;
          var set = ST[ch] || ["·"];
          var gx = x0 + (ii - (w - 1) / 2) * cell, gy = y0 + (j - (h - 1) / 2) * cell;
          put(set[(i + j) % set.length], gx, gy, 0.58, 0, CC[ch]);
          mine.push([gx, gy, cell * 1.1]);
        }); });
        dots.push.apply(dots, mine);
      };
      // the motifs and their stitch bags and colours come from the ornament workshop when present
      var fromOrn = function (id, fallback) {
        var a = ORN[id]; if (!a || !a.rows || !a.rows.length) return fallback;
        Object.keys(a.brushes).forEach(function (key) { ST[key] = a.brushes[key].glyphs; CC[key] = /^(accent(-[234])?|ink|muted|rule|paper)$/.test(a.brushes[key].color) ? "var(--" + a.brushes[key].color + ")" : a.brushes[key].color; });
        return a.rows;
      };
      TULIP = fromOrn("ornament-tulip", TULIP); BIRD = fromOrn("ornament-bird", BIRD); HEART = fromOrn("ornament-heart", HEART);
      // with the ornament library loaded, the crown, shoulders and feet are its structures
      // masthead-crown, masthead-shoulder and masthead-foot (any structure, or a choice of them)
      // (shapes written r=fit are made to the motif's height, their glyphs the size of its stitches)
      var SG = px * 0.62, tulipH0 = TULIP.length * cell;
      // The crown, the birds and the hearts: anything from their slots that fits the room there,
      // its glyphs no larger than the tulip's and not much smaller. A draw that won't fit legibly
      // (a tall flower on a phone) is drawn again, so small screens get the smaller-grid pictures;
      // shapes written r=fit are made to the room. A click draws something different (PART_SIG).
      var uMax = cell / 0.8, minG = Math.max(uMax * 0.85, 5.5);
      var fitPart = function (name, w, h) {   // { d, h: its height drawn } or null
        if (!LIB) return null;
        for (var t = 0; t < 24; t++) {
          var d = mastheadSlots().one(name, (MVAR[name] || "") + (t ? "|try" + t : ""), Math.min(w, h) / (2 * uMax));
          if (!d) return null;
          var u = Math.min(w / Math.max(d.w, 0.5), h / Math.max(d.h, 0.5), uMax);
          var sig = d.items.slice(0, 8).map(function (it) { return it.tok; }).join("") + d.h.toFixed(1);
          if (u < minG || (MVAR[name] && sig === PART_SIG[name] && t < 23)) continue;
          PART_SIG[name] = sig;
          return { d: d, h: d.h * u };
        }
        return null;
      };
      var crownP = fitPart("masthead-crown", tulipH0 * 1.7, tulipH0 * (narrow ? 1 : 1.5)), crownD = crownP && crownP.d, crownH = crownP ? crownP.h : tulipH0;
      var shoulderP = fitPart("masthead-shoulder", BIRD[0].length * cell * 1.15, BIRD.length * cell * 1.1), shoulderD = shoulderP && shoulderP.d;
      // the feet: as tall as the name on a wide screen, as wide as the room beside it
      var footW = narrow ? HEART[0].length * cell * 1.15 : Math.max(HEART[0].length * cell, Math.min(W / 2 - nw / 2 - px * 1.4, HEART[0].length * cell * 2.4));
      var footP = fitPart("masthead-foot", footW, narrow ? HEART.length * cell * 1.15 : Math.max(HEART.length * cell, nh * 1.1)), footD = footP && footP.d;
      // a drawing placed like a stitched motif: (x0, y0) its centre, h its height in px
      var stitchD = function (d, x0, y0, h, flip) {
        var u = h / Math.max(d.h, 0.5), mine = [];
        d.items.forEach(function (it) {
          if (it.seg) return;
          var gx = x0 + (flip ? -it.x : it.x) * u, gy = y0 + it.y * u, gs = (it.s || 1) * u / px * 0.95;
          put(flip ? window.Ornament.partner(it.tok) : it.tok, gx, gy, gs, it.rot ? (flip ? -it.rot : it.rot) : 0, it.col || (leafyTok(it.tok) ? MS.GREEN : "var(--accent)"));
          mine.push([gx, gy, Math.max(cell * 1.1, gs * px * 0.75)]);
        });
        dots.push.apply(dots, mine);
      };
      var tulipH = crownD ? crownH : TULIP.length * cell;
      var ax = nw / 2 + px * 2.6, ay = Math.max(nh * 0.8 + tulipH + px * (narrow ? 1.05 : 1.35), ax * (narrow ? 0.42 : 0.46)), cy = px * (narrow ? 1 : 1.2) + ay;
      nameTop = cy - nh * 0.8;
      var m = px * 0.5; box = [cx - nw / 2 - m, nameTop - m, cx + nw / 2 + m, nameTop + nh + m];
      var E = function (a, d) { return [cx + Math.cos(a) * (ax - d), cy - Math.sin(a) * (ay - d)]; };
      var top = cy - ay, S = mastheadSlots();
      // a drawing from a slot, centred at (x, y), `size` glyph-heights tall, turned by rot, mirrored
      var drawAt = function (d, x, y, size, rot, flip, col) { placeDrawing(d, x, y, size, rot, flip, col, put, px); };
      // a drawing fitted into a w × h room centred at (x, y), its glyphs no larger than the stitched
      // motifs' and no smaller than a third of the arch's; false (nothing drawn) if it won't go
      var fitAt = function (d, x, y, w, h, flip, col) {
        var ss = d.items.map(function (it) { return it.s || 1; }).sort(function (a, b) { return a - b; }), ms = ss[ss.length >> 1] || 1;
        var u = Math.min(w / Math.max(d.w, 0.5), h / Math.max(d.h, 0.5), px * 0.6 / ms);
        if (w <= 0 || h <= 0 || ms * u < px * 0.34) return false;
        drawAt(d, x, y, u * Math.max(d.h, 1) / px, 0, flip, col);
        var hw = d.w * u / 2 + px * 0.2, hh = d.h * u / 2 + px * 0.2;
        boxes.push([x - hw, y - hh, x + hw, y + hh]);
        return true;
      };
      // the tulip, standing on the name
      FULL["mh-crown"] = "masthead-crown"; FULL["mh-shoulder"] = "masthead-shoulder"; FULL["mh-foot"] = "masthead-foot";
      cur = "mh-crown";
      if (crownD) stitchD(crownD, cx, nameTop - px * 0.7 - tulipH / 2, tulipH); else stitch(TULIP, cx, nameTop - px * 0.7 - tulipH / 2);
      // birds on the arch's shoulders, facing the tulip; hearts at the arch's feet
      var sh = Math.PI / 2 + 0.62, bw = BIRD.length * cell;
      var pl = E(sh, bw * 0.8), pr = E(Math.PI - sh, bw * 0.8);
      // the birds perch just inside the arch, which runs unbroken round them
      cur = "mh-shoulder";
      if (shoulderD) { stitchD(shoulderD, pl[0], pl[1], shoulderP.h, false); stitchD(shoulderD, pr[0], pr[1], shoulderP.h, true); }
      else { stitch(BIRD, pl[0], pl[1], false); stitch(BIRD, pr[0], pr[1], true); }
      // the hearts beside the ends of the name, level with it, not hanging below
      var hy = nameTop + nh * 0.5, hx = nw / 2 + px * 1.2 + (footD ? footD.w * footP.h / Math.max(footD.h, 0.5) / 2 : 3.5 * cell);
      cur = "mh-foot";
      if (footD) { stitchD(footD, cx - hx, hy, footP.h, false); stitchD(footD, cx + hx, hy, footP.h, true); }
      else { stitch(HEART, cx - hx, hy, false); stitch(HEART, cx + hx, hy, false); }
      cur = null;
      // the spandrels inside the arch, between the tulip and the birds: a boss each side
      var bossAt = [];
      element("mh-knot", function (v) {
        var bossD = S.one("masthead-knot", "boss" + v);
        if (bossD) for (var sb = -1; sb <= 1; sb += 2) {
          var bp = E(Math.PI / 2 - sb * 0.5, px * (narrow ? 2.6 : 3.0));
          var fits = !v || bossAt.indexOf(sb) >= 0;   // all of it or none (a redraw goes where the first one went)
          if (!v) placeDrawing(bossD, bp[0], bp[1], narrow ? 1.2 : 1.5, 0, sb > 0, MS.BLUE, function (t, x, y, sz) { fits = fits && clear(x, y, sz); }, px);
          if (fits) { drawAt(bossD, bp[0], bp[1], narrow ? 1.2 : 1.5, 0, sb > 0, MS.BLUE); if (!v) bossAt.push(sb); }
        }
      });
      // the arch, mirrored and painted from the crown outward with masthead-arch; the crown left
      // open for the tulip
      var per = Math.PI * Math.sqrt((ax * ax + ay * ay) / 2), n = Math.max(16, Math.round(per / (px * 1.22)));
      if (n % 2) n++;
      var half = n / 2;
      var archAt = function (jj, v) {   // the arch's jj-th glyph from the crown, both sides
        var dA = S.at("masthead-arch", jj - 1, "arch" + v);
        if (dA) [half - jj, half + jj].forEach(function (i) {
          var a = Math.PI * (1 - i / n), p0 = E(a, 0), slope = Math.atan2(-Math.cos(a) * ay, Math.sin(a) * ax) * 180 / Math.PI;
          drawAt(dA, p0[0], p0[1], glyphSize(dA, 1.3, 1.15, 1.0), leafy(dA) ? slope : 0, i > half, MS.INKS[jj % MS.INKS.length]);
        });
      };
      for (var ja = 1; ja <= half; ja++) element("mh-arch-" + ja, archAt.bind(null, ja));
      // the gilt edge: a beaded border just outside the arch (masthead-gold, in turn from the crown)
      var nb = n;   // one bead outside each glyph of the arch
      for (var b = 0; b <= nb; b++) {
        var jb = Math.abs(b - nb / 2), pb = E(Math.PI * (1 - b / nb), -px * 1.05), dG = S.at("masthead-gold", jb, "gilt");
        if (dG) drawAt(dG, pb[0], pb[1], 0.62, 0, b > nb / 2, MS.GILT);
      }
      // the lace band inside: scallops of masthead-edging
      var sc = half * 2, steps = sc * 6;
      for (var t = 0; t <= steps; t++) {
        var f = t / steps, bump = Math.abs(Math.sin(f * sc * Math.PI)) * px * 0.55, p2 = E(Math.PI * (1 - f), px * 1.3 + bump);
        var dL = S.at("masthead-edging", Math.abs(t - steps / 2), "lace");
        if (dL) drawAt(dL, p2[0], p2[1], 0.64, 0, t > steps / 2, "var(--muted)");
      }
      // The rest of the space inside the arch, packed like an Apollonian gasket (as the margins
      // are): a distance field over the left half, from everything already drawn (every glyph, the
      // name) and the arch's bounds; again and again a random spot is taken and given the biggest
      // thing that fits there, a masthead-fill made to measure (r=fit) or, in the smallest holes, a
      // masthead-fill-glyph, now and then nothing; then all of it mirrored onto the right half.
      var fillArch = function (S, top) {
        var probe = S.one("masthead-fill", "probe", 2);
        if (!probe || (probe.items.length === 1 && probe.items[0].tok === "none")) return;
        var O = window.Ornament, rr = O.rng(VISIT + "|arch-fill|" + Math.round(W)), g = Math.max(8.5, px * 0.56), PAD = g * 0.22;
        var G = Math.max(2.5, px * 0.16), x0 = cx - ax, y0 = top, cols = Math.ceil(ax / G) + 1, rows = Math.ceil((cy - top) / G) + 1;
        var dist = new Float32Array(cols * rows);
        for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
          var x = x0 + i * G, y = y0 + j * G, dx = (x - cx) / ax, dy = (y - cy) / ay, q = Math.hypot(dx, dy) || 1e-6;
          var grad = Math.hypot(dx / ax, dy / ay) / q || 1;
          dist[j * cols + i] = Math.min((1 - q) / grad, cx - x - g * 0.2, cy - y);   // inside the arch, left of the axis, above its feet
        }
        var obstacle = function (ox, oy, R, hw, hh) {
          for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
            var x = x0 + i * G, y = y0 + j * G, k = j * cols + i, d;
            if (hw != null) { var ex = Math.abs(x - ox) - hw, ey = Math.abs(y - oy) - hh; d = ex > 0 || ey > 0 ? Math.hypot(Math.max(0, ex), Math.max(0, ey)) : Math.max(ex, ey); }
            else d = Math.hypot(x - ox, y - oy) - R;
            if (d < dist[k]) dist[k] = d;
          }
        };
        Array.prototype.forEach.call(art.querySelectorAll(".glyph-orn"), function (e) {
          if (e._mx == null || e._mx > cx + px * 3) return;
          var fs = parseFloat(e.style.fontSize) || px;
          obstacle(e._mx, e._my, fs * 0.5 + PAD);
        });
        if (box) obstacle((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, 0, (box[2] - box[0]) / 2 + PAD, (box[3] - box[1]) / 2 + PAD);
        var both = function (tok, x, y, size, rot, col) {   // a glyph and its mirror image
          put(tok, x, y, size, rot, col, true);
          put(O.partner(tok), 2 * cx - x, y, size, -rot, col, true);
        };
        // the biggest thing that fits a hole of radius `hole` at (hx, hy): a masthead-fill made to
        // measure (unless glyph), else a masthead-fill-glyph; its radius, or null if nothing went.
        // key: its draw (a redraw adds a variant, v)
        var fillAt = function (hx, hy, hole, key, glyph, v) {
          var jr = O.rng(key + (v || ""));
          if (!glyph && hole >= g * 1.55) for (var t = 0; t < 4; t++) {
            var d = S.one("masthead-fill", key + (v || "") + (t ? "|" + t : ""), hole / g * (0.86 + 0.14 * jr()));
            if (!d) break;
            var ext = 0;
            d.items.forEach(function (it) { if (!it.seg) ext = Math.max(ext, Math.hypot(it.x, it.y) + (it.s || 1) * 0.5); });
            var u = Math.min(g, hole / Math.max(ext, 0.5));
            if (u < g * 0.8) continue;
            d.items.forEach(function (it) { if (!it.seg) both(it.tok, hx + it.x * u, hy + it.y * u, (it.s || 1) * u / px, it.rot || 0, it.col || (leafyTok(it.tok) ? MS.GREEN : MS.RED)); });
            return { r: ext * u, glyph: false };
          }
          if (hole < g * 0.5 || (!v && hole < g * 0.75)) return null;   // the narrowest crevices stay empty
          var dg = S.one("masthead-fill-glyph", "f" + key + (v || ""));
          if (!dg || !dg.items[0]) return null;
          var it0 = dg.items[0], sz = Math.min(it0.s || 1, hole / (g * 0.5));
          both(it0.tok, hx, hy, g * sz / px, 0, it0.col || MS.GILT);
          return { r: g * sz * 0.5, glyph: true };
        };
        var MINR = g * 0.75, MAXR = g * 3.4, n = 0, misses = 0;
        for (var guard = 0; guard < 4000 && misses < 300; guard++) {
          // the roomiest holes first (one of those nearly as roomy as the roomiest, at random)
          var mx = -1, near = [];
          for (var qq = 0; qq < dist.length; qq++) if (dist[qq] > mx) mx = dist[qq];
          if (mx < MINR) break;
          for (var qq2 = 0; qq2 < dist.length; qq2++) if (dist[qq2] >= Math.min(mx, MAXR) * 0.9) near.push(qq2);
          var k = near[Math.floor(rr() * near.length)];
          var hole = Math.min(dist[k], MAXR), hx = x0 + (k % cols) * G, hy = y0 + Math.floor(k / cols) * G;
          if (hole > g * 1.3 && rr() < 0.12) { obstacle(hx, hy, Math.min(g * 2, hole * (0.4 + 0.6 * rr()))); continue; }
          var pid = "mh-fill-" + (++n);
          cur = pid;
          var got = fillAt(hx, hy, hole, "g" + n, false);
          cur = null;
          if (got) {
            EL[pid] = fillAt.bind(null, hx, hy, got.r, "g" + n, got.glyph);   // a redraw: something else, no larger
            obstacle(hx, hy, got.r + PAD); misses = 0;
          } else { obstacle(hx, hy, dist[k] + 0.5); misses++; }
        }
      };
      var edge = px * 0.55, inside = function (x) { return x > edge && x < W - edge; };
      // the corner pieces: masthead-corner in each upper corner, outside the arch (made to the
      // room there, r=fit, glyphs no larger than the stitched motifs'; where there's too little
      // room for it, a small one up in the corner, of the same kind), one drawing, mirrored
      element("mh-corner", function (v) {
        var x0c = ax + px * 1.5, cwR = W / 2 - x0c - px * 0.3, chR = ay * 0.62;
        var cD = S.one("masthead-corner", "corner" + v, Math.min(cwR, chR) / (2 * px * 0.6)), mD = null;
        for (var s = -1; s <= 1; s += 2) {
          if (cD && fitAt(cD, cx + s * (x0c + cwR / 2), top + chR / 2 - px * 0.2, cwR, chR, s > 0, MS.RED)) continue;
          var gs = Math.max(7.5, px * 0.55), sD = S.one("masthead-corner", "corner" + v, 2.3);
          if (sD && sD.items.length > 1) {
            var rad = sD.h / 2 * gs;
            drawAt(sD, cx + s * (W / 2 - rad - px * 0.3), top + rad * 0.75, sD.h * gs / px, 0, s > 0, MS.RED);
            continue;
          }
          mD = mD || S.one("masthead-centre", "corner" + v);
          var csz = narrow ? 1.6 : 2.2, cw = mD ? csz * px * Math.max(mD.w, 1) / Math.max(mD.h, 1) : 0;
          if (mD) drawAt(mD, cx + s * Math.min(ax + px * 0.4, W / 2 - cw / 2 - px * 0.3), top + px * 0.9, csz, 0, s > 0, MS.RED);
        }
      });
      for (var s = -1; s <= 1; s += 2) {
        // the corner pieces: masthead-corner in each upper corner, outside the arch
        // (fitted to the room there, glyphs no larger than the stitched motifs'; where there's too
        // little room for it, masthead-centre instead)
        // the border vine: down the outside of the gilt edge from the corner to the feet, painted
        // in turn with masthead-scroll (leaves come in pairs, either side of the vine)
        var d = px * 2.0, prev = null, k2 = 0, acc = 0;
        for (var u = 0; u <= 160; u++) {
          var ph = 1.02 - u / 160 * 0.95, p = [cx + s * Math.cos(ph) * (ax + d), cy - Math.sin(ph) * (ay + d)];
          if (prev) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
          prev = p;
          if (u && acc < px * 0.78) continue;
          acc = 0;
          var tx = s * Math.sin(ph) * (ax + d), ty = Math.cos(ph) * (ay + d), nl = Math.hypot(tx, ty);   // heading down the vine
          var an = Math.atan2(ty, tx) * 180 / Math.PI, nx = -ty / nl * px * 0.36, ny = tx / nl * px * 0.36;
          var dV = S.at("masthead-scroll", k2, "scroll");
          if (dV && leafy(dV)) {                        // a leaf to one side, turned along the vine (a laurel)
            var sd = k2 % 4 === 0 ? 1 : -1;
            if (inside(p[0] + sd * nx)) drawAt(dV, p[0] + sd * nx, p[1] + sd * ny, 0.62, an + sd * 40 * s, s > 0, MS.GREEN);
          } else if (dV && inside(p[0])) drawAt(dV, p[0], p[1], glyphSize(dV, 0.66, 0.6, 0.5), 0, s > 0, MS.INKS[(k2 >> 1) % 4]);
          k2++;
        }
      }
      fillArch(S, top);
      H = nameTop + nh + px * 0.5;
      // the divider under the name: the wreath's footing, as wide as the arch and its hearts
      var heroBox = document.querySelector(".helia-home-hero");   // as wide as the introduction's box
      BAND = { p: Math.max(16, px * 0.9), width: heroBox && heroBox.offsetWidth ? heroBox.offsetWidth : Math.min(W, 2 * (ax + px * 1.2)) };
      var host = art.parentNode, old = host && host.querySelector(".folio-band");
      if (old && !KEEP_BAND) old.remove();
      var navEl = host && host.querySelector(".folio-masthead-nav");   // the nav sits between the name and the divider
      if (host && (!old || !KEEP_BAND)) host.insertBefore(dividerBand(document, S, BAND.p, BAND.width, false), navEl ? navEl.nextSibling : art.nextSibling);
    } else if (kind === "nouveau") {
      // Art nouveau, after Mucha: a great halo behind the name (double rings, a mosaic band of
      // flowers, fine spokes), whiplash curves sweeping out from the name and rolling up into
      // spirals with blooms at their hearts, and a finial crowning the halo. Symmetric about the
      // centre; the drawn lines are masked out around the name.
      var Rh = Math.max(nw * 0.34, nh * 1.9), hc = px * 3.2 + Rh;          // halo radius and centre y
      nameTop = hc - nh * 0.1; H = nameTop + nh + px * 0.6;
      var mg = px * 0.45; box = [cx - nw / 2 - mg, nameTop - mg, cx + nw / 2 + mg, nameTop + nh + mg];
      var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "folio-masthead-rays"); svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "position:absolute;left:0;top:0;width:100%;height:" + H + "px;overflow:visible;pointer-events:none";
      // only the halo's upper half shows (a sunrise behind the name); lines also stop at the name
      var mid = "fm" + Math.random().toString(36).slice(2, 7), cut = hc;
      var lower = '<rect x="' + (cx - Rh - px * 3) + '" y="' + cut + '" width="' + (2 * Rh + px * 6) + '" height="9999" fill="black"/>';
      svg.innerHTML = '<defs><mask id="' + mid + '"><rect x="-9999" y="-9999" width="99999" height="99999" fill="white"/>' + lower +
        '<rect x="' + box[0] + '" y="' + box[1] + '" width="' + (box[2] - box[0]) + '" height="' + (box[3] - box[1]) + '" rx="' + px + '" fill="black"/></mask>' +
        '<mask id="' + mid + 'f"><rect x="-9999" y="-9999" width="99999" height="99999" fill="white"/>' + lower + '</mask></defs>';
      var gf = document.createElementNS(NS, "g"); gf.setAttribute("mask", "url(#" + mid + "f)"); svg.appendChild(gf);
      var g = document.createElementNS(NS, "g"); g.setAttribute("mask", "url(#" + mid + ")"); svg.appendChild(g);
      var below = function (x, y) { return y > cut - px * 0.3 && Math.abs(x - cx) < Rh + px * 2; };
      art.insertBefore(svg, art.firstChild);
      var GOLD = "var(--accent-4, #b8860b)", RED = "var(--accent)";
      var el = function (tag, at) { var e = document.createElementNS(NS, tag); for (var k2 in at) e.setAttribute(k2, at[k2]); g.appendChild(e); return e; };
      // tapering stroke through points: short segments of decreasing width
      var taper = function (pts, w0, w1, col) {
        for (var i2 = 1; i2 < pts.length; i2++) {
          var w = w0 + (w1 - w0) * i2 / pts.length;
          el("line", { x1: pts[i2 - 1][0].toFixed(1), y1: pts[i2 - 1][1].toFixed(1), x2: pts[i2][0].toFixed(1), y2: pts[i2][1].toFixed(1), stroke: col, "stroke-width": w.toFixed(2), "stroke-linecap": "round" });
        }
      };
      // the halo
      var disc = document.createElementNS(NS, "circle");
      disc.setAttribute("cx", cx); disc.setAttribute("cy", hc); disc.setAttribute("r", Rh); disc.setAttribute("fill", GOLD); disc.setAttribute("fill-opacity", ".07");
      gf.appendChild(disc);
      el("circle", { cx: cx, cy: hc, r: Rh, fill: "none", stroke: GOLD, "stroke-width": 2.4 });
      el("circle", { cx: cx, cy: hc, r: Rh - px * 0.32, fill: "none", stroke: GOLD, "stroke-width": 0.9 });
      el("circle", { cx: cx, cy: hc, r: Rh - px * 1.75, fill: "none", stroke: RED, "stroke-width": 1.1 });
      el("circle", { cx: cx, cy: hc, r: Rh * 0.55, fill: "none", stroke: GOLD, "stroke-width": 0.9, "stroke-dasharray": "1 5", "stroke-linecap": "round" });
      for (var sp = 0; sp < 48; sp++) {                              // fine spokes between the rings
        var as = sp * Math.PI / 24;
        el("line", { x1: cx + Math.cos(as) * Rh * 0.58, y1: hc + Math.sin(as) * Rh * 0.58, x2: cx + Math.cos(as) * (Rh - px * 2.05), y2: hc + Math.sin(as) * (Rh - px * 2.05),
          stroke: GOLD, "stroke-width": sp % 2 ? 0.5 : 0.9, "stroke-opacity": sp % 2 ? ".5" : ".85" });
      }
      // the mosaic band: flowers and petals round the rim, mirrored (by angle from the top)
      var nb = Math.max(20, Math.round(2 * Math.PI * (Rh - px) / (px * 1.25))); nb += nb % 4 ? 4 - nb % 4 : 0;
      for (var b2 = 0; b2 < nb; b2++) {
        var ab = -Math.PI / 2 + b2 * 2 * Math.PI / nb, jb = Math.min(b2, nb - b2);
        var tokb = jb === 0 ? blooms[0] : jb % 2 ? "·" : jb % 4 === 2 ? petals[(jb * 3) % petals.length] : blooms[(jb / 4) % blooms.length];
        if (below(cx + Math.cos(ab) * (Rh - px), hc + Math.sin(ab) * (Rh - px))) continue;
        put(tokb, cx + Math.cos(ab) * (Rh - px * 1.02), hc + Math.sin(ab) * (Rh - px * 1.02), jb === 0 ? 1 : jb % 2 ? 0.6 : 0.72, 0, jb % 2 ? GOLD : FOLK[(jb / 2) % FOLK.length]);
      }
      // whiplash curves: from beside the name, out and up, rolling into a spiral
      for (var sg = -1; sg <= 1; sg += 2) {
        var pts = [], x0 = cx + sg * (nw / 2 + px * 0.9), y0 = nameTop + nh * 0.72;
        var sx = cx + sg * Math.min(W / 2 - px * 2.2, nw / 2 + Rh * 0.95), sy = hc - Rh * 0.25, rs = px * 2.1;
        // an S-curve (cubic) out to the spiral's rim, then the spiral in
        var c1 = [x0 + sg * px * 3.5, y0 + px * 1.2], c2 = [sx + sg * rs * 1.6, sy + rs * 2.4], e1 = [sx + sg * rs, sy];
        for (var u = 0; u <= 30; u++) {
          var t = u / 30, mt = 1 - t;
          pts.push([mt * mt * mt * x0 + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * e1[0],
                    mt * mt * mt * y0 + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * e1[1]]);
        }
        for (var v = 1; v <= 34; v++) {                              // spiral: up and back in
          var th = -sg * v * 0.2, rr = rs * Math.pow(0.955, v);
          pts.push([sx + sg * Math.cos(th) * rr, sy + Math.sin(-v * 0.2) * rr]);
        }
        taper(pts, 1.2, 3.4, RED);
        // a second, finer line alongside the sweep (art nouveau double line)
        taper(pts.slice(2, 28).map(function (p) { return [p[0], p[1] - px * 0.42]; }), 0.6, 1.2, GOLD);
        put(blooms[1 % blooms.length], sx, sy, 1.25, 0, FOLK[0]);     // bloom at the spiral's heart
        // leaves along the sweep, turned with it
        for (var lv = 6; lv < 28; lv += 5) {
          var q1 = pts[lv], q0 = pts[lv - 1], an = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]);
          put(sg < 0 ? leaves[0] : window.Glyphs.partner(leaves[0]), q1[0] - Math.sin(an) * px * 0.7, q1[1] + Math.cos(an) * px * 0.7, 0.8, an * 180 / Math.PI + 90 * sg, "#5f8f4e");
        }
      }
      // the finial on top of the halo: a tall bloom between leaves, dots rising above
      var fy2 = hc - Rh;
      put(blooms[0], cx, fy2 - px * 0.2, 1.8, 0, FOLK[2]);
      put(leaves[0], cx - px * 1.35, fy2 + px * 0.25, 1.05, -40, "#5f8f4e");
      put(window.Glyphs.partner(leaves[0]), cx + px * 1.35, fy2 + px * 0.25, 1.05, 40, "#5f8f4e");
      put("·", cx, fy2 - px * 1.55, 0.8, 0, RED); put("·", cx, fy2 - px * 2.15, 0.6, 0, RED);
    } else if (kind === "wreath") {
      var rx = nw / 2 + px * 1.9, ry = nh / 2 + px * 2.3, cyc = ry + px * 0.8;
      nameTop = cyc - nh / 2; H = cyc + ry + px * 1.6;
      wreath(rx, ry, cyc, 0.82);
    } else {
      var rx2 = nw / 2 + px * 1.9, ry2 = nh / 2 + px * 1.9, ay2 = ry2 + px * 1.4, cy2 = ay2 + px * 1.5;
      nameTop = cy2 - nh / 2; H = cy2 + ry2 + px * 1.6;
      arch(rx2 + px * 0.3, ay2, cy2, false);
      wreath(rx2, ry2, cy2, 0.46);
    }
    art.style.height = H + "px";
    name.style.top = nameTop + "px";
    // glyphs drawn above the box (the birds) would be cut off at the top of the page: make room
    var minY = 0;
    Array.prototype.forEach.call(art.querySelectorAll(".glyph-orn"), function (e) { minY = Math.min(minY, e._my - (parseFloat(e.style.fontSize) || px) * 0.6); });
    art.style.marginTop = minY < 0 ? Math.ceil(-minY + 4) + "px" : "";
    if (fx) fx.measure();
  }

  // The settings entry (entries/settings.hel) holds a `folio-config` group; this fills it with a
  // configurator: which schemes and patterns the panel offers and Randomise draws from, and the
  // home masthead. Choices are saved in this browser.
  function configurator() {
    var host = document.querySelector(".helia-folio-config");
    if (!host) return;
    host.innerHTML = "";
    var sec = function (title, note) { var h = document.createElement("h3"); h.textContent = title; host.appendChild(h); if (note) { var p = document.createElement("p"); p.className = "folio-cfg-note"; p.textContent = note; host.appendChild(p); } var d = document.createElement("div"); d.className = "folio-cfg-grid"; host.appendChild(d); return d; };
    var toggleAll = function (listKey, all, on) { config[listKey] = on ? keys(all) : []; saveConfig(); configurator(); };
    var tools = function (grid, listKey, all) { var t = document.createElement("div"); t.className = "folio-cfg-tools";
      [["All", true], ["None", false]].forEach(function (x) { var b = document.createElement("button"); b.type = "button"; b.textContent = x[0]; b.addEventListener("click", function () { toggleAll(listKey, all, x[1]); }); t.appendChild(b); });
      grid.parentNode.insertBefore(t, grid); };
    var item = function (grid, listKey, k, label, sw, use, current) {
      var row = document.createElement("label"); row.className = "folio-cfg-item" + (current ? " is-current" : "");
      var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = config[listKey].indexOf(k) >= 0;
      cb.addEventListener("change", function () { var l = config[listKey].filter(function (x) { return x !== k; }); if (cb.checked) l.push(k); config[listKey] = l; saveConfig(); configurator(); });
      row.appendChild(cb);
      if (sw) { var s2 = document.createElement("span"); s2.className = "folio-sw"; sw.forEach(function (c) { var i = document.createElement("i"); i.style.background = c; s2.appendChild(i); }); row.appendChild(s2); }
      row.appendChild(document.createTextNode(label));
      var u = document.createElement("button"); u.type = "button"; u.textContent = current ? "in use" : "use"; u.disabled = current;
      u.addEventListener("click", function (ev) { ev.preventDefault(); use(k); configurator(); }); row.appendChild(u);
      grid.appendChild(row);
    };
    var g1 = sec("Colour schemes", "Ticked schemes are offered in the ⚙ panel and drawn by ⚄ Randomise. \"use\" switches to one now.");
    tools(g1, "schemes", SCHEMES);
    SCHEMES.forEach(function (x) { item(g1, "schemes", x[0], x[1], x[2], setScheme, x[0] === scheme); });
    var g2 = sec("Ornament patterns", "The pattern in the margins; ⚄ Randomise draws from the ticked ones.");
    config.patterns = enabledPatterns(); config.patternsSeen = keys(PATTERNS); saveConfig();   // drop deleted, tick new
    tools(g2, "patterns", PATTERNS);
    PATTERNS.forEach(function (x) { item(g2, "patterns", x[0], x[1], null, setPattern, x[0] === pattern); });
    var g3 = sec("Home page masthead", "The ornament around the name on the home page.");
    MASTHEADS.forEach(function (x) {
      var row = document.createElement("label"); row.className = "folio-cfg-item";
      var rb = document.createElement("input"); rb.type = "radio"; rb.name = "folio-masthead"; rb.checked = (config.masthead || "flanked") === x[0];
      rb.addEventListener("change", function () { config.masthead = x[0]; saveConfig(); configurator(); });
      row.appendChild(rb); row.appendChild(document.createTextNode(x[1]));
      var a = document.createElement("a"); a.textContent = "preview"; a.href = "home.html?masthead=" + x[0]; row.appendChild(a);
      g3.appendChild(row);
    });
    var gb = sec("Boxes", "How framed boxes (the home page's introduction) are drawn.");
    BOXES.forEach(function (x) {
      var row = document.createElement("label"); row.className = "folio-cfg-item";
      var rb = document.createElement("input"); rb.type = "radio"; rb.name = "folio-boxes"; rb.checked = (config.boxes || "double") === x[0];
      rb.addEventListener("change", function () { setBoxes(x[0]); configurator(); });
      row.appendChild(rb); row.appendChild(document.createTextNode(x[1])); gb.appendChild(row);
    });
    var gh = sec("Hyphenation", "Body text. Browsers have no TeX-style penalty; \"heavy penalty\" only breaks words of 10+ letters, leaving 4 on each side, and balances whole paragraphs.");
    HYPHENS.forEach(function (x) {
      var row = document.createElement("label"); row.className = "folio-cfg-item";
      var rb = document.createElement("input"); rb.type = "radio"; rb.name = "folio-hyphens"; rb.checked = (config.hyphens || "penalty") === x[0];
      rb.addEventListener("change", function () { config.hyphens = x[0]; saveConfig(); applyBoxes(); configurator(); });
      row.appendChild(rb); row.appendChild(document.createTextNode(x[1])); gh.appendChild(row);
    });
    var gp = sec("Guaranteed placements", "The library's `place` list (the cats and the Phoenician signature, to start): each put somewhere on every page.");
    [[true, "On"], [false, "Off"]].forEach(function (x) {
      var row = document.createElement("label"); row.className = "folio-cfg-item";
      var rb = document.createElement("input"); rb.type = "radio"; rb.name = "folio-place"; rb.checked = (config.place !== false) === x[0];
      rb.addEventListener("change", function () { config.place = x[0]; saveConfig(); applyPlace(); redraw(); configurator(); });
      row.appendChild(rb); row.appendChild(document.createTextNode(x[1])); gp.appendChild(row);
    });
    var g4 = sec("Ornament and motion", null);
    [["full", "Ornament, moving"], ["still", "Ornament, still"], ["off", "No ornament"]].forEach(function (x) {
      var row = document.createElement("label"); row.className = "folio-cfg-item";
      var rb = document.createElement("input"); rb.type = "radio"; rb.name = "folio-mode"; rb.checked = mode === x[0];
      rb.addEventListener("change", function () { setMode(x[0]); });
      row.appendChild(rb); row.appendChild(document.createTextNode(x[1])); g4.appendChild(row);
    });
    var gx = sec("Make these the site's configuration", "These choices only apply in this browser until they are in the theme: replace `var SITE = …` in theme/folio.js with this, then commit.");
    var out = document.createElement("pre"); out.className = "folio-cfg-out";
    out.textContent = "  var SITE = " + JSON.stringify({ schemes: config.schemes, patterns: config.patterns, masthead: config.masthead, boxes: config.boxes, hyphens: config.hyphens, place: config.place }) + ";";
    gx.appendChild(out);
    var cp = document.createElement("button"); cp.type = "button"; cp.className = "folio-cfg-reset"; cp.textContent = "Copy";
    cp.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(out.textContent).then(function () { cp.textContent = "Copied"; }); });
    gx.appendChild(cp);
    var reset = document.createElement("button"); reset.type = "button"; reset.className = "folio-cfg-reset"; reset.textContent = "Reset to the site's configuration";
    reset.addEventListener("click", function () { try { [CKEY, SKEY, PKEY, KEY].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} location.reload(); });
    host.appendChild(reset);
  }

  // The ornament workshop (entries/ornaments.hel) holds the editable pieces as glyph-art widgets;
  // their props on that page are the configuration: glyph bags, masthead motifs, sampler motifs.
  var ORN = {};
  function parseBrush(line) {
    var m = /^\s*(\S)\s*=\s*(.*?)\s*(?::\s*([^:]*?))?\s*$/.exec(line || "");
    return m ? { key: m[1], glyphs: m[2].split(/\s+/).filter(Boolean), color: (m[3] || "ink").trim() } : null;
  }
  // The ornament library lives on the ornaments page (its glyph-art and ornament-library widgets).
  // Fetching and parsing that page on every load held up the whole ornament, so the widgets' data
  // is kept in localStorage: the ornament draws from it at once, while the page is fetched in the
  // background and, when it changed, stored and drawn again.
  var ORN_KEY = "folio-ornaments";
  function fetchOrnaments() {
    var home = document.querySelector(".helia-topbar .helia-home, link[rel=stylesheet][href$='helia/theme.css']");
    var base = home && home.getAttribute("href") ? home.getAttribute("href").replace(/(helia\/theme\.css|[^/]*)$/, "") : "";
    return fetch(base + "ornaments.html").then(function (r) { return r.ok ? r.text() : ""; }).then(function (html) {
      if (!html) return null;
      // large props are written to a file (data-props-src) instead of inline: fetch those
      var d = new DOMParser().parseFromString(html, "text/html");
      var els = Array.prototype.slice.call(d.querySelectorAll('[data-widget="glyph-art"], [data-widget="ornament-library"]'));
      return Promise.all(els.map(function (e) {
        var src = e.getAttribute("data-props-src");
        var got = src ? fetch(base + src).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }) : Promise.resolve(e.getAttribute("data-props"));
        return got.then(function (t) { return t ? { w: e.getAttribute("data-widget"), p: t } : null; });
      })).then(function (list) { return list.filter(Boolean); });
    }).catch(function () { return null; });
  }
  function loadOrnaments() {
    var cached = null;
    try { cached = localStorage.getItem(ORN_KEY); } catch (e) {}
    var fresh = fetchOrnaments().then(function (list) {
      if (!list) return null;
      var text = JSON.stringify(list);
      try { localStorage.setItem(ORN_KEY, text); } catch (e) {}
      return text === cached ? null : list;
    });
    if (cached) {
      try { useOrnaments(JSON.parse(cached)); } catch (e) {}
      // changed since it was cached: use the new library and draw again
      fresh.then(function (list) { if (list) { useOrnaments(list); masthead(); apply(); placeDice(); } });
      return Promise.resolve();
    }
    return fresh.then(function (list) { if (list) useOrnaments(list); });
  }
  function useOrnaments(props) {
    try {
      props.filter(function (x) { return x.w === "glyph-art"; }).forEach(function (e) {
        try {
          var p = JSON.parse(e.p), br = {};
          (p.brushes || []).map(parseBrush).filter(Boolean).forEach(function (b) { br[b.key] = b; });
          ORN[p.id] = { rows: p.rows || [], brushes: br, tags: p.tags || [] };
        } catch (x) {}
      });
      // pictures, with their brushes as grammar expressions
      props.filter(function (x) { return x.w === "glyph-art"; }).forEach(function (e) {
        try {
          var p = JSON.parse(e.p), br = {};
          (p.brushes || []).forEach(function (line) {
            var m = /^\s*(\S)\s*=\s*(.*?)\s*(?::\s*([^:]*?))?\s*$/.exec(line);
            if (m) try { br[m[1]] = { e: window.Ornament.parse(m[2]), col: (m[3] || "").trim() || null }; } catch (x) {}
          });
          PICS[p.id] = { rows: p.rows || [], cell: p.cell || 1, brushes: br };
        } catch (x) {}
      });
      var libEl = props.filter(function (x) { return x.w === "ornament-library"; })[0];
      if (libEl && window.Ornament) {
        try { LIB = window.Ornament.library(JSON.parse(libEl.p).defs || []); } catch (x) { LIB = null; }
      }
      if (LIB) {
        // try a definition without saving it: ?orn.<name>=<expression> overrides it for this page
        try { new URLSearchParams(location.search).forEach(function (v, k) { if (k.indexOf("orn.") === 0) LIB.defs[k.slice(4)] = { e: window.Ornament.parse(v), src: v }; }); } catch (x) {}
        window.FolioLibrary = { lib: LIB, pictures: PICS };
        // the glyph bags every procedural pattern draws from
        var glyphsOf = function (e, seen) {
          if (!e) return [];
          if (e.t === "lit") return [e.w];
          if (e.t === "word") return LIB.defs[e.w] && !(seen || {})[e.w] ? glyphsOf(LIB.defs[e.w].e, Object.assign({}, seen, { [e.w]: 1 })) : [e.w];
          if (e.t === "choice") return e.alts.reduce(function (a, x) { return a.concat(glyphsOf(x.e, seen)); }, []);
          return [];
        };
        var role = { flower: "bloom", leaf: "leaf", petal: "petal", stem: "stem", filler: "filler", bud: "bud" };
        OPTS.bags = {};
        Object.keys(role).forEach(function (k) { if (LIB.defs[k]) OPTS.bags[role[k]] = glyphsOf(LIB.defs[k].e); });
        // the patterns on offer: the disjuncts of `patterns`
        var ds = window.Ornament.disjuncts(LIB, "patterns").filter(function (x) { return x.name; });
        if (ds.length) {
          PATTERNS = ds.map(function (x) { return [x.name, x.name]; });
          if (storedPattern && PATTERNS.some(function (x) { return x[0] === storedPattern; })) pattern = storedPattern;
          if (!PATTERNS.some(function (x) { return x[0] === pattern; })) pattern = enabledPatterns()[0] || PATTERNS[0][0];
        }
        usePattern(pattern);
        applyPlace();
        flourishes();
        document.dispatchEvent(new CustomEvent("folio-library"));
      }
      OPTS.motifs = Object.keys(ORN).filter(function (id) { return ORN[id].tags.indexOf("ornament-sampler") >= 0; }).sort().map(function (id) { return ORN[id]; });
    } catch (x) {}
  }

  // Typographic flourishes from the library: the headpiece's and tailpiece's centres, dividers
  // between top-level sections, an end mark after the last paragraph, and list bullets.
  function realizeName(name, key, seed) {
    if (!LIB || !LIB.defs[name]) return null;
    var d = window.Ornament.realize(LIB.defs[name].e, { defs: LIB.defs, r: window.Ornament.rng((seed || VISIT) + "|" + name + "|" + (key || "")), pictures: PICS });
    return d.items.length ? d : null;
  }
  // What sits in the text (dividers, the end mark, bullets) is drawn per page and week, not per
  // visit: it shapes the text, so the next visit's margins (precomputed around this text) fit it.
  var INTEXT = location.pathname + "|" + Math.floor(Date.now() / 6048e5);
  // A garland for the rules, gathered from a pattern: draw it a few times, take its most used single
  // glyphs (with their colours), and set them in a mirrored run tapering out from a larger centre.
  var BUILTIN_GLYPHS = { "night-sky": ["✦", "✧", "⋆", "∗", "✦", "·"], "cross-stitch": ["⊕", "⊗", "×", "✿", "⊕", "λ"], constellation: ["✦", "✧", "⋆", "∗"], sampler: ["⊕", "⊗", "×", "✿"] };
  function patternGarland(k, tail) {
    var O = window.Ornament, seen = new Map();
    if (LIB.defs[k]) {
      for (var i = 0; i < 6; i++) {
        var d = O.realize(LIB.defs[k].e, { defs: LIB.defs, r: O.rng("garland|" + k + "|" + i), pictures: PICS });
        d.items.forEach(function (it) {
          if (it.seg || !it.tok || Array.from(it.tok).length !== 1 || /\s/.test(it.tok)) return;
          var key = it.tok + "|" + (it.col || ""), e = seen.get(key) || { tok: it.tok, col: it.col || null, n: 0 };
          e.n++; seen.set(key, e);
        });
      }
    } else (BUILTIN_GLYPHS[k] || []).forEach(function (t, j) { seen.set(t + j, { tok: t, col: null, n: 10 - j }); });
    var byTok = new Map();                       // one colour per glyph (its commonest), best first
    Array.from(seen.values()).sort(function (a, b) { return b.n - a.n; }).forEach(function (e) { if (!byTok.has(e.tok)) byTok.set(e.tok, e); });
    var list = Array.from(byTok.values()).slice(0, 7);
    if (!list.length) return null;
    if (tail === "list") return list;
    var r = O.rng(VISIT + "|garland|" + k + (tail ? "t" : "h")), showy = list.filter(function (e) { return /[✿❀❁✾✦✧★⋆❦⊕⊗Σ∀]/.test(e.tok); });
    var centre = showy.length ? showy[Math.floor(r() * Math.min(2, showy.length))] : list[0];
    var items = [{ tok: centre.tok, x: 0, y: 0, s: 1.4, col: centre.col }], n = 8, gap = 1.1, run = [];
    for (var j = 0; j < n; j++) run.push(list[(j + 1 + Math.floor(r() * 2)) % list.length]);
    run.forEach(function (e, j) {
      var s2 = Math.max(0.62, 1.1 - j * 0.06), x = 1.3 + j * gap;
      items.push({ tok: e.tok, x: -x, y: 0, s: s2, col: e.col }, { tok: e.tok, x: x, y: 0, s: s2, col: e.col });
    });
    return { items: items, w: 2 * (1.3 + n * gap), h: 1.4 };
  }
  function flourishes() {
    if (!LIB) return;
    // the garland at the centre of the top and foot rules: the library's headpiece/tailpiece when
    // defined, else `<pattern>-rule`, else one gathered from the current pattern's own glyphs
    OPTS.headCentre = function (tail) {
      if (LIB.defs.headpiece || LIB.defs.tailpiece) return realizeName(tail && LIB.defs.tailpiece ? "tailpiece" : "headpiece", tail ? "t" : "h");
      if (LIB.defs[pattern + "-rule"]) return realizeName(pattern + "-rule", tail ? "t" : "h");
      return patternGarland(pattern, tail);
    };
    // otherwise the rules at the top and foot of notes are the home page's divider: rule-centre
    // between runs of the pattern's glyphs, with rule-side in each, on the beaded double rule
    // (no rule band: every theme's notes open with the headpiece's own double rule, a garland run at its middle)
    OPTS.ruleBand = null;
    var O = window.Ornament, colourOf = function (tok) { return FOLK[Math.abs(Array.from(tok).reduce(function (a, c) { return a * 31 + c.codePointAt(0); }, 7)) % FOLK.length]; };
    var draw = function (d, px, cls) { var box = document.createElement("div"); box.className = cls; box.setAttribute("aria-hidden", "true"); var inner = document.createElement("span"); O.renderInto(document, inner, d, px, { colour: colourOf }); box.appendChild(inner); return box; };
    document.querySelectorAll(".folio-divider, .folio-end").forEach(function (e) { e.remove(); });
    if (LIB.defs.divider) {
      var secs = document.querySelectorAll(".helia-body > .helia-heading-section[data-level='1']");
      for (var i = 1; i < secs.length; i++) { var d = realizeName("divider", i, INTEXT); if (d) secs[i].parentNode.insertBefore(draw(d, Math.min(20, 44 / Math.max(d.h, 1)), "folio-divider"), secs[i]); }
    }
    if (LIB.defs.end) {
      var ps = document.querySelectorAll(".helia-body > p"), last = ps[ps.length - 1];
      var de = realizeName("end", "", INTEXT);
      if (last && de && !document.querySelector(".helia-home-hero")) { var e = draw(de, Math.min(18, 22 / Math.max(de.h, 1)), "folio-end"); e.style.display = "inline-block"; e.style.marginLeft = ".45em"; e.style.verticalAlign = "-.2em"; last.appendChild(e); }
    }
    if (LIB.defs.bullet) {
      var toks = [1, 2, 3].map(function (k) { var d = realizeName("bullet", k, INTEXT); return d && d.items[0] ? d.items[0].tok : null; });
      if (toks[0]) document.documentElement.style.setProperty("--b1", JSON.stringify(toks[0]));
      if (toks[1]) document.documentElement.style.setProperty("--b2", JSON.stringify(toks[1]));
      if (toks[2]) document.documentElement.style.setProperty("--b3", JSON.stringify(toks[2]));
    }
  }

  // the guaranteed placements: the library's `place` list, unless switched off
  function applyPlace() {
    if (!LIB) return;
    // the site's `place` list, plus the current pattern's own (`<pattern>-place`, e.g. the moon in the night sky)
    var extra = LIB.defs[pattern + "-place"] ? window.Ornament.list(LIB, pattern + "-place") : [];
    OPTS.place = config.place === false ? [] : window.Ornament.list(LIB, "place").concat(extra).map(function (e) {
      return function (r) { return window.Ornament.realize(e, { defs: LIB.defs, r: r, pictures: PICS }); };
    });
  }

  // Clicking things in the margins: the cats are Finn (orange) and Leo (grey), the Phoenician is my
  // name, :wq tries to quit, and any drawn shape re-blooms as a new one.
  function siteBase() { var h = document.querySelector(".helia-topbar .helia-home"); return h && h.getAttribute("href") ? h.getAttribute("href").replace(/[^/]*$/, "") : ""; }
  function note(title, text, img) {
    var old = document.querySelector(".folio-note"); if (old) old.remove();
    var box = document.createElement("div"); box.className = "folio-note"; box.setAttribute("role", "dialog");
    var card = document.createElement("div"); card.className = "folio-note-card";
    if (img) {
      var ph = document.createElement("div"); ph.className = "folio-note-photo";
      var im = document.createElement("img"); im.src = img; im.alt = title; im.onerror = function () { ph.remove(); }; ph.appendChild(im); card.appendChild(ph);
      if (window.GlyphPortrait) window.GlyphPortrait.attach(im);   // a click on the photo cycles it through symbols
    }
    var t = document.createElement("div"); t.className = "folio-note-title"; t.textContent = title; card.appendChild(t);
    if (text) { var p = document.createElement("div"); p.className = "folio-note-text"; p.textContent = text; card.appendChild(p); }
    box.appendChild(card); document.body.appendChild(box);
    var close = function () { box.remove(); removeEventListener("keydown", onKey); };
    var onKey = function (ev) { if (ev.key === "Escape") close(); };
    box.addEventListener("click", close); addEventListener("keydown", onKey);
  }
  function vim() {
    // (no window.close(): browsers treat it unpredictably; this is Vim failing to quit, as ever)
    setTimeout(function () {
      var old = document.querySelector(".folio-vim"); if (old) old.remove();
      var bar = document.createElement("div"); bar.className = "folio-vim"; bar.textContent = ":wq";
      document.body.appendChild(bar);
      var file = (location.pathname.split("/").pop() || "home.html").replace(/\.html$/, ".hel");
      setTimeout(function () { bar.textContent = '"' + file + '" written'; }, 500);
      setTimeout(function () { bar.innerHTML = ""; var e = document.createElement("span"); e.className = "err"; e.textContent = "E444: Cannot close last window"; bar.appendChild(e); }, 1400);
      setTimeout(function () { bar.remove(); }, 4200);
    }, 150);
  }
  // any other glyph swaps to another symbol and colour, with a little pop
  var SWAP = ["✿", "❀", "✦", "✧", "⋆", "⊕", "⊗", "∀", "∃", "Σ", "Π", "λ", "β", "η", "❧", "❦", "∧", "∨", "⊸", "⟜"];
  var SWAPCOL = ["var(--accent)", "var(--accent-2)", "var(--accent-3)", "var(--accent-4)", "var(--accent-5, var(--accent))"];
  function swapGlyph(e) {
    var t = e.firstElementChild || e, cur = t.textContent, next = cur;
    while (next === cur) next = SWAP[Math.floor(Math.random() * SWAP.length)];
    t.textContent = next; e.style.color = SWAPCOL[Math.floor(Math.random() * SWAPCOL.length)];
    if (e.animate) e.animate([{ transform: "scale(1.6) rotate(-20deg)" }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.3,1.2)" });
  }
  document.addEventListener("glyphs-changed", function () { if (fx) fx.measure(); });
  // a hidden keyboard shortcut: type "roll" (outside any text field) to randomise the theme
  var typed = "";
  document.addEventListener("keydown", function (ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.key.length !== 1) return;
    var t = ev.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    typed = (typed + ev.key.toLowerCase()).slice(-4);
    if (typed === "roll") { typed = ""; shuffle(); }
  });
  document.addEventListener("click", function (ev) {
    if (ev.target.closest && ev.target.closest("a, button, input, .folio-note, .folio-pop")) return;
    var orn = ev.target.closest && ev.target.closest(".glyph-orn, .glyph-stow");
    if (!orn) return;
    var g = orn.closest(".glyph-stow") || orn;
    if (!g.classList.contains("glyph-stow")) {
      var L = g.closest(".glyph-margins"), pid = g.dataset && g.dataset.piece;
      if (pid && L && L._shapes && L._shapes.has(pid)) { L._reroll(pid); return; }   // a piece: a new shape in its place
      // in the masthead (the wreath, the divider): the whole element it belongs to is drawn anew
      var host = g.closest("[data-reroll-host]");
      if (pid && host && host._reroll) { host._reroll(pid); return; }
      swapGlyph(g); return;                                                          // a lone glyph: another one
    }
    var text = g.textContent || "", colour = (g.innerHTML.match(/#[0-9a-f]{6}/i) || [""])[0].toLowerCase();
    if (text.indexOf("ᓚ") >= 0 || text.indexOf("ᗢ") >= 0) {
      // which cat: the grey one's colour has almost no saturation (whatever the scheme)
      var sp = g.querySelector("span") || g, m = (getComputedStyle(sp).color.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
      var grey = Math.max.apply(null, m) - Math.min.apply(null, m) < 40;
      if (grey) note("You found Leo!", "", siteBase() + "cats/leo.jpg");
      else note("You found Finn!", "", siteBase() + "cats/finn.jpg");
    } else if (/[\u{10900}-\u{1091F}]/u.test(text)) note("𐤎𐤕𐤅𐤍 𐤔𐤐𐤓", "That's my name in Phoenician!");
    else if (text.indexOf(":wq") >= 0) vim();
    else if (/[⚀-⚅]/.test(text)) shuffle();   // the hidden die: a new theme
    else if (g.querySelector("[data-moon]") || g.hasAttribute("data-moon")) {
      var m = window.Ornament.moonPhase(new Date()), now = new Date();
      var fmt = function (d) { return d ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "not today"; };
      var say = function (lat, lon, where) {
        var tm = window.Ornament.moonTimes(now, lat, lon);
        note("Tonight's moon", "The moon is " + m.name.toLowerCase().replace(/ moon$/, "").replace(/^(first|last) quarter$/, "at its $1 quarter") + ", " + Math.round(m.lit * 100) + "% lit. " +
          (where ? "Where you are" + (where === "rough" ? " (roughly)" : "") + ", it rises " + fmt(tm.rise) + " and sets " + fmt(tm.set) + "." : ""));
      };
      // the reader's location: the browser's, if they allow it; else a rough guess from their clock
      // (longitude from the time-zone offset, a temperate latitude)
      var rough = function () {   // standard time (not daylight saving): the larger of January's and July's offsets
        var y = now.getFullYear(), off = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
        say(40, -off / 4, "rough");
      };
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (pos) { say(pos.coords.latitude, pos.coords.longitude, "here"); }, rough, { timeout: 6000, maximumAge: 36e5 });
      else rough();
    }
  });


  // Commands in the search palette: begin with ">" (">theme lapis", ">pattern night sky",
  // ">randomise", ">ornament off", ">motion off", ">boxes filled", ">reload"). The palette is
  // Helianthus's own; while the query starts with ">", its results give way to these.
  function commands() {
    var norm = function (x) { return String(x).toLowerCase().replace(/[^a-z0-9]+/g, ""); };
    var list = [];
    SCHEMES.forEach(function (sc) { list.push({ title: "Theme: " + sc[1], words: "theme scheme colours colors " + sc[1] + " " + sc[0], sw: sc[2], run: function () { setScheme(sc[0]); } }); });
    PATTERNS.forEach(function (pt) { list.push({ title: "Pattern: " + pt[0].replace(/-/g, " "), words: "pattern ornament margins " + pt[0].replace(/-/g, " "), run: function () { setPattern(pt[0]); } }); });
    list.push({ title: "Randomise the theme", words: "randomise randomize random shuffle roll dice theme", run: shuffle });
    list.push({ title: "Reset to the default theme", words: "reset default theme restore clear", run: function () {
      try { ["folio-scheme", "folio-pattern", "folio-ornament"].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
      location.reload();
    } });
    list.push({ title: "Ornament on", words: "ornament on show", run: function () { setMode(reduced ? "still" : "full"); } });
    list.push({ title: "Ornament off", words: "ornament off hide plain", run: function () { setMode("off"); } });
    list.push({ title: "Motion on", words: "motion on animate", run: function () { setMode("full"); } });
    [["sparse", "Density: sparse"], ["normal", "Density: normal"], ["dense", "Density: dense"]].forEach(function (d) {
      list.push({ title: d[1], words: "density ornament " + d[0] + (d[0] === "sparse" ? " light less fewer" : d[0] === "dense" ? " more full heavy" : " default"), run: function () {
        density = d[0]; OPTS.densityLevel = d[0]; try { localStorage.setItem("folio-density", d[0]); } catch (e) {} redraw();
      } });
    });
    list.push({ title: "Motion off", words: "motion off still", run: function () { setMode("still"); } });
    BOXES.forEach(function (bx) { list.push({ title: "Boxes: " + bx[1], words: "boxes box border " + bx[1] + " " + bx[0], run: function () { setBoxes(bx[0]); } }); });
    list.push({ title: "Redraw the ornament", words: "redraw reload refresh ornament", run: function () { VISIT = String(Date.now()); redraw(); } });
    list.push({ title: "Reload the page", words: "reload refresh page", run: function () { location.reload(); } });
    list.push({ title: "Site settings", words: "settings configure admin", run: function () { location.href = siteBase() + "settings.html"; } });
    return { list: list, match: function (q) {
      var ws = q.toLowerCase().split(/\s+/).filter(Boolean).map(norm);
      return list.filter(function (c) { var h = norm(c.title) + " " + c.words.toLowerCase().split(/\s+/).map(norm).join(" "); return ws.every(function (w) { return h.indexOf(w) >= 0; }); });
    } };
  }
  function hookPalette() {
    var input = document.querySelector(".helia-search-input");
    if (!input || input._folioCmd) return;
    input._folioCmd = true;
    input.setAttribute("placeholder", "Search…  (tag: kind: author:, or > for commands)");
    var list = document.querySelector(".helia-search-results"), status = document.querySelector(".helia-search-status");
    var box = document.createElement("ul"); box.className = "helia-search-results folio-cmds"; box.hidden = true;
    list.parentNode.insertBefore(box, list.nextSibling);
    var C = null, hits = [], active = 0;
    var show = function () {
      var on = /^\s*>/.test(input.value);
      box.hidden = !on; list.hidden = on;
      if (!on) return;
      C = C || commands(); hits = C.match(input.value.replace(/^\s*>/, "")); active = 0;
      box.replaceChildren();
      hits.slice(0, 40).forEach(function (c, i) {
        var li = document.createElement("li"); li.className = "helia-search-result folio-cmd" + (i === 0 ? " is-active" : "");
        var a = document.createElement("a"); a.className = "helia-search-link"; a.href = "#";
        var t = document.createElement("span"); t.className = "helia-search-title"; t.textContent = c.title; a.appendChild(t);
        if (c.sw) { var sw = document.createElement("span"); sw.className = "folio-sw"; c.sw.forEach(function (col) { var d = document.createElement("i"); d.style.background = col; sw.appendChild(d); }); a.appendChild(sw); }
        a.addEventListener("click", function (ev) { ev.preventDefault(); run(i); });
        a.addEventListener("mouseenter", function () { mark(i); });
        li.appendChild(a); box.appendChild(li);
      });
      var say = function () { if (status && !box.hidden) status.textContent = hits.length ? hits.length + " command" + (hits.length === 1 ? "" : "s") : "No commands"; };
      say(); setTimeout(say, 0); setTimeout(say, 120);   // after the palette's own (async) status update
    };
    var mark = function (i) { active = Math.max(0, Math.min(hits.length - 1, i)); Array.prototype.forEach.call(box.children, function (li, k) { li.classList.toggle("is-active", k === active); if (k === active) li.scrollIntoView({ block: "nearest" }); }); };
    var run = function (i) { var c = hits[i]; if (!c) return; var close = document.querySelector(".helia-search-close"); if (close) close.click(); c.run(); };
    input.addEventListener("input", show);
    input.addEventListener("keydown", function (ev) {   // before the palette's own keys, while in command mode
      if (box.hidden) return;
      if (ev.key === "ArrowDown") { ev.preventDefault(); ev.stopImmediatePropagation(); mark(active + 1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); ev.stopImmediatePropagation(); mark(active - 1); }
      else if (ev.key === "Enter") { ev.preventDefault(); ev.stopImmediatePropagation(); run(active); }
    }, true);
    show();
  }
  new MutationObserver(function () { if (document.querySelector(".helia-search-input")) hookPalette(); }).observe(document.body, { childList: true });

  // Every note shows its id after the date (the builder leaves it out of the header).
  function showId() {
    var h = document.querySelector(".helia-article > .helia-header[data-entry]");
    if (!h || document.querySelector(".folio-masthead") || h.querySelector(".folio-id")) return;
    var id = h.getAttribute("data-entry"), meta = h.querySelector(".helia-meta");
    if (!meta) { meta = document.createElement("div"); meta.className = "helia-meta"; h.appendChild(meta); }
    var a = document.createElement("a"); a.className = "folio-id"; a.href = id + ".html"; a.textContent = id;
    meta.appendChild(a);
  }
  showId();
  function start() {
    loadOrnaments().then(function () {
      masthead(); apply(); placeDice();
      try { performance.mark("folio-drawn"); } catch (e) {}
      setTimeout(placeDice, 300); configurator();
      // once the page has settled, precompute the next visit (idle time)
    });
  }

  // ---- snapshots: the next visit of this page, precomputed, so its glyphs paint with the text.
  // Stored per page and window width (folio-early.js reads them), valid for this theme version,
  // these settings and this ornament library; at most SNAP_MAX pages, the oldest dropped.
  var SNAP_MAX = 16, SNAP_BUDGET = 2.5e6;             // pages, and characters in all
  var snapChars = function (index) { var n = 0; index.forEach(function (k) { try { n += (localStorage.getItem(k) || "").length; } catch (e) {} }); return n; };
  // (the signature is folio-early.js's, which checks it before the first paint)
  function snapSig() { return window.folioSnapSig ? window.folioSnapSig() : null; }
  // The next visit is precomputed from within the first build (Glyphs' afterFirstBuild), against
  // the page as that build measured it. With the web fonts still loading (a first visit) it waits
  // for them: a snapshot measured in a fallback font would not match the next draw.
  function schedulePrecompute() {
    if (!document.fonts || document.fonts.status === "loaded") precomputeNext();
    else document.fonts.ready.then(function () { setTimeout(precomputeNext, 300); });
  }
  // The snapshot covers the screens around the reader (a reload comes back to the same place); when
  // the reader scrolls out of them and stops, it is precomputed again for there (idle time).
  var snapCover = null;
  addEventListener("scroll", function () {
    clearTimeout(snapCover && snapCover.t);
    if (!snapCover) return;
    snapCover.t = setTimeout(function () {
      var y = window.scrollY, vh = window.innerHeight;
      if (y >= snapCover.from && y + vh <= snapCover.to) return;
      (window.requestIdleCallback || function (f) { setTimeout(f, 50); })(precomputeNext, { timeout: 2000 });
    }, 400);
  }, { passive: true });
  function precomputeNext() {
    if (mode === "off" || !LIB || !snapSig() || !window.Glyphs.precompute || /[?&]orn\./.test(location.search)) return;
    var next = String(Date.now()) + "|n", saved = VISIT, snap = null;
    var y = window.scrollY, vh = window.innerHeight;
    var firstH = Math.max(2400, y + vh * 2.5), keepFrom = Math.max(0, y - vh), keepTo = y + vh * 2.5;
    VISIT = next; usePattern(pattern);                // (the pattern's pieces are drawn per visit)
    try { snap = window.Glyphs.precompute(Object.assign({ visit: next, firstH: firstH, keepFrom: keepFrom, keepTo: keepTo }, OPTS)); } catch (e) {}
    VISIT = saved; usePattern(pattern);
    if (!snap || !snap.margins) return;
    snapCover = { from: keepFrom, to: keepTo };
    var pack = window.folioSnapPack || function (x) { return x; };
    var rec = JSON.stringify({ sig: snapSig(), visit: next, firstH: firstH, fullH: snap.fullH, head: snap.head || "", margins: pack(snap.margins) });
    var key = "folio-snap:" + location.pathname, index = [];
    try { index = JSON.parse(localStorage.getItem("folio-snaps") || "[]"); } catch (e) {}
    index = index.filter(function (k) { return k !== key; }); index.push(key);
    for (var tries = 0; tries < 8; tries++) {
      while (index.length > SNAP_MAX || (index.length > 1 && snapChars(index.slice(0, -1)) + rec.length > SNAP_BUDGET)) { try { localStorage.removeItem(index.shift()); } catch (e) {} }
      try { localStorage.setItem(key, rec); localStorage.setItem("folio-snaps", JSON.stringify(index)); return; }
      catch (e) { if (index.length <= 1) return; try { localStorage.removeItem(index.shift()); } catch (x) {} }   // full: drop the oldest
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
