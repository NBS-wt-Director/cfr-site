'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, AlertTriangle, Copy } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function NotFound() {
  const [errorSent, setErrorSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState('');
  const [countdown, setCountdown] = useState(15);
  const [isClient, setIsClient] = useState(false);
  const [language, setLanguage] = useState('ru-RU');
  const router = useRouter();

  // Определяем, что мы на клиенте
  useEffect(() => {
    setIsClient(true);
    if (typeof navigator !== 'undefined') {
      setLanguage(navigator.language);
    }
  }, []);

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
    // Автоматическая отправка отчета об ошибке
    if (isClient) {
      sendErrorReport();
    }
  }, [isClient]);

  const sendErrorReport = async () => {
    if (typeof window === 'undefined') return;
    
    setLoading(true);
    try {
      const errorData = {
        type: '404_NOT_FOUND',
        url: window.location.href,
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
        language: navigator.language
      };

      await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      });

      setErrorSent(true);
      console.log('✅ Отчет об ошибке отправлен');
    } catch (err) {
      console.error('Ошибка отправки отчета:', err);
      setErrorInfo('Не удалось отправить отчет');
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-400 to-yellow-400">
      {/* ✅ HEADER ВЫНЕСЕН ВVERХУ */}
       <Header 
        pageTitle="404 - Страница не найдена"
      />
      
      {/* ✅ 404 КОНТЕНТ ПОСЛЕ HEADER */}
      <div className="flex-1 flex items-center justify-center p-8 pt-24 pb-12">
        <div className="max-w-2xl w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-white/50">
          {/* Заголовок */}
          <div className="text-center mb-12">
            <AlertTriangle className="w-24 h-24 mx-auto mb-6 text-red-500 drop-shadow-2xl animate-pulse" />
            <h1 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-gray-900 to-red-600 bg-clip-text text-transparent mb-4">
              404
            </h1>
            <p className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Страница не найдена</p>
            <p className="text-xl text-gray-600 max-w-md mx-auto">
              Запрашиваемая страница не существует или была удалена
            </p>
          </div>

          {/* Детали ошибки */}
          <div className="space-y-6 mb-12">
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <span className="font-bold text-lg text-red-800">Детали ошибки</span>
              </div>
              <div className="space-y-2 text-sm">
                <p></p>
                <p><span className="font-bold">Время:</span> {new Date().toLocaleString('ru-RU')}</p>
                <p><span className="font-bold">Язык:</span> {language}</p>
              </div>
            </div>

            {errorSent && (
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
                <Mail className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-bold text-green-800">✅ Отчет отправлен на i@o8eryuhtin.ru</p>
                <p className="text-sm text-green-700 mt-2">Спасибо за сообщение об ошибке!</p>
              </div>
            )}

            {errorInfo && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
                <p className="text-lg font-bold text-yellow-800">{errorInfo}</p>
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
          <div className="grid md:grid-cols-2 gap-6 pt-8 border-t border-gray-200">
            <a 
              href="/"
              className="group flex items-center justify-center gap-3 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white py-6 px-8 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300"
            >
              <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-all" />
              <span>На главную</span>
            </a>
            <button
              onClick={copyUrl}
              className="group flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-6 px-8 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300"
            >
              <Copy className="w-6 h-6" />
              <span>Копировать URL</span>
            </button>
          </div>
        </div>
      </div>

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 text-center shadow-2xl border border-white/50 max-w-md w-full mx-4">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-xl font-bold text-gray-800 mb-2">Отправляем отчет об ошибке...</p>
            <p className="text-sm text-gray-600">Это займет несколько секунд</p>
          </div>
        </div>
      )}
      <Footer/>
    </div>
  );
}
