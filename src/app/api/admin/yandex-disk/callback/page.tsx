// Страница callback для Яндекс OAuth
// Яндекс возвращает токен в hash части URL: #token=xxx&expires_in=xxx

'use client';

import { useEffect, useState } from 'react';

export default function YandexCallback() {
  const [status, setStatus] = useState('Обработка...');

  useEffect(() => {
    // Получаем токен из hash части URL
    const hash = window.location.hash.substring(1); // Убираем #
    const params = new URLSearchParams(hash);
    const token = params.get('token');

    if (token) {
      // Отправляем токен в родительское окно
      if (window.opener) {
        window.opener.postMessage({ type: 'yandex-token', token }, '*');
        setStatus('✅ Авторизация успешна! Окно закроется...');
        setTimeout(() => window.close(), 1500);
      } else {
        // Если нет opener, сохраняем в localStorage и перенаправляем
        localStorage.setItem('yandex-token', token);
        setStatus('✅ Токен сохранён! Перенаправление...');
        setTimeout(() => window.location.href = '/admin', 1500);
      }
    } else {
      // Проверяем, возможно токен в параметрах
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');
      
      if (error) {
        setStatus(`❌ Ошибка: ${error}`);
        if (window.opener) {
          window.opener.postMessage({ type: 'yandex-error', error }, '*');
          setTimeout(() => window.close(), 2000);
        }
      } else {
        setStatus('❌ Токен не получен');
      }
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
      color: 'white'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '1rem'
      }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{status}</h1>
        <p style={{ opacity: 0.7 }}>Яндекс.ID Авторизация</p>
      </div>
    </div>
  );
}
