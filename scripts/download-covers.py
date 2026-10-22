#!/usr/bin/env python3
"""
scripts/download-covers.py — дозагрузка ОДНОЙ обложки с Яндекс.Диска (S28).

Для сущностей, у которых нет ни одного локального фото, качает с диска
только обложку: coverFile из docx, иначе первое фото папки по алфавиту.
Механизм (API, retry, resume) — из yandex-download.py.

  python3 scripts/download-covers.py            # программы и тренеры без image
  python3 scripts/download-covers.py --force    # даже с image
"""
import importlib.util
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Импорт yandex-download.py (дефис в имени — только через importlib)
_spec = importlib.util.spec_from_file_location(
    "yd", os.path.join(ROOT, "scripts", "yandex-download.py"))
yd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(yd)

NAME_FIXES = {
    "Гимнастика для шеи и органов чуств": "Гимнастика для шеи и органов чувств",
    "ОФП УШУ (10+)": "ОФП Ушу (10+)",
    "Оздоровительное УШУ (6-12 лет)": "Оздоровительное Ушу для детей (6-12 лет)",
    "Тайцзи-цигун": "Тайцзи-Цигун",
    "Тайцзи-цюань": "Тайцзи-Цюань",
    "Борьба": "Греко-римская борьба",
}


def norm(name):
    n = " ".join((name or "").split())
    n = n.replace("в расписании нет", " ").strip()
    return NAME_FIXES.get(n, n)


def main():
    force = "--force" in sys.argv
    db = json.load(open(os.path.join(ROOT, "db.json"), encoding="utf-8"))

    def want(list_name, sub):
        out = {}
        for e in db.get(list_name, []):
            if e.get("hidden"):
                continue
            if e.get("image") and not force:
                continue
            out[norm(e["name"])] = {"entity": e, "sub": sub, "cover": e.get("coverFile") or ""}
        return out

    targets = {}
    targets.update(want("programs", "programs"))
    targets.update(want("trainers", "trainers"))
    if not targets:
        print("✅ Всем сущностям уже есть обложки")
        return

    print(f"🔎 Ищем на диске фото для {len(targets)} сущностей...")
    prog = yd.load_progress()
    found = {}
    for sub, key in yd.DISKS.items():
        for task in yd.collect_tasks(sub, key):
            # rel = «<КАТЕГОРИЯ>/<Папка программы>/файл.jpg» — имя программы в последнем сегменте папки
            folder = norm(os.path.basename(os.path.dirname(task["rel"])))
            if folder in targets and targets[folder]["sub"] == sub:
                found.setdefault(folder, []).append(task)

    downloaded = 0
    for folder, tasks in found.items():
        tasks.sort(key=lambda t: t["rel"])
        cover = targets[folder]["cover"]

        def stem(p):
            return os.path.splitext(os.path.basename(p))[0].lower()

        # Приоритет: coverFile → файл с именем папки (обычно настоящий jpg,
        # а не HEIC с расширением .jpg) → первое фото по алфавиту
        chosen = None
        if cover:
            chosen = next((t for t in tasks if t["rel"].lower().endswith(cover.lower())), None)
        chosen = chosen or next((t for t in tasks if stem(t["rel"]) == folder.lower()), None)
        chosen = chosen or tasks[0]
        local = os.path.normpath(os.path.join(yd.BASE, chosen["sub"], chosen["rel"]))
        os.makedirs(os.path.dirname(local), exist_ok=True)
        if os.path.exists(local) and os.path.getsize(local) > 1024:
            print(f"  ⏭  {folder} — уже есть локально")
            continue
        try:
            sz = yd.download_one(yd.DISKS[chosen["sub"]], chosen, local)
            prog[chosen["key"]] = {"bytes": sz, "ts": int(__import__("time").time())}
            downloaded += 1
            print(f"  ✅ {folder} ← {os.path.basename(chosen['rel'])} ({sz / 1e6:.1f} МБ)")
        except Exception as e:
            print(f"  ❌ {folder}: {e}")

    yd.save_progress(prog)
    not_found = [f for f in targets if f not in found]
    if not_found:
        print("⚠️ На диске нет папок/фото для:", *not_found, sep="\n   ")
    print(f"\n📊 Скачано обложек: {downloaded}. Перезапустите npm run match-photos")


if __name__ == "__main__":
    main()
