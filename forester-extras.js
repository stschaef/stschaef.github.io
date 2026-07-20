/* Forester theme additions — Theme Studio design.
   Builds the persistent left identity rail (name → home, email, page TOC)
   and strips the trailing "." baked into stamped taxon/status labels.
   Kept separate from forester.js so re-bundling upstream JS doesn't clobber it. */

(function () {
  // Identity values — edit here to change what shows in the sidebar.
  const SITE = {
    name: "Steven Schaefer",
    email: "stschaef@umich.edu",
    socials: [
      {
        name: "Mastodon",
        href: "https://mathstodon.xyz/@stschaef",
        rel: "me",
        svg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M23.27 5.32c-.35-2.6-2.62-4.65-5.31-5.05C17.51.19 15.78 0 11.99 0h-.02c-3.79 0-4.6.19-5.05.27C4.33.66 1.94 2.5 1.36 5.13c-.28 1.3-.31 2.74-.26 4.06.07 1.89.09 3.78.26 5.66.12 1.25.33 2.49.62 3.71.55 2.27 2.81 4.15 5.03 4.92 2.38.81 4.95.94 7.4.39.27-.06.54-.13.81-.21.6-.19 1.31-.4 1.83-.77.01-.01.01-.01.01-.02v-1.84s0-.01-.01-.01h-.01c-1.57.37-3.18.56-4.79.56-2.78 0-3.52-1.31-3.74-1.86-.17-.47-.28-.97-.32-1.46-.01-.01-.01-.02 0-.03h.01c1.55.37 3.13.56 4.72.56.38 0 .76 0 1.14-.01 1.6-.04 3.29-.13 4.86-.44.04-.01.08-.02.11-.03 2.48-.48 4.84-1.97 5.08-5.74.01-.15.04-1.56.04-1.71.01-.52.18-3.71-.02-5.67zm-3.85 9.4h-2.41V8.78c0-1.24-.52-1.86-1.55-1.86-1.13 0-1.7.73-1.7 2.18v3.16h-2.4V9.09c0-1.46-.57-2.19-1.7-2.19-1.04 0-1.55.63-1.55 1.86v5.95H5.7V8.6c0-1.24.31-2.22.94-2.95.65-.73 1.5-1.1 2.56-1.1 1.22 0 2.15.47 2.77 1.41l.6.99.6-.99c.62-.94 1.54-1.41 2.77-1.41 1.05 0 1.91.37 2.56 1.1.62.73.94 1.71.94 2.95v6.12z"/></svg>',
      },
      {
        name: "GitHub",
        href: "https://github.com/stschaef",
        svg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.01c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.92-.39 2.9-.39.98 0 1.98.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.15v3.19c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/></svg>',
      },
      {
        name: "ORCID",
        href: "https://orcid.org/0009-0007-1258-9501",
        svg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947 0 .525-.422.947-.947.947A.95.95 0 0 1 6.422 5.325c0-.516.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.025-5.325 5.025h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z"/></svg>',
      },
    ],
  };

  function buildSidebar() {
    const gw = document.getElementById("grid-wrapper");
    if (!gw) return;
    if (gw.querySelector(".site-sidebar")) return; // already built

    // Capture the upstream top bar's Home link, then drop the bar.
    const oldHeader = document.querySelector("header.header");
    const baseUrl = document.documentElement.getAttribute("data-base-url") || "/";
    let homeHref = baseUrl + "home/";
    if (oldHeader) {
      oldHeader.querySelectorAll(".nav-links a").forEach((a) => {
        const txt = (a.textContent || "").trim();
        if (/home/i.test(txt)) homeHref = a.getAttribute("href") || homeHref;
      });
      oldHeader.remove();
    }

    const socials = (SITE.socials || [])
      .map(
        (s) =>
          `<a class="site-social-link" href="${s.href}" title="${s.name}" aria-label="${s.name}"` +
          (s.rel ? ` rel="${s.rel}"` : "") +
          `>${s.svg}</a>`
      )
      .join("");

    const aside = document.createElement("aside");
    aside.className = "site-sidebar";
    aside.innerHTML =
      `<div class="site-id">` +
        `<a class="site-name" href="${homeHref}">${SITE.name}</a>` +
        `<a class="site-email" href="mailto:${SITE.email}">${SITE.email}</a>` +
        (socials ? `<nav class="site-social" aria-label="Social links">${socials}</nav>` : "") +
      `</div>`;

    const toc = gw.querySelector("nav#toc");
    if (toc) {
      const hr = document.createElement("hr");
      hr.className = "site-div";
      aside.appendChild(hr);
      aside.appendChild(toc);
    }
    gw.insertBefore(aside, gw.firstChild);
  }

  // The XSL bakes ". " (period + NBSP) onto stamped labels (`TODO. `, `Reference. `).
  // CSS can absorb most of the gap via word-spacing, but the period itself reads
  // wrong on a filled stamp — strip it from the stamp elements only.
  // Subtree numbers like "1." are NOT stamped, so they keep their period.
  function stripStampPeriods() {
    const sel = [
      ".todo-status",
      ".tree-content section[data-taxon] > details > summary > header > h1 > span.taxon",
      "article > section.block[data-taxon] > details > summary > header > h1 > span.taxon",
    ].join(",");
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = el.textContent.replace(/[.\s\u00a0]+$/, "");
    });
  }

  // The command palette (ninja-keys) only opens via the ⌘K/Ctrl+K hotkey,
  // which is unreachable on touch devices. Add a tap target that opens it.
  function buildSearchButton() {
    if (document.getElementById("search-fab")) return; // already built
    const btn = document.createElement("button");
    btn.id = "search-fab";
    btn.type = "button";
    btn.setAttribute("aria-label", "Search");
    btn.title = "Search (⌘K)";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
      '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'd="M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z"/></svg>';
    btn.addEventListener("click", () => {
      const ninja = document.querySelector("ninja-keys");
      if (ninja && typeof ninja.open === "function") ninja.open();
    });
    document.body.appendChild(btn);

    const css = document.createElement("style");
    css.textContent =
      "#search-fab{position:fixed;right:1.1rem;bottom:1.1rem;z-index:1000;" +
      "width:3rem;height:3rem;border-radius:50%;border:none;cursor:pointer;" +
      "display:flex;align-items:center;justify-content:center;color:#fff;" +
      "background:var(--accent,#3b6ea5);box-shadow:0 2px 8px rgba(0,0,0,.35);" +
      "-webkit-tap-highlight-color:transparent;}" +
      "#search-fab:hover{filter:brightness(1.08);}" +
      "#search-fab:active{transform:scale(.94);}" +
      "@media (min-width:1000px){#search-fab{width:2.6rem;height:2.6rem;opacity:.85;}}";
    document.head.appendChild(css);
  }

  function run() {
    buildSidebar();
    stripStampPeriods();
    buildSearchButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
