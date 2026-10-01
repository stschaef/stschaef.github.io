// helia-cite-formats: the "Cite" panel of reference pages (@base/reference).
// A built-in widget (prebuilt, no bundler; helia_widgets::builtin_source).
//
// Props: { key: string (citation key), bibtex: string, hayagriva?: string
//          (hayagriva YAML, typst's `#bibliography`), "bib-file"?: string,
//          "yml-file"?: string (download links, relative to the page) }
//
// Slot (the no-JavaScript fallback the layout writes): groups carrying
// `data-format="bibtex"` / `data-format="hayagriva"` with a highlighted
// <pre> each. The widget moves those <pre>s into one panel, so the display
// keeps the build-time highlighting; formats without one show plain text.
//
// One tab list (role=tablist; Left/Right/Home/End move and select) switches
// between BibTeX, hayagriva YAML and the citation forms (`@key`,
// `\cite{key}`). "Copy" copies the visible format (the prop string, exactly).
// The chosen format is remembered on this device for every reference page
// (`api.shared`, else `api.local`).

const STYLE_ID = "helia-cite-formats-style";
const CSS = `
.helia-cite-formats { color: var(--helia-fg, #1a1a1a); border: 1px solid var(--helia-border, #e2e2e2); border-radius: var(--helia-radius, 5px); margin: .6rem 0; max-width: 100%; }
.helia-cite-formats-bar { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; padding: .35rem .5rem; border-bottom: 1px solid var(--helia-border, #e2e2e2); }
.helia-cite-formats-tabs { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--helia-border, #e2e2e2); border-radius: var(--helia-radius, 5px); overflow: hidden; }
.helia-cite-formats-tabs [role="tab"] { font: inherit; font-size: .85em; color: var(--helia-muted, #5c5c5c); background: transparent; border: 0; border-right: 1px solid var(--helia-border, #e2e2e2); padding: .25em .7em; cursor: pointer; }
.helia-cite-formats-tabs [role="tab"]:last-child { border-right: 0; }
.helia-cite-formats-tabs [role="tab"][aria-selected="true"] { color: var(--helia-bg, #fff); background: var(--helia-accent, #1f5f8b); }
.helia-cite-formats-tabs [role="tab"]:hover:not([aria-selected="true"]) { background: var(--helia-hover-strong, rgba(0,100,255,.1)); }
.helia-cite-formats-actions { margin-left: auto; display: inline-flex; gap: .4rem; align-items: center; font-size: .85em; }
.helia-cite-formats-actions button { font: inherit; color: inherit; background: var(--helia-bg, #fff); border: 1px solid var(--helia-border, #e2e2e2); border-radius: var(--helia-radius, 5px); padding: .15em .6em; cursor: pointer; }
.helia-cite-formats-actions button:hover { background: var(--helia-hover-strong, rgba(0,100,255,.1)); }
.helia-cite-formats-actions a { color: var(--helia-muted, #5c5c5c); }
.helia-cite-formats :focus-visible { outline: 2px solid var(--helia-accent, #1f5f8b); outline-offset: 1px; }
.helia-cite-formats-panel { margin: 0; }
.helia-cite-formats-panel pre { margin: 0; padding: .6rem .7rem; overflow: auto; max-height: 24em; background: var(--helia-code-bg, rgba(0,100,100,.05)); font-family: var(--helia-font-mono, monospace); font-size: .85em; white-space: pre; }
.helia-cite-formats-status { min-height: 1.2em; font-size: .8em; color: var(--helia-muted, #5c5c5c); padding: 0 .6rem .25rem; }
@media (max-width: 40em) { .helia-cite-formats-actions { margin-left: 0; width: 100%; } }
`;

export const FORMATS = [
  { id: "bibtex", label: "BibTeX", file: "bib-file" },
  { id: "hayagriva", label: "hayagriva YAML", file: "yml-file" },
  { id: "key", label: "@key" },
];

let mounts = 0;

function injectStyle(doc, el) {
  if (doc.head && !doc.getElementById(STYLE_ID)) {
    const s = doc.createElement("style");
    s.setAttribute("id", STYLE_ID);
    s.textContent = CSS;
    doc.head.appendChild(s);
  }
  const root = el && el.getRootNode ? el.getRootNode() : null;
  if (root && root !== doc && root.host && root.querySelector && !root.querySelector('style[data-helia-style="' + STYLE_ID + '"]')) {
    const s = doc.createElement("style");
    s.setAttribute("data-helia-style", STYLE_ID);
    s.textContent = CSS;
    root.appendChild(s);
  }
}

function memoryStore() {
  const m = new Map();
  return {
    get: async (k, d) => (m.has(k) ? m.get(k) : d),
    set: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
  };
}

/** Copy text: `navigator.clipboard`, else a hidden textarea + execCommand. */
async function copyText(doc, text) {
  const nav = (doc.defaultView && doc.defaultView.navigator) || globalThis.navigator;
  if (nav && nav.clipboard && nav.clipboard.writeText) {
    await nav.clipboard.writeText(text);
    return;
  }
  if (!doc.execCommand) throw new Error("no clipboard");
  const ta = doc.createElement("textarea");
  ta.value = text;
  doc.body.appendChild(ta);
  ta.select();
  const ok = doc.execCommand("copy");
  doc.body.removeChild(ta);
  if (!ok) throw new Error("copy refused");
}

