// ornament-library: the definitions of the site's ornament grammar (theme/ornament.js), with a
// live preview of every named structure.
//
// Props: { id: string (the ornament-library entry), defs: ["name = expression", ...] }
// Pictures used by `picture(id)` are read from the glyph-art widgets on the same page.
// Editing (under `helia serve --allow-edit`, or with ?edit): the definitions as text, previews
// redrawn as you type; Save writes `defs` back into the entry, one definition per line.

const STYLE_ID = "ornament-library-style";
const CSS = `
.orn-lib { margin: 1rem 0; }
.orn-lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: .6rem; }
.orn-lib-card { border: 1px dotted var(--rule, #ccc); padding: .4rem .5rem .5rem; display: flex; flex-direction: column; align-items: center; gap: .3rem; min-height: 7rem; }
.orn-lib-name { font-family: var(--head-font, sans-serif); font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: var(--muted, #777); align-self: stretch; display: flex; justify-content: space-between; }
.orn-lib-src { font-family: ui-monospace, monospace; font-size: .68rem; color: var(--muted, #777); word-break: break-word; text-align: center; }
.orn-lib-art { flex: 1; display: flex; align-items: center; justify-content: center; }
.orn-lib-bar { display: flex; flex-wrap: wrap; gap: .4rem; margin: .5rem 0; font-family: var(--head-font, sans-serif); font-size: .82rem; }
.orn-lib-bar button { font: inherit; background: none; color: inherit; border: 1px dotted var(--rule, #ccc); padding: .2rem .55rem; cursor: pointer; }
.orn-lib-text { width: 100%; min-height: 16rem; font-family: ui-monospace, monospace; font-size: .82rem; line-height: 1.4; box-sizing: border-box; }
.orn-lib-errors { color: var(--accent, #a33); font-size: .85rem; white-space: pre-wrap; }
.orn-lib-status { color: var(--muted, #777); font-size: .85rem; min-height: 1.2em; }
`;

