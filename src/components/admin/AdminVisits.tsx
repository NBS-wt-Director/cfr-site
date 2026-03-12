'use client';
import { Download, Users, Calendar } from 'lucide-react';
import { useState } from 'react';
import styles from './AdminVisits.module.css';

export default function AdminVisits() {
  const [stats] = useState({
    total: 12543,
    today: 89,
    week: 623,
    unique: 2847
  });

  const generateReport = async () => {
    // Симуляция генерации DOCX
    const res = await fetch('/api/visits-report', { method: 'POST' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visits-report-${new Date().toISOString().split('T')[0]}.docx`;
    a.click();
  };

  return (
    <div className={styles.container}>
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-4xl font-bold">📊 Посетители</h2>
        <button
          onClick={generateReport}
          className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
        >
          <Download size={24} />
          Отчёт DOCX
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-8 mb-12">
        <div className="p-8 bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl text-center shadow-xl">
          <Users className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <div className="text-4xl font-black text-blue-700 mb-2">{stats.total.toLocaleString()}</div>
          <div className="text-lg text-gray-600">Всего</div>
        </div>
        <div className="p-8 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-3xl text-center shadow-xl">
          <Calendar className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <div className="text-4xl font-black text-emerald-700 mb-2">{stats.today}</div>
          <div className="text-lg text-gray-600">Сегодня</div>
        </div>
        <div className="p-8 bg-gradient-to-br from-purple-50 to-purple-100 rounded-3xl text-center shadow-xl">
          <Users className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <div className="text-4xl font-black text-purple-700 mb-2">{stats.unique.toLocaleString()}</div>
          <div className="text-lg text-gray-600">Уникальных</div>
        </div>
        <div className="p-8 bg-gradient-to-br from-orange-50 to-orange-100 rounded-3xl text-center shadow-xl">
          <Calendar className="w-16 h-16 text-orange-600 mx-auto mb-4" />
          <div className="text-4xl font-black text-orange-700 mb-2">{stats.week}</div>
          <div className="text-lg text-gray-600">За неделю</div>
        </div>
      </div>
    </div>
  );
}
