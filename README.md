# 🐼 Шифу Панда — Центр Функционального Развития

Полнофункциональный веб-сайт спортивного центра с системой управления контентом (CMS).

## 🚀 Возможности

### Публичные страницы
- **Главная страница** — слайдер, расписание, цены, программы, тренеры, новости, контакты
- **Программы тренировок** — каталог программ с детальными страницами
- **Тренеры** — профили с опытом, специализацией и фотоальбомом
- **Расписание** — отображение расписания занятий
- **Контакты** — страница с контактами, картой и подписками на соцсети
- **Личный кабинет** — для зарегистрированных пользователей
- **Медиагалерея** — слайдер всех фото тренеров и программ с ссылками на источник
- **Новости** — отображение новостей центра с фото и видео
- **Ручные страницы** — создаваемые страницы с поддержкой Markdown/HTML

### Админ-панель
- **Хедер** — настройка заголовка, анимаций, компонентов
- **Слайдер** — управление слайдами с настраиваемым положением текста
- **Расписание и цены** — загрузка изображений
- **Программы** — полное управление программами тренировок
- **Сотрудники** — управление тренерами и персоналом
- **Новости** — публикация событий центра с фото и видео
- **Страницы** — создание ручных страниц с Markdown/HTML
- **Футер** — настройка отображения футера
- **Контакты** — основные контакты центра
- **Доп. контакты** — подписки на соцсети и Яндекс.Карта
- **Разделы** — настройка секций главной страницы
- **Разделители** — оформление разделителей между секциями
- **Настройки** — SMTP, логотип, favicon
- **Статистика** — посещаемость сайта
- **Автозагрузка** — импорт контента с Яндекс.Диска
- **Файлы** — управление загруженными файлами

## 🛠 Технологии

- **Frontend:** Next.js 14, React 18, TypeScript
- **Стили:** Tailwind CSS + CSS Modules
- **Backend:** Next.js API Routes
- **База данных:** JSON-файл (db.json) через LowDB
- **Изображения:** Локальная папка public/uploads
- **Облако:** Яндекс.Диск для автозагрузки

## 📋 Структура проекта

```
shifu-panda/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Главная страница
│   │   ├── admin/              # Админ-панель
│   │   ├── contacts/           # Страница контактов
│   │   ├── programs/           # Программы (каталог + детали)
│   │   ├── schedule/           # Расписание
│   │   ├── trainers/           # Тренеры (каталог + детали)
│   │   ├── lk/                 # Личный кабинет
│   │   └── api/                # API маршруты
│   │       ├── db/             # Работа с БД
│   │       ├── upload/         # Загрузка файлов
│   │       ├── send-email/     # Отправка писем
│   │       └── admin/          # Админские функции
│   ├── components/
│   │   ├── ui/                 # Переиспользуемые компоненты
│   │   ├── home/               # Компоненты главной страницы
│   │   └── admin/              # Компоненты админ-панели
├── public/
│   └── uploads/                # Загруженные изображения
├── db.json                     # База данных
└── package.json
```

## 🚀 Запуск

### Установка зависимостей
```bash
cd shifu-panda
npm install
```

### Запуск dev-сервера
```bash
npm run dev
```
Откроется на http://localhost:3000

### Сборка для продакшена
```bash
npm run build
npm start
```

## 📝 Структура базы данных (db.json)

```json
{
  "siteSettings": { "logo": "", "favicon": "", "autoupload": {}, "yandexClientId": "" },
  "schedule": [{ "id": 1, "image": "/расписание1.jpg" }],
  "prices": [{ "id": 1, "image": "/цены1.jpg" }],
  "sections": [
    { "id": "prices", "title": "Наши цены", "background": "indigo-purple", "cols": 1 },
    { "id": "schedule", "title": "Расписание занятий", "background": "yellow-orange", "cols": 4 },
    { "id": "programs", "title": "Программы тренировок", "background": "blue-sky", "cols": 3 },
    { "id": "trainers", "title": "Наши тренеры", "background": "red-pink", "cols": 3 },
    { "id": "news", "title": "Новости центра", "background": "gray-white", "cols": 3 }
  ],
  "globalDivider": { "enabled": true, "height": "md", "background": "gradientGreen", "textContent": "🏃 🏋️ 🧘 💪", "fontSize": "small" },
  "sliders": [{ "id": 1, "title": "Заголовок", "image": "/uploads/slider.jpg", "interval": 5, "position": "center" }],
  "sliderSettings": { "textPositionMode": "static", "staticPosition": "bottom-right", "marginX": 10, "marginY": 10 },
  "programs": [{ "id": 1, "name": "Название", "description": "...", "image": "/uploads/main.jpg", "photoAlbum": [], "trainers": [], "workouts": [] }],
  "trainers": [{ "id": 1, "name": "Имя", "image": "/uploads/trainer.jpg", "experience": "Опыт", "specialization": "...", "description": "...", "photoAlbum": [] }],
  "news": [
    { "id": 1, "title": "Заголовок", "text": "Текст", "image": "/uploads/news.jpg", "videoUrl": "", "mediaType": "image" }
  ],
  "contacts": { "address": "...", "phone": "...", "email": "...", "vk": "...", "telegram": "...", "social": [] },
  "additionalContacts": { "enabled": true, "title": "Подпишитесь на нас", "groups": [], "yandexMap": { "enabled": true, "center": [], "zoom": 15, "placemark": [], "address": "" } },
  "headerSettings": { "titleSuffix": " | Шифу Панда", "componentsEnabled": { "callButton": true, "pageTitle": true, "menu": true }, "componentsOrder": [], "homeMenuEnabled": true, "logoAnimation": "none", "secondLineText": "", "secondLineAnimation": "none" },
  "emailConfig": { "smtpHost": "", "smtpPort": 465, "smtpSecure": true, "smtpUser": "", "smtpPass": "", "fromName": "Шифу Панда", "adminEmail": "", "errorEmail": [] }
}
```

