'use client';
import { useState, useEffect } from 'react';
import AdminStats from './AdminStats';

interface StatEntry {
  count: number;
  lastVisit: string;
}

interface Stats {
  pages: Record<string, StatEntry>;
  forms: Record<string, StatEntry>;
  lastUpdated: string;
}

export default function AdminStatsContainer() {
  const [stats, setStats] = useState<Stats>({ pages: {}, forms: {}, lastUpdated: '' });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Ошибка загрузки статистики:', e);
    }
    setLoading(false);
  };

  const clearStats = async () => {
    if (!confirm('Очистить всю статистику? Это действие необратимо.')) return;
    try {
      await fetch('/api/admin/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-stat' })
      });
      loadStats();
    } catch (e) {
      alert('Ошибка очистки');
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-500">Загрузка статистики...</p>
      </div>
    );
  }

  return (
    <AdminStats 
      stats={stats}
      onRefresh={loadStats}
      onClear={clearStats}
    />
  );
}
