'use client';
import { useState, useEffect } from 'react';
import styles from './AdminSettings.module.css';
import FileInput from '@/components/ui/FileInput';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  media: string | null;
  enabled: boolean;
  code: string;
  order: number;
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.url || data.path;
}

export default function AdminPages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState('');

  useEffect(() => {
    fetch('/api/admin/pages').then(res => res.json()).then(data => { setPages(data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!editingPage) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingPage) });
      if (res.ok) {
        const data = await res.json();
        setPages(prev => {
          const existing = prev.find(p => p.id === editingPage.id);
          if (existing) return prev.map(p => p.id === editingPage.id ? data.page : p);
          return [...prev, data.page];
        });
        setEditingPage(null);
      }
    } catch (error) { console.error('Error:', error); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить страницу?')) return;
    await fetch(`/api/admin/pages?id=${id}`, { method: 'DELETE' });
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const createNewPage = () => {
    setEditingPage({ id: '', slug: '', title: '', content: '', media: null, enabled: true, code: '', order: pages.length + 1 });
    setMediaPreview('');
  };

  const handleMediaUpload = async (file: File, preview: string) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setEditingPage(prev => prev ? { ...prev, media: url } : null);
      setMediaPreview(preview);
    } catch (error) { console.error('Error:', error); alert('Ошибка загрузки'); }
    setUploading(false);
  };

  const startEdit = (page: Page) => { setEditingPage(page); setMediaPreview(page.media || ''); };

  if (loading) return <div className="p-4">Загрузка...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.title}>📄 Ручные страницы</h2>
        <button onClick={createNewPage} className={styles.addButton}>+ Добавить</button>
      </div>

      {!editingPage && (
        <div className={styles.list}>
          {pages.length === 0 ? <p className="text-gray-500 p-4">Страниц нет</p> : pages.map(page => (
            <div key={page.id} className={styles.listItem}>
              <div className={styles.listItemContent}>
                <span className={styles.listItemTitle}>{page.title}</span>
                <span className={styles.listItemSubtitle}>{page.slug}</span>
              </div>
              <div className={styles.listItemActions}>
                <button onClick={() => setEditingPage({ ...page, enabled: !page.enabled })} className={`${styles.statusButton} ${page.enabled ? styles.enabled : ''}`}>{page.enabled ? 'Вкл' : 'Выкл'}</button>
                <button onClick={() => startEdit(page)} className={styles.editButton}>✏️</button>
                <button onClick={() => handleDelete(page.id)} className={styles.deleteButton}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingPage && (
        <div className={styles.form}>
          <div className={styles.grid}>
            <div className={styles.field}><label className={styles.label}>Адрес (slug)</label><input type="text" value={editingPage.slug} onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })} placeholder="/obuchenie" className={styles.input} /></div>
            <div className={styles.field}><label className={styles.label}>Название</label><input type="text" value={editingPage.title} onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })} placeholder="Обучение" className={styles.input} /></div>
            <div className={styles.field}><label className={styles.label}>Порядок</label><input type="number" value={editingPage.order} onChange={(e) => setEditingPage({ ...editingPage, order: parseInt(e.target.value) || 0 })} className={styles.input} /></div>
          </div>
          <div className={styles.field}><label className={styles.label}><input type="checkbox" checked={editingPage.enabled} onChange={(e) => setEditingPage({ ...editingPage, enabled: e.target.checked })} className={styles.checkbox} /> Включить</label></div>
          <div className={styles.field}>
            <label className={styles.label}>Медиа (фото/видео)</label>
            {mediaPreview && <div className="mb-4">{editingPage.media?.endsWith('.mp4') ? <video src={mediaPreview} className="max-h-48 rounded" controls /> : <img src={mediaPreview} alt="Preview" className="max-h-48 rounded" />}</div>}
            <FileInput accept="image/*,video/*" onChange={handleMediaUpload} preview={mediaPreview} label="Выбрать файл" />
            <input type="text" value={editingPage.media || ''} onChange={(e) => { setEditingPage({ ...editingPage, media: e.target.value || null }); setMediaPreview(e.target.value); }} placeholder="Или ссылка" className={`${styles.input} mt-2`} />
          </div>
          <div className={styles.field}><label className={styles.label}>Текст</label><textarea value={editingPage.content} onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })} className={styles.textarea} rows={6} /></div>
          <div className={styles.field}><label className={styles.label}>Код (MD/HTML)</label><textarea value={editingPage.code} onChange={(e) => setEditingPage({ ...editingPage, code: e.target.value })} className={styles.textarea} rows={12} placeholder="## Заголовок" /></div>
          <div className={styles.buttonGroup}>
            <button onClick={handleSave} disabled={saving || uploading} className={styles.saveButton}>{saving ? 'Сохранение...' : uploading ? 'Загрузка...' : '💾 Сохранить'}</button>
            <button onClick={() => setEditingPage(null)} className={styles.cancelButton}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
