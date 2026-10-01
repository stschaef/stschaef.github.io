// helia base runtime: collapsible transclusions, sections and code blocks,
// and copy buttons (`data-copy`). The colour scheme follows the system
// preference (`prefers-color-scheme`, in theme.css); there is no toggle.
// No framework, no build step. Safe to load with `defer` on every page.
(function () {
  "use strict";

  // Open every collapsed transclusion, section or group that contains the URL
  // fragment target.
  function revealHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    for (var n = el; n; n = n.parentElement) {
      if (n.tagName === "DETAILS") n.open = true;
    }
    el.scrollIntoView();
  }

  // In-page links (the table of contents, footnotes, label references): a
  // click on a link to the fragment already in the URL fires no hashchange,
  // so reveal the target here too (it may have been folded since).
  function onAnchorClick(ev) {
    var a = ev.target.closest ? ev.target.closest("a[href^='#']") : null;
    if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (a.getAttribute("href") === location.hash) setTimeout(revealHash, 0);
  }

  // Alt-click (Option-click) on a collapsible summary (transclusion, heading
  // section, collapsible group, code block) opens or closes it together with
  // every nested collapsible of the same sort.
  var SUMMARIES = {
    "helia-transclusion-summary": ".helia-transclusion > details",
    "helia-heading-summary": ".helia-heading-section > details",
    "helia-group-summary": ".helia-collapsible > details",
    "helia-code-summary": "details.helia-code"
  };
  function onSummaryClick(ev) {
    var summary = ev.target.closest ? ev.target.closest("summary") : null;
    if (!summary || !ev.altKey || ev.target.closest("a")) return;
    var nestedSel = null;
    for (var cls in SUMMARIES) if (summary.classList.contains(cls)) nestedSel = SUMMARIES[cls];
    if (!nestedSel) return;
    var details = summary.parentElement;
    if (!details || details.tagName !== "DETAILS") return;
    ev.preventDefault();
    var open = !details.open;
    details.open = open;
    var nested = details.querySelectorAll(nestedSel);
    for (var i = 0; i < nested.length; i++) nested[i].open = open;
  }

  // Copy buttons: every element with `data-copy` (a `helia.group` /
  // `helia.span` attribute `copy:`, e.g. the "Cite" section of reference
  // pages) gets a button copying the attribute's value, or, when it is
  // "true", the text of its first <pre>. Added here only, so pages without
  // JavaScript show no button.
  function copyText(text, btn) {
    function done(ok) {
      var old = btn.getAttribute("data-label") || btn.textContent;
      btn.setAttribute("data-label", old);
      btn.textContent = ok ? "Copied" : "Copy failed";
      setTimeout(function () {
        btn.textContent = old;
      }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        done(true);
      }, function () {
        done(false);
      });
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    done(ok);
  }

  function installCopyButtons() {
    var els = document.querySelectorAll("[data-copy]");
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        if (el.querySelector(":scope > .helia-copy")) return;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "helia-copy";
        btn.textContent = "Copy";
        var what = el.getAttribute("data-copy-label");
        btn.setAttribute("aria-label", what ? "Copy " + what : "Copy to clipboard");
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var v = el.getAttribute("data-copy");
          if (v === "true" || v === "") {
            var pre = el.querySelector("pre");
            v = pre ? pre.textContent : el.textContent;
          }
          copyText(v, btn);
        });
        var summary = el.querySelector(":scope > details > summary");
        if (summary) summary.appendChild(btn);
        else el.appendChild(btn);
      })(els[i]);
    }
  }

  // Query blocks (@base/query): re-sort the rows in place. Each row is a
  // `.helia-query-item` carrying `data-date` (its entry's sort-date, YYYYMMDD; "0"
  // when undated); the title is read from the row itself.
  var SORTS = [
    ["query", "Query order"],
    ["new", "Newest"],
    ["old", "Oldest"],
    ["title", "A\u2013Z"],
  ];

  function rowTitle(row) {
    var t = row.querySelector(".helia-transclusion-title, .helia-title, a");
    return (t ? t.textContent : row.textContent).trim().toLowerCase();
  }

  // The control is a quiet "Sort" button beside the "N entries" summary;
  // it opens a small menu of orders. Hidden while the query is folded.
  var openMenu = null;
  function closeMenu() {
    if (!openMenu) return;
    openMenu.menu.hidden = true;
    openMenu.button.setAttribute("aria-expanded", "false");
    openMenu = null;
  }

  function sortRows(body, rows, key) {
    var sorted = rows.slice().sort(function (a, b) {
      var oa = +a.getAttribute("data-order"), ob = +b.getAttribute("data-order");
      if (key === "title") return rowTitle(a).localeCompare(rowTitle(b)) || oa - ob;
      if (key === "new" || key === "old") {
        var da = a.getAttribute("data-date") || "0", db = b.getAttribute("data-date") || "0";
        if (da === db) return oa - ob;
        if (da === "0") return 1; // undated last either way
        if (db === "0") return -1;
        return key === "new" ? (da < db ? 1 : -1) : (da < db ? -1 : 1);
      }
      return oa - ob;
    });
    sorted.forEach(function (r) { body.appendChild(r); });
  }

  function installQuerySort() {
    var bodies = document.querySelectorAll(".helia-query > details > .helia-group-body");
    for (var i = 0; i < bodies.length; i++) {
      (function (body) {
        var summary = body.parentElement.querySelector(":scope > summary");
        var rows = Array.prototype.filter.call(body.children, function (c) {
          return c.classList.contains("helia-query-item");
        });
        if (!summary || rows.length < 2) return;
        rows.forEach(function (r, k) { r.setAttribute("data-order", String(k)); });
        var wrap = document.createElement("span");
        wrap.className = "helia-query-sort";
        var button = document.createElement("button");
        button.type = "button";
        button.className = "helia-query-sort-button";
        button.setAttribute("aria-haspopup", "menu");
        button.setAttribute("aria-expanded", "false");
        var menu = document.createElement("span");
        menu.className = "helia-query-sort-menu";
        menu.setAttribute("role", "menu");
        menu.hidden = true;
        var current = "query";
        function label() {
          var name = SORTS.filter(function (s) { return s[0] === current; })[0][1];
          button.textContent = current === "query" ? "Sort" : "Sort: " + name;
        }
        var items = SORTS.map(function (s) {
          var it = document.createElement("button");
          it.type = "button";
          it.setAttribute("role", "menuitemradio");
          it.setAttribute("aria-checked", s[0] === current ? "true" : "false");
          it.textContent = s[1];
          it.addEventListener("click", function () {
            current = s[0];
            sortRows(body, rows, current);
            items.forEach(function (x) { x.setAttribute("aria-checked", x === it ? "true" : "false"); });
            label();
            closeMenu();
            button.focus();
          });
          menu.appendChild(it);
          return it;
        });
        button.addEventListener("click", function () {
          if (openMenu && openMenu.menu === menu) { closeMenu(); return; }
          closeMenu();
          menu.hidden = false;
          button.setAttribute("aria-expanded", "true");
          openMenu = { menu: menu, button: button };
          var sel = menu.querySelector("[aria-checked='true']");
          if (sel) sel.focus();
        });
        // Clicks and keys inside the control must not fold the query.
        wrap.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); });
        wrap.addEventListener("keydown", function (ev) {
          if (ev.key === "Escape") { closeMenu(); button.focus(); }
          else if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && !menu.hidden) {
            var k = items.indexOf(document.activeElement);
            k = (k + (ev.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
            items[k].focus();
            ev.preventDefault();
          } else if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.target.click) ev.target.click();
          }
        });
        wrap.appendChild(button);
        wrap.appendChild(menu);
        label();
        summary.appendChild(wrap);
      })(bodies[i]);
    }
    if (bodies.length) {
      document.addEventListener("click", closeMenu);
    }
  }


  // ---------------------------------------------------------------- previews
  // Hovering (or keyboard-focusing) a link to another entry shows a small
  // card shaped by the target's kind: a definition or theorem its statement,
  // a reference its authors, year and abstract, a person their role and
  // affiliation, a note its first paragraph. The card is cut from the target's
  // own page (fetched once, on demand), so math is the page's MathML and a
  // profile only ever shows what it published: links to entries it does not
  // write are plain text, never anchors. Pointer devices only; no card on touch.

  var PREVIEW_DELAY = 300;
  var PREVIEW_GRACE = 200;
  var previewCache = {};
  var preview = null; // { card, anchor }
  var previewTimer = 0;
  var previewHideTimer = 0;

  // The links that get a card: entry links and citations, outside the top bar,
  // tag chips, the search palette and cards themselves.
  function previewTarget(el) {
    var a = el && el.closest ? el.closest("a[href]") : null;
    if (!a) return null;
    if (!a.matches(".helia-entry-link, .helia-cite a, .helia-author a, .helia-byline a")) return null;
    if (a.closest(".helia-topbar, .helia-tag, .helia-search-dialog, dialog, .helia-preview, .helia-slug")) return null;
    var url;
    try { url = new URL(a.getAttribute("href"), location.href); } catch (e) { return null; }
    if (url.origin !== location.origin || location.protocol === "file:") return null;
    url.hash = "";
    if (url.href === new URL(location.href).href.split("#")[0]) return null;
    return { a: a, url: url.href };
  }

  // Plain, inert copy of a fragment: no ids, links as text, no scripts or widgets.
  function inert(node) {
    var c = node.cloneNode(true);
    c.querySelectorAll("script, style, .helia-widget, .helia-collapsible, .glyph-layer, button").forEach(function (x) { x.remove(); });
    c.querySelectorAll("[id]").forEach(function (x) { x.removeAttribute("id"); });
    c.querySelectorAll("a").forEach(function (x) {
      var s = document.createElement("span");
      s.className = x.className;
      while (x.firstChild) s.appendChild(x.firstChild);
      x.replaceWith(s);
    });
    return c;
  }

  // The card's content from the target's page: { kind, taxon, title, meta, body }.
  function previewOf(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var head = doc.querySelector(".helia-article > .helia-header");
    if (!head) return null;
    var h = head.querySelector(".helia-heading");
    var taxon = h && h.querySelector(".helia-taxon");
    var title = h ? inert(h) : null;
    if (title) { var tx = title.querySelector(".helia-taxon"); if (tx) tx.remove(); }
    var meta = null;
    var bits = head.querySelectorAll(".helia-meta > .helia-author, .helia-meta > .helia-byline");
    if (bits.length) {
      meta = document.createElement("div");
      bits.forEach(function (b, i) {
        if (i) meta.appendChild(document.createTextNode(" · "));
        meta.appendChild(inert(b));
      });
    }
    var body = document.createElement("div");
    var root = doc.querySelector(".helia-article > .helia-body");
    var blocks = root ? root.querySelectorAll(".helia-abstract, p, .helia-math-display") : [];
    var n = 0;
    for (var i = 0; i < blocks.length && n < 2; i++) {
      var b = blocks[i];
      if (b.closest(".helia-collapsible, .helia-transclusion-summary, .helia-person-facts, .helia-widget")) continue;
      if (!b.textContent.trim()) continue;
      body.appendChild(inert(b));
      n++;
      if (b.matches(".helia-abstract")) break;
    }
    return {
      kind: head.getAttribute("data-kind") || "",
      taxon: taxon ? taxon.textContent.replace(/\.\s*$/, "") : "",
      title: title,
      meta: meta,
      body: body.childNodes.length ? body : null,
    };
  }

  function fetchPreview(url) {
    if (!previewCache[url]) {
      previewCache[url] = fetch(url, { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (t) { return t ? previewOf(t) : null; })
        .catch(function () { return null; });
    }
    return previewCache[url];
  }

  function placeCard(card, a) {
    var r = a.getBoundingClientRect();
    var pad = 8, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    card.style.left = "0px";
    card.style.top = "0px";
    var w = card.offsetWidth, h = card.offsetHeight;
    var x = Math.min(Math.max(pad, r.left), vw - w - pad);
    var below = r.bottom + 6, above = r.top - h - 6;
    var y = below + h <= vh - pad || above < pad ? below : above;
    card.style.left = Math.max(pad, x) + window.scrollX + "px";
    card.style.top = y + window.scrollY + "px";
  }

  function hidePreview() {
    clearTimeout(previewTimer);
    clearTimeout(previewHideTimer);
    if (preview) {
      preview.anchor.removeAttribute("aria-describedby");
      preview.card.remove();
      preview = null;
    }
  }

  function showPreview(t) {
    fetchPreview(t.url).then(function (p) {
      if (!p || !p.title || (!p.body && !p.meta) || !t.a.isConnected) return;
      hidePreview();
      var card = document.createElement("div");
      card.className = "helia-preview";
      card.id = "helia-preview";
      card.setAttribute("role", "tooltip");
      card.setAttribute("data-kind", p.kind);
      var top = document.createElement("div");
      top.className = "helia-preview-title";
      if (p.taxon) {
        var k = document.createElement("span");
        k.className = "helia-preview-kind";
        k.textContent = p.taxon;
        top.appendChild(k);
      }
      var tc = p.title.cloneNode(true);
      while (tc.firstChild) top.appendChild(tc.firstChild);
      card.appendChild(top);
      if (p.meta) { var m = p.meta.cloneNode(true); m.className = "helia-preview-meta"; card.appendChild(m); }
      if (p.body) { var b = p.body.cloneNode(true); b.className = "helia-preview-body"; card.appendChild(b); }
      card.addEventListener("mouseenter", function () { clearTimeout(previewHideTimer); });
      card.addEventListener("mouseleave", scheduleHide);
      document.body.appendChild(card);
      var bd = card.querySelector(".helia-preview-body");
      if (bd && bd.scrollHeight > bd.clientHeight + 1) bd.classList.add("helia-preview-clipped");
      placeCard(card, t.a);
      t.a.setAttribute("aria-describedby", "helia-preview");
      preview = { card: card, anchor: t.a };
    });
  }

  function scheduleShow(t) {
    clearTimeout(previewTimer);
    clearTimeout(previewHideTimer);
    if (preview && preview.anchor === t.a) return;
    previewTimer = setTimeout(function () { showPreview(t); }, PREVIEW_DELAY);
  }

  function scheduleHide() {
    clearTimeout(previewTimer);
    clearTimeout(previewHideTimer);
    previewHideTimer = setTimeout(hidePreview, PREVIEW_GRACE);
  }

  function installPreviews() {
    if (!window.fetch || !window.DOMParser) return;
    var fine = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : null;
    document.addEventListener("mouseover", function (ev) {
      if (fine && !fine.matches) return;
      var t = previewTarget(ev.target);
      if (t) scheduleShow(t);
    });
    document.addEventListener("mouseout", function (ev) {
      var t = previewTarget(ev.target);
      if (t && !(ev.relatedTarget && t.a.contains(ev.relatedTarget))) scheduleHide();
    });
    document.addEventListener("focusin", function (ev) {
      var t = previewTarget(ev.target);
      if (t && ev.target.matches(":focus-visible")) scheduleShow(t);
      else if (preview) hidePreview();
    });
    document.addEventListener("focusout", function (ev) {
      if (previewTarget(ev.target)) scheduleHide();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && preview) hidePreview();
    });
    window.addEventListener("scroll", function () { if (preview) hidePreview(); }, { passive: true });
    document.addEventListener("click", function () { if (preview) hidePreview(); });
  }

  function init() {
    installCopyButtons();
    installPreviews();
    installQuerySort();
    document.addEventListener("click", onSummaryClick);
    document.addEventListener("click", onAnchorClick);
    window.addEventListener("hashchange", revealHash);
    revealHash();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
