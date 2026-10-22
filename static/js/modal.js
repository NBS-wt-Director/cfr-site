/**
 * Форма обратного звонка.
 * Логика отправки идентична Next.js CallModal: POST /api/send-email
 * Тело: { name, phone, email, message, reason }
 *
 * Если API недоступен (чистый статический предпросмотр) — fallback на mailto.
 */
(function () {
  const API_ENDPOINT = '/api/send-email';
  const FALLBACK_EMAIL = 'centr-fr@yandex.ru';

  let currentReason = 'Общий запрос';

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
              <span class="modal-reason" id="callReasonLabel"></span>
            </h2>
            <button type="button" class="modal-close" id="callCloseBtn" aria-label="Закрыть">×</button>
          </div>

          <form class="modal-form" id="callForm">
            <input type="text" name="name" placeholder="Ваше имя *" required>
            <input type="tel" name="phone" placeholder="+7 (___) ___-__-__ *" required>
            <input type="email" name="email" placeholder="email@example.com">
            <input type="text" name="reasonView" id="callReasonField" readonly class="readonly">
            <textarea name="message" rows="4" placeholder="Комментарий (необязательно)"></textarea>

            <div class="modal-error" id="callError" hidden></div>

            <button type="submit" class="modal-submit" id="callSubmit">
              <span id="callSubmitText">📞 Заказать звонок</span>
            </button>
          </form>

          <div class="modal-success" id="callSuccess" hidden>
            <div class="modal-success-icon">✅</div>
            <h3>Заявка отправлена!</h3>
            <p>Мы перезвоним вам в течение 15 минут</p>
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

  window.openCallModal = function (reason) {
    buildModal();
    currentReason = reason || 'Общий запрос';
    document.getElementById('callReasonLabel').textContent = '«' + currentReason + '»';
    document.getElementById('callReasonField').value = currentReason;
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
      reason: currentReason
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
      btnText.textContent = '📞 Заказать звонок';
    }
  }

  function showSuccess(form) {
    form.reset();
    form.hidden = true;
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
