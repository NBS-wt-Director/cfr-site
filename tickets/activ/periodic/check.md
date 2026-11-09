# 🔄 periodic/check — Проверка состояния сайта и проекта

> **Периодичность:** периодически, после крупных правок, перед коммитом.

## Чек-лист

### Синтаксис и сборка

```bash
cd cfr-site
for f in static/js/*.js; do node --check "$f"; done   # синтаксис клиентского JS
node --check scripts/*.mjs                             # скрипты (по одному)
npm run static:export                                  # генерация без ошибок
```

### Данные

```bash
# состояние базы
python3 -c "import json;d=json.load(open('db.json'));print('trainers',len(d['trainers']),'programs',len(d['programs']),'news',len(d['news']))"
```

- [ ] Битых картинок в данных нет (в `db.json` пути существуют в `static/uploads/` / `static/data/`)
- [ ] `static/js/data/*.js` свежее `db.json` (иначе — `npm run static:export`)
- [ ] Скрытые объекты (`hidden: true`) не попали в экспорт
- [ ] Секретов в репо нет (`git status`, `.gitignore` покрывает `.env*`, `.admin-password.json`, `.admin-sessions.json`)

### Живой прогон (локально)

```bash
npm run admin   # http://localhost:3456 (пароль в .env.local)
```

- [ ] Все страницы → 200, `несуществующая → 404`
- [ ] `/admin.html` открывается, логин работает

### Прод (если деплоился)

```bash
curl -sk -o /dev/null -w "главная -> %{http_code}\n" https://центр-фр.рф/
curl -sk -o /dev/null -w "admin -> %{http_code}\n" https://центр-фр.рф/admin.html
```

## Журнал выполнений

| Дата | Что проверялось | Результат |
|------|-----------------|-----------|
| 2026-11-07 | Сессия 34: test-static 455/456, test-menu 26/26 | ✅ (падает предсуществующая S28 — 3 программы без обложек) |
