'use client'

import { useState, useEffect, DragEvent } from 'react'
import styles from './AdminSlider.module.css'

type TextPositionMode = 'static' | 'individual' | 'random'
type SliderPosition = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

interface SliderItem {
  id: number
  title?: string
  subtitle?: string
  image: string
  interval?: number
  link?: string
  position?: SliderPosition
}

interface SliderSettings {
  textPositionMode: TextPositionMode
  staticPosition: SliderPosition
  marginX: number
  marginY: number
}

interface AdminSliderProps {
  sliders: SliderItem[]
  onSave: (sliders: SliderItem[], defaultInterval: number, settings?: SliderSettings) => void
  settings?: SliderSettings
}

const POSITION_OPTIONS: { value: SliderPosition; label: string; gridArea: string }[] = [
  { value: 'top-left', label: '↖', gridArea: '1 / 1' },
  { value: 'top-center', label: '↑', gridArea: '1 / 2' },
  { value: 'top-right', label: '↗', gridArea: '1 / 3' },
  { value: 'middle-left', label: '←', gridArea: '2 / 1' },
  { value: 'middle-center', label: '•', gridArea: '2 / 2' },
  { value: 'middle-right', label: '→', gridArea: '2 / 3' },
  { value: 'bottom-left', label: '↙', gridArea: '3 / 1' },
  { value: 'bottom-center', label: '↓', gridArea: '3 / 2' },
  { value: 'bottom-right', label: '↘', gridArea: '3 / 3' },
]

