<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:f="http://www.forester-notes.org">

  <xsl:key name="tree-with-uri" match="/f:tree/f:mainmatter//f:tree" use="f:frontmatter/f:uri/text()" />

  <!-- Editor configuration: set to "emacs", "vscode", "nvim", or a custom URL scheme.
       Supported values:
         "emacs"   -> forester-edit://open?path=FILE  (requires forester-edit handler)
         "vscode"  -> vscode://file/FILE
         "cursor"  -> cursor://file/FILE
         custom    -> CUSTOM://file/FILE
  -->
  <xsl:variable name="editor">emacs</xsl:variable>

  <!-- Default theme applied when a tree has no \meta{theme}{...}.
       Set to "" to disable default theming. Use "none" in a tree's meta to skip.
       Available: paper · dracula · academic · solarized · editorial · blueprint. -->
  <xsl:variable name="default-theme">paper</xsl:variable>

  <xsl:template match="/">
    <xsl:choose>
      <xsl:when test="/f:tree/f:frontmatter/f:meta[@name='layout'] = 'reveal'">
        <xsl:call-template name="reveal-root" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="default-root" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="default-root">
    <html xmlns="http://www.w3.org/1999/xhtml" data-base-url="{/f:tree/@base-url}">
      <head>
        <meta name="viewport" content="width=device-width" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700;800&amp;family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap" />
        <link rel="stylesheet" href="{/f:tree/@base-url}style.css" />
        <link rel="stylesheet" href="{/f:tree/@base-url}katex.min.css" />
        <script type="text/javascript">
          <xsl:if test="/f:tree/f:frontmatter/f:source-path">
            <xsl:text>window.sourcePath = '</xsl:text>
            <xsl:value-of select="/f:tree/f:frontmatter/f:source-path" />
            <xsl:text>'</xsl:text>
          </xsl:if>
        </script>
        <script type="module" src="{/f:tree/@base-url}forester.js"></script>
        <script defer="defer" src="{/f:tree/@base-url}forester-extras.js"></script>
        <title>
          <xsl:value-of select="/f:tree/f:frontmatter/f:title/@text" />
        </title>
      </head>
      <body>
        <ninja-keys placeholder="Start typing a note title or ID"
                    exportparts="ninja-input,ninja-input-wrapper,actions-list,ninja-action,ninja-selected,ninja-icon,ninja-title,ninja-hotkey,ninja-group-header,ninja-result-taxon,ninja-result-title,ninja-result-slug"></ninja-keys>
        <xsl:if test="not(/f:tree[@root = 'true'])">
          <header class="header">
            <nav class="nav">
              <div class="nav-links">
                <a href="{/f:tree/@base-url}index.html" title="Home">
                  <xsl:text>« Home</xsl:text>
                </a>
              </div>
            </nav>
          </header>
        </xsl:if>
        <div id="grid-wrapper">
          <xsl:if test="f:tree/f:frontmatter/f:meta[@name='layout']">
            <xsl:attribute name="class">
              <xsl:text>layout-</xsl:text>
              <xsl:value-of select="f:tree/f:frontmatter/f:meta[@name='layout']" />
            </xsl:attribute>
          </xsl:if>
          <article>
            <xsl:attribute name="class">
              <xsl:text>tree-container</xsl:text>
              <xsl:if test="f:tree/f:frontmatter/f:meta[@name='layout']">
                <xsl:text> layout-</xsl:text>
                <xsl:value-of select="f:tree/f:frontmatter/f:meta[@name='layout']" />
              </xsl:if>
              <xsl:choose>
                <xsl:when test="f:tree/f:frontmatter/f:meta[@name='theme'] = 'none'" />
                <xsl:when test="f:tree/f:frontmatter/f:meta[@name='theme']">
                  <xsl:text> theme-</xsl:text>
                  <xsl:value-of select="f:tree/f:frontmatter/f:meta[@name='theme']" />
                </xsl:when>
                <xsl:when test="$default-theme != ''">
                  <xsl:text> theme-</xsl:text>
                  <xsl:value-of select="$default-theme" />
                </xsl:when>
              </xsl:choose>
            </xsl:attribute>
            <xsl:apply-templates select="f:tree" />
          </article>
          <xsl:if test="f:tree/f:mainmatter/f:tree[not(@toc='false')] and not(/f:tree/f:frontmatter/f:meta[@name = 'toc']/.='false')">
            <nav id="toc">
              <input type="checkbox" id="toc-toggle" checked="checked" />
              <label class="toc-toggle-btn" for="toc-toggle"></label>
              <div class="toc-content">
                <h1>Table of Contents</h1>
                <div class="block">
                  <xsl:apply-templates select="f:tree/f:mainmatter" mode="toc" />
                </div>
              </div>
            </nav>
          </xsl:if>
        </div>
      </body>
    </html>
  </xsl:template>

  <!-- Reveal.js slide-deck scaffold. Triggered by \meta{layout}{reveal}. -->
  <xsl:template name="reveal-root">
    <xsl:variable name="reveal-theme">
      <xsl:choose>
        <xsl:when test="/f:tree/f:frontmatter/f:meta[@name='reveal-theme']">
          <xsl:value-of select="/f:tree/f:frontmatter/f:meta[@name='reveal-theme']" />
        </xsl:when>
        <xsl:otherwise>white</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <html xmlns="http://www.w3.org/1999/xhtml" data-base-url="{/f:tree/@base-url}">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css" />
        <xsl:if test="$reveal-theme != 'none'">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/{$reveal-theme}.css" id="reveal-theme-link" />
        </xsl:if>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700;800&amp;family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap" />
        <link rel="stylesheet" href="{/f:tree/@base-url}style.css" />
        <link rel="stylesheet" href="{/f:tree/@base-url}katex.min.css" />
        <style>
          /* Make the slides legible against the forest paper theme. */
          .reveal { background: var(--bg, #f1e8d2); color: var(--fg, #38301f); }
          .reveal .slides section { text-align: left; font-family: var(--font-body); }
          .reveal h1, .reveal h2, .reveal h3 { color: var(--fg); text-transform: none; font-family: var(--font-head); }
          .reveal .slide-title { color: var(--accent); margin-bottom: 0.5em; }
          .reveal a { color: var(--link); }
          .reveal pre, .reveal code { font-family: var(--font-mono); color: var(--code-fg); }
          .reveal pre { box-shadow: none; width: auto; margin: 0.6em 0; background: transparent; }
          .reveal pre.shiki { background: transparent !important; padding: 0.4em 0; border-radius: 0; }
          .reveal pre.shiki code { background: transparent !important; counter-reset: step; counter-increment: step 0; display: block; }
          .reveal pre.shiki code .line::before {
            content: counter(step);
            counter-increment: step;
            display: inline-block;
            width: 1.8em;
            margin-right: 1em;
            text-align: right;
            color: var(--fg-faint);
            user-select: none;
          }
          .reveal aside.notes { display: none; }
          .reveal blockquote { border-left: 3px solid var(--accent); background: var(--surface); padding: 0.6em 1em; }
          /* In-slide transclusions render inline; just style the heading. */
          .reveal .transcluded { margin: 0.6em 0; }
          .reveal .transcluded > h3.transcluded-title {
            font-size: 0.85em; color: var(--accent); margin: 0 0 0.3em 0;
            text-transform: uppercase; letter-spacing: 0.08em;
          }
          /* ===== Per-slide CSS hooks: \meta{slide-class}{...} ===== */
          /* Vertically center this slide's content. */
          .reveal section.center {
            display: flex !important; flex-direction: column;
            justify-content: center; min-height: 100%;
          }
          /* Bigger title on this slide. */
          .reveal section.big-title > h2.slide-title { font-size: 2.5em; }
          .reveal section.huge-title > h2.slide-title { font-size: 4em; line-height: 1.05; }
          .reveal section.mega-title > h2.slide-title { font-size: 6em; line-height: 1.0; }
          /* Reverse-video section divider. */
          .reveal section.divider {
            background: var(--accent); color: var(--bg);
            margin: 0 -2rem; padding: 2rem;
          }
          .reveal section.divider > h2.slide-title,
          .reveal section.divider > h2.slide-title a { color: var(--bg); }
          /* Plain-title variant: drops the accent color/casing. */
          .reveal section.plain-title > h2.slide-title {
            color: var(--fg); text-transform: none; letter-spacing: 0;
          }
        </style>
        <!-- Per-deck font-size knob. Use \meta{font-size}{32px} or {1.4em}, etc. -->
        <xsl:if test="/f:tree/f:frontmatter/f:meta[@name='font-size']">
          <style>
            .reveal { font-size: <xsl:value-of select="/f:tree/f:frontmatter/f:meta[@name='font-size']" /> !important; }
          </style>
        </xsl:if>
        <!-- Force-activate the paper theme tokens inside .reveal.theme-paper. -->
        <xsl:if test="/f:tree/f:frontmatter/f:meta[@name='theme'] = 'paper' or not(/f:tree/f:frontmatter/f:meta[@name='theme'])">
          <style>
            :root:has(.reveal.theme-paper) {
              --orange:   oklch(0.585 0.145 47);
              --burgundy: oklch(0.430 0.125 22);
              --blue:     oklch(0.500 0.090 245);
              --mustard:  oklch(0.730 0.130 86);
              --bg: #f1e8d2; --surface: #f7f0dd;
              --fg: #38301f; --fg-muted: #7c6a4f; --fg-faint: #ab9a78;
              --rule: #ddccaa; --rule-strong: #c4ab7c;
              --accent: var(--orange); --accent-2: var(--blue);
              --link: var(--burgundy);
              --code-bg: #e8dbbb; --code-fg: #564731;
              --font-head: "Futura", "Jost", "Century Gothic", sans-serif;
              --font-body: "Futura", "Jost", "Century Gothic", sans-serif;
            }
          </style>
        </xsl:if>
        <title>
          <xsl:value-of select="/f:tree/f:frontmatter/f:title/@text" />
        </title>
      </head>
      <body>
        <div class="reveal theme-paper">
          <div class="slides">
            <!-- No synthetic title slide. Author your own first slide
                 (e.g. \transclude{...}) — the deck's frontmatter still
                 supplies the <title> element for the browser tab. -->
            <xsl:apply-templates select="/f:tree/f:mainmatter/*" mode="slide" />
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/notes/notes.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/math/math.js"></script>
        <script type="module">
          // Shiki syntax highlighting. Loads Agda TextMate grammar from theme,
          // highlights every &lt;pre&gt;&lt;code class="language-X"&gt; in place, then
          // initializes Reveal so the highlighted DOM is what gets laid out.
          try {
            const baseUrl = document.documentElement.dataset.baseUrl || '';
            const [shiki, agdaGrammar] = await Promise.all([
              import('https://esm.sh/shiki@1.22.0'),
              fetch(baseUrl + 'agda.tmLanguage.json').then(r =&gt; r.json()),
            ]);
            const highlighter = await shiki.createHighlighter({
              themes: ['vitesse-light'],
              langs: [
                'haskell', 'typescript', 'bash', 'json',
                { ...agdaGrammar, name: 'agda', scopeName: 'source.agda' },
              ],
            });
            const loaded = new Set(highlighter.getLoadedLanguages());
            document.querySelectorAll('pre &gt; code[class*="language-"]').forEach(el =&gt; {
              const langClass = [...el.classList].find(c =&gt; c.startsWith('language-'));
              if (!langClass) return;
              const lang = langClass.replace('language-', '');
              if (!loaded.has(lang)) return;
              const code = el.textContent;
              const html = highlighter.codeToHtml(code, { lang, theme: 'vitesse-light' });
              el.parentElement.outerHTML = html;
            });
          } catch (e) {
            console.warn('Shiki highlight failed:', e);
          }
          Reveal.initialize({
            hash: true,
            center: false,
            slideNumber: 'c/t',
            plugins: [ RevealNotes, RevealMath.KaTeX ],
            keyboard: {
              // h / l: jump to prev/next slide, skipping fragments.
              // j / k untouched -- keep reveal's defaults (fragment-aware).
              72: () =&gt; Reveal.left({skipFragments: true}),
              76: () =&gt; Reveal.right({skipFragments: true}),
            }
          });
        </script>
      </body>
    </html>
  </xsl:template>

  <!-- In slide mode, a transcluded tree becomes a section. Its mainmatter
       contents are rendered directly (no details/summary chrome). The slide
       title links out to the standalone tree page when one exists. -->
  <xsl:template match="f:tree" mode="slide">
    <section>
      <!-- Per-slide CSS hook. Use \meta{slide-class}{center big-title} or
           stack multiple \meta{slide-class}{X} calls; they concatenate. -->
      <xsl:if test="f:frontmatter/f:meta[@name='slide-class']">
        <xsl:attribute name="class">
          <xsl:for-each select="f:frontmatter/f:meta[@name='slide-class']">
            <xsl:if test="position() &gt; 1"><xsl:text> </xsl:text></xsl:if>
            <xsl:value-of select="." />
          </xsl:for-each>
        </xsl:attribute>
      </xsl:if>
      <xsl:if test="f:frontmatter/f:title and not(f:frontmatter/f:meta[@name='slide-no-title']='true')">
        <h2 class="slide-title">
          <xsl:choose>
            <xsl:when test="f:frontmatter/f:route">
              <a href="{f:frontmatter/f:route}" target="_blank" rel="noopener">
                <xsl:apply-templates select="f:frontmatter/f:title" />
              </a>
            </xsl:when>
            <xsl:otherwise>
              <xsl:apply-templates select="f:frontmatter/f:title" />
            </xsl:otherwise>
          </xsl:choose>
        </h2>
      </xsl:if>
      <xsl:apply-templates select="f:mainmatter" />
    </section>
  </xsl:template>

  <!-- Any other top-level element (e.g. paragraphs, raw HTML) renders as-is. -->
  <xsl:template match="*" mode="slide">
    <xsl:apply-templates select="." />
  </xsl:template>

  <xsl:template match="f:tree" mode="tree-taxon-with-number">
    <xsl:param name="suffix" select="''" />
    <xsl:param name="taxon" select="f:frontmatter/f:taxon" />
    <xsl:param name="number" select="f:frontmatter/f:number" />
    <xsl:param name="fallback-number" />
    <xsl:param name="in-backmatter" select="ancestor::f:backmatter" />

    <xsl:variable name="tree-is-root" select="not(parent::*)" />

    <xsl:variable name="explicitly-unnumbered" select="boolean(ancestor-or-self::f:tree[@numbered='false' or @toc='false'])" />
    <xsl:variable name="implicitly-unnumbered" select="count(../f:tree) = 1 and not(count(f:mainmatter/f:tree) > 1)" />

    <xsl:variable name="should-number" select="$number != '' or (not($in-backmatter) and not($tree-is-root) and not($explicitly-unnumbered)) and not($implicitly-unnumbered)" />

    <xsl:if test="$taxon != ''">
      <xsl:value-of select="$taxon" />
      <xsl:if test="$should-number or $fallback-number != ''">
        <xsl:text>&#160;</xsl:text>
      </xsl:if>
    </xsl:if>

    <xsl:choose>
      <xsl:when test="$should-number">
        <xsl:choose>
          <xsl:when test="$number != ''">
            <xsl:value-of select="$number" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:number format="1.1" count="f:tree[ancestor::f:tree and (not(@toc='false' or @numbered='false'))]" level="multiple" />
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:when test="$fallback-number != ''">
        <xsl:value-of select="$fallback-number" />
      </xsl:when>
    </xsl:choose>

    <xsl:if test="$taxon != '' or $fallback-number != '' or $should-number">
      <xsl:value-of select="$suffix" />
    </xsl:if>
  </xsl:template>

  <xsl:template match="f:tree" mode="contextual-number">
    <xsl:param name="suffix" select="''" />
    <xsl:param name="number" select="f:frontmatter/f:number" />
    <xsl:param name="fallback-number" />
    <xsl:param name="in-backmatter" select="ancestor::f:backmatter" />

    <xsl:variable name="tree-is-root" select="not(parent::*)" />

    <xsl:variable name="explicitly-unnumbered" select="boolean(ancestor-or-self::f:tree[@numbered='false' or @toc='false'])" />
    <xsl:variable name="implicitly-unnumbered" select="count(../f:tree) = 1 and not(count(f:mainmatter/f:tree) > 1)" />

    <xsl:variable name="should-number" select="$number != '' or (not($in-backmatter) and not($tree-is-root) and not($explicitly-unnumbered)) and not($implicitly-unnumbered)" />

    <xsl:choose>
      <xsl:when test="$should-number">
        <xsl:choose>
          <xsl:when test="$number != ''">
            <xsl:value-of select="$number" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:number format="1.1" count="f:tree[ancestor::f:tree and (not(@toc='false' or @numbered='false'))]" level="multiple" />
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:when test="$fallback-number != ''">
        <xsl:value-of select="$fallback-number" />
      </xsl:when>
    </xsl:choose>

    <xsl:if test="$fallback-number != '' or $should-number">
      <xsl:value-of select="$suffix" />
    </xsl:if>
  </xsl:template>

  <xsl:template match="f:tree" mode="toc">
    <li>
      <xsl:for-each select="f:frontmatter">
        <a class="bullet">
          <xsl:choose>
            <xsl:when test="f:display-uri and f:route">
              <xsl:attribute name="href">
                <xsl:value-of select="f:route" />
              </xsl:attribute>
              <xsl:attribute name="title">
                <xsl:value-of select="f:title/@text" />
                <xsl:text>&#160;[</xsl:text>
                <xsl:value-of select="f:display-uri" />
                <xsl:text>]</xsl:text>
              </xsl:attribute>
            </xsl:when>
            <xsl:otherwise>
              <xsl:attribute name="href">
                <xsl:text>#</xsl:text>
                <xsl:value-of select="generate-id(..)" />
              </xsl:attribute>
              <xsl:attribute name="title">
                <xsl:value-of select="f:title" />
              </xsl:attribute>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:text>■</xsl:text>
        </a>
        <span class="link local" data-target="#{generate-id(..)}">
          <span class="taxon">
            <xsl:apply-templates select=".." mode="tree-taxon-with-number">
              <xsl:with-param name="suffix">.&#160;</xsl:with-param>
            </xsl:apply-templates>
          </span>

          <xsl:apply-templates select="f:title" />
        </span>
      </xsl:for-each>
      <xsl:apply-templates select="f:mainmatter" mode="toc" />
    </li>
  </xsl:template>

  <xsl:template match="f:mainmatter" mode="toc">
    <ul class="block">
      <xsl:apply-templates select="f:tree[not(@toc='false')]" mode="toc" />
    </ul>
  </xsl:template>

  <xsl:template match="f:frontmatter/f:title">
    <xsl:apply-templates />
  </xsl:template>

  <xsl:template match="f:mainmatter">
     <xsl:apply-templates />
  </xsl:template>

  <xsl:template match="f:display-uri[../f:route]">
    <a class="slug" href="{../f:route}">
      <xsl:text>[</xsl:text>
      <xsl:value-of select="." />
      <xsl:text>]</xsl:text>
    </a>
  </xsl:template>

  <xsl:template match="f:display-uri[not(../f:route)]">
  </xsl:template>

  <xsl:template match="f:resource">
    <xsl:apply-templates select="f:resource-content" />
  </xsl:template>

  <xsl:template match="f:resource-content">
    <xsl:apply-templates />
  </xsl:template>

  <xsl:template match="f:source-path">
    <a class="edit-button" title="{.}">
      <xsl:attribute name="href">
        <xsl:choose>
          <xsl:when test="$editor = 'emacs'">
            <xsl:text>forester-edit://open?path=</xsl:text>
            <xsl:value-of select="." />
          </xsl:when>
          <xsl:when test="$editor = 'vscode'">
            <xsl:text>vscode://file</xsl:text>
            <xsl:value-of select="." />
          </xsl:when>
          <xsl:when test="$editor = 'cursor'">
            <xsl:text>cursor://file</xsl:text>
            <xsl:value-of select="." />
          </xsl:when>
          <xsl:otherwise>
            <!-- Custom: use editor value as the URL scheme -->
            <xsl:value-of select="$editor" />
            <xsl:text>://file</xsl:text>
            <xsl:value-of select="." />
          </xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>
      <xsl:text>[edit]</xsl:text>
    </a>
  </xsl:template>

  <xsl:template match="f:taxon">
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="f:frontmatter">
    <header>
      <h1>
        <xsl:choose>
          <xsl:when test="f:meta[@name='status']">
            <span class="todo-status todo-status-{f:meta[@name='status']}">
              <xsl:choose>
                <xsl:when test="f:meta[@name='status'] = 'pending'">TODO</xsl:when>
                <xsl:when test="f:meta[@name='status'] = 'in-progress'">IN-PROGRESS</xsl:when>
                <xsl:when test="f:meta[@name='status'] = 'done'">DONE</xsl:when>
                <xsl:when test="f:meta[@name='status'] = 'cancelled'">CANCELLED</xsl:when>
                <xsl:otherwise>
                  <xsl:value-of select="f:meta[@name='status']" />
                </xsl:otherwise>
              </xsl:choose>
              <xsl:text>.&#160;</xsl:text>
            </span>
          </xsl:when>
          <xsl:otherwise>
            <span class="taxon">
              <xsl:apply-templates select=".." mode="tree-taxon-with-number">
                <xsl:with-param name="suffix">.&#160;</xsl:with-param>
              </xsl:apply-templates>
            </span>
          </xsl:otherwise>
        </xsl:choose>

        <xsl:apply-templates select="f:title" />
        <xsl:text>&#032;</xsl:text>
        <xsl:apply-templates select="f:display-uri" />
        <xsl:text>&#032;</xsl:text>
        <xsl:apply-templates select="f:source-path" />
      </h1>
      <div class="metadata">
        <ul>
          <xsl:apply-templates select="f:date" />
          <xsl:if test="not(f:meta[@name = 'author']/.='false')">
            <xsl:apply-templates select="f:authors" />
          </xsl:if>
          <xsl:apply-templates select="f:meta[@name='position']" />
          <xsl:apply-templates select="f:meta[@name='institution']" />
          <xsl:apply-templates select="f:meta[@name='venue']" />
          <xsl:apply-templates select="f:meta[@name='source']" />
          <xsl:apply-templates select="f:meta[@name='doi']" />
          <xsl:apply-templates select="f:meta[@name='orcid']" />
          <xsl:apply-templates select="f:meta[@name='external']" />
          <xsl:apply-templates select="f:meta[@name='slides']" />
          <xsl:apply-templates select="f:meta[@name='video']" />
          <xsl:apply-templates select="f:meta[@name='pdf']" mode="pdf-link" />
        </ul>
        <xsl:if test="f:meta[@name='pdf'] and normalize-space(f:meta[@name='pdf']) != '' and not(ancestor::f:mainmatter)">
          <details class="pdf-viewer-details">
            <summary>Embedded PDF</summary>
            <iframe class="pdf-viewer" src="{f:meta[@name='pdf']}"></iframe>
          </details>
        </xsl:if>
      </div>
    </header>
  </xsl:template>

  <xsl:template match="f:ref">
    <xsl:variable name="fallback-number">
      <xsl:text>[</xsl:text>
      <xsl:value-of select="@uri" />
      <xsl:text>]</xsl:text>
    </xsl:variable>

    <xsl:variable name="taxon">
      <xsl:choose>
        <xsl:when test="@taxon">
          <xsl:value-of select="@taxon" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>§</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <a class="link local">
      <xsl:attribute name="href">
        <xsl:choose>
          <xsl:when test="key('tree-with-uri',current()/@uri)">
            <xsl:text>#</xsl:text>
            <xsl:value-of select="generate-id(key('tree-with-uri',current()/@uri))" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="@href" />
          </xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>

      <xsl:choose>
        <xsl:when test="key('tree-with-uri', current()/@uri)">
          <xsl:apply-templates select="key('tree-with-uri', current()/@uri)" mode="tree-taxon-with-number">
            <xsl:with-param name="in-backmatter" select="boolean(ancestor::f:backmatter)" />
            <xsl:with-param name="number" select="@number" />
            <xsl:with-param name="fallback-number" select="$fallback-number" />
            <xsl:with-param name="taxon" select="$taxon" />
          </xsl:apply-templates>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$taxon" />
          <xsl:text>&#160;</xsl:text>
          <xsl:choose>
            <xsl:when test="@number">
              <xsl:value-of select="@number" />
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="$fallback-number" />
            </xsl:otherwise>
          </xsl:choose>
        </xsl:otherwise>
      </xsl:choose>
    </a>
  </xsl:template>

  <xsl:template match="f:contextual-number[@uri]">
    <xsl:variable name="fallback-number">
      <xsl:text>[</xsl:text>
      <xsl:value-of select="@display-uri" />
      <xsl:text>]</xsl:text>
    </xsl:variable>

    <xsl:choose>
      <xsl:when test="key('tree-with-uri', current()/@uri)">
        <xsl:apply-templates select="key('tree-with-uri', current()/@uri)" mode="contextual-number">
          <xsl:with-param name="in-backmatter" select="boolean(ancestor::f:backmatter)" />
          <xsl:with-param name="fallback-number" select="$fallback-number" />
        </xsl:apply-templates>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$fallback-number" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="/f:tree[@root='true']/f:backmatter">
  </xsl:template>

  <xsl:template match="/f:tree[not(@root='true')]/f:backmatter">
    <footer>
      <xsl:choose>
        <xsl:when test="../f:frontmatter/f:taxon = 'Person'">
          <xsl:apply-templates select="f:tree[f:frontmatter/f:title = 'References']" />
          <xsl:apply-templates select="f:tree[f:frontmatter/f:title = 'Context']" />
          <xsl:apply-templates select="f:tree[f:frontmatter/f:title = 'Contributions']" />
          <xsl:apply-templates select="f:tree[f:frontmatter/f:title = 'Backlinks']" />
          <xsl:apply-templates select="f:tree[f:frontmatter/f:title = 'Related']" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates />
        </xsl:otherwise>
      </xsl:choose>
    </footer>
  </xsl:template>

  <xsl:template match="f:mainmatter//f:backmatter">
  </xsl:template>

  <xsl:template match="f:backmatter//f:backmatter">
  </xsl:template>

  <!-- In-slide transclusion: when the deck is in reveal layout, nested trees
       (i.e. \transclude inside a slide body) render inline as a small block
       with an optional accent-colored title — no <details>/<summary> chrome. -->
  <xsl:template match="f:tree[f:mainmatter[*] or not(@hidden-when-empty = 'true')]"
                priority="2">
    <xsl:choose>
      <xsl:when test="/f:tree/f:frontmatter/f:meta[@name='layout'] = 'reveal'">
        <div class="transcluded">
          <xsl:if test="f:frontmatter/f:title and not(@show-heading='false')">
            <h3 class="transcluded-title">
              <xsl:choose>
                <xsl:when test="f:frontmatter/f:route">
                  <a href="{f:frontmatter/f:route}" target="_blank" rel="noopener">
                    <xsl:apply-templates select="f:frontmatter/f:title" />
                  </a>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:apply-templates select="f:frontmatter/f:title" />
                </xsl:otherwise>
              </xsl:choose>
            </h3>
          </xsl:if>
          <xsl:apply-templates select="f:mainmatter" />
        </div>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="default-tree-block" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="default-tree-block">
    <section>
      <xsl:attribute name="lang">
        <xsl:choose>
          <xsl:when test="f:frontmatter/f:meta[@name='lang']">
            <xsl:value-of select="f:frontmatter/f:meta[@name='lang']" />
          </xsl:when>
          <xsl:otherwise>en</xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>

      <xsl:choose>
        <xsl:when test="@show-metadata = 'false'">
          <xsl:attribute name="class">block hide-metadata</xsl:attribute>
        </xsl:when>
        <xsl:otherwise>
          <xsl:attribute name="class">block</xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="f:frontmatter/f:taxon">
        <xsl:attribute name="data-taxon">
          <xsl:value-of select="f:frontmatter/f:taxon" />
        </xsl:attribute>
      </xsl:if>
      <xsl:if test="f:frontmatter/f:meta[@name='status']">
        <xsl:attribute name="data-status">
          <xsl:value-of select="f:frontmatter/f:meta[@name='status']" />
        </xsl:attribute>
      </xsl:if>

      <xsl:choose>
        <xsl:when test="not(@show-heading='false')">
          <details id="{generate-id(.)}">
            <xsl:if test="not(@expanded = 'false')">
              <xsl:attribute name="open">open</xsl:attribute>
            </xsl:if>
            <summary>
              <xsl:apply-templates select="f:frontmatter" />
            </summary>
            <div class="tree-content">
              <xsl:apply-templates select="f:mainmatter" />
              <xsl:apply-templates select="f:frontmatter/f:meta[@name='bibtex']" />
            </div>
          </details>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="f:mainmatter" />
        </xsl:otherwise>
      </xsl:choose>
    </section>

    <xsl:apply-templates select="f:backmatter" />
  </xsl:template>

  <xsl:template match="f:tree"></xsl:template>

</xsl:stylesheet>
