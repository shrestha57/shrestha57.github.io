(() => {
	const NS = "http://www.w3.org/2000/svg";
	const D = window.CHART_DATA;
	const C = {
		primary: "#466a3d",
		gray: "#a2a397",
		clay: "#b8653f",
		slate: "#4f7396",
		sage: "#93b273",
		ink: "#172319",
		zone: "#f1f3ea",
	};
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const node = (tag, attrs, parent) => {
		const n = document.createElementNS(NS, tag);
		for (const k in attrs) n.setAttribute(k, attrs[k]);
		if (parent) parent.appendChild(n);
		return n;
	};
	const label = (parent, x, y, str, attrs = {}) => {
		const t = node("text", { x, y, ...attrs }, parent);
		t.textContent = str;
		return t;
	};
	const stack = (parent, x, y, rows, lh, attrs) => rows.map((s, i) => label(parent, x, y + i * lh, s, attrs));
	const tip = (n, str) => {
		node("title", {}, n).textContent = str;
		return n;
	};
	const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) * (r1 - r0)) / (d1 - d0);
	const ease = (t) => 1 - Math.pow(1 - t, 3);
	const minus = (s) => String(s).replace("-", "\u2212");
	const fmtInt = (v) => v.toLocaleString("en-US");

	function tween(ms, fn, delay = 0) {
		return new Promise((resolve) => {
			if (reduce) {
				fn(1);
				resolve();
				return;
			}
			let t0 = null;
			const step = (now) => {
				if (t0 === null) t0 = now + delay;
				const t = Math.max(0, Math.min(1, (now - t0) / ms));
				fn(ease(t));
				if (t < 1) requestAnimationFrame(step);
				else resolve();
			};
			requestAnimationFrame(step);
		});
	}

	function prepDraw(path) {
		const len = path.getTotalLength();
		path.style.strokeDasharray = `${len} ${len}`;
		path.style.strokeDashoffset = len;
		return (ms, delay) => tween(ms, (t) => (path.style.strokeDashoffset = len * (1 - t)), delay);
	}
	const fadeIn = (els, ms, delay) => {
		els.forEach((e) => e.setAttribute("opacity", 0));
		return (ms2 = ms, delay2 = delay) => tween(ms2, (t) => els.forEach((e) => e.setAttribute("opacity", t)), delay2);
	};
	const popIn = (circle, r) => {
		circle.setAttribute("r", 0);
		return (ms, delay) => tween(ms, (t) => circle.setAttribute("r", r * t), delay);
	};

	function frame(host, o) {
		host.textContent = "";
		const W = o.w;
		const H = o.h;
		const m = o.m;
		const svg = node("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg" + (o.compact ? " is-compact" : ""), role: "img", "aria-label": o.aria || o.title }, host);
		const x0 = m.l;
		const x1 = W - m.r;
		const y0 = H - m.b;
		const y1 = m.t;
		const sx = o.xMap ? (v) => x0 + o.xMap(v) * (x1 - x0) : lin(o.x[0], o.x[1], x0, x1);
		const sy = o.yMap ? (v) => y0 - o.yMap(v) * (y0 - y1) : lin(o.y[0], o.y[1], y0, y1);
		const grid = node("g", {}, svg);
		(o.yTicks || []).forEach((v) => {
			node("line", { x1: x0, x2: x1, y1: sy(v), y2: sy(v), class: "c-grid" }, grid);
			label(grid, x0 - 8, sy(v) + 4, (o.yFmt || String)(v), { "text-anchor": "end" });
		});
		(o.xTicks || []).forEach((v) => {
			if (o.xGrid !== false) node("line", { x1: sx(v), x2: sx(v), y1, y2: y0, class: "c-grid" }, grid);
			label(grid, sx(v), y0 + 18, (o.xFmt || String)(v), { "text-anchor": "middle" });
		});
		node("line", { x1: x0, x2: x1, y1: y0, y2: y0, class: "c-axis" }, grid);
		if (o.title) {
			const t = label(svg, 2, 20, o.title, { class: "c-title" });
			const len = t.getComputedTextLength();
			if (len > W - 4) {
				t.setAttribute("textLength", W - 4);
				t.setAttribute("lengthAdjust", "spacingAndGlyphs");
			}
		}
		if (!o.compact) {
			if (o.xTitle) label(svg, (x0 + x1) / 2, y0 + 42, o.xTitle, { "text-anchor": "middle", class: "c-axis-title" });
			if (o.yTitle) label(svg, 0, 0, o.yTitle, { "text-anchor": "middle", class: "c-axis-title", transform: `translate(14 ${(y0 + y1) / 2}) rotate(-90)` });
		}
		const plot = node("g", {}, svg);
		return { svg, plot, grid, sx, sy, W, H, x0, x1, y0, y1, compact: o.compact };
	}

	function legend(parent, items, x, y, { vertical = false, alignRight = false } = {}) {
		const g = node("g", {}, parent);
		let cx = 0;
		let cy = 0;
		for (const it of items) {
			if (it.type === "rect") node("rect", { x: cx, y: cy - 9, width: 12, height: 10, fill: it.color }, g);
			else if (it.type === "dot") node("circle", { cx: cx + 6, cy: cy - 4, r: 5.5, fill: it.color }, g);
			else {
				const a = { x1: cx - 2, x2: cx + 16, y1: cy - 4, y2: cy - 4, stroke: it.color, "stroke-width": 2.5 };
				if (it.type === "dash") a["stroke-dasharray"] = "5 4";
				node("line", a, g);
				if (it.marker) node("circle", { cx: cx + 7, cy: cy - 4, r: 4.2, fill: it.color }, g);
			}
			const t = label(g, cx + 22, cy, it.label, { class: "c-label" });
			if (vertical) cy += 19;
			else cx += 22 + (t.getComputedTextLength() || it.label.length * 6.5) + 18;
		}
		const shift = alignRight ? -g.getBBox().width : 0;
		g.setAttribute("transform", `translate(${x + shift} ${y})`);
		return g;
	}

	function bindHover(host, f, onMove) {
		const tipEl = document.createElement("div");
		tipEl.className = "chart-tip";
		host.appendChild(tipEl);
		const line = node("line", { y1: f.y1, y2: f.y0, class: "c-hover-line", opacity: 0 }, f.svg);
		const zone = node("rect", { x: f.x0, y: f.y1, width: f.x1 - f.x0, height: f.y0 - f.y1, fill: "transparent" }, f.svg);
		const toSvg = (evt) => {
			const p = f.svg.createSVGPoint();
			p.x = evt.clientX;
			p.y = evt.clientY;
			return p.matrixTransform(f.svg.getScreenCTM().inverse());
		};
		zone.addEventListener("pointermove", (evt) => {
			const p = toSvg(evt);
			const res = onMove(p.x);
			if (!res) return;
			line.setAttribute("x1", res.x);
			line.setAttribute("x2", res.x);
			line.setAttribute("opacity", 1);
			tipEl.innerHTML = res.html;
			const box = host.getBoundingClientRect();
			let left = evt.clientX - box.left + 14;
			if (left + 180 > box.width) left = evt.clientX - box.left - 190;
			tipEl.style.left = `${left}px`;
			tipEl.style.top = `${Math.max(8, evt.clientY - box.top - 30)}px`;
			tipEl.classList.add("is-on");
		});
		zone.addEventListener("pointerleave", () => {
			line.setAttribute("opacity", 0);
			tipEl.classList.remove("is-on");
		});
	}

	const W_FULL = 720;
	const W_COMPACT = 480;
	const H_COMPACT = 360;
	const CHARTS = {};

	// Fig. 1 — histogram of estimated lift, 300 simulations per design
	CHARTS.interference = (host, { compact }) => {
		const d = D.interference;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 430,
			m: compact ? { t: 64, r: 14, b: 32, l: 34 } : { t: 64, r: 18, b: 96, l: 58 },
			x: [0.75, 1.85],
			y: [0, 66],
			xTicks: [0.8, 1.0, 1.2, 1.4, 1.6, 1.8],
			yTicks: [0, 10, 20, 30, 40, 50, 60],
			xFmt: (v) => v.toFixed(1),
			title: compact ? "Individual vs. cluster randomization" : "Individual randomization measures the direct effect only",
			xTitle: "Estimated lift (300 simulated experiments)",
			yTitle: "Experiments",
		});
		const bars = [];
		[
			["individual", C.gray, "Individual randomization"],
			["cluster", C.primary, "Cluster randomization"],
		].forEach(([key, color, name], s) => {
			const h = d[key];
			h.counts.forEach((n, i) => {
				if (!n) return;
				const a = h.start + i * h.width;
				const b = a + h.width;
				const r = node("rect", { x: f.sx(a) + 0.7, width: Math.max(1, f.sx(b) - f.sx(a) - 1.4), y: f.y0, height: 0, fill: color }, f.plot);
				tip(r, `${name}: lift ${a.toFixed(3)}–${b.toFixed(3)} · ${n} experiment${n > 1 ? "s" : ""}`);
				bars.push({ r, top: f.sy(n), delay: s * 550 + i * 40 });
			});
		});
		const notes = [];
		[
			[d.trueDirect, ["True direct", "effect = 1.0"]],
			[d.trueTotal, ["True total", "effect = 1.6"]],
		].forEach(([v, txt]) => {
			node("line", { x1: f.sx(v), x2: f.sx(v), y1: f.y1 - 8, y2: f.y0, stroke: C.ink, "stroke-width": 1.4, "stroke-dasharray": "4 3" }, f.svg);
			notes.push(...stack(f.svg, f.sx(v) + 6, f.y1 + 8, txt, 15, { class: "c-note" }));
		});
		legend(f.svg, [
			{ type: "rect", color: C.gray, label: "Individual randomization" },
			{ type: "rect", color: C.primary, label: "Cluster randomization" },
		], compact ? 4 : f.x0, compact ? 44 : f.H - 12);
		return () =>
			Promise.all(
				bars.map((b) =>
					tween(700, (t) => {
						const y = f.y0 + (b.top - f.y0) * t;
						b.r.setAttribute("y", y);
						b.r.setAttribute("height", f.y0 - y);
					}, b.delay)
				)
			);
	};

	// Fig. 2 — standardized mean differences
	CHARTS.balance = (host, { compact }) => {
		const v = D.balance;
		const n = v.length;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 430,
			m: compact ? { t: 50, r: 16, b: 32, l: 38 } : { t: 52, r: 24, b: 66, l: 50 },
			x: [-0.12, 0.12],
			yMap: (i) => 1 - (i + 0.5) / n,
			xTicks: [-0.1, -0.05, 0, 0.05, 0.1],
			xFmt: (t) => minus(t.toFixed(2)),
			title: compact ? "Randomization check: all 12 features balanced" : "Randomization check: all 12 features balanced across arms",
			xTitle: "Standardized mean difference (treatment − control)",
		});
		const zone = node("rect", { x: f.sx(-0.1), y: f.y1, width: f.sx(0.1) - f.sx(-0.1), height: f.y0 - f.y1, fill: C.zone });
		f.svg.insertBefore(zone, f.svg.firstChild);
		label(f.plot, f.sx(0), f.y1 - 8, "balanced zone (|SMD| < 0.1)", { "text-anchor": "middle", class: "c-note" });
		const band = (f.y0 - f.y1) / n;
		const bars = v.map((val, i) => {
			const cy = f.sy(i);
			node("line", { x1: f.x0, x2: f.x1, y1: cy, y2: cy, class: "c-grid" }, f.plot);
			label(f.plot, f.x0 - 8, cy + 4, `f${i}`, { "text-anchor": "end", class: "c-label" });
			const r = node("rect", { x: f.sx(0), y: cy - band * 0.3, width: 0, height: band * 0.6, fill: C.primary }, f.plot);
			tip(r, `f${i}: SMD ${minus(val.toFixed(3))}`);
			return { r, val };
		});
		node("line", { x1: f.sx(0), x2: f.sx(0), y1: f.y1, y2: f.y0, stroke: "#cfc9ba" }, f.plot);
		return () =>
			Promise.all(
				bars.map((b, i) =>
					tween(650, (t) => {
						const x = f.sx(b.val * t);
						b.r.setAttribute("x", Math.min(x, f.sx(0)));
						b.r.setAttribute("width", Math.abs(x - f.sx(0)));
					}, i * 50)
				)
			);
	};

	// Fig. 3 — ITT vs CACE vs naive
	CHARTS.effects = (host, { compact }) => {
		const rows = D.effects;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 320,
			m: compact ? { t: 44, r: 20, b: 32, l: 118 } : { t: 44, r: 30, b: 62, l: 222 },
			x: [0, 6.3],
			yMap: (i) => 1 - (i + 0.5) / rows.length,
			xTicks: [0, 1, 2, 3, 4, 5, 6],
			title: "The ad's effect depends on who you ask",
			xTitle: "Lift in conversion rate (percentage points; bars show 95% CI)",
		});
		const band = (f.y0 - f.y1) / rows.length;
		const items = rows.map((r, i) => {
			const cy = f.sy(i);
			if (compact) label(f.plot, f.x0 - 10, cy + 4, r.short, { "text-anchor": "end", class: "c-label" });
			else stack(f.plot, f.x0 - 10, cy - 4, r.label, 16, { "text-anchor": "end", class: "c-label" });
			const bar = node("rect", { x: f.sx(0), y: cy - band * 0.27, width: 0, height: band * 0.54, fill: r.naive ? C.gray : C.primary }, f.plot);
			tip(bar, `${r.short}: ${r.text}${r.lo !== undefined ? ` (95% CI ${r.lo.toFixed(r.lo < 1 ? 3 : 2)} to ${r.hi.toFixed(r.hi < 1 ? 3 : 2)})` : ""}`);
			const extras = [];
			if (r.lo !== undefined) {
				const g = node("g", { stroke: C.ink, "stroke-width": 1.6 }, f.plot);
				node("line", { x1: f.sx(r.lo), x2: f.sx(r.hi), y1: cy, y2: cy }, g);
				node("line", { x1: f.sx(r.lo), x2: f.sx(r.lo), y1: cy - 6, y2: cy + 6 }, g);
				node("line", { x1: f.sx(r.hi), x2: f.sx(r.hi), y1: cy - 6, y2: cy + 6 }, g);
				extras.push(g);
			}
			extras.push(label(f.plot, f.sx(Math.max(r.value, r.hi || 0)) + 12, cy + 4, r.text, { class: "c-value" }));
			return { bar, value: r.value, show: fadeIn(extras, 350, 0) };
		});
		return async () => {
			await Promise.all(items.map((it, i) => tween(800, (t) => it.bar.setAttribute("width", f.sx(it.value * t) - f.sx(0)), i * 180)));
			await Promise.all(items.map((it) => it.show()));
		};
	};

	// Fig. 4 — share of incremental conversions captured
	CHARTS.capture = (host, { compact }) => {
		const d = D.capture;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 440,
			m: compact ? { t: 40, r: 14, b: 32, l: 38 } : { t: 44, r: 20, b: 66, l: 62 },
			x: [0, 100],
			y: [0, 100],
			xTicks: [0, 20, 40, 60, 80, 100],
			yTicks: [0, 20, 40, 60, 80, 100],
			title: compact ? "Top 20% of users: 82% of the impact" : "Targeting the right 20% captures most of the ad's incremental impact",
			xTitle: "% of users targeted (highest predicted uplift first)",
			yTitle: "% of incremental conversions captured",
		});
		const pathFor = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${f.sx(i * d.step).toFixed(1)},${f.sy(v).toFixed(1)}`).join("");
		const series = [
			{ key: "x", name: "X-learner", color: C.primary },
			{ key: "s", name: "S-learner", color: C.clay },
			{ key: "t", name: "T-learner", color: C.slate },
		];
		const random = node("path", { d: `M${f.sx(0)},${f.sy(0)}L${f.sx(100)},${f.sy(100)}`, stroke: C.gray, "stroke-width": 2, "stroke-dasharray": "6 5", fill: "none" }, f.plot);
		const showRandom = fadeIn([random], 500, 0);
		const draws = [...series].reverse().map((s) => prepDraw(node("path", { d: pathFor(d[s.key]), stroke: s.color, "stroke-width": 2.6, fill: "none", "stroke-linejoin": "round" }, f.plot)));
		const at20 = d.x[Math.round(20 / d.step)];
		const annot = [node("line", { x1: f.sx(20), x2: f.sx(20), y1: f.sy(at20), y2: f.y0, stroke: C.primary, "stroke-width": 1.5, "stroke-dasharray": "2 3" }, f.plot)];
		const dot = node("circle", { cx: f.sx(20), cy: f.sy(at20), r: 6, fill: C.primary }, f.plot);
		tip(dot, `X-learner, top 20% targeted: ${at20.toFixed(1)}% captured`);
		if (!compact) annot.push(...stack(f.plot, f.sx(22), f.sy(15), ["Top 20% of users:", "82% of incremental", "conversions"], 15, { class: "c-label" }));
		const showAnnot = fadeIn(annot, 400, 0);
		const pop = popIn(dot, 6);
		legend(f.svg, [
			...series.map((s) => ({ type: "line", color: s.color, label: s.name })),
			{ type: "dash", color: C.gray, label: "Random targeting" },
		], f.x1 - 10, f.y0 - (compact ? 74 : 82), { vertical: true, alignRight: true });
		if (!compact) {
			bindHover(host, f, (px) => {
				const xv = Math.max(0, Math.min(100, ((px - f.x0) / (f.x1 - f.x0)) * 100));
				const i = Math.round(xv / d.step);
				const pct = i * d.step;
				const row = (c, n, v) => `<div><i style="background:${c}"></i>${n}: ${v.toFixed(1)}%</div>`;
				return {
					x: f.sx(pct),
					html: `<strong>Top ${pct.toFixed(1)}% targeted</strong>${series.map((s) => row(s.color, s.name, d[s.key][i])).join("")}${row(C.gray, "Random", pct)}`,
				};
			});
		}
		return async () => {
			showRandom();
			await Promise.all(draws.map((go, i) => go(1500, i * 220)));
			await Promise.all([showAnnot(), pop(400, 0)]);
		};
	};

	// Fig. 5 — observed lift by predicted-uplift decile
	CHARTS.deciles = (host, { compact }) => {
		const d = D.deciles;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 420,
			m: compact ? { t: 44, r: 14, b: 32, l: 40 } : { t: 50, r: 20, b: 66, l: 64 },
			x: [0.4, 10.6],
			y: [-0.07, 0.95],
			xTicks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
			yTicks: [0, 0.2, 0.4, 0.6, 0.8],
			yFmt: (v) => v.toFixed(1),
			title: "Measured lift is concentrated in the top decile",
			xTitle: "Predicted-uplift decile (1 = model's top 10% of users)",
			yTitle: "Observed lift in conversion (pp)",
		});
		const half = 0.35;
		const bars = d.lift.map((v, i) => {
			const x = i + 1;
			const r = node("rect", { x: f.sx(x - half), width: f.sx(x + half) - f.sx(x - half), y: f.sy(0), height: 0, fill: C.primary }, f.plot);
			tip(r, `Decile ${x}: ${v >= 0 ? "+" : minus("-")}${Math.abs(v).toFixed(3)} pp (95% CI ${minus(d.lo[i].toFixed(3))} to ${minus(d.hi[i].toFixed(3))})`);
			return { r, v };
		});
		const whiskers = d.lift.map((v, i) => {
			const x = f.sx(i + 1);
			const g = node("g", { stroke: C.ink, "stroke-width": 1.6 }, f.plot);
			node("line", { x1: x, x2: x, y1: f.sy(d.lo[i]), y2: f.sy(d.hi[i]) }, g);
			node("line", { x1: x - 6, x2: x + 6, y1: f.sy(d.lo[i]), y2: f.sy(d.lo[i]) }, g);
			node("line", { x1: x - 6, x2: x + 6, y1: f.sy(d.hi[i]), y2: f.sy(d.hi[i]) }, g);
			return g;
		});
		const avg = node("line", { x1: f.x0, x2: f.x1, y1: f.sy(d.overall), y2: f.sy(d.overall), stroke: "#555a52", "stroke-width": 1.5, "stroke-dasharray": "6 4" }, f.plot);
		const notes = [avg, ...stack(f.plot, f.x1 - 4, f.sy(d.overall) - (compact ? 24 : 26), ["overall average", "+0.115 pp"], 16, { "text-anchor": "end", class: "c-note" })];
		notes.push(label(f.plot, f.sx(1), f.sy(d.hi[0]) - 8, "+0.80 pp", { "text-anchor": "middle", class: "c-value" }));
		const showWhiskers = fadeIn(whiskers, 350, 0);
		const showNotes = fadeIn(notes, 400, 0);
		return async () => {
			await Promise.all(
				bars.map((b, i) =>
					tween(750, (t) => {
						const y = f.sy(b.v * t);
						b.r.setAttribute("y", Math.min(y, f.sy(0)));
						b.r.setAttribute("height", Math.abs(f.sy(0) - y));
					}, i * 70)
				)
			);
			await Promise.all([showWhiskers(), showNotes()]);
		};
	};

	function lineChart(host, compact, o) {
		const f = frame(host, { compact, ...o });
		const looks = o.xs;
		const draws = [];
		const pops = [];
		o.series.forEach((s, si) => {
			const dStr = s.values.map((v, i) => `${i ? "L" : "M"}${f.sx(looks[i]).toFixed(1)},${f.sy(v).toFixed(1)}`).join("");
			draws.push(prepDraw(node("path", { d: dStr, stroke: s.color, "stroke-width": 2.4, fill: "none", "stroke-linejoin": "round" }, f.plot)));
			s.values.forEach((v, i) => {
				const c = node("circle", { cx: f.sx(looks[i]), cy: f.sy(v), r: 5.5, fill: s.color }, f.plot);
				tip(c, o.tipText(s, looks[i], v));
				pops.push({ go: popIn(c, 5.5), delay: si * 160 + i * 60 });
			});
		});
		return { f, draws, pops };
	}

	// EE Fig. 8 — false-positive rate vs number of looks
	CHARTS.peeking = (host, { compact }) => {
		const d = D.peeking;
		const lo = Math.log10(0.78);
		const hi = Math.log10(128);
		const colors = { naive: C.clay, bonferroni: C.gray, obf: C.primary, msprt: C.slate };
		const series = d.series.map((s) => ({ ...s, color: colors[s.key] }));
		const { f, draws, pops } = lineChart(host, compact, {
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 400,
			m: compact ? { t: 40, r: 16, b: 32, l: 36 } : { t: 44, r: 22, b: 66, l: 60 },
			xMap: (v) => (Math.log10(v) - lo) / (hi - lo),
			y: [-1.8, 40],
			xs: d.looks,
			xTicks: d.looks,
			yTicks: [0, 5, 10, 15, 20, 25, 30, 35],
			title: compact ? "Peeking: false alarms climb from 5% to 38%" : "Peeking at a test with no real effect: false alarms climb from 5% to 38%",
			xTitle: "Number of times the data is checked",
			yTitle: "False-positive rate (%)",
			series,
			tipText: (s, x, v) => `${s.name}: ${x} look${x > 1 ? "s" : ""} → ${v.toFixed(v < 1 ? 2 : 1)}% false positives`,
		});
		const target = [
			node("line", { x1: f.x0, x2: f.x1, y1: f.sy(d.target), y2: f.sy(d.target), stroke: "#555a52", "stroke-width": 1.4, "stroke-dasharray": "5 4" }, f.grid),
			label(f.grid, f.sx(1.15), f.sy(d.target) - 9, "5% target", { class: "c-note" }),
		];
		legend(f.svg, series.map((s) => ({ type: "line", marker: true, color: s.color, label: s.name })), f.x0 + 18, f.y1 + (compact ? 34 : 60), { vertical: true });
		const showTarget = fadeIn(target, 400, 0);
		return async () => {
			showTarget();
			await Promise.all(draws.map((go, i) => go(1100, i * 160)));
			await Promise.all(pops.map((p) => p.go(300, p.delay)));
		};
	};

	// EE Fig. 6 — fewer users needed for the same precision
	CHARTS.variance = (host, { compact }) => {
		const rows = D.variance;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 300,
			m: compact ? { t: 40, r: 18, b: 32, l: 112 } : { t: 44, r: 24, b: 62, l: 198 },
			x: [0, 30],
			yMap: (i) => 1 - (i + 0.5) / rows.length,
			xTicks: [0, 5, 10, 15, 20, 25, 30],
			title: compact ? "13–22% fewer users, same precision" : "Pre-experiment data lets a test reach the same precision with 13–22% fewer users",
			xTitle: "Fewer users needed for the same precision (%)",
		});
		const band = (f.y0 - f.y1) / rows.length;
		const items = rows.map((r, i) => {
			const cy = f.sy(i);
			label(f.plot, f.x0 - 10, cy + 4, compact ? r.short : r.label, { "text-anchor": "end", class: "c-label" });
			const bar = node("rect", { x: f.sx(0), y: cy - band * 0.27, width: 0, height: band * 0.54, fill: C.primary }, f.plot);
			tip(bar, `${r.label}: ${r.value.toFixed(1)}% fewer users (95% interval ${r.lo.toFixed(1)} to ${r.hi.toFixed(1)})`);
			const g = node("g", { stroke: C.ink, "stroke-width": 1.6 }, f.plot);
			node("line", { x1: f.sx(r.lo), x2: f.sx(r.hi), y1: cy, y2: cy }, g);
			node("line", { x1: f.sx(r.lo), x2: f.sx(r.lo), y1: cy - 6, y2: cy + 6 }, g);
			node("line", { x1: f.sx(r.hi), x2: f.sx(r.hi), y1: cy - 6, y2: cy + 6 }, g);
			const t = label(f.plot, f.sx(r.hi) + 12, cy + 4, `${r.value.toFixed(1)}%`, { class: "c-value" });
			return { bar, value: r.value, show: fadeIn([g, t], 350, 0) };
		});
		return async () => {
			await Promise.all(items.map((it, i) => tween(800, (t) => it.bar.setAttribute("width", f.sx(it.value * t) - f.sx(0)), i * 150)));
			await Promise.all(items.map((it) => it.show()));
		};
	};

	// EE Fig. 7 — power at 500 / 2,000 / 5,000 users per arm
	CHARTS.power = (host, { compact }) => {
		const d = D.power;
		const colors = { dim: C.gray, cuped: C.slate, reg: C.clay, post: C.sage, cupac: C.primary };
		const series = d.series.map((s) => ({ ...s, color: colors[s.key] }));
		const { f, draws, pops } = lineChart(host, compact, {
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 420,
			m: compact ? { t: 40, r: 18, b: 32, l: 36 } : { t: 44, r: 24, b: 66, l: 60 },
			xMap: (v) => 0.05 + (0.9 * d.sizes.indexOf(v)) / (d.sizes.length - 1),
			y: [13, 100],
			xs: d.sizes,
			xTicks: d.sizes,
			xFmt: fmtInt,
			yTicks: [20, 30, 40, 50, 60, 70, 80, 90, 100],
			title: compact ? "Adjusted tests detect the effect more often" : "Same effect, same users: adjusted tests detect it more often",
			xTitle: "Users per arm",
			yTitle: "Power to detect the +3.3 pp effect (%)",
			series,
			tipText: (s, x, v) => `${s.name}: ${v.toFixed(1)}% power at ${fmtInt(x)} users per arm`,
		});
		legend(f.svg, series.map((s) => ({ type: "line", marker: true, color: s.color, label: s.name })), f.x1 - 12, f.y0 - (compact ? 84 : 92), { vertical: true, alignRight: true });
		return async () => {
			await Promise.all(draws.map((go, i) => go(1100, i * 150)));
			await Promise.all(pops.map((p) => p.go(300, p.delay)));
		};
	};

	// EE Fig. 9 — power vs average users per arm, plain vs CUPAC
	CHARTS.decision = (host, { compact }) => {
		const d = D.decision;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 440,
			m: compact ? { t: 40, r: 18, b: 32, l: 36 } : { t: 44, r: 26, b: 66, l: 60 },
			x: [20, 40],
			y: [45, 91],
			xTicks: compact ? [20, 25, 30, 35, 40] : [20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40],
			xFmt: (v) => (compact ? String(v) : v.toFixed(1)),
			yTicks: [50, 60, 70, 80, 90],
			title: "Valid rules + CUPAC: fewer users and more power",
			xTitle: "Average users per arm at the decision (thousands)",
			yTitle: "Power to detect a 1 pp lift (%)",
		});
		const fixedPlain = d.plain[0];
		const obfCupac = d.cupac[1];
		const ax = f.sx(fixedPlain.users / 1000);
		const ay = f.sy(fixedPlain.power);
		const bx = f.sx(obfCupac.users / 1000);
		const by = f.sy(obfCupac.power);
		const len = Math.hypot(bx - ax, by - ay);
		const ex = bx + ((ax - bx) / len) * 9;
		const ey = by + ((ay - by) / len) * 9;
		const defs = node("defs", {}, f.svg);
		const mk = node("marker", { id: `arrow-${Math.random().toString(36).slice(2, 8)}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
		node("path", { d: "M0,0L10,5L0,10z", fill: C.clay }, mk);
		const arrow = node("path", { d: `M${ax},${ay}L${ex},${ey}`, stroke: C.clay, "stroke-width": 2.2, fill: "none", "marker-end": `url(#${mk.id})` }, f.plot);
		const drawArrow = prepDraw(arrow);
		arrow.setAttribute("opacity", 0);
		const pts = [];
		[
			["plain", C.gray, "plain"],
			["cupac", C.primary, "with CUPAC"],
		].forEach(([key, color, tag], gi) => {
			d[key].forEach((p, i) => {
				const cx = f.sx(p.users / 1000);
				const cy = f.sy(p.power);
				const c = node("circle", { cx, cy, r: 7.5, fill: color }, f.plot);
				tip(c, `${p.rule} (${tag}): ${p.approx ? "≈" : ""}${fmtInt(p.users)} users per arm, ${p.approx ? "≈" : ""}${p.power}% power`);
				const lbl = key === "plain" ? label(f.plot, cx + 12, cy + 5, p.rule, { class: "c-note" }) : label(f.plot, cx + 10, cy - 13, p.rule, { class: "c-note" });
				pts.push({ pop: popIn(c, 7.5), show: fadeIn([lbl], 300, 0), delay: gi * 650 + i * 120 });
			});
		});
		legend(f.svg, [
			{ type: "dot", color: C.gray, label: "Plain difference in means" },
			{ type: "dot", color: C.primary, label: "With CUPAC" },
		], f.x0 + 14, f.y0 - 34, { vertical: true });
		return async () => {
			await Promise.all(pts.map((p) => Promise.all([p.pop(350, p.delay), p.show(300, p.delay)])));
			arrow.setAttribute("opacity", 1);
			await drawArrow(900, 0);
		};
	};

	// EE Fig. 10 — winner's curse
	CHARTS.winners = (host, { compact }) => {
		const d = D.winners;
		const n = d.bars.length;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 400,
			m: compact ? { t: 44, r: 14, b: 52, l: 40 } : { t: 48, r: 20, b: 66, l: 64 },
			x: [-0.6, n + 0.4],
			y: [0, 2],
			yTicks: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
			yFmt: (v) => v.toFixed(2),
			title: "Stopping early overstates the winning effect",
			yTitle: "Avg. estimated lift among declared wins (pp)",
		});
		const half = 0.3;
		const bars = d.bars.map((b, i) => {
			const r = node("rect", { x: f.sx(i - half), width: f.sx(i + half) - f.sx(i - half), y: f.y0, height: 0, fill: b.invalid ? C.gray : C.primary }, f.plot);
			tip(r, `${b.label.join(" ")}: ${b.value.toFixed(2)} pp average estimated lift`);
			stack(f.plot, f.sx(i), f.y0 + 18, compact && b.invalid ? ["Naive", "peeking", "(invalid)"] : b.label, 15, { "text-anchor": "middle", class: "c-label" });
			const v = label(f.plot, f.sx(i), f.sy(b.value) - 7, b.value.toFixed(2), { "text-anchor": "middle", class: "c-value" });
			return { r, value: b.value, show: fadeIn([v], 300, 0) };
		});
		const truth = [
			node("line", { x1: f.x0, x2: f.x1, y1: f.sy(d.truth), y2: f.sy(d.truth), stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "6 4" }, f.plot),
			...stack(f.plot, f.x1 - 4, f.sy(d.truth) - 22, ["true effect", "= 1.0 pp"], 15, { "text-anchor": "end", class: "c-note" }),
		];
		const showTruth = fadeIn(truth, 400, 0);
		return async () => {
			await Promise.all(
				bars.map((b, i) =>
					tween(800, (t) => {
						const y = f.y0 + (f.sy(b.value) - f.y0) * t;
						b.r.setAttribute("y", y);
						b.r.setAttribute("height", f.y0 - y);
					}, i * 140)
				)
			);
			await Promise.all([...bars.map((b) => b.show()), showTruth()]);
		};
	};

	const uid = () => Math.random().toString(36).slice(2, 9);
	const catMap = (xs, pad = 0.05) => (v) => pad + ((1 - 2 * pad) * xs.indexOf(v)) / (xs.length - 1);
	const colored = (color, extra = {}) => ({ ...extra, style: `fill:${color}` });

	// Lines are revealed with a left-to-right clip wipe so dashed series animate too.
	function seriesChart(host, compact, o) {
		const f = frame(host, { compact, ...o });
		if (o.before) o.before(f);
		const id = `wipe-${uid()}`;
		const clip = node("clipPath", { id }, node("defs", {}, f.svg));
		const wipe = node("rect", { x: f.x0 - 12, y: 0, width: 0, height: f.H }, clip);
		const lines = node("g", { "clip-path": `url(#${id})` }, f.plot);
		const dots = node("g", {}, f.plot);
		const pops = [];
		o.series.forEach((s, si) => {
			const pts = o.xs.map((x, i) => [x, s.values[i]]).filter((p) => p[1] !== null && p[1] !== undefined);
			const attrs = {
				d: pts.map((p, i) => `${i ? "L" : "M"}${f.sx(p[0]).toFixed(1)},${f.sy(p[1]).toFixed(1)}`).join(""),
				stroke: s.color,
				"stroke-width": 2.4,
				fill: "none",
				"stroke-linejoin": "round",
			};
			if (s.dash) attrs["stroke-dasharray"] = "7 5";
			node("path", attrs, lines);
			pts.forEach(([x, v]) => {
				const c = node("circle", { cx: f.sx(x), cy: f.sy(v), r: 5.5, fill: s.color }, dots);
				tip(c, o.tipText(s, x, v));
				pops.push({ go: popIn(c, 5.5), delay: ((f.sx(x) - f.x0) / (f.x1 - f.x0)) * 1100 + si * 60 });
			});
		});
		const play = () => Promise.all([tween(1300, (t) => wipe.setAttribute("width", (f.x1 - f.x0 + 24) * t)), ...pops.map((p) => p.go(300, p.delay))]);
		return { f, play };
	}
	const seriesLegend = (series, compact) => series.map((s) => ({ type: s.dash ? "dash" : "line", marker: true, color: s.color, label: compact && s.short ? s.short : s.name }));
	const hline = (f, v, color, dash, width = 1.4) => {
		const a = { x1: f.x0, x2: f.x1, y1: f.sy(v), y2: f.sy(v), stroke: color, "stroke-width": width };
		if (dash) a["stroke-dasharray"] = dash;
		return node("line", a, f.grid);
	};

	// Fig. 11 — 400 user-level A/B tests vs. the true rollout effect
	CHARTS.switchHist = (host, { compact }) => {
		const d = D.switchHist;
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 400,
			m: compact ? { t: 44, r: 14, b: 32, l: 34 } : { t: 48, r: 20, b: 66, l: 58 },
			x: [2, 18],
			y: [0, 48],
			xTicks: [2, 4, 6, 8, 10, 12, 14, 16, 18],
			yTicks: [0, 10, 20, 30, 40],
			title: compact ? "A user-level test vs. the true effect" : "A user-level test reports the demand lift, not what a rollout delivers",
			xTitle: "Estimated lift in completed rides (%)",
			yTitle: "Simulated experiments",
		});
		const bars = [];
		d.counts.forEach((n, i) => {
			if (!n) return;
			const a = d.start + i * d.width;
			const b = a + d.width;
			const r = node("rect", { x: f.sx(a) + 0.6, width: Math.max(1, f.sx(b) - f.sx(a) - 1.2), y: f.y0, height: 0, fill: C.gray }, f.plot);
			tip(r, `Estimated lift ${a.toFixed(2)}–${b.toFixed(2)}%: ${n} experiment${n > 1 ? "s" : ""}`);
			bars.push({ r, top: f.sy(n), delay: 450 + i * 30 });
		});
		const truth = [
			node("line", { x1: f.sx(d.truth), x2: f.sx(d.truth), y1: f.y1 - 4, y2: f.y0, stroke: C.primary, "stroke-width": 3 }, f.plot),
			...stack(f.plot, f.sx(d.truth) + 10, f.y1 + 16, ["True effect of rollout", "+4.6%"], 16, colored(C.primary)),
		];
		const demand = [node("line", { x1: f.sx(d.demand), x2: f.sx(d.demand), y1: f.y1 - 4, y2: f.y0, stroke: C.clay, "stroke-width": 2, "stroke-dasharray": "6 4" }, f.plot)];
		if (compact) {
			demand.push(...stack(f.plot, f.sx(d.demand) - 30, f.sy(30), ["Effect on", "requests, +15%"], 16, colored(C.clay, { "text-anchor": "end" })));
		} else {
			demand.push(...stack(f.plot, f.sx(d.demand) - 30, f.sy(25), ["Dashed line: the promotion's", "effect on requests, +15%"], 16, colored(C.clay, { "text-anchor": "end" })));
			demand.push(...stack(f.plot, f.sx(15.75), f.sy(44), ["400 user-level", "A/B tests"], 16, { class: "c-note" }));
		}
		const showTruth = fadeIn(truth, 400, 0);
		const showDemand = fadeIn(demand, 450, 0);
		return async () => {
			showTruth();
			await Promise.all(
				bars.map((b) =>
					tween(650, (t) => {
						const y = f.y0 + (b.top - f.y0) * t;
						b.r.setAttribute("y", y);
						b.r.setAttribute("height", f.y0 - y);
					}, b.delay)
				)
			);
			await showDemand();
		};
	};

	// Fig. 12 — user-level estimate vs. true effect across driver supply
	CHARTS.supply = (host, { compact }) => {
		const d = D.supply;
		const colors = { user: C.gray, true: C.primary };
		const series = d.series.map((s) => ({ ...s, color: colors[s.key] }));
		const { f, play } = seriesChart(host, compact, {
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 430,
			m: compact ? { t: 40, r: 18, b: 46, l: 34 } : { t: 44, r: 24, b: 86, l: 58 },
			xMap: catMap(d.xs),
			y: [0, 17],
			yTicks: [0, 2, 4, 6, 8, 10, 12, 14, 16],
			xs: d.xs,
			series,
			title: compact ? "Tighter supply, bigger overstatement" : "The tighter supply gets, the more a user-level test overstates",
			yTitle: "Lift in completed rides (%)",
			tipText: (s, x, v) => `${s.name}: +${v.toFixed(2)}% at driver supply ${x} (${d.served[d.xs.indexOf(x)]})`,
		});
		d.xs.forEach((x, i) => {
			node("line", { x1: f.sx(x), x2: f.sx(x), y1: f.y1, y2: f.y0, class: "c-grid" }, f.grid);
			label(f.grid, f.sx(x), f.y0 + 18, String(x), { "text-anchor": "middle" });
			label(f.grid, f.sx(x), f.y0 + 34, compact ? d.served[i].split(" ")[0] : `(${d.served[i]})`, { "text-anchor": "middle", class: "c-note" });
		});
		if (!compact) label(f.svg, (f.x0 + f.x1) / 2, f.y0 + 64, "Driver supply relative to demand (and share of requests served without a promotion)", { "text-anchor": "middle", class: "c-axis-title" });
		if (compact) legend(f.svg, seriesLegend(series, compact), f.x1 - 10, f.sy(5), { vertical: true, alignRight: true });
		else legend(f.svg, seriesLegend(series, compact), f.x0 + 18, f.sy(6.8), { vertical: true });
		return play;
	};

	// Fig. 13 — carryover bias by window length, with and without a washout
	CHARTS.carryover = (host, { compact }) => {
		const d = D.carryover;
		const colors = { none: C.clay, washout: C.primary };
		const series = d.series.map((s) => ({ ...s, color: colors[s.key] }));
		const { f, play } = seriesChart(host, compact, {
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 420,
			m: compact ? { t: 40, r: 16, b: 32, l: 40 } : { t: 44, r: 22, b: 66, l: 62 },
			xMap: catMap(d.xs),
			y: [-1.15, 3.0],
			xs: d.xs,
			xTicks: d.xs,
			yTicks: [-1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3],
			yFmt: (v) => minus(v.toFixed(1)),
			series,
			title: compact ? "A washout removes carryover bias" : "Short windows leak carryover; a washout removes it",
			xTitle: "Window length (minutes). A driver stays busy 22.7 minutes on average.",
			yTitle: "Bias in the lift estimate (pp)",
			tipText: (s, x, v) => `${s.name}, ${x}-minute windows: bias ${v > 0 ? "+" : ""}${minus(v.toFixed(2))} pp`,
			before: (fr) => hline(fr, 0, "#555a52"),
		});
		label(f.svg, f.x1 - 4, f.y1 + 16, `User-level A/B test: +${d.userLevel} pp (off the chart)`, { "text-anchor": "end", class: "c-note" });
		legend(f.svg, seriesLegend(series, compact), f.x1 - 10, f.sy(1.25), { vertical: true, alignRight: true });
		return play;
	};

	// Fig. 14 — noise of the lift estimate (log scale)
	CHARTS.noise = (host, { compact }) => {
		const d = D.noise;
		const lo = Math.log10(0.72);
		const hi = Math.log10(15.5);
		const look = { plain: [C.gray, "Plain comparison"], paired: [C.clay, "Paired windows"], adjusted: [C.primary, "Adjusted for demand"] };
		const series = d.series.map((s) => ({ ...s, color: look[s.key][0], short: look[s.key][1] }));
		const { f, play } = seriesChart(host, compact, {
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 420,
			m: compact ? { t: 40, r: 16, b: 32, l: 34 } : { t: 44, r: 22, b: 66, l: 58 },
			xMap: catMap(d.xs),
			yMap: (v) => (Math.log10(v) - lo) / (hi - lo),
			xs: d.xs,
			xTicks: d.xs,
			yTicks: [1, 2, 5, 10],
			series,
			title: compact ? "Adjusting for demand cuts noise 3–11×" : "Adjusting for expected demand cuts the noise 3 to 11 times",
			xTitle: "Window length (minutes)",
			yTitle: "Noise: SD of the lift estimate (pp, log scale)",
			tipText: (s, x, v) => `${s.name}, ${x}-minute windows: SD ${v.toFixed(2)} pp`,
		});
		legend(f.svg, seriesLegend(series, compact), f.x0 + 16, f.y1 + 18, { vertical: true });
		return play;
	};

	// Fig. 15 — false-positive rate with no real effect
	CHARTS.falsePos = (host, { compact }) => {
		const d = D.falsePos;
		const colors = { rse_c: C.clay, rand_c: C.primary, rse_p: C.clay, rand_p: C.primary };
		const series = d.series.map((s) => ({ ...s, color: colors[s.key] }));
		const { f, play } = seriesChart(host, compact, {
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 420,
			m: compact ? { t: 40, r: 16, b: 32, l: 34 } : { t: 44, r: 22, b: 66, l: 58 },
			xMap: catMap(d.xs),
			y: [3.5, 15.4],
			xs: d.xs,
			xTicks: d.xs,
			yTicks: [4, 6, 8, 10, 12, 14],
			series,
			title: compact ? "A randomization test keeps its 5% promise" : "A randomization test keeps its 5% promise; the usual tests do not",
			xTitle: "Window length (minutes)",
			yTitle: "False positives with no real effect (%)",
			tipText: (s, x, v) => `${s.name}, ${x}-minute windows: ${v.toFixed(1)}% false positives`,
			before: (fr) => {
				hline(fr, d.target, "#555a52", "2 3");
				label(fr.grid, fr.sx(d.xs[0]) + 6, fr.sy(d.target) - 8, "5% target", { class: "c-note" });
			},
		});
		legend(f.svg, seriesLegend(series, compact), f.x0 + 16, f.y1 + 18, { vertical: true });
		return play;
	};

	// Fig. 16 — power vs. true lift for 7, 14 and 28-day experiments
	CHARTS.powerCurve = (host, { compact }) => {
		const d = D.powerCurve;
		const colors = { d7: C.gray, d14: C.primary, d28: C.clay };
		const series = d.series.map((s) => ({ ...s, color: colors[s.key] }));
		const { f, play } = seriesChart(host, compact, {
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 420,
			m: compact ? { t: 40, r: 16, b: 32, l: 34 } : { t: 44, r: 22, b: 66, l: 58 },
			x: [0.7, 3.5],
			y: [4, 103],
			xs: d.xs,
			xTicks: [1, 1.5, 2, 2.5, 3, 3.5],
			xFmt: (v) => v.toFixed(1),
			yTicks: [20, 40, 60, 80, 100],
			series,
			title: compact ? "Small effects need long experiments" : "Small effects need long experiments: 2.4% in 14 days, 1.8% in 28",
			xTitle: "True lift in completed rides (%)",
			yTitle: "Power (%)",
			tipText: (s, x, v) => `${s.name}: ${v.toFixed(1)}% power at a true lift of ${x.toFixed(2)}%`,
			before: (fr) => {
				hline(fr, d.target, "#555a52", "2 3");
				label(fr.grid, fr.sx(0.9), fr.sy(d.target) - 8, "80% power", { class: "c-note" });
			},
		});
		legend(f.svg, seriesLegend(series, compact), f.x1 - 10, f.y0 - 62, { vertical: true, alignRight: true });
		return play;
	};

	// Paper Fig. 1 — subspace error vs. step, morphing through the three synthetic scenarios
	CHARTS.streamingPca = (host, { compact }) => {
		const d = D.streamingPca;
		const order = [
			["stationary", "Stationary"],
			["drift", "Gradual drift"],
			["abrupt", "Abrupt change"],
		];
		const look = [
			["oja_qr", "Oja-QR", "#5c5f58", 2],
			["oja_ns", "Oja-NS", C.gray, 2],
			["vr_qr", "VR-Oja-QR (ours)", C.primary, 3.2],
			["vr_ns", "VR-Oja-NS (ours)", C.clay, 1.5],
		];
		const f = frame(host, {
			compact,
			w: compact ? W_COMPACT : W_FULL,
			h: compact ? H_COMPACT : 420,
			m: compact ? { t: 44, r: 14, b: 32, l: 36 } : { t: 48, r: 20, b: 66, l: 58 },
			x: [0, 3000],
			y: [1.2, 4.6],
			xTicks: [0, 1000, 2000, 3000],
			yTicks: [1.5, 2.5, 3.5, 4.5],
			xFmt: fmtInt,
			yFmt: (v) => v.toFixed(1),
			title: "Subspace error, synthetic streams (p=500, k=10)",
			xTitle: "Step t",
			yTitle: "Subspace error (Frobenius norm)",
		});
		const id = `wipe-${uid()}`;
		const wipe = node("rect", { x: f.x0 - 12, y: 0, width: 0, height: f.H }, node("clipPath", { id }, node("defs", {}, f.svg)));
		const grp = node("g", { "clip-path": `url(#${id})` }, f.plot);
		const bands = look.map(([, , color]) => node("path", { fill: color, opacity: 0.16 }, grp));
		const lines = look.map(([, , color, w]) => node("path", { fill: "none", stroke: color, "stroke-width": w, "stroke-linejoin": "round" }, grp));
		const tips = lines.map((l) => node("title", {}, l));
		const lineD = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${f.sx(d.t[i]).toFixed(1)},${f.sy(v).toFixed(1)}`).join("");
		const bandD = (lo, hi) => {
			let s = lineD(hi);
			for (let i = d.t.length - 1; i >= 0; i--) s += `L${f.sx(d.t[i]).toFixed(1)},${f.sy(lo[i]).toFixed(1)}`;
			return `${s}Z`;
		};
		const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
		const render = (a, b, t) =>
			look.forEach(([key], i) => {
				const A = d.scenarios[a][key];
				const B = d.scenarios[b][key];
				lines[i].setAttribute("d", lineD(mix(A.mean, B.mean, t)));
				bands[i].setAttribute("d", bandD(mix(A.lo, B.lo, t), mix(A.hi, B.hi, t)));
			});
		const scenLabel = label(f.svg, f.x1 - 6, f.y1 + 18, "", { "text-anchor": "end", class: "c-value" });
		const gainLabel = label(f.svg, f.x1 - 6, f.y1 + 36, "", { "text-anchor": "end", class: "c-note" });
		const dots = order.map((_, i) => node("circle", { cx: f.x1 - 6 - (order.length - 1 - i) * 12, cy: f.y1 + 50, r: 3.5, fill: C.gray }, f.svg));
		let cur = 0;
		const setLabels = (k) => {
			const [key, name] = order[k];
			const s = d.scenarios[key];
			const base = s.oja_qr.mean[s.oja_qr.mean.length - 1];
			const ours = s.vr_qr.mean[s.vr_qr.mean.length - 1];
			scenLabel.textContent = name;
			gainLabel.textContent = `VR-Oja: \u2212${(((base - ours) / base) * 100).toFixed(1)}% final error vs. Oja-QR`;
			dots.forEach((c, i) => c.setAttribute("fill", i === k ? C.primary : "#d6d2c6"));
			look.forEach(([k2, n], i) => (tips[i].textContent = `${n}, ${name.toLowerCase()}: final error ${s[k2].mean[s[k2].mean.length - 1].toFixed(3)}`));
		};
		render(order[0][0], order[0][0], 0);
		setLabels(0);
		legend(f.svg, look.map(([, n, color]) => ({ type: "line", color, label: n })), f.x1 - 10, f.y1 + 76, { vertical: true, alignRight: true });
		return async () => {
			await tween(1600, (t) => wipe.setAttribute("width", (f.x1 - f.x0 + 24) * t));
			if (reduce) return;
			let visible = true;
			const io = new IntersectionObserver((entries) => (visible = entries.some((e) => e.isIntersecting)));
			io.observe(host);
			const loop = () =>
				setTimeout(async () => {
					if (!f.svg.isConnected) return io.disconnect();
					if (visible && !document.hidden) {
						const next = (cur + 1) % order.length;
						setLabels(next);
						await tween(900, (t) => render(order[cur][0], order[next][0], t));
						cur = next;
					}
					loop();
				}, 3200);
			loop();
		};
	};

	window.CHARTS = CHARTS;
})();
