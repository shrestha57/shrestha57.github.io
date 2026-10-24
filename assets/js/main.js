(() => {
	const toggle = document.querySelector(".nav-toggle");
	const nav = document.getElementById("site-nav");
	if (toggle && nav) {
		const setOpen = (open) => {
			toggle.setAttribute("aria-expanded", String(open));
			nav.classList.toggle("is-open", open);
		};
		toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
		nav.addEventListener("click", (event) => {
			if (event.target.closest("a")) setOpen(false);
		});
	}

	const onVisible = (el, fn, threshold = 0.3) => {
		if (!("IntersectionObserver" in window)) return fn();
		const io = new IntersectionObserver((entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			io.disconnect();
			fn();
		}, { threshold });
		io.observe(el);
	};

	const build = (host) => {
		const make = window.CHARTS && window.CHARTS[host.dataset.chart];
		return make ? make(host, { compact: host.hasAttribute("data-compact") }) : null;
	};
	document.querySelectorAll("[data-chart]").forEach((host) => {
		let play = build(host);
		onVisible(host, () => play && play());
		const replay = host.closest("figure")?.querySelector(".replay");
		if (replay) {
			replay.addEventListener("click", () => {
				play = build(host);
				if (play) play();
			});
		}
	});

	document.querySelectorAll("[data-demo]").forEach((demo) => {
		const buttons = demo.querySelectorAll("[data-view]");
		const show = (view) => {
			buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
			demo.querySelectorAll("[data-view-group]").forEach((el) => (el.hidden = el.dataset.viewGroup !== view));
			const fills = demo.querySelectorAll(`[data-view-group="${view}"] .demo-fill`);
			fills.forEach((fill) => (fill.style.width = "0"));
			void demo.offsetWidth;
			fills.forEach((fill) => (fill.style.width = `${fill.dataset.v}%`));
		};
		buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
		onVisible(demo, () => show(buttons[0].dataset.view));
	});

	document.querySelectorAll("[data-shortcut]").forEach((demo) => {
		const range = demo.querySelector('input[type="range"]');
		const chips = demo.querySelectorAll("[data-pct]");
		const caption = demo.querySelector(".demo-caption");
		const out = (k) => demo.querySelector(`[data-out="${k}"]`);
		const bar = (k) => demo.querySelector(`[data-bar="${k}"]`);
		const render = () => {
			const pct = Number(range.value);
			const s = pct / 100;
			// Two-road model from the case study: shortcut 15 + 40s, main road 35 - 10s.
			const tShort = 15 + 40 * s;
			const tMain = 35 - 10 * s;
			const avg = 35 - 30 * s + 50 * s * s;
			const diff = tMain - tShort;
			out("pct").textContent = `${pct}%`;
			[["main", tMain], ["short", tShort], ["avg", avg]].forEach(([k, t]) => {
				out(k).textContent = `${t.toFixed(1)} min`;
				bar(k).style.width = `${(t / 60) * 100}%`;
			});
			let msg;
			if (Math.abs(s - 0.4) < 0.015) {
				msg = "Both roads now take about 31 minutes, so nobody gains by switching. The average driver saves 4 minutes, not the 17 a small pilot showed.";
			} else if (diff > 0) {
				msg = `The shortcut still saves ${diff.toFixed(1)} minutes over the main road. ${s <= 0.1 ? "A small pilot would report exactly this number, and it would be right for the pilot." : "But the advantage shrinks as more drivers join."}`;
			} else {
				msg = `The shortcut is now ${(-diff).toFixed(1)} minutes slower than the main road, because too many drivers took it.${avg > 35 ? " The average driver is worse off than before the app (35 minutes)." : ""}`;
			}
			caption.textContent = msg;
			chips.forEach((c) => c.setAttribute("aria-pressed", String(Number(c.dataset.pct) === pct)));
		};
		range.addEventListener("input", render);
		chips.forEach((c) =>
			c.addEventListener("click", () => {
				range.value = c.dataset.pct;
				render();
			})
		);
		onVisible(demo, () => {
			render();
			setTimeout(() => demo.classList.add("is-live"), 950);
		});
	});

	document.querySelectorAll(".case-toggle").forEach((btn) => {
		const panel = document.getElementById(btn.getAttribute("aria-controls"));
		const label = btn.querySelector(".case-toggle-label");
		const closedText = label.textContent;
		panel.inert = true;
		btn.addEventListener("click", () => {
			const open = btn.getAttribute("aria-expanded") !== "true";
			btn.setAttribute("aria-expanded", String(open));
			btn.classList.remove("is-pulsing");
			panel.classList.toggle("is-open", open);
			panel.inert = !open;
			label.textContent = open ? "Show fewer case studies" : closedText;
			if (!open) btn.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	});
})();
