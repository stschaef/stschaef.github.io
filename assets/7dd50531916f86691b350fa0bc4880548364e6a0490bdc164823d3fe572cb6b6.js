// ornament-view: one structure from the site's ornament library, drawn afresh on every visit.
//
// Props: { name: string (a definition in the ornament library), size?: number (px per em, default 18),
//          redraw?: boolean (a ⚄ button to draw it again; default true) }
// The library is loaded by the site theme (window.FolioLibrary, "folio-library" event).

const STYLE_ID = "ornament-view-style";
const CSS = `
.orn-view { margin: 1.2rem auto; text-align: center; position: relative; }
.orn-view-art { display: inline-block; max-width: 100%; overflow: hidden; }
.orn-view-again { display: block; margin: .3rem auto 0; font: inherit; font-size: .8rem; background: none; border: 0; color: var(--muted, #777); cursor: pointer; }
.orn-view-again:hover { color: var(--accent, #a33); }
`;

export default function mount(root, props) {
  const doc = root.ownerDocument, win = doc.defaultView;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement("style"); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
  root.textContent = "";
  const box = doc.createElement("div"); box.className = "orn-view";
  const art = doc.createElement("div"); art.className = "orn-view-art"; art.setAttribute("aria-hidden", "true");
  box.appendChild(art);
  if (props.redraw !== false) {
    const b = doc.createElement("button"); b.type = "button"; b.className = "orn-view-again"; b.textContent = "⚄ draw again";
    b.addEventListener("click", draw); box.appendChild(b);
  }
  root.appendChild(box);
  const FOLK = ["var(--accent)", "var(--accent-3)", "var(--accent-4)", "var(--accent-2)", "var(--accent)"];
  const colour = tok => FOLK[Math.abs(Array.from(tok).reduce((a, c) => a * 31 + c.codePointAt(0), 7)) % FOLK.length];
  function draw() {
    const O = win.Ornament, L = win.FolioLibrary;
    if (!O || !L || !L.lib.defs[props.name]) { art.textContent = L ? "(no structure named " + props.name + ")" : ""; return; }
    const d = O.realize(L.lib.defs[props.name].e, { defs: L.lib.defs, r: Math.random, pictures: L.pictures });
    let px = props.size || 18;
    const avail = (box.clientWidth || 600) - 8;
    if (d.w * px > avail) px = avail / d.w;
    O.renderInto(doc, art, d, px, { colour });
  }
  if (win.FolioLibrary) draw(); else doc.addEventListener("folio-library", draw, { once: true });
}
