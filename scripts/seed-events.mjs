// S166: предзаполнение мероприятий — 2 планируемых + 2 прошедших, все поля.
// Запуск: node scripts/seed-events.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db.json');

const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
if (Array.isArray(db.events) && db.events.length) {
  console.log('events уже есть в базе (', db.events.length, ') — сид пропускается');
  process.exit(0);
}

// Существующие картинки для обложек/галерей (проверяем, что файл на диске)
const pick = (p) => fs.existsSync(path.join(root, 'static', p)) ? p : null;

const events = [
  {
    id: 1794600000001,
    name: 'Семинар по функциональной подготовке',
    type: 'семинар',
    dateStart: '2026-12-06T11:00',
    dateEnd: '2026-12-06T14:00',
    image: pick('uploads/covers/p-funktsionalnyy-trening.jpg') || '',
    shortDescription: 'Три часа практики: мобилизации, координация, работа с весом тела.',
    description: [
      '## О чём семинар',
      '',
      'Разбираем **функциональную подготовку** применительно к реальным движениям:',
      'как тело переносит нагрузку, где теряется сила и что делать с зажимами.',
      '',
      '### Программа',
      '',
      '- Разминка и диагностика подвижности суставов',
      '- Мобилизации шейного отдела и рёбер',
      '- Работа в парах: сопротивление и перемещения',
      '- Итоговая связка под нагрузкой',
      '',
      '### Кому подойдёт',
      '',
      'Тренерам, спортсменам и всем, кто хочет понимать собственное тело.',
      'Уровень — любой, группа до 16 человек.',
      '',
      'Стоимость участия и запись — по телефону или через кнопку «Записаться».',
    ].join('\n'),
    reviews: [],
    photoAlbum: [],
    videos: [],
    hidden: false,
    newsId: null,
    createdAt: '2026-11-12',
    updatedAt: '2026-11-12',
  },
  {
    id: 1794600000002,
    name: 'Открытое мероприятие: день открытых дверей',
    type: 'открытое_мероприятие',
    dateStart: '2026-12-20T10:00',
    dateEnd: '2026-12-20T13:00',
    image: pick('uploads/covers/p-gimnastika-dlya-sustavov.jpg') || '',
    shortDescription: 'Пробные тренировки по всем направлениям, знакомство с тренерами.',
    description: [
      '## День открытых дверей',
      '',
      'Приходите всей семьёй: в этот день **все тренировки бесплатные**.',
      '',
      '### В программе',
      '',
      '- Пробные занятия: ушу, ОФП, гимнастика для суставов, акробатика',
      '- Знакомство с тренерами и расписанием на январь',
      '- Мини-выступление учеников (12:00, большой зал)',
      '',
      'Форму лучше взять с собой. Вход свободный, но количество мест ограничено —',
      'запишитесь через кнопку «Записаться».',
    ].join('\n'),
    reviews: [],
    photoAlbum: [],
    videos: [],
    hidden: false,
    newsId: null,
    createdAt: '2026-11-12',
    updatedAt: '2026-11-12',
  },
  {
    id: 1794600000003,
    name: 'Тестирование на ученические разряды',
    type: 'тестирование',
    dateStart: '2026-10-15T12:00',
    dateEnd: '2026-10-15T17:00',
    image: pick('uploads/covers/p-akrobatika-dlya-mozga.jpg') || '',
    shortDescription: 'Приём нормативов на 3-й и 2-й ученические разряды по ушу.',
    description: [
      '## Тестирование 15 октября',
      '',
      'Провели приём нормативов на ученические разряды. Комиссия оценивала:',
      '',
      '- базовые стойки и положения',
      '- комплексы «первая форма» и «вторая форма»',
      '- технику падений и кувырков',
      '- общую физическую подготовку',
      '',
      '### Результаты',
      '',
      '14 из 17 участников получили заявленные разряды. Поздравляем!',
      'Следующее тестирование — в декабре, запись через тренера.',
    ].join('\n'),
    reviews: [
      { name: 'Ковалёв Артём', text: 'Готовился два месяца. Атмосфера на сдаче спокойная, комиссия объяснила каждую оценку. Получил 3-й разряд!' },
      { name: 'Смирнова Ольга', text: 'Сдавала вместе с сыном — очень поддерживающий формат. Дочка теперь тоже записалась.' },
    ],
    photoAlbum: [
      { image: pick('uploads/covers/p-feys-bilding.jpg') || '', caption: 'Разминка перед приёмом нормативов', title: 'Разминка перед приёмом нормативов', description: 'Суставная мобилизация и координация — обязательный блок перед тестами.', position: 'bottom-center', overlay: { enabled: true, color: '#000000', opacity: 0.45 } },
      { image: pick('uploads/covers/p-greko-rimskaya-borba.jpg') || '', caption: 'Работа в парах', title: 'Работа в парах', description: 'Парные нормативы: страховка, темп, точность.', position: 'center-left' },
      { image: pick('uploads/covers/p-koordinatsiya.jpg') || '', caption: 'Блок координации', title: 'Блок координации', description: 'Координационные связки на время.', position: 'top-center' },
    ].filter(a => a.image),
    videos: [
      { title: 'Выступление участников тестирования', url: 'https://vk.com/video-123456789_1234' },
    ],
    hidden: false,
    newsId: null,
    createdAt: '2026-09-20',
    updatedAt: '2026-10-15',
  },
  {
    id: 1794600000004,
    name: 'Праздник окончания летнего сезона',
    type: 'праздник',
    dateStart: '2026-09-01T11:00',
    dateEnd: '2026-09-01T15:00',
    image: pick('uploads/covers/p-izobrazitelnoe-iskusstvo-4.jpg') || '',
    shortDescription: 'Показательные выступления, награждения и семейные эстафеты.',
    description: [
      '## Итоги летнего сезона',
      '',
      'Закончили сезон большим семейным праздником:',
      '',
      '- показательные выступления групп',
      '- награждение самых посещаемых учеников',
      '- эстафеты «родитель + ребёнок»',
      '- чаепитие и общее фото у стенда',
      '',
      'Спасибо всем, кто был с нами всё лето! Фотографии — в галерее ниже,',
      'видео выступления — по ссылке.',
    ].join('\n'),
    reviews: [
      { name: 'Гилева Анна', text: 'Праздникsuper! Ребёнок до сих пор пересматривает своё выступление. Ждём зимний сезон.' },
      { name: 'Панкратов Игорь', text: 'Организация на высоте: успели всё — и выступления, и эстафеты, и награждение.' },
      { name: 'Дмитриева Мария', text: 'Пришли первый раз — ушли с записью на сентябрьскую группу. Спасибо тренерам!' },
    ],
    photoAlbum: [
      { image: pick('uploads/covers/p-krepyshi-2-4-goda.jpg') || '', caption: 'Самая младшая группа на эстафете', title: 'Самая младшая группа на эстафете', description: 'Крепыши 2–4 года — первые старты на празднике.', position: 'bottom-left' },
      { image: pick('uploads/covers/p-izobrazitelnoe-iskusstvo-4.jpg') || '', caption: 'Творческая зона праздника', title: 'Творческая зона праздника', description: 'Рисование, аппликация и мастер-классы для гостей.', position: 'center' },
    ].filter(a => a.image),
    videos: [
      { title: 'Общий показательный блок', url: 'https://vk.com/video-123456789_2345' },
      { title: 'Награждение учеников', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    ],
    hidden: false,
    newsId: null,
    createdAt: '2026-08-15',
    updatedAt: '2026-09-01',
  },
];

db.events = events;

// Пункт верхнего меню — видимость настраивается в «Шапке» админки
if (Array.isArray(db.headerSettings?.items) &&
    !db.headerSettings.items.some(i => i && i.id === 'events')) {
  db.headerSettings.items.push({ id: 'events', visible: true });
}

// Ссылка в подвал («Перейти к»)
if (Array.isArray(db.footerLinks) && !db.footerLinks.some(l => l && /events\.html/.test(String(l.url)))) {
  const idx = db.footerLinks.findIndex(l => l && l.id === 'nav-news');
  const link = { id: 'nav-events', group: 'nav', title: '🎪 Мероприятия', url: 'events.html', visible: true };
  if (idx !== -1) db.footerLinks.splice(idx + 1, 0, link); else db.footerLinks.push(link);
}

fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf-8');
console.log('✅ Сид events выполнен:', events.length, 'мероприятий (2 плана + 2 прошедших)');
console.log('   headerSettings.items: events добавлен');
console.log('   footerLinks: ссылка на events.html добавлена');
