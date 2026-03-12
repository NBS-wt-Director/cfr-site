'use client';
import { useState, useEffect } from 'react';
import styles from './AdminDesign.module.css';

// === ТИПЫ ДАННЫХ ===

interface CardButton {
  display?: 'none' | 'inline-block' | 'block';
  position?: 'static' | 'absolute';
  positionTop?: string;
  positionRight?: string;
  positionBottom?: string;
  positionLeft?: string;
  alignSelf?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  textAlign?: 'left' | 'center' | 'right';
  width?: string;
  maxWidth?: string;
  padding?: string;
  paddingTop?: string;
  paddingBottom?: string;
  margin?: string;
  marginTop?: string;
  marginBottom?: string;
  marginTopAuto?: boolean;
  background?: string;
  backgroundColor?: string;
  backgroundHover?: string;
  color?: string;
  colorHover?: string;
  border?: string;
  borderColor?: string;
  borderRadius?: string;
  borderRadiusSmall?: string;
  fontSize?: string;
  fontWeight?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: string;
  textDecorationHover?: string;
  shadow?: string;
  shadowHover?: string;
  transition?: string;
  transitionDuration?: string;
  transform?: string;
  transformHover?: string;
  icon?: boolean;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  visible?: boolean;
}

interface CardDesign {
  width?: string;
  minHeight?: string;
  maxHeight?: string;
  imageHeight?: string;
  padding?: string;
  paddingMobile?: string;
  gap?: string;
  borderWidth?: string;
  borderColor?: string;
  borderRadius?: string;
  borderRadiusMobile?: string;
  shadow?: string;
  shadowHover?: string;
  background?: string;
  backgroundHover?: string;
  borderColorHover?: string;
  transformHover?: string;
  scaleHover?: string;
  transition?: string;
  transitionDuration?: string;
  titleColor?: string;
  titleColorHover?: string;
  titleFontSize?: string;
  titleFontWeight?: string;
  titleLineHeight?: string;
  titleTextAlign?: 'left' | 'center' | 'right';
  descColor?: string;
  descFontSize?: string;
  descLineHeight?: string;
  descTextAlign?: 'left' | 'center' | 'right';
  descLines?: number;
  cornerFold?: boolean;
  cornerFoldColor?: string;
  photoCountBg?: string;
  photoCountColor?: string;
  button?: CardButton;
}

interface GridDesign {
  columns?: number;
  columnsTablet?: number;
  columnsMobile?: number;
  gap?: string;
  gapMobile?: string;
}

interface SectionDesign {
  paddingTop?: string;
  paddingBottom?: string;
  paddingMobile?: string;
  background?: string;
  backgroundGradient?: string;
}

interface CardContainerDesign {
  section: SectionDesign;
  grid: GridDesign;
  card: CardDesign;
}

interface DesignSettings {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    backgroundAlt: string;
    text: string;
    textMuted: string;
    border: string;
    headerBg: string;
    footerBg: string;
    cardBg: string;
    buttonPrimary: string;
    buttonSecondary: string;
    link: string;
    linkHover: string;
  };
  typography: {
    headings: {
      fontFamily: string;
      fontSize: string;
      fontWeight: string;
      color: string;
      lineHeight: string;
      letterSpacing: string;
      textAlign: 'left' | 'center' | 'right';
    };
    body: {
      fontFamily: string;
      fontSize: string;
      fontWeight: string;
      color: string;
      lineHeight: string;
      letterSpacing: string;
      textAlign: 'left' | 'center' | 'right';
    };
    mobile: {
      headings: {
        fontSize: string;
        lineHeight: string;
      };
      body: {
        fontSize: string;
        lineHeight: string;
      };
    };
  };
  containers: {
    maxWidth: string;
    padding: string;
    gap: string;
    cardBorderRadius: string;
    cardShadow: string;
    cardPadding: string;
    sectionPadding: string;
    mobile: {
      padding: string;
      gap: string;
      cardBorderRadius: string;
      cardPadding: string;
      sectionPadding: string;
    };
  };
  contentWidth: {
    mode: 'percent' | 'px';
    value: number;
  };
  cards: {
    programs: CardContainerDesign;
    trainers: CardContainerDesign;
    staff: CardContainerDesign;
    news: CardContainerDesign;
    slider: {
      section: SectionDesign;
      slide: {
        height?: string;
        heightMobile?: string;
        borderRadius?: string;
        objectFit?: string;
      };
      text: {
        position?: string;
        color?: string;
        fontSize?: string;
        fontWeight?: string;
        background?: string;
        padding?: string;
        textAlign?: string;
      };
    };
    prices: CardContainerDesign;
    schedule: CardContainerDesign;
  };
}

interface AdminDesignProps {
  designSettings: DesignSettings;
  onSave: (settings: DesignSettings) => void;
}

const defaultCardButton: CardButton = {
  display: 'inline-block',
  position: 'static',
  alignSelf: 'center',
  textAlign: 'center',
  width: 'auto',
  maxWidth: '100%',
  padding: '0.75rem 1.5rem',
  marginTop: '1rem',
  background: '#4F46E5',
  backgroundHover: '#3730A3',
  color: '#ffffff',
  colorHover: '#ffffff',
  border: 'none',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  fontWeight: '600',
  textTransform: 'none',
  shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  shadowHover: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  transition: 'all',
  transitionDuration: '0.3s',
  visible: true,
};

const defaultCardDesign: CardDesign = {
  width: '100%',
  minHeight: '480px',
  imageHeight: '360px',
  padding: '1.5rem',
  paddingMobile: '1rem',
  gap: '1rem',
  borderWidth: '2px',
  borderColor: '#e5e7eb',
  borderRadius: '0',
  borderRadiusMobile: '0',
  shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  shadowHover: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  background: '#ffffff',
  borderColorHover: '#3b82f6',
  transformHover: 'translateY(-4px)',
  scaleHover: '1',
  transition: 'all',
  transitionDuration: '0.3s',
  titleColor: '#1f2937',
  titleColorHover: '#2563eb',
  titleFontSize: '1.25rem',
  titleFontWeight: '900',
  titleLineHeight: '1.3',
  titleTextAlign: 'center',
  descColor: '#6b7280',
  descFontSize: '0.875rem',
  descLineHeight: '1.5',
  descTextAlign: 'left',
  descLines: 4,
  cornerFold: true,
  cornerFoldColor: '#3b82f6',
  photoCountBg: 'rgba(0, 0, 0, 0.7)',
  photoCountColor: '#ffffff',
  button: { ...defaultCardButton },
};

const defaultGridDesign: GridDesign = {
  columns: 3,
  columnsTablet: 2,
  columnsMobile: 1,
  gap: '1.5rem',
  gapMobile: '1rem',
};

