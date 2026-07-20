<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<!-- Reveal.js slide-deck rendering. Split out of tree.xsl so the deck feature
     stays isolated from the (near-upstream) tree templates and is easy to grow.
     Triggered by \meta{layout}{reveal}; the dispatch lives in tree.xsl's
     match="/" template, which calls the named template reveal-root below. -->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:f="http://www.forester-notes.org">

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
        <!-- Static deck styles (extracted to a real .css file for editability). -->
        <link rel="stylesheet" href="{/f:tree/@base-url}reveal.css" />
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
          <xsl:choose>
            <xsl:when test="/f:tree/f:frontmatter/f:meta[@name='browser-title']">
              <xsl:value-of select="/f:tree/f:frontmatter/f:meta[@name='browser-title']" />
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="/f:tree/f:frontmatter/f:title/@text" />
            </xsl:otherwise>
          </xsl:choose>
        </title>
      </head>
      <body>
        <!-- Command palette: lets Ctrl-K / Cmd-K open forest navigation even
             from a fullscreen deck. forester.js (loaded below) registers the
             component and fills it from forest.json. -->
        <ninja-keys placeholder="Start typing a note title or ID"
                    exportparts="ninja-input,ninja-input-wrapper,actions-list,ninja-action,ninja-selected,ninja-icon,ninja-title,ninja-hotkey,ninja-group-header,ninja-result-taxon,ninja-result-title,ninja-result-slug"></ninja-keys>
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
        <!-- Deck bootstrap (Shiki highlight + Reveal.initialize), extracted to a
             real .js file. Must follow the classic plugin scripts above so that
             Reveal / RevealNotes / RevealMath are globals when it runs. -->
        <script type="module" src="{/f:tree/@base-url}reveal-deck.js"></script>
        <!-- Declarative commutative-diagram animation runtime (sticky arrows,
             keyframe interpolation). Module, so it runs after reveal-deck.js. -->
        <script type="module" src="{/f:tree/@base-url}cd-anim.js"></script>
        <!-- Derivation / parse tree animation runtime. -->
        <script type="module" src="{/f:tree/@base-url}dtree.js"></script>
        <!-- Registers the ninja-keys command palette and fills it from
             forest.json, so Ctrl-K navigates the forest from inside a deck. Its
             load-time init is deck-safe (no #grid-wrapper dependency). -->
        <script type="module" src="{/f:tree/@base-url}forester.js"></script>
      </body>
    </html>
  </xsl:template>

  <!-- In slide mode, a transcluded tree becomes a section. Its mainmatter
       contents are rendered directly (no details/summary chrome). The slide
       title links out to the standalone tree page when one exists. -->
  <xsl:template match="f:tree" mode="slide">
    <section>
      <!-- Auto-animate: tween matching elements (by data-id) between this slide
           and its neighbours. Triggered per-slide via \meta{auto-animate}{true}
           or deck-wide via the same meta on the deck root. -->
      <xsl:if test="f:frontmatter/f:meta[@name='auto-animate']='true' or /f:tree/f:frontmatter/f:meta[@name='auto-animate']='true'">
        <xsl:attribute name="data-auto-animate">true</xsl:attribute>
      </xsl:if>
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

</xsl:stylesheet>
