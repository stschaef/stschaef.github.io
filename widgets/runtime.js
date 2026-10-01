// helia widget runtime (ES module). No framework, no build step.
//
// Page contract (see crates/helia-widgets/README.md):
//
//   <div class="helia-widget" data-widget="tetris" data-props='{"size":12}'>
//     ...optional slot content rendered by helia...
//   </div>
//   <script type="application/json" id="helia-widgets">{"tetris":"widgets/tetris-1a2b3c4d.js"}</script>
//   <script type="module" src="widgets/runtime.js"></script>
//
// For every `[data-widget]` element the runtime imports the widget's bundle
// (URL from the manifest, resolved against the document's base URL) and
// calls its default export (or a named `mount` export):
//
//   mount(element, props, slot, api)
//
// - `element`: the mount element, emptied before the call; the widget owns it.
// - `props`: the parsed `data-props` JSON (`{}` when absent or empty), or,
//   when the element has `data-props-src` instead (large props, written by
//   `helia build` to `widgets/data/<hash>.json`), that file's JSON.
// - `slot`: a DocumentFragment holding the element's original children (the
//   slot content), moved out of the element. Insert it wherever the widget
//   wants, or ignore it.
// - `api`: persistent data without a server (see "Persistent data" in
//   docs/manual/widgets.md). Widgets that take three arguments ignore it.
//
//     api.version                 1
//     api.widget, api.entry, api.site, api.instance
//     api.href(id)                URL of an entry's page (flat or pretty URLs)
//     api.url(path)               a site-relative path (e.g. "calendar.ics",
//                                 an asset URL from props) as an absolute URL
//     api.local.get(key, dflt) / set(key, value) / delete(key) / keys()
//                                 device-local, per site + entry + widget
//                                 (+ the element's id); IndexedDB, else
//                                 localStorage, else memory. All async.
//     api.shared                  same, per site + widget (every entry)
//     api.storage                 "indexeddb" | "localstorage" | "memory" (a promise)
//     api.served                  the page is served by `helia serve` (marker
//                                 `<meta name="helia-api">` present, "read" or "edit")
//     api.canEdit                 the page is served by `helia serve --allow-edit`
//     api.call(method, params)    JSON-RPC to the same-origin /api (only when
//                                 served): resolves the `result`, rejects with
//                                 an Error carrying `.code` / `.data`.
//     api.propose(edit)           write back to the notes. edit is
//                                 {op: "set", id, field, value, expected?},
//                                 {op: "create", kind, title?, fields?} or
//                                 {op: "action", name, params?}.
//                                 Live server: POSTs `edits.apply` to /api,
//                                 resolving {status: "applied" | "rejected"}.
//                                 Static site: appends to the edit outbox
//                                 (persistent, per site), resolving
//                                 {status: "queued", pending}.
//     api.action(name, params, {dryRun?})
//                                 run a declared action (`helia.action`).
//                                 Live server: POSTs `action.run`, resolving
//                                 {status: "applied" | "preview" | "rejected"};
//                                 refused (-32001) or unreachable: queued.
//                                 Static site: an outbox record
//                                 {op: "action", name, params, page, widget},
//                                 {status: "queued", pending} (dry runs:
//                                 {status: "unavailable"}).
//     api.outbox.list() / count() / clear() / remove(i) / subscribe(fn)
//
// `mount` may return (or resolve to) a cleanup function; it is kept on the
// element as `element.heliaUnmount`. Errors (unknown widget, failed import, bad
// props, a throwing mount) are caught and shown inline in the element, with
// the slot content restored as a fallback.
//
// The outbox is shown by a small floating "N pending edits" panel offering
// to copy the edits as `helia` commands, download them as `helia-edits.json`
// (applied with `helia apply helia-edits.json`), or clear them.
//
// Security: widgets get no daemon handle or token. A page served by
// `helia serve` is same-origin with the daemon's `/api` (loopback only, and
// mutations refused unless `--allow-edit`, which is also what injects the
// `<meta name="helia-api" content="edit">` marker); a static build has no API.

const MANIFEST_ID = "helia-widgets";
export const API_VERSION = 1;
// Browser storage names keep the pre-rename "fx" prefix so saved data survives.
const DB_NAME = "fx-widgets";
const DB_STORE = "kv";

