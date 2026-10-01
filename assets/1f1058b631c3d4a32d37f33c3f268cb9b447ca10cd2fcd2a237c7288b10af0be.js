// glyph-art: pictures painted with brushes, where each brush is a bag of glyphs.
//
// Props: { id: string (the glyph-art entry holding the picture),
//          brushes: ["r = ⊕ ⊗ : accent", ...]   (key = glyphs : colour),
//          rows: ["..r.r..", ...]                (one character per cell; "." is empty),
//          cell?: number                          (cell size in em, default 1) }
//
// Viewing draws every painted cell with a glyph picked at random from its brush's bag, afresh
// on every visit. Editing (under `helia serve --allow-edit`, or with ?edit in the URL) opens a
// canvas: pick a brush, paint or erase with the pointer, resize the grid, edit the brushes, or
// edit the same picture as text; Save proposes the new `brushes` and `rows` to the entry.
// Colours are theme names (accent, accent-2, accent-3, accent-4, ink, muted, rule) or any CSS colour.

const STYLE_ID = "glyph-art-style";
const CSS = `
.glyph-art { margin: 1.2rem auto; text-align: center; position: relative; }
.glyph-art-view { display: inline-grid; line-height: 1; user-select: none; }
.glyph-art-view > span { display: inline-flex; align-items: center; justify-content: center; }
.glyph-art-edit-open { position: absolute; top: 0; right: 0; font: inherit; font-size: .8rem; background: none; border: 1px dotted var(--rule, #ccc); color: var(--muted, #777); cursor: pointer; padding: .1rem .45rem; }
.glyph-art-editor { text-align: left; margin-top: 1rem; padding: .9rem; border: 1px dotted var(--rule, #ccc); font-family: var(--head-font, sans-serif); font-size: .85rem; }
.glyph-art-editor button, .glyph-art-editor select, .glyph-art-editor input { font: inherit; color: inherit; background: none; border: 1px dotted var(--rule, #ccc); padding: .2rem .45rem; cursor: pointer; }
.glyph-art-editor button[aria-pressed="true"] { border: 1px solid var(--accent, #a33); color: var(--accent, #a33); }
.glyph-art-bar { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; margin-bottom: .6rem; }
.glyph-art-bar .glyph-art-key { font-family: ui-monospace, monospace; opacity: .7; margin-right: .25rem; }
.glyph-art-brush { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: .7rem; }
.glyph-art-brush input[type=text] { cursor: text; min-width: 10rem; }
.glyph-art-canvas { display: inline-grid; gap: 1px; background: var(--rule, #ddd); border: 1px solid var(--rule, #ddd); touch-action: none; user-select: none; margin: .2rem 0 .6rem; max-width: 100%; overflow: auto; }
.glyph-art-canvas > span { width: 1.45rem; height: 1.45rem; display: flex; align-items: center; justify-content: center; background: var(--paper, #fff); font-size: 1rem; cursor: crosshair; }
.glyph-art-size { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; margin-bottom: .6rem; }
.glyph-art-text { width: 100%; min-height: 9rem; font-family: ui-monospace, monospace; font-size: .85rem; line-height: 1.35; cursor: text !important; box-sizing: border-box; }
.glyph-art-status { min-height: 1.3em; color: var(--muted, #777); margin-top: .4rem; }
.glyph-art-status[data-kind="error"] { color: var(--accent, #a33); }
`;

const THEME = /^(accent(-[234])?|ink|muted|rule|paper)$/;
const colour = c => (THEME.test(c) ? `var(--${c})` : c);
const COLOURS = ["accent", "accent-2", "accent-3", "accent-4", "ink", "muted"];

