'use client';
import { useEffect, useState } from 'react';

interface DesignSettings {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    backgroundAlt?: string;
    text?: string;
    textMuted?: string;
    border?: string;
    headerBg?: string;
    footerBg?: string;
    cardBg?: string;
    buttonPrimary?: string;
    buttonSecondary?: string;
    link?: string;
    linkHover?: string;
  };
typography?: {
    headings?: {
      fontFamily?: string;
      fontSize?: string;
      fontWeight?: string;
      color?: string;
      lineHeight?: string;
      letterSpacing?: string;
      textAlign?: string;
    };
    h1?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
    h2?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
    h3?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
    h4?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
    h5?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
    h6?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
    body?: {
      fontFamily?: string;
      fontSize?: string;
      fontWeight?: string;
      color?: string;
      lineHeight?: string;
      letterSpacing?: string;
      textAlign?: string;
    };
    menu?: { fontSize?: string; fontWeight?: string; color?: string };
    button?: { fontSize?: string; fontWeight?: string };
    footer?: { fontSize?: string; fontWeight?: string; color?: string };
    mobile?: {
      headings?: { fontSize?: string; lineHeight?: string };
      h1?: { fontSize?: string; lineHeight?: string };
      h2?: { fontSize?: string; lineHeight?: string };
      h3?: { fontSize?: string; lineHeight?: string };
      h4?: { fontSize?: string; lineHeight?: string };
      h5?: { fontSize?: string; lineHeight?: string };
      h6?: { fontSize?: string; lineHeight?: string };
      body?: { fontSize?: string; lineHeight?: string };
      menu?: { fontSize?: string; fontWeight?: string };
      button?: { fontSize?: string; fontWeight?: string };
      footer?: { fontSize?: string; fontWeight?: string };
    };
  };
  containers?: {
    maxWidth?: string;
    padding?: string;
    gap?: string;
    cardBorderRadius?: string;
    cardShadow?: string;
    cardPadding?: string;
    sectionPadding?: string;
  };
  contentWidth?: {
    mode?: string;
    value?: number;
  };
}

const defaultSettings: DesignSettings = {
  colors: {
    primary: '#4F46E5',
    secondary: '#7C3AED',
    accent: '#F59E0B',
    background: '#f5f0f0',
    backgroundAlt: '#F9FAFB',
    text: '#111827',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    headerBg: '#f9f0f0',
    footerBg: '#1F2937',
    cardBg: '#FFFFFF',
    buttonPrimary: '#4F46E5',
    buttonSecondary: '#6B7280',
    link: '#4F46E5',
    linkHover: '#3730A3'
  },
typography: {
    headings: {
      fontFamily: 'inherit',
      fontSize: '2rem',
      fontWeight: '700',
      color: '#111827',
      lineHeight: '1.2',
      letterSpacing: '0',
      textAlign: 'left'
    },
    h1: { fontSize: '2.25rem', fontWeight: '800', lineHeight: '1.15' },
    h2: { fontSize: '1.875rem', fontWeight: '700', lineHeight: '1.2' },
    h3: { fontSize: '1.5rem', fontWeight: '700', lineHeight: '1.25' },
    h4: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.3' },
    h5: { fontSize: '1.125rem', fontWeight: '600', lineHeight: '1.35' },
    h6: { fontSize: '1rem', fontWeight: '600', lineHeight: '1.4' },
    body: {
      fontFamily: 'inherit',
      fontSize: '1rem',
      fontWeight: '400',
      color: '#111827',
      lineHeight: '1.6',
      letterSpacing: '0',
      textAlign: 'left'
    },
    menu: { fontSize: '1.125rem', fontWeight: '600', color: '#111827' },
    button: { fontSize: '1rem', fontWeight: '600' },
    footer: { fontSize: '0.875rem', fontWeight: '400', color: '#ffffff' },
    mobile: {
      headings: { fontSize: '1.5rem', lineHeight: '1.3' },
      h1: { fontSize: '1.75rem', lineHeight: '1.2' },
      h2: { fontSize: '1.5rem', lineHeight: '1.25' },
      h3: { fontSize: '1.25rem', lineHeight: '1.3' },
      h4: { fontSize: '1.125rem', lineHeight: '1.35' },
      h5: { fontSize: '1rem', lineHeight: '1.4' },
      h6: { fontSize: '0.9375rem', lineHeight: '1.4' },
      body: { fontSize: '0.875rem', lineHeight: '1.5' },
      menu: { fontSize: '1.125rem', fontWeight: '600' },
      button: { fontSize: '0.9375rem', fontWeight: '600' },
      footer: { fontSize: '0.8125rem', fontWeight: '400' }
    }
  },
  containers: {
    maxWidth: '1200px',
    padding: '1rem',
    gap: '1rem',
    cardBorderRadius: '0.5rem',
    cardShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cardPadding: '1rem',
    sectionPadding: '2rem'
  },
  contentWidth: {
    mode: 'percent',
    value: 90
  }
};