/** Read the widget manifest (name -> bundle URL) from the page. */
export function readManifest(doc) {
  const el = doc.getElementById(MANIFEST_ID);
  if (!el) return {};
  try {
    const m = JSON.parse(el.textContent || "{}");
    return m && typeof m === "object" ? m : {};
  } catch (e) {
    return {};
  }
}

function baseURL(doc) {
  if (doc.baseURI) return doc.baseURI;
  if (typeof location !== "undefined") return location.href;
  return undefined;
}

function resolve(url, doc) {
  try {
    return new URL(url, baseURL(doc)).href;
  } catch (e) {
    return url;
  }
}

function showError(el, name, err, slot) {
  const doc = el.ownerDocument;
  const box = doc.createElement("div");
  box.setAttribute("class", "helia-widget-error");
  box.setAttribute("role", "alert");
  const msg = err && err.message ? err.message : String(err);
  box.textContent = "widget “" + name + "” failed: " + msg;
  while (el.firstChild) el.removeChild(el.firstChild);
  el.appendChild(box);
  if (slot) el.appendChild(slot);
  el.setAttribute("data-widget-state", "error");
  if (typeof console !== "undefined" && console.error) console.error("helia widget", name, err);
}

// ------------------------------------------------------------------ storage

function jsonClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function reqPromise(req) {
  return new Promise((ok, fail) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error || new Error("IndexedDB request failed"));
  });
}

/** Key-value backend over IndexedDB (database `fx-widgets`, store `kv`). */
export async function indexedDBBackend(idb) {
  const open = idb.open(DB_NAME, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames || !db.objectStoreNames.contains || !db.objectStoreNames.contains(DB_STORE)) {
      db.createObjectStore(DB_STORE);
    }
  };
  const db = await reqPromise(open);
  const store = (mode) => db.transaction(DB_STORE, mode).objectStore(DB_STORE);
  return {
    kind: "indexeddb",
    get: (k) => reqPromise(store("readonly").get(k)),
    set: (k, v) => reqPromise(store("readwrite").put(v, k)).then(() => undefined),
    delete: (k) => reqPromise(store("readwrite").delete(k)).then(() => undefined),
    keys: async (prefix) => (await reqPromise(store("readonly").getAllKeys())).filter((k) => typeof k === "string" && k.startsWith(prefix)),
  };
}

/** Key-value backend over a `Storage` (localStorage); values as JSON. */
export function storageBackend(ls) {
  const probe = "helia-widgets-probe";
  ls.setItem(probe, "1");
  ls.removeItem(probe);
  return {
    kind: "localstorage",
    get: async (k) => {
      const s = ls.getItem(k);
      return s == null ? undefined : JSON.parse(s);
    },
    set: async (k, v) => ls.setItem(k, JSON.stringify(v)),
    delete: async (k) => ls.removeItem(k),
    keys: async (prefix) => {
      const out = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k != null && k.startsWith(prefix)) out.push(k);
      }
      return out;
    },
  };
}

/** In-memory backend (nothing persists across page loads). */
export function memoryBackend(map) {
  const m = map || new Map();
  return {
    kind: "memory",
    get: async (k) => jsonClone(m.get(k)),
    set: async (k, v) => void m.set(k, jsonClone(v)),
    delete: async (k) => void m.delete(k),
    keys: async (prefix) => [...m.keys()].filter((k) => k.startsWith(prefix)),
  };
}

/** The best available backend: IndexedDB, else localStorage, else memory. */
export async function openBackend(env) {
  env = env || globalThis;
  try {
    if (env.indexedDB) return await indexedDBBackend(env.indexedDB);
  } catch (e) {}
  try {
    if (env.localStorage) return storageBackend(env.localStorage);
  } catch (e) {}
  return memoryBackend();
}

/**
 * A store namespaced by `ns` (an array such as [site, entry, widget,
 * instance]) over a backend (or a promise of one). Keys are strings; values
 * are anything JSON can represent.
 */