function parseBrush(line) {
  const m = /^\s*(\S)\s*=\s*(.*?)\s*(?::\s*([^:]*?))?\s*$/.exec(line || "");
  if (!m || m[1] === ".") return null;
  return { key: m[1], glyphs: m[2].split(/\s+/).filter(Boolean), color: (m[3] || "ink").trim() || "ink" };
}
const brushLine = b => `${b.key} = ${b.glyphs.join(" ")} : ${b.color}`;
function normalise(rows) {
  const w = Math.max(1, ...rows.map(r => Array.from(r).length));
  return rows.map(r => { const a = Array.from(r); while (a.length < w) a.push("."); return a.join(""); });
}
function toText(st) { return st.brushes.map(brushLine).join("\n") + "\n---\n" + st.rows.join("\n"); }
function fromText(text) {
  const parts = text.split(/^\s*---\s*$/m);
  if (parts.length < 2) throw new Error("expected the brushes, a line ---, then the grid");
  const brushes = parts[0].split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).map(l => {
    const b = parseBrush(l);
    if (!b) throw new Error("not a brush: " + l.trim() + " (write: key = glyphs : colour)");
    return b;
  });
  const rows = parts.slice(1).join("---").split("\n").map(r => r.replace(/\s+$/, "")).filter((r, i, a) => r || (i > 0 && i < a.length - 1));
  return { brushes, rows: normalise(rows.length ? rows : ["....."]) };
}

