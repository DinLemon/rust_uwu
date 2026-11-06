#!/usr/bin/env python3
"""Собирает уроки из course/*.txt в content/course-data.js.

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
  :: recap            — строки "- ..."
  Общие ключи: "explain: ...", "hint: ...", "tests: yes", "contains: строка"
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


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
            if kind in ("text", "quiz"):
                md.append("```" + ("" if tag == "rust" else tag))
                md.extend(buf)
                md.append("```")
            else:
                fences.append((tag, "\n".join(buf)))
                if tag == "rust":
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
        elif line.startswith("tests: "):
            card["tests"] = line[7:].strip() in ("yes", "true", "да")
        elif line.startswith("fails: "):
            card["fails"] = line[7:].strip() in ("yes", "true", "да")
        elif line.startswith("contains: "):
            card.setdefault("mustContain", []).append(line[10:].strip())
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
            if t not in ("rust", "out", "solution", "expect"):
                md.extend(["```" + t, body, "```"])
    for tag, body in fences:
        fd.setdefault(tag, body)

    if kind in ("goals", "recap"):
        if not items:
            raise SystemExit(f"{where}: пустой список {kind}")
        card["items"] = items
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
            mod["lessons"].append(lesson)
        elif line.startswith(":: "):
            flush()
            head = line[3:].strip().split(" ", 1)
            kind = head[0]
            title = head[1] if len(head) > 1 else None
            if kind not in ("goals", "text", "code", "quiz", "fill", "order", "task", "recap"):
                raise SystemExit(f"{path}:{lineno}: неизвестный тип карточки {kind}")
        else:
            if kind is None and line.strip() and not line.startswith("//"):
                raise SystemExit(f"{path}:{lineno}: текст вне карточки: {line[:40]}")
            if kind:
                buf.append(raw)
    flush()
    return modules


def main():
    modules = []
    for f in sorted((ROOT / "course").glob("m*.txt")):
        modules.extend(parse_file(f))
    # goals → поле урока
    ids = set()
    for m in modules:
        for l in m["lessons"]:
            if l["id"] in ids:
                raise SystemExit(f"повтор id урока {l['id']}")
            ids.add(l["id"])
            g = [c for c in l["cards"] if c["t"] == "goals"]
            if g:
                l["goals"] = g[0]["items"]
                l["cards"] = [c for c in l["cards"] if c["t"] != "goals"]
    gloss = []
    gpath = ROOT / "course" / "glossary.txt"
    if gpath.exists():
        for line in gpath.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.startswith("//"):
                term, en, d = [x.strip() for x in line.split("|", 2)]
                gloss.append({"term": term, "en": en, "def": d})
    out = ROOT / "content" / "course-data.js"
    out.parent.mkdir(exist_ok=True)
    data = json.dumps({"modules": modules}, ensure_ascii=False, indent=0)
    out.write_text(
        "// Сгенерировано tools/build.py из course/*.txt. Не редактируй вручную.\n"
        f"window.COURSE = {data};\nwindow.GLOSSARY = {json.dumps(gloss, ensure_ascii=False, indent=0)};\n",
        encoding="utf-8",
    )
    n_l = sum(len(m["lessons"]) for m in modules)
    n_c = sum(len(l["cards"]) for m in modules for l in m["lessons"])
    mins = sum(l["min"] for m in modules for l in m["lessons"])
    print(f"модулей {len(modules)}, уроков {n_l}, карточек {n_c}, минут {mins}, терминов {len(gloss)}")


if __name__ == "__main__":
    main()
