// Rust с нуля / Rust from Zero — движок курса.
// Хэш-роутер, карточки, прогресс в localStorage, два языка.
(function () {
  "use strict";
  const RK = window.RK;
  const { esc, md, inline, highlightRust } = RK;
  const KEY = "rust-s-nulya:v1";
  const app = document.getElementById("app");

  // ---------- Хранилище ----------
  const defaultLang = () => (/^ru|^uk|^be|^kk/i.test(navigator.language || "") ? "ru" : "en");
  const blank = () => ({ done: {}, step: {}, last: null, stats: {}, code: {}, settings: { theme: "auto", fs: 18, motion: true, focus: false, deep: "closed", lang: defaultLang() } });
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = JSON.parse(raw);
      const b = blank();
      return Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}) });
    } catch (e) { return blank(); }
  }
  let saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* приватный режим */ } };
    if (now) write(); else saveTimer = setTimeout(write, 250);
  }
  window.addEventListener("storage", (e) => { if (e.key === KEY) { S = load(); applySettings(); indexCourse(); route(); } });

  // ---------- Язык ----------
  let T = RK.STR.ru;
  let COURSE, lessons = [], byId = {}, totalMin = 0;
  const code_key = (c) => c.key; // ключи кода и статистики одинаковы для обоих языков

  function indexCourse() {
    const lang = RK.STR[S.settings.lang] && window.COURSES[S.settings.lang] ? S.settings.lang : "ru";
    T = RK.STR[lang];
    COURSE = window.COURSES[lang];
    lessons = [];
    COURSE.modules.forEach((m, mi) => m.lessons.forEach((l, li) => {
      l.module = m; l.mi = mi; l.li = li; l.idx = lessons.length; lessons.push(l);
    }));
    byId = Object.fromEntries(lessons.map((l) => [l.id, l]));
    totalMin = lessons.reduce((a, l) => a + (l.min || 5), 0);
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = T[el.dataset.i18n]; });
    const lb = document.getElementById("lang-btn");
    if (lb) { lb.textContent = T.langBtn; lb.setAttribute("aria-label", T.langBtnLabel); lb.title = T.langBtnLabel; }
    L = null;
  }
  const doneCount = () => lessons.filter((l) => S.done[l.id]).length;
  const nextLesson = () => lessons.find((l) => !S.done[l.id]);

  function applySettings() {
    const r = document.documentElement;
    r.dataset.theme = S.settings.theme;
    r.style.setProperty("--fs", S.settings.fs + "px");
    document.body.classList.toggle("anim", !!S.settings.motion);
    document.body.classList.toggle("no-motion", !S.settings.motion);
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  function setNav(name) {
    document.querySelectorAll(".navlink").forEach((a) => {
      if (a.dataset.nav === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function h(html) { const d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }

  const foxHead = `<g class="fox-head" stroke="#713924" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <g class="fox-ear"><path d="M10 30 8 9q0-4 4-2l17 14Z" fill="#f99754"/><path d="m13 14 11 10-9 5Z" fill="#ffc2b2" stroke="none"/></g>
    <g class="fox-ear"><path d="M38 21 54 7q4-2 4 2l-2 21Z" fill="#f99754"/><path d="m52 14-11 10 9 5Z" fill="#ffc2b2" stroke="none"/></g>
    <path d="M12 31q6-13 21-13t21 13l9 8-8 3 4 4-10 3q-7 8-16 8t-16-8L7 46l4-4-8-3Z" fill="#f99754"/>
    <path d="M8 40q10-5 25 5 15-10 25-5l-6 4 4 2-9 2q-7 7-14 7t-14-7l-9-2 4-2Z" fill="#ffe8cd" stroke="none"/>
    <path d="M20 35q3-4 6 0m14 0q3-4 6 0m-17 9q2 3 4 0 2 3 4 0" fill="none"/><path d="m30 40 3-1 3 1-3 3Z" fill="#713924" stroke="none"/>
    <path d="m18 41 4 1m22 0 4-1" stroke="#da7770"/>
  </g>`;
  const crabArt = `<g stroke="#713924" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path class="crab-claws" d="M16 37C5 36 5 23 11 21l1 6 5-4q7 7-1 14Zm32 0c11-1 11-14 5-16l-1 6-5-4q-7 7 1 14Z" fill="#ff9d61"/>
    <path d="m20 46-6 5m9-3-4 6m25-8 6 5m-9-3 4 6" fill="none"/><ellipse cx="32" cy="38" rx="18" ry="13" fill="#ff9d61"/>
    <path d="M23 36q2-4 5 0m8 0q3-4 5 0m-13 5q2 3 4 0 2 3 4 0" fill="none"/>
  </g>`;
  const mascotArt = {
    hint: `<g transform="translate(16 0)">${foxHead}</g><path d="M73 12v12m-6-6h12" stroke="#b696d8" stroke-width="3" stroke-linecap="round"/>`,
    success: `<g transform="translate(0 2) scale(.87)">${foxHead}</g><g transform="translate(49 18) scale(.78)">${crabArt}</g>`,
    error: `<g transform="translate(16 0)">${foxHead}</g>`,
    run: `<g transform="translate(0 14) scale(.84)">${crabArt}</g>
      <path d="M52 15h34v29H52z" fill="#e8d5ff" stroke="#713924" stroke-width="2" stroke-linejoin="round"/>
      <path d="M50 44h38l5 9H45Z" fill="#b592d3" stroke="#713924" stroke-width="2" stroke-linejoin="round"/>
      <circle class="screen-led" cx="69" cy="29" r="4" fill="#43845e"/><rect x="55" y="47" width="15" height="3" rx="1.5" fill="#ffe8cd"/>
      <path class="key-claw" d="M44 44q0-7 6-8l1 4 4-3q5 6-2 10Z" fill="#ff9d61" stroke="#713924" stroke-width="2" stroke-linejoin="round"/>`,
    rest: `<g transform="translate(6 1) scale(.82)">${foxHead}</g>
      <path d="M46 53h43l-4 4H42Z" fill="#ad89d0" stroke="#713924" stroke-width="2" stroke-linejoin="round"/>
      <path class="laptop-lid" d="M49 52 54 27h34l-3 25Z" fill="#d8bce9" stroke="#713924" stroke-width="2" stroke-linejoin="round"/>`,
    paw: `<g fill="currentColor"><ellipse cx="35" cy="23" rx="6" ry="8" transform="rotate(-22 35 23)"/><ellipse cx="45" cy="16" rx="5.5" ry="8"/><ellipse cx="56" cy="18" rx="5.5" ry="8"/><ellipse cx="65" cy="26" rx="5.5" ry="7.5" transform="rotate(20 65 26)"/><path d="M35 40q7-11 14-11t14 11q5 12-6 12-4 0-8-3-5 3-9 3-10 0-5-12Z"/></g>`,
    bookmark: `<g transform="translate(2 2) scale(.8)">${foxHead}</g>
      <path d="M56 40q9-5 16 0 7-5 15 0v15q-8-4-15 0-7-4-16 0Z" fill="#ffe8cd" stroke="#713924" stroke-width="2" stroke-linejoin="round"/>
      <path class="ribbon" d="M67 25h10v17l-5-4-5 4Z" fill="#bc96db" stroke="#713924" stroke-width="2" stroke-linejoin="round"/>`,
    night: `<g transform="translate(0 3) scale(.83)">${foxHead}</g>
      <ellipse class="lamp-light" cx="74" cy="35" rx="20" ry="18" fill="#ffd881" opacity=".45"/>
      <path d="M74 28v24m-10 0h20" fill="none" stroke="#713924" stroke-width="3" stroke-linecap="round"/><path d="M64 17h20l6 15H58Z" fill="#ffe095" stroke="#713924" stroke-width="2" stroke-linejoin="round"/>`,
    day: `<g transform="translate(0 3) scale(.83)">${foxHead}</g>
      <rect x="55" y="13" width="37" height="39" rx="3" fill="#ffe6a5" stroke="#713924" stroke-width="2"/><path d="M73.5 15v35M57 32h33" stroke="#c09367" stroke-width="2"/>
      <path class="curtain-left" d="M55 13h18v36H55Z" fill="#bb98d8" stroke="#713924" stroke-width="2"/><path class="curtain-right" d="M74 13h18v36H74Z" fill="#bb98d8" stroke="#713924" stroke-width="2"/>`
  };
  const mascot = (kind) => `<svg class="mascot mascot-${kind}" viewBox="0 0 96 64" aria-hidden="true" focusable="false">${mascotArt[kind]}</svg>`;
  const mascotBubble = (kind, content) => `<div class="mascot-bubble">${mascot(kind)}<div>${content}</div></div>`;
  const freshStamps = new Set();

  // ---------- Главная ----------
  function viewHome() {
    setNav("home");
    document.title = T.docTitle;
    const n = nextLesson();
    const saved = S.last && byId[S.last] && !S.done[S.last] ? byId[S.last] : null;
    const cont = saved || n;
    const started = doneCount() > 0 || S.last;
    let html = `<div class="wrap-wide">
      <section class="hero">
        <div class="hero-grid">
          <div class="hero-copy">
            <span class="hero-kicker">Rust UwU</span>
            <h1>${T.heroTitle}</h1>
            <p>${T.heroText}</p>
            <div class="hero-actions">
              ${cont ? `<a class="btn" href="#/l/${cont.id}">${started ? T.continue : T.startFirst}: ${esc(cont.title)}</a>` : `<a class="btn" href="#/review">${T.allDone}</a>`}
              ${doneCount() > 0 ? `<a class="btn btn-ghost" href="#/review">${T.reviewBtn}</a>` : ""}
            </div>
            ${saved && S.step[saved.id] > 0 && T.mascotBookmark ? `<div class="resume-note">${mascotBubble("bookmark", esc(T.mascotBookmark))}</div>` : ""}
            <div class="stats">
              <span>${T.statLessons(doneCount(), lessons.length)}</span>
              <span>${T.statModules(COURSE.modules.length)}</span>
              <span>${T.statHours(Math.round(totalMin / 60))}</span>
            </div>
          </div>
          <div class="hero-art">
            <img src="assets/fox-mascot.webp" width="1374" height="1145" alt="">
          </div>
        </div>
      </section>
      <div class="how">
        <div><b>${T.how1t}</b>${T.how1}</div>
        <div><b>${T.how2t}</b>${T.how2}</div>
        <div><b>${T.how3t}</b>${T.how3}</div>
        <div><b>${T.how4t}</b>${T.how4}</div>
      </div>
      <h2>${T.mapTitle}</h2>`;
    COURSE.modules.forEach((m, mi) => {
      const ls = m.lessons;
      const d = ls.filter((l) => S.done[l.id]).length;
      const pct = Math.round((d / ls.length) * 100);
      const open = cont && cont.module === m;
      const complete = d === ls.length;
      html += `<details class="module${complete ? " done" : ""}${complete && freshStamps.has(mi) ? " stamp-new" : ""}"${open ? " open" : ""}>
        <summary>
          <span class="mod-num">${complete ? mascot("paw") : mi}</span>
          <span><span class="mod-title">${esc(m.title)}</span><br><span class="mod-sub">${esc(m.sub || "")}</span></span>
          <span class="mod-meter">${d}/${ls.length}<span class="bar"><i style="width:${pct}%"></i></span></span>
        </summary>
        <ul class="lessons">${ls.map((l) => `<li class="${S.done[l.id] ? "is-done" : ""}"><a href="#/l/${l.id}">
          <span class="tick">${S.done[l.id] ? "✓" : "○"}</span><span>${esc(l.title)}${l.practice ? ` <span class="tag">${T.practiceTag}</span>` : ""}</span><span class="mins">${l.min || 5} ${T.min}</span></a></li>`).join("")}</ul>
      </details>`;
    });
    html += `<p class="muted small" style="margin-top:1.5rem">${T.storageNote}</p></div>`;
    app.innerHTML = html;
    freshStamps.clear();
  }

  // ---------- Урок ----------
  let L = null; // состояние открытого урока

  function buildCards(lesson) {
    const cards = [];
    // «Вспомни»: один вопрос из предыдущих уроков (интервальное повторение).
    if (lesson.idx > 0 && !lesson.noWarmup) {
      const pool = [];
      for (let i = Math.max(0, lesson.idx - 6); i < lesson.idx; i++) {
        lessons[i].cards.forEach((c, ci) => { if (c.t === "quiz") pool.push({ c, key: lessons[i].id + ":" + ci }); });
      }
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        cards.push(Object.assign({}, pick.c, { warm: true, key: pick.key }));
      }
    }
    const own = [];
    lesson.cards.forEach((c, ci) => {
      if (c.t === "deep" && S.settings.deep === "hide") return;
      own.push(Object.assign({ key: lesson.id + ":" + ci }, c));
    });
    cards.push({ t: "goals", items: lesson.goals || [], plan: own, min: lesson.min });
    return cards.concat(own);
  }

  const kindName = (c) => (c.warm ? T.kind.warm : T.kind[c.t]);

  function viewLesson(id, stepArg) {
    const lesson = byId[id];
    if (!lesson) return viewHome();
    setNav("");
    if (!L || L.lesson !== lesson) {
      L = { lesson, cards: buildCards(lesson), attempted: {} };
    }
    let step = stepArg != null ? stepArg : (S.step[id] || 0);
    step = Math.max(0, Math.min(step, L.cards.length));
    S.last = id; S.step[id] = step; save();
    document.title = lesson.title + T.titleSuffix;
    if (step === L.cards.length) return renderFinish(lesson);

    const card = L.cards[step];
    const segs = L.cards.map((c, i) =>
      `<span class="${i < step ? "on" : i === step ? "cur" : ""}${c.t === "deep" ? " optional" : ""}" title="${i + 1}: ${esc(kindName(c))}"></span>`).join("");
    const nextCard = L.cards[step + 1];
    app.innerHTML = `<div class="wrap">
      <div class="lesson-head">
        <a class="btn btn-quiet btn-sm" href="#/" aria-label="${T.toMap}">←</a>
        <div><div class="crumbs">${esc(T.crumbs(lesson.mi, lesson.module.title, step + 1, L.cards.length))}</div>
        <h1>${esc(lesson.title)}</h1></div>
      </div>
      <div class="progress" aria-hidden="true">${segs}</div>
      <article class="card${card.t === "deep" ? " deep" : ""}" id="card" tabindex="-1"></article>
      <div class="lesson-nav">
        <button class="btn btn-quiet" id="prev" ${step === 0 ? "disabled" : ""}>${T.back}</button>
        <span class="hint" id="navhint">${nextCard ? esc(T.nextIs(kindName(nextCard))) : esc(T.lastStep)}</span>
        <button class="btn" id="next">${T.next}</button>
      </div></div>`;
    const el = document.getElementById("card");
    renderCard(card, el);
    const next = document.getElementById("next");
    const updateNext = () => {
      const interactive = ["quiz", "fill", "order", "task"].includes(card.t);
      const tried = L.attempted[step];
      next.textContent = interactive && !tried ? T.skipStep : step === L.cards.length - 1 ? T.finishLesson : T.next;
      next.classList.toggle("btn-ghost", interactive && !tried);
    };
    card._onAttempt = () => { L.attempted[step] = true; updateNext(); };
    updateNext();
    document.getElementById("prev").onclick = () => go(id, step - 1);
    next.onclick = () => go(id, step + 1);
    el.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function go(id, step) { location.hash = `#/l/${id}/${step}`; }

  function renderFinish(lesson) {
    const first = !S.done[lesson.id];
    S.done[lesson.id] = true; S.step[lesson.id] = 0; save(true);
    const recap = lesson.cards.filter((c) => c.t === "recap").flatMap((c) => c.items);
    const nl = lessons[lesson.idx + 1];
    const modDone = lesson.module.lessons.every((l) => S.done[l.id]);
    if (modDone && first) freshStamps.add(lesson.mi);
    const breakTip = (doneCount() % 3 === 0) ? `<div class="break-box">${mascotBubble("rest", T.breakTip)}</div>` : "";
    app.innerHTML = `<div class="wrap"><article class="card finish${first ? " finish-new" : ""}">
      <div class="finish-head">
        <img class="finish-mark" src="assets/crab.svg" width="54" height="54" alt="">
        <div>
          <div class="big">${modDone && first ? T.moduleDone : T.lessonDone}</div>
          <p class="muted">${esc(T.finishSub(lesson.title, doneCount(), lessons.length))}</p>
        </div>
      </div>
      ${recap.length ? `<h3>${T.remember}</h3><ul class="tldr">${recap.map((r) => `<li>${inline(r)}</li>`).join("")}</ul>` : ""}
      ${breakTip}
      <div class="row">
        ${nl ? `<a class="btn" href="#/l/${nl.id}/0">${esc(T.nextLesson(nl.title))}</a>` : `<a class="btn" href="#/review">${T.courseDone}</a>`}
        <a class="btn btn-quiet" href="#/">${T.toMapShort}</a>
      </div></article></div>`;
    L = null;
  }

  // ---------- Карточки ----------
  function renderCard(card, el) {
    const kind = card.t === "text" ? "" : (card.warm ? T.kindTitle.warm : T.kindTitle[card.t]);
    el.innerHTML = kind ? `<span class="card-kind">${kind}</span>` : "";
    if (card.title && card.t !== "deep") el.insertAdjacentHTML("beforeend", `<h2>${inline(card.title)}</h2>`);
    ({ text: cText, code: cCode, quiz: cQuiz, fill: cFill, order: cOrder, task: cTask, recap: cRecap, goals: cGoals, deep: cDeep })[card.t](card, el);
  }
  const attempt = (card) => card._onAttempt && card._onAttempt();

  function cText(c, el) { el.insertAdjacentHTML("beforeend", md(c.md)); }

  function cGoals(c, el) {
    const counts = {};
    c.plan.forEach((x) => { if (x.t !== "recap") counts[x.t] = (counts[x.t] || 0) + 1; });
    const parts = Object.keys(T.planParts).filter((k) => counts[k]).map((k) => `${T.planParts[k]} × ${counts[k]}`).join(", ");
    el.insertAdjacentHTML("beforeend", `${c.items.length ? `<ul class="tldr">${c.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>` : ""}
      <p class="plan">${esc(T.planLine(c.plan.length + 1, parts, c.min || 5))}</p>
      <p class="muted small">${T.planEnd}</p>`);
  }

  function cRecap(c, el) {
    el.insertAdjacentHTML("beforeend", `<ul class="tldr">${c.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
  }

  function cDeep(c, el) {
    const open = S.settings.deep === "open";
    el.insertAdjacentHTML("beforeend", `<p class="muted small">${T.deepNote}</p>
      <details class="deep-body"${open ? " open" : ""}><summary><span class="deep-title">${inline(c.title || T.kindTitle.deep)}</span> <span class="deep-toggle">${open ? T.deepClose : T.deepOpen}</span></summary>
      <div class="deep-content">${md(c.md || "")}</div></details>`);
    const d = el.querySelector("details");
    d.addEventListener("toggle", () => { d.querySelector(".deep-toggle").textContent = d.open ? T.deepClose : T.deepOpen; });
    if (c.code) {
      const inner = el.querySelector(".deep-content");
      const sub = Object.assign({}, c, { md: null, after: null });
      cCode(sub, inner);
    }
  }

  // Редактор: прозрачная textarea поверх подсвеченного <pre>.
  function makeEditor(code, storeKey, onChange) {
    const wrap = h(`<div class="editor"><pre aria-hidden="true"><code></code></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${T.editorLabel}" title="${T.runHint}"></textarea></div>`);
    const ta = wrap.querySelector("textarea"), pre = wrap.querySelector("pre"), out = pre.firstChild;
    const sk = storeKey ? storeKey + "@" + S.settings.lang : null;
    ta.value = (sk && S.code[sk] != null) ? S.code[sk] : code;
    const paint = () => {
      out.innerHTML = highlightRust(ta.value) + "\n";
      const lines = ta.value.split("\n").length;
      wrap.style.height = `calc(${lines * 1.55}em + 1.7rem + 14px)`;
    };
    ta.addEventListener("input", () => {
      paint();
      if (sk) { S.code[sk] = ta.value; save(); }
      onChange && onChange(ta.value);
    });
    ta.addEventListener("scroll", () => { pre.scrollLeft = ta.scrollLeft; pre.scrollTop = ta.scrollTop; });
    ta.addEventListener("keydown", (e) => {
      const { selectionStart: s, selectionEnd: en, value: v } = ta;
      if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        ta.setRangeText("    ", s, en, "end"); ta.dispatchEvent(new Event("input"));
      } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        const lineStart = v.lastIndexOf("\n", s - 1) + 1;
        let indent = v.slice(lineStart, s).match(/^\s*/)[0];
        if (/[{(\[]\s*$/.test(v.slice(lineStart, s))) indent += "    ";
        ta.setRangeText("\n" + indent, s, en, "end"); ta.dispatchEvent(new Event("input"));
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const box = wrap.parentElement;
        const run = box && box.querySelector("[data-run], [data-runcode]");
        run && !run.disabled && run.click();
      } else if (e.key === "Escape") {
        ta.blur();
      }
    });
    paint();
    return {
      el: wrap, get: () => ta.value,
      set: (v) => { ta.value = v; ta.dispatchEvent(new Event("input")); },
      clear: () => { if (sk) { delete S.code[sk]; save(); } }, ta,
    };
  }

  const hasCompileError = (stderr) => /^error(?:\[E\d+\])?:(?!\s*(?:test failed\b|doctest failed\b|process didn't exit\b))/m.test(stderr || "");

  function outputBox(res, expectNote) {
    const box = document.createElement("div");
    if (!res) return box;
    if (res.netError) {
      box.className = "output err";
      box.innerHTML = `<span class="lbl">${T.netFail}</span>${esc(res.netError)}
        <div class="explain-err">${T.netHelp(expectNote)}</div>`;
      return box;
    }
    const wrap = document.createElement("div");
    wrap.className = "out-wrap";
    const tips = !res.ok && res.stderr ? RK.explainErrors(res.stderr, S.settings.lang) : [];
    const compileError = !res.ok && hasCompileError(res.stderr);
    const explanations = tips.map((x) => `<p class="compiler-tip"><b>${x.code === "panic" ? T.panicTitle : T.errorTitle(x.code)}.</b> ${RK.inline(x.text)}</p>`).join("");
    box.className = "output " + (res.ok ? "ok" : "err");
    let html = "";
    if (res.stdout) html += `<span class="lbl">${T.outLabel}</span>${esc(res.stdout)}`;
    if (!res.ok && res.stderr) html += `${res.stdout ? "<br>" : ""}<span class="lbl">${T.compilerLabel}</span>${esc(res.stderr)}`;
    if (res.ok && !res.stdout) html += `<span class="lbl">${T.outLabel}</span><span class="muted">${T.noOutput}</span>`;
    box.innerHTML = html;
    wrap.appendChild(box);
    if (compileError || explanations) {
      const content = compileError ? mascotBubble("error", explanations || esc(T.noCompileText)) : explanations;
      wrap.insertAdjacentHTML(compileError ? "beforeend" : "afterbegin", `<div class="explain-err">${content}</div>`);
    }
    return wrap;
  }

  async function doRun(code, outEl, btn, opts) {
    btn.disabled = true; const label = btn.textContent; btn.textContent = T.running;
    const running = h(`<div class="output" role="status">${mascotBubble("run", `<span class="lbl">${T.compiling}</span>${T.compilingText}`)}</div>`);
    outEl.replaceChildren(running);
    let res;
    try { res = await RK.runRust(code, opts); }
    catch (e) { res = { netError: e.name === "AbortError" ? T.netTimeout : String(e.message || e) }; }
    btn.disabled = false; btn.textContent = label;
    if (!outEl.isConnected || outEl.firstChild !== running) return null;
    outEl.replaceChildren(outputBox(res, opts && opts.expect));
    return res;
  }

  function cCode(c, el) {
    if (c.md) el.insertAdjacentHTML("beforeend", md(c.md));
    const holder = document.createElement("div");
    el.appendChild(holder);
    const ed = makeEditor(c.code, c.key);
    holder.appendChild(ed.el);
    const bar = h(`<div class="runbar">
      <button class="btn btn-sm" data-runcode>${T.run}</button>
      <button class="btn btn-quiet btn-sm" data-reset>${T.reset}</button>
      ${c.out != null ? `<button class="btn btn-quiet btn-sm" data-out>${T.whatOut}</button>` : ""}
      <a class="btn btn-quiet btn-sm" target="_blank" rel="noopener" data-pg>${T.openPg}</a></div>`);
    holder.appendChild(bar);
    const out = document.createElement("div"); holder.appendChild(out);
    const runBtn = bar.querySelector("[data-runcode]");
    runBtn.onclick = () => doRun(ed.get(), out, runBtn, { tests: c.tests, expect: c.out });
    bar.querySelector("[data-reset]").onclick = () => { ed.set(c.code); ed.clear(); out.replaceChildren(); };
    const pg = bar.querySelector("[data-pg]");
    pg.onmouseenter = pg.onfocus = () => { pg.href = RK.playgroundUrl(ed.get()); };
    pg.href = RK.playgroundUrl(ed.get());
    if (c.out != null) bar.querySelector("[data-out]").onclick = () => {
      out.replaceChildren(h(`<div class="output"><span class="lbl">${T.expectedOut}</span>${esc(c.out) || `<span class="muted">${T.nothing}</span>`}</div>`));
    };
    if (c.after) el.insertAdjacentHTML("beforeend", md(c.after));
  }

  function stat(key, right) {
    const s = S.stats[key] || (S.stats[key] = { r: 0, w: 0 });
    right ? s.r++ : s.w++; save();
  }

  function cQuiz(c, el, onDone) {
    if (c.md) el.insertAdjacentHTML("beforeend", md(c.md));
    const box = h(`<div class="options" role="group" aria-label="${T.options}"></div>`);
    const fb = document.createElement("div");
    fb.setAttribute("aria-live", "polite");
    let first = true;
    c.options.forEach((o, i) => {
      const b = h(`<button class="opt"><span class="letter">${T.letters[i]}</span><span>${inline(o)}</span></button>`);
      b.onclick = () => {
        const right = i === c.answer;
        if (first) { stat(c.key, right); first = false; }
        b.classList.add(right ? "right" : "wrong");
        const why = Array.isArray(c.why) ? c.why[i] : null;
        fb.className = "feedback " + (right ? "good" : "bad");
        fb.innerHTML = `<b>${right ? T.right : T.notQuite}</b> ` +
          (why ? inline(why) : right ? (c.explain ? inline(c.explain) : "") : T.tryOther);
        if (right) {
          box.querySelectorAll(".opt").forEach((x) => (x.disabled = true));
          if (c.explain && why) fb.innerHTML += "<br>" + inline(c.explain);
          fb.innerHTML = mascotBubble("success", fb.innerHTML);
        } else b.disabled = true;
        attempt(c); onDone && onDone(right);
      };
      box.appendChild(b);
    });
    el.appendChild(box); el.appendChild(fb);
  }

  function norm(s) { return String(s).trim().replace(/\s+/g, " "); }

  function cFill(c, el, onDone) {
    if (c.md) el.insertAdjacentHTML("beforeend", md(c.md));
    const parts = c.code.split("___");
    const pre = document.createElement("pre"); pre.className = "code fill-code";
    const code = document.createElement("code"); pre.appendChild(code);
    const inputs = [];
    parts.forEach((p, i) => {
      code.insertAdjacentHTML("beforeend", highlightRust(p));
      if (i < parts.length - 1) {
        const inp = document.createElement("input");
        inp.setAttribute("aria-label", T.blank(i + 1));
        inp.autocapitalize = "off"; inp.spellcheck = false;
        const longest = Math.max(...c.answers[i].map((a) => a.length));
        inp.style.width = Math.max(4, longest + 2) + "ch";
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
        inputs.push(inp); code.appendChild(inp);
      }
    });
    el.appendChild(pre);
    const bar = h(`<div class="runbar"><button class="btn btn-sm">${T.check}</button><button class="btn btn-quiet btn-sm" data-show>${T.showAnswer}</button></div>`);
    const fb = document.createElement("div");
    fb.setAttribute("aria-live", "polite");
    el.appendChild(bar); el.appendChild(fb);
    let first = true;
    function check(revealed = false) {
      let all = true;
      inputs.forEach((inp, i) => {
        const ok = c.answers[i].some((a) => norm(a) === norm(inp.value));
        inp.classList.toggle("right", ok); inp.classList.toggle("wrong", !ok);
        all = all && ok;
      });
      if (first) { stat(c.key, all); first = false; }
      fb.className = "feedback " + (all ? "good" : "bad");
      fb.innerHTML = all ? `<b>${T.right}</b> ` + (c.explain ? inline(c.explain) : "") :
        `<b>${T.notYet}</b> ${T.fixRed} ` + (c.hint ? inline(c.hint) : "");
      if (all && !revealed) fb.innerHTML = mascotBubble("success", fb.innerHTML);
      attempt(c); onDone && onDone(all);
    }
    bar.querySelector(".btn").onclick = () => check();
    bar.querySelector("[data-show]").onclick = () => {
      inputs.forEach((inp, i) => { inp.value = c.answers[i][0]; });
      check(true);
    };
  }

  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    if (r.length > 1 && r.every((x, i) => x === a[i])) return shuffle(a);
    return r;
  }

  function cOrder(c, el, onDone) {
    if (c.md) el.insertAdjacentHTML("beforeend", md(c.md));
    el.insertAdjacentHTML("beforeend", `<p class="muted small">${T.orderHelp}</p>`);
    const built = h(`<pre class="code" style="min-height:3rem"><code></code></pre>`);
    const pool = h(`<div class="options"></div>`);
    const fb = document.createElement("div");
    fb.setAttribute("aria-live", "polite");
    el.appendChild(built); el.appendChild(pool); el.appendChild(fb);
    let chosen = [];
    const left = shuffle(c.lines.map((t, i) => ({ t, i })));
    let first = true;
    function paint() {
      const code = built.firstChild;
      code.innerHTML = chosen.length ? "" : `<span class="tok-com">${esc(T.orderEmpty)}</span>`;
      chosen.forEach((x, k) => {
        const s = document.createElement("span");
        s.style.cursor = "pointer"; s.title = T.removeLine;
        s.innerHTML = highlightRust(x.t) + "\n";
        s.onclick = () => { chosen.splice(k, 1); left.push(x); paint(); };
        code.appendChild(s);
      });
      pool.innerHTML = "";
      left.forEach((x, k) => {
        const b = h(`<button class="opt"><code>${esc(x.t.trim() ? x.t : T.emptyLine)}</code></button>`);
        b.onclick = () => { left.splice(k, 1); chosen.push(x); paint(); if (!left.length) check(); };
        pool.appendChild(b);
      });
    }
    function check(revealed = false) {
      const ok = chosen.every((x, k) => c.lines[k].trim() === x.t.trim());
      if (first) { stat(c.key, ok); first = false; }
      fb.className = "feedback " + (ok ? "good" : "bad");
      fb.innerHTML = ok ? `<b>${T.orderOk}</b> ` + (c.explain ? inline(c.explain) : "") :
        `<b>${T.orderBad}</b> ${T.orderBadText} ` + (c.hint ? inline(c.hint) : "");
      if (ok && !revealed) fb.innerHTML = mascotBubble("success", fb.innerHTML);
      attempt(c); onDone && onDone(ok);
    }
    paint();
    const bar = h(`<div class="runbar" style="margin-top:.4rem"><button class="btn btn-quiet btn-sm">${T.showAnswer}</button></div>`);
    bar.firstChild.onclick = () => { chosen = c.lines.map((t, i) => ({ t, i })); left.length = 0; paint(); check(true); };
    el.appendChild(bar);
  }


  const numericValue = "[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?";
  const bareNumber = new RegExp("^(?:" + numericValue + ")$");
  const resultNumber = new RegExp("^(?:[^:=\\n0-9]+[:=][ \\t]*)?(" + numericValue + ")$");
  const debugResult = /^(?:\[[\s\S]*\]|\([\s\S]*\)|(?:Some|Ok|Err)\([\s\S]*\)|[A-Z]\w*\s*\{[\s\S]*\})$/;

  function cleanOutput(text) {
    return text.replace(/\r\n?/g, "\n").trim().split("\n").map((line) => line.trim()).join("\n");
  }

  function debugTokens(text) {
    const tokens = text.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[+-]?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|[\p{L}\p{N}_]+|\S/gu) || [];
    return tokens.filter((token, i) => token !== "," || !["]", "}"].includes(tokens[i + 1]));
  }

  function matchesOutput(card, stdout) {
    const actual = cleanOutput(stdout);
    if (card.expectPattern) return new RegExp("^(?:" + card.expectPattern + ")$").test(actual);
    if (card.expect == null) return true;
    const expected = cleanOutput(card.expect);
    if (actual === expected) return true;
    if (card.outputCheck === "exact") return false;

    if (card.outputCheck === "number" || bareNumber.test(expected)) {
      const wanted = expected.match(resultNumber);
      const result = actual.match(resultNumber);
      if (!wanted || !result) return false;
      const a = Number(result[1]), b = Number(wanted[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return a === b || (!Number.isInteger(b) && Math.abs(a - b) <= 4 * Number.EPSILON * Math.abs(b));
    }

    const equalDebug = (a, b) => JSON.stringify(debugTokens(a)) === JSON.stringify(debugTokens(b));
    if (!expected.includes("\n") && debugResult.test(expected)) return equalDebug(actual, expected);

    const actualLines = actual.split("\n"), expectedLines = expected.split("\n");
    if (actualLines.length !== expectedLines.length) return norm(actual) === norm(expected);
    return expectedLines.every((line, i) => {
      if (debugResult.test(line)) return equalDebug(actualLines[i], line);
      return actualLines[i].replace(/[ \t]+/g, " ") === line.replace(/[ \t]+/g, " ");
    });
  }

  function cTask(c, el) {
    if (c.md) el.insertAdjacentHTML("beforeend", md(c.md));
    const holder = document.createElement("div");
    el.appendChild(holder);
    const ed = makeEditor(c.code, c.key);
    holder.appendChild(ed.el);
    const bar = h(`<div class="runbar">
      <button class="btn btn-sm" data-run>${T.runCheck}</button>
      <button class="btn btn-quiet btn-sm" data-hint>${T.hint}</button>
      <button class="btn btn-quiet btn-sm" data-reset>${T.startOver}</button></div>`);
    holder.appendChild(bar);
    const hints = document.createElement("div");
    hints.setAttribute("aria-live", "polite");
    const out = document.createElement("div");
    const fb = document.createElement("div");
    fb.setAttribute("aria-live", "polite");
    el.appendChild(hints); el.appendChild(out); el.appendChild(fb);
    const levels = (c.hints || []).slice();
    let shown = 0;
    const hintBtn = bar.querySelector("[data-hint]");
    const refreshHintBtn = () => {
      hintBtn.textContent = shown < levels.length ? (shown === 0 ? T.hint : T.moreHint) : T.showSolution;
    };
    refreshHintBtn();
    hintBtn.onclick = () => {
      if (shown < levels.length) {
        hints.insertAdjacentHTML("beforeend", `<div class="tip">${mascotBubble("hint", `<b>${T.hintN(shown + 1)}</b> ${inline(levels[shown])}`)}</div>`);
        shown++; refreshHintBtn();
      } else if (c.solution) {
        hints.insertAdjacentHTML("beforeend", `<div class="note">${T.solution}</div><pre class="code"><code>${highlightRust(c.solution)}</code></pre>`);
        hintBtn.disabled = true; attempt(c);
      }
    };
    bar.querySelector("[data-reset]").onclick = () => { ed.set(c.code); ed.clear(); out.replaceChildren(); fb.replaceChildren(); };
    const runBtn = bar.querySelector("[data-run]");
    const format = c.expectFormat?.replace(/\{\{(text|int)\}\}/g, (_, field) => field === "text" ? T.formatText : T.formatInt);
    const target = format || c.expect;
    const targetBlock = target == null ? "" : `<pre class="code" style="margin:.4rem 0 0"><code>${esc(target)}</code></pre>`;
    runBtn.onclick = async () => {
      fb.replaceChildren();
      const code = ed.get();
      const res = await doRun(code, out, runBtn, { tests: c.tests, expect: c.expect });
      if (!res) return;
      attempt(c);
      if (res.netError) {
        if (target != null) fb.innerHTML = `<div class="feedback bad">${T.cantCheck}${format ? " " + T.expectedFormat : ""}${targetBlock}</div>`;
        return;
      }
      const outputOk = res.ok && matchesOutput(c, res.stdout);
      const ok = outputOk && (!c.mustContain || c.mustContain.every((s) => code.includes(s)));
      stat(c.key, ok);
      if (ok) fb.innerHTML = `<div class="feedback good">${mascotBubble("success", `<b>${T.gotIt}</b> ${c.explain ? inline(c.explain) : T.taskDone}`)}</div>`;
      else if (res.ok && !outputOk) fb.innerHTML = `<div class="feedback bad"><b>${format ? T.wrongFormat : T.wrongOut}</b> ${format ? T.expectedFormat : T.expected}${targetBlock}</div>`;
      else if (res.ok && c.mustContain) fb.innerHTML = `<div class="feedback bad"><b>${T.missing}</b> ${c.mustContain.map((s) => `<code>${esc(s)}</code>`).join(", ")}</div>`;
      else if (hasCompileError(res.stderr)) fb.innerHTML = `<div class="feedback bad"><b>${T.noCompile}</b> ${T.noCompileText}</div>`;
      else if (c.tests) fb.innerHTML = `<div class="feedback bad"><b>${T.testsFailed}</b> ${inline(T.testsFailedText)}</div>`;
    };
  }

  // ---------- Повторение ----------
  function viewReview() {
    setNav("review");
    document.title = T.reviewTitle + T.titleSuffix;
    const pool = [];
    lessons.filter((l) => S.done[l.id]).forEach((l) => l.cards.forEach((c, ci) => {
      if (c.t === "quiz" || c.t === "fill") {
        const key = l.id + ":" + ci; const s = S.stats[key] || { r: 0, w: 0 };
        pool.push({ card: Object.assign({ key }, c), lesson: l, weight: 1 + s.w * 2 - Math.min(s.r, 2) * 0.3 + Math.random() });
      }
    }));
    if (!pool.length) {
      app.innerHTML = `<div class="wrap"><div class="card"><h2>${T.reviewTitle}</h2><p>${T.reviewEmpty}</p><a class="btn" href="#/">${T.toMap}</a></div></div>`;
      return;
    }
    pool.sort((a, b) => b.weight - a.weight);
    const set = pool.slice(0, 5);
    let i = 0, right = 0;
    const show = () => {
      if (i >= set.length) {
        app.innerHTML = `<div class="wrap"><article class="card finish"><div class="big">${T.reviewDone}</div>
          <p>${T.reviewScore(right, set.length)}</p>
          <div class="row"><button class="btn" id="again">${T.reviewMore}</button><a class="btn btn-quiet" href="#/">${T.toMapShort}</a></div></article></div>`;
        document.getElementById("again").onclick = viewReview;
        return;
      }
      const { card, lesson } = set[i];
      app.innerHTML = `<div class="wrap"><div class="lesson-head"><div><div class="crumbs">${T.reviewCrumbs(i + 1, set.length)}</div><h1>${esc(lesson.title)}</h1></div></div>
        <div class="progress">${set.map((_, k) => `<span class="${k < i ? "on" : k === i ? "cur" : ""}"></span>`).join("")}</div>
        <article class="card" id="card"></article>
        <div class="lesson-nav"><a class="btn btn-quiet" href="#/">${T.exit}</a><button class="btn" id="next">${T.next}</button></div></div>`;
      const el = document.getElementById("card");
      let firstTry = true;
      const fn = card.t === "quiz" ? cQuiz : cFill;
      el.innerHTML = `<span class="card-kind">${T.kindTitle.warm}</span>`;
      fn(card, el, (ok) => { if (firstTry) { if (ok) right++; firstTry = false; } });
      document.getElementById("next").onclick = () => { i++; show(); };
    };
    show();
  }

  // ---------- Шпаргалка ----------
  function viewCheat() {
    setNav("cheat");
    document.title = T.cheatTitle + T.titleSuffix;
    let html = `<div class="wrap cheat"><h1>${T.cheatTitle}</h1><p class="muted">${T.cheatText}</p>`;
    COURSE.modules.forEach((m, mi) => {
      html += `<h2 style="margin-top:1.6rem">${mi}. ${esc(m.title)}</h2>`;
      m.lessons.forEach((l) => {
        const items = l.cards.filter((c) => c.t === "recap").flatMap((c) => c.items);
        if (items.length) html += `<h3><a href="#/l/${l.id}/0">${esc(l.title)}</a></h3><ul class="tldr">${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`;
      });
    });
    app.innerHTML = html + `</div>`;
  }

  // ---------- Словарь ----------
  function viewGlossary() {
    setNav("glossary");
    document.title = T.glossTitle + T.titleSuffix;
    const lang = S.settings.lang;
    const terms = ((window.GLOSSARIES || {})[lang] || []).slice().sort((a, b) => a.term.localeCompare(b.term, lang));
    app.innerHTML = `<div class="wrap"><h1>${T.glossTitle}</h1><p class="muted">${T.glossText}</p>
      <input class="search" type="search" placeholder="${T.glossSearch}" aria-label="${T.glossSearch}"><dl class="gloss"></dl></div>`;
    const dl = app.querySelector("dl"), q = app.querySelector("input");
    const paint = () => {
      const s = q.value.trim().toLowerCase();
      dl.innerHTML = terms.filter((t) => !s || (t.term + " " + (t.en || "") + " " + t.def).toLowerCase().includes(s))
        .map((t) => `<dt>${esc(t.term)} ${t.en && t.en !== t.term ? `<small>${esc(t.en)}</small>` : ""}</dt><dd>${inline(t.def)}</dd>`).join("") || `<p class="muted">${T.glossNone}</p>`;
    };
    q.oninput = paint; paint();
  }

  // ---------- Настройки ----------
  function setLang(lang) {
    S.settings.lang = lang; save(true); indexCourse(); route();
  }

  function themeMascot(theme) {
    const dark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    return mascot(dark ? "night" : "day");
  }

  function viewSettings() {
    setNav("settings");
    document.title = T.setTitle + T.titleSuffix;
    const st = S.settings;
    const seg = (name, opts, cur) => `<div class="seg" data-set="${name}">${opts.map(([v, t]) => `<button data-v="${v}" aria-pressed="${String(v) === String(cur)}">${t}</button>`).join("")}</div>`;
    app.innerHTML = `<div class="wrap"><h1>${T.setTitle}</h1>
      <div class="panel"><h3>${T.setLang}</h3>${seg("lang", [["ru", "Русский"], ["en", "English"]], st.lang)}</div>
      <div class="panel theme-panel"><div><h3>${T.setTheme}</h3>${seg("theme", [["auto", T.themeAuto], ["light", T.themeLight], ["dark", T.themeDark]], st.theme)}</div>
        <div class="theme-mascot">${themeMascot(st.theme)}</div></div>
      <div class="panel"><h3>${T.setFont}</h3>${seg("fs", [[16, T.fs16], [18, T.fs18], [20, T.fs20], [23, T.fs23]], st.fs)}</div>
      <div class="panel"><h3>${T.setMotion}</h3>${seg("motion", [["true", T.on], ["false", T.off]], st.motion)}</div>
      <div class="panel"><h3>${T.setFocus}</h3><p class="small muted">${T.setFocusText}</p>${seg("focus", [["false", T.off], ["true", T.on]], st.focus)}</div>
      <div class="panel"><h3>${T.setDeep}</h3><p class="small muted">${T.setDeepText}</p>${seg("deep", [["closed", T.deepClosed], ["open", T.deepOpenOpt], ["hide", T.deepHide]], st.deep)}</div>
      <div class="panel"><h3>${T.setProgress}</h3>
        <p class="small muted">${T.setProgressText}</p>
        <div class="row"><button class="btn btn-sm" id="exp">${T.exportBtn}</button>
        <label class="btn btn-quiet btn-sm">${T.importBtn}<input type="file" accept=".json,application/json" id="imp" hidden></label>
        <button class="btn btn-quiet btn-sm" id="reset">${T.resetBtn}</button></div></div></div>`;
    app.querySelectorAll(".seg").forEach((g) => g.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      let v = b.dataset.v; const name = g.dataset.set;
      if (name === "lang") return setLang(v);
      if (name === "fs") v = +v; if (name === "motion" || name === "focus") v = v === "true";
      const themeChanged = name === "theme" && v !== st.theme;
      S.settings[name] = v; save(true); applySettings();
      if (themeChanged) {
        const art = app.querySelector(".theme-mascot");
        art.innerHTML = themeMascot(v);
        art.classList.add("is-new");
      }
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
    app.querySelector("#exp").onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rust-course-progress.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    app.querySelector("#imp").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!d || typeof d.done !== "object") throw new Error("bad");
        S = Object.assign(blank(), d, { settings: Object.assign(blank().settings, d.settings || {}) });
        save(true); applySettings(); indexCourse(); toast(T.imported); route();
      } catch (err) { toast(T.badFile); }
    };
    app.querySelector("#reset").onclick = () => {
      if (!confirm(T.resetConfirm)) return;
      const lang = S.settings.lang;
      S = blank(); S.settings.lang = lang; save(true); applySettings(); toast(T.resetDone); route();
    };
  }

  // ---------- Роутер ----------
  function route() {
    const p = location.hash.replace(/^#\/?/, "").split("/");
    const inLesson = p[0] === "l";
    document.body.classList.toggle("focus", inLesson && S.settings.focus);
    if (!inLesson) L = null;
    if (inLesson) viewLesson(p[1], p[2] != null && p[2] !== "" ? +p[2] : null);
    else if (p[0] === "review") viewReview();
    else if (p[0] === "glossary") viewGlossary();
    else if (p[0] === "cheat") viewCheat();
    else if (p[0] === "settings") viewSettings();
    else viewHome();
  }

  // Клавиатура: стрелки листают шаги (когда фокус не в поле ввода).
  document.addEventListener("keydown", (e) => {
    if (!location.hash.startsWith("#/l/") || e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^(INPUT|TEXTAREA|SELECT|SUMMARY)$/.test(document.activeElement.tagName)) return;
    if (e.key === "ArrowRight") { const b = document.getElementById("next"); b && b.click(); }
    if (e.key === "ArrowLeft") { const b = document.getElementById("prev"); b && !b.disabled && b.click(); }
  });

  const lb = document.getElementById("lang-btn");
  if (lb) lb.onclick = () => setLang(S.settings.lang === "ru" ? "en" : "ru");

  applySettings();
  indexCourse();
  window.addEventListener("hashchange", route);
  route();
})();
