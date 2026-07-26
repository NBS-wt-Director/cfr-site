'use client';
import { useState, useEffect, useRef } from 'react';
import { Trash2, RefreshCw, HardDrive, Database, Archive, Download, Upload, FileJson, Send } from 'lucide-react';
import styles from './AdminStorage.module.css';

interface StorageInfo {
  uploads: {
    totalFiles: number;
    totalSize: number;
    usedFiles: number;
    usedSize: number;
    garbageFiles: number;
    garbageSize: number;
  };
  site: {
    totalSize: number;
    publicSize: number;
    srcSize: number;
    dbSize: number;
    memoryUsage: number;
  };
}

export default function AdminStorage() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backups, setBackups] = useState<{name: string, date: string, path?: string}[]>([]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
  };

  const fetchStorageInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/files');
      const data = await res.json();
      setStorageInfo(data);
    } catch (error) {
      console.error('Error fetching storage info:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanupStorage = async () => {
    if (!confirm('Удалить все неиспользуемые медиафайлы (мусор)?')) return;
    
    setCleaning(true);
    try {
      const res = await fetch('/api/admin/files', { method: 'POST' });
      const result = await res.json();
      
      if (result.success) {
        alert(`Удалено: ${result.deletedCount} файлов (${formatSize(result.deletedSize)})`);
        fetchStorageInfo();
      } else {
        alert(`Ошибка: ${result.error}`);
      }
    } catch (error) {
      alert('Ошибка очистки');
    } finally {
      setCleaning(false);
    }
  };

  // Экспорт БД
  const exportDb = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/db?action=export-data');
      const data = await res.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `db-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert('Ошибка экспорта');
    }
    setExporting(false);
  };

  // Импорт БД
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/admin/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import', data })
        });
        
        if (res.ok) {
          alert('✅ БД успешно импортирована! Обновите страницу.');
        } else {
          alert('❌ Ошибка импорта');
        }
      } catch (err) {
        alert('❌ Неверный формат файла');
      }
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Создать бэкап
  const createBackup = async () => {
    try {
      const res = await fetch('/api/admin/db?action=backup');
      const result = await res.json();
      if (result.success) {
        alert('✅ Бэкап создан!');
        loadBackups();
      }
    } catch (e) {
      alert('Ошибка создания бэкапа');
    }
  };

  // Загрузить список бэкапов
  const loadBackups = async () => {
    try {
      const res = await fetch('/api/admin/db?action=list-backups');
      const list = await res.json();
      setBackups(list);
    } catch (e) {
      console.error('Ошибка загрузки бэкапов');
    }
  };

  // Восстановить из бэкапа
  const restoreBackup = async (path: string) => {
    if (!confirm('Восстановить БД из этого бэкапа? Текущие данные будут заменены.')) return;
    try {
      const res = await fetch('/api/admin/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', backupPath: path })
      });
      if (res.ok) {
        alert('✅ БД восстановлена! Обновите страницу.');
      }
    } catch (e) {
      alert('Ошибка восстановления');
    }
  };

  useEffect(() => {
    fetchStorageInfo();
    loadBackups();
  }, []);

  if (!storageInfo) {
    return (
      <div className={styles.container}>
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">Загрузка информации о файлах...</span>
        </div>
      </div>
    );
  }

  const { uploads, site } = storageInfo;

  return (
    <div className={styles.container}>
      <h2 className="text-4xl font-bold mb-8">📁 Файлы и память</h2>
      
      {/* === Папка uploads === */}
      <div className="mb-10">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Archive className="w-6 h-6 text-blue-500" />
          Папка uploads
        </h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-black text-blue-600 mb-2">{uploads.totalFiles}</div>
            <div className="text-sm text-gray-600">Всего файлов</div>
          </div>
          <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-black text-indigo-600 mb-2">{formatSize(uploads.totalSize)}</div>
            <div className="text-sm text-gray-600">Общий объём</div>
          </div>
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-black text-emerald-600 mb-2">{uploads.usedFiles}</div>
            <div className="text-sm text-gray-600">Используется</div>
          </div>
          <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-black text-orange-600 mb-2">{uploads.garbageFiles}</div>
            <div className="text-sm text-gray-600">Мусор</div>
          </div>
        </div>
        
        <div className="p-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-red-700">Мусор (неиспользуемые файлы)</div>
              <div className="text-2xl font-black text-red-600">{formatSize(uploads.garbageSize)}</div>
            </div>
            <button
              onClick={cleanupStorage}
              disabled={cleaning || uploads.garbageFiles === 0}
              className="bg-red-500 hover:bg-red-600 text-white py-4 px-8 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cleaning ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 size={20} />
              )}
              Очистить мусор
            </button>
          </div>
        </div>
      </div>

      {/* === Объём сайта === */}
      <div className="mb-10">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <HardDrive className="w-6 h-6 text-purple-500" />
          Объём сайта
        </h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-black text-purple-600 mb-2">{formatSize(site.totalSize)}</div>
            <div className="text-sm text-gray-600">Весь сайт</div>
          </div>
          <div className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-black text-cyan-600 mb-2">{formatSize(site.publicSize)}</div>
            <div className="text-sm text-gray-600">public/</div>
          </div>
          <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-black text-green-600 mb-2">{formatSize(site.srcSize)}</div>
            <div className="text-sm text-gray-600">src/</div>
          </div>
          <div className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl text-center shadow-lg">
            <div className="text-3xl font-black text-amber-600 mb-2">{formatSize(site.dbSize)}</div>
            <div className="text-sm text-gray-600">База данных</div>
          </div>
        </div>
      </div>

      {/* === В памяти === */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Database className="w-6 h-6 text-teal-500" />
          В оперативной памяти
        </h3>
        
        <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl shadow-lg">
          <div className="text-3xl font-black text-teal-600">{formatSize(site.memoryUsage)}</div>
          <div className="text-sm text-gray-600 mt-1">Размер данных БД в памяти (сериализованный JSON)</div>
        </div>
      </div>

      {/* === Экспорт/Импорт БД === */}
      <div className="mt-10 border-t-2 border-gray-200 pt-8">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <FileJson className="w-6 h-6 text-green-500" />
          База данных
        </h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button
            onClick={exportDb}
            disabled={exporting}
            className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl hover:shadow-lg transition-all flex flex-col items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-8 h-8 text-green-600" />
            <span className="font-bold text-green-700">Экспорт БД</span>
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl hover:shadow-lg transition-all flex flex-col items-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-8 h-8 text-blue-600" />
            <span className="font-bold text-blue-700">Импорт БД</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          
          <button
            onClick={createBackup}
            className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl hover:shadow-lg transition-all flex flex-col items-center gap-2"
          >
            <Archive className="w-8 h-8 text-purple-600" />
            <span className="font-bold text-purple-700">Создать бэкап</span>
          </button>
          
          <button
            onClick={loadBackups}
            className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl hover:shadow-lg transition-all flex flex-col items-center gap-2"
          >
            <RefreshCw className="w-8 h-8 text-orange-600" />
            <span className="font-bold text-orange-700">Обновить список</span>
          </button>
        </div>

        {/* Список бэкапов */}
        {backups.length > 0 && (
          <div className="bg-gray-50 rounded-2xl p-4">
            <h4 className="font-bold mb-3">Доступные бэкапы:</h4>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {backups.map((backup, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg">
                  <span className="text-sm">{backup.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => restoreBackup(backup.path!)}
                      className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                    >
                      Восстановить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Кнопка обновления */}
      <div className="flex justify-end mt-6">
        <button
          onClick={fetchStorageInfo}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>
    </div>
  );
}
