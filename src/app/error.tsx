'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Bug, Copy, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const [errorSent, setErrorSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState('');
  const [countdown, setCountdown] = useState(15);
  const router = useRouter();

  // Обратный отсчёт и редирект
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    // Автоматическая отправка отчета
    sendErrorReport();
  }, []);

  const sendErrorReport = async () => {
    setLoading(true);
    try {
      const errorData = {
        type: 'SERVER_ERROR_500',
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: window.location.href,
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
        language: navigator.language
      };

      const res = await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      });

      if (res.ok) {
        setErrorSent(true);
        console.log('✅ Отчет 500 отправлен');
      }
    } catch (err) {
      console.error('Ошибка отправки отчета 500:', err);
      setErrorInfo('Не удалось отправить отчет');
    } finally {
      setLoading(false);
    }
  };

  const copyError = () => {
    const errorText = `Ошибка: ${error.message}\nURL: ${window.location.href}\nВремя: ${new Date().toLocaleString('ru-RU')}`;
    navigator.clipboard.writeText(errorText);
    alert('Ошибка скопирована!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-900 via-red-900 to-orange-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-white/50">
        {/* Заголовок */}
        <div className="text-center mb-12">
          <Bug className="w-24 h-24 mx-auto mb-6 text-rose-500 drop-shadow-2xl animate-bounce" />
          <h1 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-gray-900 to-rose-600 bg-clip-text text-transparent mb-4">
            500
          </h1>
          <p className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Что-то пошло не так</p>
          <p className="text-xl text-gray-600 max-w-md mx-auto">
            Произошла внутренняя ошибка сервера
          </p>
        </div>

        {/* Детали ошибки */}
        <div className="space-y-6 mb-12">
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <Bug className="w-6 h-6 text-rose-500" />
              <span className="font-bold text-lg text-rose-800">Причина ошибки</span>
            </div>
            <div className="space-y-2 text-sm bg-rose-100 p-4 rounded-xl font-mono text-rose-900 overflow-auto max-h-32">
              <p><strong>Сообщение:</strong> {error.message || 'Неизвестная ошибка'}</p>
              {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
              <p><strong>URL:</strong> {window.location.href}</p>
              <p><strong>Время:</strong> {new Date().toLocaleString('ru-RU')}</p>
            </div>
          </div>

          {errorSent && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
              <p className="text-lg font-bold text-emerald-800">✅ Отчет отправлен на i@o8eryuhtin.ru</p>
              <p className="text-sm text-emerald-700 mt-2">Разработчики уже работают над проблемой!</p>
            </div>
          )}
        </div>

        {/* Обратный отсчёт */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center mb-8">
          <p className="text-lg text-amber-800 mb-2">Автоматический переход на главную через:</p>
          <div className="text-5xl font-black text-amber-600">{countdown}</div>
          <p className="text-sm text-amber-700 mt-2">секунд</p>
        </div>

        {/* Действия */}
        <div className="grid md:grid-cols-3 gap-6 pt-8 border-t border-gray-200">
          <button
            onClick={reset}
            className="group flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-6 px-8 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 md:col-span-2"
          >
            <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-all" />
            Попробовать снова
          </button>
          <button
            onClick={copyError}
            className="group flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-6 px-8 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300"
          >
            <Copy className="w-6 h-6" />
            Копировать
          </button>
          <a 
            href="/"
            className="group flex items-center justify-center gap-3 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white py-6 px-8 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300"
          >
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-all" />
            На главную
          </a>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-3xl">
            <div className="text-center text-white">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
              <p>Отправляем отчет...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
