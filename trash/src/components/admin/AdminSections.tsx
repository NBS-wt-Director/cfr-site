
'use client';
import { useState, useEffect, DragEvent } from 'react';
import styles from './AdminSections.module.css';

interface Section {
  id: string;
  title: string;
  background: string;
}

interface AdminSectionsProps {
  sections: Section[];
  onSave: (sections: Section[]) => void;
}

export default function AdminSections({ sections: initialSections, onSave }: AdminSectionsProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [draggedItem, setDraggedItem] = useState<Section | null>(null);
  const [colors] = useState([
    'yellow-orange', 'green-blue', 'emerald-teal', 'gray-white', 'indigo-purple',
    'red-pink', 'blue-sky', 'purple-violet', 'orange-gold'
  ]);
  const [localSections, setLocalSections] = useState<Section[]>([]); // ✅ Локальные изменения
  const [hasChanges, setHasChanges] = useState(false);              // ✅ Флаг изменений
 useEffect(() => {
    setSections(initialSections);
    setLocalSections(initialSections);
  }, [initialSections]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, item: Section) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const newSections = [...localSections];
    const draggedIndex = newSections.findIndex(s => s.id === draggedItem.id);
    
    newSections.splice(draggedIndex, 1);
    newSections.splice(targetIndex, 0, draggedItem);
    
    setLocalSections(newSections);
    setSections(newSections);
    setHasChanges(true); // ✅ Отметить изменения
    setDraggedItem(null);
  };

  const updateTitle = (id: string, title: string) => {
    const newSections = localSections.map(section => 
      section.id === id ? { ...section, title } : section
    );
    setLocalSections(newSections);
    setSections(newSections);
    setHasChanges(true); // ✅ Отметить изменения
  };
  // ✅ 4. ИЗМЕНИ updateColor - убрать onSave():
  const updateColor = (id: string, background: string) => {
    const newSections = localSections.map(section => 
      section.id === id ? { ...section, background } : section
    );
    setLocalSections(newSections);
    setSections(newSections);
    setHasChanges(true); // ✅ Отметить изменения
  };
  // ✅ Функция сохранения на сервер
  const saveToServer = async (sectionsToSave: Section[]) => {
    try {
      const response = await fetch('/api/db');
      const currentData = await response.json();
      
      const updatedData = {
        ...currentData,
        sections: sectionsToSave
      };
      
      const saveResponse = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      
      if (saveResponse.ok) {
        console.log('✅ Разделы сохранены на сервере');
        return true;
      } else {
        console.error('❌ Ошибка сохранения разделов');
        return false;
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error);
      return false;
    }
  };

  // ✅ 5. НОВАЯ функция сохранения по кнопке:
  const saveChanges = async () => {
    // Сначала обновляем локальное состояние
    onSave(localSections);
    setHasChanges(false);
    
    // Затем отправляем на сервер
    await saveToServer(localSections);
  };

  // ✅ Функция сброса
  const handleReset = () => {
    setLocalSections(defaultSections);
    setSections(defaultSections);
    setHasChanges(true); // Отметить изменения
  };

  const defaultSections: Section[] = [
    { id: "schedule", title: "Расписание занятий", background: "yellow-orange" },
    { id: "prices", title: "Наши цены", background: "green-blue" },
    { id: "programs", title: "Программы тренировок", background: "emerald-teal" },
    { id: "trainers", title: "Наши тренеры", background: "gray-white" },
    { id: "news", title: "Новости", background: "indigo-purple" }
  ];

  return (
    <div className={styles.container}>
       <div className={styles.header}>
    <h3>🏗️ Порядок разделов главной страницы</h3>
    <div className={styles.headerActions}>
      <button 
        onClick={handleReset}
        className={styles.resetBtn}
      >
        🔄 Сбросить
      </button>
      <button 
        onClick={saveChanges}
        className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`}
        disabled={!hasChanges}
      >
        💾 Сохранить {hasChanges && '(изменено)'}
      </button>
    </div>
  </div>
      <div className={styles.grid}>
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={`${styles.tile} ${styles[section.background] || styles.default}`}
            draggable
            onDragStart={(e) => handleDragStart(e, section)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className={styles.dragHandle}>☰</div>
            
            <div className={styles.content}>
              <div className={styles.titleInput}>
                <input
                  value={section.title}
                  onChange={(e) => updateTitle(section.id, e.target.value)}
                  placeholder="Название раздела"
                  className={styles.input}
                />
              </div>
              
              <div className={styles.colorSelector}>
                {colors.map(color => (
                  <button
                    key={color}
                    className={`${styles.colorOption} ${section.background === color ? styles.activeColor : ''}`}
                    onClick={() => updateColor(section.id, color)}
                    style={{ '--color': `var(--${color})` } as React.CSSProperties}
                  />
                ))}
              </div>
            </div>
            
            <div className={styles.index}>{index + 1}</div>
          </div>
        ))}
      </div>
      <div className={styles.status}>
    {hasChanges 
      ? `✨ ${localSections.length} изменений ждут сохранения` 
      : '✅ Все изменения сохранены'}
  </div>
    </div>
  );
}
