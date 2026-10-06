/* =====================================================================
   WARBOX.TV — interações do site (sem bibliotecas)
   Cada módulo só roda se os elementos dele existirem na página.

    1. Utilidades               8. Parede de monitores e relógio
    2. Cabeçalho e menu         9. Manifesto e passos
    3. Revelação por rolagem   10. Preços contando
    4. Cabra digitando         11. FAQ animado
    5. WARBOX.FM               12. Carrossel, letreiro, chat, onda
    6. Seletor de plano        13. Time (vídeos sob demanda)
    7. Dock de assinatura      14. Corre Cabra!
   ===================================================================== */
(() => {
  "use strict";

  /* ---------- 1. Utilidades ---------- */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasIO = "IntersectionObserver" in window;
  const onVisible = (el, cb, opts) => {
    if (!hasIO) return cb(true);
    const o = new IntersectionObserver(([e]) => cb(e.isIntersecting), opts);
    o.observe(el);
    return o;
  };

  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach((w, i) => {
      const s = document.createElement("span");
      s.className = "w";
      s.style.setProperty("--i", i);
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return $$(".w", el);
  }

  /* ---------- 2. Cabeçalho e menu ---------- */
  const hdr = $("[data-hdr]");
  if (hdr) {
    const upd = () => hdr.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", upd, { passive: true });
    upd();
  }

  const menuBtn = $("[data-menu-btn]");
  const sheet = $("[data-menu]");
  if (menuBtn && sheet) {
    const setOpen = (open) => {
      sheet.hidden = !open;
      sheet.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      if (open) $("a", sheet)?.focus({ preventScroll: true });
    };
    menuBtn.addEventListener("click", () => setOpen(sheet.hidden));
    sheet.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sheet.hidden) { setOpen(false); menuBtn.focus(); }
    });
    window.matchMedia("(min-width: 1100px)").addEventListener("change", (m) => { if (m.matches) setOpen(false); });
  }

  // Chip "Ao vivo agora": no app real ele depende de /api/live/status.
  const IS_LIVE = true;
  $$("[data-live-chip]").forEach((c) => { if (!IS_LIVE) c.hidden = true; });

  /* ---------- 3. Revelação por rolagem ---------- */
  $$("[data-split]").forEach(splitWords);
  // escalonamento automático entre irmãos que entram juntos
  $$(".rv").forEach((el) => {
    if (el.style.getPropertyValue("--d")) return;
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("rv"));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty("--d", `${Math.min(i, 6) * 0.08}s`);
  });

  const revealables = $$(".rv, .a-title, .hero__title, .stage");
  if (!hasIO || reduceMotion) revealables.forEach((el) => el.classList.add("is-in"));
  else {
    // títulos com clip-path contam como invisíveis para o observer: observa o pai deles
    const targets = new Map();
    revealables.forEach((el) => {
      const t = el.classList.contains("a-title") ? el.parentElement : el;
      targets.set(t, [...(targets.get(t) || []), el]);
    });
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        targets.get(e.target).forEach((el) => el.classList.add("is-in"));
        ro.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
    targets.forEach((_, t) => ro.observe(t));
  }

  /* ---------- 4. Cabra digitando (destaques da copy) ----------
     Digita com ritmo natural (variação por letra, pausa em pontuação),
     segura a frase com o cursor piscando, apaga acelerando e passa
     para a próxima. As frases ficam empilhadas invisíveis para
     reservar a altura da maior: o layout nunca pula, nem no celular. */
  const typers = $$("[data-typer]");
  typers.forEach((typer, n) => {
    const lines = $$("[data-typer-lines] li", typer).map((li) => li.textContent.trim());
    const out = $(".typer__out", typer);
    const text = $("[data-typer-text]", typer);
    const caret = $(".caret", out);
    const goat = $("[data-goat]", typer);
    if (!lines.length || !out || !text) return;

    lines.forEach((l) => {
      const g = document.createElement("span");
      g.className = "typer__ghost";
      g.textContent = l;
      out.insertBefore(g, out.firstChild);
    });
    const live = document.createElement("span");
    live.className = "typer__live";
    out.appendChild(live);
    live.append(text, caret);

    let line = (n * 3) % lines.length; // instâncias diferentes começam em frases diferentes
    text.textContent = lines[line];
    typer.classList.add("is-idle");

    if (reduceMotion) {
      // sem digitação: troca a frase com um fade discreto
      setInterval(() => {
        line = (line + 1) % lines.length;
        text.textContent = lines[line];
      }, 6000);
      return;
    }

    let pos = lines[line].length;
    let phase = "hold";
    let timer = null;
    let visible = false;

    const talk = (on) => goat && goat.classList.toggle("is-talking", on);
    const idle = (on) => typer.classList.toggle("is-idle", on);
    const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(step, ms); };

    function step() {
      if (!visible || document.hidden) { timer = null; return; }
      const msg = lines[line];
      if (phase === "type") {
        pos++;
        text.textContent = msg.slice(0, pos);
        if (pos >= msg.length) { phase = "hold"; talk(false); idle(true); return schedule(2800 + msg.length * 18); }
        const ch = msg[pos - 1];
        let d = 34 + Math.random() * 34;
        if (/[.!?]/.test(ch)) d += 260;
        else if (/[,;:—]/.test(ch)) d += 140;
        else if (ch === " ") d += 18;
        talk(true);
        return schedule(d);
      }
      if (phase === "hold") { phase = "erase"; idle(false); return schedule(60); }
      if (phase === "erase") {
        const left = pos;
        pos = Math.max(0, pos - (left > 24 ? 2 : 1));
        text.textContent = msg.slice(0, pos);
        if (pos === 0) {
          phase = "type";
          line = (line + 1) % lines.length;
          idle(true);
          return schedule(420);
        }
        return schedule(14 + Math.max(0, 20 - (msg.length - pos)));
      }
    }

    let first = true;
    const resume = () => {
      if (timer || !visible || document.hidden) return;
      schedule(phase === "hold" ? (first ? 3600 : 1600) : 200);
      first = false;
    };
    onVisible(typer, (v) => { visible = v; if (v) resume(); else { clearTimeout(timer); timer = null; talk(false); } }, { threshold: 0.2 });
    document.addEventListener("visibilitychange", resume);
  });

  /* ---------- 5. WARBOX.FM ---------- */
  const EPISODES = [
    "Os Fera Neném #55 — Papo de Ferro", "Os Fera Neném #54", "Os Fera Neném #53", "Os Fera Neném #52",
    "Os Fera Neném #48", "Os Fera Neném #39", "Pauta Mole #36", "Pauta Mole #006",
    "Notas sobre Notas #108", "Notas sobre Notas #107", "Cagando e Andando", "Trincheira",
  ];
  $$("[data-fm]").forEach((fm) => {
    const now = $("[data-fm-now]", fm);
    const btn = $("[data-fm-play]", fm);
    const radio = fm.closest(".radio");
    let t;
    btn.addEventListener("click", () => {
      const on = !fm.classList.contains("is-on");
      fm.classList.toggle("is-on", on);
      radio && radio.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
      clearTimeout(t);
      if (!on) { now.textContent = "Rádio aleatória do acervo"; return; }
      now.textContent = "Sintonizando…";
      t = setTimeout(() => { now.textContent = EPISODES[Math.floor(Math.random() * EPISODES.length)] + " · entre pra ouvir"; }, 700);
    });
  });

  /* ---------- 6. Seletor de plano (/assinar) ---------- */
  const pick = $("[data-pick]");
  if (pick) {
    const cta = $("[data-pick-cta]");
    const label = $("[data-pick-label]");
    const panels = $$("[data-panel]");
    const fromUrl = new URLSearchParams(location.search).get("plano");
    const preset = fromUrl && $(`input[value="${CSS.escape(fromUrl)}"]`, pick);
    if (preset) preset.checked = true;
    const apply = (animate) => {
      const input = $("input:checked", pick);
      if (!input) return;
      label.textContent = input.dataset.cta;
      cta.classList.toggle("is-gold", input.value === "chefia");
      cta.classList.toggle("is-ghost", input.value === "coco");
      panels.forEach((p) => {
        const on = p.dataset.panel === input.value;
        p.hidden = !on;
        if (on && animate && !reduceMotion) { p.classList.remove("is-swap"); void p.offsetWidth; p.classList.add("is-swap"); }
      });
    };
    pick.addEventListener("change", () => apply(true));
    apply(false);
  }

  /* ---------- 7. Dock de assinatura (celular) ---------- */
  const dock = $("[data-dock]");
  if (dock && hasIO) {
    const blockers = $$("[data-dock-hide], .ftr");
    const seen = new Map();
    const update = () => {
      const blocked = blockers.some((b) => seen.get(b));
      dock.classList.toggle("is-on", window.scrollY > window.innerHeight * 0.7 && !blocked);
    };
    const o = new IntersectionObserver((entries) => { entries.forEach((e) => seen.set(e.target, e.isIntersecting)); update(); });
    blockers.forEach((b) => o.observe(b));
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---------- 8. Parede de monitores e relógio ---------- */
  const WALL_POOL = [
    ["ofn-55", "Os Fera Neném, episódio 55"], ["notas-ed-motta", "Notas sobre Notas, Ed Motta"],
    ["pm-36", "Pauta Mole, episódio 36"], ["ofn-54", "Os Fera Neném, episódio 54"],
    ["cagando-e-andando", "Cagando e Andando"], ["notas-108", "Notas sobre Notas, episódio 108"],
    ["ofn-53", "Os Fera Neném, episódio 53"], ["pm-006", "Pauta Mole, episódio 6"],
    ["ofn-52", "Os Fera Neném, episódio 52"], ["notas-107", "Notas sobre Notas, episódio 107"],
    ["ofn-48", "Os Fera Neném, episódio 48"], ["ofn-39", "Os Fera Neném, episódio 39"],
    ["ofn-36", "Os Fera Neném, episódio 36"], ["ofn-31", "Os Fera Neném, episódio 31"],
    ["ofn-30", "Os Fera Neném, episódio 30"], ["ofn-29", "Os Fera Neném, episódio 29"],
    ["ofn-28", "Os Fera Neném, episódio 28"], ["ofn-27", "Os Fera Neném, episódio 27"],
    ["ofn-14", "Os Fera Neném, episódio 14"],
  ];
  const wall = $("[data-wall]");
  if (wall && !reduceMotion) {
    const cells = $$(".tv", wall);
    const src = (k) => `/assets/episodios/${k}.webp`;
    const showing = () => new Set($$("img", wall).map((img) => img.getAttribute("src")));
    let preloaded = false;

    const noise = (cv) => {
      const ctx = cv.getContext("2d");
      const img = ctx.createImageData(cv.width, cv.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = Math.min(255, v + 20); img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    const tune = () => {
      if (!preloaded) { preloaded = true; WALL_POOL.forEach(([k]) => { new Image().src = src(k); }); }
      const cell = cells[Math.floor(Math.random() * cells.length)];
      const used = showing();
      const options = WALL_POOL.filter(([k]) => !used.has(src(k)) && k !== "ofn-55");
      if (!options.length) return;
      const [key, alt] = options[Math.floor(Math.random() * options.length)];
      let cv = $(".noise", cell);
      if (!cv) { cv = document.createElement("canvas"); cv.className = "noise"; cv.width = 64; cv.height = 36; cell.appendChild(cv); }
      cell.classList.add("is-tuning");
      let k = 0;
      const iv = setInterval(() => { noise(cv); if (++k > 5) clearInterval(iv); }, 45);
      setTimeout(() => { const img = $("img", cell); img.src = src(key); img.alt = alt; }, 140);
      setTimeout(() => cell.classList.remove("is-tuning"), 300);
    };
    let wt = null;
    onVisible(wall, (v) => {
      if (v && !wt) wt = setInterval(tune, 2600);
      else if (!v) { clearInterval(wt); wt = null; }
    });
  }

  const clock = $("[data-clock]");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
    const upd = () => { clock.textContent = "BRT " + fmt.format(new Date()); };
    upd(); setInterval(upd, 1000);
  }

  /* ---------- 9. Manifesto e passos acompanham a rolagem ---------- */
  const scrollers = [];
  const manifesto = $("[data-words]");
  if (manifesto) {
    const words = splitWords(manifesto);
    words.forEach((w) => { if (/independente|teimosia/i.test(w.textContent)) w.classList.add("hot"); });
    if (reduceMotion) words.forEach((w) => w.classList.add("lit"));
    else scrollers.push(() => {
      const r = manifesto.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("lit", i < n));
    });
  }
  const steps = $("[data-steps]");
  if (steps) {
    const items = $$(".step", steps);
    scrollers.push(() => {
      const r = steps.getBoundingClientRect();
      const mid = window.innerHeight * 0.55;
      const p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      steps.style.setProperty("--p", p.toFixed(3));
      items.forEach((it) => it.classList.toggle("is-active", it.getBoundingClientRect().top < mid));
    });
  }
  if (scrollers.length) {
    let ticking = false;
    const run = () => { ticking = false; scrollers.forEach((f) => f()); };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    window.addEventListener("resize", run);
    run();
  }

  /* ---------- 10. Preços contando ---------- */
  const fmtBRL = (v, d) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  $$("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const dec = Number(el.dataset.decimals || 0);
    if (!target || reduceMotion || !hasIO) return;
    const o = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      const t0 = performance.now() + 250, dur = 1100;
      el.textContent = fmtBRL(0, dec);
      const tick = (now) => {
        const p = Math.min(1, Math.max(0, (now - t0) / dur));
        el.textContent = fmtBRL(target * (1 - Math.pow(1 - p, 3)), dec);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    o.observe(el);
  });

  /* ---------- 11. FAQ: abre e fecha com altura animada ---------- */
  $$(".faq__item").forEach((d) => {
    const summary = $("summary", d);
    const body = $(".faq__a", d);
    if (!summary || !body || reduceMotion || !body.animate) return;
    let anim = null;
    summary.addEventListener("click", (e) => {
      e.preventDefault();
      if (anim) anim.cancel();
      const opening = !d.open;
      const start = d.open ? body.offsetHeight : 0;
      if (opening) d.open = true;
      const end = opening ? body.scrollHeight : 0;
      anim = body.animate(
        [{ height: `${start}px`, opacity: opening ? 0 : 1 }, { height: `${end}px`, opacity: opening ? 1 : 0 }],
        { duration: 380, easing: "cubic-bezier(.16, 1, .3, 1)" }
      );
      anim.onfinish = () => { anim = null; if (!opening) d.open = false; };
    });
  });

  /* ---------- 12. Carrossel, letreiro, chat e onda ---------- */
  $$("[data-carousel-nav]").forEach((nav) => {
    const track = $(`[data-carousel="${nav.dataset.carouselNav}"]`);
    if (!track) return;
    const [prev, next] = $$("button", nav);
    const step = () => (track.firstElementChild?.getBoundingClientRect().width || 280) * 2 + 36;
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) track.scrollBy({ left: step() * Number(b.dataset.dir), behavior: reduceMotion ? "auto" : "smooth" });
    });
    const upd = () => {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 4;
    };
    track.addEventListener("scroll", upd, { passive: true });
    window.addEventListener("resize", upd);
    upd();
  });

  $$(".marquee__track").forEach((t) => {
    [...t.children].forEach((c) => { const k = c.cloneNode(true); k.setAttribute("aria-hidden", "true"); t.appendChild(k); });
  });

  const chat = $("[data-chat]");
  if (chat && !reduceMotion) {
    let ct = null;
    const push = () => {
      const first = chat.firstElementChild;
      first.classList.remove("is-new");
      chat.appendChild(first);
      void first.offsetWidth;
      first.classList.add("is-new");
    };
    onVisible(chat, (v) => { if (v && !ct) ct = setInterval(push, 1600); else if (!v) { clearInterval(ct); ct = null; } });
  }

  $$("[data-wave]").forEach((w) => [...w.children].forEach((b, i) => {
    b.style.setProperty("--k", i);
    b.style.setProperty("--h", `${30 + Math.round(Math.abs(Math.sin(i * 1.7)) * 70)}%`);
  }));

  /* ---------- 13. Time: vídeos só carregam quando aparecem ---------- */
  $$(".mate__media video[data-src]").forEach((v) => {
    v.addEventListener("error", () => v.remove());
    if (reduceMotion) return;
    let loaded = false;
    onVisible(v, (vis) => {
      if (vis && !loaded) { loaded = true; v.src = v.dataset.src; }
      if (vis) v.play?.().catch(() => {});
      else v.pause?.();
    }, { rootMargin: "200px 0px" });
  });

  /* ---------- 14. Corre Cabra! ---------- */
  const canvas = $("[data-game]");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const GROUND = 214;
    const overlay = $("[data-game-overlay]");
    const titleEl = $("[data-game-title]");
    const startBtn = $("[data-game-start]");
    const scoreEl = $("[data-score]");
    const bestEl = $("[data-best]");

    const frames = ["/assets/cabra-a.svg", "/assets/cabra-b.svg"].map((s) => { const i = new Image(); i.src = s; return i; });

    let best = 0;
    try { best = Number(localStorage.getItem("corre-cabra-best")) || 0; } catch (e) { /* sem storage */ }
    bestEl.textContent = best;

    const state = { running: false, visible: false, looping: false, y: 0, vy: 0, speed: 6, score: 0, obs: [], nextGap: 300, t: 0, last: 0 };
    const G = 0.9, JUMP = -13.4;
    const GOAT = { x: 70, w: 52, h: 64 };
    const hills = Array.from({ length: 24 }, (_, i) => ({ x: i * 48, h: 20 + ((i * 37) % 30) }));
    const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 131) % W, y: (i * 53) % 120 }));

    const reset = () => Object.assign(state, { running: true, y: 0, vy: 0, speed: 6, score: 0, obs: [], nextGap: 320, t: 0 });
    function spawn() {
      const r = Math.random();
      if (r < .45) state.obs.push({ type: "sand", x: W + 10, w: 38, h: 28 });
      else if (r < .8) state.obs.push({ type: "wire", x: W + 10, w: 30, h: 40 });
      else state.obs.push({ type: "sand", x: W + 10, w: 64, h: 28 });
      const min = 240 + state.speed * 10, max = 480 + state.speed * 14;
      state.nextGap = min + Math.random() * (max - min);
    }
    const jump = () => { if (state.running && state.y === 0) state.vy = JUMP; };

    function drawScene(speed) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#02060C"); g.addColorStop(1, "#06121C");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(125,211,252,.5)";
      stars.forEach((s) => ctx.fillRect(s.x, s.y, 2, 2));
      ctx.fillStyle = "#0A1C2A";
      const off = (state.t * speed * 0.15) % 48;
      hills.forEach((h) => { const x = h.x - off; ctx.fillRect(x, GROUND - h.h, 40, h.h); ctx.fillRect(x + 8, GROUND - h.h - 8, 24, 8); });
      ctx.fillStyle = "#03080D"; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = "#0EA5E9"; ctx.fillRect(0, GROUND, W, 2);
      ctx.fillStyle = "rgba(14,165,233,.35)";
      const d = (state.t * speed) % 40;
      for (let x = -d; x < W; x += 40) ctx.fillRect(x, GROUND + 14, 18, 2);
      for (let x = -d * 1.3; x < W; x += 70) ctx.fillRect(x, GROUND + 30, 8, 2);
    }
    function drawObstacle(o) {
      const y = GROUND - o.h;
      if (o.type === "wire") {
        ctx.fillStyle = "#7C5A3A";
        ctx.fillRect(o.x, y, 5, o.h); ctx.fillRect(o.x + o.w - 5, y, 5, o.h);
        ctx.fillStyle = "#94A3B8";
        for (let k = 0; k < 3; k++) {
          const wy = y + 6 + k * 12;
          ctx.fillRect(o.x, wy, o.w, 2);
          for (let b = o.x + 4; b < o.x + o.w - 2; b += 7) ctx.fillRect(b, wy - 2, 2, 6);
        }
      } else {
        const bw = 19;
        for (let r = 0; r < 2; r++) {
          const ry = GROUND - (r + 1) * 14;
          const shift = r % 2 ? bw / 2 : 0;
          for (let bx = o.x + shift; bx + bw <= o.x + o.w + 1; bx += bw) {
            ctx.fillStyle = r % 2 ? "#7D6944" : "#6B5A3A";
            ctx.fillRect(bx, ry, bw - 2, 12);
            ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(bx, ry + 9, bw - 2, 3);
          }
        }
      }
    }
    function drawGoat() {
      const y = GROUND - GOAT.h - state.y;
      const onGround = state.y === 0;
      const bob = onGround ? (Math.floor(state.t / 6) % 2) * 2 : 0;
      const img = frames[onGround ? Math.abs(Math.floor(state.t / 8)) % 2 : 1];
      if (img.complete && img.naturalWidth) ctx.drawImage(img, GOAT.x, y - bob, GOAT.w, GOAT.h);
      else { ctx.fillStyle = "#E8A36A"; ctx.fillRect(GOAT.x, y, GOAT.w, GOAT.h); }
      ctx.fillStyle = "rgba(14,165,233,.25)";
      const sw = Math.max(16, 40 - state.y * 0.25);
      ctx.fillRect(GOAT.x + GOAT.w / 2 - sw / 2, GROUND + 3, sw, 3);
    }
    function hit(o) {
      const gx = GOAT.x + 12, gw = GOAT.w - 24;
      const gy = GROUND - GOAT.h - state.y + 18, gh = GOAT.h - 22;
      return gx < o.x + o.w - 2 && gx + gw > o.x + 2 && gy < GROUND && gy + gh > GROUND - o.h + 2;
    }
    function frame(now) {
      const dt = Math.max(0, Math.min(2.5, (now - (state.last || now)) / 16.67));
      state.last = now;
      if (state.running) {
        state.t += dt;
        state.speed = Math.min(14, 6 + state.t * 0.004);
        state.vy += G * dt;
        state.y -= state.vy * dt;
        if (state.y <= 0) { state.y = 0; state.vy = 0; }
        state.nextGap -= state.speed * dt;
        if (state.nextGap <= 0) spawn();
        state.obs.forEach((o) => { o.x -= state.speed * dt; });
        state.obs = state.obs.filter((o) => o.x + o.w > -20);
        state.score += state.speed * dt * 0.06;
        scoreEl.textContent = Math.floor(state.score);
        if (state.obs.some(hit)) gameOver();
      } else if (!reduceMotion) state.t += dt * 0.6;
      drawScene(state.running ? state.speed : 3);
      state.obs.forEach(drawObstacle);
      drawGoat();
      if (state.running || (state.visible && !reduceMotion)) requestAnimationFrame(frame);
      else state.looping = false;
    }
    const loop = () => { if (!state.looping) { state.looping = true; state.last = performance.now(); requestAnimationFrame(frame); } };

    function gameOver() {
      state.running = false;
      const s = Math.floor(state.score);
      if (s > best) {
        best = s; bestEl.textContent = best;
        try { localStorage.setItem("corre-cabra-best", String(best)); } catch (e) { /* sem storage */ }
        titleEl.textContent = `Novo recorde: ${s}!`;
      } else titleEl.textContent = `Abatido com ${s} pontos`;
      startBtn.textContent = "Jogar de novo";
      overlay.hidden = false;
      startBtn.focus({ preventScroll: true });
    }
    function startGame() { overlay.hidden = true; reset(); loop(); canvas.focus({ preventScroll: true }); }

    startBtn.addEventListener("click", startGame);
    canvas.tabIndex = 0;
    canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); state.running ? jump() : startGame(); });
    document.addEventListener("keydown", (e) => {
      if (!state.running) return;
      if (e.code === "Space" || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); jump(); }
    });
    onVisible(canvas, (v) => {
      state.visible = v;
      if (v) loop();
      else if (state.running) { state.running = false; titleEl.textContent = "Pausado"; startBtn.textContent = "Recomeçar"; overlay.hidden = false; }
    }, { threshold: 0.3 });
    frames[0].onload = () => frame(performance.now());
    drawScene(3); drawGoat();
  }

  const year = $("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
