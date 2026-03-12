'use client';
import styles from './AdminTabs.module.css';

interface AdminTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  const tabs = [
    { id: 'header', label: '⚙️ Хедер', countKey: 'header' },
    { id: 'sliders', label: '📸 Слайдер', countKey: 'sliders' },
    { id: 'homeContainer', label: '🏠 Главная', countKey: 'homeContainer' },
    { id: 'homePrograms', label: '🏠 Программы', countKey: 'homePrograms' },
    { id: 'homeTrainers', label: '🏠 Тренеры', countKey: 'homeTrainers' },
    { id: 'schedulePrices', label: '📅💰 Расписание и Цены', countKey: 'schedulePrices' },
    { id: 'workouts', label: '📋 Тренировки', countKey: 'workouts' },
    { id: 'programs', label: '🎯 Программы', countKey: 'programs' },
    { id: 'programsCards', label: '🎯 Карточки', countKey: 'programsCards' },
    { id: 'staff', label: '👨‍🏫 Сотрудники', countKey: 'staff' },
    { id: 'trainers', label: '👨‍🏫 Тренеры', countKey: 'trainers' },
    { id: 'trainersCards', label: '👨‍🏫 Карточки', countKey: 'trainersCards' },
    { id: 'news', label: '📰 Новости', countKey: 'news' },
    { id: 'pages', label: '📄 Страницы', countKey: 'pages' },
    { id: 'footer', label: '🦶 Футер', countKey: 'footer' },
    { id: 'contacts', label: '📞 Контакты', countKey: 'contacts' },
    { id: 'additionalContacts', label: '📱 Доп. контакты', countKey: 'additionalContacts' },
    { id: 'sections', label: '🏗️ Разделы', countKey: 'sections' }, 
    { id: 'dividers', label: '🎨 Разделители', countKey: 'dividers' },
    { id: 'settings', label: '⚙️ Настройки', countKey: 'settings' },
    { id: 'stats', label: '📊 Статистика', countKey: 'stats' },
    { id: 'autoupload', label: '☁️ Автозагрузка', countKey: 'autoupload'},
    { id: 'files', label: '📁 Файлы и память', countKey: 'files'},
    { id: 'design', label: '🎨 Дизайн', countKey: 'design'}
  ];

  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={styles.tabIcon}>{tab.label.split(' ')[0]}</span>
          <span className={styles.tabLabel}>{tab.label.split(' ').slice(1).join(' ')}</span>
        </button>
      ))}
    </div>
  );
}
