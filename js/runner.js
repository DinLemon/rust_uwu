// Запуск кода через Rust Playground (play.rust-lang.org) и понятные объяснения ошибок.
(function () {
  "use strict";
  const ENDPOINT = "https://play.rust-lang.org/execute";

  async function runRust(code, opts) {
    const tests = !!(opts && opts.tests);
    const body = {
      channel: "stable",
      mode: "debug",
      edition: "2024",
      crateType: tests ? "lib" : "bin",
      tests: tests,
      code: code,
      backtrace: false,
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      return { ok: !!j.success, stdout: j.stdout || "", stderr: cleanStderr(j.stderr || "") };
    } finally {
      clearTimeout(timer);
    }
  }

  // Убираем служебные строки Cargo, оставляем суть.
  function cleanStderr(s) {
    return s
      .split("\n")
      .filter((l) => !/^\s*(Compiling|Finished|Running|Blocking|Updating|Downloading|Downloaded|Doc-tests) /.test(l))
      .filter((l) => !/^\s*Running `/.test(l))
      .join("\n")
      .replace(/^\s+|\s+$/g, "");
  }

  function playgroundUrl(code) {
    return "https://play.rust-lang.org/?version=stable&mode=debug&edition=2024&code=" + encodeURIComponent(code);
  }

  // Самые частые ошибки новичков — человеческим языком.
  const EXPLAIN = {
    E0382: "Значение уже **переехало** (move) в другую переменную или функцию, а ты пробуешь им снова пользоваться. Варианты: передай ссылку `&x`, сделай копию `.clone()` или используй значение до перемещения.",
    E0499: "Нельзя держать **две изменяемые ссылки** `&mut` на одно и то же одновременно. Закончи работу с первой, потом бери вторую.",
    E0502: "Нельзя одновременно читать (`&`) и менять (`&mut`) одно и то же. Пока кто-то смотрит — менять нельзя. Раздели эти действия по времени.",
    E0384: "Ты меняешь переменную, которая объявлена без `mut`. Добавь `mut`: `let mut x = ...`.",
    E0308: "**Типы не совпадают.** Компилятор ждал один тип, а получил другой. Посмотри на строки `expected` (ожидалось) и `found` (найдено).",
    E0425: "Компилятор **не знает такого имени**. Проверь опечатку и то, что переменная объявлена выше и видна в этом месте.",
    E0596: "Ты пытаешься изменить то, что взято **без** `mut`. Нужна изменяемая переменная (`let mut`) или изменяемая ссылка (`&mut`).",
    E0106: "Компилятору нужна **метка времени жизни** (например `'a`): он не может сам понять, сколько живёт возвращаемая ссылка.",
    E0597: "Ссылка **живёт дольше**, чем значение, на которое она указывает. Значение умирает в конце своего блока `{}` — ссылка не должна его пережить.",
    E0599: "У этого типа **нет такого метода**. Проверь название или подключи нужный трейт через `use`.",
    E0277: "Тип **не умеет** то, что от него требуют (не реализует нужный трейт). Например, его нельзя напечатать через `{}` — попробуй `{:?}` и `#[derive(Debug)]`.",
    E0061: "Функции передано **не то количество аргументов**. Сравни вызов с объявлением `fn`.",
    E0433: "Не найден путь (модуль или тип). Возможно, не хватает `use` или есть опечатка.",
    E0369: "Эту операцию (например `+` или `==`) нельзя применить к этим типам.",
    E0004: "`match` разобрал **не все варианты**. Добавь недостающие ветки или ветку `_ => ...`.",
    E0507: "Нельзя **забрать** значение из-под ссылки. Возьми ссылку на него или сделай `.clone()`.",
    E0373: "Замыкание в потоке может пережить переменные. Добавь `move` перед замыканием: `move || ...`.",
    E0614: "Разыменовывать (`*`) можно только ссылки и умные указатели.",
  };

  function explainErrors(stderr) {
    const codes = [];
    const re = /error\[(E\d{4})\]/g;
    let m;
    while ((m = re.exec(stderr))) if (!codes.includes(m[1])) codes.push(m[1]);
    const out = codes.filter((c) => EXPLAIN[c]).map((c) => ({ code: c, text: EXPLAIN[c] }));
    if (!codes.length && /panicked at/.test(stderr)) {
      out.push({ code: "panic", text: "Программа **запаниковала**: скомпилировалась, но во время работы случилось что-то недопустимое (например `unwrap()` на `None` или выход за границы массива). Текст после `panicked at` подскажет место." });
    }
    return out;
  }

  window.RK = window.RK || {};
  Object.assign(window.RK, { runRust, playgroundUrl, explainErrors });
})();