const defaultSectionDesign: SectionDesign = {
  paddingTop: '6rem',
  paddingBottom: '6rem',
  paddingMobile: '3rem',
  background: '#ffffff',
};

const defaultDesignSettings: DesignSettings = {
  colors: {
    primary: '#4F46E5',
    secondary: '#7C3AED',
    accent: '#F59E0B',
    background: '#FFFFFF',
    backgroundAlt: '#F9FAFB',
    text: '#111827',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    headerBg: '#FFFFFF',
    footerBg: '#1F2937',
    cardBg: '#FFFFFF',
    buttonPrimary: '#4F46E5',
    buttonSecondary: '#6B7280',
    link: '#4F46E5',
    linkHover: '#3730A3',
  },
  typography: {
    headings: {
      fontFamily: 'inherit',
      fontSize: '2rem',
      fontWeight: '700',
      color: '#111827',
      lineHeight: '1.2',
      letterSpacing: '0',
      textAlign: 'left',
    },
    body: {
      fontFamily: 'inherit',
      fontSize: '1rem',
      fontWeight: '400',
      color: '#111827',
      lineHeight: '1.6',
      letterSpacing: '0',
      textAlign: 'left',
    },
    mobile: {
      headings: { fontSize: '1.5rem', lineHeight: '1.3' },
      body: { fontSize: '0.875rem', lineHeight: '1.5' },
    },
  },
  containers: {
    maxWidth: '1200px',
    padding: '1rem',
    gap: '1rem',
    cardBorderRadius: '0',
    cardShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cardPadding: '1rem',
    sectionPadding: '2rem',
    mobile: {
      padding: '0.75rem',
      gap: '0.75rem',
      cardBorderRadius: '0',
      cardPadding: '0.75rem',
      sectionPadding: '1rem',
    },
  },
  contentWidth: { mode: 'percent', value: 90 },
  cards: {
    programs: {
      section: { ...defaultSectionDesign, backgroundGradient: 'linear-gradient(to bottom right, #dbeafe, #bfdbfe)' },
      grid: { ...defaultGridDesign },
      card: { ...defaultCardDesign, borderColorHover: '#3b82f6', titleColorHover: '#2563eb', cornerFoldColor: '#3b82f6' },
    },
    trainers: {
      section: { ...defaultSectionDesign, backgroundGradient: 'linear-gradient(to bottom right, #fee2e2, #fecaca)' },
      grid: { ...defaultGridDesign, columns: 3 },
      card: { ...defaultCardDesign, minHeight: '480px', imageHeight: '400px', borderColorHover: '#ef4444', titleColorHover: '#dc2626', cornerFoldColor: '#ef4444' },
    },
    staff: {
      section: { ...defaultSectionDesign, backgroundGradient: 'linear-gradient(to bottom right, #f3f4f6, #e5e7eb)' },
      grid: { ...defaultGridDesign, columns: 3 },
      card: { ...defaultCardDesign, minHeight: '480px', borderRadius: '0', borderColorHover: '#6b7280', titleColorHover: '#4b5563', cornerFold: false },
    },
    news: {
      section: { ...defaultSectionDesign, backgroundGradient: 'linear-gradient(to bottom right, #eef2ff, #e0e7ff)' },
      grid: { ...defaultGridDesign, columns: 3 },
      card: { ...defaultCardDesign, borderRadius: '0', borderColorHover: '#7c3aed', titleColorHover: '#6d28d9', cornerFold: false },
    },
    slider: {
      section: { paddingTop: '0', paddingBottom: '0', background: '#000000' },
      slide: { height: '600px', heightMobile: '300px', borderRadius: '0', objectFit: 'cover' },
      text: { position: 'center', color: '#ffffff', fontSize: '3rem', fontWeight: '900', background: 'rgba(0,0,0,0.5)', padding: '1rem', textAlign: 'center' },
    },
    prices: {
      section: { ...defaultSectionDesign, backgroundGradient: 'linear-gradient(to bottom right, #fef3c7, #fde68a)' },
      grid: { ...defaultGridDesign, columns: 4 },
      card: { ...defaultCardDesign, minHeight: '300px', borderRadius: '0', borderColorHover: '#f59e0b', titleColorHover: '#d97706' },
    },
    schedule: {
      section: { ...defaultSectionDesign, backgroundGradient: 'linear-gradient(to bottom right, #f3f4f6, #e5e7eb)' },
      grid: { ...defaultGridDesign, columns: 1 },
      card: { ...defaultCardDesign, minHeight: 'auto', borderRadius: '0' },
    },
  },
};

