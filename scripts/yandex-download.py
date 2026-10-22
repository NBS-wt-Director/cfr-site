#!/usr/bin/env python3
"""
Скачивание всех фотографий с публичных папок Яндекс.Диска.

Результат:
  static/data/trainers/<...>/*.jpg   — фото коллектива
  static/data/programs/<...>/*.jpg   — фото программ

Видео (mov/mp4) НЕ скачиваются — слишком большие, обрабатываются отдельно.
Прогресс (resume): static/data/.download-progress.json
Лог:               static/data/.download.log

Особенности Яндекс.Диска:
  - ссылка на скачивание ОДНОРАЗОВАЯ — перед каждой попыткой запрашивается заново;
  - на крупных файлах регулярно отдаёт HTTP 500 / вешает соединение —
    лечится параллельной закачкой (8 потоков) и повторами (6 попыток).
"""
import urllib.request
import urllib.parse
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "static", "data")
PROGRESS = os.path.join(BASE, ".download-progress.json")
LOG = os.path.join(BASE, ".download.log")

DISKS = {
    "trainers": "https://disk.yandex.ru/d/XddntkTpcYF2XA",
    "programs": "https://disk.yandex.ru/d/5kP8jYbCBg4sDg",
}

API = "https://cloud-api.yandex.net/v1/disk/public/resources"
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"}

API_TIMEOUT = 30
DOWNLOAD_TIMEOUT = 120
MAX_RETRIES = 6
MAX_WORKERS = 8

_log_lock = Lock()
_prog_lock = Lock()


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    with _log_lock:
        print(line, flush=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")


def api_get(url, retries=4):
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url), timeout=API_TIMEOUT) as r:
                return json.loads(r.read())
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def list_public(public_key, path="/"):
    items, offset = [], 0
    while True:
        url = (f"{API}?public_key={urllib.parse.quote(public_key, safe='')}"
               f"&path={urllib.parse.quote(path, safe='')}&limit=100&offset={offset}")
        d = api_get(url)
        emb = d.get("_embedded", {})
        batch = emb.get("items", [])
        items.extend(batch)
        total = emb.get("total", 0)
        offset += len(batch)
        if offset >= total or not batch:
            break
        time.sleep(0.15)
    return items


def collect_tasks(sub, public_key, api_path="/", rel=""):
    tasks = []
    for it in list_public(public_key, api_path):
        name = it["name"]
        child_api = api_path.rstrip("/") + "/" + name
        child_rel = os.path.join(rel, name.replace("/", "_").strip()) if rel else name
        if it.get("type") == "dir":
            tasks.extend(collect_tasks(sub, public_key, child_api, child_rel))
        elif it.get("media_type") == "image" or os.path.splitext(name)[1].lower() in IMG_EXT:
            tasks.append({"sub": sub, "api": child_api, "rel": child_rel, "key": f"{sub}/{child_rel}"})
    return tasks


def load_progress():
    if os.path.exists(PROGRESS):
        try:
            with open(PROGRESS, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_progress(prog):
    tmp = PROGRESS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(prog, f, ensure_ascii=False)
    os.replace(tmp, PROGRESS)


def is_image_downloaded(prog, key, local):
    if os.path.exists(local) and os.path.getsize(local) > 1024:
        with _prog_lock:
            if key not in prog:
                prog[key] = {"bytes": os.path.getsize(local), "ts": int(time.time())}
        return True
    return key in prog and os.path.exists(local)


def download_one(public_key, task, local):
    tmp = local + ".part"
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            href_url = (f"{API}/download?public_key={urllib.parse.quote(public_key, safe='')}"
                        f"&path={urllib.parse.quote(task['api'], safe='')}")
            href = api_get(href_url).get("href")
            if not href:
                raise OSError("API не вернул href")
            with urllib.request.urlopen(urllib.request.Request(href), timeout=DOWNLOAD_TIMEOUT) as r:
                with open(tmp, "wb") as f:
                    while True:
                        chunk = r.read(65536)
                        if not chunk:
                            break
                        f.write(chunk)
            if os.path.getsize(tmp) < 1024:
                raise OSError("слишком маленький — не картинка")
            os.replace(tmp, local)
            return os.path.getsize(local)
        except Exception as e:
            last_err = e
            if os.path.exists(tmp):
                os.remove(tmp)
            time.sleep(1.5 * (attempt + 1))
    raise OSError(f"не скачалось за {MAX_RETRIES} попыток: {last_err}")


def build_inventory():
    inv = []
    for root, dirs, files in os.walk(BASE):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in IMG_EXT:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, BASE)
                inv.append({"path": rel, "bytes": os.path.getsize(full)})
    out = os.path.join(BASE, ".inventory.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(inv, f, ensure_ascii=False, indent=1)
    log(f"инвентарь: {len(inv)} файлов")


def main():
    os.makedirs(BASE, exist_ok=True)
    prog = load_progress()
    log("=== старт закачки фото (параллельная версия) ===")

    all_tasks = []
    for sub, key in DISKS.items():
        log(f"--- список {sub} ---")
        tasks = collect_tasks(sub, key)
        log(f"{sub}: найдено {len(tasks)} фото")
        all_tasks.extend(tasks)

    todo = []
    for t in all_tasks:
        local = os.path.normpath(os.path.join(BASE, t["sub"], t["rel"]))
        t["local"] = local
        if is_image_downloaded(prog, t["key"], local):
            continue
        todo.append(t)

    log(f"итого: {len(all_tasks)}, уже скачано: {len(all_tasks) - len(todo)}, осталось: {len(todo)}")

    done = [0]
    errors = [0]
    total_bytes = [0]
    keys = {sub: key for sub, key in DISKS.items()}

    def worker(task):
        sz = download_one(keys[task["sub"]], task, task["local"])
        with _prog_lock:
            prog[task["key"]] = {"bytes": sz, "ts": int(time.time())}
        return sz

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(worker, t): t for t in todo}
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                sz = fut.result()
                done[0] += 1
                total_bytes[0] += sz
                if done[0] % 20 == 0:
                    with _prog_lock:
                        save_progress(prog)
                    log(f"  ...{done[0]}/{len(todo)}, {total_bytes[0] / 1e6:.0f} МБ, ошибок {errors[0]}")
            except Exception as e:
                errors[0] += 1
                log(f"  ERR {t['key']}: {e}")

    with _prog_lock:
        save_progress(prog)
    log(f"=== готово: скачано {done[0]}, ошибок {errors[0]}, {total_bytes[0] / 1e6:.0f} МБ ===")
    build_inventory()


if __name__ == "__main__":
    main()
