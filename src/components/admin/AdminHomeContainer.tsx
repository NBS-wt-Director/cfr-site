'use client';
import { useState, useEffect } from 'react';
import styles from './AdminItemForm.module.css';

interface HomeContainerSettings {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  background?: string;
  padding?: string;
  maxWidth?: string;
  showTitle?: boolean;
  showSubtitle?: boolean;
  contentAlign?: 'left' | 'center' | 'right';
  animation?: string;
}

interface AdminHomeContainerProps {
  data: HomeContainerSettings;
  onSave: (data: HomeContainerSettings) => void;
}

const defaultSettings: HomeContainerSettings = {
  enabled: true,
  title: 'Центр Функционального Развития «Шифу Панда»',
  subtitle: 'Ушу, фитнес и боевые искусства для всех возрастов',
  background: 'default',
  padding: 'large',
  maxWidth: '1200px',
  showTitle: true,
  showSubtitle: true,
  contentAlign: 'center',
  animation: 'none'
};

const backgroundOptions = [
  { value: 'default', label: 'По умолчанию' },
  { value: 'transparent', label: 'Прозрачный' },
  { value: 'white', label: 'Белый' },
  { value: 'gray', label: 'Серый' },
  { value: 'gradientBlue', label: 'Градиент синий' },
  { value: 'gradientGreen', label: 'Градиент зеленый' },
  { value: 'gradientPurple', label: 'Градиент фиолетовый' },
  { value: 'image', label: 'Фоновое изображение' }
];

const paddingOptions = [
  { value: 'none', label: 'Нет' },
  { value: 'small', label: 'Маленький' },
  { value: 'medium', label: 'Средний' },
  { value: 'large', label: 'Большой' },
  { value: 'xlarge', label: 'Очень большой' }
];

const animationOptions = [
  { value: 'none', label: 'Без анимации' },
  { value: 'fadeIn', label: 'Появление' },
  { value: 'slideUp', label: 'Выезд снизу' },
  { value: 'slideDown', label: 'Выезд сверху' },
  { value: 'scale', label: 'Масштабирование' }
];

export default function AdminHomeContainer({ data, onSave }: AdminHomeContainerProps) {
  const [settings, setSettings] = useState<HomeContainerSettings>(defaultSettings);
  const [localSettings, setLocalSettings] = useState<HomeContainerSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const merged = { ...defaultSettings, ...data };
    setSettings(merged);
    setLocalSettings(merged);
  }, [data]);

  const handleChange = (key: keyof HomeContainerSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = () => {
    setSettings(localSettings);
    onSave(localSettings);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalSettings(defaultSettings);
    setHasChanges(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🏠 Настройки контейнера Главная страница</h3>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h4>📐 Основные настройки</h4>
          
          <div className={styles.field}>
            <label>
              <input
                type="checkbox"
                checked={localSettings.enabled ?? true}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
              Включить контейнер
            </label>
          </div>

          <div className={styles.field}>
            <label>Заголовок</label>
            <input
              type="text"
              value={localSettings.title || ''}
              onChange={(e) => handleChange('title', e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label>
              <input
                type="checkbox"
                checked={localSettings.showTitle ?? true}
                onChange={(e) => handleChange('showTitle', e.target.checked)}
              />
              Показать заголовок
            </label>
          </div>

          <div className={styles.field}>
            <label>Подзаголовок</label>
            <textarea
              value={localSettings.subtitle || ''}
              onChange={(e) => handleChange('subtitle', e.target.value)}
              className={styles.textarea}
              rows={2}
            />
          </div>

          <div className={styles.field}>
            <label>
              <input
                type="checkbox"
                checked={localSettings.showSubtitle ?? true}
                onChange={(e) => handleChange('showSubtitle', e.target.checked)}
              />
              Показать подзаголовок
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <h4>🎨 Внешний вид</h4>
          
          <div className={styles.field}>
            <label>Фон</label>
            <select
              value={localSettings.background || 'default'}
              onChange={(e) => handleChange('background', e.target.value)}
              className={styles.select}
            >
              {backgroundOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Отступы</label>
            <select
              value={localSettings.padding || 'large'}
              onChange={(e) => handleChange('padding', e.target.value)}
              className={styles.select}
            >
              {paddingOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Максимальная ширина (px)</label>
            <input
              type="text"
              value={localSettings.maxWidth || '1200px'}
              onChange={(e) => handleChange('maxWidth', e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label>Выравнивание контента</label>
            <select
              value={localSettings.contentAlign || 'center'}
              onChange={(e) => handleChange('contentAlign', e.target.value)}
              className={styles.select}
            >
              <option value="left">Слева</option>
              <option value="center">По центру</option>
              <option value="right">Справа</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>Анимация</label>
            <select
              value={localSettings.animation || 'none'}
              onChange={(e) => handleChange('animation', e.target.value)}
              className={styles.select}
            >
              {animationOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.actions}>
          <button 
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            💾 Сохранить {hasChanges && '(изменено)'}
          </button>
          <button 
            className={styles.resetBtn}
            onClick={handleReset}
          >
            🔄 Сбросить
          </button>
        </div>
      </div>
    </div>
  );
}
