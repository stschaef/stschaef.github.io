// Reveal.js deck bootstrap for the forest paper theme.
// Extracted from tree.xsl's inline <script type="module"> block.
//
// Shiki syntax highlighting: loads the Agda TextMate grammar from the theme,
// highlights every <pre><code class="language-X"> in place, then initializes
// Reveal so the highlighted DOM is what gets laid out.
//
// Loaded as <script type="module" src=".../reveal-deck.js">. The reveal.js,
// notes, and math plugin classic scripts must load before this module so that
// Reveal / RevealNotes / RevealMath are available as globals.

try {
  const baseUrl = document.documentElement.dataset.baseUrl || '';
  const [shiki, agdaGrammar] = await Promise.all([
    import('https://esm.sh/shiki@1.22.0'),
    fetch(baseUrl + 'agda.tmLanguage.json').then(r => r.json()),
  ]);
  const highlighter = await shiki.createHighlighter({
    themes: ['vitesse-light'],
    langs: [
      'haskell', 'typescript', 'bash', 'json',
      { ...agdaGrammar, name: 'agda', scopeName: 'source.agda' },
    ],
  });
  const loaded = new Set(highlighter.getLoadedLanguages());
  document.querySelectorAll('pre > code[class*="language-"]').forEach(el => {
    const langClass = [...el.classList].find(c => c.startsWith('language-'));
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
  // Extend the auto-animate style list with SVG paint properties so diagram
  // edges/nodes can tween stroke + fill (e.g. highlighting a path). The first
  // dozen are reveal's defaults, which setting this key would otherwise replace.
  autoAnimateStyles: [
    'opacity', 'color', 'background-color', 'padding', 'font-size',
    'line-height', 'letter-spacing', 'border-width', 'border-color',
    'border-radius', 'outline', 'outline-offset',
    'stroke', 'stroke-width', 'fill',
  ],
  plugins: [ RevealNotes, RevealMath.KaTeX ],
  // Don't run slide shortcuts while typing in the ninja-keys command palette.
  // Its input lives in shadow DOM, so reveal's built-in editable-element check
  // misses it and would otherwise treat e.g. "h"/"l" as navigation.
  keyboardCondition: (event) =>
    !(event && event.target && event.target.closest && event.target.closest('ninja-keys')),
  keyboard: {
    // h / l: jump to prev/next slide, skipping fragments.
    // j / k and the arrow keys keep reveal's defaults (vertical nav drives the
    // stepped diagrams, which are real vertical stacks).
    72: () => Reveal.left({skipFragments: true}),
    76: () => Reveal.right({skipFragments: true}),
  }
});
