'use client';
import { useState, useEffect, useCallback } from 'react';

interface GridSettingsProps {
  defaultCols?: number;
  onChange?: (cols: number) => void;
}

export default function GridSettings({ defaultCols = 3, onChange }: GridSettingsProps) {
  const [cols, setCols] = useState(defaultCols);
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Определяем мобильное устройство
  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Загружаем сохранённое значение из localStorage при монтировании
  useEffect(() => {
    if (!isClient) return;
    
    const saved = localStorage.getItem('gridCols');
    if (saved) {
      const savedCols = parseInt(saved, 10);
      if (savedCols >= 1 && savedCols <= 5) {
        setCols(savedCols);
      }
    }
  }, [isClient]);
  
  // Вызываем onChange когда меняется cols
  useEffect(() => {
    if (onChange) {
      onChange(cols);
    }
  }, [cols, onChange]);
  
  // Сохраняем и передаём изменение
  const handleChange = useCallback((newCols: number) => {
    setCols(newCols);
    localStorage.setItem('gridCols', newCols.toString());
  }, []);
  
  // На мобильных устройствах не показываем выбор колонок
  if (isMobile) {
    return null;
  }
  
  // Все опции доступны на десктопе
  const options = [1, 2, 3, 4, 5];
  
  return (
    <div className="flex items-center justify-center gap-2 mb-8 p-4 bg-gray-50 rounded-lg">
      <span className="text-sm font-medium text-gray-600 mr-2">Колонок:</span>
      {options.map((n) => (
        <button
          key={n}
          onClick={() => handleChange(n)}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            cols === n
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
