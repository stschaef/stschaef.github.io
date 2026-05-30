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

  <xsl:template match="f:tree[f:mainmatter[*] or not(@hidden-when-empty = 'true')]">
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
