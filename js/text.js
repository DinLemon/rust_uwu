// Подсветка Rust и мини-Markdown. Без зависимостей.
(function () {
  "use strict";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const KW = new Set((
    "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut " +
    "pub ref return self Self static struct super trait true type unsafe use where while"
  ).split(" "));
  const PRIM = new Set("i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str".split(" "));

  // Токенизатор: идём по строке и забираем самый первый подходящий кусок.
  const RULES = [
    ["com", /^\/\/[^\n]*/],
    ["com", /^\/\*[\s\S]*?\*\//],
    ["attr", /^#!?\[[^\]\n]*\]/],
    ["str", /^b?r#*"[\s\S]*?"#*/],
    ["str", /^b?"(?:[^"\\]|\\[\s\S])*"/],
    ["str", /^b?'(?:[^'\\\n]|\\[^\n]{1,8})'/],
    ["life", /^'[A-Za-z_][A-Za-z0-9_]*/],
    ["num", /^\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?(?:_?(?:i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64))?/],
    ["word", /^[A-Za-z_][A-Za-z0-9_]*!?/],
    ["ws", /^\s+/],
    ["p", /^[^\sA-Za-z0-9_'"\/#]+|^./],
  ];

  function highlightRust(src) {
    let out = "";
    let i = 0;
    while (i < src.length) {
      const rest = src.slice(i);
      let kind = "p", m = null;
      for (const [k, re] of RULES) {
        m = re.exec(rest);
        if (m) { kind = k; break; }
      }
      const text = m[0];
      i += text.length;
      if (kind === "word") {
        const next = src.slice(i).match(/^\s*(\(|::<)/);
        if (text.endsWith("!")) out += `<span class="tok-mac">${esc(text)}</span>`;
        else if (KW.has(text)) out += `<span class="tok-kw">${esc(text)}</span>`;
        else if (PRIM.has(text) || /^[A-Z]/.test(text)) out += `<span class="tok-ty">${esc(text)}</span>`;
        else if (next) out += `<span class="tok-fn">${esc(text)}</span>`;
        else out += esc(text);
      } else if (kind === "ws" || kind === "p") {
        out += esc(text);
      } else {
        out += `<span class="tok-${kind}">${esc(text)}</span>`;
      }
    }
    return out;
  }

  function inline(s) {
    // s уже экранирован. Сначала прячем `код`, чтобы внутри него не работали ** и *.
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|#[^)\s]*)\)/g, (_, t, u) =>
      `<a href="${u}"${u.startsWith("#") ? "" : ' target="_blank" rel="noopener"'}>${t}</a>`);
    s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${codes[+n]}</code>`);
    return s;
  }

  // Мини-Markdown: абзацы, списки, ```код```, > совет, !> предупреждение, ~> заметка.
  function md(src) {
    const lines = String(src).replace(/\r/g, "").replace(/^\n+|\s+$/g, "").split("\n");
    let html = "";
    let i = 0;
    const isBlockStart = (l) => /^(```|- |\d+\. |> |!> |~> |### )/.test(l);
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") { i++; continue; }
      if (line.startsWith("```")) {
        const lang = line.slice(3).trim();
        const buf = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
        i++;
        const body = lang && lang !== "rust" ? esc(buf.join("\n")) : highlightRust(buf.join("\n"));
        html += `<pre class="code"><code>${body}</code></pre>`;
        continue;
      }
      if (line.startsWith("### ")) { html += `<h3>${inline(esc(line.slice(4)))}</h3>`; i++; continue; }
      const box = line.match(/^(>|!>|~>) /);
      if (box) {
        const cls = box[1] === ">" ? "tip" : box[1] === "!>" ? "warn" : "note";
        const buf = [];
        while (i < lines.length && lines[i].startsWith(box[1] + " ")) buf.push(lines[i++].slice(box[1].length + 1));
        html += `<div class="${cls}">${buf.map((l) => inline(esc(l))).join("<br>")}</div>`;
        continue;
      }
      if (/^- /.test(line) || /^\d+\. /.test(line)) {
        const ordered = /^\d+\. /.test(line);
        const re = ordered ? /^\d+\. / : /^- /;
        const items = [];
        while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
        const tag = ordered ? "ol" : "ul";
        html += `<${tag}>${items.map((t) => `<li>${inline(esc(t))}</li>`).join("")}</${tag}>`;
        continue;
      }
      const buf = [];
      while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) buf.push(lines[i++]);
      html += `<p>${buf.map((l) => inline(esc(l))).join("<br>")}</p>`;
    }
    return html;
  }

  window.RK = window.RK || {};
  Object.assign(window.RK, { esc, md, inline: (s) => inline(esc(s)), highlightRust });
})();