export function namespacedStore(backend, ns) {
  // The "fx" root predates the rename to Helianthus; it stays so data that
  // widgets saved in browsers (localStorage / IndexedDB) is kept.
  const prefix = JSON.stringify(["fx"].concat(ns)).slice(0, -1) + ",";
  const full = (key) => prefix + JSON.stringify(String(key)) + "]";
  const b = Promise.resolve(backend);
  return {
    async get(key, dflt) {
      const v = await (await b).get(full(key));
      return v === undefined ? dflt : v;
    },
    async set(key, value) {
      if (value === undefined) return (await b).delete(full(key));
      return (await b).set(full(key), jsonClone(value));
    },
    async delete(key) {
      return (await b).delete(full(key));
    },
    async keys() {
      const ks = await (await b).keys(prefix);
      return ks
        .map((k) => {
          try {
            return JSON.parse(k.slice(prefix.length, -1));
          } catch (e) {
            return null;
          }
        })
        .filter((k) => typeof k === "string")
        .sort();
    },
  };
}

// ------------------------------------------------------------------- edits

const FIELD_RE = /^[\p{L}\p{N}_-]+$/u;

/** Validate and normalize an edit; throws a TypeError explaining what is wrong. */
export function normalizeEdit(edit) {
  if (!edit || typeof edit !== "object") throw new TypeError("an edit must be an object");
  if (edit.op === "set") {
    if (typeof edit.id !== "string" || !edit.id) throw new TypeError("set: `id` must be a non-empty string");
    if (typeof edit.field !== "string" || !FIELD_RE.test(edit.field)) throw new TypeError("set: `field` must be a field name");
    if (edit.value === undefined) throw new TypeError("set: `value` is required");
    const out = { op: "set", id: edit.id, field: edit.field, value: jsonClone(edit.value) };
    if ("expected" in edit) out.expected = edit.expected === undefined ? null : jsonClone(edit.expected);
    return out;
  }
  if (edit.op === "create") {
    if (typeof edit.kind !== "string" || !edit.kind) throw new TypeError("create: `kind` must be a non-empty string");
    const out = { op: "create", kind: edit.kind };
    if (edit.title != null) out.title = String(edit.title);
    if (edit.fields != null) {
      if (typeof edit.fields !== "object" || Array.isArray(edit.fields)) throw new TypeError("create: `fields` must be an object");
      for (const k of Object.keys(edit.fields)) if (!FIELD_RE.test(k)) throw new TypeError("create: bad field name " + JSON.stringify(k));
      out.fields = jsonClone(edit.fields);
    }
    if (edit.skeleton != null) out.skeleton = String(edit.skeleton);
    return out;
  }
  if (edit.op === "action") {
    if (typeof edit.name !== "string" || !edit.name) throw new TypeError("action: `name` must be a non-empty string");
    if (edit.params != null && (typeof edit.params !== "object" || Array.isArray(edit.params))) throw new TypeError("action: `params` must be an object");
    return { op: "action", name: edit.name, params: edit.params == null ? {} : jsonClone(edit.params) };
  }
  throw new TypeError("unknown edit op " + JSON.stringify(edit.op) + " (expected \"set\", \"create\" or \"action\")");
}

