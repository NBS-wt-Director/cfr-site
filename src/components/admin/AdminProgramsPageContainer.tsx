'use client';
import { useState, useEffect } from 'react';
import styles from './AdminItemForm.module.css';

interface CardSettings {
  width?: string;
  height?: string;
  borderRadius?: string;
  shadow?: string;
  border?: string;
  borderColor?: string;
  hoverBorderColor?: string;
  hoverEffect?: string;
  padding?: string;
  textAlign?: 'left' | 'center' | 'right';
  imageObjectFit?: 'cover' | 'contain' | 'fill';
  imageHeight?: string;
  showDescription?: boolean;
  descriptionLines?: number;
}

interface ContainerSettings {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  background?: string;
  backgroundColor?: string;
  padding?: string;
  maxWidth?: string;
  gridCols?: number;
  gap?: string;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showHomeButton?: boolean;
  homeButtonText?: string;
  animation?: string;
  contentWidth?: string;
}

interface AdminProgramsPageContainerProps {
  containerSettings: ContainerSettings;
  cardSettings: CardSettings;
  onSave: (container: ContainerSettings, cards: CardSettings) => void;
}

const defaultContainer: ContainerSettings = {
  enabled: true,
  title: 'Все программы тренировок',
  subtitle: 'Выберите программу для записи',
  background: 'white',
  backgroundColor: '#f9fafb',
  padding: 'large',
  maxWidth: '1400px',
  gridCols: 3,
  gap: '1.5rem',
  showTitle: true,
  showSubtitle: true,
  showHomeButton: true,
  homeButtonText: 'На главную',
  animation: 'none',
  contentWidth: '90%'
};

const defaultCards: CardSettings = {
  width: '100%',
  height: 'auto',
  borderRadius: '0.5rem',
  shadow: 'md',
  border: '2px solid #e5e7eb',
  borderColor: '#e5e7eb',
  hoverBorderColor: '#10b981',
  hoverEffect: 'translate',
  padding: '1.5rem',
  textAlign: 'center',
  imageObjectFit: 'contain',
  imageHeight: '12rem',
  showDescription: false,
  descriptionLines: 2
};

