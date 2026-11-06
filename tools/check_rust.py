#!/usr/bin/env python3
"""Компилирует и запускает все примеры курса настоящим rustc (edition 2024).

Проверяет:
- карточки code: компилируются и печатают ``out`` (если задан); с ``fails: yes`` — должны НЕ компилироваться;
- задачи task: решение компилируется и печатает ``expect``; с ``tests: yes`` — тесты проходят.
Запуск: python3 tools/check_rust.py [фильтр-id-урока]
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "content" / "course-data.js").read_text(encoding="utf-8")
data = json.loads(src.split("window.COURSE = ", 1)[1].split(";\nwindow.GLOSSARY", 1)[0])
flt = sys.argv[1] if len(sys.argv) > 1 else ""
tmp = Path(tempfile.mkdtemp())


def run(code, tests=False):
    f = tmp / "main.rs"
    f.write_text(code, encoding="utf-8")
    exe = tmp / "prog"
    args = ["rustc", "--edition", "2024", "-A", "warnings", "-o", str(exe), str(f)]
    if tests:
        args.insert(1, "--test")
    elif "fn main" not in code:
        args[1:1] = ["--crate-type", "lib"]
    c = subprocess.run(args, capture_output=True, text=True, timeout=120)
    if c.returncode != 0:
        return False, "", c.stderr
    if "fn main" not in code and not tests:
        return True, "", ""
    r = subprocess.run([str(exe)], capture_output=True, text=True, timeout=20)
    return (r.returncode == 0 or not tests), r.stdout, r.stderr


bad = 0
total = 0
for m in data["modules"]:
    for l in m["lessons"]:
        if flt and not l["id"].startswith(flt):
            continue
        for i, c in enumerate(l["cards"]):
            where = f"{l['id']}#{i} {c['t']}"
            if c["t"] == "code":
                total += 1
                ok, out, err = run(c["code"], c.get("tests", False))
                if c.get("fails"):
                    if ok:
                        bad += 1
                        print(f"FAIL {where}: ожидалась ошибка компиляции, но код собрался")
                    continue
                if not ok:
                    bad += 1
                    print(f"FAIL {where}: не компилируется\n{err[:1500]}")
                elif "out" in c and out.strip() != c["out"].strip():
                    bad += 1
                    print(f"FAIL {where}: вывод\n--- ждали\n{c['out']}\n--- получили\n{out}")
            elif c["t"] == "task":
                total += 1
                ok, out, err = run(c["solution"], c.get("tests", False))
                if not ok:
                    bad += 1
                    print(f"FAIL {where}: решение не компилируется/тесты упали\n{err[:1500]}{out[-800:]}")
                elif "expect" in c and out.strip() != c["expect"].strip():
                    bad += 1
                    print(f"FAIL {where}: вывод решения\n--- ждали\n{c['expect']}\n--- получили\n{out}")
                for s in c.get("mustContain", []):
                    if s not in c["solution"]:
                        bad += 1
                        print(f"FAIL {where}: в решении нет обязательного '{s}'")
print(f"проверено {total}, ошибок {bad}")
sys.exit(1 if bad else 0)
