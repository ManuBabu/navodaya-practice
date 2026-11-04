/* Target Navodaya: Mental Ability question maker.
   Draws JNVST-style figure questions and knows each answer because it builds them:
   the right option is a known flip or turn of the figure, and wrong options are other flips and turns. */
(function (global) {
  "use strict";

  // ---------- random numbers (seeded, so a question can be rebuilt from its id) ----------
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function shuffled(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- figures: lists of shapes on a 100 x 100 canvas ----------
  // shape kinds: line (open path), dot (filled circle), tri (filled triangle), ring (open circle), sq (filled square)
  const C = 50;
  function tPoint(p, t) {
    let [x, y] = [p[0] - C, p[1] - C];
    if (t.flipH) x = -x;                         // mirror left-right
    if (t.flipV) y = -y;                         // mirror top-bottom
    const a = (t.rot || 0) * Math.PI / 180;      // then turn clockwise
    const xr = x * Math.cos(a) - y * Math.sin(a), yr = x * Math.sin(a) + y * Math.cos(a);
    return [xr + C, yr + C];
  }
  const transform = (fig, t) => fig.map(s => ({ ...s, pts: s.pts.map(p => tPoint(p, t)) }));
  const key = fig => fig.map(s => s.kind + ":" + s.pts.map(p => p.map(v => Math.round(v)).join(",")).sort().join(";")).sort().join("|");

  const D8 = [ {}, {rot:90}, {rot:180}, {rot:270}, {flipH:true}, {flipV:true}, {flipH:true,rot:90}, {flipH:true,rot:270} ];

  function makeFigure(r, parts, grid) {
    // grid points kept within 30 units of the centre so any turn stays inside the box
    grid = grid || [26, 38, 50, 62, 74];
    for (let tries = 0; tries < 200; tries++) {
      const g = () => [pick(r, grid), pick(r, grid)];
      const fig = [];
      const n = 3 + Math.floor(r() * 2);
      const line = [g()];
      while (line.length < n) {
        const last = line[line.length - 1], p = g();
        if (p[0] !== last[0] || p[1] !== last[1]) line.push(p);
      }
      fig.push({ kind: "line", pts: line });
      const extras = ["dot", "tri", "ring", "sq"];
      const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
        return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
      const placed = [];
      let ok = true;
      for (let i = 1; i < parts && ok; i++) {
        const k = extras[(i - 1 + Math.floor(r() * 4)) % 4];
        let p = null;
        // keep small shapes clear of the line and of each other, so nothing overlaps
        for (let j = 0; j < 40 && !p; j++) {
          const c = g();
          const clearLine = line.slice(1).every((q, n) => segDist(c, line[n], q) >= 11);
          const clearOthers = placed.every(o => Math.hypot(o[0] - c[0], o[1] - c[1]) >= 18);
          if (clearLine && clearOthers) p = c;
        }
        if (!p) { ok = false; break; }
        placed.push(p);
        fig.push({ kind: k, pts: k === "tri" ? [[p[0] - 4.5, p[1] + 4], [p[0] + 4.5, p[1] + 4], [p[0], p[1] - 4]] : [p] });
      }
      if (!ok) continue;
      // keep only figures with no symmetry, so every flip and turn looks different
      const keys = D8.map(t => key(transform(fig, t)));
      if (new Set(keys).size === 8) return fig;
    }
    return null;
  }

  // ---------- drawing ----------
  function shapeSVG(s, scale, ox, oy) {
    const P = p => [(ox + p[0] * scale).toFixed(1), (oy + p[1] * scale).toFixed(1)];
    const sw = (5 * scale).toFixed(1);
    if (s.kind === "line") return `<polyline points="${s.pts.map(p => P(p).join(",")).join(" ")}" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (s.kind === "dot") { const [x, y] = P(s.pts[0]); return `<circle cx="${x}" cy="${y}" r="${(6 * scale).toFixed(1)}" fill="#111"/>`; }
    if (s.kind === "ring") { const [x, y] = P(s.pts[0]); return `<circle cx="${x}" cy="${y}" r="${(6 * scale).toFixed(1)}" fill="#fff" stroke="#111" stroke-width="${(3 * scale).toFixed(1)}"/>`; }
    if (s.kind === "sq") { const [x, y] = P(s.pts[0]); const h = 5.5 * scale; return `<rect x="${(x - h).toFixed(1)}" y="${(y - h).toFixed(1)}" width="${(2 * h).toFixed(1)}" height="${(2 * h).toFixed(1)}" fill="#111"/>`; }
    if (s.kind === "tri") return `<polygon points="${s.pts.map(p => P(p).join(",")).join(" ")}" fill="#111"/>`;
    return "";
  }
  const box = (inner, w = 100, h = 100, extra = "") =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="fig" role="img"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="#fff" stroke="#111" stroke-width="2"/>${inner}${extra}</svg>`;
  const figSVG = fig => box(fig.map(s => shapeSVG(s, 1, 0, 0)).join(""));
  function rowSVG(figs, sep) {
    // several figures side by side, used for question strips
    const W = figs.length * 104 + (sep ? 30 : 0);
    let x = 0, out = "";
    figs.forEach((f, i) => {
      if (sep && i === sep) { out += `<text x="${x + 13}" y="60" font-size="30" font-family="sans-serif" text-anchor="middle">::</text>`; x += 30; }
      out += `<g transform="translate(${x + 2} 2)">${f === "?" ? '<rect x="0" y="0" width="100" height="100" fill="#fff" stroke="#111" stroke-width="2" stroke-dasharray="6 5"/><text x="50" y="66" font-size="44" font-family="sans-serif" text-anchor="middle">?</text>' : '<rect x="0" y="0" width="100" height="100" fill="#fff" stroke="#111" stroke-width="2"/>' + f.map(s => shapeSVG(s, 1, 0, 0)).join("")}</g>`;
      x += 104;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 104" class="strip" role="img">${out}</svg>`;
  }

  // ---------- question types ----------
  const LEVEL_PARTS = { easy: 2, medium: 3, hard: 4 };

  function q(type, seed, level, data) { return Object.assign({ id: "GEN-" + type + "-" + level + "-" + seed, gen: true, src: "Practice", lvl: level, img: "" }, data); }

  function oddOneOut(seed, level) {
    const r = rng(seed), f = makeFigure(r, LEVEL_PARTS[level]);
    const rots = shuffled(r, [0, 90, 180, 270]);
    const same = rots.slice(0, 3).map(a => transform(f, { rot: a }));
    const odd = transform(f, { flipH: true, rot: rots[3] });
    const order = shuffled(r, [0, 1, 2, 3]);
    const figs = order.map(i => i === 3 ? odd : same[i]);
    return q("odd", seed, level, {
      part: "Odd one out",
      q: "Three of these figures are the same figure turned around. Which one is different?",
      opts: figs.map(figSVG), a: order.indexOf(3),
      ex: "The other three are the same figure, only turned. The odd one is its mirror image, which you can't get just by turning."
    });
  }

  function mirror(seed, level) {
    const r = rng(seed), f = makeFigure(r, LEVEL_PARTS[level]);
    const water = r() < 0.35;
    const right = water ? { flipV: true } : { flipH: true };
    const wrong = water ? [{}, { flipH: true }, { rot: 180 }] : [{}, { flipV: true }, { rot: 180 }];
    const all = shuffled(r, [right, ...wrong]);
    const line = water
      ? '<line x1="0" y1="99" x2="100" y2="99" stroke="#c2410c" stroke-width="3" stroke-dasharray="6 4"/>'
      : '<line x1="99" y1="0" x2="99" y2="100" stroke="#c2410c" stroke-width="3" stroke-dasharray="6 4"/>';
    return q("mirror", seed, level, {   // same id type for mirror and water: both rebuild from the seed
      part: water ? "Water image" : "Mirror image",
      q: water ? "Which is the water image of the figure? (water is along the dashed line below it)"
               : "Which is the mirror image of the figure? (mirror is held along the dashed line on its right)",
      fig: box(f.map(s => shapeSVG(s, 1, 0, 0)).join(""), 100, 100, line),
      opts: all.map(t => figSVG(transform(f, t))), a: all.indexOf(right),
      ex: water ? "A water image flips the figure top to bottom; left and right stay the same."
                : "A mirror on the right flips the figure left to right; top and bottom stay the same."
    });
  }

  function series(seed, level) {
    const r = rng(seed), f = makeFigure(r, LEVEL_PARTS[level]);
    const step = level === "easy" ? pick(r, [90, -90]) : pick(r, [45, -45, 90, 135]);
    const a0 = pick(r, [0, 45, 90, 180]);
    const at = k => transform(f, { rot: a0 + k * step });
    const right = at(3), wrong = [at(2), at(4), transform(at(3), { flipH: true })];
    const all = shuffled(r, [right, ...wrong]);
    const turn = Math.abs(step) + "° " + (step > 0 ? "clockwise" : "anticlockwise");
    return q("series", seed, level, {
      part: "Series",
      q: "The figures change in a pattern. Which figure comes next?",
      fig: rowSVG([at(0), at(1), at(2), "?"]),
      opts: all.map(figSVG), a: all.indexOf(right),
      ex: "Each figure turns " + turn + " from the one before, so the next one turns " + turn + " again."
    });
  }

  function analogy(seed, level) {
    const r = rng(seed), A = makeFigure(r, LEVEL_PARTS[level]), B = makeFigure(r, LEVEL_PARTS[level]);
    const T = pick(r, [{ rot: 90, n: "turned 90° clockwise" }, { rot: 180, n: "turned upside down (180°)" }, { rot: 270, n: "turned 90° anticlockwise" }, { flipH: true, n: "flipped left to right" }, { flipV: true, n: "flipped top to bottom" }]);
    const others = [{ rot: 90 }, { rot: 180 }, { rot: 270 }, { flipH: true }, { flipV: true }, {}].filter(t => key(transform(B, t)) !== key(transform(B, T)));
    const wrong = shuffled(r, others).slice(0, 3);
    const all = shuffled(r, [T, ...wrong]);
    return q("analogy", seed, level, {
      part: "Analogy",
      q: "The first two figures are related in a certain way. Which figure is related to the third in the same way?",
      fig: rowSVG([A, transform(A, T), B, "?"], 2),
      opts: all.map(t => figSVG(transform(B, t))), a: all.indexOf(T),
      ex: "The second figure is the first one " + T.n + ". Do the same to the third figure."
    });
  }

  function completion(seed, level) {
    // a square pattern made of four mirrored quarters; the bottom-right quarter is missing
    const r = rng(seed), Q = makeFigure(r, LEVEL_PARTS[level], [30, 40, 50, 60, 70]);
    const quarter = (fig, x, y) => fig.map(s => shapeSVG(s, 0.5, x, y)).join("");  // half size, one quarter of the square
    const TL = Q, TR = transform(Q, { flipH: true }), BL = transform(Q, { flipV: true }), BR = transform(Q, { rot: 180 });
    const fig = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="fig" role="img"><rect x="1" y="1" width="98" height="98" fill="#fff" stroke="#111" stroke-width="2"/>${quarter(TL, 0, 0)}${quarter(TR, 50, 0)}${quarter(BL, 0, 50)}<rect x="50" y="50" width="49" height="49" fill="#f3efe6" stroke="#111" stroke-width="1.5" stroke-dasharray="4 3"/><text x="75" y="83" font-size="26" font-family="sans-serif" text-anchor="middle">?</text><line x1="50" y1="0" x2="50" y2="100" stroke="#bbb" stroke-width="1"/><line x1="0" y1="50" x2="100" y2="50" stroke="#bbb" stroke-width="1"/></svg>`;
    const cands = [BR, TL, TR, BL];
    const order = shuffled(r, [0, 1, 2, 3]);
    return q("complete", seed, level, {
      part: "Pattern completion",
      q: "Which part completes the pattern? (it goes in the empty bottom-right corner)",
      fig, opts: order.map(i => figSVG(cands[i])), a: order.indexOf(0),
      ex: "The pattern is mirrored left-right and top-bottom, so the missing corner is the top-left part turned upside down."
    });
  }

  function punch(seed, level) {
    // a square sheet folded in half once (twice for hard), punched, then opened
    const r = rng(seed);
    const holesN = level === "easy" ? 1 : 2;
    const vertical = r() < 0.5;                          // fold line down the middle (left half folded onto right)
    const holes = [];
    while (holes.length < holesN) {
      const h = vertical ? [pick(r, [62, 75, 88]), pick(r, [15, 30, 50, 70, 85])] : [pick(r, [15, 30, 50, 70, 85]), pick(r, [62, 75, 88])];
      if (!holes.some(x => x[0] === h[0] && x[1] === h[1])) holes.push(h);
    }
    const mirrorH = p => vertical ? [100 - p[0], p[1]] : [p[0], 100 - p[1]];
    const sheet = pts => box(pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="#fff" stroke="#111" stroke-width="2.5"/>`).join(""));
    const right = holes.concat(holes.map(mirrorH));
    const wrongs = [
      holes,                                                             // forgot the other half
      holes.concat(holes.map(p => [100 - p[0], 100 - p[1]])),            // copied to the wrong place
      holes.concat(holes.map(p => vertical ? [p[0], 100 - p[1]] : [100 - p[0], p[1]]))  // flipped the wrong way
    ];
    const keyH = pts => pts.map(p => p.join(",")).sort().join(";");
    const uniq = []; [right, ...wrongs].forEach(o => { if (!uniq.some(u => keyH(u) === keyH(o))) uniq.push(o); });
    while (uniq.length < 4) { const extra = holes.map(p => [p[0], (p[1] + 13) % 100 || 13]).concat(holes.map(mirrorH)); if (!uniq.some(u => keyH(u) === keyH(extra))) uniq.push(extra); else break; }
    const all = shuffled(r, uniq.slice(0, 4));
    const folded = vertical
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 100" class="strip" role="img"><rect x="1" y="1" width="98" height="98" fill="#fff" stroke="#111" stroke-width="2"/><line x1="50" y1="0" x2="50" y2="100" stroke="#111" stroke-width="2" stroke-dasharray="5 4"/><path d="M28 30 Q50 12 72 30" fill="none" stroke="#c2410c" stroke-width="3"/><path d="M72 30 l-9 -1 5 -7z" fill="#c2410c"/><g transform="translate(110 0)"><rect x="50" y="1" width="49" height="98" fill="#fff" stroke="#111" stroke-width="2"/>${holes.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="#fff" stroke="#111" stroke-width="2.5"/>`).join("")}</g></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 100" class="strip" role="img"><rect x="1" y="1" width="98" height="98" fill="#fff" stroke="#111" stroke-width="2"/><line x1="0" y1="50" x2="100" y2="50" stroke="#111" stroke-width="2" stroke-dasharray="5 4"/><path d="M30 28 Q12 50 30 72" fill="none" stroke="#c2410c" stroke-width="3"/><path d="M30 72 l-1 -9 -7 5z" fill="#c2410c"/><g transform="translate(110 0)"><rect x="1" y="50" width="98" height="49" fill="#fff" stroke="#111" stroke-width="2"/>${holes.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="#fff" stroke="#111" stroke-width="2.5"/>`).join("")}</g></svg>`;
    return q("punch", seed, level, {
      part: "Paper folding and punching",
      q: "A square sheet is folded along the dashed line and punched as shown. How will it look when opened?",
      fig: folded, opts: all.map(sheet), a: all.findIndex(o => keyH(o) === keyH(right)),
      ex: "Each hole goes through both layers, so when the sheet opens there is a matching hole on the other side of the fold, like a mirror image."
    });
  }

  const TYPES = { odd: oddOneOut, mirror, series, analogy, complete: completion, punch };
  function make(type, seed, level) {
    const out = TYPES[type](seed >>> 0, level || "medium");
    out.genType = type;
    out.o = out.opts; delete out.opts;          // the app reads answer choices from .o
    return out;
  }
  // a batch of n questions spread evenly over the types, at one level or a mix
  function batch(n, level, seedBase) {
    const types = Object.keys(TYPES), levels = ["easy", "medium", "hard"];
    let s = (seedBase >>> 0) || (Date.now() >>> 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = types[i % types.length];
      const lv = level && level !== "mixed" ? level : levels[i % 3];
      s = (s * 1103515245 + 12345) >>> 0;
      out.push(make(t, s, lv));
    }
    return out;
  }
  global.MAT = { make, batch, TYPES: Object.keys(TYPES) };
})(typeof window !== "undefined" ? window : globalThis);