## 📂 Дополнительные файлы данных

### data/pages.json — Ручные страницы
```json
[
  {
    "id": "obuchenie",
    "slug": "/obuchenie",
    "title": "Обучение",
    "content": "Текст страницы",
    "media": "/uploads/page-media.jpg",
    "enabled": true,
    "code": "## Markdown код\n\nТекст с **жирным** и *курсивом*",
    "order": 1
  }
]
```

### data/footer.json — Настройки футера
```json
{
  "enabled": true,
  "showContacts": true,
  "showSocial": true,
  "showCopyright": true,
  "copyrightText": "© 2026 Шифу Панда. Екатеринбург. Все права защищены.",
  "showDevInfo": false,
  "links": [
    { "text": "О нас", "href": "/about" }
  ]
}
```

## 🔧 API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | `/api/db` | Получить/сохранить данные |
| GET | `/api/programs` | Список программ |
| GET | `/api/programs/[id]` | Программа по ID |
| GET | `/api/trainers` | Список тренеров |
| GET | `/api/trainers/[id]` | Тренер по ID |
| POST | `/api/upload/` | Загрузка файла |
| POST | `/api/send-email` | Отправить заявку |
| POST | `/api/admin/autoupload` | Автозагрузка с Яндекс.Диска |
| GET/POST | `/api/admin/stats` | Статистика |
| GET | `/api/pages` | Список включенных страниц |
| GET | `/api/pages/[slug]` | Страница по slug |
| GET/POST/DELETE | `/api/admin/pages` | Управление страницами |
| GET/POST | `/api/admin/footer` | Настройки футера |

## 📱 Новости

Новости хранятся в БД (db.json) и могут содержать:
- **Фото** — загружается через админку или по URL
- **Видео** — загружается напрямую (максимум 2 минуты)

При загрузке видео:
1. Нажмите "📁 Файл" в разделе медиа
2. Выберите видеофайл (mp4, webm)
3. Видео будет загружено на сервер и отображаться с плеером

## 📄 Ручные страницы

Создавайте страницы в админке (вкладка "Страницы"):
- **slug** — адрес в URL (напр. `/obuchenie`)
- **title** — название в меню и title страницы
- **content** — обычный текст
- **media** — фото или видео над текстом
- **code** — Markdown или HTML (если заполнено, content/media игнорируются)
- **enabled** — включить/выключить страницу

Меню страниц автоматически добавляется в футер.

## ⚙️ Настройки слайдера

Поддерживается 3 режима расположения текста:
- **Статично** — текст в одном из 9 положений (углы, центр, между ними)
- **По отдельности** — у каждого слайда своя позиция
- **Случайно** — позиция меняется при каждом показе

9 позиций: top-left, top-center, top-right, middle-left, middle-center, middle-right, bottom-left, bottom-center, bottom-right

## ⚙️ Настройки хедера

- Суффикс title (добавляется к заголовку страницы)
- Включение/отключение компонентов (кнопка звонка, заголовок, меню)
- Порядок компонентов
- Включение меню разделов на главной
- Анимация логотипа (none, pulse, bounce, rotate)
- Вторая строка заголовка
- Анимация второй строки (none, fade, slide, typewriter)

## 👥 Разработка

- **Стиль кода:** TypeScript + Tailwind CSS
- **Форматирование:** ESLint

## 📄 Лицензия

© 2026 Шифу Панда. Екатеринбург. Все права защищены.
