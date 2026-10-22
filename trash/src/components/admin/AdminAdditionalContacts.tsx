'use client';
import { useState, useEffect } from 'react';
import styles from './AdminContacts.module.css';

interface SocialGroup {
  id: string;
  title: string;
  platform: string;
  url: string;
  showSubscribe: boolean;
}

interface YandexMapSettings {
  enabled: boolean;
  center: [number, number];
  zoom: number;
  placemark: [number, number];
  address: string;
}

interface AdditionalContactsData {
  enabled: boolean;
  title: string;
  groups: SocialGroup[];
  yandexMap: YandexMapSettings;
}

interface AdminAdditionalContactsProps {
  data: AdditionalContactsData;
  onSave: (data: AdditionalContactsData) => void;
}

const PLATFORMS = [
  { id: 'vk', label: 'ВКонтакте' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'other', label: 'Другое' },
];

export default function AdminAdditionalContacts({ data: initialData, onSave }: AdminAdditionalContactsProps) {
  const [data, setData] = useState<AdditionalContactsData>(initialData);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const updateEnabled = (enabled: boolean) => {
    setData({ ...data, enabled });
    setHasChanges(true);
  };

  const updateTitle = (title: string) => {
    setData({ ...data, title });
    setHasChanges(true);
  };

  const updateGroup = (index: number, field: keyof SocialGroup, value: string | boolean) => {
    const newGroups = [...data.groups];
    newGroups[index] = { ...newGroups[index], [field]: value };
    setData({ ...data, groups: newGroups });
    setHasChanges(true);
  };

  const addGroup = () => {
    const newGroup: SocialGroup = {
      id: `group_${Date.now()}`,
      title: 'Новая группа',
      platform: 'vk',
      url: '',
      showSubscribe: true
    };
    setData({ ...data, groups: [...data.groups, newGroup] });
    setHasChanges(true);
  };

  const removeGroup = (index: number) => {
    const newGroups = data.groups.filter((_, i) => i !== index);
    setData({ ...data, groups: newGroups });
    setHasChanges(true);
  };

  const updateMap = (field: keyof YandexMapSettings, value: boolean | number | string | number[]) => {
    setData({ 
      ...data, 
      yandexMap: { ...data.yandexMap, [field]: value } 
    });
    setHasChanges(true);
  };

  const saveChanges = () => {
    onSave(data);
    setHasChanges(false);
  };

  return (
    <div className={styles.container}>
      {/* Основные настройки */}
      <div className={styles.section}>
        <h3>📋 Основные настройки</h3>
        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <label>
              <input
                type="checkbox"
                checked={data.enabled}
                onChange={(e) => updateEnabled(e.target.checked)}
                className={styles.checkbox}
              />
              Включить дополнительные контакты
            </label>
          </div>
          <div className={styles.field}>
            <label>Заголовок секции</label>
            <input
              value={data.title}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="Подпишитесь на нас"
              className={styles.input}
            />
          </div>
        </div>
      </div>

      {/* Группы соцсетей */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>🌐 Группы и каналы</h3>
          <button onClick={addGroup} className={styles.addButton}>
            ➕ Добавить группу
          </button>
        </div>
        
        <div className={styles.groupsList}>
          {data.groups.map((group, index) => (
            <div key={group.id || index} className={styles.groupItem}>
              <div className={styles.groupFields}>
                <div className={styles.field}>
                  <label>Название</label>
                  <input
                    value={group.title}
                    onChange={(e) => updateGroup(index, 'title', e.target.value)}
                    placeholder="Название группы/канала"
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label>Платформа</label>
                  <select
                    value={group.platform}
                    onChange={(e) => updateGroup(index, 'platform', e.target.value)}
                    className={styles.input}
                  >
                    {PLATFORMS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>URL</label>
                  <input
                    value={group.url}
                    onChange={(e) => updateGroup(index, 'url', e.target.value)}
                    placeholder="https://..."
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label>
                    <input
                      type="checkbox"
                      checked={group.showSubscribe}
                      onChange={(e) => updateGroup(index, 'showSubscribe', e.target.checked)}
                      className={styles.checkbox}
                    />
                    Показать кнопку подписки
                  </label>
                </div>
              </div>
              <button 
                onClick={() => removeGroup(index)} 
                className={styles.removeButton}
                title="Удалить"
              >
                🗑️
              </button>
            </div>
          ))}
          
          {data.groups.length === 0 && (
            <p className={styles.emptyMessage}>
              Нет групп. Нажмите "Добавить группу" чтобы добавить.
            </p>
          )}
        </div>
      </div>

      {/* Настройки Яндекс карты */}
      <div className={styles.section}>
        <h3>🗺️ Яндекс карта</h3>
        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <label>
              <input
                type="checkbox"
                checked={data.yandexMap?.enabled || false}
                onChange={(e) => updateMap('enabled', e.target.checked)}
                className={styles.checkbox}
              />
              Показать карту
            </label>
          </div>
          
          {data.yandexMap?.enabled && (
            <>
              <div className={styles.field}>
                <label>Адрес (для отображения)</label>
                <input
                  value={data.yandexMap?.address || ''}
                  onChange={(e) => updateMap('address', e.target.value)}
                  placeholder="г. Екатеринбург, ул. 8 Марта, 70"
                  className={styles.input}
                />
              </div>
              <div className={styles.coordFields}>
                <div className={styles.field}>
                  <label>Широта (координаты центра)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={data.yandexMap?.center[0] || 56.8355}
                    onChange={(e) => updateMap('center', [parseFloat(e.target.value), data.yandexMap?.center[1] || 60.5972])}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label>Долгота (координаты центра)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={data.yandexMap?.center[1] || 60.5972}
                    onChange={(e) => updateMap('center', [data.yandexMap?.center[0] || 56.8355, parseFloat(e.target.value)])}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label>Масштаб (zoom)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={data.yandexMap?.zoom || 15}
                    onChange={(e) => updateMap('zoom', parseInt(e.target.value))}
                    className={styles.input}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button 
          onClick={saveChanges}
          className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`}
          disabled={!hasChanges}
        >
          💾 Сохранить {hasChanges && '(изменено)'}
        </button>
      </div>

      <div className={styles.status}>
        {hasChanges 
          ? '✨ Изменения ждут сохранения' 
          : '✅ Все изменения сохранены'}
      </div>
    </div>
  );
}
