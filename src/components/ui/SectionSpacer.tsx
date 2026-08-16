'use client';
import Image from 'next/image';
import styles from './SectionSpacer.module.css';

interface SectionSpacerProps {
  height?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  background?: 'default' | 'gradientBlue' | 'gradientRed' | 'gradientOrange' | 'gradientGray' | 'gradientGreen';
  content?: string[]; // Массив URL картинок
  textContent?: string; // Текст в разделителе
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
}

export default function SectionSpacer({ 
  height = 'lg', 
  background = 'gradientBlue',
  content = [],
  textContent,
  fontSize = 'medium'
}: SectionSpacerProps) {
  const fontSizeClass = {
    small: styles.fontSmall,
    medium: styles.fontMedium,
    large: styles.fontLarge,
    xlarge: styles.fontXLarge,
  }[fontSize];

  return (
    <div className={`${styles.spacer} ${styles[height]} ${styles[background]}`}>
      {/* Контент по центру - картинки или текст */}
      {(content.length > 0 || textContent) && (
        <div className={styles.content}>
          {content.map((src, index) => (
            <Image
              key={index}
              src={src}
              alt=""
              width={60}
              height={60}
              className={styles.contentImage}
            />
          ))}
          {textContent && (
            <span className={`${styles.textContent} ${fontSizeClass}`}>
              {textContent}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
