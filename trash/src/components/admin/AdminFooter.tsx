'use client';
import { useState, useEffect } from 'react';
import styles from './AdminSettings.module.css';

interface FooterSettings {
  enabled: boolean;
  showContacts: boolean;
  showSocial: boolean;
  showCopyright: boolean;
  copyrightText: string;
  showDevInfo: boolean;
  showLinks: boolean;
  links: Array<{ text: string; href: string }>;
}

const defaultFooterSettings: FooterSettings = {
  enabled: true,
  showContacts: true,
  showSocial: true,
  showCopyright: true,
  copyrightText: '© 2026 Шифу Панда. Екатеринбург. Все права защищены.',
  showDevInfo: false,
  showLinks: true,
  links: []
};

export default function AdminFooter() {
  const [settings, setSettings] = useState<FooterSettings>(defaultFooterSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/data/footer.json')
      .then(res => res.json())
      .then(data => {
        if (data) setSettings({ ...defaultFooterSettings, ...data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/footer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch (error) { console.error('Error:', error); }
    setSaving(false);
  };

  const handleLinkChange = (index: number, field: 'text' | 'href', value: string) => {
    const newLinks = [...settings.links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setSettings({ ...settings, links: newLinks });
  };

  const addLink = () => setSettings({ ...settings, links: [...settings.links, { text: '', href: '' }] });
  const removeLink = (index: number) => setSettings({ ...settings, links: settings.links.filter((_, i) => i !== index) });

  if (loading) return <div className="p-4">Загрузка...</div>;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🦶 Настройки футера</h2>
      <div className={styles.section}>
        <label className={styles.label}><input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className={styles.checkbox} /> Показывать футер</label>
      </div>
      <div className={styles.section}>
        <label className={styles.label}><input type="checkbox" checked={settings.showContacts} onChange={(e) => setSettings({ ...settings, showContacts: e.target.checked })} className={styles.checkbox} /> Контакты</label>
      </div>
      <div className={styles.section}>
        <label className={styles.label}><input type="checkbox" checked={settings.showSocial} onChange={(e) => setSettings({ ...settings, showSocial: e.target.checked })} className={styles.checkbox} /> Соцсети</label>
      </div>
      <div className={styles.section}>
        <label className={styles.label}><input type="checkbox" checked={settings.showCopyright} onChange={(e) => setSettings({ ...settings, showCopyright: e.target.checked })} className={styles.checkbox} /> Копирайт</label>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Текст копирайта</label>
        <input type="text" value={settings.copyrightText} onChange={(e) => setSettings({ ...settings, copyrightText: e.target.value })} className={styles.input} />
      </div>
      <div className={styles.section}>
        <label className={styles.label}><input type="checkbox" checked={settings.showLinks} onChange={(e) => setSettings({ ...settings, showLinks: e.target.checked })} className={styles.checkbox} /> Дополнительные ссылки</label>
      </div>
      {settings.showLinks && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}><label className={styles.label}>Ссылки</label><button onClick={addLink} className={styles.addButton}>+ Добавить</button></div>
          {settings.links.map((link, i) => (
            <div key={i} className={styles.socialRow}>
              <input type="text" value={link.text} onChange={(e) => handleLinkChange(i, 'text', e.target.value)} placeholder="Текст" className={styles.input} />
              <input type="url" value={link.href} onChange={(e) => handleLinkChange(i, 'href', e.target.value)} placeholder="Ссылка" className={styles.input} />
              <button onClick={() => removeLink(i)} className={styles.deleteButton}>✕</button>
            </div>
          ))}
        </div>
      )}
      <button onClick={handleSave} disabled={saving} className={styles.saveButton}>{saving ? 'Сохранение...' : saved ? '✅ Сохранено!' : '💾 Сохранить'}</button>
    </div>
  );
}