function injectStyle(doc) {
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement("style"); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
}
const el = (doc, tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// Pictures on this page: the glyph-art widgets' props, with their brushes parsed as expressions.
function pagePictures(doc, O) {
  const pics = {};
  for (const e of doc.querySelectorAll('[data-widget="glyph-art"][data-props]')) {
    try {
      const p = JSON.parse(e.getAttribute("data-props")), brushes = {};
      for (const line of p.brushes || []) {
        const m = /^\s*(\S)\s*=\s*(.*?)\s*(?::\s*([^:]*?))?\s*$/.exec(line);
        if (m) try { brushes[m[1]] = { e: O.parse(m[2]), col: (m[3] || "").trim() || null }; } catch (x) {}
      }
      pics[p.id] = { rows: p.rows || [], cell: p.cell || 1, brushes };
    } catch (x) {}
  }
  return pics;
}

export default function mount(root, props, slot, api) {
  const doc = root.ownerDocument, O = doc.defaultView.Ornament;
  injectStyle(doc);
  root.textContent = "";
  if (!O) { root.textContent = "(the ornament grammar, theme/ornament.js, is not loaded)"; return; }
  const box = el(doc, "div", "orn-lib");
  const bar = el(doc, "div", "orn-lib-bar"), errors = el(doc, "div", "orn-lib-errors"), grid = el(doc, "div", "orn-lib-grid");
  box.append(bar, errors, grid);
  root.appendChild(box);
  let defs = (props.defs || []).slice();
  // pictures: any on this page, plus every picture the site theme loaded (from the workshop page)
  const pictures = pagePictures(doc, O), win = doc.defaultView;
  const morePictures = () => { if (win.FolioLibrary && win.FolioLibrary.pictures) for (const k in win.FolioLibrary.pictures) if (!pictures[k]) pictures[k] = win.FolioLibrary.pictures[k]; };
  morePictures();
  doc.addEventListener("folio-library", () => { morePictures(); draw(); });
  const colour = tok => ["var(--accent)", "var(--accent-2)", "var(--accent-3)", "var(--accent-4)", "var(--ink)"][Math.abs([...tok].reduce((a, c) => a * 31 + c.codePointAt(0), 7)) % 5];

  // Is `name` one of the disjuncts of `patterns` (the gear menu's patterns)? Toggle it.
  const inMenu = (lib, name) => O.disjuncts(lib, "patterns").some(d => d.name === name);
  function toggleMenu(name) {
    const lib = O.library(defs), names = O.disjuncts(lib, "patterns").map(d => d.name + (d.w !== 1 ? "*" + d.w : ""));
    const has = names.some(n => n.split("*")[0] === name);
    const next = has ? names.filter(n => n.split("*")[0] !== name) : names.concat([name]);
    const line = "patterns = " + next.join(" | ");
    const i = defs.findIndex(l => /^\s*patterns\s*=/.test(l));
    if (i >= 0) defs[i] = line; else defs.push(line);
    if (text) text.value = defs.join("\n");
    dirty();
    draw();
  }
  let text = null, dirty = () => {};
  const menuable = (lib, name) => name !== "patterns" && name !== "place" && !["flower", "leaf", "petal", "stem", "filler", "bud"].includes(name);
  function draw() {
    const lib = O.library(defs);
    errors.textContent = lib.errors.join("\n");
    grid.textContent = "";
    for (const name of Object.keys(lib.defs)) {
      const card = el(doc, "div", "orn-lib-card"), head = el(doc, "div", "orn-lib-name");
      head.append(el(doc, "span", null, name));
      if (canEdit && menuable(lib, name)) {
        const on = inMenu(lib, name), t = el(doc, "button", null, (on ? "★" : "☆") + " gear menu");
        t.type = "button"; t.style.cssText = "font:inherit;font-size:.9em;background:none;border:0;cursor:pointer;color:" + (on ? "var(--accent)" : "inherit");
        t.addEventListener("click", () => toggleMenu(name)); head.append(t);
      }
      const art = el(doc, "div", "orn-lib-art");
      const e = lib.defs[name].e;
      const isList = e.t === "call" && e.f === "list";
      const parts = isList ? e.pos : [e];
      for (const part of parts) {
        const d = O.realize(part, { defs: lib.defs, r: Math.random, pictures });
        const px = Math.max(8, Math.min(26, 120 / Math.max(d.w, d.h, 1)));
        const holder = el(doc, "div"); O.renderInto(doc, holder, d, px, { colour }); art.appendChild(holder);
      }
      card.append(head, art, el(doc, "div", "orn-lib-src", lib.defs[name].src));
      grid.appendChild(card);
    }
  }
  const again = el(doc, "button", null, "⚄ draw again"); again.type = "button"; again.addEventListener("click", draw);
  bar.appendChild(again);
  const canEdit = api && (api.canEdit || /[?&]edit\b/.test(doc.defaultView.location.search));
  draw();
  if (!canEdit) return;
  text = el(doc, "textarea", "orn-lib-text"); const status = el(doc, "div", "orn-lib-status");
  dirty = () => { save.hidden = false; status.textContent = "Unsaved changes."; };
  text.value = defs.join("\n");
  const edit = el(doc, "button", null, "✎ edit the definitions"); edit.type = "button";
  const save = el(doc, "button", null, "Save to the note"); save.type = "button";
  let open = false;
  edit.addEventListener("click", () => { open = !open; text.hidden = save.hidden = !open; });
  text.hidden = true; save.hidden = true;
  bar.append(edit, save);
  box.insertBefore(text, errors); box.insertBefore(status, errors);
  text.addEventListener("input", () => { defs = text.value.split("\n"); draw(); });
  save.addEventListener("click", async () => {
    const lines = text.value.split("\n").map(l => l.replace(/\s+$/, ""));
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    try {
      let res;
      if (api.canEdit) {
        const value = "(\n    " + lines.map(l => JSON.stringify(l)).join(",\n    ") + ",\n  )";
        const r = await fetch("/api", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "entry.set", params: { id: props.id, field: "defs", value, expr: true } }) });
        const j = await r.json(); res = j.error ? { status: "rejected", error: j.error } : { status: "applied" };
      } else res = await api.propose({ op: "set", id: props.id, field: "defs", value: lines, expected: props.defs });
      status.textContent = res.status === "applied" ? "Saved." : res.status === "queued" ? "Queued in the edit outbox (apply it with helia apply)." : "Not saved: " + ((res.error && (res.error.message || res.error)) || "rejected");
    } catch (e) { status.textContent = "Not saved: " + e.message; }
  });
}
