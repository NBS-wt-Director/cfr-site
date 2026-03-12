'use client';
import { useState, useEffect } from 'react';
import styles from './AdminSettings.module.css';

interface GlobalDividerConfig {
  enabled: boolean;
  height: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  background: 'default' | 'gradientBlue' | 'gradientRed' | 'gradientOrange' | 'gradientGray';
  textContent: string;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
}

interface AdminDividersProps {
  dividers: GlobalDividerConfig;
  sections: { id: string; title: string }[];
  onSave: (dividers: GlobalDividerConfig) => void;
}

export default function AdminDividers({ dividers: initialDividers, sections, onSave }: AdminDividersProps) {
  const [divider, setDivider] = useState<GlobalDividerConfig>(initialDividers || {
    enabled: true,
    height: 'xxl',
    background: 'gradientBlue',
    textContent: '🏃 🏋️ 🧘 💪',
    fontSize: 'large'
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (initialDividers) {
      setDivider(initialDividers);
    }
  }, [initialDividers]);

  const updateDivider = (field: keyof GlobalDividerConfig, value: any) => {
    setDivider(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const saveChanges = () => {
    onSave(divider);
    setHasChanges(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🎨 Настройка разделителя между разделами ({hasChanges ? '✨ изменения' : '✅ сохранено'})</h3>
      </div>

      <div className={styles.content}>
        <p className={styles.description}>
          Настройте единый разделитель, который будет отображаться между всеми разделами на главной странице.
        </p>

        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <h4>⚙️ Глобальный разделитель</h4>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Включить разделитель</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateDivider('enabled', true)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    divider.enabled
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  ✅ Да
                </button>
                <button
                  onClick={() => updateDivider('enabled', false)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    !divider.enabled
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  ❌ Нет
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label>Высота разделителя</label>
              <select
                value={divider.height}
                onChange={(e) => updateDivider('height', e.target.value)}
                className={styles.select}
              >
                <option value="xs">Очень маленькая (xs)</option>
                <option value="sm">Маленькая (sm)</option>
                <option value="md">Средняя (md)</option>
                <option value="lg">Большая (lg)</option>
                <option value="xl">Очень большая (xl)</option>
                <option value="xxl">Максимальная (xxl)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Фон</label>
              <select
                value={divider.background}
                onChange={(e) => updateDivider('background', e.target.value)}
                className={styles.select}
              >
                <option value="default">По умолчанию</option>
                <option value="gradientBlue">Синий градиент</option>
                <option value="gradientRed">Красный градиент</option>
                <option value="gradientOrange">Оранжевый градиент</option>
                <option value="gradientGray">Серый градиент</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Размер текста/эмодзи</label>
              <select
                value={divider.fontSize}
                onChange={(e) => updateDivider('fontSize', e.target.value)}
                className={styles.select}
              >
                <option value="small">Маленький</option>
                <option value="medium">Средний</option>
                <option value="large">Большой</option>
                <option value="xlarge">Очень большой</option>
              </select>
            </div>

            <div className={styles.fieldFull}>
              <label>Контент (эмодзи или текст)</label>
              <input
                value={divider.textContent}
                onChange={(e) => updateDivider('textContent', e.target.value)}
                className={styles.input}
                placeholder="🏃 🏋️ 🧘"
              />
              <small className={styles.helperText}>
                Введите эмодзи или текст через пробел. Оставьте пустым для скрытия контента.
              </small>
            </div>
          </div>

          {/* Preview */}
          {divider.enabled && (
            <div className={`${styles.preview} ${styles[divider.height]} ${styles[divider.background]}`}>
              <div className={styles.previewContent}>
                <span className={
                  divider.fontSize === 'small' ? 'text-sm' :
                  divider.fontSize === 'medium' ? 'text-lg' :
                  divider.fontSize === 'large' ? 'text-2xl' : 'text-4xl'
                }>
                  {divider.textContent || 'Разделитель'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.saveSection}>
          <button 
            className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`}
            onClick={saveChanges}
            disabled={!hasChanges}
          >
            💾 Сохранить разделитель
          </button>
        </div>
      </div>
    </div>
  );
}
