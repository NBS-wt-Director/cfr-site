'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './AdminNews.module.css';
import FileInput from '@/components/ui/FileInput';

interface NewsItem {
  id: number;
  image: string;
  title: string;
  text: string;
  previewText?: string;
  fullText?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
}

interface AdminNewsProps {
  news: NewsItem[];
  onSave: (news: NewsItem[]) => void;
}

// Функция загрузки файла на сервер
async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    throw new Error('Upload failed');
  }
  
  const data = await res.json();
  return data.url || data.path;
}

// Функция проверки длительности видео
function checkVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Не удалось загрузить видео'));
    };
    video.src = URL.createObjectURL(file);
  });
}

export default function AdminNews({ news: initialNews = [], onSave }: AdminNewsProps) {
  const [localNews, setLocalNews] = useState<NewsItem[]>([]);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [newNews, setNewNews] = useState({
    title: '',
    text: ''
  });
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState('');
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [editingImagePreview, setEditingImagePreview] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoError, setVideoError] = useState('');

  // Новые поля для видео и ссылок VK
  const [newMediaType, setNewMediaType] = useState<'file' | 'vk'>('file');
  const [newVkLink, setNewVkLink] = useState('');
  const [editingMediaType, setEditingMediaType] = useState<'file' | 'vk'>('file');
  const [editingVkLink, setEditingVkLink] = useState('');

  useEffect(() => {
    const safeNews = (initialNews || []).map((item: any) => ({
      ...item,
      title: item.title || '',
      text: item.text || '',
      previewText: item.previewText || item.text?.substring(0, 100) || '',
      fullText: item.fullText || item.text || ''
    }));
    setLocalNews(safeNews);
  }, [initialNews]);


  const addNews = async () => {
    if (!newNews.title.trim() || !newNews.text.trim()) return;
    
    // Проверяем, что есть либо файл, либо ссылка VK
    if (newMediaType === 'file' && !newImage) return;
    if (newMediaType === 'vk' && !newVkLink.trim()) return;
    
    setUploading(true);
    setVideoError('');
    
    try {
      let imageUrl = '';
      let videoUrl = '';
      let mediaType: 'image' | 'video' = 'image';
      
      if (newMediaType === 'file') {
        // Проверяем видео на длительность
        if (newImage!.type.startsWith('video/')) {
          const duration = await checkVideoDuration(newImage!);
          if (duration > 120) {
            setUploading(false);
            setVideoError('Видео не должно быть длиннее 2 минут');
            return;
          }
        }
        
        // Загружаем файл на сервер
        const uploadedUrl = await uploadFile(newImage!);
        
        // Определяем тип медиа по расширению файла
        const fileType = newImage!.type;
        if (fileType.startsWith('video/')) {
          mediaType = 'video';
          videoUrl = uploadedUrl;
        } else {
          imageUrl = uploadedUrl;
        }
      } else {
        // Ссылка VK - сохраняем как есть (для видео используем iframe при отображении)
        imageUrl = newVkLink;
        if (newVkLink.includes('vk.com/video') || newVkLink.includes('vkvideo.ru')) {
          mediaType = 'video';
          videoUrl = newVkLink;
          imageUrl = '';
        }
      }
      
      const newsItem: NewsItem = {
        id: Date.now(),
        image: imageUrl,
        title: newNews.title,
        text: newNews.text,
        previewText: newNews.text.substring(0, 100),
        fullText: newNews.text,
        videoUrl: videoUrl || undefined,
        mediaType
      };
      
      const newNewsList = [newsItem, ...localNews];
      setLocalNews(newNewsList);
      resetNewNews();
      setHasChanges(true);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Ошибка загрузки файла. Попробуйте ещё раз.');
    }
    
    setUploading(false);
  };

  const updateNews = async () => {
    if (!editingNews) return;
    
    setUploading(true);
    
    try {
      let updatedNews = { ...editingNews };
      
      // Если есть новый файл - загружаем
      if (editingImage) {
        const uploadedUrl = await uploadFile(editingImage);
        const fileType = editingImage.type;
        
        if (fileType.startsWith('video/')) {
          updatedNews = {
            ...updatedNews,
            image: '',
            videoUrl: uploadedUrl,
            mediaType: 'video'
          };
        } else {
          updatedNews = {
            ...updatedNews,
            image: uploadedUrl,
            videoUrl: undefined,
            mediaType: 'image'
          };
        }
      } else if (editingMediaType === 'vk') {
        // Обновляем VK ссылку
        const isVideo = editingVkLink.includes('vk.com/video') || editingVkLink.includes('vkvideo.ru');
        updatedNews = {
          ...updatedNews,
          image: isVideo ? '' : editingVkLink,
          videoUrl: isVideo ? editingVkLink : undefined,
          mediaType: isVideo ? 'video' : 'image'
        };
      }
      
      const newNewsList = localNews.map(item => 
        item.id === editingNews.id ? updatedNews : item
      );
      setLocalNews(newNewsList);
      setHasChanges(true);
      setEditingNews(null);
      setEditingImage(null);
    } catch (error) {
      console.error('Error updating news:', error);
      alert('Ошибка загрузки файла. Попробуйте ещё раз.');
    }
    
    setUploading(false);
  };

  const deleteNews = (id: number) => {
    const newNewsList = localNews.filter(item => item.id !== id);
    setLocalNews(newNewsList);
    setHasChanges(true);
  };

  const resetNewNews = () => {
    setNewNews({ title: '', text: '' });
    setNewImage(null);
    setNewImagePreview('');
    setNewMediaType('file');
    setNewVkLink('');
  };

  const saveChanges = () => {
    onSave(localNews);
    setHasChanges(false);
  };

  const safeTextPreview = (text: string) => text.length > 80 
    ? text.substring(0, 80) + '...' 
    : text;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>📰 Новости ({localNews.length})</h3>
      </div>

      <div className={styles.content}>
        {/* ✅ ФОРМА НОВОЙ НОВОСТИ */}
        <div className={styles.addSection}>
          <h4>➕ Новая новость</h4>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Заголовок</label>
              <input
                value={newNews.title}
                onChange={(e) => setNewNews({...newNews, title: e.target.value})}
                className={styles.input}
                placeholder="Введите заголовок новости"
              />
            </div>
            <div className={styles.field}>
              <label>Текст</label>
              <textarea
                value={newNews.text}
                onChange={(e) => setNewNews({...newNews, text: e.target.value})}
                className={styles.textarea}
                rows={4}
                placeholder="Краткий текст новости..."
              />
            </div>
            <div className={styles.field}>
              <label>Медиафайл</label>
              <div className={styles.mediaTypeToggle}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${newMediaType === 'file' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setNewMediaType('file')}
                >
                  📁 Файл
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${newMediaType === 'vk' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setNewMediaType('vk')}
                >
                  🔗 VK
                </button>
              </div>
              
              {newMediaType === 'file' ? (
                <>
                  <div className={styles.imagePreview}>
                    {newImagePreview && (
                      newImage?.type.startsWith('video/') ? (
                        <video src={newImagePreview} className={styles.previewImg} controls />
                      ) : (
                        <div className={styles.cropPreview}>
                          <img src={newImagePreview} alt="Preview" className={styles.previewImgCrop} />
                          <div className={styles.cropOverlay}>
                            <span>Фото будет обрезано до вертикального формата (3:4)</span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                  <FileInput
                    accept="image/*,video/*"
                    onChange={(file, preview) => {
                      setVideoError('');
                      // Проверяем длительность видео при выборе
                      if (file?.type.startsWith('video/')) {
                        checkVideoDuration(file)
                          .then(duration => {
                            if (duration > 120) {
                              setVideoError('Видео не должно быть длиннее 2 минут');
                              setNewImage(null);
                              setNewImagePreview('');
                            } else {
                              setNewImage(file);
                              setNewImagePreview(preview);
                            }
                          })
                          .catch(() => {
                            setNewImage(file);
                            setNewImagePreview(preview);
                          });
                      } else {
                        setNewImage(file);
                        setNewImagePreview(preview);
                      }
                    }}
                    preview={newImagePreview}
                    label="Фото или видео"
                  />
                  {videoError && <p className={styles.error}>{videoError}</p>}
                  <p className={styles.hint}>📐 Фото: вертикальное 3:4 (A4). Видео: максимум 2 минуты</p>
                </>
              ) : (
                <div className={styles.vkLinkField}>
                  <input
                    type="url"
                    value={newVkLink}
                    onChange={(e) => setNewVkLink(e.target.value)}
                    className={styles.input}
                    placeholder="Ссылка VK (фото или видео)"
                  />
                  <p className={styles.hint}>Скопируйте ссылку из VK и вставьте сюда</p>
                </div>
              )}
            </div>
            <button 
              className={styles.addBtn}
              onClick={addNews}
              disabled={
                uploading ||
                (newMediaType === 'file' && !newImage) || 
                (newMediaType === 'vk' && !newVkLink.trim()) ||
                !newNews.title.trim() || 
                !newNews.text.trim()
              }
            >
              {uploading ? '⏳ Загрузка...' : '➕ Опубликовать новость'}
            </button>
          </div>
        </div>

        {/* ✅ ОСНОВНАЯ СЕТКА */}
        <div className={styles.mainGrid}>
          {/* ФОРМА РЕДАКТИРОВАНИЯ */}
          <div className={styles.formSection}>
            {editingNews ? (
              <div className={styles.editForm}>
                <h4>✏️ Редактировать: {editingNews.title}</h4>
                <div className={styles.formFields}>
                  <div className={styles.field}>
                    <label>Заголовок</label>
                    <input 
                      value={editingNews.title}
                      onChange={(e) => setEditingNews({
                        ...editingNews, 
                        title: e.target.value
                      })}
                      className={styles.input} 
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Текст</label>
                    <textarea 
                      value={editingNews.text}
                      onChange={(e) => setEditingNews({
                        ...editingNews, 
                        text: e.target.value
                      })}
                      className={styles.textarea} 
                      rows={8} 
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Медиафайл</label>
                    <div className={styles.mediaTypeToggle}>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${editingMediaType === 'file' ? styles.toggleBtnActive : ''}`}
                        onClick={() => setEditingMediaType('file')}
                      >
                        📁 Файл
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${editingMediaType === 'vk' ? styles.toggleBtnActive : ''}`}
                        onClick={() => setEditingMediaType('vk')}
                      >
                        🔗 VK
                      </button>
                    </div>
                    
                    {editingMediaType === 'file' ? (
                      <>
                        <div className={styles.imagePreview}>
                          {(editingImagePreview || editingNews.image) && (
                            editingNews.mediaType === 'video' && editingNews.videoUrl ? (
                              <video 
                                src={editingImagePreview || editingNews.videoUrl} 
                                className={styles.previewImg} 
                                controls 
                              />
                            ) : (
                              <img 
                                src={editingImagePreview || editingNews.image} 
                                alt="Preview" 
                                className={styles.previewImg}
                              />
                            )
                          )}
                        </div>
                        <FileInput
                          accept="image/*,video/*"
                          onChange={(file, preview) => {
                            setEditingImage(file);
                            setEditingImagePreview(preview);
                            const isVideo = file?.type.startsWith('video/');
                            setEditingNews({ 
                              ...editingNews!, 
                              image: isVideo ? '' : preview,
                              videoUrl: isVideo ? preview : undefined,
                              mediaType: isVideo ? 'video' : 'image'
                            });
                          }}
                          preview={editingImagePreview || (editingNews?.mediaType === 'video' ? editingNews.videoUrl : editingNews?.image)}
                          label="Фото или видео"
                        />
                      </>
                    ) : (
                      <div className={styles.vkLinkField}>
                        <input
                          type="url"
                          value={editingVkLink || editingNews.image}
                          onChange={(e) => {
                            setEditingVkLink(e.target.value);
                            const isVideo = e.target.value.includes('vk.com/video');
                            setEditingNews({
                              ...editingNews,
                              image: isVideo ? '' : e.target.value,
                              videoUrl: isVideo ? e.target.value : undefined,
                              mediaType: isVideo ? 'video' : 'image'
                            });
                          }}
                          className={styles.input}
                          placeholder="Ссылка на фото или видео из VK"
                        />
                        {(editingVkLink || editingNews.image) && editingNews.mediaType !== 'video' && (
                          <div className={styles.vkPreview}>
                            <img 
                              src={editingVkLink || editingNews.image} 
                              alt="VK Preview" 
                              className={styles.previewImg} 
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button className={styles.saveNewsBtn} onClick={updateNews}>
                    💾 Обновить новость
                  </button>
                  <button className={styles.deleteNewsBtn} onClick={() => deleteNews(editingNews.id)}>
                    🗑️ Удалить
                  </button>
                  <button className={styles.cancelBtn} onClick={() => setEditingNews(null)}>
                    ❌ Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.noSelection}>
                <h4>👆 Выберите новость для редактирования</h4>
                <p>Кликните ✏️ на плитке справа</p>
              </div>
            )}
          </div>

          {/* ПЛИТКИ */}
          <div className={styles.newsList}>
            <h4>📋 Все новости ({localNews.length})</h4>
            <div className={styles.divider}></div>
            <div className={styles.grid}>
              {localNews.map((item) => (
                <div key={item.id} className={styles.newsCard}>
                  <div className={styles.cardButtons}>
                    <button 
                      className={styles.editBtn}
                      onClick={() => {
                        setEditingNews(item);
                        setEditingImagePreview(item.mediaType === 'video' ? (item.videoUrl || '') : item.image);
                        setEditingMediaType(item.videoUrl?.includes('vk.com') || item.image?.includes('vk.com') ? 'vk' : 'file');
                        setEditingVkLink(item.videoUrl?.includes('vk.com') || item.image?.includes('vk.com') ? (item.videoUrl || item.image) : '');
                      }}
                    >
                      ✏️
                    </button>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => deleteNews(item.id)}
                    >
                      🗑️
                    </button>
                  </div>
                  <div 
                    className={styles.newsImage} 
                    style={{ backgroundImage: `url(${item.image})` }} 
                  />
                  <div className={styles.newsInfo}>
                    <h5>{item.title}</h5>
                    <p>{safeTextPreview(item.text)}</p>
                    <div className={styles.newsMeta}>
                      <span>🆔 {item.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.saveSection}>
          <button 
            className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`}
            onClick={saveChanges}
            disabled={!hasChanges}
          >
            💾 Сохранить все изменения {hasChanges && '(новые)'}
          </button>
        </div>

        <div className={styles.status}>
          {hasChanges ? '✨ Изменения ждут сохранения' : '✅ Все сохранено'}
        </div>
      </div>
    </div>
  );
}
