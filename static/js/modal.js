/**
 * Форма обратного звонка.
 * Логика отправки: POST /api/admin/lead-create → запись в leads.json.
 * Если API недоступен (чистый статический предпросмотр) — fallback на mailto.
 */
(function () {
  const API_ENDPOINT = '/api/admin/lead-create';
  const FALLBACK_EMAIL = 'centr-fr@yandex.ru';

  let currentReason = 'Общий запрос';

  // S155: человекочитаемое имя текущей страницы с точными деталями (имя сущности).
  // ⚠️ Строки уходят в причину звонка в письме (S104) — менять осознанно.
  function pageName() {
    var sec = function (id, fb) {
      return (window.Layout && window.Layout.sectionName(id, fb)) || fb;
    };
    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var map = {
      '': 'Главная', 'index.html': 'Главная',
      'news.html': sec('news', 'Новости'),
      'programs.html': sec('programs', 'Программы'),
      'program.html': 'Программа',
      'trainers.html': sec('trainers', 'Коллектив'),
      'trainer.html': 'Тренер',
      'directions.html': 'Направление',
      'album.html': 'Альбом',
      'crm.html': 'CRM',
      'lk.html': 'Личный кабинет'
    };
    var base = map[file] || (document.title ? document.title.trim() : 'Сайт');

    // S155: добавляем имя сущности (тренер/программа/направление/новость) по ?id=.
    var data = (window.SITE_DATA || {});
    var rawId = new URLSearchParams(location.search).get('id');
    if (!rawId) return base;
    var pairs = [
      { list: 'trainers', label: 'Тренер' },
      { list: 'programs', label: 'Программа' },
      { list: 'directions', label: 'Направление' },
      { list: 'news',     label: 'Новость' }
    ];
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      var items = (data[p.list] || []);
      var found = null;
      for (var j = 0; j < items.length; j++) {
        var sl = String(items[j].slug || items[j].id);
        if (sl === rawId || sl === decodeURIComponent(rawId)) {
          found = items[j];
          break;
        }
        // S155: также ищем по numeric id (программа/тренер загружены по ?id=N)
        if (items[j].id != null && String(items[j].id) === rawId) {
          found = items[j];
          break;
        }
      }
      if (found) return p.label + ': ' + found.name;
    }
    return base + ' (id=' + rawId + ')';
  }

  // S155: единый формат причины.
  // Для кнопок в шапке/подвале/плавающей — «Есть вопрос…»,
  // для кнопок на страницах сущностей — точное место без «шума».
  function buildReason(place) {
    var p = (place && String(place).trim()) || 'Сайт';
    var page = pageName();
    // Generic call points — кнопка не привязана к сущности
    var isGeneric = /^(Кнопка в хедере|Кнопка в мобильном меню|Шапка(?: \(мобильное меню\))?|Подвал|Плавающая кнопка)/.test(p);
    if (isGeneric) {
      return p + '. Есть вопрос, но, возможно без конкретики (страница: ' + page + ')';
    }
    // Конкретное место — пишем точно
    return p + ' (страница: ' + page + ')';
  }

  function buildModal() {
    if (document.getElementById('callModalRoot')) return;

    const root = document.createElement('div');
    root.id = 'callModalRoot';
    root.innerHTML = `
      <div class="modal-overlay" id="callOverlay">
        <div class="modal-box">
          <div class="modal-header">
            <h2 class="modal-title">
              Заказать обратный звонок
            </h2>
            <button type="button" class="modal-close" id="callCloseBtn" aria-label="Закрыть">×</button>
          </div>

          <form class="modal-form" id="callForm">
            <input type="text" name="name" placeholder="Ваше имя *" required>
            <input type="tel" name="phone" placeholder="+7 (___) ___-__-__ *" required>
            <input type="email" name="email" placeholder="email@example.com">
            <textarea name="message" rows="4" placeholder="Комментарий (необязательно)"></textarea>

            <div class="modal-error" id="callError" hidden></div>

            <button type="submit" class="modal-submit" id="callSubmit">
              <span id="callSubmitText"><i class="icon-call"></i> Заказать звонок</span>
            </button>
          </form>

            <div class="modal-success" id="callSuccess" hidden>
            <div class="modal-success-icon">✅</div>
            <h3>Заявка отправлена!</h3>
            <p id="callSuccessText"></p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    // Закрытие: крестик
    document.getElementById('callCloseBtn').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.closeCallModal();
    });

    // Закрытие: клик по затемнённому фону (вне окна)
    document.getElementById('callOverlay').addEventListener('click', function (e) {
      if (e.target === this) window.closeCallModal();
    });

    document.getElementById('callForm').addEventListener('submit', handleSubmit);
  }

  window.openCallModal = function (place) {
    buildModal();
    // S104: пользователь место вызова не видит — причина только для письма/заявки.
    currentReason = buildReason(place);
    document.getElementById('callForm').hidden = false;
    document.getElementById('callSuccess').hidden = true;
    document.getElementById('callError').hidden = true;
    document.getElementById('callOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeCallModal = function () {
    const overlay = document.getElementById('callOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('callSubmit');
    const btnText = document.getElementById('callSubmitText');
    const errBox = document.getElementById('callError');

    const payload = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
      reason: currentReason,
      page: pageName(),
      ua: navigator.userAgent
    };

    btn.disabled = true;
    btnText.textContent = 'Отправляем...';
    errBox.hidden = true;

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('server');

      showSuccess(form);
    } catch (err) {
      // Fallback: открываем письмо с заполненными данными
      const subject = encodeURIComponent('Заявка: ' + payload.name + ' (' + payload.reason + ')');
      const body = encodeURIComponent(
        'Имя: ' + payload.name + '\nТелефон: ' + payload.phone +
        '\nEmail: ' + payload.email + '\nЖелание: ' + payload.reason +
        '\nСообщение: ' + payload.message
      );
      window.location.href = 'mailto:' + FALLBACK_EMAIL + '?subject=' + subject + '&body=' + body;

      errBox.textContent = 'Прямая отправка недоступна — открылось почтовое приложение. Если не открылось, напишите нам: ' + FALLBACK_EMAIL;
      errBox.hidden = false;
    } finally {
      btn.disabled = false;
      btnText.innerHTML = '<i class="icon-call"></i> Заказать звонок';
    }
  }

  function showSuccess(form) {
    form.reset();
    form.hidden = true;
    // S152: текст подтверждения из админки (siteSettings.callSuccessText)
    var text = (window.SITE_DATA && window.SITE_DATA.siteSettings && window.SITE_DATA.siteSettings.callSuccessText)
      || 'Свяжемся, как только сможем';
    document.getElementById('callSuccessText').textContent = text;
    document.getElementById('callSuccess').hidden = false;
    setTimeout(function () {
      closeCallModal();
      form.hidden = false;
      document.getElementById('callSuccess').hidden = true;
    }, 3000);
  }

  // ESC закрывает модалку
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCallModal();
  });
})();
