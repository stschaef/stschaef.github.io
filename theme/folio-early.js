// Run in <head> before the page is drawn ([theme] head-js): the reader's saved settings from the
// panel, set on <html> exactly as folio.js sets them, so nothing redraws once folio.js runs.
(function () {
  var r = document.documentElement, c = {}, scheme = "celadon", mode = "still";
  try { c = JSON.parse(localStorage.getItem("folio-config") || "{}") || {}; } catch (e) {}
  try { scheme = localStorage.getItem("folio-scheme") || scheme; } catch (e) {}
  try { mode = localStorage.getItem("folio-ornament") || mode; } catch (e) {}
  if (scheme !== "folk") r.setAttribute("data-folio-scheme", scheme);
  r.setAttribute("data-folio-box", c.boxes || "double");
  r.setAttribute("data-folio-hyphens", c.hyphens || "penalty");
  if (mode === "off") r.classList.add("folio-plain");

  // What a precomputed ornament depends on besides the page: the theme, the window, the reader's
  // settings and the ornament library. (folio.js stores snapshots under the same signature.)
  window.folioSnapSig = function () {
    var v = [window.heliaThemeVersion || "", window.innerWidth, window.devicePixelRatio];
    ["folio-ornament", "folio-config", "folio-scheme", "folio-pattern", "folio-density", "folio-ornaments"].forEach(function (k) {
      var x = null; try { x = localStorage.getItem(k); } catch (e) {}
      v.push(x == null ? "" : k === "folio-ornaments" ? x.length : x);
    });
    return v.join("|");
  };

  // Snapshots are stored with their commonest pieces of markup replaced by private-use characters
  // (which glyphs never are, and JSON leaves as they are): about a third the size.
  var DICT = [' class="glyph-orn" style="', "white-space: nowrap; ", "position: absolute; ", "line-height: 1; ",
    "transform-origin: ", "translate: ", "font-size: ", "rotate: ", "left: ", "top: ", "px; ", "px ", "em; ",
    "deg; ", "color: var(--accent", '" data-piece="', "</span>", "<span", '"></span>'];
  window.folioSnapPack = function (s, back) {
    for (var i = 0; i < DICT.length; i++) {
      var c = String.fromCharCode(0xE000 + i);
      s = back ? s.split(c).join(DICT[i]) : s.split(DICT[i]).join(c);
    }
    return s;
  };

  // The ornament precomputed for this visit (folio.js stores it after the previous load): put its
  // margins in the page as soon as <body> exists and its headpiece once the title block is complete,
  // so they paint with the text. folio.js then draws the same visit and takes their place.
  if (mode === "off" || /[?&]orn\./.test(location.search)) return;
  var rec = null;
  try { rec = JSON.parse(localStorage.getItem("folio-snap:" + location.pathname) || "null"); } catch (e) {}
  if (!rec || rec.sig !== window.folioSnapSig()) return;
  window.__folioSnap = { visit: rec.visit, firstH: rec.firstH, fullH: rec.fullH };
  var putM = false, putH = !rec.head, mo = null;
  var put = function () {
    if (!putM && document.body) { document.body.insertAdjacentHTML("afterbegin", window.folioSnapPack(rec.margins, true)); putM = true; }
    if (!putH) {
      var hd = document.querySelector(".helia-article > .helia-header");
      if (hd && hd.nextElementSibling) { hd.insertAdjacentHTML("beforeend", rec.head); putH = true; }
    }
    if (putM && putH && mo) mo.disconnect();
  };
  mo = new MutationObserver(put);
  mo.observe(r, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", function () { put(); mo.disconnect(); });
})();
