'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface StatsCollectorProps {
  enabled?: boolean;
}

export default function StatsCollector({ enabled = true }: StatsCollectorProps) {
  const pathname = usePathname();
  const prevPathname = useRef<string>('');

  useEffect(() => {
    // Не отправляем если отключено или путь тот же
    if (!enabled || !pathname) return;
    
    const currentPath = pathname || '/';
    if (currentPath === prevPathname.current) return;
    
    // Обновляем предыдущий путь
    prevPathname.current = currentPath;

    // Отправляем статистику посещения страницы
    const sendStats = async () => {
      try {
        // Убеждаемся что pathname начинается со слэша
        const pagePath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
        
        await fetch('/api/admin/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pageview',
            page: pagePath
          })
        });
      } catch (e) {
        // Игнорируем ошибки статистики
      }
    };

    // Небольшая задержка чтобы убедиться что страница загрузилась
    const timer = setTimeout(sendStats, 100);

    return () => clearTimeout(timer);
  }, [pathname, enabled]);

  return null;
}
