'use client';
import { useState, useEffect } from 'react';
import styles from './AdminPrograms.module.css';

interface Photo {
  url: string;
  caption: string;
  views: number;
}

interface Program {
  id: number;
  image: string;
  name: string;
  type: string;
  description: string;
  photoAlbum: Photo[];
  trainers: any[];
  workouts: any[];
  trainings: any[];
  reviews: any[];
}

interface AdminProgramsProps {
  programs: Program[];
  onSave: (programs: Program[]) => void;
}

// ========================
// Загрузка файла на сервер
// ========================
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

export default function AdminPrograms({ programs: initialPrograms = [] as Program[], onSave }: AdminProgramsProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [localPrograms, setLocalPrograms] = useState<Program[]>([]);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [newProgram, setNewProgram] = useState({
    name: '',
    description: ''
  });
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState('');
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [editingImagePreview, setEditingImagePreview] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [availableTrainers, setAvailableTrainers] = useState<any[]>([]);

  useEffect(() => {
    // ✅ БЕЗОПАСНАЯ загрузка данных
    const safePrograms = (initialPrograms || []).map(program => ({
      ...program,
      photoAlbum: program.photoAlbum || [],
      trainers: program.trainers || [],
      workouts: program.workouts || [],
      trainings: program.trainings || [],
      reviews: program.reviews || [],
      description: program.description || ''
    }));
    setPrograms(safePrograms);
    setLocalPrograms(safePrograms);
  }, [initialPrograms]);

  // ✅ Загрузка списка тренеров для привязки к программе
  useEffect(() => {
    fetch('/api/trainers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableTrainers(data);
      })
      .catch(err => console.error('Error loading trainers:', err));
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setNewImagePreview(reader.result as string);
    }
  };

  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditingImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingImagePreview(reader.result as string);
      };
    }
  };

  const addProgram = async () => {
    if (!newImage || !newProgram.name.trim()) return;
    
    setUploading(true);
    try {
      const imageUrl = await uploadFile(newImage);
      
      const program: Program = {
        id: Date.now(),
        image: imageUrl,
        name: newProgram.name,
        type: 'trainer',
        description: newProgram.description || '',
        photoAlbum: [],
        trainers: [],
        workouts: [],
        trainings: [],
        reviews: []
      };
      
      const newPrograms = [program, ...localPrograms];
      setLocalPrograms(newPrograms);
      setPrograms(newPrograms);
      setNewProgram({ name: '', description: '' });
      setNewImage(null);
      setNewImagePreview('');
      setEditingProgram(null);
      setHasChanges(true);
    } catch (error) {
      console.error('Error uploading program image:', error);
      alert('Ошибка загрузки изображения');
    } finally {
      setUploading(false);
    }
  };

  const updateProgram = async () => {
    if (!editingProgram) return;
    
    setUploading(true);
    try {
      let updatedProgram = { ...editingProgram };
      
      // Загружаем новое изображение если выбрано
      if (editingImage) {
        const uploadedUrl = await uploadFile(editingImage);
        updatedProgram = {
          ...updatedProgram,
          image: uploadedUrl
        };
      }
      
      const newPrograms = localPrograms.map(p => p.id === editingProgram.id ? updatedProgram : p);
      setLocalPrograms(newPrograms);
      setPrograms(newPrograms);
      setHasChanges(true);
      setEditingProgram(null);
      setEditingImage(null);
      setEditingImagePreview('');
    } catch (error) {
      console.error('Error updating program:', error);
      alert('Ошибка загрузки изображения');
    } finally {
      setUploading(false);
    }
  };

  const deleteProgram = (id: number) => {
    const newPrograms = localPrograms.filter(p => p.id !== id);
    setLocalPrograms(newPrograms);
    setPrograms(newPrograms);
    setHasChanges(true);
  };

  const addPhotoToAlbum = (programId: number, photo: Photo) => {
    const newPrograms = localPrograms.map(program => {
      if (program.id === programId) {
        return { 
          ...program, 
          photoAlbum: [...(program.photoAlbum || []), photo] 
        };
      }
      return program;
    });
    setLocalPrograms(newPrograms);
    setPrograms(newPrograms);
    setHasChanges(true);
  };

  const saveChanges = () => {
    onSave(localPrograms);
    setHasChanges(false);
  };

  // ✅ БЕЗОПАСНЫЕ геттеры
  const safeProgramStats = (program: Program) => ({
    photoAlbumLength: (program.photoAlbum || []).length,
    trainersLength: (program.trainers || []).length,
    descriptionPreview: (program.description || '').substring(0, 80)
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🎯 Программы ({programs.length})</h3>
      </div>

      <div className={styles.content}>
        {/* 1. ФОРМА НОВОЙ ПРОГРАММЫ */}
        <div className={styles.formsSection}>
          <h4>➕ Создать новую программу</h4>
          <div className={styles.addSection}>
            <input
              value={newProgram.name}
              onChange={(e) => setNewProgram({...newProgram, name: e.target.value})}
              placeholder="Название программы"
              className={styles.input}
            />
            <textarea
              value={newProgram.description}
              onChange={(e) => setNewProgram({...newProgram, description: e.target.value})}
              placeholder="Описание программы"
              className={styles.textarea}
              rows={3}
            />
            <div className={styles.imagePreview}>
              {newImagePreview && (
                <img src={newImagePreview} alt="Preview" className={styles.previewImg} />
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageSelect} 
              className={styles.fileInput} 
            />
            <button 
              onClick={addProgram} 
              className={styles.addBtn} 
              disabled={!newImage || !newProgram.name.trim() || uploading}
            >
              {uploading ? '⏳ Загрузка...' : '➕ Создать программу'}
            </button>
          </div>
        </div>

        <div className={styles.mainGrid}>
          {/* 2. ФОРМА РЕДАКТИРОВАНИЯ */}
          <div className={styles.formSection}>
            {editingProgram ? (
              <div className={styles.editForm}>
                <h4>✏️ Редактировать: {editingProgram.name}</h4>
                <div className={styles.formFields}>
                  <div className={styles.field}>
                    <label>Название</label>
                    <input 
                      value={editingProgram.name}
                      onChange={(e) => setEditingProgram({
                        ...editingProgram, name: e.target.value
                      })}
                      className={styles.input} 
                    />
                  </div>
                  
                  <div className={styles.field}>
                    <label>Тип</label>
                    <input 
                      value={editingProgram.type || ''}
                      onChange={(e) => setEditingProgram({
                        ...editingProgram, type: e.target.value
                      })}
                      className={styles.input}
                      list="programTypes"
                      placeholder="trainer, group, section..."
                    />
                    <datalist id="programTypes">
                      <option value="trainer" />
                      <option value="group" />
                      <option value="section" />
                      <option value="masterclass" />
                    </datalist>
                  </div>
                  
                  <div className={styles.field}>
                    <label>Описание</label>
                    <textarea 
                      value={editingProgram.description || ''}
                      onChange={(e) => setEditingProgram({
                        ...editingProgram, description: e.target.value
                      })}
                      className={styles.textarea} 
                      rows={6} 
                    />
                  </div>
                  
                  <div className={styles.field}>
                    <label>Тренеры ({(editingProgram.trainers || []).length})</label>
                    {availableTrainers.length > 0 ? (
                      <div className={styles.trainerList}>
                        {availableTrainers.map((t: any) => {
                          const selectedIds = (editingProgram.trainers || []).map(String);
                          const checked = selectedIds.includes(String(t.id));
                          return (
                            <label key={t.id} className={styles.trainerCheckbox}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const ids = new Set((editingProgram.trainers || []).map(String));
                                  if (e.target.checked) {
                                    ids.add(String(t.id));
                                  } else {
                                    ids.delete(String(t.id));
                                  }
                                  setEditingProgram({
                                    ...editingProgram,
                                    trainers: [...ids]
                                  });
                                }}
                              />
                              <span>{t.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={styles.noData}>Тренеры не загружены</p>
                    )}
                  </div>
                  
                  <div className={styles.field}>
                    <label>Расписание ({(editingProgram.workouts || []).length})</label>
                    <div className={styles.workoutList}>
                      {(editingProgram.workouts || []).map((w: any, idx: number) => (
                        <div key={idx} className={styles.workoutRow}>
                          <input
                            value={w.day || ''}
                            onChange={(e) => {
                              const workouts = [...(editingProgram.workouts || [])];
                              workouts[idx] = { ...workouts[idx], day: e.target.value };
                              setEditingProgram({ ...editingProgram, workouts });
                            }}
                            className={styles.input}
                            placeholder="День"
                          />
                          <input
                            value={w.time || ''}
                            onChange={(e) => {
                              const workouts = [...(editingProgram.workouts || [])];
                              workouts[idx] = { ...workouts[idx], time: e.target.value };
                              setEditingProgram({ ...editingProgram, workouts });
                            }}
                            className={styles.input}
                            placeholder="Время (10:45)"
                          />
                          <button
                            className={styles.removeWorkoutBtn}
                            onClick={() => {
                              const workouts = (editingProgram.workouts || []).filter((_, i) => i !== idx);
                              setEditingProgram({ ...editingProgram, workouts });
                            }}
                            title="Удалить тренировку"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className={styles.addWorkoutBtn}
                      onClick={() => {
                        const workouts = [
                          ...(editingProgram.workouts || []),
                          { day: '', time: '', params: [] }
                        ];
                        setEditingProgram({ ...editingProgram, workouts });
                      }}
                    >
                      ➕ Добавить тренировку
                    </button>
                  </div>
                  
                  <div className={styles.field}>
                    <label>Главное фото</label>
                    <div className={styles.imagePreview}>
                      <img 
                        src={editingImagePreview || editingProgram.image} 
                        alt="Preview" 
                        className={styles.previewImg}
                      />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageSelect}
                      className={styles.fileInput}
                    />
                    {editingImage && <small className="text-gray-500 text-sm mt-1 block">Выбран новый файл — загрузится при сохранении</small>}
                  </div>
                  
                  <div className={styles.field}>
                    <label>Фотогалерея ({(editingProgram.photoAlbum || []).length})</label>
                    <div className={styles.photoAlbumPreview}>
                      {(editingProgram.photoAlbum || []).slice(0, 6).map((photo, index) => (
                        <div key={index} className={styles.photoMini}>
                          <img src={photo.url} alt={photo.caption} />
                          <span>{photo.caption}</span>
                        </div>
                      ))}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !editingProgram) return;
                        
                        setUploading(true);
                        try {
                          const url = await uploadFile(file);
                          const photo: Photo = {
                            url,
                            caption: `Фото ${((editingProgram.photoAlbum || []).length + 1)}`,
                            views: 0
                          };
                          addPhotoToAlbum(editingProgram.id, photo);
                        } catch (error) {
                          console.error('Error uploading album photo:', error);
                          alert('Ошибка загрузки изображения');
                        } finally {
                          setUploading(false);
                        }
                      }}
                      className={styles.fileInput} 
                    />
                  </div>
                </div>
                
                <div className={styles.formActions}>
                  <button 
                    className={styles.saveProgramBtn} 
                    onClick={updateProgram}
                    disabled={uploading}
                  >
                    {uploading ? '⏳ Загрузка...' : '💾 Обновить'}
                  </button>
                  <button 
                    className={styles.deleteProgramBtn} 
                    onClick={() => deleteProgram(editingProgram.id)}
                  >
                    🗑️ Удалить
                  </button>
                  <button 
                    className={styles.cancelBtn} 
                    onClick={() => setEditingProgram(null)}
                  >
                    ❌ Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.noSelection}>
                <h4>👆 Выберите программу для редактирования</h4>
                <p>Используйте кнопки ✏️ на плитках справа</p>
              </div>
            )}
          </div>

          {/* 3. ПЛИТКИ */}
          <div className={styles.programsList}>
  <h4>📋 Все программы ({programs.length})</h4>
  <div className={styles.divider}></div>
  <div className={styles.grid}>
    {programs.map(program => {
      const stats = safeProgramStats(program);
      return (
        <div key={program.id} className={styles.programCard}>
          {/* ✅ КНОПКИ ПРЯМО ПЕРВЫМИ */}
          <div className={styles.programButtons}>
            <button 
              className={styles.editProgramBtn}
              onClick={(e) => {
                e.stopPropagation();
                setEditingProgram(program);
              }}
              title="Редактировать"
            >
              ✏️
            </button>
            <button 
              className={styles.deleteProgramBtn}
              onClick={(e) => {
                e.stopPropagation();
                deleteProgram(program.id);
              }}
              title="Удалить"
            >
              🗑️
            </button>
          </div>
          
          <div 
            className={styles.programImage} 
            style={{ backgroundImage: `url(${program.image})` }} 
          />
          <div className={styles.programInfo}>
            <h5>{program.name}</h5>
            <p>{stats.descriptionPreview}...</p>
            <div className={styles.programStats}>
              <span>📸 {stats.photoAlbumLength}</span>
              <span>👨‍🏫 {stats.trainersLength}</span>
            </div>
          </div>
        </div>
      );
    })}
  </div>
</div>

        </div>

        <div className={styles.saveSection}>
          <button 
            onClick={saveChanges}
            className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`}
            disabled={!hasChanges}
          >
            💾 Сохранить все изменения {hasChanges && '(изменено)'}
          </button>
        </div>

        <div className={styles.status}>
          {hasChanges ? '✨ Изменения ждут сохранения' : '✅ Все изменения сохранены'}
        </div>
      </div>
    </div>
  );
}
