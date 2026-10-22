document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('footer-container');
  if (!container) return;

  const data = window.SITE_DATA;
  const c = data.contacts;

  // Секции есть только на главной: там якорь, с других страниц — ссылка на главную
  const page = (location.pathname.split('/').pop() || '') || 'index.html';
  const isHome = page === 'index.html';
  const href = (anchor) => isHome ? anchor : 'index.html' + anchor;

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

  container.innerHTML = `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">

          <div>
            <a href="index.html" class="footer-logo">
              <img src="logo.png" alt="Логотип Шифу Панда">
              <span>Шифу Панда</span>
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
            <button class="footer-call-btn" onclick="openCallModal('заказать звонок из футера')">
              📲 Заказать звонок
            </button>
          </div>

          <div>
            <h4>Перейти к</h4>
            <ul class="footer-links">
              <li><a href="${href('#schedule')}">📅 Расписание</a></li>
              <li><a href="${href('#prices')}">💰 Цены</a></li>
              <li><a href="programs.html">🥋 Программы</a></li>
              <li><a href="trainers.html">👥 Тренеры</a></li>
              <li><a href="news.html">📰 Новости</a></li>
              <li><a href="album.html">🖼 Альбом</a></li>
              <li><a href="lk.html">👤 Личный кабинет</a></li>
            </ul>
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
});
