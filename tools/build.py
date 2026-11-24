#!/usr/bin/env python3
"""Собирает уроки из course/<язык>/*.txt в content/<уровень>-<язык>.js.

Уровни: m*.txt — «Уровень 1 · Основы» (base), a*.txt — «Уровень 2 · Продвинутый» (pro).

Формат файла урока (кратко, подробно — в README.md):

  # MODULE m01 | Название модуля | Подзаголовок
  ## LESSON m01-1 | Название урока | 6        (6 — минуты)
  :: goals            — строки "- ..."
  :: text Заголовок   — markdown до следующей строки "::" / "##" / "#"
  :: code             — markdown, блок ```rust, необязательный ```out (ожидаемый вывод), текст после
  :: quiz             — markdown-вопрос (можно с ```rust), варианты "[x] верный => почему" / "[ ] неверный => почему"
  :: fill             — markdown, ```rust с ___, строки "= ответ | вариант" по одной на пропуск
  :: order            — markdown, ```rust с правильным порядком строк
  :: task             — markdown, ```rust заготовка, ```solution, ```expect, "hint: ..." (несколько)
                        ```format — шаблон строк с {{text}} и {{int}} для свободных значений
                        check: number — проверить одно число с необязательной подписью
                        check: exact — сохранить буквальную проверку строк
  :: recap            — строки "- ..."
  Общие ключи: "explain: ...", "hint: ...", "tests: yes", "contains: строка"
              "crates: yes" — пример использует крейты из Playground (tokio, serde…):
                              tools/check_rust.py его пропускает, проверяется в браузере
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


FORMAT_FIELDS = {"{{text}}": r"\S[^\r\n]*", "{{int}}": r"[0-9]+"}
NUMBER_RESULT = re.compile(r"(?:[^:\n0-9]+:[ \t]*)?[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?")


def format_pattern(template, where):
    parts = re.split(r"(\{\{[^{}\r\n]+\}\})", template.strip())
    fields = parts[1::2]
    if not fields or any(field not in FORMAT_FIELDS for field in fields):
        raise SystemExit(f"{where}: шаблону format нужны поля {{{{text}}}} или {{{{int}}}}")
    literals = parts[::2]
    if any("{{" in part or "}}" in part for part in literals):
        raise SystemExit(f"{where}: незакрытое поле format")
    return "".join(
        FORMAT_FIELDS[part] if i % 2 else
        r"\n".join(re.escape(line).replace(r"\ ", " ").replace(": ", r"[ \t]*:[ \t]*") for line in part.split("\n"))
        for i, part in enumerate(parts)
    )


def parse_card(kind, title, lines, where):
    card = {"t": kind}
    if title:
        card["title"] = title
    md, fences, opts, answers, hints, items = [], [], [], [], [], []
    after = []
    i = 0
    seen_fence = False
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^```(\w*)\s*$", line)
        if m:
            tag = m.group(1) or "rust"
            buf = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i])
                i += 1
            if i >= len(lines):
                raise SystemExit(f"{where}: незакрытый блок ```")
            i += 1
            # в text/quiz код остаётся частью markdown
            if kind in ("text", "quiz") or (kind == "deep" and (tag not in ("rust", "out") or (tag == "rust" and "fn main" not in "\n".join(buf)))):
                md.append("```" + ("" if tag == "rust" else tag))
                md.extend(buf)
                md.append("```")
            else:
                fences.append((tag, "\n".join(buf)))
                if tag == "rust" and kind != "deep":
                    seen_fence = True
            continue
        if kind == "quiz" and re.match(r"^\[( |x)\] ", line):
            right = line[1] == "x"
            body = line[4:]
            why = None
            if " => " in body:
                body, why = body.split(" => ", 1)
            opts.append((body.strip(), right, why.strip() if why else None))
        elif kind == "fill" and line.startswith("= "):
            answers.append([a.strip() for a in line[2:].split(" | ")])
        elif kind in ("goals", "recap") and line.startswith("- "):
            items.append(line[2:].strip())
        elif line.startswith("explain: "):
            card["explain"] = line[9:].strip()
        elif line.startswith("hint: "):
            hints.append(line[6:].strip())
        elif line.startswith("crates: "):
            card["crates"] = line[8:].strip() in ("yes", "true", "да")
        elif line.startswith("tests: "):
            card["tests"] = line[7:].strip() in ("yes", "true", "да")
        elif line.startswith("fails: "):
            card["fails"] = line[7:].strip() in ("yes", "true", "да")
        elif line.startswith("contains: "):
            card.setdefault("mustContain", []).append(line[10:].strip())
        elif kind == "task" and line.startswith("check: "):
            card["outputCheck"] = line[7:].strip()
        elif kind == "code" and seen_fence:
            after.append(line)
        else:
            md.append(line)
        i += 1

    text = "\n".join(md).strip()
    if text:
        card["md"] = text
    fd = {}
    if kind in ("code", "fill", "order", "task"):
        n_rust = sum(1 for t, _ in fences if t == "rust")
        if n_rust != 1:
            raise SystemExit(f"{where}: в карточке {kind} должен быть ровно один блок ```rust, а их {n_rust}")
        # блоки с другими тегами (text, sh) внутри описания задачи — часть markdown
        for t, body in fences:
            if t not in ("rust", "out", "solution", "expect", "format"):
                md.extend(["```" + t, body, "```"])
    for tag, body in fences:
        fd.setdefault(tag, body)

    if kind in ("goals", "recap"):
        if not items:
            raise SystemExit(f"{where}: пустой список {kind}")
        card["items"] = items
    elif kind == "deep":
        if not title:
            raise SystemExit(f"{where}: у карточки deep нужен заголовок")
        if "rust" in fd:
            card["code"] = fd["rust"]
        if "out" in fd:
            card["out"] = fd["out"]
    elif kind == "code":
        card["code"] = fd["rust"]
        if "out" in fd:
            card["out"] = fd["out"]
        if "\n".join(after).strip():
            card["after"] = "\n".join(after).strip()
    elif kind == "quiz":
        if len(opts) < 2 or sum(1 for o in opts if o[1]) != 1:
            raise SystemExit(f"{where}: в квизе нужно ≥2 вариантов и ровно один [x]")
        card["options"] = [o[0] for o in opts]
        card["answer"] = next(k for k, o in enumerate(opts) if o[1])
        if any(o[2] for o in opts):
            card["why"] = [o[2] for o in opts]
    elif kind == "fill":
        code = fd["rust"]
        n = code.count("___")
        if n != len(answers) or n == 0:
            raise SystemExit(f"{where}: пропусков {n}, ответов {len(answers)}")
        card["code"] = code
        card["answers"] = answers
        if hints:
            card["hint"] = hints[0]
    elif kind == "order":
        card["lines"] = [l for l in fd["rust"].split("\n") if l.strip()]
    elif kind == "task":
        card["code"] = fd["rust"]
        if "solution" in fd:
            card["solution"] = fd["solution"]
        if "expect" in fd:
            card["expect"] = fd["expect"]
        mode = card.get("outputCheck")
        if mode is not None:
            if mode not in ("number", "exact") or "expect" not in fd or "format" in fd:
                raise SystemExit(f"{where}: check должен быть number или exact и требует expect без format")
            if mode == "number" and not NUMBER_RESULT.fullmatch(fd["expect"].strip()):
                raise SystemExit(f"{where}: check: number требует одного числа в expect")
        if "format" in fd:
            pattern = format_pattern(fd["format"], where)
            example = "\n".join(line.strip() for line in fd.get("expect", "").strip().split("\n"))
            if "expect" not in fd or not re.fullmatch(pattern, example):
                raise SystemExit(f"{where}: пример expect должен соответствовать шаблону format")
            card["expectFormat"] = fd["format"]
            card["expectPattern"] = pattern
        if hints:
            card["hints"] = hints
        if "solution" not in fd:
            raise SystemExit(f"{where}: у задачи нет ```solution")
    return card


def parse_file(path):
    modules = []
    mod = lesson = None
    kind = title = None
    buf = []
    lineno = 0

    def flush():
        nonlocal kind, buf
        if kind:
            if lesson is None:
                raise SystemExit(f"{path}:{lineno}: карточка вне урока")
            lesson["cards"].append(parse_card(kind, title, buf, f"{path.name}:{lesson['id']}"))
        kind, buf = None, []

    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.rstrip()
        if line.startswith("# MODULE "):
            flush()
            mid, mtitle, msub = [x.strip() for x in line[9:].split("|")]
            mod = {"id": mid, "title": mtitle, "sub": msub, "lessons": []}
            modules.append(mod)
            lesson = None
        elif line.startswith("## LESSON "):
            flush()
            parts = [x.strip() for x in line[10:].split("|")]
            lesson = {"id": parts[0], "title": parts[1], "min": int(parts[2]), "cards": []}
            if len(parts) > 3 and parts[3] == "practice":
                lesson["practice"] = True
            mod["lessons"].append(lesson)
        elif line.startswith(":: "):
            flush()
            head = line[3:].strip().split(" ", 1)
            kind = head[0]
            title = head[1] if len(head) > 1 else None
            if kind not in ("goals", "text", "code", "quiz", "fill", "order", "task", "recap", "deep"):
                raise SystemExit(f"{path}:{lineno}: неизвестный тип карточки {kind}")
        else:
            if kind is None and line.strip() and not line.startswith("//"):
                raise SystemExit(f"{path}:{lineno}: текст вне карточки: {line[:40]}")
            if kind:
                buf.append(raw)
    flush()
    return modules


TRACKS = {"base": ("m*.txt", "glossary.txt"), "pro": ("a*.txt", "glossary-pro.txt")}


def load_lang(lang, track="base"):
    pattern, gname = TRACKS[track]
    modules = []
    for f in sorted((ROOT / "course" / lang).glob(pattern)):
        modules.extend(parse_file(f))
    ids = set()
    for m in modules:
        for l in m["lessons"]:
            if l["id"] in ids:
                raise SystemExit(f"{lang}: повтор id урока {l['id']}")
            ids.add(l["id"])
            g = [c for c in l["cards"] if c["t"] == "goals"]
            if g:
                l["goals"] = g[0]["items"]
                l["cards"] = [c for c in l["cards"] if c["t"] != "goals"]
    gloss = []
    gpath = ROOT / "course" / lang / gname
    if gpath.exists():
        for line in gpath.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.startswith("//"):
                term, en, d = [x.strip() for x in line.split("|", 2)]
                gloss.append({"term": term, "en": en, "def": d})
    return modules, gloss


def shape(modules):
    """Структура курса без текста: должна совпадать у всех языков."""
    out = {}
    for m in modules:
        for l in m["lessons"]:
            out[l["id"]] = (m["id"], bool(l.get("practice")), tuple(
                (c["t"], bool(c.get("tests")), len(c.get("options", [])), c.get("answer"), len(c.get("answers", [])), len(c.get("lines", [])), c.get("outputCheck"), bool(c.get("expectFormat")))
                for c in l["cards"]))
    return out


def check_parity(courses):
    """Языки должны совпадать по структуре: прогресс и статистика общие."""
    ru_shape, en_shape = shape(courses["ru"]), shape(courses["en"])
    problems = []
    for lid, sh in ru_shape.items():
        if lid not in en_shape:
            problems.append(f"en: нет урока {lid}")
        elif en_shape[lid] != sh:
            a, b = sh[2], en_shape[lid][2]
            diff = next((i for i in range(min(len(a), len(b))) if a[i] != b[i]), min(len(a), len(b)))
            problems.append(f"{lid}: структура ru/en расходится с карточки #{diff}: ru={a[diff:diff+1]} en={b[diff:diff+1]} (карточек ru {len(a)}, en {len(b)})")
    for lid in en_shape:
        if lid not in ru_shape:
            problems.append(f"ru: нет урока {lid}")
    return problems


def main():
    strict = "--partial" not in sys.argv
    out_dir = ROOT / "content"
    out_dir.mkdir(exist_ok=True)
    manifest = {"files": {}, "lessons": {}}
    all_ids = set()
    failed = False
    for track in TRACKS:
        courses, glossaries = {}, {}
        for lang in ("ru", "en"):
            courses[lang], glossaries[lang] = load_lang(lang, track)
        if not courses["ru"] and not courses["en"]:
            continue
        for m in courses["ru"]:
            for l in m["lessons"]:
                if l["id"] in all_ids:
                    print(f"ОШИБКА повтор id урока {l['id']} в разных уровнях")
                    failed = True
                all_ids.add(l["id"])
        problems = check_parity(courses)
        missing_en = [p for p in problems if p.startswith("en: нет урока")]
        other = [p for p in problems if not p.startswith("en: нет урока")]
        for p in other:
            print("ОШИБКА", track, p)
        if other or (strict and missing_en):
            if missing_en:
                print(f"{track}: нет перевода для {len(missing_en)} уроков")
            failed = True
            continue
        if missing_en:
            merged = []
            for m in courses["ru"]:
                merged.append(next((x for x in courses["en"] if x["id"] == m["id"]), m))
            courses["en"] = merged
            print(f"ВНИМАНИЕ {track}: {len(missing_en)} уроков без перевода, вставлены по-русски")
        for lang in ("ru", "en"):
            key = f"{track}-{lang}"
            data = json.dumps({"modules": courses[lang], "glossary": glossaries[lang]}, ensure_ascii=False, separators=(",", ":"))
            content = (
                "// Сгенерировано tools/build.py из course/<язык>/*.txt. Не редактируй вручную.\n"
                f"(window.RK_DATA = window.RK_DATA || {{}})[{json.dumps(key)}] = {data};\n"
            )
            raw = content.encode("utf-8")
            (out_dir / f"{key}.js").write_bytes(raw)
            manifest["files"][key] = hashlib.sha1(raw).hexdigest()[:8]
            manifest["lessons"][track] = sum(len(m["lessons"]) for m in courses[lang])
            modules = courses[lang]
            n_l = sum(len(m["lessons"]) for m in modules)
            n_c = sum(len(l["cards"]) for m in modules for l in m["lessons"])
            n_t = sum(1 for m in modules for l in m["lessons"] for c in l["cards"] if c["t"] in ("task", "fill", "order"))
            n_d = sum(1 for m in modules for l in m["lessons"] for c in l["cards"] if c["t"] == "deep")
            mins = sum(l["min"] for m in modules for l in m["lessons"])
            print(f"{key}: модулей {len(modules)}, уроков {n_l}, карточек {n_c}, практики {n_t}, углублений {n_d}, минут {mins}, терминов {len(glossaries[lang])}, {len(raw)//1024} КБ")
    if failed:
        raise SystemExit(1)
    mtext = ("// Сгенерировано tools/build.py: какие файлы курса есть и их версии (для сброса кэша).\n"
             f"window.RK_MANIFEST = {json.dumps(manifest)};\n")
    (out_dir / "manifest.js").write_text(mtext, encoding="utf-8")
    # index.html грузит манифест с версией, чтобы браузер не держал старый.
    index = ROOT / "index.html"
    html = index.read_text(encoding="utf-8")
    ver = hashlib.sha1(mtext.encode("utf-8")).hexdigest()[:8]
    html2 = re.sub(r'<script src="content/(?:course-data|manifest)\.js(?:\?v=[^"]*)?"></script>',
                   f'<script src="content/manifest.js?v={ver}"></script>', html)
    if html2 != html:
        index.write_text(html2, encoding="utf-8")
    old = out_dir / "course-data.js"
    if old.exists():
        old.unlink()


if __name__ == "__main__":
    main()