export default function AdminProgramsPageContainer({ 
  containerSettings, 
  cardSettings, 
  onSave 
}: AdminProgramsPageContainerProps) {
  const [container, setContainer] = useState<ContainerSettings>(defaultContainer);
  const [cards, setCards] = useState<CardSettings>(defaultCards);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'container' | 'cards'>('container');

  useEffect(() => {
    setContainer({ ...defaultContainer, ...containerSettings });
    setCards({ ...defaultCards, ...cardSettings });
  }, [containerSettings, cardSettings]);

  const handleContainerChange = (key: keyof ContainerSettings, value: any) => {
    setContainer(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleCardsChange = (key: keyof CardSettings, value: any) => {
    setCards(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(container, cards);
    setHasChanges(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🎯 Настройки страницы Программы</h3>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'container' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('container')}
        >
          📦 Контейнер
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'cards' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          🃏 Карточки
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'container' && (
          <div className={styles.section}>
            <h4>📦 Настройки контейнера страницы</h4>
            
            <div className={styles.field}>
              <label>
                <input
                  type="checkbox"
                  checked={container.enabled ?? true}
                  onChange={(e) => handleContainerChange('enabled', e.target.checked)}
                />
                Включить страницу
              </label>
            </div>

            <div className={styles.field}>
              <label>Заголовок страницы</label>
              <input
                type="text"
                value={container.title || ''}
                onChange={(e) => handleContainerChange('title', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>
                <input
                  type="checkbox"
                  checked={container.showTitle ?? true}
                  onChange={(e) => handleContainerChange('showTitle', e.target.value)}
                />
                Показать заголовок
              </label>
            </div>

            <div className={styles.field}>
              <label>Подзаголовок</label>
              <textarea
                value={container.subtitle || ''}
                onChange={(e) => handleContainerChange('subtitle', e.target.value)}
                className={styles.textarea}
                rows={2}
              />
            </div>

            <div className={styles.field}>
              <label>
                <input
                  type="checkbox"
                  checked={container.showSubtitle ?? true}
                  onChange={(e) => handleContainerChange('showSubtitle', e.target.checked)}
                />
                Показать подзаголовок
              </label>
            </div>

            <div className={styles.field}>
              <label>Фон</label>
              <select
                value={container.background || 'white'}
                onChange={(e) => handleContainerChange('background', e.target.value)}
                className={styles.select}
              >
                <option value="white">Белый</option>
                <option value="gray">Серый</option>
                <option value="gradientBlue">Градиент синий</option>
                <option value="gradientGreen">Градиент зеленый</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Цвет фона (hex)</label>
              <input
                type="text"
                value={container.backgroundColor || '#f9fafb'}
                onChange={(e) => handleContainerChange('backgroundColor', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Отступы</label>
              <select
                value={container.padding || 'large'}
                onChange={(e) => handleContainerChange('padding', e.target.value)}
                className={styles.select}
              >
                <option value="none">Нет</option>
                <option value="small">Маленькие</option>
                <option value="medium">Средние</option>
                <option value="large">Большие</option>
                <option value="xlarge">Очень большие</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Максимальная ширина</label>
              <input
                type="text"
                value={container.maxWidth || '1400px'}
                onChange={(e) => handleContainerChange('maxWidth', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Ширина контента (%)</label>
              <input
                type="number"
                min={50}
                max={100}
                value={parseInt(container.contentWidth?.replace('%','') || '90')}
                onChange={(e) => handleContainerChange('contentWidth', e.target.value + '%')}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Колонок в сетке (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={container.gridCols || 3}
                onChange={(e) => handleContainerChange('gridCols', parseInt(e.target.value))}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Отступ между карточками</label>
              <input
                type="text"
                value={container.gap || '1.5rem'}
                onChange={(e) => handleContainerChange('gap', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>
                <input
                  type="checkbox"
                  checked={container.showHomeButton ?? true}
                  onChange={(e) => handleContainerChange('showHomeButton', e.target.checked)}
                />
                Показать кнопку "На главную"
              </label>
            </div>

            {container.showHomeButton && (
              <div className={styles.field}>
                <label>Текст кнопки</label>
                <input
                  type="text"
                  value={container.homeButtonText || 'На главную'}
                  onChange={(e) => handleContainerChange('homeButtonText', e.target.value)}
                  className={styles.input}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'cards' && (
          <div className={styles.section}>
            <h4>🃏 Настройки карточек программ</h4>
            
            <div className={styles.field}>
              <label>Ширина карточки</label>
              <input
                type="text"
                value={cards.width || '100%'}
                onChange={(e) => handleCardsChange('width', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Высота карточки</label>
              <input
                type="text"
                value={cards.height || 'auto'}
                onChange={(e) => handleCardsChange('height', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Высота изображения</label>
              <input
                type="text"
                value={cards.imageHeight || '12rem'}
                onChange={(e) => handleCardsChange('imageHeight', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Скругление углов</label>
              <input
                type="text"
                value={cards.borderRadius || '0.5rem'}
                onChange={(e) => handleCardsChange('borderRadius', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Тень</label>
              <select
                value={cards.shadow || 'md'}
                onChange={(e) => handleCardsChange('shadow', e.target.value)}
                className={styles.select}
              >
                <option value="none">Нет</option>
                <option value="sm">Маленькая</option>
                <option value="md">Средняя</option>
                <option value="lg">Большая</option>
                <option value="xl">Очень большая</option>
                <option value="2xl">Максимальная</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Рамка</label>
              <input
                type="text"
                value={cards.border || '2px solid #e5e7eb'}
                onChange={(e) => handleCardsChange('border', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Цвет рамки</label>
              <input
                type="text"
                value={cards.borderColor || '#e5e7eb'}
                onChange={(e) => handleCardsChange('borderColor', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Цвет рамки при наведении</label>
              <input
                type="text"
                value={cards.hoverBorderColor || '#10b981'}
                onChange={(e) => handleCardsChange('hoverBorderColor', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Эффект при наведении</label>
              <select
                value={cards.hoverEffect || 'translate'}
                onChange={(e) => handleCardsChange('hoverEffect', e.target.value)}
                className={styles.select}
              >
                <option value="none">Нет</option>
                <option value="translate">Подъем</option>
                <option value="scale">Увеличение</option>
                <option value="shadow">Тень</option>
                <option value="border">Рамка</option>
                <option value="all">Все эффекты</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Внутренний отступ</label>
              <input
                type="text"
                value={cards.padding || '1.5rem'}
                onChange={(e) => handleCardsChange('padding', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label>Выравнивание текста</label>
              <select
                value={cards.textAlign || 'center'}
                onChange={(e) => handleCardsChange('textAlign', e.target.value)}
                className={styles.select}
              >
                <option value="left">Слева</option>
                <option value="center">По центру</option>
                <option value="right">Справа</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Масштабирование фото</label>
              <select
                value={cards.imageObjectFit || 'contain'}
                onChange={(e) => handleCardsChange('imageObjectFit', e.target.value)}
                className={styles.select}
              >
                <option value="cover">Cover (заполнить)</option>
                <option value="contain">Contain (вместить)</option>
                <option value="fill">Fill (растянуть)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>
                <input
                  type="checkbox"
                  checked={cards.showDescription ?? false}
                  onChange={(e) => handleCardsChange('showDescription', e.target.checked)}
                />
                Показывать описание
              </label>
            </div>

            {cards.showDescription && (
              <div className={styles.field}>
                <label>Количество строк описания</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={cards.descriptionLines || 2}
                  onChange={(e) => handleCardsChange('descriptionLines', parseInt(e.target.value))}
                  className={styles.input}
                />
              </div>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button 
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            💾 Сохранить {hasChanges && '(изменено)'}
          </button>
        </div>
      </div>
    </div>
  );
}
