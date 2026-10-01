// portrait.js: a click on the home page's photo cycles it through three states: the photo, the photo shaded
// with mathematical symbols in its own colours, and the same in one colour. Each cell of the photo gets the
// symbol whose ink covers about as much of the cell as the photo there is light (on a dark page) or dark (on a
// light one); the symbols are measured in the page's own font and sorted by how much ink they carry.
(function () {
  "use strict";
  const SYMBOLS = ["·", "∘", "-", "+", "×", "λ", "σ", "π", "β", "η", "∀", "Π", "Σ", "Δ", "Γ", "ℕ", "⊕", "⊗", "≡", "#", "∃", "⊢", "Φ"];
  const CELL = 6;                                            // px per symbol at the photo's displayed size

  function ramp(font) {                                     // the symbols, lightest first, with their ink cover
    const c = document.createElement("canvas"), n = 48; c.width = c.height = n;
    const x = c.getContext("2d"), out = [];
    for (const t of SYMBOLS) {
      x.clearRect(0, 0, n, n); x.font = n * 0.8 + "px " + font; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#000";
      x.fillText(t, n / 2, n / 2);
      const d = x.getImageData(0, 0, n, n).data; let ink = 0; for (let i = 3; i < d.length; i += 4) ink += d[i];
      out.push({ t, ink });
    }
    out.sort((a, b) => a.ink - b.ink);
    const max = out[out.length - 1].ink || 1; out.forEach(o => { o.ink /= max; });
    return out;
  }
  const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  function mosaic(img, canvas, coloured) {
    const W = img.clientWidth, H = img.clientHeight, dpr = window.devicePixelRatio || 1;
    const cols = Math.max(8, Math.round(W / CELL)), rows = Math.max(8, Math.round(H / CELL * 0.92)), cw = W / cols, ch = H / rows;
    const s = document.createElement("canvas"); s.width = cols; s.height = rows;
    const sx = s.getContext("2d", { willReadFrequently: true }); sx.drawImage(img, 0, 0, cols, rows);
    const px = sx.getImageData(0, 0, cols, rows).data;
    const cs = getComputedStyle(document.documentElement), font = getComputedStyle(document.body).fontFamily;
    const paper = cs.getPropertyValue("--paper").trim() || "#fff", probe = document.createElement("canvas").getContext("2d");
    probe.fillStyle = paper; probe.fillRect(0, 0, 1, 1); const pp = probe.getImageData(0, 0, 1, 1).data, dark = lum(pp[0], pp[1], pp[2]) < 0.5;
    const R = canvas._ramp || (canvas._ramp = ramp(font));
    // ink wanted per cell, equalised: a cell's rank among all the cells' brightness, so the whole ramp is used
    // and the face keeps its detail
    const raw = []; for (let i = 0; i < cols * rows; i++) { const v = lum(px[4 * i], px[4 * i + 1], px[4 * i + 2]); raw.push(dark ? v : 1 - v); }
    const order = raw.map((v, i) => i).sort((a, b) => raw[a] - raw[b]), want = new Array(raw.length); order.forEach((k, r) => { want[k] = r / (raw.length - 1); });
    const lo = 0, hi = 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + "px"; canvas.style.height = H + "px";
    const x = canvas.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    x.font = Math.min(cw, ch) * 1.25 + "px " + font; x.textAlign = "center"; x.textBaseline = "middle";
    const mono = cs.getPropertyValue("--accent").trim() || cs.getPropertyValue("--ink").trim() || "currentColor";
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i, w = (want[k] - lo) / Math.max(0.05, hi - lo);
      if (w < 0.12) continue;                               // paper
      let best = R[0]; for (const o of R) if (Math.abs(o.ink - w) < Math.abs(best.ink - w)) best = o;
      if (coloured) { const r = px[4 * k], g = px[4 * k + 1], b = px[4 * k + 2], m = (r + g + b) / 3, sat = 1.35;   // a little richer than the photo
        x.fillStyle = "rgb(" + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(m + (c - m) * sat + (dark ? 25 : -10))))).join(",") + ")"; }
      else x.fillStyle = mono;
      x.fillText(best.t, (i + 0.5) * cw, (j + 0.5) * ch);
    }
  }

  // attach(img): make a click on img (then on its drawing) cycle it: the photo, in symbols, in one colour
  function attach(img) {
    if (!img || img._portrait) return; img._portrait = true;
    const ready = () => {
      const holder = img.parentElement; if (getComputedStyle(holder).position === "static") holder.style.position = "relative";
      const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "position:absolute;display:none;cursor:pointer;border-radius:" + getComputedStyle(img).borderRadius;
      holder.appendChild(canvas);
      let state = 0;
      const show = () => {
        if (state === 0) { canvas.style.display = "none"; img.style.visibility = ""; return; }
        canvas.style.left = img.offsetLeft + "px"; canvas.style.top = img.offsetTop + "px";
        mosaic(img, canvas, state === 1); canvas.style.display = "block"; img.style.visibility = "hidden";
      };
      const titles = ["Click: in symbols", "Click: in one colour", "Click: the photo"];
      const cycle = ev => { ev.stopPropagation(); state = (state + 1) % 3; img.title = canvas.title = titles[state]; show(); };
      img.style.cursor = "pointer"; img.title = titles[0];
      img.addEventListener("click", cycle); canvas.addEventListener("click", cycle);
      window.addEventListener("resize", () => { if (state) show(); });
    };
    if (img.complete && img.naturalWidth) ready(); else img.addEventListener("load", ready, { once: true });
  }
  window.GlyphPortrait = { attach };
  const init = () => attach(document.querySelector(".helia-home-photo"));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.addEventListener("load", init, { once: true }));
  else if (document.readyState !== "complete") window.addEventListener("load", init, { once: true });
  else init();
})();
