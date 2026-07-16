/* ============================================================
   Meridian BI — lightweight SVG chart engine (no dependencies)
   Power BI-style visuals. Colours come from CSS custom properties
   so each report's theme drives the palette automatically.
   Every data visual renders DATA LABELS directly on the visual.
   ============================================================ */
(function (g) {
  const NS = "http://www.w3.org/2000/svg";
  const cssVar = (n, el) =>
    getComputedStyle(el || document.documentElement).getPropertyValue(n).trim();
  const series = (el) =>
    ["--c1","--c2","--c3","--c4","--c5","--c6","--c7","--c8"].map(v => cssVar(v, el));

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(host, w, h) {
    host.innerHTML = "";
    const s = el("svg", { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "xMidYMid meet" });
    host.appendChild(s);
    return s;
  }
  const fmt = (n, d = 0) => Number(n).toLocaleString("en-US",
    { minimumFractionDigits: d, maximumFractionDigits: d });
  const node = (id) => document.getElementById(id);
  const dims = (host) => {
    const r = host.getBoundingClientRect();
    return { w: Math.max(220, Math.round(r.width)), h: Math.max(80, Math.round(r.height)) };
  };
  // contrast ink for a fill colour (hex like #rrggbb)
  function ink(hex) {
    if (!hex || hex[0] !== "#" || hex.length < 7) return "#ffffff";
    const r = parseInt(hex.substr(1,2),16), gg = parseInt(hex.substr(3,2),16),
          b = parseInt(hex.substr(5,2),16);
    return (0.2126*r + 0.7152*gg + 0.0722*b) > 150 ? "#23303f" : "#ffffff";
  }
  function dlabel(s, x, y, txt, opts) {
    opts = opts || {};
    const t = el("text", { x, y, "text-anchor": opts.anchor || "middle",
      "font-size": opts.size || 9, "font-weight": opts.weight || 700,
      "font-family": "var(--font)", fill: opts.fill || "var(--ink)" }, s);
    if (opts.halo) {
      t.setAttribute("stroke", opts.halo);
      t.setAttribute("stroke-width", opts.haloW || 2.8);
      t.setAttribute("paint-order", "stroke");
      t.setAttribute("stroke-linejoin", "round");
    }
    t.textContent = txt; return t;
  }

  /* ---------- LINE / MULTI-LINE ---------- */
  function line(id, opts) {
    const host = node(id); const { w, h } = dims(host); const c = series(host);
    const s = svg(host, w, h);
    const m = { t: 14, r: 16, b: 22, l: 30 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const labels = opts.labels, sets = opts.series;
    let max = opts.max ?? Math.max(...sets.flatMap(d => d.values));
    let min = opts.min ?? Math.min(0, ...sets.flatMap(d => d.values));
    const x = i => m.l + (labels.length === 1 ? iw/2 : iw * i / (labels.length - 1));
    const y = v => m.t + ih - ih * (v - min) / (max - min || 1);
    for (let t = 0; t <= 4; t++) {
      const gy = m.t + ih * t / 4;
      el("line", { x1: m.l, y1: gy, x2: w - m.r, y2: gy, class: "axis" }, s);
      el("text", { x: m.l - 5, y: gy + 3, "text-anchor": "end", class: "axis-txt" }, s)
        .textContent = fmt(max - (max - min) * t / 4, opts.dec ?? 0);
    }
    const step = Math.ceil(labels.length / (opts.xticks || 8));
    labels.forEach((lb, i) => { if (i % step === 0 || i === labels.length - 1)
      el("text", { x: x(i), y: h - 7, "text-anchor": "middle", class: "axis-txt" }, s).textContent = lb; });
    const dec = opts.dec ?? 1;
    // draw lines / areas / points
    sets.forEach((d, si) => {
      const col = d.color || c[si % c.length];
      const path = d.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
      if (d.area) {
        const area = path + ` L${x(d.values.length-1)},${y(min)} L${x(0)},${y(min)} Z`;
        el("path", { d: area, fill: col, "fill-opacity": .12 }, s);
      }
      el("path", { d: path, fill: "none", stroke: col, "stroke-width": d.width || 2.4,
        "stroke-linejoin": "round", "stroke-linecap": "round" }, s);
      d.values.forEach((v, i) => el("circle", { cx: x(i), cy: y(v), r: 2.4, fill: col }, s));
    });
    // DATA LABELS on every point (data values are spaced so labels don't collide)
    sets.forEach((d, si) => {
      const col = d.color || c[si % c.length];
      d.values.forEach((v, i) => {
        const an = i === 0 ? "start" : (i === labels.length - 1 ? "end" : "middle");
        const xo = i === 0 ? 2 : (i === labels.length - 1 ? -2 : 0);
        dlabel(s, x(i) + xo, y(v) - 6, fmt(v, dec), { fill: col, size: 8.5, anchor: an });
      });
    });
  }

  /* ---------- COMBO: vertical bars + overlaid line ---------- */
  function combo(id, opts) {
    const host = node(id); const { w, h } = dims(host); const c = series(host);
    const s = svg(host, w, h);
    const m = { t: 16, r: 34, b: 22, l: 32 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const labels = opts.labels;
    const bmax = opts.barMax ?? Math.max(...opts.bars) * 1.18;
    const lmax = opts.lineMax ?? Math.max(...opts.line) * 1.25;
    const lmin = opts.lineMin ?? 0;
    const bw = iw / labels.length * 0.55;
    const cx = i => m.l + iw * (i + 0.5) / labels.length;
    const by = v => m.t + ih - ih * v / bmax;
    const ly = v => m.t + ih - ih * (v - lmin) / (lmax - lmin || 1);
    for (let t = 0; t <= 4; t++) {
      const gy = m.t + ih * t / 4;
      el("line", { x1: m.l, y1: gy, x2: w - m.r, y2: gy, class: "axis" }, s);
      el("text", { x: m.l - 5, y: gy + 3, "text-anchor": "end", class: "axis-txt" }, s)
        .textContent = fmt(bmax - bmax * t / 4, 0);
    }
    const bdec = opts.barDec ?? 1, ldec = opts.lineDec ?? 1;
    opts.bars.forEach((v, i) => {
      const top = by(v);
      el("rect", { x: cx(i) - bw/2, y: top, width: bw, height: m.t + ih - top,
        rx: 2, fill: c[0] }, s);
      // bar data label inside top (only if the bar is tall enough to fit it)
      if (m.t + ih - top > 16)
        dlabel(s, cx(i), top + 11, fmt(v, bdec), { fill: ink(c[0]), size: 8.5 });
      el("text", { x: cx(i), y: h - 7, "text-anchor": "middle", class: "axis-txt" }, s)
        .textContent = labels[i];
    });
    const lp = opts.line.map((v, i) => `${i ? "L" : "M"}${cx(i)},${ly(v)}`).join(" ");
    el("path", { d: lp, fill: "none", stroke: c[3], "stroke-width": 2.6,
      "stroke-linejoin": "round" }, s);
    opts.line.forEach((v, i) => {
      el("circle", { cx: cx(i), cy: ly(v), r: 3, fill: "#fff", stroke: c[3],
        "stroke-width": 2 }, s);
      dlabel(s, cx(i), ly(v) - 7, fmt(v, ldec), { fill: c[3], size: 8.5 });
    });
  }

  /* ---------- COLUMN: single-series vertical bars + labels ---------- */
  function column(id, opts) {
    const host = node(id); const { w, h } = dims(host); const c = series(host);
    const s = svg(host, w, h);
    const m = { t: 16, r: 12, b: 22, l: 30 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const labels = opts.labels, vals = opts.values;
    const hasNeg = Math.min(...vals) < 0;
    const max = opts.max ?? Math.max(...vals) * 1.18;
    const min = opts.min ?? (hasNeg ? Math.min(...vals) * 1.2 : 0);
    const y = v => m.t + ih - ih * (v - min) / (max - min || 1);
    const bw = iw / labels.length * 0.6;
    const cx = i => m.l + iw * (i + 0.5) / labels.length;
    const zero = y(0);
    el("line", { x1: m.l, y1: zero, x2: w - m.r, y2: zero, class: "axis" }, s);
    const dec = opts.dec ?? 0;
    vals.forEach((v, i) => {
      const yy = v >= 0 ? y(v) : zero;
      const hh = Math.abs(zero - y(v));
      const col = v < 0 ? (opts.negColor || "var(--bad)") : (opts.colors ? opts.colors[i] : c[opts.colorIndex ?? 0]);
      el("rect", { x: cx(i) - bw/2, y: yy, width: bw, height: Math.max(1, hh), rx: 2, fill: col }, s);
      dlabel(s, cx(i), v >= 0 ? yy - 5 : yy + hh + 11, fmt(v, dec), { size: 8.5 });
      el("text", { x: cx(i), y: h - 7, "text-anchor": "middle", class: "axis-txt" }, s)
        .textContent = labels[i];
    });
  }

  /* ---------- STACKED BARS (vertical, 100% or absolute) ---------- */
  function stacked(id, opts) {
    const host = node(id); const { w, h } = dims(host); const c = series(host);
    const s = svg(host, w, h);
    const m = { t: 10, r: 12, b: 22, l: 28 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const labels = opts.labels, data = opts.data;
    const totals = data.map(row => row.reduce((a, b) => a + b, 0));
    const max = opts.pct ? 100 : (opts.max ?? Math.max(...totals) * 1.1);
    const bw = iw / labels.length * 0.62;
    const cx = i => m.l + iw * (i + 0.5) / labels.length;
    for (let t = 0; t <= 4; t++) {
      const gy = m.t + ih * t / 4;
      el("line", { x1: m.l, y1: gy, x2: w - m.r, y2: gy, class: "axis" }, s);
      el("text", { x: m.l - 5, y: gy + 3, "text-anchor": "end", class: "axis-txt" }, s)
        .textContent = fmt(max - max * t / 4, 0);
    }
    const dec = opts.dec ?? 0;
    const showEvery = opts.labelEvery || 1;
    data.forEach((row, i) => {
      const tot = opts.pct ? totals[i] : 1;
      let acc = 0;
      row.forEach((v, k) => {
        const val = opts.pct ? v / tot * 100 : v;
        const hgt = ih * val / max;
        const yy = m.t + ih - ih * acc / max - hgt;
        const col = c[k % c.length];
        el("rect", { x: cx(i) - bw/2, y: yy, width: bw, height: Math.max(0, hgt),
          fill: col, rx: k === row.length-1 ? 2 : 0 }, s);
        // segment data label (skip tiny + thin-out on x for density)
        if (hgt >= 13 && i % showEvery === 0)
          dlabel(s, cx(i), yy + hgt/2 + 3.2, fmt(val, dec), { fill: ink(col), size: 8 });
        acc += val;
      });
      const step = Math.ceil(labels.length / (opts.xticks || 8));
      if (i % step === 0 || i === labels.length - 1)
        el("text", { x: cx(i), y: h - 7, "text-anchor": "middle", class: "axis-txt" }, s)
          .textContent = labels[i];
    });
  }

  /* ---------- HORIZONTAL BARS (ranked) ---------- */
  function barH(id, opts) {
    const host = node(id); const { w, h } = dims(host); const c = series(host);
    const s = svg(host, w, h);
    const rows = opts.rows; // [{label,value,delta?,color?}]
    const labW = opts.labelW ?? 96;
    const hasDelta = rows.some(r => r.delta != null);
    const valW = hasDelta ? 84 : 48;
    const m = { t: 4, r: valW, b: 4, l: labW };
    const iw = w - m.l - m.r;
    const max = opts.max ?? Math.max(...rows.map(r => r.value)) * 1.05;
    const rh = (h - m.t - m.b) / rows.length;
    const bh = Math.min(18, rh * 0.62);
    rows.forEach((r, i) => {
      const cy = m.t + rh * i + rh / 2;
      el("text", { x: m.l - 8, y: cy + 3.5, "text-anchor": "end", class: "bar-lbl" }, s)
        .textContent = r.label;
      el("rect", { x: m.l, y: cy - bh/2, width: iw, height: bh, rx: 3,
        fill: "var(--surface-2)" }, s);
      const bwd = Math.max(1, iw * r.value / max);
      el("rect", { x: m.l, y: cy - bh/2, width: bwd, height: bh, rx: 3,
        fill: r.color || c[opts.colorIndex ?? 0] }, s);
      const lt = el("text", { x: w - 4, y: cy + 3.5, "text-anchor": "end", class: "val-txt" }, s);
      if (!opts.hideValue) {
        const vt = document.createElementNS(NS, "tspan");
        vt.textContent = fmt(r.value, opts.dec ?? 1) + (opts.suffix || "");
        lt.appendChild(vt);
      }
      if (r.delta != null) {
        const up = r.delta >= 0;
        const dt = document.createElementNS(NS, "tspan");
        if (!opts.hideValue) dt.setAttribute("dx", "5");
        dt.setAttribute("font-size", "8.5");
        dt.setAttribute("fill", up ? "var(--good)" : "var(--bad)");
        dt.textContent = (up ? "▲" : "▼") + fmt(Math.abs(r.delta), 2);
        lt.appendChild(dt);
      }
    });
  }

  /* ---------- DONUT ---------- */
  function donut(id, opts) {
    const host = node(id); const { w, h } = dims(host); const c = series(host);
    const s = svg(host, w, h);
    const cx = w * 0.27, cy = h / 2, R = Math.min(w * 0.21, h * 0.42), r = R * 0.58;
    const tot = opts.data.reduce((a, d) => a + d.value, 0);
    let a0 = -Math.PI / 2;
    opts.data.forEach((d, i) => {
      const frac = d.value / tot, a1 = a0 + 2 * Math.PI * frac;
      const large = a1 - a0 > Math.PI ? 1 : 0, mid = (a0 + a1) / 2;
      const col = d.color || c[i % c.length];
      const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R);
      const [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
      el("path", { d: `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1}
        L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`, fill: col }, s);
      // data label: % on the slice — only if it fits inside the slice (PBI behaviour)
      if (frac >= 0.08) {
        const [lx, ly] = p(mid, (R + r) / 2);
        dlabel(s, lx, ly + 3, fmt(frac * 100, opts.dec ?? 0) + "%", { fill: ink(col), size: 9 });
      }
      a0 = a1;
    });
    if (opts.center) {
      el("text", { x: cx, y: cy - 2, "text-anchor": "middle", fill: "var(--ink)",
        "font-size": 17, "font-weight": 800, "font-family": "var(--font)" }, s)
        .textContent = opts.center;
      if (opts.centerSub) el("text", { x: cx, y: cy + 13, "text-anchor": "middle",
        fill: "var(--ink-mute)", "font-size": 9, "font-family": "var(--font)" }, s)
        .textContent = opts.centerSub;
    }
    // legend on the right — LABELS ONLY (no data values), spaced well away
    const lx = w * 0.60; let ly = cy - opts.data.length * 9.5 + 6;
    opts.data.forEach((d, i) => {
      el("rect", { x: lx, y: ly - 8, width: 10, height: 10, rx: 2,
        fill: d.color || c[i % c.length] }, s);
      el("text", { x: lx + 15, y: ly, fill: "var(--ink-soft)", "font-size": 10.5,
        "font-family": "var(--font)" }, s).textContent = d.label;
      ly += 19;
    });
  }

  /* ---------- SPARKLINE (KPI adornment — no labels) ---------- */
  function spark(id, vals, colorVar) {
    const host = node(id); const { w, h } = dims(host);
    const s = svg(host, w, h);
    const max = Math.max(...vals), min = Math.min(...vals);
    const x = i => 2 + (w - 4) * i / (vals.length - 1);
    const y = v => 2 + (h - 4) * (1 - (v - min) / (max - min || 1));
    const col = cssVar(colorVar || "--accent", host);
    const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
    el("path", { d: path + ` L${x(vals.length-1)},${h} L${x(0)},${h} Z`,
      fill: col, "fill-opacity": .12 }, s);
    el("path", { d: path, fill: "none", stroke: col, "stroke-width": 1.8,
      "stroke-linejoin": "round" }, s);
    el("circle", { cx: x(vals.length-1), cy: y(vals[vals.length-1]), r: 2.2, fill: col }, s);
  }

  /* ---------- TREEMAP (row-based, with labels) ---------- */
  function treemap(id, opts) {
    const host = node(id); const { w, h } = dims(host); const c = series(host);
    const s = svg(host, w, h);
    const data = [...opts.data].sort((a, b) => b.value - a.value);
    const tot = data.reduce((a, d) => a + d.value, 0);
    const pad = 2; let i = 0, idx = 0, accV = 0;
    while (i < data.length) {
      const rowCount = Math.min(data.length - i, (idx === 0 ? 2 : 3));
      const row = data.slice(i, i + rowCount);
      const rowVal = row.reduce((a, d) => a + d.value, 0);
      const rowH = h * rowVal / tot;
      const ry = h * accV / tot;
      let cxp = 0;
      row.forEach((d, k) => {
        const cw = w * d.value / rowVal;
        const col = c[(i + k) % c.length];
        el("rect", { x: cxp + pad, y: ry + pad, width: Math.max(0, cw - pad*2),
          height: Math.max(0, rowH - pad*2), rx: 3, fill: col }, s);
        if (cw > 40 && rowH > 24) {
          el("text", { x: cxp + 7, y: ry + 15, fill: ink(col), "font-size": 10,
            "font-weight": 700, "font-family": "var(--font)" }, s).textContent = d.label;
          el("text", { x: cxp + 7, y: ry + 28, fill: ink(col), "font-size": 9.5,
            "font-family": "var(--font)", "fill-opacity": .85 }, s)
            .textContent = fmt(d.value, opts.dec ?? 1) + (opts.suffix || "");
        }
        cxp += cw;
      });
      accV += rowVal; i += rowCount; idx++;
    }
  }

  /* ---------- BUBBLE MAP (stylised geo + value bubbles + labels) ---------- */
  function bubbleMap(id, opts) {
    const host = node(id); const { w, h } = dims(host); const c = series(host);
    const s = svg(host, w, h);
    const vb = opts.viewBox || [0,0,100,100];
    const gmap = el("g", {}, s);
    // scale region paths from map coord space into the host pixel space
    const sx = w / (vb[2]-vb[0]), sy = h / (vb[3]-vb[1]);
    const sc = Math.min(sx, sy) * 0.96;
    const offx = (w - (vb[2]-vb[0]) * sc) / 2, offy = (h - (vb[3]-vb[1]) * sc) / 2;
    const tx = x => offx + (x - vb[0]) * sc, ty = y => offy + (y - vb[1]) * sc;
    // regions (filled choropleth-ish)
    opts.regions.forEach((rg) => {
      const pts = rg.poly.map((p,j) => `${j?"L":"M"}${tx(p[0])},${ty(p[1])}`).join(" ") + " Z";
      el("path", { d: pts, fill: rg.fill || cssVar("--surface-2", host),
        stroke: cssVar("--border", host), "stroke-width": 1 }, gmap);
    });
    // bubbles + value + name (name above bubble)
    const maxV = Math.max(...opts.regions.map(r => r.value));
    opts.regions.forEach((rg, i) => {
      const rad = (rg.r ? rg.r*sc : (12 + 24 * Math.sqrt(rg.value/maxV)));
      const px = tx(rg.cx), py = ty(rg.cy);
      el("circle", { cx: px, cy: py, r: rad, fill: c[i % c.length],
        "fill-opacity": .82, stroke: "#fff", "stroke-width": 1.5 }, gmap);
      dlabel(s, px, py + 3.5, fmt(rg.value, opts.dec ?? 1) + (opts.suffix || ""),
        { fill: ink(c[i % c.length]), size: 10 });
      el("text", { x: px, y: py - rad - 5, "text-anchor":"middle",
        fill: "var(--ink-soft)", "font-size": 10, "font-weight":700,
        "font-family":"var(--font)" }, gmap).textContent = rg.name;
    });
  }

  g.PBI = { line, combo, column, stacked, barH, donut, spark, treemap, bubbleMap, cssVar, series, ink };
})(window);
