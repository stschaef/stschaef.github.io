// helia site search: the search palette on every page and the query engine
// over the static index under search/ (written by helia-build).
//
// No framework, no build step, no server: index files are scripts calling
// heliaSearchData(key, data), so the palette works from file:// too. Text
// folding, tokenization, query parsing and ranking follow
// crates/helia-search/README.md and match crates/helia-search (tested against it).
//
// Open with the header button, "/" or Ctrl/Cmd-K. Queries: words (the last
// one also matches as a prefix while typing) and filters tag:V, kind:V,
// author:V, source:V (same as tag:V). Arrow keys move, Enter opens, Esc closes.
//
// Titles are matched by fzf itself (helia/fzf.js, the fzf-for-js port, loaded
// when the palette opens), over one line per page as the Emacs client lists
// them, "Title  id  kind  :tag1:tag2", then the authors' names and the venue,
// with fzf's extended syntax ('exact, ^prefix, suffix$, !not, a | b). Those
// come first; full-text matches of the index follow. A query with filters
// uses the index alone.
(function (root) {
  "use strict";

  // ------------------------------------------------------------------ text

  var STOP = {};
  ("an and are as at be but by for from has have in is it its of on or that " +
    "the this to was were will with").split(" ").forEach(function (w) {
    STOP[w] = true;
  });
  var MIN_WORD = 2;
  var MAX_WORD = 40;
  var WORD = /^[\p{Alphabetic}\p{N}]$/u;
  var MARKS = /\p{M}/gu;

  function foldChar(c) {
    if (c.charCodeAt(0) < 128) return c.toLowerCase();
    return c.toLowerCase().normalize("NFKD").replace(MARKS, "").toLowerCase();
  }

  function fold(s) {
    var out = "";
    for (var c of s) out += foldChar(c);
    return out;
  }

  // Tokens with code point offsets [start, end) into the original text.
  function tokens(text) {
    var out = [];
    var cur = "";
    var start = 0;
    var end = 0;
    var i = 0;
    for (var c of text) {
      var f = foldChar(c);
      for (var g of f) {
        if (WORD.test(g)) {
          if (!cur) start = i;
          cur += g;
          end = i + 1;
        } else if (cur) {
          out.push({ word: cur, start: start, end: end });
          cur = "";
        }
      }
      i++;
    }
    if (cur) out.push({ word: cur, start: start, end: end });
    return out;
  }

  function cpLen(s) {
    var n = 0;
    for (var _ of s) n++; // eslint-disable-line no-unused-vars
    return n;
  }

  function isIndexed(w) {
    var n = cpLen(w);
    return n >= MIN_WORD && n <= MAX_WORD && !STOP[w];
  }

  function words(text) {
    return tokens(text)
      .map(function (t) {
        return t.word;
      })
      .filter(isIndexed);
  }

  function ends(w, s) {
    return w.length >= s.length && w.slice(w.length - s.length) === s;
  }

  function stem(w) {
    var n = cpLen(w);
    if (n > 4 && ends(w, "ies")) return w.slice(0, -3) + "y";
    if (n > 3 && ends(w, "s") && !ends(w, "ss") && !ends(w, "us") && !ends(w, "is")) return w.slice(0, -1);
    return w;
  }

  function safeName(s) {
    var bytes = new TextEncoder().encode(s);
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      var ch = String.fromCharCode(b);
      if (/[A-Za-z0-9_.-]/.test(ch)) out += ch;
      else out += "~" + (b < 16 ? "0" : "") + b.toString(16).toUpperCase();
    }
    return out;
  }

  function shardKey(term, prefix) {
    if (!prefix) return "all";
    var i = term.indexOf(":");
    if (i >= 0) return term.slice(0, i);
    return Array.from(term).slice(0, prefix).join("");
  }

  // --------------------------------------------------------------- queries

  function lastCharIsWord(chunk) {
    var cs = Array.from(chunk);
    var f = Array.from(foldChar(cs[cs.length - 1] || ""));
    return f.length > 0 && WORD.test(f[f.length - 1]);
  }

  function parseQuery(q) {
    var out = { words: [], prefix: false, filters: [] };
    var lastIsWord = false;
    var chunks = q.split(/\s+/).filter(Boolean);
    for (var k = 0; k < chunks.length; k++) {
      var chunk = chunks[k];
      var m = /^(tag|kind|author|source):/i.exec(chunk);
      if (m) {
        // `source:NAME` is `tag:NAME` (wrapped external pages).
        var field = m[1].toLowerCase() === "source" ? "tag" : m[1].toLowerCase();
        var value = chunk.slice(m[0].length);
        if (field === "author") {
          words(value).forEach(function (w) {
            out.filters.push([field, w]);
          });
        } else {
          var v = fold(value).trim();
          if (v) out.filters.push([field, v]);
        }
        lastIsWord = false;
      } else {
        var ws = words(chunk);
        lastIsWord = ws.length > 0 && lastCharIsWord(chunk);
        out.words = out.words.concat(ws);
      }
    }
    out.prefix = lastIsWord && !/\s$/.test(q);
    return out;
  }

  function fieldScore(w) {
    var s = 0;
    if (w & 128) s += 100;
    if (w & 64) s += 30;
    if (w & 32) s += 20;
    var tf = w & 31;
    if (tf > 0) s += 5 + Math.min(tf, 4);
    return s;
  }

  // How many edits a query word tolerates (README "Ranking", fuzzy): none under four characters, one from
  // four, two from eight.
  function fuzz(w) {
    var n = cpLen(w);
    return n < 4 ? 0 : n < 8 ? 1 : 2;
  }
  // Optimal string alignment distance in characters (insertions, deletions, substitutions, swaps of adjacent
  // characters), or -1 when it exceeds k.
  function within(a, b, k) {
    a = Array.from(a); b = Array.from(b);
    if (Math.abs(a.length - b.length) > k) return -1;
    var n = a.length, m = b.length, d = [], i, j;
    for (i = 0; i <= n; i++) { d.push(new Array(m + 1).fill(0)); d[i][0] = i; }
    for (j = 0; j <= m; j++) d[0][j] = j;
    for (i = 1; i <= n; i++) {
      var best = Infinity;
      for (j = 1; j <= m; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v;
        if (v < best) best = v;
      }
      if (best > k) return -1;
    }
    return d[n][m] <= k ? d[n][m] : -1;
  }

  function tokenMatches(tok, q) {
    var st = stem(tok);
    var last = q.words.length - 1;
    return q.words.some(function (w, i) {
      var ex = stem(w);
      return st === ex || (q.prefix && i === last && tok.slice(0, w.length) === w) || (fuzz(ex) > 0 && within(st, ex, fuzz(ex)) >= 0);
    });
  }


  // A snippet around the first match: { text, hl: [[a, b], ...] } with
  // code point offsets into text.
  function snippet(body, q, max) {
    var chars = Array.from(body || "");
    var n = chars.length;
    var toks = tokens(body || "").filter(function (t) {
      return tokenMatches(t.word, q);
    });
    var start = 0;
    var i;
    if (toks.length) {
      var first = toks[0].start;
      start = Math.max(0, first - Math.floor(max / 3));
      if (start > 0) {
        for (i = start; i < first; i++) {
          if (chars[i] === " ") {
            start = i + 1;
            break;
          }
        }
      }
    }
    var end = Math.min(start + max, n);
    if (end < n) {
      for (i = end; i >= start + 1; i--) {
        if (chars[i] === " ") {
          if (!toks.length || i >= toks[0].end) end = i;
          break;
        }
      }
    }
    var off = start > 0 ? 1 : 0;
    var text = (start > 0 ? "…" : "") + chars.slice(start, end).join("") + (end < n ? "…" : "");
    var hl = toks
      .filter(function (t) {
        return t.start >= start && t.end <= end;
      })
      .map(function (t) {
        return [t.start - start + off, t.end - start + off];
      });
    return { text: text, hl: hl };
  }

  function fragmentEscape(s) {
    var bytes = new TextEncoder().encode(s);
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      var ch = String.fromCharCode(bytes[i]);
      if (/[A-Za-z0-9]/.test(ch)) out += ch;
      else out += "%" + (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16).toUpperCase();
    }
    return out;
  }

  // ---------------------------------------------------------------- engine

  // `load(key, hash)` resolves to the data of index file `key` ("index",
  // "t/<shard>", "d/<id>").
  // An entry as the Emacs client's completion lists it (helia-notes--candidate),
  // then its authors' names and its venue, so "krisn yallo" finds a paper.
  function entryLine(e) {
    return entrySegments(e).map(function (g) { return g.sep + g.text; }).join("");
  }

  // The parts of an entry line: {part: title|id|kind|tag|who, text, sep, start}
  // with `start` in characters (code points, as fzf counts them).
  function entrySegments(e) {
    var out = [];
    var at = 0;
    function add(part, text, sep) {
      at += Array.from(sep).length;
      out.push({ part: part, text: text, sep: sep, start: at });
      at += Array.from(text).length;
    }
    add("title", e[1] || e[0], "");
    add("id", e[0], "  ");
    add("kind", e[2] || "", "  ");
    (e[3] || []).forEach(function (t, i) { add("tag", t, i ? ":" : "  :"); });
    (e[6] || []).concat(e[7] || []).forEach(function (w, i) { add("who", w, i ? ", " : "  "); });
    return out;
  }

  // The words of an fzf query that must match (`a | b` is one, `!x` none).
  function fzfTerms(query) {
    var n = 0, or = false;
    query.trim().split(/\s+/).forEach(function (t) {
      if (!t) return;
      if (t === "|") { or = true; return; }
      if (t.charAt(0) !== "!" && !or) n++;
      or = false;
    });
    return n;
  }

  // Why an fzf hit matched, from its positions in entryLine(e):
  // - runs: maximal runs of consecutive positions within one part; a hit is
  //   `coherent` unless its runs outnumber the query's words by half again
  //   (letters scattered over unrelated words), and `quality` is words/runs;
  // - title: ranges to highlight in the title (single letters only for
  //   queries of short words), and `titleShare` the share of positions there;
  // - why: matched parts the result does not show (author and venue names,
  //   the ID) with their ranges; tags: matched tag names.
  function explainMatch(e, positions, query) {
    var segs = entrySegments(e);
    var ps = Array.from(positions || []).sort(function (a, b) { return a - b; });
    var terms = Math.max(1, fzfTerms(query));
    var short = query.trim().split(/\s+/).some(function (t) { return t.replace(/^[!'^]|\$$/g, "").length < 3; });
    var runs = [];
    var si = 0;
    ps.forEach(function (p) {
      while (si + 1 < segs.length && segs[si + 1].start <= p) si++;
      var g = segs[si], last = runs[runs.length - 1];
      if (p >= g.start + Array.from(g.text).length) return; // a separator
      if (last && last.seg === si && last.end === p) last.end = p + 1;
      else runs.push({ seg: si, start: p, end: p + 1 });
    });
    var inTitle = 0, why = [], tags = {};
    runs.forEach(function (r) {
      var g = segs[r.seg];
      if (g.part === "title") inTitle += r.end - r.start;
      if (g.part === "tag") tags[g.text] = true;
    });
    var shown = function (r) { return short || r.end - r.start >= 2; };
    var title = runs.filter(function (r) { return r.seg === 0 && shown(r); }).map(function (r) { return [r.start, r.end]; });
    var named = {};
    segs.forEach(function (g, i) {
      if (g.part !== "who" && g.part !== "id") return;
      var rs = runs.filter(function (r) { return r.seg === i && shown(r); })
        .map(function (r) { return [r.start - g.start, r.end - g.start]; });
      if (!rs.length) return;
      if (g.part === "id") {
        // an ID like yallop-2018-partially says less than the author it came
        // from: show the name containing the matched text instead, if any
        var chars = Array.from(g.text);
        rs = rs.filter(function (r) {
          var bit = fold(chars.slice(r[0], r[1]).join(""));
          return !segs.some(function (h) {
            if (h.part !== "who") return false;
            var at = Array.from(fold(h.text)).join("").indexOf(bit);
            if (at < 0) return false;
            var k = Array.from(fold(h.text).slice(0, at)).length;
            (named[h.text] = named[h.text] || []).push([k, k + Array.from(bit).length]);
            return true;
          });
        });
        if (!rs.length) return;
      }
      why.push({ part: g.part, text: g.text, ranges: rs });
    });
    // names found through the ID, merged with names matched directly
    Object.keys(named).forEach(function (n) {
      var w = why.filter(function (x) { return x.part === "who" && x.text === n; })[0];
      if (!w) why.push((w = { part: "who", text: n, ranges: [] }));
      w.ranges = w.ranges.concat(named[n]).sort(function (a, b) { return a[0] - b[0]; })
        .filter(function (r, i, a) { return !i || r[0] >= a[i - 1][1]; });
    });
    var order = function (w) {
      return w.part === "id" ? segs.length : segs.findIndex(function (g) { return g.part === "who" && g.text === w.text; });
    };
    why.sort(function (a, b) { return order(a) - order(b); });
    return {
      runs: runs.length,
      coherent: runs.length <= terms + Math.ceil(terms / 2),
      quality: Math.min(1, terms / Math.max(1, runs.length)),
      titleShare: ps.length ? inTitle / ps.length : 0,
      title: title,
      why: why,
      tags: tags,
    };
  }

  // loadFzf(): a promise of the fzf module ({Fzf, extendedMatch}), or null
  // when there is none (the palette then uses the index alone).
  function Engine(load, loadFzf) {
    this.load = load;
    this.loadFzf = loadFzf || null;
    this._fzf = null;
    this.manifest = null;
    this.shards = {};
    this.docs = {};
    this.loaded = [];
    this._init = null;
  }

  Engine.prototype._get = function (key, hash) {
    this.loaded.push(key);
    return this.load(key, hash);
  };

  Engine.prototype.init = function () {
    var self = this;
    if (!this._init) {
      this._init = this._get("index", null).then(function (m) {
        self.manifest = m;
        return m;
      });
    }
    return this._init;
  };

  // The fzf finder over the entry lines (null without fzf or entries.js).
  Engine.prototype.finder = function () {
    var self = this;
    if (!this._fzf) {
      this._fzf = this.init().then(function (m) {
        if (!self.loadFzf || !m.entries) return null;
        return Promise.all([self.loadFzf(), self._get("entries", m.entries)]).then(function (r) {
          var mod = r[0], rows = r[1];
          if (!mod || !rows) return null;
          // more candidates than shown, so weights can reorder them and noise be dropped
          return new mod.Fzf(rows, { selector: entryLine, match: mod.extendedMatch, limit: 400 });
        });
      }).catch(function () { return null; });
    }
    return this._fzf;
  };

  Engine.prototype.shard = function (key) {
    var m = this.manifest;
    if (!Object.prototype.hasOwnProperty.call(m.shards, key)) return Promise.resolve(null);
    if (!this.shards[key]) this.shards[key] = this._get("t/" + key, m.shards[key]);
    return this.shards[key];
  };

  Engine.prototype.doc = function (n) {
    var m = this.manifest;
    var id = m.ids[n];
    if (!this.docs[id]) this.docs[id] = this._get("d/" + id, m.hashes[n]);
    return this.docs[id];
  };

  function eachPosting(arr, fn) {
    var d = 0;
    for (var i = 0; i + 1 < arr.length; i += 2) {
      d += arr[i];
      fn(d, arr[i + 1]);
    }
  }

  // Ranked [{n, score}] (README "Ranking").
  Engine.prototype.run = function (query, limit) {
    var self = this;
    return this.init().then(function (m) {
      var q = typeof query === "string" ? parseQuery(query) : query;
      if (!q.words.length && !q.filters.length) return [];
      var p = m.prefix;
      var last = q.words.length - 1;
      var keys = {};
      q.words.forEach(function (w, i) {
        keys[shardKey(stem(w), p)] = true;
        if (q.prefix && i === last) keys[shardKey(w, p)] = true;
      });
      q.filters.forEach(function (f) {
        keys[shardKey(f[0] + ":" + f[1], p)] = true;
      });
      var names = Object.keys(keys);
      return Promise.all(
        names.map(function (k) {
          return self.shard(k);
        })
      ).then(function (loaded) {
        var byKey = {};
        names.forEach(function (k, i) {
          byKey[k] = loaded[i] || {};
        });
        var acc = null;
        q.words.forEach(function (w, i) {
          var exact = stem(w);
          var per = new Map();
          var consider = function (t, arr) {
            var bonus = t === exact ? 2 : 0;
            eachPosting(arr, function (d, wt) {
              var s = fieldScore(wt);
              if (!s) return;
              var cur = per.get(d) || 0;
              if (s + bonus > cur) per.set(d, s + bonus);
            });
          };
          var sh = byKey[shardKey(exact, p)];
          if (Object.prototype.hasOwnProperty.call(sh, exact)) consider(exact, sh[exact]);
          if (q.prefix && i === last) {
            var sp = byKey[shardKey(w, p)];
            for (var t in sp) {
              if (t.slice(0, w.length) !== w || t.indexOf(":") >= 0 || t === exact) continue;
              consider(t, sp[t]);
            }
          }
          // fuzzy: word terms of the same shard within the word's fuzz, at half their field score
          var k = fuzz(exact);
          if (k > 0) {
            for (var ft in sh) {
              if (ft.indexOf(":") >= 0 || ft === exact || within(ft, exact, k) < 0) continue;
              eachPosting(sh[ft], function (d, wt) {
                var s = Math.floor(fieldScore(wt) / 2);
                if (!s) return;
                if (s > (per.get(d) || 0)) per.set(d, s);
              });
            }
          }
          if (acc === null) acc = per;
          else {
            var next = new Map();
            acc.forEach(function (s, d) {
              if (per.has(d)) next.set(d, s + per.get(d));
            });
            acc = next;
          }
        });
        q.filters.forEach(function (f) {
          var pre = f[0] + ":" + f[1];
          var sh = byKey[shardKey(pre, p)];
          var set = new Set();
          for (var t in sh) {
            if (t.slice(0, pre.length) === pre) {
              eachPosting(sh[t], function (d) {
                set.add(d);
              });
            }
          }
          if (acc === null) {
            acc = new Map();
            set.forEach(function (d) {
              acc.set(d, 0);
            });
          } else {
            var next = new Map();
            acc.forEach(function (s, d) {
              if (set.has(d)) next.set(d, s);
            });
            acc = next;
          }
        });
        // kind weights ([search] kind-weights), in percent
        var out = [];
        acc.forEach(function (s, d) {
          out.push({ n: d, score: m.weights ? Math.floor((s * m.weights[d]) / 100) : s });
        });
        out.sort(function (a, b) {
          return b.score - a.score || m.dates[b.n] - m.dates[a.n] || a.n - b.n;
        });
        return out.slice(0, limit);
      });
    });
  };

  // Ranked hits: fzf's title matches (see the top of this file), then the
  // index's full-text matches not already listed.
  Engine.prototype.search = function (query, limit) {
    var self = this;
    var q = parseQuery(query);
    if (q.filters.length || !query.trim() || !this.loadFzf) return this.textSearch(query, limit);
    return Promise.all([this.finder(), this.textSearch(query, limit), this.init()]).then(function (r) {
      var finder = r[0], text = r[1], kw = r[2].kindWeights || {};
      if (!finder) return text;
      // fzf's operators mean nothing to the index: its matches would ignore them
      if (/(^|\s)[!'^]|\$(\s|$)|(^|\s)\|(\s|$)/.test(query)) text = [];
      var byId = {};
      text.forEach(function (h) { byId[h.id] = h; });
      // fzf's score, times the kind's weight, the match's coherence squared
      // (letters scattered over unrelated words are dropped) and up to 1.5 for the title
      var weighted = [];
      finder.find(query).forEach(function (m, i) {
        var x = explainMatch(m.item, m.positions, query);
        if (!x.coherent) return;
        var w = Object.prototype.hasOwnProperty.call(kw, m.item[2]) ? kw[m.item[2]] : 100;
        weighted.push({ m: m, i: i, x: x, score: (m.score * w * x.quality * x.quality * (1 + x.titleShare / 2)) / 100 });
      });
      weighted.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
      var hits = weighted.slice(0, limit).map(function (y) {
        var m = y.m, x = y.x;
        var e = m.item, t = byId[e[0]];
        // a match the title does not show: say where it is instead of a snippet
        var why = x.title.length ? [] : x.why;
        return {
          id: e[0], title: e[1], kind: e[2], tags: e[3], url: e[4], date: e[5],
          href: t ? t.href : e[4], score: y.score, heading: t ? t.heading : null,
          snippet: t && !why.length ? t.snippet : "", highlights: t && !why.length ? t.highlights : [],
          titleHighlights: x.title, why: why, tagHits: x.tags,
        };
      });
      var seen = {};
      hits.forEach(function (h) { seen[h.id] = true; });
      text.forEach(function (h) {
        if (hits.length < limit && !seen[h.id]) hits.push(h);
      });
      return hits;
    });
  };

  // The index alone: ranked hits with their documents, snippet and matching heading.
  Engine.prototype.textSearch = function (query, limit) {
    var self = this;
    var q = parseQuery(query);
    return this.run(q, limit).then(function (ranked) {
      return Promise.all(
        ranked.map(function (r) {
          return self.doc(r.n);
        })
      ).then(function (docs) {
        return ranked.map(function (r, i) {
          return hitOf(docs[i], r.score, q, self.manifest.snippet || 160);
        });
      });
    });
  };

  function hitOf(d, score, q, max) {
    var heading = null;
    if (q.words.length) {
      for (var i = 0; i < d.headings.length; i++) {
        var h = d.headings[i];
        var match = tokens(h[0]).some(function (t) {
          return tokenMatches(t.word, q);
        });
        if (match) {
          heading = { text: h[0], anchor: h[1] };
          break;
        }
      }
    }
    var href = d.url;
    if (heading && heading.anchor) href += "#" + heading.anchor;
    else if (heading) href += "#:~:text=" + fragmentEscape(heading.text);
    var sn = snippet(d.body, q.words.length ? q : { words: [], prefix: false, filters: [] }, max);
    return {
      id: d.id,
      title: d.title,
      kind: d.kind,
      tags: d.tags,
      date: d.date,
      url: d.url,
      href: href,
      score: score,
      heading: heading,
      snippet: sn.text,
      highlights: sn.hl,
      titleHighlights: highlightsOf(d.title, q),
    };
  }

  function highlightsOf(text, q) {
    return tokens(text || "")
      .filter(function (t) {
        return tokenMatches(t.word, q);
      })
      .map(function (t) {
        return [t.start, t.end];
      });
  }

  // ---------------------------------------------------------------- loader

  var pending = {};
  function receive(key, data) {
    var p = pending[key];
    if (p) {
      delete pending[key];
      p.resolve(data);
    }
  }

  function fileOf(key) {
    var i = key.indexOf("/");
    return i < 0 ? key : key.slice(0, i + 1) + safeName(key.slice(i + 1));
  }

  // Loads index files as <script> elements (works over http and file://).
  function scriptLoader(doc, base) {
    return function (key, hash) {
      return new Promise(function (resolve, reject) {
        pending[key] = { resolve: resolve, reject: reject };
        var s = doc.createElement("script");
        s.src = base + "search/" + fileOf(key) + ".js" + (hash ? "?" + hash : "");
        s.async = true;
        s.onerror = function () {
          delete pending[key];
          reject(new Error("cannot load " + s.src));
        };
        doc.head.appendChild(s);
      });
    };
  }

  // Loads helia/fzf.js once (it defines the global `fzf`).
  function fzfLoader(doc, base) {
    var p = null;
    return function () {
      if (root.fzf) return Promise.resolve(root.fzf);
      if (!p) {
        p = new Promise(function (resolve) {
          var s = doc.createElement("script");
          s.src = base + "helia/fzf.js";
          s.async = true;
          s.onload = function () { resolve(root.fzf || null); };
          s.onerror = function () { resolve(null); };
          doc.head.appendChild(s);
        });
      }
      return p;
    };
  }

  // -------------------------------------------------------------------- UI

  var LIMIT = 15;

  function install(doc, win, opts) {
    opts = opts || {};
    var base = opts.base || "";
    var engine = new Engine(opts.load || scriptLoader(doc, base), opts.loadFzf || (opts.load ? null : fzfLoader(doc, base)));
    var navigate =
      opts.navigate ||
      function (href) {
        win.location.assign(href);
      };
    var ui = null;
    var state = { open: false, active: -1, hits: [], seq: 0, returnFocus: null };

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }

    function resolve(url) {
      return /^([a-z][a-z0-9+.-]*:|\/)/i.test(url) ? url : base + url;
    }

    function marked(parent, text, hl) {
      var chars = Array.from(text || "");
      var pos = 0;
      hl.forEach(function (r) {
        if (r[0] < pos) return;
        if (r[0] > pos) parent.appendChild(doc.createTextNode(chars.slice(pos, r[0]).join("")));
        parent.appendChild(el("mark", "helia-search-mark", chars.slice(r[0], r[1]).join("")));
        pos = r[1];
      });
      if (pos < chars.length) parent.appendChild(doc.createTextNode(chars.slice(pos).join("")));
    }

    function build() {
      var backdrop = el("div", "helia-search-backdrop");
      backdrop.hidden = true;
      var dialog = el("div", "helia-search-dialog");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", "Search");
      var bar = el("div", "helia-search-bar");
      var input = el("input", "helia-search-input");
      input.type = "search";
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-controls", "helia-search-results");
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("spellcheck", "false");
      input.setAttribute("aria-label", "Search this site");
      input.setAttribute("placeholder", "Search…  (tag: kind: author:)");
      var close = el("button", "helia-search-close", "Esc");
      close.type = "button";
      close.setAttribute("aria-label", "Close search");
      bar.appendChild(input);
      bar.appendChild(close);
      var status = el("div", "helia-search-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      var list = el("ul", "helia-search-results");
      list.id = "helia-search-results";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "Results");
      var help = el("div", "helia-search-help");
      [
        ["↑↓", "move"],
        ["Enter", "open"],
        ["Esc", "close"],
        ["tag: kind: author:", "filter"],
      ].forEach(function (p) {
        var s = el("span", "helia-search-hint");
        s.appendChild(el("kbd", null, p[0]));
        s.appendChild(doc.createTextNode(" " + p[1]));
        help.appendChild(s);
      });
      dialog.appendChild(bar);
      dialog.appendChild(status);
      dialog.appendChild(list);
      dialog.appendChild(help);
      backdrop.appendChild(dialog);
      doc.body.appendChild(backdrop);

      input.addEventListener("input", function () {
        update(input.value);
      });
      input.addEventListener("keydown", onInputKey);
      dialog.addEventListener("keydown", trapFocus);
      close.addEventListener("click", closePalette);
      backdrop.addEventListener("click", function (ev) {
        if (ev.target === backdrop) closePalette();
      });
      list.addEventListener("click", function (ev) {
        var a = ev.target && ev.target.closest ? ev.target.closest("a") : null;
        if (a) closePalette(true);
      });
      return { backdrop: backdrop, dialog: dialog, input: input, close: close, status: status, list: list };
    }

    function focusables() {
      return [ui.input, ui.close];
    }

    function trapFocus(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closePalette();
        return;
      }
      if (ev.key !== "Tab") return;
      var f = focusables();
      var i = f.indexOf(doc.activeElement);
      var next = ev.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i < 0 || i >= f.length - 1 ? 0 : i + 1;
      ev.preventDefault();
      f[next].focus();
    }

    function setActive(i) {
      var items = ui.list.querySelectorAll(".helia-search-result");
      if (!items.length) {
        state.active = -1;
        ui.input.removeAttribute("aria-activedescendant");
        return;
      }
      state.active = (i + items.length) % items.length;
      Array.prototype.forEach.call(items, function (li, k) {
        li.setAttribute("aria-selected", k === state.active ? "true" : "false");
        li.classList.toggle("helia-active", k === state.active);
      });
      ui.input.setAttribute("aria-activedescendant", items[state.active].id);
      if (items[state.active].scrollIntoView) items[state.active].scrollIntoView({ block: "nearest" });
    }

    function onInputKey(ev) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setActive(state.active + 1);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setActive(state.active - 1);
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        var hit = state.hits[state.active < 0 ? 0 : state.active];
        if (hit) {
          closePalette(true);
          navigate(resolve(hit.href));
        }
      }
    }

    function render(hits, query) {
      state.hits = hits;
      ui.list.replaceChildren();
      hits.forEach(function (h, i) {
        var li = el("li", "helia-search-result");
        li.id = "helia-search-r" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        var a = el("a", "helia-search-link");
        a.href = resolve(h.href);
        a.setAttribute("tabindex", "-1");
        var head = el("span", "helia-search-head");
        var title = el("span", "helia-search-title");
        marked(title, h.title || h.id, h.title ? h.titleHighlights : []);
        head.appendChild(title);
        if (h.kind && h.kind !== "note") head.appendChild(el("span", "helia-search-chip helia-search-kind", h.kind));
        (h.tags || []).slice(0, 4).forEach(function (t) {
          var hit = h.tagHits && h.tagHits[t] ? " helia-search-tag-hit" : "";
          head.appendChild(el("span", "helia-search-chip helia-search-tag" + hit, "#" + t));
        });
        if (h.date) head.appendChild(el("span", "helia-search-date", String(h.date).slice(0, 10)));
        a.appendChild(head);
        if (h.heading) a.appendChild(el("span", "helia-search-section", "› " + h.heading.text));
        // where a match the title does not show is (authors, venue, ID)
        if (h.why && h.why.length) {
          var why = el("span", "helia-search-why");
          h.why.forEach(function (w, k) {
            if (k) why.appendChild(doc.createTextNode(" · "));
            var part = el("span", w.part === "id" ? "helia-search-why-id" : "helia-search-why-name");
            marked(part, w.text, w.ranges);
            why.appendChild(part);
          });
          a.appendChild(why);
        }
        if (h.snippet) {
          var sn = el("span", "helia-search-snippet");
          marked(sn, h.snippet, h.highlights);
          a.appendChild(sn);
        }
        a.addEventListener("mouseenter", function () {
          setActive(i);
        });
        li.appendChild(a);
        ui.list.appendChild(li);
      });
      ui.input.setAttribute("aria-expanded", hits.length ? "true" : "false");
      var q = parseQuery(query);
      if (!q.words.length && !q.filters.length) ui.status.textContent = "";
      else if (!hits.length) ui.status.textContent = "No results";
      else ui.status.textContent = hits.length + (hits.length === LIMIT ? "+" : "") + " result" + (hits.length === 1 ? "" : "s");
      setActive(0);
    }

    function update(query) {
      var seq = ++state.seq;
      if (!engine.manifest) ui.status.textContent = "Loading index…";
      return engine.search(query, LIMIT).then(
        function (hits) {
          if (seq === state.seq) render(hits, query);
        },
        function (err) {
          if (seq === state.seq) {
            ui.list.replaceChildren();
            state.hits = [];
            ui.status.textContent = "Search is unavailable: " + (err && err.message ? err.message : err);
          }
        }
      );
    }

    function openPalette() {
      if (!ui) ui = build();
      if (state.open) {
        ui.input.focus();
        return;
      }
      state.open = true;
      state.returnFocus = doc.activeElement;
      ui.backdrop.hidden = false;
      doc.documentElement.classList.add("helia-search-open");
      ui.input.focus();
      if (ui.input.select) ui.input.select();
      engine.init().catch(function () {});
      engine.finder();
      if (ui.input.value) update(ui.input.value);
    }

    function closePalette(navigating) {
      if (!ui || !state.open) return;
      state.open = false;
      ui.backdrop.hidden = true;
      doc.documentElement.classList.remove("helia-search-open");
      var r = state.returnFocus;
      if (!navigating && r && r.focus) r.focus();
    }

    function typing(t) {
      if (!t || !t.tagName) return false;
      var tag = t.tagName.toUpperCase();
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable === true;
    }

    doc.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === "k" || ev.key === "K")) {
        ev.preventDefault();
        if (state.open) closePalette();
        else openPalette();
      } else if (ev.key === "/" && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !state.open && !typing(ev.target)) {
        ev.preventDefault();
        openPalette();
      } else if (ev.key === "Escape" && state.open) {
        ev.preventDefault();
        closePalette();
      }
    });

    // The search button (reused if the layout has one): in the top bar, else
    // the page header, else floating.
    var btn = doc.querySelector(".helia-search-button");
    if (!btn) {
      btn = el("button", "helia-search-button");
      btn.type = "button";
      btn.appendChild(el("span", "helia-search-icon", "⌕"));
      btn.appendChild(el("span", "helia-search-label", "Search"));
      btn.appendChild(el("kbd", "helia-search-key", "/"));
      var bar = doc.querySelector(".helia-topbar");
      var host = doc.querySelector(".helia-header");
      if (bar) {
        // The site's top bar, when there is one: at its end.
        bar.appendChild(btn);
      } else if (host) {
        var toggle = host.querySelector(".helia-theme-toggle");
        host.insertBefore(btn, toggle ? toggle.nextSibling : host.firstChild);
      } else {
        btn.className += " helia-floating";
        doc.body.appendChild(btn);
      }
    }
    btn.setAttribute("aria-label", "Search (/ or Ctrl+K)");
    btn.setAttribute("aria-haspopup", "dialog");
    btn.addEventListener("click", openPalette);
    btn.addEventListener("mouseenter", function () {
      engine.init().catch(function () {});
    });

    return {
      engine: engine,
      open: openPalette,
      close: closePalette,
      update: update,
      get ui() {
        return ui;
      },
      state: state,
      button: btn,
    };
  }

  var api = {
    fold: fold,
    tokens: tokens,
    words: words,
    stem: stem,
    safeName: safeName,
    shardKey: shardKey,
    parseQuery: parseQuery,
    fieldScore: fieldScore,
    snippet: snippet,
    fileOf: fileOf,
    Engine: Engine,
    entryLine: entryLine,
    explainMatch: explainMatch,
    install: install,
    scriptLoader: scriptLoader,
    receive: receive,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.HeliaSearch = api;
  root.heliaSearchData = receive;
  // The site root is where this script lives, minus helia/search.js.
  var cur = typeof document !== "undefined" ? document.currentScript : null;
  var src = cur && cur.src ? cur.src : "";
  var base = src ? src.replace(/helia\/search\.js(\?.*)?$/, "") : "";
  function start() {
    install(document, root, { base: base });
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(typeof window !== "undefined" ? window : globalThis);
