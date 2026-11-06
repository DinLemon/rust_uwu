// Rust с нуля — движок курса. Хэш-роутер, карточки, прогресс в localStorage.
(function () {
  "use strict";
  const RK = window.RK;
  const { esc, md, inline, highlightRust } = RK;
  const COURSE = window.COURSE;
  const KEY = "rust-s-nulya:v1";
  const app = document.getElementById("app");

  // ---------- Хранилище ----------
  const blank = () => ({ done: {}, step: {}, last: null, stats: {}, code: {}, settings: { theme: "auto", fs: 18, motion: true, focus: false } });
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
  window.addEventListener("storage", (e) => { if (e.key === KEY) { S = load(); applySettings(); } });

  function applySettings() {
    const r = document.documentElement;
    r.dataset.theme = S.settings.theme;
    r.style.setProperty("--fs", S.settings.fs + "px");
    document.body.classList.toggle("anim", !!S.settings.motion);
    document.body.classList.toggle("no-motion", !S.settings.motion);
  }

  // ---------- Индекс курса ----------
  const lessons = [];
  COURSE.modules.forEach((m, mi) => m.lessons.forEach((l, li) => {
    l.module = m; l.mi = mi; l.li = li; l.idx = lessons.length; lessons.push(l);
  }));
  const byId = Object.fromEntries(lessons.map((l) => [l.id, l]));
  const totalMin = lessons.reduce((a, l) => a + (l.min || 5), 0);
  const doneCount = () => lessons.filter((l) => S.done[l.id]).length;
  const nextLesson = () => lessons.find((l) => !S.done[l.id]);

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  function setNav(name) {
    document.querySelectorAll(".navlink").forEach((a) => a.toggleAttribute("aria-current", a.dataset.nav === name));
    document.querySelectorAll(".navlink[aria-current]").forEach((a) => a.setAttribute("aria-current", "page"));
  }
  function h(html) { const d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }

  // ---------- Главная ----------
  function viewHome() {
    setNav("home");
    document.title = "Rust с нуля — интерактивный курс";
    const n = nextLesson();
    const cont = S.last && byId[S.last] && !S.done[S.last] ? byId[S.last] : n;
    const started = doneCount() > 0 || S.last;
    let html = `<div class="wrap-wide">
      <section class="hero">
        <h1>Rust с нуля. Маленькими шагами.</h1>
        <p>Курс для тех, кто никогда не программировал. Короткие уроки по 5–10 минут. Один шаг — одна мысль. Код можно запускать прямо здесь.</p>
        <div class="hero-actions">
          ${cont ? `<a class="btn" href="#/l/${cont.id}">${started ? "Продолжить" : "Начать первый урок"}: ${esc(cont.title)}</a>` : `<a class="btn" href="#/review">Всё пройдено. Повторить?</a>`}
          ${doneCount() > 0 ? `<a class="btn btn-ghost" href="#/review">Повторение · 5 вопросов</a>` : ""}
        </div>
        <div class="stats">
          <span><b>${doneCount()}</b> из ${lessons.length} уроков</span>
          <span><b>${COURSE.modules.length}</b> модулей</span>
          <span>около <b>${Math.round(totalMin / 60)}</b> часов всего</span>
        </div>
      </section>
      <div class="how">
        <div><b>Один шаг за раз</b>Жми «Дальше», когда готов. Таймеров нет.</div>
        <div><b>Ошибаться можно</b>Пробуй сколько угодно раз. Подсказки — по кнопке.</div>
        <div><b>Устал — уходи</b>Прогресс сохраняется сам. Вернёшься на то же место.</div>
      </div>
      <h2>Карта курса</h2>`;
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
          <span class="tick">${S.done[l.id] ? "✓" : "○"}</span><span>${esc(l.title)}</span><span class="mins">${l.min || 5} мин</span></a></li>`).join("")}</ul>
      </details>`;
    });
    html += `<p class="muted small" style="margin-top:1.5rem">Прогресс хранится только в этом браузере. Его можно сохранить в файл в <a href="#/settings">настройках</a>.</p></div>`;
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
    if (lesson.goals && lesson.goals.length) cards.push({ t: "goals", items: lesson.goals });
    lesson.cards.forEach((c, ci) => cards.push(Object.assign({ key: lesson.id + ":" + ci }, c)));
    return cards;
  }

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
    document.title = lesson.title + " — Rust с нуля";
    if (step === L.cards.length) return renderFinish(lesson);

    const card = L.cards[step];
    const segs = L.cards.map((_, i) =>
      `<span class="${i < step ? "on" : i === step ? "cur" : ""}" title="Шаг ${i + 1}"></span>`).join("");
    app.innerHTML = `<div class="wrap">
      <div class="lesson-head">
        <a class="btn btn-quiet btn-sm" href="#/" aria-label="К карте курса">←</a>
        <div><div class="crumbs">Модуль ${lesson.mi} · ${esc(lesson.module.title)} · шаг ${step + 1} из ${L.cards.length}</div>
        <h1>${esc(lesson.title)}</h1></div>
      </div>
      <div class="progress" aria-hidden="true">${segs}</div>
      <article class="card" id="card" tabindex="-1"></article>
      <div class="lesson-nav">
        <button class="btn btn-quiet" id="prev" ${step === 0 ? "disabled" : ""}>← Назад</button>
        <span class="hint" id="navhint"></span>
        <button class="btn" id="next">Дальше →</button>
      </div></div>`;
    const el = document.getElementById("card");
    renderCard(card, el);
    const next = document.getElementById("next");
    const updateNext = () => {
      const interactive = ["quiz", "fill", "order", "task"].includes(card.t);
      const tried = L.attempted[step];
      next.textContent = interactive && !tried ? "Пропустить →" : step === L.cards.length - 1 ? "Закончить урок ✓" : "Дальше →";
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
    const breakTip = (doneCount() % 3 === 0) ? `<div class="break-box"><b>Хорошее место для перерыва.</b> Встань, попей воды, пройдись пару минут. Курс подождёт — прогресс сохранён.</div>` : "";
    app.innerHTML = `<div class="wrap"><article class="card finish">
      <div class="big">${modDone && first ? "Модуль пройден." : "Урок пройден."}</div>
      <p class="muted">${esc(lesson.title)} · ${doneCount()} из ${lessons.length} уроков курса</p>
      ${recap.length ? `<h3>Запомни</h3><ul class="tldr">${recap.map((r) => `<li>${inline(r)}</li>`).join("")}</ul>` : ""}
      ${breakTip}
      <div class="row">
        ${nl ? `<a class="btn" href="#/l/${nl.id}/0">Следующий: ${esc(nl.title)}</a>` : `<a class="btn" href="#/review">Курс пройден. Повторить вопросы</a>`}
        <a class="btn btn-quiet" href="#/">К карте</a>
      </div></article></div>`;
    L = null;
  }

  // ---------- Карточки ----------
  function renderCard(card, el) {
    const kind = { text: "", code: "Пример", quiz: card.warm ? "Вспомни" : "Вопрос", fill: "Заполни пропуски", order: "Собери программу", task: "Попробуй сам", recap: "Запомни", goals: "В этом уроке" }[card.t];
    el.innerHTML = kind ? `<span class="card-kind">${kind}</span>` : "";
    if (card.title) el.insertAdjacentHTML("beforeend", `<h2>${inline(card.title)}</h2>`);
    ({ text: cText, code: cCode, quiz: cQuiz, fill: cFill, order: cOrder, task: cTask, recap: cRecap, goals: cGoals })[card.t](card, el);
  }
  const attempt = (card) => card._onAttempt && card._onAttempt();

  function cText(c, el) { el.insertAdjacentHTML("beforeend", md(c.md)); }
  function cGoals(c, el) {
    el.insertAdjacentHTML("beforeend", `<ul class="tldr">${c.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>
      <p class="muted small">Жми «Дальше», когда будешь готов. Торопиться некуда.</p>`);
  }
  function cRecap(c, el) {
    el.insertAdjacentHTML("beforeend", `<ul class="tldr">${c.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
  }

  // Редактор: прозрачная textarea поверх подсвеченного <pre>.
  function makeEditor(code, storeKey, onChange) {
    const wrap = h(`<div class="editor"><pre aria-hidden="true"><code></code></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Редактор кода Rust"></textarea></div>`);
    const ta = wrap.querySelector("textarea"), pre = wrap.querySelector("pre"), out = pre.firstChild;
    ta.value = (storeKey && S.code[storeKey] != null) ? S.code[storeKey] : code;
    const paint = () => {
      out.innerHTML = highlightRust(ta.value) + "\n";
      const lines = ta.value.split("\n").length;
      wrap.style.height = `calc(${lines * 1.55}em + 1.7rem + 14px)`;
    };
    ta.addEventListener("input", () => {
      paint();
      if (storeKey) { S.code[storeKey] = ta.value; save(); }
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
        const card = wrap.closest(".card");
        const run = card && card.querySelector("[data-run], .runbar .btn");
        run && !run.disabled && run.click();
      } else if (e.key === "Escape") {
        ta.blur();
      }
    });
    paint();
    return { el: wrap, get: () => ta.value, set: (v) => { ta.value = v; ta.dispatchEvent(new Event("input")); }, ta };
  }

  function outputBox(res, expectNote) {
    const box = document.createElement("div");
    if (!res) return box;
    if (res.netError) {
      box.className = "output err";
      box.innerHTML = `<span class="lbl">Не получилось связаться с Rust Playground</span>${esc(res.netError)}
        <div class="explain-err">Похоже, нет интернета или сервер занят. Попробуй ещё раз через минуту${expectNote ? " или посмотри ожидаемый вывод ниже" : ""}.</div>`;
      return box;
    }
    const wrap = document.createElement("div");
    wrap.className = "out-wrap";
    const tips = !res.ok && res.stderr ? RK.explainErrors(res.stderr) : [];
    tips.forEach((x) => {
      wrap.insertAdjacentHTML("beforeend", `<div class="explain-err"><b>${x.code === "panic" ? "Паника" : "Ошибка " + x.code}.</b> ${RK.inline(x.text)}</div>`);
    });
    box.className = "output " + (res.ok ? "ok" : "err");
    let html = "";
    if (res.stdout) html += `<span class="lbl">Вывод программы</span>${esc(res.stdout)}`;
    if (!res.ok && res.stderr) html += `${res.stdout ? "<br>" : ""}<span class="lbl">Сообщение компилятора (оригинал)</span>${esc(res.stderr)}`;
    if (res.ok && !res.stdout) html += `<span class="lbl">Вывод программы</span><span class="muted">(программа ничего не напечатала)</span>`;
    box.innerHTML = html;
    wrap.appendChild(box);
    return wrap;
  }

  async function doRun(code, outEl, btn, opts) {
    btn.disabled = true; const label = btn.textContent; btn.textContent = "Запускаю…";
    outEl.replaceChildren(h(`<div class="output"><span class="lbl">Компилирую</span>Это занимает пару секунд…</div>`));
    let res;
    try { res = await RK.runRust(code, opts); }
    catch (e) { res = { netError: e.name === "AbortError" ? "Слишком долго нет ответа." : String(e.message || e) }; }
    btn.disabled = false; btn.textContent = label;
    outEl.replaceChildren(outputBox(res, opts && opts.expect));
    return res;
  }

  function cCode(c, el) {
    if (c.md) el.insertAdjacentHTML("beforeend", md(c.md));
    const ed = makeEditor(c.code, c.key);
    el.appendChild(ed.el);
    const bar = h(`<div class="runbar">
      <button class="btn btn-sm">▶ Запустить</button>
      <button class="btn btn-quiet btn-sm" data-reset>Вернуть как было</button>
      ${c.out != null ? `<button class="btn btn-quiet btn-sm" data-out>Что выведет?</button>` : ""}
      <a class="btn btn-quiet btn-sm" target="_blank" rel="noopener" data-pg>Открыть в Playground ↗</a></div>`);
    el.appendChild(bar);
    const out = document.createElement("div"); el.appendChild(out);
    bar.querySelector(".btn").onclick = () => doRun(ed.get(), out, bar.querySelector(".btn"), { tests: c.tests, expect: c.out });
    bar.querySelector("[data-reset]").onclick = () => { delete S.code[c.key]; save(); ed.set(c.code); delete S.code[c.key]; save(); out.replaceChildren(); };
    const pg = bar.querySelector("[data-pg]");
    pg.onmouseenter = pg.onfocus = () => { pg.href = RK.playgroundUrl(ed.get()); };
    pg.href = RK.playgroundUrl(ed.get());
    if (c.out != null) bar.querySelector("[data-out]").onclick = () => {
      out.replaceChildren(h(`<div class="output"><span class="lbl">Ожидаемый вывод (исходного кода)</span>${esc(c.out) || '<span class="muted">(ничего)</span>'}</div>`));
    };
    if (c.after) el.insertAdjacentHTML("beforeend", md(c.after));
  }

  function stat(key, right) {
    const s = S.stats[key] || (S.stats[key] = { r: 0, w: 0 });
    right ? s.r++ : s.w++; save();
  }

  function cQuiz(c, el, onDone) {
    if (c.md) el.insertAdjacentHTML("beforeend", md(c.md));
    if (c.code) el.insertAdjacentHTML("beforeend", `<pre class="code"><code>${highlightRust(c.code)}</code></pre>`);
    const box = h(`<div class="options" role="group" aria-label="Варианты ответа"></div>`);
    const fb = document.createElement("div");
    let first = true;
    c.options.forEach((o, i) => {
      const b = h(`<button class="opt"><span class="letter">${"АБВГДЕ"[i]}</span><span>${inline(o)}</span></button>`);
      b.onclick = () => {
        const right = i === c.answer;
        if (first) { stat(c.key, right); first = false; }
        b.classList.add(right ? "right" : "wrong");
        const why = Array.isArray(c.why) ? c.why[i] : null;
        fb.className = "feedback " + (right ? "good" : "bad");
        fb.innerHTML = (right ? "<b>Верно.</b> " : "<b>Не совсем.</b> ") +
          (why ? inline(why) : right ? (c.explain ? inline(c.explain) : "") : "Попробуй другой вариант.");
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
        inp.setAttribute("aria-label", "Пропуск " + (i + 1));
        inp.autocapitalize = "off"; inp.spellcheck = false;
        const longest = Math.max(...c.answers[i].map((a) => a.length));
        inp.style.width = Math.max(4, longest + 2) + "ch";
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
        inputs.push(inp); code.appendChild(inp);
      }
    });
    el.appendChild(pre);
    const bar = h(`<div class="runbar"><button class="btn btn-sm">Проверить</button><button class="btn btn-quiet btn-sm" data-show>Показать ответ</button></div>`);
    const fb = document.createElement("div");
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
      fb.innerHTML = all ? "<b>Верно.</b> " + (c.explain ? inline(c.explain) : "") :
        "<b>Пока нет.</b> Красные поля стоит поправить. " + (c.hint ? inline(c.hint) : "");
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
    el.insertAdjacentHTML("beforeend", `<p class="muted small">Нажимай на строки в правильном порядке. Ошибся — нажми на строку сверху, она вернётся вниз.</p>`);
    const built = h(`<pre class="code" style="min-height:3rem"><code></code></pre>`);
    const pool = h(`<div class="options"></div>`);
    const fb = document.createElement("div");
    el.appendChild(built); el.appendChild(pool); el.appendChild(fb);
    let chosen = [];
    const left = shuffle(c.lines.map((t, i) => ({ t, i })));
    let first = true;
    function paint() {
      const code = built.firstChild;
      code.innerHTML = chosen.length ? "" : '<span class="tok-com">// здесь появится программа</span>';
      chosen.forEach((x, k) => {
        const s = document.createElement("span");
        s.style.cursor = "pointer"; s.title = "Убрать строку";
        s.innerHTML = highlightRust(x.t) + "\n";
        s.onclick = () => { chosen.splice(k, 1); left.push(x); paint(); };
        code.appendChild(s);
      });
      pool.innerHTML = "";
      left.forEach((x, k) => {
        const b = h(`<button class="opt"><code>${esc(x.t.trim() ? x.t : "(пустая строка)")}</code></button>`);
        b.onclick = () => { left.splice(k, 1); chosen.push(x); paint(); if (!left.length) check(); };
        pool.appendChild(b);
      });
    }
    function check() {
      const ok = chosen.every((x, k) => c.lines[k].trim() === x.t.trim());
      if (first) { stat(c.key, ok); first = false; }
      fb.className = "feedback " + (ok ? "good" : "bad");
      fb.innerHTML = ok ? "<b>Собрано верно.</b> " + (c.explain ? inline(c.explain) : "") :
        "<b>Порядок не тот.</b> Нажми на строку в коде, чтобы вернуть её, и попробуй снова. " + (c.hint ? inline(c.hint) : "");
      attempt(c); onDone && onDone(ok);
    }
    paint();
    const bar = h(`<div class="runbar" style="margin-top:.4rem"><button class="btn btn-quiet btn-sm">Показать ответ</button></div>`);
    bar.firstChild.onclick = () => { chosen = c.lines.map((t, i) => ({ t, i })); left.length = 0; paint(); check(); };
    el.appendChild(bar);
  }

  function cTask(c, el) {
    if (c.md) el.insertAdjacentHTML("beforeend", md(c.md));
    const ed = makeEditor(c.code, c.key);
    el.appendChild(ed.el);
    const bar = h(`<div class="runbar">
      <button class="btn btn-sm" data-run>▶ Запустить и проверить</button>
      <button class="btn btn-quiet btn-sm" data-hint>Подсказка</button>
      <button class="btn btn-quiet btn-sm" data-reset>Начать заново</button></div>`);
    el.appendChild(bar);
    const hints = document.createElement("div");
    const out = document.createElement("div");
    const fb = document.createElement("div");
    el.appendChild(hints); el.appendChild(out); el.appendChild(fb);
    const levels = (c.hints || []).slice();
    let shown = 0;
    const hintBtn = bar.querySelector("[data-hint]");
    const refreshHintBtn = () => {
      if (shown < levels.length) hintBtn.textContent = shown === 0 ? "Подсказка" : "Ещё подсказка";
      else hintBtn.textContent = "Показать решение";
    };
    refreshHintBtn();
    hintBtn.onclick = () => {
      if (shown < levels.length) {
        hints.insertAdjacentHTML("beforeend", `<div class="tip"><b>Подсказка ${shown + 1}.</b> ${inline(levels[shown])}</div>`);
        shown++; refreshHintBtn();
      } else if (c.solution) {
        hints.insertAdjacentHTML("beforeend", `<div class="note"><b>Решение.</b> Посмотри, сравни со своим и попробуй набрать сам.</div><pre class="code"><code>${highlightRust(c.solution)}</code></pre>`);
        hintBtn.disabled = true; attempt(c);
      }
    };
    bar.querySelector("[data-reset]").onclick = () => { ed.set(c.code); delete S.code[c.key]; save(); out.replaceChildren(); fb.replaceChildren(); };
    const runBtn = bar.querySelector("[data-run]");
    runBtn.onclick = async () => {
      fb.replaceChildren();
      const res = await doRun(ed.get(), out, runBtn, { tests: c.tests, expect: c.expect });
      attempt(c);
      if (res.netError) {
        if (c.expect != null) fb.innerHTML = `<div class="feedback bad">Проверить автоматически не вышло. Должно получиться так:<pre class="code" style="margin:.4rem 0 0"><code>${esc(c.expect)}</code></pre></div>`;
        return;
      }
      let ok = res.ok;
      if (ok && c.expect != null) ok = norm(res.stdout) === norm(c.expect);
      if (ok && c.mustContain) ok = c.mustContain.every((s) => ed.get().includes(s));
      stat(c.key, ok);
      if (ok) fb.innerHTML = `<div class="feedback good"><b>Получилось.</b> ${c.explain ? inline(c.explain) : "Задание выполнено."}</div>`;
      else if (res.ok && c.expect != null) fb.innerHTML = `<div class="feedback bad"><b>Программа работает, но вывод другой.</b> Ожидалось:<pre class="code" style="margin:.4rem 0 0"><code>${esc(c.expect)}</code></pre></div>`;
      else if (res.ok && c.mustContain) fb.innerHTML = `<div class="feedback bad"><b>Вывод верный, но в коде не хватает:</b> ${c.mustContain.map((s) => `<code>${esc(s)}</code>`).join(", ")}</div>`;
      else fb.innerHTML = `<div class="feedback bad"><b>Не компилируется.</b> Это нормально — читай сообщение выше, оно подсказывает, где проблема.</div>`;
    };
  }

  // ---------- Повторение ----------
  function viewReview() {
    setNav("review");
    document.title = "Повторение — Rust с нуля";
    const pool = [];
    lessons.filter((l) => S.done[l.id]).forEach((l) => l.cards.forEach((c, ci) => {
      if (c.t === "quiz" || c.t === "fill") {
        const key = l.id + ":" + ci; const s = S.stats[key] || { r: 0, w: 0 };
        pool.push({ card: Object.assign({ key }, c), lesson: l, weight: 1 + s.w * 2 - Math.min(s.r, 2) * 0.3 + Math.random() });
      }
    }));
    if (!pool.length) {
      app.innerHTML = `<div class="wrap"><div class="card"><h2>Повторение</h2><p>Здесь появятся вопросы из пройденных уроков. Чаще всего — те, где была ошибка.</p><a class="btn" href="#/">К карте курса</a></div></div>`;
      return;
    }
    pool.sort((a, b) => b.weight - a.weight);
    const set = pool.slice(0, 5);
    let i = 0, right = 0;
    const show = () => {
      if (i >= set.length) {
        app.innerHTML = `<div class="wrap"><article class="card finish"><div class="big">Повторение готово.</div>
          <p>С первой попытки: ${right} из ${set.length}. Вопросы с ошибками будут попадаться чаще — так они быстрее запомнятся.</p>
          <div class="row"><a class="btn" href="#/review" onclick="setTimeout(()=>dispatchEvent(new HashChangeEvent('hashchange')),0)">Ещё 5 вопросов</a><a class="btn btn-quiet" href="#/">К карте</a></div></article></div>`;
        return;
      }
      const { card, lesson } = set[i];
      app.innerHTML = `<div class="wrap"><div class="lesson-head"><div><div class="crumbs">Повторение · вопрос ${i + 1} из ${set.length}</div><h1>${esc(lesson.title)}</h1></div></div>
        <div class="progress">${set.map((_, k) => `<span class="${k < i ? "on" : k === i ? "cur" : ""}"></span>`).join("")}</div>
        <article class="card" id="card"></article>
        <div class="lesson-nav"><a class="btn btn-quiet" href="#/">Выйти</a><button class="btn" id="next">Дальше →</button></div></div>`;
      const el = document.getElementById("card");
      let firstTry = true;
      const fn = card.t === "quiz" ? cQuiz : cFill;
      el.innerHTML = `<span class="card-kind">Вспомни</span>`;
      fn(card, el, (ok) => { if (firstTry) { if (ok) right++; firstTry = false; } });
      document.getElementById("next").onclick = () => { i++; show(); };
    };
    show();
  }

  // ---------- Шпаргалка ----------
  function viewCheat() {
    setNav("cheat");
    document.title = "Шпаргалка — Rust с нуля";
    let html = `<div class="wrap cheat"><h1>Шпаргалка</h1><p class="muted">Все «Запомни» из уроков на одной странице. Удобно, чтобы быстро освежить тему.</p>`;
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
    document.title = "Словарь — Rust с нуля";
    const terms = (window.GLOSSARY || []).slice().sort((a, b) => a.term.localeCompare(b.term, "ru"));
    app.innerHTML = `<div class="wrap"><h1>Словарь</h1><p class="muted">Все новые слова курса простыми словами.</p>
      <input class="search" type="search" placeholder="Найти слово…" aria-label="Поиск по словарю"><dl class="gloss"></dl></div>`;
    const dl = app.querySelector("dl"), q = app.querySelector("input");
    const paint = () => {
      const s = q.value.trim().toLowerCase();
      dl.innerHTML = terms.filter((t) => !s || (t.term + " " + (t.en || "") + " " + t.def).toLowerCase().includes(s))
        .map((t) => `<dt>${esc(t.term)} ${t.en ? `<small>${esc(t.en)}</small>` : ""}</dt><dd>${inline(t.def)}</dd>`).join("") || `<p class="muted">Ничего не нашлось.</p>`;
    };
    q.oninput = paint; paint();
  }

  // ---------- Настройки ----------
  function viewSettings() {
    setNav("settings");
    document.title = "Настройки — Rust с нуля";
    const st = S.settings;
    const seg = (name, opts, cur) => `<div class="seg" data-set="${name}">${opts.map(([v, t]) => `<button data-v="${v}" aria-pressed="${String(v) === String(cur)}">${t}</button>`).join("")}</div>`;
    app.innerHTML = `<div class="wrap"><h1>Настройки</h1>
      <div class="panel"><h3>Тема</h3>${seg("theme", [["auto", "Как в системе"], ["light", "Светлая"], ["dark", "Тёмная"]], st.theme)}</div>
      <div class="panel"><h3>Размер текста</h3>${seg("fs", [[16, "Меньше"], [18, "Обычный"], [20, "Крупнее"], [23, "Крупный"]], st.fs)}</div>
      <div class="panel"><h3>Анимации</h3>${seg("motion", [["true", "Вкл"], ["false", "Выкл"]], st.motion)}</div>
      <div class="panel"><h3>Фокус-режим</h3><p class="small muted">Прячет верхнее меню внутри уроков. Остаётся только текущий шаг.</p>${seg("focus", [["false", "Выкл"], ["true", "Вкл"]], st.focus)}</div>
      <div class="panel"><h3>Прогресс</h3>
        <p class="small muted">Хранится только в этом браузере. Сохрани в файл, чтобы перенести на другой компьютер.</p>
        <div class="row"><button class="btn btn-sm" id="exp">Сохранить в файл</button>
        <label class="btn btn-quiet btn-sm">Загрузить из файла<input type="file" accept=".json,application/json" id="imp" hidden></label>
        <button class="btn btn-quiet btn-sm" id="reset">Сбросить всё</button></div></div></div>`;
    app.querySelectorAll(".seg").forEach((g) => g.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      let v = b.dataset.v; const name = g.dataset.set;
      if (name === "fs") v = +v; if (name === "motion" || name === "focus") v = v === "true";
      S.settings[name] = v; save(true); applySettings();
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
    app.querySelector("#exp").onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rust-s-nulya-progress.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    app.querySelector("#imp").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!d || typeof d.done !== "object") throw new Error("bad");
        S = Object.assign(blank(), d, { settings: Object.assign(blank().settings, d.settings || {}) });
        save(true); applySettings(); toast("Прогресс загружен");
      } catch (err) { toast("Это не файл прогресса курса"); }
    };
    app.querySelector("#reset").onclick = () => {
      if (!confirm("Точно стереть весь прогресс? Это нельзя отменить.")) return;
      S = blank(); save(true); applySettings(); toast("Прогресс сброшен");
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
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (e.key === "ArrowRight") { const b = document.getElementById("next"); b && b.click(); }
    if (e.key === "ArrowLeft") { const b = document.getElementById("prev"); b && !b.disabled && b.click(); }
  });

  applySettings();
  window.addEventListener("hashchange", route);
  route();
})();