export default function mount(element, props, slot, api) {
  const doc = element.ownerDocument;
  props = props && typeof props === "object" ? props : {};
  const key = typeof props.key === "string" ? props.key : "";
  const texts = {
    bibtex: typeof props.bibtex === "string" ? props.bibtex.trim() + "\n" : "",
    hayagriva: typeof props.hayagriva === "string" ? props.hayagriva : "",
    key: key ? "@" + key : "",
  };
  const formats = FORMATS.filter((f) => texts[f.id] && texts[f.id].trim());
  if (!formats.length) {
    if (slot) element.replaceChildren(slot);
    return;
  }
  injectStyle(doc, element);
  element.classList.add("helia-cite-formats");
  const uid = "helia-cite-formats-" + ++mounts;
  const store = api && api.shared ? api.shared : api && api.local ? api.local : memoryStore();

  const h = (tag, attrs, ...kids) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v === true ? "" : String(v));
    for (const c of kids) if (c != null) e.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
    return e;
  };

  // Highlighted blocks from the fallback.
  const pres = {};
  if (slot && slot.querySelector) {
    for (const f of formats) {
      const g = slot.querySelector('[data-format="' + f.id + '"]');
      const pre = g && g.querySelector("pre");
      if (pre) pres[f.id] = pre;
    }
  }
  const plain = (id) => {
    const pre = h("pre", { class: "helia-raw" });
    pre.appendChild(h("code", {}, id === "key" ? "@" + key + "\n\\cite{" + key + "}\n" : texts[id]));
    return pre;
  };

  const tabs = {};
  const tablist = h("div", { class: "helia-cite-formats-tabs", role: "tablist", "aria-label": "Citation format" });
  for (const f of formats) {
    tabs[f.id] = h(
      "button",
      { type: "button", role: "tab", id: uid + "-tab-" + f.id, "aria-controls": uid + "-panel", "aria-selected": "false", tabindex: "-1", "data-format": f.id },
      f.label,
    );
    tablist.appendChild(tabs[f.id]);
  }
  const copyBtn = h("button", { type: "button", "data-action": "copy" }, "Copy");
  const download = h("a", { class: "helia-cite-formats-download", download: "" }, "");
  const actions = h("span", { class: "helia-cite-formats-actions" }, copyBtn, download);
  const panel = h("div", { class: "helia-cite-formats-panel", role: "tabpanel", id: uid + "-panel", tabindex: "0" });
  const status = h("div", { class: "helia-cite-formats-status", role: "status", "aria-live": "polite" });
  element.replaceChildren(h("div", { class: "helia-cite-formats-bar" }, tablist, actions), panel, status);

  let current = null;
  const select = (id, save) => {
    const f = formats.find((x) => x.id === id);
    if (!f) return false;
    current = id;
    for (const x of formats) {
      const on = x.id === id;
      tabs[x.id].setAttribute("aria-selected", on ? "true" : "false");
      tabs[x.id].setAttribute("tabindex", on ? "0" : "-1");
    }
    panel.setAttribute("aria-labelledby", tabs[id].getAttribute("id"));
    panel.setAttribute("data-format", id);
    panel.replaceChildren(pres[id] || plain(id));
    copyBtn.setAttribute("aria-label", "Copy " + f.label);
    const file = f.file && typeof props[f.file] === "string" ? props[f.file] : "";
    if (file) {
      download.setAttribute("href", file);
      download.textContent = file;
      download.hidden = false;
      download.removeAttribute("hidden");
    } else {
      download.removeAttribute("href");
      download.textContent = "";
      download.setAttribute("hidden", "");
    }
    status.textContent = "";
    if (save) Promise.resolve(store.set("format", id)).catch(() => {});
    return true;
  };

  const onClick = (ev) => {
    const t = ev.target && ev.target.closest ? ev.target.closest('[role="tab"]') : null;
    if (t) select(t.getAttribute("data-format"), true);
  };
  const onKey = (ev) => {
    const i = formats.findIndex((f) => f.id === current);
    let j = null;
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") j = (i + 1) % formats.length;
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") j = (i - 1 + formats.length) % formats.length;
    else if (ev.key === "Home") j = 0;
    else if (ev.key === "End") j = formats.length - 1;
    if (j == null) return;
    ev.preventDefault();
    select(formats[j].id, true);
    tabs[formats[j].id].focus();
  };
  const onCopy = async () => {
    const f = formats.find((x) => x.id === current);
    try {
      await copyText(doc, texts[current]);
      status.textContent = "Copied " + f.label;
    } catch (e) {
      status.textContent = "Could not copy: " + (e && e.message ? e.message : e);
    }
  };
  tablist.addEventListener("click", onClick);
  tablist.addEventListener("keydown", onKey);
  copyBtn.addEventListener("click", onCopy);

  select(formats[0].id, false);
  let dead = false;
  Promise.resolve(store.get("format", null))
    .then((v) => {
      if (!dead && typeof v === "string" && v !== current) select(v, false);
    })
    .catch(() => {});

  return () => {
    dead = true;
    element.replaceChildren();
    element.classList.remove("helia-cite-formats");
  };
}
