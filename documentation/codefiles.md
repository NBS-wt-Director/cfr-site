# Code Files Documentation

**Обновлено:** 2026

---

## 📁 Структура проекта

```
shifu-panda/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Главная
│   │   ├── admin/              # Админ
│   │   ├── news/               # Новости
│   │   ├── [slug]/             # Ручные страницы
│   │   ├── programs/           # Программы
│   │   ├── trainers/           # Тренеры
│   │   ├── schedule/           # Расписание
│   │   ├── contacts/           # Контакты
│   │   └── api/                # API
│   ├── components/
│   │   ├── ui/                 # UI
│   │   ├── home/               # Главная
│   │   └── admin/              # Админ
├── data/                       # Доп. данные
│   ├── pages.json              # Страницы
│   └── footer.json             # Футер
├── public/uploads/             # Файлы
├── db.json                     # БД
└── package.json
```

---

## 📄 Страницы

- `page.tsx` - Главная
- `admin/page.tsx` - Админ
- `news/page.tsx` - Новости
- `[slug]/page.tsx` - Ручные страницы
- `programs/`, `trainers/`, `schedule/`, `contacts/`, `lk/`

---

## 🔌 API

- `/api/db` - База данных
- `/api/programs`, `/api/trainers`, `/api/news`
- `/api/pages`, `/api/pages/[slug]`
- `/api/admin/pages`, `/api/admin/footer`
- `/api/upload`, `/api/send-email`, `/api/autoupload`

---

## 🧩 Компоненты

- UI: SiteHeader, Footer, CallModal, FileInput, SectionSpacer
- Home: HomeSlider, HomeSchedule, HomePrices, HomePrograms, HomeTrainers, HomeNews
- Admin: AdminTabs, AdminSlider, AdminPrograms, AdminNews, AdminPages, AdminFooter

---

## 📝 Notes

- Next.js 15, React 18, TypeScript
- Tailwind CSS + CSS Modules
- JSON БД

---

*Обновлено: 2026*
