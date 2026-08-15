'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import styles from './HomeSlider.module.css'

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
  textPositionMode: 'static' | 'individual' | 'random'
  staticPosition: SliderPosition
  marginX: number
  marginY: number
}

interface HomeSliderProps {
  sliders: SliderItem[]
  defaultInterval?: number
  settings?: SliderSettings
}

// Список всех возможных позиций
const ALL_POSITIONS: SliderPosition[] = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right'
]

export default function HomeSlider({ 
  sliders, 
  defaultInterval = 5,
  settings
}: HomeSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  // Вычисляем позицию для текущего слайда
  const currentPosition = useMemo(() => {
    if (!sliders?.length) return 'middle-center'
    
    const mode = settings?.textPositionMode || 'static'
    
    if (mode === 'individual') {
      return sliders[currentSlide]?.position || settings?.staticPosition || 'middle-center'
    }
    
    if (mode === 'random') {
      // Фиксируем позицию для каждого слайда при инициализации
      const seed = sliders[currentSlide]?.id || 0
      return ALL_POSITIONS[seed % ALL_POSITIONS.length]
    }
    
    // static mode
    return settings?.staticPosition || 'middle-center'
  }, [sliders, currentSlide, settings])

  // Вычисляем отступы
  const marginStyle = useMemo(() => ({
    marginLeft: settings?.marginX || 0,
    marginTop: settings?.marginY || 0,
    marginRight: settings?.marginX || 0,
    marginBottom: settings?.marginY || 0,
  }), [settings?.marginX, settings?.marginY])

  useEffect(() => {
    if (!sliders?.length) return

    const currentInterval = sliders[currentSlide]?.interval || defaultInterval
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliders.length)
    }, currentInterval * 1000)

    return () => clearInterval(interval)
  }, [sliders, currentSlide, defaultInterval])

  if (!sliders?.length) return null

  const currentSlideData = sliders[currentSlide]
  const hasTitle = currentSlideData.title?.trim()
  const hasText = hasTitle

  const goPrev = () => setCurrentSlide((prev) => (prev - 1 + sliders.length) % sliders.length)
  const goNext = () => setCurrentSlide((prev) => (prev + 1) % sliders.length)

  return (
    <section className={styles.slider}>
      {sliders.map((slide, index) => (
        <div key={slide.id} className={`${styles.slide} ${index === currentSlide ? styles.active : ''}`}>
          <img 
            src={slide.image} 
            alt={slide.title || 'Слайд'}
            className={styles.slideImage} 
            style={{objectFit: 'cover', width: '100%', height: '100%'}}
          />
        </div>
      ))}
      
      {hasText && (
        <div 
          className={`${styles.sliderText} ${styles[currentPosition]}`}
          style={marginStyle}
        >
          {currentSlideData.link ? (
            <Link href={currentSlideData.link} className={styles.slideLink}>
              <h1 className={styles.slideTitle}>{currentSlideData.title}</h1>
              {currentSlideData.subtitle && (
                <p className={styles.slideSubtitle}>{currentSlideData.subtitle}</p>
              )}
            </Link>
          ) : (
            <>
              <h1 className={styles.slideTitle}>{currentSlideData.title}</h1>
              {currentSlideData.subtitle && (
                <p className={styles.slideSubtitle}>{currentSlideData.subtitle}</p>
              )}
            </>
          )}
        </div>
      )}

      <button className={styles.navPrev} onClick={goPrev} aria-label="Предыдущий слайд">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="15,18 9,12 15,6"></polyline>
        </svg>
      </button>
      
      <button className={styles.navNext} onClick={goNext} aria-label="Следующий слайд">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="9,18 15,12 9,6"></polyline>
        </svg>
      </button>

      <div className={styles.dots}>
        {sliders.map((_, index) => (
          <button
            key={index}
            className={`${styles.dot} ${index === currentSlide ? styles.activeDot : ''}`}
            onClick={() => setCurrentSlide(index)}
            aria-label={`Перейти к слайду ${index + 1}`}
          />
        ))}
      </div>
    </section>
  )
}
