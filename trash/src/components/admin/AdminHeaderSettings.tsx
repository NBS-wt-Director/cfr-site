'use client'
import { useState, useEffect } from 'react'
import styles from './AdminHeaderSettings.module.css'

interface HeaderSettings {
  titleSuffix: string
  componentsEnabled: {
    callButton: boolean
    pageTitle: boolean
    menu: boolean
  }
  componentsOrder: string[]
  homeMenuEnabled: boolean
  logoAnimation: string
  secondLineText: string
  secondLineAnimation: string
  lkEnabled: boolean
}

interface AdminHeaderSettingsProps {
  settings: HeaderSettings
  onSave: (settings: HeaderSettings) => void
}

export default function AdminHeaderSettings({ settings: initialSettings, onSave }: AdminHeaderSettingsProps) {
  const [localSettings, setLocalSettings] = useState<HeaderSettings>({
    titleSuffix: ' | Шифу Панда',
    componentsEnabled: {
      callButton: true,
      pageTitle: true,
      menu: true
    },
    componentsOrder: ['logo', 'callButton', 'pageTitle', 'menu'],
    homeMenuEnabled: true,
    logoAnimation: 'none',
    secondLineText: '',
    secondLineAnimation: 'none',
    lkEnabled: true
  })
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (initialSettings) {
      setLocalSettings(initialSettings)
    }
  }, [initialSettings])

  const updateField = (field: string, value: any) => {
    setLocalSettings(prev => {
      const newSettings = { ...prev }
      const keys = field.split('.')
      
      if (keys.length === 2) {
        (newSettings as any)[keys[0]] = {
          ...(newSettings as any)[keys[0]],
          [keys[1]]: value
        }
      } else if (keys.length === 1) {
        (newSettings as any)[keys[0]] = value
      }
      
      return newSettings
    })
    setHasChanges(true)
  }

  const moveComponent = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...localSettings.componentsOrder]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    
    if (newIndex >= 0 && newIndex < newOrder.length) {
      const temp = newOrder[index]
      newOrder[index] = newOrder[newIndex]
      newOrder[newIndex] = temp
      
      updateField('componentsOrder', newOrder)
    }
  }

  const saveChanges = () => {
    onSave(localSettings)
    setHasChanges(false)
  }

  const componentLabels: Record<string, string> = {
    logo: '🖼️ Логотип',
    callButton: '📞 Кнопка звонка',
    pageTitle: '📝 Заголовок страницы',
    menu: '☰ Меню'
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>⚙️ Настройки хедера</h3>
      </div>

      {/* Заголовок и суффикс */}
      <div className={styles.section}>
        <h4>📑 Заголовок страницы</h4>
        
        <div className={styles.formGroup}>
          <label>Суффикс (добавляется к заголовку в теге title):</label>
          <input
            type="text"
            value={localSettings.titleSuffix}
            onChange={e => updateField('titleSuffix', e.target.value)}
            placeholder=" | Шифу Панда"
            className={styles.input}
          />
        </div>
      </div>

      {/* Компоненты хедера */}
      <div className={styles.section}>
        <h4>🔧 Компоненты хедера</h4>
        
        <div className={styles.formGroup}>
          <label>Включение компонентов:</label>
          <div className={styles.checkboxGroup}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={localSettings.componentsEnabled.callButton}
                onChange={e => updateField('componentsEnabled.callButton', e.target.checked)}
              />
              <span>📞 Кнопка звонка</span>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={localSettings.componentsEnabled.pageTitle}
                onChange={e => updateField('componentsEnabled.pageTitle', e.target.checked)}
              />
              <span>📝 Заголовок страницы</span>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={localSettings.componentsEnabled.menu}
                onChange={e => updateField('componentsEnabled.menu', e.target.checked)}
              />
              <span>☰ Меню</span>
            </label>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Порядок компонентов:</label>
          <div className={styles.orderList}>
            {localSettings.componentsOrder.map((comp, index) => (
              <div key={comp} className={styles.orderItem}>
                <span>{componentLabels[comp] || comp}</span>
                <div className={styles.orderButtons}>
                  <button
                    type="button"
                    onClick={() => moveComponent(index, 'up')}
                    disabled={index === 0}
                    className={styles.orderBtn}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveComponent(index, 'down')}
                    disabled={index === localSettings.componentsOrder.length - 1}
                    className={styles.orderBtn}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Меню главной страницы */}
      <div className={styles.section}>
        <h4>🏠 Меню главной страницы</h4>
        
        <div className={styles.formGroup}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={localSettings.homeMenuEnabled}
              onChange={e => updateField('homeMenuEnabled', e.target.checked)}
            />
            <span>Включить меню разделов на главной странице</span>
          </label>
        </div>
      </div>

      {/* Личный кабинет */}
      <div className={styles.section}>
        <h4>🔐 Личный кабинет</h4>
        
        <div className={styles.formGroup}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={localSettings.lkEnabled}
              onChange={e => updateField('lkEnabled', e.target.checked)}
            />
            <span>Показывать пункт "Личный кабинет" в меню</span>
          </label>
          <p className={styles.hint}>
            Если выключено, страница личного кабинета будет недоступна через меню (но доступна по прямой ссылке)
          </p>
        </div>
      </div>

      {/* Анимация лого */}
      <div className={styles.section}>
        <h4>🎬 Анимация логотипа</h4>
        
        <div className={styles.formGroup}>
          <label>Тип анимации:</label>
          <select
            value={localSettings.logoAnimation}
            onChange={e => updateField('logoAnimation', e.target.value)}
            className={styles.select}
          >
            <option value="none">Нет</option>
            <option value="pulse">Пульсация</option>
            <option value="bounce">Подпрыгивание</option>
            <option value="rotate">Вращение</option>
          </select>
        </div>
      </div>

      {/* Вторая линия */}
      <div className={styles.section}>
        <h4>📄 Вторая строка заголовка</h4>
        
        <div className={styles.formGroup}>
          <label>Текст второй строки (оставьте пустым, чтобы скрыть):</label>
          <input
            type="text"
            value={localSettings.secondLineText}
            onChange={e => updateField('secondLineText', e.target.value)}
            placeholder="Центр функционального развития"
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Анимация второй строки:</label>
          <select
            value={localSettings.secondLineAnimation}
            onChange={e => updateField('secondLineAnimation', e.target.value)}
            className={styles.select}
            disabled={!localSettings.secondLineText}
          >
            <option value="none">Нет</option>
            <option value="fade">Плавное появление</option>
            <option value="slide">Скольжение</option>
            <option value="typewriter">Печатная машинка</option>
          </select>
        </div>
      </div>

      {/* Кнопка сохранения */}
      <button
        onClick={saveChanges}
        className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`}
        disabled={!hasChanges}
      >
        {hasChanges ? '💾 Сохранить' : '✅ Сохранено'}
      </button>
    </div>
  )
}
