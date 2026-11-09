document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('footer-container');
  if (!container) return;

  const data = window.SITE_DATA;
  const c = data.contacts;

  // S106: скрытый раздел главной → не рендерим и ссылку на него в подвале.
  function homeSectionVisible(id) {
    var hs = (window.SITE_DATA || {}).homeSections;
    if (!Array.isArray(hs)) return true;
    var s = hs.filter(function (x) { return x.id === id; })[0];
    return !s || s.visible !== false;
  }

  // Секции есть только на главной: там якорь, с других страниц — ссылка на главную
  const page = (location.pathname.split('/').pop() || '') || 'index.html';
  const isHome = page === 'index.html';
  const href = (anchor) => isHome ? anchor : 'index.html' + anchor;

  // S127 (Р1): единое имя раздела из справочника settings.sectionNames
  function secName(id, fallback) {
    return (window.Layout && window.Layout.sectionName(id, fallback)) || fallback;
  }

  // Адрес и карты (S47)
  const YANDEX_MAPS = 'https://yandex.ru/maps/-/CXRGU2p2';
  const TWO_GIS = 'https://go.2gis.com/WzwQ2';

  // Соцсети рендерим из данных (Telegram убран, BALLOO убран, есть MAX)
  const icons = { vk: '📘', max: '🔵' };
  const socialHtml = (c.social || []).filter(s => s.id !== 'balloo').map(s => {
    if (!s.url) {
      return `
        <div class="footer-social-item footer-social-disabled">
          <span class="footer-social-icon">${icons[s.id] || '🔗'}</span>
          <div>
            <p class="footer-social-title">${s.title}</p>
            <p class="footer-social-sub">Скоро здесь</p>
          </div>
        </div>`;
    }
    return `
      <a href="${s.url}" target="_blank" rel="noopener" class="footer-social-item">
        <span class="footer-social-icon">${icons[s.id] || '🔗'}</span>
        <div>
          <p class="footer-social-title">${s.title}</p>
          <p class="footer-social-sub">Перейти</p>
        </div>
      </a>`;
  }).join('') + `
      <a href="${YANDEX_MAPS}" target="_blank" rel="noopener" class="footer-social-item">
        <span class="footer-social-icon">📍</span>
        <div>
          <p class="footer-social-title">Адрес на Яндекс.Картах</p>
          <p class="footer-social-sub">${c.address}</p>
        </div>
      </a>
      <a href="${TWO_GIS}" target="_blank" rel="noopener" class="footer-social-item">
        <span class="footer-social-icon">🗺</span>
        <div>
          <p class="footer-social-title">2ГИС</p>
          <p class="footer-social-sub">Открыть в 2ГИС</p>
        </div>
      </a>`;

  // ── S113: ссылки подвала из данных (админка «🔗 Ссылки подвала») ──
  // footerLinks отсутствует (null/undefined) → жёсткий fallback, чтобы без
  // данных ничего не пропало. Массив (даже пустой) — рисуем только из него.
  const fl = (window.SITE_DATA || {}).footerLinks;
  const fromData = Array.isArray(fl);
  // S127 (Р1): устаревшие подписи раздела тренеров заменяются единым именем
  // из справочника. Собственная формулировка админа (не из списка) сохраняется.
  const LEGACY_TRAINER_TITLES = ['тренеры', 'тренер', 'наш коллектив', 'наши тренера',
    'коллектив', '👥 тренеры', '👥 наш коллектив', '👥 коллектив'];
  function sectionAwareTitle(x) {
    const t = String(x.title || '').trim();
    if (x.url === 'trainers.html' && LEGACY_TRAINER_TITLES.includes(t.toLowerCase())) {
      return '👥 ' + secName('trainers', 'Коллектив');
    }
    return t;
  }
  function linkLi(x) {
    // Ссылка на якорь скрытого раздела главной не показывается
    if (x.url === '#schedule' && !homeSectionVisible('schedule')) return '';
    if (x.url === '#prices' && !homeSectionVisible('prices')) return '';
    const url = x.url.charAt(0) === '#' ? href(x.url) : x.url;
    const ext = /^https?:\/\//i.test(x.url);
    return `<li><a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}>${sectionAwareTitle(x)}</a></li>`;
  }
  function groupHtml(group, fallback) {
    if (!fromData) return fallback;
    return fl.filter(function (x) { return x.group === group; }).map(linkLi).join('');
  }
  const navFallback = `
              ${homeSectionVisible('schedule') ? `<li><a href="${href('#schedule')}">📅 Расписание</a></li>` : ''}
              ${homeSectionVisible('prices') ? `<li><a href="${href('#prices')}">💰 Цены</a></li>` : ''}
              <li><a href="programs.html">🥋 ${secName('programs', 'Наши тренировки')}</a></li>
              <li><a href="trainers.html">👥 ${secName('trainers', 'Коллектив')}</a></li>
              <li><a href="news.html">📰 ${secName('news', 'Новости')}</a></li>
              <li><a href="lk.html">👤 Личный кабинет</a></li>`;
  const partnersFallback = `
              <li><a href="https://www.usfu.ru/" target="_blank" rel="noopener">🐼 Урало-Сибирская федерация ушу</a></li>`;
  const partnersHtml = groupHtml('partners', partnersFallback);

  container.innerHTML = `
    <footer class="footer" id="footer">
      <div class="container">
        <div class="footer-grid">

          <div>
            <a href="index.html" class="footer-logo">
              <img src="logo.png" alt="Логотип Шифу Панда">
              <span class="footer-logo-text">Шифу Панда</span>
            </a>
            <p class="footer-subtitle">Центр Функционального Развития</p>
            <div class="footer-contact">
              <span>📍</span>
              <a href="${YANDEX_MAPS}" target="_blank" rel="noopener">${c.address}</a>
            </div>
            <div class="footer-contact">
              <span>📞</span>
              <a href="tel:${c.phone.replace(/\D/g,'')}">${c.phone}</a>
            </div>
            <div class="footer-contact">
              <span>✉️</span>
              <a href="mailto:${c.email}">${c.email}</a>
            </div>
            <button class="footer-call-btn" onclick="openCallModal('Подвал')">
              <i class="icon-call"></i> Заказать звонок
            </button>
          </div>

          <div>
            <h4>Перейти к</h4>
            <ul class="footer-links">${groupHtml('nav', navFallback)}</ul>
            ${partnersHtml ? `
            <!-- S112: «Наши партнёры» — под блоком ссылок сайта -->
            <h4 style="margin-top:1rem;">Наши партнёры</h4>
            <ul class="footer-links">${partnersHtml}</ul>` : ''}
          </div>

          <div>
            <h4>Мы в сети</h4>
            <div class="footer-social">${socialHtml}</div>
          </div>

        </div>

        <div class="footer-bottom">
          <p>© 2026 Шифу Панда. Екатеринбург. Все права защищены.</p>
          <!-- Отдельное подменю «Служебное»: CRM и Админка (S34) -->
          <details class="footer-service-menu">
            <summary>Служебное</summary>
            <span class="footer-service-row">
              <a href="crm.html">CRM</a>
              <span aria-hidden="true">·</span>
              <a href="admin.html">Админка</a>
            </span>
            <!-- Подпись (S47): вторая строка служебного подменю -->
            <p class="footer-signature">OIA.UYe by KodaCode</p>
          </details>
        </div>
      </div>
    </footer>
  `;

  // Применяем siteSettings (S75). S126: alt логотипа и копирайт — тоже из «Главных данных»
  var settings = (window.SITE_DATA || {}).siteSettings || {};
  var footerTitle = document.querySelector('.footer-logo-text');
  if (footerTitle && settings.title1) footerTitle.textContent = settings.title1;
  var footerSubtitle = document.querySelector('.footer-subtitle');
  if (footerSubtitle && settings.title2) footerSubtitle.textContent = settings.title2;
  var footerLogo = document.querySelector('.footer-logo img');
  if (footerLogo && settings.logo) { footerLogo.src = settings.logo; footerLogo.alt = settings.title1 || 'Логотип'; }
  else if (footerLogo && settings.title1) { footerLogo.alt = settings.title1; }
  // Копирайт: имя из title1 (или title2), год — текущий
  var copyright = document.querySelector('.footer-bottom p');
  if (copyright && (settings.title1 || settings.title2)) {
    copyright.textContent = '© ' + new Date().getFullYear() + ' ' +
      (settings.title1 || settings.title2) + '. Екатеринбург. Все права защищены.';
  }

});