function injectStyle(doc) {
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement("style"); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
}
const el = (doc, tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export default function mount(root, props, slot, api) {
  const doc = root.ownerDocument;
  injectStyle(doc);
  const original = { brushes: props.brushes || [], rows: props.rows || [] };
  let st = { brushes: original.brushes.map(parseBrush).filter(Boolean), rows: normalise(original.rows.length ? original.rows : ["....."]) };
  const cell = props.cell || 1;
  root.textContent = "";
  const box = el(doc, "div", "glyph-art");
  const view = el(doc, "div", "glyph-art-view");
  view.setAttribute("aria-hidden", "true");
  box.appendChild(view);
  root.appendChild(box);

  // A brush may be an expression of the ornament grammar (theme/ornament.js), e.g. "R = rosette":
  // once the site's library has loaded, such cells draw the whole structure, shrunk into the cell.
  const win = doc.defaultView;
  function structure(b) {
    const O = win.Ornament, L = win.FolioLibrary, text = b.glyphs.join(" ");
    const isStructure = /\(/.test(text) || (L && b.glyphs.some(g => L.lib.defs[g]));
    if (!O || !isStructure) return null;
    try { return O.realize(O.parse(text), { defs: L ? L.lib.defs : {}, r: Math.random, pictures: L ? L.pictures : {} }); }
    catch (x) { return null; }
  }
  doc.addEventListener("folio-library", () => draw());
  // the picture: every painted cell gets a glyph drawn from its brush's bag (or its structure)
  function draw() {
    const byKey = Object.fromEntries(st.brushes.map(b => [b.key, b]));
    const w = Array.from(st.rows[0] || "").length;
    view.style.gridTemplateColumns = `repeat(${w}, ${cell}em)`;
    view.style.gridAutoRows = `${cell}em`;
    view.textContent = "";
    for (const row of st.rows) for (const ch of Array.from(row)) {
      const s = el(doc, "span");
      const b = byKey[ch];
      const d = b && b.glyphs.length ? structure(b) : null;
      if (d) {
        const px = Math.max(3, (parseFloat(win.getComputedStyle(view).fontSize) || 16) * cell / Math.max(d.w, d.h, 1));
        const inner = doc.createElement("span"); win.Ornament.renderInto(doc, inner, d, px, { colour: () => colour(b.color) });
        s.style.overflow = "visible"; s.appendChild(inner);
      } else if (b && b.glyphs.length) { s.textContent = b.glyphs[Math.floor(Math.random() * b.glyphs.length)]; s.style.color = colour(b.color); }
      view.appendChild(s);
    }
  }
  draw();

  const canEdit = api && (api.canEdit || /[?&]edit\b/.test(doc.defaultView.location.search));
  if (!canEdit) return;

  const open = el(doc, "button", "glyph-art-edit-open", "✎ edit");
  open.type = "button";
  box.appendChild(open);
  let editor = null;
  open.addEventListener("click", () => { if (editor) { editor.remove(); editor = null; } else openEditor(); });

  function openEditor() {
    editor = el(doc, "div", "glyph-art-editor");
    box.appendChild(editor);
    let current = st.brushes[0] ? st.brushes[0].key : ".";
    const bar = el(doc, "div", "glyph-art-bar"), brushBox = el(doc, "div", "glyph-art-brush");
    const size = el(doc, "div", "glyph-art-size"), canvas = el(doc, "div", "glyph-art-canvas");
    const text = el(doc, "textarea", "glyph-art-text"), status = el(doc, "div", "glyph-art-status");
    const actions = el(doc, "div", "glyph-art-bar");
    editor.append(bar, brushBox, size, canvas, el(doc, "div", "glyph-art-status", "Or edit it as text: the brushes (key = glyphs : colour), a line ---, then the grid (\".\" is empty)."), text, actions, status);
    const say = (msg, kind) => { status.textContent = msg; if (kind) status.dataset.kind = kind; else delete status.dataset.kind; };
    const changed = () => { draw(); text.value = toText(st); renderCanvas(); };

    function renderBar() {
      bar.textContent = "";
      const pick = (key, label, color) => {
        const b = el(doc, "button"); b.type = "button"; b.setAttribute("aria-pressed", key === current ? "true" : "false");
        b.append(el(doc, "span", "glyph-art-key", key === "." ? "erase" : key));
        if (label) { const g = el(doc, "span", null, label); if (color) g.style.color = colour(color); b.append(g); }
        b.addEventListener("click", () => { current = key; renderBar(); renderBrush(); });
        bar.appendChild(b);
      };
      st.brushes.forEach(b => pick(b.key, b.glyphs.slice(0, 3).join(" "), b.color));
      pick(".", "", null);
      const add = el(doc, "button", null, "+ brush"); add.type = "button";
      add.addEventListener("click", () => {
        const used = new Set(st.brushes.map(b => b.key));
        const key = Array.from("abcdefghijklmnopqrstuvwxyz").find(k => !used.has(k));
        st.brushes.push({ key, glyphs: ["✿"], color: "accent" }); current = key; renderBar(); renderBrush(); changed();
      });
      bar.appendChild(add);
    }
    function renderBrush() {
      brushBox.textContent = "";
      const b = st.brushes.find(x => x.key === current);
      if (!b) return;
      const g = el(doc, "input"); g.type = "text"; g.value = b.glyphs.join(" "); g.title = "the bag: glyphs separated by spaces";
      g.addEventListener("input", () => { b.glyphs = g.value.split(/\s+/).filter(Boolean); renderBar(); changed(); });
      const c = el(doc, "select");
      for (const name of COLOURS.concat(COLOURS.includes(b.color) ? [] : [b.color])) { const o = el(doc, "option", null, name); o.value = name; if (name === b.color) o.selected = true; c.appendChild(o); }
      c.addEventListener("change", () => { b.color = c.value; renderBar(); changed(); });
      const del = el(doc, "button", null, "delete brush"); del.type = "button";
      del.addEventListener("click", () => {
        st.brushes = st.brushes.filter(x => x !== b);
        st.rows = st.rows.map(r => Array.from(r).map(ch => (ch === b.key ? "." : ch)).join(""));
        current = st.brushes[0] ? st.brushes[0].key : "."; renderBar(); renderBrush(); changed();
      });
      brushBox.append(el(doc, "span", null, `Brush ${b.key}:`), g, c, del);
    }
    function renderSize() {
      size.textContent = "";
      const h = st.rows.length, w = Array.from(st.rows[0] || "").length;
      const btn = (label, fn) => { const b = el(doc, "button", null, label); b.type = "button"; b.addEventListener("click", () => { fn(); renderSize(); changed(); }); size.appendChild(b); };
      size.append(el(doc, "span", null, `${w} × ${h}`));
      btn("+ row", () => st.rows.push(".".repeat(w)));
      btn("− row", () => { if (st.rows.length > 1) st.rows.pop(); });
      btn("+ column", () => { st.rows = st.rows.map(r => r + "."); });
      btn("− column", () => { if (w > 1) st.rows = st.rows.map(r => Array.from(r).slice(0, -1).join("")); });
      btn("mirror →", () => { st.rows = st.rows.map(r => { const a = Array.from(r), n = Math.ceil(a.length / 2); for (let i = 0; i < n; i++) a[a.length - 1 - i] = a[i]; return a.join(""); }); });
      btn("clear", () => { st.rows = st.rows.map(r => ".".repeat(Array.from(r).length)); });
    }
    // the canvas: one cell per grid position, painted with the current brush (drag to paint;
    // right-click, or the erase brush, clears)
    let painting = null;
    function paint(i, j, key) {
      const a = Array.from(st.rows[j]); if (a[i] === key) return;
      a[i] = key; st.rows[j] = a.join(""); draw(); text.value = toText(st);
      const s = canvas.children[j * a.length + i]; fillCell(s, key);
    }
    function fillCell(s, key) {
      const b = st.brushes.find(x => x.key === key);
      s.textContent = b && b.glyphs[0] ? b.glyphs[0] : ""; s.style.color = b ? colour(b.color) : "";
    }
    function renderCanvas() {
      const w = Array.from(st.rows[0] || "").length;
      canvas.style.gridTemplateColumns = `repeat(${w}, 1.45rem)`;
      canvas.textContent = "";
      st.rows.forEach((row, j) => Array.from(row).forEach((ch, i) => {
        const s = el(doc, "span"); fillCell(s, ch); s.dataset.i = i; s.dataset.j = j; canvas.appendChild(s);
      }));
    }
    const at = ev => { const t = doc.elementFromPoint(ev.clientX, ev.clientY); return t && t.parentNode === canvas ? t : null; };
    canvas.addEventListener("contextmenu", ev => ev.preventDefault());
    canvas.addEventListener("pointerdown", ev => {
      const s = at(ev); if (!s) return;
      ev.preventDefault(); canvas.setPointerCapture(ev.pointerId);
      painting = ev.button === 2 || ev.shiftKey ? "." : current;
      paint(+s.dataset.i, +s.dataset.j, painting);
    });
    canvas.addEventListener("pointermove", ev => { if (!painting) return; const s = at(ev); if (s) paint(+s.dataset.i, +s.dataset.j, painting); });
    const stop = () => { painting = null; };
    canvas.addEventListener("pointerup", stop); canvas.addEventListener("pointercancel", stop);

    text.value = toText(st);
    text.addEventListener("input", () => {
      try { st = fromText(text.value); if (!st.brushes.some(b => b.key === current)) current = st.brushes[0] ? st.brushes[0].key : "."; say(""); draw(); renderBar(); renderBrush(); renderSize(); renderCanvas(); }
      catch (e) { say(e.message, "error"); }
    });

    const save = el(doc, "button", null, "Save to the note"), reset = el(doc, "button", null, "Undo all changes"), close = el(doc, "button", null, "Close");
    [save, reset, close].forEach(b => { b.type = "button"; actions.appendChild(b); });
    save.addEventListener("click", async () => {
      if (!props.id) { say("No entry to save to.", "error"); return; }
      const brushes = st.brushes.map(brushLine), rows = st.rows.slice();
      try {
        let r1, r2;
        if (api.canEdit) {
          // written straight into the source, one brush and one row per line, so the entry stays
          // pleasant to edit by hand (the edit outbox would print each list on one line)
          const expr = xs => "(\n    " + xs.map(x => JSON.stringify(x)).join(",\n    ") + ",\n  )";
          const rpc = async (field, value) => {
            const res = await fetch("/api", { method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "entry.set", params: { id: props.id, field, value, expr: true } }) });
            const j = await res.json();
            return j.error ? { status: "rejected", error: j.error } : { status: "applied" };
          };
          r1 = await rpc("brushes", expr(brushes));
          r2 = r1.status === "applied" ? await rpc("rows", expr(rows)) : r1;
        } else {
          r1 = await api.propose({ op: "set", id: props.id, field: "brushes", value: brushes, expected: original.brushes });
          r2 = await api.propose({ op: "set", id: props.id, field: "rows", value: rows, expected: original.rows });
        }
        const bad = [r1, r2].find(r => r && r.status === "rejected");
        if (bad) say("Not saved: " + (bad.error && (bad.error.message || bad.error) || "rejected"), "error");
        else if ([r1, r2].some(r => r && r.status === "queued")) say("Queued in the edit outbox: apply it with helia apply.");
        else say("Saved to " + props.id + ".");
      } catch (e) { say("Not saved: " + e.message, "error"); }
    });
    reset.addEventListener("click", () => {
      st = { brushes: original.brushes.map(parseBrush).filter(Boolean), rows: normalise(original.rows.length ? original.rows : ["....."]) };
      current = st.brushes[0] ? st.brushes[0].key : "."; renderBar(); renderBrush(); renderSize(); changed(); say("");
    });
    close.addEventListener("click", () => { editor.remove(); editor = null; });
    renderBar(); renderBrush(); renderSize(); renderCanvas();
  }
}