export default function SiteStyles() {
  const [settings, setSettings] = useState<DesignSettings>(defaultSettings);

  useEffect(() => {
    // Загружаем настройки из API
    fetch('/api/db')
      .then(res => res.json())
      .then(data => {
        if (data.designSettings) {
          setSettings({ ...defaultSettings, ...data.designSettings });
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    // Применяем CSS переменные
    const root = document.documentElement;

    // Цвета — имена совпадают (primary, secondary, accent, ...)
    if (settings.colors) {
      Object.entries(settings.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value || '');
      });
    }

// Типографика заголовков — маппинг camelCase → kebab-case
    if (settings.typography?.headings) {
      const h = settings.typography.headings;
      if (h.fontFamily)    root.style.setProperty('--font-heading', h.fontFamily);
      if (h.fontSize)      root.style.setProperty('--font-size-heading', h.fontSize);
      if (h.fontWeight)    root.style.setProperty('--font-weight-heading', h.fontWeight);
      if (h.color)         root.style.setProperty('--color-heading', h.color);
      if (h.lineHeight)    root.style.setProperty('--line-height-heading', h.lineHeight);
      if (h.letterSpacing) root.style.setProperty('--letter-spacing-heading', h.letterSpacing);
      if (h.textAlign)     root.style.setProperty('--text-align-heading', h.textAlign);
    }

    // Индивидуальные размеры h1-h6 (десктоп)
    (['h1','h2','h3','h4','h5','h6'] as const).forEach(tag => {
      const t = settings.typography?.[tag];
      if (!t) return;
      if (t.fontSize)   root.style.setProperty(`--font-size-${tag}`, t.fontSize);
      if (t.fontWeight) root.style.setProperty(`--font-weight-${tag}`, t.fontWeight);
      if (t.lineHeight) root.style.setProperty(`--line-height-${tag}`, t.lineHeight);
    });

// Типографика основного текста
    if (settings.typography?.body) {
      const b = settings.typography.body;
      if (b.fontFamily)    root.style.setProperty('--font-body', b.fontFamily);
      if (b.fontSize)      root.style.setProperty('--font-size-body', b.fontSize);
      if (b.fontWeight)    root.style.setProperty('--font-weight-body', b.fontWeight);
      if (b.color)         root.style.setProperty('--color-body', b.color);
      if (b.lineHeight)    root.style.setProperty('--line-height-body', b.lineHeight);
      if (b.letterSpacing) root.style.setProperty('--letter-spacing-body', b.letterSpacing);
      if (b.textAlign)     root.style.setProperty('--text-align-body', b.textAlign);
    }

    // Меню
    if (settings.typography?.menu) {
      const m = settings.typography.menu;
      if (m.fontSize)   root.style.setProperty('--font-size-menu', m.fontSize);
      if (m.fontWeight) root.style.setProperty('--font-weight-menu', m.fontWeight);
      if (m.color)      root.style.setProperty('--color-menu', m.color);
    }

    // Кнопки
    if (settings.typography?.button) {
      const b = settings.typography.button;
      if (b.fontSize)   root.style.setProperty('--font-size-button', b.fontSize);
      if (b.fontWeight) root.style.setProperty('--font-weight-button', b.fontWeight);
    }

    // Футер
    if (settings.typography?.footer) {
      const f = settings.typography.footer;
      if (f.fontSize)   root.style.setProperty('--font-size-footer', f.fontSize);
      if (f.fontWeight) root.style.setProperty('--font-weight-footer', f.fontWeight);
      if (f.color)      root.style.setProperty('--color-footer-text', f.color);
    }

    // Мобильная версия
    if (settings.typography?.mobile) {
      const mob = settings.typography.mobile;
      const mobileMap: Record<string, any> = {
        '--font-size-mobile-h1': mob.h1?.fontSize,
        '--line-height-mobile-h1': mob.h1?.lineHeight,
        '--font-size-mobile-h2': mob.h2?.fontSize,
        '--line-height-mobile-h2': mob.h2?.lineHeight,
        '--font-size-mobile-h3': mob.h3?.fontSize,
        '--line-height-mobile-h3': mob.h3?.lineHeight,
        '--font-size-mobile-h4': mob.h4?.fontSize,
        '--line-height-mobile-h4': mob.h4?.lineHeight,
        '--font-size-mobile-h5': mob.h5?.fontSize,
        '--line-height-mobile-h5': mob.h5?.lineHeight,
        '--font-size-mobile-h6': mob.h6?.fontSize,
        '--line-height-mobile-h6': mob.h6?.lineHeight,
        '--font-size-mobile-body': mob.body?.fontSize,
        '--line-height-mobile-body': mob.body?.lineHeight,
        '--font-size-mobile-menu': mob.menu?.fontSize,
        '--font-weight-mobile-menu': mob.menu?.fontWeight,
        '--font-size-mobile-button': mob.button?.fontSize,
        '--font-weight-mobile-button': mob.button?.fontWeight,
        '--font-size-mobile-footer': mob.footer?.fontSize,
        '--font-weight-mobile-footer': mob.footer?.fontWeight,
        '--font-size-heading-mobile': mob.headings?.fontSize,
        '--line-height-heading-mobile': mob.headings?.lineHeight,
      };
      Object.entries(mobileMap).forEach(([prop, val]) => {
        if (val) root.style.setProperty(prop, String(val));
      });
    }

    // Контейнеры и карточки — маппинг camelCase → kebab-case
    if (settings.containers) {
      const c = settings.containers;
      if (c.maxWidth)        root.style.setProperty('--container-max-width', c.maxWidth);
      if (c.padding)         root.style.setProperty('--container-padding', c.padding);
      if (c.gap)             root.style.setProperty('--container-gap', c.gap);
      if (c.cardBorderRadius) root.style.setProperty('--card-border-radius', c.cardBorderRadius);
      if (c.cardShadow)      root.style.setProperty('--card-shadow', c.cardShadow);
      if (c.cardPadding)     root.style.setProperty('--card-padding', c.cardPadding);
      if (c.sectionPadding)  root.style.setProperty('--section-padding', c.sectionPadding);
    }

    if (settings.contentWidth) {
      root.style.setProperty('--content-width',
        settings.contentWidth.mode === 'percent'
          ? `${settings.contentWidth.value}%`
          : `${settings.contentWidth.value}px`
      );
    }
  }, [settings]);

  return null;
}