export default function AdminDesign({ designSettings, onSave }: AdminDesignProps) {
  const [settings, setSettings] = useState<DesignSettings>(defaultDesignSettings);
  const [activeSection, setActiveSection] = useState<'colors' | 'typography' | 'containers' | 'cards' | 'width'>('colors');
  const [activeCardType, setActiveCardType] = useState<'programs' | 'trainers' | 'staff' | 'news' | 'slider' | 'prices' | 'schedule'>('programs');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (designSettings) {
      // Глубокое слияние с настройками по умолчанию
      const mergedSettings = {
        ...defaultDesignSettings,
        ...designSettings,
        colors: { ...defaultDesignSettings.colors, ...designSettings.colors },
        typography: { 
          ...defaultDesignSettings.typography, 
          headings: { ...defaultDesignSettings.typography.headings, ...designSettings.typography?.headings },
          body: { ...defaultDesignSettings.typography.body, ...designSettings.typography?.body },
          mobile: { ...defaultDesignSettings.typography.mobile, ...designSettings.typography?.mobile }
        },
        containers: { 
          ...defaultDesignSettings.containers, 
          mobile: { ...defaultDesignSettings.containers.mobile, ...designSettings.containers?.mobile }
        },
        contentWidth: designSettings.contentWidth || defaultDesignSettings.contentWidth,
        cards: designSettings.cards ? {
          programs: { ...defaultDesignSettings.cards.programs, ...designSettings.cards.programs },
          trainers: { ...defaultDesignSettings.cards.trainers, ...designSettings.cards.trainers },
          staff: { ...defaultDesignSettings.cards.staff, ...designSettings.cards.staff },
          news: { ...defaultDesignSettings.cards.news, ...designSettings.cards.news },
          slider: { ...defaultDesignSettings.cards.slider, ...designSettings.cards.slider },
          prices: { ...defaultDesignSettings.cards.prices, ...designSettings.cards.prices },
          schedule: { ...defaultDesignSettings.cards.schedule, ...designSettings.cards.schedule },
        } : defaultDesignSettings.cards
      };
      setSettings(mergedSettings);
    }
  }, [designSettings]);

  const updateSetting = (path: string, value: any) => {
    const keys = path.split('.');
    const newSettings = JSON.parse(JSON.stringify(settings));
    let current: any = newSettings;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
    setSettings(newSettings);
    setHasChanges(true);
  };

  const saveChanges = () => {
    onSave(settings);
    setHasChanges(false);
  };

  const isLightColor = (hex: string): boolean => {
    if (!hex || hex.length < 7) return true;
    const c = hex.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 128;
  };

  const ColorPicker = ({ label, value, onChange, description }: { label: string; value: string; onChange: (v: string) => void; description?: string }) => (
    <div className={styles.colorPicker}>
      <div className={styles.colorInput}>
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className={styles.colorInputNative} />
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={styles.colorInputText} placeholder="#000000" />
      </div>
      <div className={styles.colorPreview} style={{ backgroundColor: value || '#ccc' }}>
        <span style={{ color: isLightColor(value || '#fff') ? '#000' : '#fff' }}>{label}</span>
      </div>
      {description && <span className={styles.colorDescription}>{description}</span>}
    </div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  );

  const CardSettingsPanel = ({ cardKey, title }: { cardKey: 'programs' | 'trainers' | 'staff' | 'news' | 'prices' | 'schedule'; title: string }) => {
    const card = settings.cards[cardKey];
    return (
      <div className={styles.cardSettingsPanel}>
        <h4>{title}</h4>

        <div className={styles.settingsGroup}>
          <h5>📐 Секция</h5>
          <div className={styles.settingsGrid}>
            <Field label="Отступ сверху"><input type="text" value={card.section.paddingTop} onChange={(e) => updateSetting(`cards.${cardKey}.section.paddingTop`, e.target.value)} className={styles.input} /></Field>
            <Field label="Отступ снизу"><input type="text" value={card.section.paddingBottom} onChange={(e) => updateSetting(`cards.${cardKey}.section.paddingBottom`, e.target.value)} className={styles.input} /></Field>
            <Field label="Отступ (мобильный)"><input type="text" value={card.section.paddingMobile || ''} onChange={(e) => updateSetting(`cards.${cardKey}.section.paddingMobile`, e.target.value)} className={styles.input} placeholder="3rem" /></Field>
            <Field label="Фон (градиент)"><input type="text" value={card.section.backgroundGradient || ''} onChange={(e) => updateSetting(`cards.${cardKey}.section.backgroundGradient`, e.target.value)} className={styles.input} placeholder="linear-gradient(...)" /></Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🔲 Сетка</h5>
          <div className={styles.settingsGrid}>
            <Field label="Колонок (десктоп)">
              <select value={card.grid.columns} onChange={(e) => updateSetting(`cards.${cardKey}.grid.columns`, Number(e.target.value))} className={styles.select}>
                <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
              </select>
            </Field>
            <Field label="Колонок (планшет)">
              <select value={card.grid.columnsTablet || 2} onChange={(e) => updateSetting(`cards.${cardKey}.grid.columnsTablet`, Number(e.target.value))} className={styles.select}>
                <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
              </select>
            </Field>
            <Field label="Колонок (мобильный)">
              <select value={card.grid.columnsMobile || 1} onChange={(e) => updateSetting(`cards.${cardKey}.grid.columnsMobile`, Number(e.target.value))} className={styles.select}>
                <option value={1}>1</option><option value={2}>2</option>
              </select>
            </Field>
            <Field label="Gap (десктоп)"><input type="text" value={card.grid.gap} onChange={(e) => updateSetting(`cards.${cardKey}.grid.gap`, e.target.value)} className={styles.input} /></Field>
            <Field label="Gap (мобильный)"><input type="text" value={card.grid.gapMobile || ''} onChange={(e) => updateSetting(`cards.${cardKey}.grid.gapMobile`, e.target.value)} className={styles.input} /></Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🃏 Карточка - Размеры</h5>
          <div className={styles.settingsGrid}>
            <Field label="Ширина"><input type="text" value={card.card.width || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.width`, e.target.value)} className={styles.input} /></Field>
            <Field label="Мин. высота"><input type="text" value={card.card.minHeight || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.minHeight`, e.target.value)} className={styles.input} /></Field>
            <Field label="Макс. высота"><input type="text" value={card.card.maxHeight || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.maxHeight`, e.target.value)} className={styles.input} /></Field>
            <Field label="Высота изображения"><input type="text" value={card.card.imageHeight || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.imageHeight`, e.target.value)} className={styles.input} /></Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🃏 Карточка - Отступы</h5>
          <div className={styles.settingsGrid}>
            <Field label="Внутр. отступ"><input type="text" value={card.card.padding} onChange={(e) => updateSetting(`cards.${cardKey}.card.padding`, e.target.value)} className={styles.input} /></Field>
            <Field label="Внутр. отступ (моб.)"><input type="text" value={card.card.paddingMobile || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.paddingMobile`, e.target.value)} className={styles.input} /></Field>
            <Field label="Gap"><input type="text" value={card.card.gap || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.gap`, e.target.value)} className={styles.input} /></Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🔲 Границы</h5>
          <div className={styles.settingsGrid}>
            <Field label="Толщина"><input type="text" value={card.card.borderWidth || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.borderWidth`, e.target.value)} className={styles.input} placeholder="2px" /></Field>
            <Field label="Цвет границы">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.borderColor || '#e5e7eb'} onChange={(e) => updateSetting(`cards.${cardKey}.card.borderColor`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.borderColor || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.borderColor`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Радиус"><input type="text" value={card.card.borderRadius || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.borderRadius`, e.target.value)} className={styles.input} placeholder="0.5rem" /></Field>
            <Field label="Радиус (моб.)"><input type="text" value={card.card.borderRadiusMobile || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.borderRadiusMobile`, e.target.value)} className={styles.input} /></Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🌑 Тени</h5>
          <div className={styles.settingsGrid}>
            <Field label="Тень (обычная)">
              <select value={card.card.shadow || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.shadow`, e.target.value)} className={styles.select}>
                <option value="none">Нет</option>
                <option value="0 1px 3px rgba(0,0,0,0.1)">Лёгкая</option>
                <option value="0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)">Средняя</option>
                <option value="0 10px 15px -3px rgba(0,0,0,0.1)">Сильная</option>
                <option value="0 20px 25px -5px rgba(0,0,0,0.1)">Мягкая</option>
              </select>
            </Field>
            <Field label="Тень (при наведении)">
              <select value={card.card.shadowHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.shadowHover`, e.target.value)} className={styles.select}>
                <option value="none">Нет</option>
                <option value="0 4px 6px -1px rgba(0,0,0,0.1)">Лёгкая</option>
                <option value="0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)">Средняя</option>
                <option value="0 20px 25px -5px rgba(0,0,0,0.1)">Сильная</option>
                <option value="0 25px 50px -12px rgba(0,0,0,0.25)">Очень сильная</option>
              </select>
            </Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>👆 При наведении</h5>
          <div className={styles.settingsGrid}>
            <Field label="Цвет границы">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.borderColorHover || '#000'} onChange={(e) => updateSetting(`cards.${cardKey}.card.borderColorHover`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.borderColorHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.borderColorHover`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Сдвиг (transform)"><input type="text" value={card.card.transformHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.transformHover`, e.target.value)} className={styles.input} placeholder="translateY(-4px)" /></Field>
            <Field label="Масштаб"><input type="text" value={card.card.scaleHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.scaleHover`, e.target.value)} className={styles.input} placeholder="1.05" /></Field>
            <Field label="Длительность"><input type="text" value={card.card.transitionDuration || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.transitionDuration`, e.target.value)} className={styles.input} placeholder="0.3s" /></Field>
            <Field label="Фон при наведении">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.backgroundHover ? card.card.backgroundHover.substring(0, 7) : '#fff'} onChange={(e) => updateSetting(`cards.${cardKey}.card.backgroundHover`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.backgroundHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.backgroundHover`, e.target.value)} className={styles.input} />
              </div>
            </Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>📝 Заголовок карточки</h5>
          <div className={styles.settingsGrid}>
            <Field label="Цвет">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.titleColor || '#1f2937'} onChange={(e) => updateSetting(`cards.${cardKey}.card.titleColor`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.titleColor || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.titleColor`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Цвет при наведении">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.titleColorHover || '#000'} onChange={(e) => updateSetting(`cards.${cardKey}.card.titleColorHover`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.titleColorHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.titleColorHover`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Размер шрифта"><input type="text" value={card.card.titleFontSize || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.titleFontSize`, e.target.value)} className={styles.input} /></Field>
            <Field label="Насыщенность">
              <select value={card.card.titleFontWeight || '400'} onChange={(e) => updateSetting(`cards.${cardKey}.card.titleFontWeight`, e.target.value)} className={styles.select}>
                <option value="400">Regular (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">SemiBold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="900">Black (900)</option>
              </select>
            </Field>
            <Field label="Межстрочный"><input type="text" value={card.card.titleLineHeight || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.titleLineHeight`, e.target.value)} className={styles.input} /></Field>
            <Field label="Выравнивание">
              <select value={card.card.titleTextAlign || 'left'} onChange={(e) => updateSetting(`cards.${cardKey}.card.titleTextAlign`, e.target.value)} className={styles.select}>
                <option value="left">По левому</option>
                <option value="center">По центру</option>
                <option value="right">По правому</option>
              </select>
            </Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>📄 Описание карточки</h5>
          <div className={styles.settingsGrid}>
            <Field label="Цвет">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.descColor || '#6b7280'} onChange={(e) => updateSetting(`cards.${cardKey}.card.descColor`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.descColor || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.descColor`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Размер шрифта"><input type="text" value={card.card.descFontSize || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.descFontSize`, e.target.value)} className={styles.input} /></Field>
            <Field label="Межстрочный"><input type="text" value={card.card.descLineHeight || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.descLineHeight`, e.target.value)} className={styles.input} /></Field>
            <Field label="Выравнивание">
              <select value={card.card.descTextAlign || 'left'} onChange={(e) => updateSetting(`cards.${cardKey}.card.descTextAlign`, e.target.value)} className={styles.select}>
                <option value="left">По левому</option>
                <option value="center">По центру</option>
                <option value="right">По правому</option>
              </select>
            </Field>
            <Field label="Макс. строк"><input type="number" min={1} max={10} value={card.card.descLines || 4} onChange={(e) => updateSetting(`cards.${cardKey}.card.descLines`, Number(e.target.value))} className={styles.input} /></Field>
          </div>
        </div>

        {(cardKey === 'programs' || cardKey === 'trainers') && (
          <div className={styles.settingsGroup}>
            <h5>🔻 Отогнутый уголок</h5>
            <div className={styles.settingsGrid}>
              <Field label="Включить"><input type="checkbox" checked={card.card.cornerFold || false} onChange={(e) => updateSetting(`cards.${cardKey}.card.cornerFold`, e.target.checked)} /></Field>
              <Field label="Цвет уголка">
                <div className={styles.colorInputRow}>
                  <input type="color" value={card.card.cornerFoldColor || '#3b82f6'} onChange={(e) => updateSetting(`cards.${cardKey}.card.cornerFoldColor`, e.target.value)} className={styles.colorInputNative} />
                  <input type="text" value={card.card.cornerFoldColor || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.cornerFoldColor`, e.target.value)} className={styles.input} />
                </div>
              </Field>
            </div>
          </div>
        )}

        <div className={styles.settingsGroup}>
          <h5>📷 Счётчик фотоальбома</h5>
          <div className={styles.settingsGrid}>
            <Field label="Фон">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.photoCountBg ? card.card.photoCountBg.substring(0, 7) : '#000'} onChange={(e) => updateSetting(`cards.${cardKey}.card.photoCountBg`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.photoCountBg || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.photoCountBg`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Цвет текста">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.photoCountColor || '#ffffff'} onChange={(e) => updateSetting(`cards.${cardKey}.card.photoCountColor`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.photoCountColor || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.photoCountColor`, e.target.value)} className={styles.input} />
              </div>
            </Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🔘 Кнопка</h5>
          <div className={styles.settingsGrid}>
            <Field label="Показывать">
              <input type="checkbox" checked={card.card.button?.visible !== false} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.visible`, e.target.checked)} />
            </Field>
            <Field label="Тип отображения">
              <select value={card.card.button?.display || 'inline-block'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.display`, e.target.value)} className={styles.select}>
                <option value="none">Не показывать</option>
                <option value="inline-block">inline-block</option>
                <option value="block">block</option>
              </select>
            </Field>
            <Field label="Позиционирование">
              <select value={card.card.button?.position || 'static'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.position`, e.target.value)} className={styles.select}>
                <option value="static">Статическое</option>
                <option value="absolute">Абсолютное</option>
              </select>
            </Field>
            <Field label="Выравнивание">
              <select value={card.card.button?.alignSelf || 'center'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.alignSelf`, e.target.value)} className={styles.select}>
                <option value="flex-start">Слева</option>
                <option value="center">По центру</option>
                <option value="flex-end">Справа</option>
                <option value="stretch">Растянуть</option>
              </select>
            </Field>
          </div>
        </div>

        {card.card.button?.position === 'absolute' && (
          <div className={styles.settingsGroup}>
            <h5>📍 Позиция кнопки (абсолютная)</h5>
            <div className={styles.settingsGrid}>
              <Field label="Сверху"><input type="text" value={card.card.button?.positionTop || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.positionTop`, e.target.value)} className={styles.input} placeholder="10px" /></Field>
              <Field label="Справа"><input type="text" value={card.card.button?.positionRight || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.positionRight`, e.target.value)} className={styles.input} placeholder="10px" /></Field>
              <Field label="Снизу"><input type="text" value={card.card.button?.positionBottom || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.positionBottom`, e.target.value)} className={styles.input} placeholder="10px" /></Field>
              <Field label="Слева"><input type="text" value={card.card.button?.positionLeft || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.positionLeft`, e.target.value)} className={styles.input} placeholder="10px" /></Field>
            </div>
          </div>
        )}

        <div className={styles.settingsGroup}>
          <h5>🎨 Кнопка - Размеры и отступы</h5>
          <div className={styles.settingsGrid}>
            <Field label="Ширина"><input type="text" value={card.card.button?.width || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.width`, e.target.value)} className={styles.input} placeholder="auto" /></Field>
            <Field label="Макс. ширина"><input type="text" value={card.card.button?.maxWidth || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.maxWidth`, e.target.value)} className={styles.input} placeholder="100%" /></Field>
            <Field label="Отступы"><input type="text" value={card.card.button?.padding || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.padding`, e.target.value)} className={styles.input} placeholder="0.75rem 1.5rem" /></Field>
            <Field label="Отступ сверху"><input type="text" value={card.card.button?.marginTop || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.marginTop`, e.target.value)} className={styles.input} placeholder="1rem" /></Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🎨 Кнопка - Цвета</h5>
          <div className={styles.settingsGrid}>
            <Field label="Фон">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.button?.background ? card.card.button.background.substring(0, 7) : '#4F46E5'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.background`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.button?.background || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.background`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Фон при наведении">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.button?.backgroundHover ? card.card.button.backgroundHover.substring(0, 7) : '#3730A3'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.backgroundHover`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.button?.backgroundHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.backgroundHover`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Цвет текста">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.button?.color ? card.card.button.color.substring(0, 7) : '#ffffff'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.color`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.button?.color || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.color`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Цвет при наведении">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.button?.colorHover ? card.card.button.colorHover.substring(0, 7) : '#ffffff'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.colorHover`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.button?.colorHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.colorHover`, e.target.value)} className={styles.input} />
              </div>
            </Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🔲 Кнопка - Границы</h5>
          <div className={styles.settingsGrid}>
            <Field label="Граница"><input type="text" value={card.card.button?.border || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.border`, e.target.value)} className={styles.input} placeholder="none" /></Field>
            <Field label="Цвет границы">
              <div className={styles.colorInputRow}>
                <input type="color" value={card.card.button?.borderColor ? card.card.button.borderColor.substring(0, 7) : '#4F46E5'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.borderColor`, e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={card.card.button?.borderColor || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.borderColor`, e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Радиус"><input type="text" value={card.card.button?.borderRadius || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.borderRadius`, e.target.value)} className={styles.input} placeholder="0.5rem" /></Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>✍️ Кнопка - Текст</h5>
          <div className={styles.settingsGrid}>
            <Field label="Размер шрифта"><input type="text" value={card.card.button?.fontSize || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.fontSize`, e.target.value)} className={styles.input} placeholder="0.875rem" /></Field>
            <Field label="Насыщенность">
              <select value={card.card.button?.fontWeight || '600'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.fontWeight`, e.target.value)} className={styles.select}>
                <option value="400">Regular (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">SemiBold (600)</option>
                <option value="700">Bold (700)</option>
              </select>
            </Field>
            <Field label="Регистр">
              <select value={card.card.button?.textTransform || 'none'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.textTransform`, e.target.value)} className={styles.select}>
                <option value="none">Обычный</option>
                <option value="uppercase">ВЕРХНИЙ РЕГИСТР</option>
                <option value="lowercase">нижний регистр</option>
                <option value="capitalize">Каждое Слово</option>
              </select>
            </Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>🌑 Кнопка - Тени</h5>
          <div className={styles.settingsGrid}>
            <Field label="Тень">
              <select value={card.card.button?.shadow || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.shadow`, e.target.value)} className={styles.select}>
                <option value="none">Нет</option>
                <option value="0 1px 3px rgba(0,0,0,0.1)">Лёгкая</option>
                <option value="0 4px 6px -1px rgba(0,0,0,0.1)">Средняя</option>
                <option value="0 10px 15px -3px rgba(0,0,0,0.1)">Сильная</option>
              </select>
            </Field>
            <Field label="Тень при наведении">
              <select value={card.card.button?.shadowHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.shadowHover`, e.target.value)} className={styles.select}>
                <option value="none">Нет</option>
                <option value="0 4px 6px -1px rgba(0,0,0,0.1)">Лёгкая</option>
                <option value="0 10px 15px -3px rgba(0,0,0,0.1)">Средняя</option>
                <option value="0 20px 25px -5px rgba(0,0,0,0.1)">Сильная</option>
              </select>
            </Field>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h5>⏱️ Кнопка - Анимация</h5>
          <div className={styles.settingsGrid}>
            <Field label="Переход">
              <select value={card.card.button?.transition || 'all'} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.transition`, e.target.value)} className={styles.select}>
                <option value="none">Нет</option>
                <option value="all">Все свойства</option>
                <option value="background">Только фон</option>
                <option value="transform">Только трансформация</option>
              </select>
            </Field>
            <Field label="Длительность"><input type="text" value={card.card.button?.transitionDuration || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.transitionDuration`, e.target.value)} className={styles.input} placeholder="0.3s" /></Field>
            <Field label="Трансформация"><input type="text" value={card.card.button?.transformHover || ''} onChange={(e) => updateSetting(`cards.${cardKey}.card.button.transformHover`, e.target.value)} className={styles.input} placeholder="scale(1.05)" /></Field>
          </div>
        </div>

        <div className={styles.previewSection}>
          <h5>👁️ Предпросмотр</h5>
          <div className={styles.cardPreview}>
            <div className={styles.previewCard} style={{
              minHeight: card.card.minHeight,
              borderWidth: card.card.borderWidth,
              borderColor: card.card.borderColor,
              borderRadius: card.card.borderRadius,
              boxShadow: card.card.shadow,
              background: '#fff',
              position: 'relative',
            }}>
              <div className={styles.previewImage} style={{ height: card.card.imageHeight, background: '#f3f4f6' }}>
                Изображение
                {card.card.cornerFold && <div className={styles.previewCornerFold} style={{ background: `linear-gradient(135deg, transparent 50%, ${card.card.cornerFoldColor || '#3b82f6'} 50%)` }} />}
              </div>
              <div style={{ padding: card.card.padding, display: 'flex', flexDirection: 'column', alignItems: card.card.button?.alignSelf || 'center' }}>
                <h6 style={{ color: card.card.titleColor, fontSize: card.card.titleFontSize, fontWeight: card.card.titleFontWeight, textAlign: card.card.titleTextAlign as any, marginBottom: '0.5rem' }}>Заголовок карточки</h6>
                <p style={{ color: card.card.descColor, fontSize: card.card.descFontSize, lineHeight: card.card.descLineHeight, textAlign: card.card.descTextAlign as any }}>Описание карточки с текстом...</p>
                {card.card.button?.visible !== false && card.card.button?.display !== 'none' && (
                  <button style={{
                    display: card.card.button?.display || 'inline-block',
                    position: card.card.button?.position || 'static',
                    top: card.card.button?.positionTop,
                    right: card.card.button?.positionRight,
                    bottom: card.card.button?.positionBottom,
                    left: card.card.button?.positionLeft,
                    width: card.card.button?.width,
                    maxWidth: card.card.button?.maxWidth,
                    padding: card.card.button?.padding,
                    marginTop: card.card.button?.marginTop || '1rem',
                    background: card.card.button?.background || '#4F46E5',
                    color: card.card.button?.color || '#ffffff',
                    border: card.card.button?.border || 'none',
                    borderRadius: card.card.button?.borderRadius || '0.5rem',
                    fontSize: card.card.button?.fontSize || '0.875rem',
                    fontWeight: card.card.button?.fontWeight || '600',
                    textTransform: card.card.button?.textTransform || 'none',
                    boxShadow: card.card.button?.shadow,
                    transition: card.card.button?.transitionDuration ? `${card.card.button?.transition} ${card.card.button?.transitionDuration}` : 'all 0.3s',
                    cursor: 'pointer',
                  }}>Подробнее</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SliderSettingsPanel = () => {
    const slider = settings.cards.slider;
    return (
      <div className={styles.cardSettingsPanel}>
        <h4>🎠 Слайдер (Главная)</h4>
        <div className={styles.settingsGroup}>
          <h5>📐 Секция слайдера</h5>
          <div className={styles.settingsGrid}>
            <Field label="Фон"><input type="text" value={slider.section.background || ''} onChange={(e) => updateSetting('cards.slider.section.background', e.target.value)} className={styles.input} /></Field>
          </div>
        </div>
        <div className={styles.settingsGroup}>
          <h5>🖼️ Слайд</h5>
          <div className={styles.settingsGrid}>
            <Field label="Высота (десктоп)"><input type="text" value={slider.slide.height || ''} onChange={(e) => updateSetting('cards.slider.slide.height', e.target.value)} className={styles.input} /></Field>
            <Field label="Высота (мобильный)"><input type="text" value={slider.slide.heightMobile || ''} onChange={(e) => updateSetting('cards.slider.slide.heightMobile', e.target.value)} className={styles.input} /></Field>
            <Field label="Радиус"><input type="text" value={slider.slide.borderRadius || ''} onChange={(e) => updateSetting('cards.slider.slide.borderRadius', e.target.value)} className={styles.input} /></Field>
            <Field label="Object Fit">
              <select value={slider.slide.objectFit || 'cover'} onChange={(e) => updateSetting('cards.slider.slide.objectFit', e.target.value)} className={styles.select}>
                <option value="cover">cover</option>
                <option value="contain">contain</option>
                <option value="fill">fill</option>
              </select>
            </Field>
          </div>
        </div>
        <div className={styles.settingsGroup}>
          <h5>📝 Текст на слайде</h5>
          <div className={styles.settingsGrid}>
            <Field label="Позиция">
              <select value={slider.text.position || 'center'} onChange={(e) => updateSetting('cards.slider.text.position', e.target.value)} className={styles.select}>
                <option value="top-left">Сверху слева</option>
                <option value="top-center">Сверху по центру</option>
                <option value="top-right">Сверху справа</option>
                <option value="center">По центру</option>
                <option value="bottom-left">Снизу слева</option>
                <option value="bottom-center">Снизу по центру</option>
                <option value="bottom-right">Снизу справа</option>
              </select>
            </Field>
            <Field label="Цвет текста">
              <div className={styles.colorInputRow}>
                <input type="color" value={slider.text.color || '#ffffff'} onChange={(e) => updateSetting('cards.slider.text.color', e.target.value)} className={styles.colorInputNative} />
                <input type="text" value={slider.text.color || ''} onChange={(e) => updateSetting('cards.slider.text.color', e.target.value)} className={styles.input} />
              </div>
            </Field>
            <Field label="Размер шрифта"><input type="text" value={slider.text.fontSize || ''} onChange={(e) => updateSetting('cards.slider.text.fontSize', e.target.value)} className={styles.input} /></Field>
            <Field label="Насыщенность">
              <select value={slider.text.fontWeight || '700'} onChange={(e) => updateSetting('cards.slider.text.fontWeight', e.target.value)} className={styles.select}>
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">SemiBold</option>
                <option value="700">Bold</option>
                <option value="900">Black</option>
              </select>
            </Field>
            <Field label="Фон"><input type="text" value={slider.text.background || ''} onChange={(e) => updateSetting('cards.slider.text.background', e.target.value)} className={styles.input} placeholder="rgba(0,0,0,0.5)" /></Field>
            <Field label="Отступы"><input type="text" value={slider.text.padding || ''} onChange={(e) => updateSetting('cards.slider.text.padding', e.target.value)} className={styles.input} /></Field>
            <Field label="Выравнивание">
              <select value={slider.text.textAlign || 'center'} onChange={(e) => updateSetting('cards.slider.text.textAlign', e.target.value)} className={styles.select}>
                <option value="left">По левому</option>
                <option value="center">По центру</option>
                <option value="right">По правому</option>
              </select>
            </Field>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🎨 Дизайн сайта {hasChanges ? '✨ изменения' : '✅ сохранено'}</h3>
      </div>

      <div className={styles.sectionTabs}>
        <button className={`${styles.sectionTab} ${activeSection === 'colors' ? styles.active : ''}`} onClick={() => setActiveSection('colors')}>🌈 Цвета</button>
        <button className={`${styles.sectionTab} ${activeSection === 'typography' ? styles.active : ''}`} onClick={() => setActiveSection('typography')}>📝 Текст</button>
        <button className={`${styles.sectionTab} ${activeSection === 'containers' ? styles.active : ''}`} onClick={() => setActiveSection('containers')}>📦 Контейнеры</button>
        <button className={`${styles.sectionTab} ${activeSection === 'cards' ? styles.active : ''}`} onClick={() => setActiveSection('cards')}>🃏 Карточки</button>
        <button className={`${styles.sectionTab} ${activeSection === 'width' ? styles.active : ''}`} onClick={() => setActiveSection('width')}>↔️ Ширина</button>
      </div>

      <div className={styles.content}>
        {activeSection === 'colors' && (
          <div className={styles.section}>
            <h4>Основные цвета сайта</h4>
            <div className={styles.colorsGrid}>
              <ColorPicker label="Основной" value={settings.colors.primary} onChange={(v) => updateSetting('colors.primary', v)} description="Кнопки, ссылки" />
              <ColorPicker label="Вторичный" value={settings.colors.secondary} onChange={(v) => updateSetting('colors.secondary', v)} />
              <ColorPicker label="Акцент" value={settings.colors.accent} onChange={(v) => updateSetting('colors.accent', v)} description="Выделения" />
              <ColorPicker label="Фон" value={settings.colors.background} onChange={(v) => updateSetting('colors.background', v)} />
              <ColorPicker label="Фон альт." value={settings.colors.backgroundAlt} onChange={(v) => updateSetting('colors.backgroundAlt', v)} />
              <ColorPicker label="Текст" value={settings.colors.text} onChange={(v) => updateSetting('colors.text', v)} />
              <ColorPicker label="Текст приглуш." value={settings.colors.textMuted} onChange={(v) => updateSetting('colors.textMuted', v)} />
              <ColorPicker label="Границы" value={settings.colors.border} onChange={(v) => updateSetting('colors.border', v)} />
            </div>
            <h4>Цвета компонентов</h4>
            <div className={styles.colorsGrid}>
              <ColorPicker label="Хедер фон" value={settings.colors.headerBg} onChange={(v) => updateSetting('colors.headerBg', v)} />
              <ColorPicker label="Футер фон" value={settings.colors.footerBg} onChange={(v) => updateSetting('colors.footerBg', v)} />
              <ColorPicker label="Карточки фон" value={settings.colors.cardBg} onChange={(v) => updateSetting('colors.cardBg', v)} />
              <ColorPicker label="Кнопка осн." value={settings.colors.buttonPrimary} onChange={(v) => updateSetting('colors.buttonPrimary', v)} />
              <ColorPicker label="Кнопка вторич." value={settings.colors.buttonSecondary} onChange={(v) => updateSetting('colors.buttonSecondary', v)} />
              <ColorPicker label="Ссылка" value={settings.colors.link} onChange={(v) => updateSetting('colors.link', v)} />
              <ColorPicker label="Ссылка при навед." value={settings.colors.linkHover} onChange={(v) => updateSetting('colors.linkHover', v)} />
            </div>
          </div>
        )}

        {activeSection === 'typography' && (
          <div className={styles.section}>
            <h4>Заголовки (h1-h6)</h4>
            <div className={styles.typographyGrid}>
              <Field label="Шрифт">
                <select value={settings.typography.headings.fontFamily} onChange={(e) => updateSetting('typography.headings.fontFamily', e.target.value)} className={styles.select}>
                  <option value="inherit">По умолчанию</option>
                  <option value="sans-serif">Sans-serif</option>
                  <option value="serif">Serif</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                </select>
              </Field>
              <Field label="Размер"><input type="text" value={settings.typography.headings.fontSize} onChange={(e) => updateSetting('typography.headings.fontSize', e.target.value)} className={styles.input} /></Field>
              <Field label="Насыщенность">
                <select value={settings.typography.headings.fontWeight} onChange={(e) => updateSetting('typography.headings.fontWeight', e.target.value)} className={styles.select}>
                  <option value="400">Regular</option>
                  <option value="600">SemiBold</option>
                  <option value="700">Bold</option>
                  <option value="900">Black</option>
                </select>
              </Field>
              <Field label="Цвет">
                <div className={styles.colorInputRow}>
                  <input type="color" value={settings.typography.headings.color} onChange={(e) => updateSetting('typography.headings.color', e.target.value)} className={styles.colorInputNative} />
                  <input type="text" value={settings.typography.headings.color} onChange={(e) => updateSetting('typography.headings.color', e.target.value)} className={styles.input} />
                </div>
              </Field>
              <Field label="Межстрочный"><input type="text" value={settings.typography.headings.lineHeight} onChange={(e) => updateSetting('typography.headings.lineHeight', e.target.value)} className={styles.input} /></Field>
              <Field label="Выравнивание">
                <select value={settings.typography.headings.textAlign} onChange={(e) => updateSetting('typography.headings.textAlign', e.target.value)} className={styles.select}>
                  <option value="left">По левому</option>
                  <option value="center">По центру</option>
                  <option value="right">По правому</option>
                </select>
              </Field>
            </div>
            <h4>Основной текст</h4>
            <div className={styles.typographyGrid}>
              <Field label="Шрифт">
                <select value={settings.typography.body.fontFamily} onChange={(e) => updateSetting('typography.body.fontFamily', e.target.value)} className={styles.select}>
                  <option value="inherit">По умолчанию</option>
                  <option value="sans-serif">Sans-serif</option>
                  <option value="serif">Serif</option>
                </select>
              </Field>
              <Field label="Размер"><input type="text" value={settings.typography.body.fontSize} onChange={(e) => updateSetting('typography.body.fontSize', e.target.value)} className={styles.input} /></Field>
              <Field label="Цвет">
                <div className={styles.colorInputRow}>
                  <input type="color" value={settings.typography.body.color} onChange={(e) => updateSetting('typography.body.color', e.target.value)} className={styles.colorInputNative} />
                  <input type="text" value={settings.typography.body.color} onChange={(e) => updateSetting('typography.body.color', e.target.value)} className={styles.input} />
                </div>
              </Field>
              <Field label="Межстрочный"><input type="text" value={settings.typography.body.lineHeight} onChange={(e) => updateSetting('typography.body.lineHeight', e.target.value)} className={styles.input} /></Field>
            </div>
            <h4>📱 Мобильная версия</h4>
            <div className={styles.typographyGrid}>
              <Field label="Заголовки - размер"><input type="text" value={settings.typography.mobile.headings.fontSize} onChange={(e) => updateSetting('typography.mobile.headings.fontSize', e.target.value)} className={styles.input} /></Field>
              <Field label="Заголовки - межстрочный"><input type="text" value={settings.typography.mobile.headings.lineHeight} onChange={(e) => updateSetting('typography.mobile.headings.lineHeight', e.target.value)} className={styles.input} /></Field>
              <Field label="Текст - размер"><input type="text" value={settings.typography.mobile.body.fontSize} onChange={(e) => updateSetting('typography.mobile.body.fontSize', e.target.value)} className={styles.input} /></Field>
              <Field label="Текст - межстрочный"><input type="text" value={settings.typography.mobile.body.lineHeight} onChange={(e) => updateSetting('typography.mobile.body.lineHeight', e.target.value)} className={styles.input} /></Field>
            </div>
          </div>
        )}

        {activeSection === 'containers' && (
          <div className={styles.section}>
            <h4>Десктоп</h4>
            <div className={styles.containersGrid}>
              <Field label="Макс. ширина"><input type="text" value={settings.containers.maxWidth} onChange={(e) => updateSetting('containers.maxWidth', e.target.value)} className={styles.input} /></Field>
              <Field label="Отступ"><input type="text" value={settings.containers.padding} onChange={(e) => updateSetting('containers.padding', e.target.value)} className={styles.input} /></Field>
              <Field label="Gap"><input type="text" value={settings.containers.gap} onChange={(e) => updateSetting('containers.gap', e.target.value)} className={styles.input} /></Field>
              <Field label="Радиус карточек"><input type="text" value={settings.containers.cardBorderRadius} onChange={(e) => updateSetting('containers.cardBorderRadius', e.target.value)} className={styles.input} /></Field>
              <Field label="Тень">
                <select value={settings.containers.cardShadow} onChange={(e) => updateSetting('containers.cardShadow', e.target.value)} className={styles.select}>
                  <option value="none">Нет</option>
                  <option value="0 1px 3px rgba(0,0,0,0.1)">Лёгкая</option>
                  <option value="0 4px 6px rgba(0,0,0,0.1)">Средняя</option>
                  <option value="0 10px 15px rgba(0,0,0,0.1)">Сильная</option>
                </select>
              </Field>
              <Field label="Отступ секций"><input type="text" value={settings.containers.sectionPadding} onChange={(e) => updateSetting('containers.sectionPadding', e.target.value)} className={styles.input} /></Field>
            </div>
            <h4>📱 Мобильная версия</h4>
            <div className={styles.containersGrid}>
              <Field label="Отступ"><input type="text" value={settings.containers.mobile.padding} onChange={(e) => updateSetting('containers.mobile.padding', e.target.value)} className={styles.input} /></Field>
              <Field label="Gap"><input type="text" value={settings.containers.mobile.gap} onChange={(e) => updateSetting('containers.mobile.gap', e.target.value)} className={styles.input} /></Field>
              <Field label="Радиус"><input type="text" value={settings.containers.mobile.cardBorderRadius} onChange={(e) => updateSetting('containers.mobile.cardBorderRadius', e.target.value)} className={styles.input} /></Field>
              <Field label="Отступ секций"><input type="text" value={settings.containers.mobile.sectionPadding} onChange={(e) => updateSetting('containers.mobile.sectionPadding', e.target.value)} className={styles.input} /></Field>
            </div>
          </div>
        )}

        {activeSection === 'cards' && (
          <div className={styles.section}>
            <div className={styles.cardTypeTabs}>
              <button className={`${styles.cardTypeTab} ${activeCardType === 'programs' ? styles.active : ''}`} onClick={() => setActiveCardType('programs')}>🎯 Программы</button>
              <button className={`${styles.cardTypeTab} ${activeCardType === 'trainers' ? styles.active : ''}`} onClick={() => setActiveCardType('trainers')}>👨‍🏫 Тренеры</button>
              <button className={`${styles.cardTypeTab} ${activeCardType === 'staff' ? styles.active : ''}`} onClick={() => setActiveCardType('staff')}>👥 Персонал</button>
              <button className={`${styles.cardTypeTab} ${activeCardType === 'news' ? styles.active : ''}`} onClick={() => setActiveCardType('news')}>📰 Новости</button>
              <button className={`${styles.cardTypeTab} ${activeCardType === 'slider' ? styles.active : ''}`} onClick={() => setActiveCardType('slider')}>🎠 Слайдер</button>
              <button className={`${styles.cardTypeTab} ${activeCardType === 'prices' ? styles.active : ''}`} onClick={() => setActiveCardType('prices')}>💰 Цены</button>
              <button className={`${styles.cardTypeTab} ${activeCardType === 'schedule' ? styles.active : ''}`} onClick={() => setActiveCardType('schedule')}>📅 Расписание</button>
            </div>
            {activeCardType === 'programs' && <CardSettingsPanel cardKey="programs" title="🎯 Программы тренировок" />}
            {activeCardType === 'trainers' && <CardSettingsPanel cardKey="trainers" title="👨‍🏫 Тренеры" />}
            {activeCardType === 'staff' && <CardSettingsPanel cardKey="staff" title="👥 Персонал" />}
            {activeCardType === 'news' && <CardSettingsPanel cardKey="news" title="📰 Новости" />}
            {activeCardType === 'slider' && <SliderSettingsPanel />}
            {activeCardType === 'prices' && <CardSettingsPanel cardKey="prices" title="💰 Цены" />}
            {activeCardType === 'schedule' && <CardSettingsPanel cardKey="schedule" title="📅 Расписание" />}
          </div>
        )}

        {activeSection === 'width' && (
          <div className={styles.section}>
            <h4>Ширина контента сайта</h4>
            <div className={styles.widthSettings}>
              <Field label="Режим">
                <select value={settings.contentWidth.mode} onChange={(e) => updateSetting('contentWidth.mode', e.target.value)} className={styles.select}>
                  <option value="percent">Проценты (%)</option>
                  <option value="px">Пиксели (px)</option>
                </select>
              </Field>
              <Field label={settings.contentWidth.mode === 'percent' ? 'Ширина (%)' : 'Ширина (px)'}>
                <input type="number" min={settings.contentWidth.mode === 'percent' ? 60 : 600} max={settings.contentWidth.mode === 'percent' ? 100 : 2000} value={settings.contentWidth.value} onChange={(e) => updateSetting('contentWidth.value', Number(e.target.value))} className={styles.input} />
              </Field>
            </div>
            {settings.contentWidth.mode === 'percent' && (
              <div className={styles.sliderContainer}>
                <input type="range" min={60} max={100} value={settings.contentWidth.value} onChange={(e) => updateSetting('contentWidth.value', Number(e.target.value))} className={styles.slider} />
                <span className={styles.sliderValue}>{settings.contentWidth.value}%</span>
              </div>
            )}
            <div className={styles.presetSection}>
              <h4>Быстрые настройки</h4>
              <div className={styles.presetButtons}>
                <button className={styles.presetBtn} onClick={() => setSettings({ ...settings, contentWidth: { mode: 'percent', value: 90 } })}>90%</button>
                <button className={styles.presetBtn} onClick={() => setSettings({ ...settings, contentWidth: { mode: 'percent', value: 80 } })}>80%</button>
                <button className={styles.presetBtn} onClick={() => setSettings({ ...settings, contentWidth: { mode: 'percent', value: 70 } })}>70%</button>
                <button className={styles.presetBtn} onClick={() => setSettings({ ...settings, contentWidth: { mode: 'px', value: 1200 } })}>1200px</button>
                <button className={styles.presetBtn} onClick={() => setSettings({ ...settings, contentWidth: { mode: 'px', value: 1400 } })}>1400px</button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.saveSection}>
          <button className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`} onClick={saveChanges} disabled={!hasChanges}>
            💾 Сохранить дизайн
          </button>
        </div>
      </div>
    </div>
  );
}