function sameJSON(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Add an edit record to an outbox list (returns the new list). A `set` of
 * a field already pending replaces the pending value and keeps the first
 * `expected` (the value the page was built with); setting it back to that
 * value drops the pending edit. Other records (`create`, `action`) are
 * never merged.
 */
export function outboxAdd(list, rec) {
  const out = list.slice();
  if (rec.op === "set") {
    const i = out.findIndex((e) => e.op === "set" && e.id === rec.id && e.field === rec.field);
    if (i >= 0) {
      const prev = out[i];
      const merged = Object.assign({}, rec);
      if ("expected" in prev) merged.expected = prev.expected;
      else delete merged.expected;
      if ("expected" in merged && sameJSON(merged.expected, merged.value)) out.splice(i, 1);
      else out[i] = merged;
      return out;
    }
  }
  out.push(rec);
  return out;
}

function shq(s) {
  s = String(s);
  return /^[A-Za-z0-9_./:@=+-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'";
}

function valueArg(v) {
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** The edits as `helia` shell commands (one per line). */
export function editsToCommands(edits) {
  const lines = ["# Apply with conflict checks: helia apply helia-edits.json   (or run these:)"];
  for (const e of edits) {
    if (e.op === "set") {
      if (e.value === null) lines.push("helia set --expr " + shq(e.id) + " " + shq(e.field) + " none");
      else lines.push("helia set " + shq(e.id) + " " + shq(e.field) + " " + shq(valueArg(e.value)));
    } else if (e.op === "create") {
      let c = "helia new --kind " + shq(e.kind);
      if (e.skeleton) c += " --skeleton " + shq(e.skeleton);
      if (e.title != null) c += " --title " + shq(e.title);
      for (const [k, v] of Object.entries(e.fields || {})) c += " --field " + shq(k + "=" + valueArg(v));
      lines.push(c);
    } else if (e.op === "action") {
      let c = "helia action run " + shq(e.name);
      for (const [k, v] of actionParams(e)) c += " --param " + shq(k + "=" + valueArg(v));
      lines.push(c);
    }
  }
  return lines.join("\n") + "\n";
}

/** The `helia-edits.json` document for a list of edit records. */
export function editsFile(edits, site) {
  return { "helia-edits": 1, site: site || "", edits: edits.map((e) => Object.assign({}, e)) };
}

/** An action record's parameters as [key, value] pairs (null/undefined left out). */
function actionParams(e) {
  return Object.entries(e.params || {}).filter(([, v]) => v != null);
}

/** A one-line human description of an edit record (the outbox panel). */
export function describeEdit(e) {
  if (e.op === "set") return "set " + e.id + " " + e.field + " = " + JSON.stringify(e.value);
  if (e.op === "create") return "create " + e.kind + (e.title != null ? " “" + e.title + "”" : "");
  if (e.op === "action") {
    const ps = actionParams(e).map(([k, v]) => k + "=" + valueArg(v));
    return "action " + e.name + (ps.length ? " " + ps.join(", ") : "");
  }
  return JSON.stringify(e);
}

// ------------------------------------------------------------------ outbox

/** The persistent edit outbox of one site. */
export function createOutbox(backend, site) {
  const key = JSON.stringify(["fx-outbox", site || ""]); // pre-rename name, kept
  const b = Promise.resolve(backend);
  const subs = new Set();
  let chain = Promise.resolve();
  const notify = (list) => {
    for (const fn of subs) {
      try {
        fn(list);
      } catch (e) {}
    }
  };
  // Serialize read-modify-write cycles.
  const update = (f) => {
    const run = chain.then(async () => {
      const be = await b;
      const cur = (await be.get(key)) || [];
      const next = f(cur);
      if (next.length) await be.set(key, next);
      else await be.delete(key);
      notify(next);
      return next;
    });
    chain = run.catch(() => {});
    return run;
  };
  return {
    key,
    async list() {
      await chain;
      return (await (await b).get(key)) || [];
    },
    async count() {
      return (await this.list()).length;
    },
    add(rec) {
      return update((cur) => outboxAdd(cur, rec));
    },
    remove(i) {
      return update((cur) => cur.filter((_, j) => j !== i));
    },
    clear() {
      return update(() => []);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

const PANEL_CSS = `
.helia-outbox{position:fixed;right:1rem;bottom:1rem;z-index:1000;max-width:min(28rem,calc(100vw - 2rem));
  font:inherit;font-size:.9rem;color:var(--helia-fg,#1f2328);background:var(--helia-bg,#fff);
  border:1px solid var(--helia-border,#d0d7de);border-radius:var(--helia-radius,6px);box-shadow:0 2px 12px rgba(0,0,0,.15)}
.helia-outbox button{font:inherit;color:inherit;background:var(--helia-code-bg,#f6f8fa);border:1px solid var(--helia-border,#d0d7de);
  border-radius:var(--helia-radius,6px);padding:.3rem .6rem;cursor:pointer;min-height:2rem}
.helia-outbox button:hover{background:var(--helia-hover,#eaeef2)}
.helia-outbox button:focus-visible{outline:2px solid var(--helia-accent,#0969da);outline-offset:1px}
.helia-outbox-toggle{width:100%;text-align:left;font-weight:600}
.helia-outbox-body{padding:.6rem .8rem;max-height:60vh;overflow:auto}
.helia-outbox-body[hidden]{display:none}
.helia-outbox-note{color:var(--helia-muted,#59636e);margin:0 0 .5rem}
.helia-outbox-list{margin:0 0 .6rem;padding-left:1.2rem}
.helia-outbox-list li{margin:.2rem 0;overflow-wrap:anywhere}
.helia-outbox-list code{font-family:var(--helia-font-mono,monospace);font-size:.85em}
.helia-outbox-list button{padding:0 .4rem;min-height:1.5rem;margin-left:.4rem}
.helia-outbox-actions{display:flex;flex-wrap:wrap;gap:.4rem}
.helia-outbox-status{margin:.4rem 0 0;color:var(--helia-muted,#59636e);min-height:1em}
@media print{.helia-outbox{display:none}}
`;

function h(doc, tag, attrs, ...children) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v !== false && v != null) e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
  }
  return e;
}

/**
 * Keep a floating "N pending edits" panel in sync with an outbox. Returns
 * `{render(list), element()}`; the panel exists only while edits are
 * pending. `opts.clipboard(text)` and `opts.download(name, text)` override
 * the browser implementations (tests).
 */
export function createPanel(doc, outbox, opts) {
  opts = opts || {};
  let root = null;
  let open = false;
  let list = [];
  let status = "";
  const site = opts.site || "";

  const say = (msg) => {
    status = msg;
    const s = root && root.querySelector(".helia-outbox-status");
    if (s) s.textContent = msg;
  };

  const copy = async () => {
    const text = editsToCommands(list);
    try {
      if (opts.clipboard) await opts.clipboard(text);
      else await globalThis.navigator.clipboard.writeText(text);
      say("Copied " + list.length + " command" + (list.length === 1 ? "" : "s") + ".");
    } catch (e) {
      say("Could not copy: " + (e && e.message ? e.message : e));
    }
  };

  const download = () => {
    const text = JSON.stringify(editsFile(list, site), null, 2) + "\n";
    try {
      if (opts.download) opts.download("helia-edits.json", text);
      else {
        const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        const a = h(doc, "a", { href: url, download: "helia-edits.json" });
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      say("Downloaded helia-edits.json; apply it with `helia apply helia-edits.json`.");
    } catch (e) {
      say("Could not download: " + (e && e.message ? e.message : e));
    }
  };

  const build = () => {
    if (!doc.getElementById("helia-outbox-style")) {
      const st = h(doc, "style", { id: "helia-outbox-style" }, PANEL_CSS);
      (doc.head || doc.body).appendChild(st);
    }
    root = h(doc, "aside", { class: "helia-outbox", role: "region", "aria-label": "Pending edits" });
    const toggle = h(doc, "button", { type: "button", class: "helia-outbox-toggle", "aria-expanded": "false", "aria-controls": "helia-outbox-body" });
    toggle.addEventListener("click", () => {
      open = !open;
      render(list);
    });
    const body = h(doc, "div", { class: "helia-outbox-body", id: "helia-outbox-body", hidden: true });
    body.appendChild(
      h(doc, "p", { class: "helia-outbox-note" }, "This site is static, so edits are kept in this browser until you apply them to your notes with ", h(doc, "code", {}, "helia apply"), "."),
    );
    body.appendChild(h(doc, "ol", { class: "helia-outbox-list" }));
    const actions = h(doc, "div", { class: "helia-outbox-actions" });
    const btn = (label, action, fn) => {
      const b = h(doc, "button", { type: "button", "data-action": action }, label);
      b.addEventListener("click", fn);
      actions.appendChild(b);
    };
    btn("Copy as helia commands", "copy", copy);
    btn("Download helia-edits.json", "download", download);
    btn("Clear", "clear", () => {
      outbox.clear().then(() => say(""));
    });
    body.appendChild(actions);
    body.appendChild(h(doc, "p", { class: "helia-outbox-status", role: "status", "aria-live": "polite" }, status));
    root.appendChild(toggle);
    root.appendChild(body);
    doc.body.appendChild(root);
  };

  const render = (l) => {
    list = l || [];
    if (!list.length) {
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = null;
      open = false;
      return;
    }
    if (!root) build();
    const toggle = root.querySelector(".helia-outbox-toggle");
    toggle.textContent = list.length + " pending edit" + (list.length === 1 ? "" : "s");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    const body = root.querySelector(".helia-outbox-body");
    if (open) body.removeAttribute("hidden");
    else body.setAttribute("hidden", "");
    const ol = root.querySelector(".helia-outbox-list");
    while (ol.firstChild) ol.removeChild(ol.firstChild);
    list.forEach((e, i) => {
      const rm = h(doc, "button", { type: "button", "data-action": "remove", "aria-label": "Discard: " + describeEdit(e) }, "×");
      rm.addEventListener("click", () => outbox.remove(i));
      ol.appendChild(h(doc, "li", {}, h(doc, "code", {}, describeEdit(e)), rm));
    });
  };

  outbox.subscribe(render);
  return { render, element: () => root };
}

// ----------------------------------------------------------------- context

function metaContent(doc, name) {
  if (typeof doc.querySelector !== "function") return null;
  try {
    const m = doc.querySelector('meta[name="' + name + '"]');
    return m ? m.getAttribute("content") : null;
  } catch (e) {
    return null;
  }
}

function runtimeSite() {
  try {
    // The runtime lives at <site>/widgets/runtime.js.
    return new URL("../", import.meta.url).href;
  } catch (e) {
    return "";
  }
}

/** The entry ID of a page URL under the site root (`<id>.html`, `<id>/`). */
export function entryOf(pageURL, site) {
  let p;
  try {
    const u = new URL(pageURL);
    p = u.origin + u.pathname;
  } catch (e) {
    return "";
  }
  if (site && p.startsWith(site)) p = p.slice(site.length);
  else p = p.replace(/^[a-z]+:\/\/[^/]*\//, "");
  p = p.replace(/\/index\.html$/, "").replace(/\.html$/, "").replace(/\/$/, "");
  try {
    p = decodeURIComponent(p);
  } catch (e) {}
  return p.split("/").pop() || "";
}

/**
 * The per-page state behind the widget API. Options (all optional; tests
 * use them): `env` (where `indexedDB` / `localStorage` are looked up),
 * `backend`, `fetch`, `site`, `entry`, `canEdit`, `served`, `apiURL`, `panel` (false
 * disables the outbox panel), `clipboard`, `download`.
 */
export function createContext(doc, opts) {
  opts = opts || {};
  const env = opts.env || globalThis;
  const site = opts.site != null ? opts.site : runtimeSite();
  const entry = opts.entry != null ? opts.entry : entryOf(baseURL(doc) || "", site);
  const backend = Promise.resolve(opts.backend || openBackend(env));
  const outbox = createOutbox(backend, site);
  const marker = metaContent(doc, "helia-api");
  const canEdit = opts.canEdit != null ? !!opts.canEdit : !!(marker && /\bedit\b/.test(marker));
  const served = opts.served != null ? !!opts.served : marker != null || canEdit;
  let apiURL = opts.apiURL;
  if (!apiURL) {
    try {
      apiURL = new URL("/api", baseURL(doc)).href;
    } catch (e) {
      apiURL = "/api";
    }
  }
  let pretty = false;
  try {
    pretty = /\/(index\.html)?$/.test(new URL(baseURL(doc)).pathname);
  } catch (e) {}
  if (opts.pretty != null) pretty = !!opts.pretty;
  const ctx = {
    doc,
    site,
    entry,
    pretty,
    backend,
    outbox,
    canEdit,
    served,
    apiURL,
    fetch: opts.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null),
    seq: 0,
    panel: null,
  };
  if (opts.panel !== false && doc.body) {
    ctx.panel = createPanel(doc, outbox, { site, clipboard: opts.clipboard, download: opts.download });
    ctx.ready = outbox.list().then((l) => ctx.panel.render(l));
  } else {
    ctx.ready = Promise.resolve();
  }
  return ctx;
}

async function postEdits(ctx, edits) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: ++ctx.seq, method: "edits.apply", params: { edits } });
  const res = await ctx.fetch(ctx.apiURL, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!res.ok && res.status !== 200) {
    const err = new Error("HTTP " + res.status);
    err.transport = true;
    throw err;
  }
  return res.json();
}

/** Propose an edit (see the header comment). */
export async function propose(ctx, edit, source) {
  const e = normalizeEdit(edit);
  if (ctx.canEdit && ctx.fetch) {
    try {
      const j = await postEdits(ctx, [e]);
      if (j && j.error) {
        if (j.error.code !== -32001) return { status: "rejected", error: j.error.message, data: j.error.data };
        // Refused (no --allow-edit after all): fall through to the outbox.
      } else if (j && j.result) {
        if (j.result.ok === false) {
          const r = (j.result.results || []).find((x) => x.status !== "applied" && x.status !== "unchanged");
          return { status: "rejected", error: r ? r.message : "edit refused", result: j.result };
        }
        return { status: "applied", result: j.result };
      }
    } catch (err) {
      // Network failure: keep the edit.
    }
  }
  const rec = Object.assign({}, e, { page: ctx.entry });
  if (source) rec.widget = source;
  const list = await ctx.outbox.add(rec);
  return { status: "queued", pending: list.length };
}

/**
 * JSON-RPC call to the page's own `/api` (only when served by `helia serve`).
 * Resolves the `result`; rejects with an Error carrying `code` and `data`
 * on an RPC error, or `transport: true` on an HTTP/network failure.
 */
export async function callApi(ctx, method, params) {
  if (!ctx.served || !ctx.fetch) throw new Error("no helia API: the page is not served by `helia serve`");
  if (typeof method !== "string" || !method) throw new TypeError("call: `method` must be a non-empty string");
  const body = JSON.stringify({ jsonrpc: "2.0", id: ++ctx.seq, method, params: params == null ? {} : params });
  let res;
  try {
    res = await ctx.fetch(ctx.apiURL, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  } catch (e) {
    const err = new Error("cannot reach the helia API: " + (e && e.message ? e.message : e));
    err.transport = true;
    throw err;
  }
  let j = null;
  try {
    j = await res.json();
  } catch (e) {}
  if (j && j.error) {
    const err = new Error(j.error.message || "helia API error " + j.error.code);
    err.code = j.error.code;
    if (j.error.data !== undefined) err.data = j.error.data;
    throw err;
  }
  if ((!res.ok && res.status !== 200) || !j) {
    const err = new Error("helia API: HTTP " + res.status);
    err.transport = true;
    throw err;
  }
  return j.result;
}

/** Run a declared action (see the header comment). */
export async function action(ctx, name, params, opts, source) {
  const e = normalizeEdit({ op: "action", name, params });
  const dryRun = !!(opts && opts.dryRun);
  if (ctx.canEdit && ctx.fetch) {
    try {
      const result = await callApi(ctx, "action.run", { name: e.name, params: e.params, dry_run: dryRun });
      if (result && result.ok === false) {
        const bad = (result.results || []).find((x) => x.status !== "applied" && x.status !== "unchanged" && x.message);
        const err = bad ? bad.message : (result.errors || [])[0];
        return { status: "rejected", error: err ? String(err.message || err) : "action refused", result };
      }
      return { status: dryRun ? "preview" : "applied", result };
    } catch (err) {
      if (!err.transport && err.code !== -32001) return { status: "rejected", error: err.message, data: err.data };
      if (dryRun) return { status: err.transport ? "unavailable" : "rejected", error: err.message };
      // Refused (no --allow-edit, or network actions not allowed) or
      // unreachable: keep the invocation in the outbox.
    }
  }
  if (dryRun) return { status: "unavailable" };
  const rec = Object.assign({}, e, { page: ctx.entry });
  if (source) rec.widget = source;
  const list = await ctx.outbox.add(rec);
  return { status: "queued", pending: list.length };
}

function siteURL(ctx, path) {
  path = String(path == null ? "" : path);
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  try {
    // Pretty URLs are absolute ("/assets/.."): keep them under the site root.
    return new URL(path.replace(/^\/+/, ""), ctx.site || baseURL(ctx.doc)).href;
  } catch (e) {
    return path;
  }
}

/** The `api` argument of a widget's `mount`. */
export function widgetApi(ctx, name, el) {
  const instance = (el && el.getAttribute && el.getAttribute("id")) || "";
  return {
    version: API_VERSION,
    widget: name,
    entry: ctx.entry,
    site: ctx.site,
    instance,
    canEdit: ctx.canEdit,
    served: ctx.served,
    call: (method, params) => callApi(ctx, method, params),
    action: (actionName, params, opts) => action(ctx, actionName, params, opts, name),
    href: (id) => siteURL(ctx, encodeURIComponent(String(id)).replace(/%2F/gi, "_") + (ctx.pretty ? "/" : ".html")),
    url: (path) => siteURL(ctx, path),
    storage: ctx.backend.then((b) => b.kind),
    local: namespacedStore(ctx.backend, [ctx.site, ctx.entry, name, instance]),
    shared: namespacedStore(ctx.backend, [ctx.site, null, name, instance]),
    propose: (edit) => propose(ctx, edit, name),
    outbox: {
      list: () => ctx.outbox.list(),
      count: () => ctx.outbox.count(),
      clear: () => ctx.outbox.clear(),
      remove: (i) => ctx.outbox.remove(i),
      subscribe: (fn) => ctx.outbox.subscribe(fn),
    },
  };
}

const contexts = new WeakMap();
function contextFor(doc, opts) {
  if (opts && opts.context) return opts.context;
  let c = contexts.get(doc);
  if (!c) {
    c = createContext(doc, opts);
    contexts.set(doc, c);
  }
  return c;
}

async function loadProps(el, doc, opts) {
  const src = el.getAttribute("data-props-src");
  if (src) {
    const f = (opts && opts.fetch) || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    if (!f) throw new Error("cannot load props from " + src + ": no fetch");
    const res = await f(resolve(src, doc));
    if (res.ok === false) throw new Error("cannot load props from " + src + ": HTTP " + res.status);
    return res.json();
  }
  const raw = el.getAttribute("data-props");
  return raw ? JSON.parse(raw) : {};
}

/**
 * Mount one element. Resolves when mounted (or failed; never rejects).
 * `opts` as for `mountAll`.
 */
export async function mountOne(el, manifest, importer, opts) {
  if (el.getAttribute("data-widget-state")) return;
  const name = el.getAttribute("data-widget") || "";
  el.setAttribute("data-widget-state", "loading");
  const doc = el.ownerDocument;
  const slot = doc.createDocumentFragment();
  while (el.firstChild) slot.appendChild(el.firstChild);
  try {
    const url = Object.prototype.hasOwnProperty.call(manifest, name) ? manifest[name] : null;
    if (!url) throw new Error("no bundle for this widget on this page");
    const props = await loadProps(el, doc, opts);
    const mod = await importer(resolve(url, doc));
    const mount = mod && (typeof mod.default === "function" ? mod.default : mod.mount);
    if (typeof mount !== "function") throw new Error("bundle has no default-exported mount(element, props, slot)");
    const api = widgetApi(contextFor(doc, opts), name, el);
    const cleanup = await mount(el, props, slot, api);
    if (typeof cleanup === "function") el.heliaUnmount = cleanup;
    el.setAttribute("data-widget-state", "mounted");
  } catch (err) {
    showError(el, name, err, slot);
  }
}

/**
 * Mount every unmounted `[data-widget]` element under `root` (default: the
 * document). Call again after inserting new content. Options: `manifest`
 * (default: read from the page), `importer` (default: dynamic `import`),
 * `fetch` (for `data-props-src`), `context` or the `createContext` options.
 */
export async function mountAll(root, opts) {
  root = root || document;
  opts = opts || {};
  const doc = root.ownerDocument || root;
  const manifest = opts.manifest || readManifest(doc);
  const importer = opts.importer || ((url) => import(url));
  const els = Array.from(root.querySelectorAll("[data-widget]"));
  await Promise.all(els.map((el) => mountOne(el, manifest, importer, opts)));
}

if (typeof document !== "undefined" && !globalThis.__HELIA_WIDGETS_NO_AUTO) {
  globalThis.heliaWidgets = { mountAll, mountOne, readManifest, createContext, propose, action, callApi };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountAll(document));
  } else {
    mountAll(document);
  }
}
