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
    body?: {
      fontFamily?: string;
      fontSize?: string;
      fontWeight?: string;
      color?: string;
      lineHeight?: string;
      letterSpacing?: string;
      textAlign?: string;
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
    body: {
      fontFamily: 'inherit',
      fontSize: '1rem',
      fontWeight: '400',
      color: '#111827',
      lineHeight: '1.6',
      letterSpacing: '0',
      textAlign: 'left'
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
    
    if (settings.colors) {
      Object.entries(settings.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value || '');
      });
    }

    if (settings.typography?.headings) {
      Object.entries(settings.typography.headings).forEach(([key, value]) => {
        root.style.setProperty(`--heading-${key}`, value || '');
      });
    }

    if (settings.typography?.body) {
      Object.entries(settings.typography.body).forEach(([key, value]) => {
        root.style.setProperty(`--body-${key}`, value || '');
      });
    }

    if (settings.containers) {
      Object.entries(settings.containers).forEach(([key, value]) => {
        root.style.setProperty(`--container-${key}`, value || '');
      });
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