export default function AdminSlider({ sliders: initialSliders, onSave, settings: initialSettings }: AdminSliderProps) {
  const [localSliders, setLocalSliders] = useState<SliderItem[]>([])
  const [draggedItem, setDraggedItem] = useState<SliderItem | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [newImage, setNewImage] = useState<File | null>(null)
  const [newImagePreview, setNewImagePreview] = useState('')
  const [newInterval, setNewInterval] = useState(5)
  const [newLink, setNewLink] = useState('')
  const [newPosition, setNewPosition] = useState<SliderPosition>('middle-center')
  const [defaultInterval, setDefaultInterval] = useState(5)
  const [hasChanges, setHasChanges] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showFormHelp, setShowFormHelp] = useState(false)

  // Настройки позиционирования
  const [textPositionMode, setTextPositionMode] = useState<TextPositionMode>(initialSettings?.textPositionMode || 'static')
  const [staticPosition, setStaticPosition] = useState<SliderPosition>(initialSettings?.staticPosition || 'middle-center')
  const [marginX, setMarginX] = useState(initialSettings?.marginX || 0)
  const [marginY, setMarginY] = useState(initialSettings?.marginY || 0)

  const uploadImage = async (file: File): Promise<string> => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/upload/', { method: 'POST', body: formData })
      const result = await response.json()
      if (result.success && result.url) return result.url
      throw new Error(result.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setNewImagePreview(reader.result as string)
      reader.readAsDataURL(file)
      setNewImage(file)
    }
  }

  const addSlider = async () => {
    if (!newImage || !newTitle.trim()) return
    
    try {
      const uploadedImageUrl = await uploadImage(newImage)
      
      const newSlider: SliderItem = {
        id: Date.now(),
        title: newTitle.trim(),
        subtitle: newSubtitle.trim() || undefined,
        image: uploadedImageUrl,
        interval: newInterval || undefined,
        link: newLink.trim() || undefined,
        position: textPositionMode === 'individual' ? newPosition : undefined
      }
      
      setLocalSliders([newSlider, ...localSliders])
      resetForm()
      setHasChanges(true)
    } catch (error) {
      alert(`Ошибка загрузки: ${error}`)
    }
  }

  const resetForm = () => {
    setNewTitle('')
    setNewSubtitle('')
    setNewImage(null)
    setNewImagePreview('')
    setNewInterval(5)
    setNewLink('')
    setNewPosition('middle-center')
  }

  useEffect(() => {
    setLocalSliders(initialSliders)
    if (initialSliders[0]?.interval) setDefaultInterval(initialSliders[0].interval)
    if (initialSettings) {
      setTextPositionMode(initialSettings.textPositionMode)
      setStaticPosition(initialSettings.staticPosition)
      setMarginX(initialSettings.marginX)
      setMarginY(initialSettings.marginY)
    }
  }, [initialSliders, initialSettings])

  // Drag & drop функции (без изменений)
  const handleDragStart = (e: DragEvent<HTMLDivElement>, item: SliderItem) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault()
    if (!draggedItem) return

    const newSliders = [...localSliders]
    const draggedIndex = newSliders.findIndex(s => s.id === draggedItem.id)
    newSliders.splice(draggedIndex, 1)
    newSliders.splice(targetIndex, 0, draggedItem)
    
    setLocalSliders(newSliders)
    setHasChanges(true)
    setDraggedItem(null)
  }

  const updateField = (id: number, field: keyof SliderItem, value: string | number | SliderPosition) => {
    const newSliders = localSliders.map(slider => 
      slider.id === id ? { ...slider, [field]: value || undefined } : slider
    )
    setLocalSliders(newSliders)
    setHasChanges(true)
  }

  const deleteSlider = (id: number) => {
    const newSliders = localSliders.filter(s => s.id !== id)
    setLocalSliders(newSliders)
    setHasChanges(true)
  }

  const saveChanges = () => {
    const sliderSettings: SliderSettings = {
      textPositionMode,
      staticPosition,
      marginX,
      marginY
    }
    onSave(localSliders, defaultInterval, sliderSettings)
    setHasChanges(false)
  }

  return (
    <div className={styles.container}>
      {/* Глобальные настройки */}
      <div className={styles.globalSettings}>
        <h3>📱 Слайдер ({localSliders.length} слайдов)</h3>
        <div className={styles.globalSettingsGrid}>
          <div className={styles.globalInterval}>
            <label title="Интервал для слайдов без своего времени">
              ⏱️ Интервал по умолчанию: 
              <input
                type="number"
                min="1"
                max="60"
                value={defaultInterval}
                onChange={e => {
                  setDefaultInterval(Number(e.target.value))
                  setHasChanges(true)
                }}
                className={styles.intervalInput}
              /> сек
            </label>
          </div>

          {/* Настройки позиционирования текста */}
          <div className={styles.positionSettings}>
            <label>📍 Режим расположения текста:</label>
            <div className={styles.modeButtons}>
              <button
                type="button"
                className={`${styles.modeBtn} ${textPositionMode === 'static' ? styles.modeBtnActive : ''}`}
                onClick={() => { setTextPositionMode('static'); setHasChanges(true); }}
              >
                📌 Статично
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${textPositionMode === 'individual' ? styles.modeBtnActive : ''}`}
                onClick={() => { setTextPositionMode('individual'); setHasChanges(true); }}
              >
                👤 По отдельности
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${textPositionMode === 'random' ? styles.modeBtnActive : ''}`}
                onClick={() => { setTextPositionMode('random'); setHasChanges(true); }}
              >
                🎲 Случайно
              </button>
            </div>
          </div>

          {textPositionMode === 'static' && (
            <div className={styles.staticPositionSettings}>
              <label>📍 Позиция текста:</label>
              <div className={styles.positionGrid}>
                {POSITION_OPTIONS.map((pos) => (
                  <button 
                    key={pos.value}
                    type="button"
                    className={`${styles.positionBtn} ${staticPosition === pos.value ? styles.positionBtnActive : ''}`}
                    onClick={() => { setStaticPosition(pos.value); setHasChanges(true); }}
                    title={pos.label}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.marginSettings}>
            <label>📏 Отступы от края (пиксели):</label>
            <div className={styles.marginInputs}>
              <div className={styles.marginInput}>
                <span>По горизонтали:</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={marginX}
                  onChange={e => { setMarginX(Number(e.target.value)); setHasChanges(true); }}
                  className={styles.intervalInput}
                />
              </div>
              <div className={styles.marginInput}>
                <span>По вертикали:</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={marginY}
                  onChange={e => { setMarginY(Number(e.target.value)); setHasChanges(true); }}
                  className={styles.intervalInput}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Форма создания - ЧЕТКАЯ! */}
      <div className={styles.createForm}>
        <h4>➕ Создать новый слайд</h4>
        <button 
          className={styles.helpToggle}
          onClick={() => setShowFormHelp(!showFormHelp)}
          title="Показать подсказки"
        >
          ❓
        </button>
        
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>📝 Заголовок <span className={styles.required}>*</span></label>
            <input 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              placeholder="Тренировки для стоп"
              className={styles.formInput}
            />
            {showFormHelp && <small>Главный текст слайда (обязательно)</small>}
          </div>

          <div className={styles.formGroup}>
            <label>📄 Подзаголовок</label>
            <input 
              value={newSubtitle}
              onChange={e => setNewSubtitle(e.target.value)}
              placeholder="Улучшите координацию и баланс"
              className={styles.formInput}
            />
            {showFormHelp && <small>Дополнительный текст под заголовком</small>}
          </div>

          <div className={styles.formGroup}>
            <label>🖼️ Изображение <span className={styles.required}>*</span></label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageSelect} 
              className={styles.fileInput}
              disabled={uploading}
            />
            {newImagePreview && (
              <div className={styles.imagePreview}>
                <img src={newImagePreview} alt="Превью" />
              </div>
            )}
            {showFormHelp && <small>Рекомендуемый размер: 1920x1080</small>}
          </div>

          <div className={styles.formGroup}>
            <label>⏱️ Интервал показа</label>
            <input
              type="number"
              min="1"
              max="60"
              value={newInterval}
              onChange={e => setNewInterval(Number(e.target.value))}
              className={styles.intervalInput}
            />
            {showFormHelp && <small>Секунды показа этого слайда (по умолчанию 5 сек)</small>}
          </div>

          <div className={styles.formGroup}>
            <label>🔗 Ссылка</label>
            <input
              value={newLink}
              onChange={e => setNewLink(e.target.value)}
              placeholder="/trainings/feet или https://..."
              className={styles.formInput}
            />
            {showFormHelp && <small>Ссылка при клике на заголовок (опционально)</small>}
          </div>

          {textPositionMode === 'individual' && (
            <div className={styles.formGroup}>
              <label>📍 Позиция текста</label>
              <div className={styles.positionGrid}>
                {POSITION_OPTIONS.map((pos) => (
                  <button 
                    key={pos.value}
                    type="button"
                    className={`${styles.positionBtn} ${newPosition === pos.value ? styles.positionBtnActive : ''}`}
                    onClick={() => setNewPosition(pos.value)}
                    title={pos.label}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
              {showFormHelp && <small>Расположение текста на слайде</small>}
            </div>
          )}
        </div>

        <div className={styles.formActions}>
          <button 
            onClick={addSlider} 
            className={styles.addBtn}
            disabled={!newImage || !newTitle.trim() || uploading}
          >
            {uploading ? '⏳ Загрузка...' : '➕ Создать слайд'}
          </button>
          <button 
            onClick={resetForm}
            className={styles.resetBtn}
          >
            🔄 Очистить
          </button>
        </div>
      </div>

      {/* Кнопка сохранения */}
      <div className={styles.saveSection}>
        <button 
          onClick={saveChanges} 
          className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`}
          disabled={!hasChanges}
        >
          {hasChanges ? '💾 Сохранить все изменения' : '✅ Все сохранено'}
        </button>
      </div>

      {/* Preview */}
      <div className={styles.preview}>
        <h4>👀 Превью</h4>
        <div className={styles.sliderTrack}>
          {localSliders.slice(0, 5).map((slider, index) => (
            <div key={slider.id} className={styles.previewSlide}>
              <div className={styles.previewImage} style={{ backgroundImage: `url(${slider.image})` }} />
              <div className={styles.previewOverlay}>
                <div className={styles.previewTitle}>{slider.title || 'Без названия'}</div>
                {slider.subtitle && <div className={styles.previewSubtitle}>{slider.subtitle}</div>}
                {slider.link && <span className={styles.previewLink}>🔗</span>}
                <span className={styles.previewIndex}>{index + 1}</span>
              </div>
            </div>
          ))}
        </div>
        {localSliders.length > 5 && (
          <div className={styles.moreSlides}>+{localSliders.length - 5} дополнительных</div>
        )}
      </div>

      {/* Редактор */}
      <div className={styles.editor}>
        <h4>✏️ Редактирование ({localSliders.length})</h4>
        <div className={styles.list}>
          {localSliders.map((slider, index) => (
            <div 
              key={slider.id} 
              className={`${styles.sliderItem} ${draggedItem?.id === slider.id ? styles.dragging : ''}`}
              draggable
              onDragStart={e => handleDragStart(e, slider)}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, index)}
            >
              <div className={styles.dragHandle}>☰</div>
              <div className={styles.index}>{index + 1}.</div>
              <div className={styles.sliderPreview}>
                <div className={styles.sliderImage} style={{ backgroundImage: `url(${slider.image})` }} />
              </div>
              <div className={styles.sliderContent}>
                <input 
                  value={slider.title || ''} 
                  onChange={e => updateField(slider.id, 'title', e.target.value)} 
                  placeholder="Заголовок"
                  className={styles.inlineInput}
                />
                <input 
                  value={slider.subtitle || ''} 
                  onChange={e => updateField(slider.id, 'subtitle', e.target.value)} 
                  placeholder="Подзаголовок"
                  className={styles.inlineInput}
                />
                <div className={styles.inlineActions}>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={slider.interval || ''}
                    onChange={e => updateField(slider.id, 'interval', Number(e.target.value))}
                    className={styles.inlineInterval}
                    title="Интервал"
                  />
                  <input
                    type="url"
                    value={slider.link || ''}
                    onChange={e => updateField(slider.id, 'link', e.target.value)}
                    placeholder="Ссылка"
                    className={styles.inlineLink}
                  />
                  {textPositionMode === 'individual' && (
                    <select
                      value={slider.position || 'middle-center'}
                      onChange={e => updateField(slider.id, 'position', e.target.value as SliderPosition)}
                      className={styles.inlinePosition}
                      title="Позиция текста"
                    >
                      {POSITION_OPTIONS.map((pos) => (
                        <option key={pos.value} value={pos.value}>
                          {pos.label} {pos.value}
                        </option>
                      ))}
                    </select>
                  )}
                  <button 
                    onClick={() => deleteSlider(slider.id)} 
                    className={styles.deleteBtn}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {hasChanges && (
          <div className={styles.status}>🔄 Есть несохранённые изменения</div>
        )}
      </div>
    </div>
  )
}
