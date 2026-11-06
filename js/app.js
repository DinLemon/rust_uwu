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

  // ---------- Главная ----------
  function viewHome() {
    setNav("home");
    document.title = T.docTitle;
    const n = nextLesson();
    const cont = S.last && byId[S.last] && !S.done[S.last] ? byId[S.last] : n;
    const started = doneCount() > 0 || S.last;
    let html = `<div class="wrap-wide">
      <section class="hero">
        <h1>${T.heroTitle}</h1>
        <p>${T.heroText}</p>
        <div class="hero-actions">
          ${cont ? `<a class="btn" href="#/l/${cont.id}">${started ? T.continue : T.startFirst}: ${esc(cont.title)}</a>` : `<a class="btn" href="#/review">${T.allDone}</a>`}
          ${doneCount() > 0 ? `<a class="btn btn-ghost" href="#/review">${T.reviewBtn}</a>` : ""}
        </div>
        <div class="stats">
          <span>${T.statLessons(doneCount(), lessons.length)}</span>
          <span>${T.statModules(COURSE.modules.length)}</span>
          <span>${T.statHours(Math.round(totalMin / 60))}</span>
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
      html += `<details class="module${d === ls.length ? " done" : ""}"${open ? " open" : ""}>
        <summary>
          <span class="mod-num">${d === ls.length ? "✓" : mi}</span>
          <span><span class="mod-title">${esc(m.title)}</span><br><span class="mod-sub">${esc(m.sub || "")}</span></span>
          <span class="mod-meter">${d}/${ls.length}<span class="bar"><i style="width:${pct}%"></i></span></span>
        </summary>
        <ul class="lessons">${ls.map((l) => `<li class="${S.done[l.id] ? "is-done" : ""}"><a href="#/l/${l.id}">
          <span class="tick">${S.done[l.id] ? "✓" : "○"}</span><span>${esc(l.title)}${l.practice ? ` <span class="tag">${T.practiceTag}</span>` : ""}</span><span class="mins">${l.min || 5} ${T.min}</span></a></li>`).join("")}</ul>
      </details>`;
    });
    html += `<p class="muted small" style="margin-top:1.5rem">${T.storageNote}</p></div>`;
    app.innerHTML = html;
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
    const breakTip = (doneCount() % 3 === 0) ? `<div class="break-box">${T.breakTip}</div>` : "";
    app.innerHTML = `<div class="wrap"><article class="card finish">
      <div class="big">${modDone && first ? T.moduleDone : T.lessonDone}</div>
      <p class="muted">${esc(T.finishSub(lesson.title, doneCount(), lessons.length))}</p>
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
    tips.forEach((x) => {
      wrap.insertAdjacentHTML("beforeend", `<div class="explain-err"><b>${x.code === "panic" ? T.panicTitle : T.errorTitle(x.code)}.</b> ${RK.inline(x.text)}</div>`);
    });
    box.className = "output " + (res.ok ? "ok" : "err");
    let html = "";
    if (res.stdout) html += `<span class="lbl">${T.outLabel}</span>${esc(res.stdout)}`;
    if (!res.ok && res.stderr) html += `${res.stdout ? "<br>" : ""}<span class="lbl">${T.compilerLabel}</span>${esc(res.stderr)}`;
    if (res.ok && !res.stdout) html += `<span class="lbl">${T.outLabel}</span><span class="muted">${T.noOutput}</span>`;
    box.innerHTML = html;
    wrap.appendChild(box);
    return wrap;
  }

  async function doRun(code, outEl, btn, opts) {
    btn.disabled = true; const label = btn.textContent; btn.textContent = T.running;
    outEl.replaceChildren(h(`<div class="output"><span class="lbl">${T.compiling}</span>${T.compilingText}</div>`));
    let res;
    try { res = await RK.runRust(code, opts); }
    catch (e) { res = { netError: e.name === "AbortError" ? T.netTimeout : String(e.message || e) }; }
    btn.disabled = false; btn.textContent = label;
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
    function check() {
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
      attempt(c); onDone && onDone(all);
    }
    bar.querySelector(".btn").onclick = check;
    bar.querySelector("[data-show]").onclick = () => {
      inputs.forEach((inp, i) => { inp.value = c.answers[i][0]; });
      check();
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
    function check() {
      const ok = chosen.every((x, k) => c.lines[k].trim() === x.t.trim());
      if (first) { stat(c.key, ok); first = false; }
      fb.className = "feedback " + (ok ? "good" : "bad");
      fb.innerHTML = ok ? `<b>${T.orderOk}</b> ` + (c.explain ? inline(c.explain) : "") :
        `<b>${T.orderBad}</b> ${T.orderBadText} ` + (c.hint ? inline(c.hint) : "");
      attempt(c); onDone && onDone(ok);
    }
    paint();
    const bar = h(`<div class="runbar" style="margin-top:.4rem"><button class="btn btn-quiet btn-sm">${T.showAnswer}</button></div>`);
    bar.firstChild.onclick = () => { chosen = c.lines.map((t, i) => ({ t, i })); left.length = 0; paint(); check(); };
    el.appendChild(bar);
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
        hints.insertAdjacentHTML("beforeend", `<div class="tip"><b>${T.hintN(shown + 1)}</b> ${inline(levels[shown])}</div>`);
        shown++; refreshHintBtn();
      } else if (c.solution) {
        hints.insertAdjacentHTML("beforeend", `<div class="note">${T.solution}</div><pre class="code"><code>${highlightRust(c.solution)}</code></pre>`);
        hintBtn.disabled = true; attempt(c);
      }
    };
    bar.querySelector("[data-reset]").onclick = () => { ed.set(c.code); ed.clear(); out.replaceChildren(); fb.replaceChildren(); };
    const runBtn = bar.querySelector("[data-run]");
    runBtn.onclick = async () => {
      fb.replaceChildren();
      const res = await doRun(ed.get(), out, runBtn, { tests: c.tests, expect: c.expect });
      attempt(c);
      if (res.netError) {
        if (c.expect != null) fb.innerHTML = `<div class="feedback bad">${T.cantCheck}<pre class="code" style="margin:.4rem 0 0"><code>${esc(c.expect)}</code></pre></div>`;
        return;
      }
      let ok = res.ok;
      if (ok && c.expect != null) ok = norm(res.stdout) === norm(c.expect);
      if (ok && c.mustContain) ok = c.mustContain.every((s) => ed.get().includes(s));
      stat(c.key, ok);
      if (ok) fb.innerHTML = `<div class="feedback good"><b>${T.gotIt}</b> ${c.explain ? inline(c.explain) : T.taskDone}</div>`;
      else if (res.ok && c.expect != null && norm(res.stdout) !== norm(c.expect)) fb.innerHTML = `<div class="feedback bad"><b>${T.wrongOut}</b> ${T.expected}<pre class="code" style="margin:.4rem 0 0"><code>${esc(c.expect)}</code></pre></div>`;
      else if (res.ok && c.mustContain) fb.innerHTML = `<div class="feedback bad"><b>${T.missing}</b> ${c.mustContain.map((s) => `<code>${esc(s)}</code>`).join(", ")}</div>`;
      else if (c.tests && !/error(\[E\d+\])?:/.test(res.stderr || "")) fb.innerHTML = `<div class="feedback bad"><b>${T.testsFailed}</b> ${inline(T.testsFailedText)}</div>`;
      else fb.innerHTML = `<div class="feedback bad"><b>${T.noCompile}</b> ${T.noCompileText}</div>`;
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

  function viewSettings() {
    setNav("settings");
    document.title = T.setTitle + T.titleSuffix;
    const st = S.settings;
    const seg = (name, opts, cur) => `<div class="seg" data-set="${name}">${opts.map(([v, t]) => `<button data-v="${v}" aria-pressed="${String(v) === String(cur)}">${t}</button>`).join("")}</div>`;
    app.innerHTML = `<div class="wrap"><h1>${T.setTitle}</h1>
      <div class="panel"><h3>${T.setLang}</h3>${seg("lang", [["ru", "Русский"], ["en", "English"]], st.lang)}</div>
      <div class="panel"><h3>${T.setTheme}</h3>${seg("theme", [["auto", T.themeAuto], ["light", T.themeLight], ["dark", T.themeDark]], st.theme)}</div>
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
      S.settings[name] = v; save(true); applySettings();
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
