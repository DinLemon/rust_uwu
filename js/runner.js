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

  function explainErrors(stderr, lang) {
    const EXPLAIN = window.RK.EXPLAIN[lang] || window.RK.EXPLAIN.ru;
    const codes = [];
    const re = /error\[(E\d{4})\]/g;
    let m;
    while ((m = re.exec(stderr))) if (!codes.includes(m[1])) codes.push(m[1]);
    const out = codes.filter((c) => EXPLAIN[c]).map((c) => ({ code: c, text: EXPLAIN[c] }));
    if (!codes.length && /panicked at/.test(stderr)) {
      out.push({ code: "panic", text: EXPLAIN.panic });
    }
    return out;
  }

  window.RK = window.RK || {};
  Object.assign(window.RK, { runRust, playgroundUrl, explainErrors });
})();
