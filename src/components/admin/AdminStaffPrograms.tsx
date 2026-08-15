'use client';
import { useState, useEffect } from 'react';
import Accordion from '@/components/ui/Accordion';
import styles from './AdminStaffPrograms.module.css';
import FileInput from '@/components/ui/FileInput';

interface Photo {
  image?: string;
  url?: string;
  caption: string;
}

interface Trainer {
  id: number | string;
  image: string;
  name: string;
  experience: string[];
  type: string;
  description: string;
  specialization: string;
  isDirector: boolean;
  trainings: any[];
  photoAlbum: Photo[];
}

interface StaffMember {
  id: string;
  name: string;
  image: string;
  role: string;
}

interface AdminStaffProps {
  trainers: Trainer[];
  staff: StaffMember[];
  onSave: (trainers: Trainer[], staff: StaffMember[]) => void;
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

const EXPERIENCE_OPTIONS = [
  'тренер УрСФУ',
  'Старший тренер УрСФУ', 
  'тренер по Греко-Римской борьбе'
];

const STAFF_ROLES = [
  'администратор',
  'клининг', 
  'системный администратор',
  'техник',
  'помощник директора'
];

export default function AdminStaffPrograms({ 
  trainers: initialTrainers = [], 
  staff: initialStaff = [],
  onSave 
}: AdminStaffProps) {
  
  // ✅ ВСЕ СТЕЙТЫ СНАЧАЛА
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [localTrainers, setLocalTrainers] = useState<Trainer[]>([]);
  const [localStaff, setLocalStaff] = useState<StaffMember[]>([]);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [newTrainer, setNewTrainer] = useState({
    name: '',
    description: '',
    specialization: ''
  });
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: 'администратор'
  });
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState('');
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ✅ useEffect ПОСЛЕ всех стейтов
  useEffect(() => {
    const safeTrainers = (initialTrainers || []).map((t: any) => ({
      ...t,
      experience: Array.isArray(t.experience) ? t.experience : [t.experience || ''],
      photoAlbum: t.photoAlbum || [],
      trainings: t.trainings || [],
      description: t.description || '',
      specialization: t.specialization || '',
      isDirector: Boolean(t.isDirector)
    }));
    const safeStaff = (initialStaff || []).map((s: any) => ({
      ...s,
      role: s.role || 'администратор'
    }));
    
    setTrainers(safeTrainers);
    setLocalTrainers(safeTrainers);
    setStaff(safeStaff);
    setLocalStaff(safeStaff);
  }, [initialTrainers, initialStaff]);

  // ✅ ГЕТТЕР ДИРЕКТОРА (ПОСЛЕ trainers загружен)
  const directorTrainer = trainers.find(t => t.isDirector);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, callback: (preview: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewImage(file);
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result as string);
    }
  };

  const addTrainer = async () => {
    if (!newImage || !newTrainer.name.trim()) return;
    
    setUploading(true);
    try {
      const imageUrl = await uploadFile(newImage);
      
      const trainer: Trainer = {
        id: Date.now(),
        image: imageUrl,
        name: newTrainer.name,
        experience: [],
        type: 'trainer',
        description: newTrainer.description,
        specialization: newTrainer.specialization,
        isDirector: false,
        trainings: [],
        photoAlbum: []
      };
      
      const newTrainers = [trainer, ...localTrainers];
      setLocalTrainers(newTrainers);
      setTrainers(newTrainers);
      resetNewTrainer();
      setHasChanges(true);
    } catch (error) {
      console.error('Error uploading trainer image:', error);
      alert('Ошибка загрузки изображения');
    } finally {
      setUploading(false);
    }
  };

  const addStaff = async () => {
    if (!newImage || !newStaff.name.trim()) return;
    
    setUploading(true);
    try {
      const imageUrl = await uploadFile(newImage);
      
      const staffMember: StaffMember = {
        id: Date.now().toString(),
        name: newStaff.name,
        image: imageUrl,
        role: newStaff.role
      };
      
      const newStaffList = [staffMember, ...localStaff];
      setLocalStaff(newStaffList);
      setStaff(newStaffList);
      resetNewStaff();
      setHasChanges(true);
    } catch (error) {
      console.error('Error uploading staff image:', error);
      alert('Ошибка загрузки изображения');
    } finally {
      setUploading(false);
    }
  };

  const updateTrainer = (trainer: Trainer) => {
    const newTrainers = localTrainers.map(t => t.id === editingTrainer?.id ? trainer : t);
    setLocalTrainers(newTrainers);
    setTrainers(newTrainers);
    setHasChanges(true);
    setEditingTrainer(null);
  };

  const updateStaff = (member: StaffMember) => {
    const newStaffList = localStaff.map(s => s.id === editingStaff?.id ? member : s);
    setLocalStaff(newStaffList);
    setStaff(newStaffList);
    setHasChanges(true);
    setEditingStaff(null);
  };

  const deleteTrainer = (id: number | string) => {
    const newTrainers = localTrainers.filter(t => t.id !== id);
    setLocalTrainers(newTrainers);
    setTrainers(newTrainers);
    setHasChanges(true);
  };

  const deleteStaff = (id: string) => {
    const newStaffList = localStaff.filter(s => s.id !== id);
    setLocalStaff(newStaffList);
    setStaff(newStaffList);
    setHasChanges(true);
  };

  const resetNewTrainer = () => {
    setNewTrainer({ name: '', description: '', specialization: '' });
    setNewImage(null);
    setNewImagePreview('');
  };

  const resetNewStaff = () => {
    setNewStaff({ name: '', role: 'администратор' });
    setNewImage(null);
    setNewImagePreview('');
  };

  const saveChanges = () => {
    onSave(localTrainers, localStaff);
    setHasChanges(false);
  };

  const editTrainer = (trainer: Trainer) => {
    setEditingTrainer({...trainer});
    setNewImage(null);
    setNewPhoto(null);
    setNewPhotoCaption('');
  };

  const editStaff = (member: StaffMember) => {
    setEditingStaff({...member});
    setNewImage(null);
  };

  const cancelEdit = () => {
    setEditingTrainer(null);
    setEditingStaff(null);
    setNewImage(null);
    setNewPhoto(null);
    setNewPhotoCaption('');
  };

  const addPhotoToTrainer = async () => {
    if (!newPhoto || !editingTrainer || !newPhotoCaption.trim()) return;
    
    setUploading(true);
    try {
      const url = await uploadFile(newPhoto);
      
      const photo: Photo = {
        url,
        caption: newPhotoCaption,
      };
      
      const updatedTrainer = {
        ...editingTrainer,
        photoAlbum: [...(editingTrainer.photoAlbum || []), photo]
      };
      
      setEditingTrainer(updatedTrainer);
      setNewPhoto(null);
      setNewPhotoCaption('');
    } catch (error) {
      console.error('Error uploading trainer photo:', error);
      alert('Ошибка загрузки изображения');
    } finally {
      setUploading(false);
    }
  };

  // ✅ РЕНДЕР ПОСЛЕ ВСЕГО
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>👥 Сотрудники и тренеры ({trainers.length + staff.length})</h3>
      </div>

      <Accordion
        items={[
          {
            title: `🏋️ Тренера (${trainers.length}) ${directorTrainer ? '👑' : ''}`,
            content: (
              <div className={styles.section}>
                {/* ФОРМА СОЗДАНИЯ */}
                <div className={styles.addForm}>
                  <h4>➕ Новый тренер</h4>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label>ФИО</label>
                      <input
                        value={newTrainer.name}
                        onChange={(e) => setNewTrainer({...newTrainer, name: e.target.value})}
                        className={styles.input}
                        placeholder="Иванов Иван Иванович"
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Специализация</label>
                      <textarea
                        value={newTrainer.specialization}
                        onChange={(e) => setNewTrainer({...newTrainer, specialization: e.target.value})}
                        className={styles.textarea}
                        rows={3}
                        placeholder="Тайцзи-Цюань, Здоровая спина..."
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Фото</label>
                      <div className={styles.imagePreview}>
                        {newImagePreview && <img src={newImagePreview} alt="Preview" className={styles.previewImg} />}
                      </div>
                      <FileInput
  accept="image/*"
  onChange={(file, preview) => {
    setNewImage(file);
    setNewImagePreview(preview);
  }}
  preview={newImagePreview}
  label="Фото тренера"
/>
                    </div>
                    <button 
                      className={styles.addBtn} 
                      onClick={addTrainer} 
                      disabled={!newImage || !newTrainer.name.trim() || uploading}
                    >
                      {uploading ? '⏳ Загрузка...' : '➕ Добавить тренера'}
                    </button>
                  </div>
                </div>

                {/* СПИСОК */}
                <div className={styles.programsList}>
                  <div className={styles.grid}>
                    {trainers.map(trainer => (
                      <div key={trainer.id} className={styles.card}>
                        <div className={styles.cardButtons}>
                          <button 
                            className={styles.editBtn} 
                            onClick={() => editTrainer(trainer)}
                            title="Редактировать"
                          >
                            ✏️
                          </button>
                          <button 
                            className={styles.deleteBtn} 
                            onClick={() => deleteTrainer(trainer.id)}
                            title="Удалить"
                          >
                            🗑️
                          </button>
                        </div>
                        <div 
                          className={styles.cardImage} 
                          style={{backgroundImage: `url(${trainer.image})`}} 
                        />
                        <div className={styles.cardInfo}>
                          <h5>{trainer.name}</h5>
                          <div className={styles.experienceTags}>
                            {trainer.experience?.map((exp, i) => (
                              <span key={i} className={styles.tag}>{exp}</span>
                            )) || <span className={styles.noData}>Нет опыта</span>}
                          </div>
                          {trainer.isDirector && <span className={styles.directorBadge}>👑 Директор</span>}
                          <span className={styles.photosCount}>📸 {(trainer.photoAlbum || []).length}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ФОРМА РЕДАКТИРОВАНИЯ */}
                  {editingTrainer && (
                    <div className={styles.editForm}>
                      <h4>✏️ Редактировать: {editingTrainer.name}</h4>
                      <div className={styles.formFields}>
                        <div className={styles.field}>
                          <label>Директор</label>
                          <input
                            type="checkbox"
                            checked={editingTrainer.isDirector}
                            onChange={(e) => setEditingTrainer({
                              ...editingTrainer,
                              isDirector: e.target.checked
                            })}
                          />
                        </div>
                        <div className={styles.field}>
                          <label>Описание</label>
                          <textarea
                            value={editingTrainer.description || ''}
                            onChange={(e) => setEditingTrainer({
                              ...editingTrainer,
                              description: e.target.value
                            })}
                            className={styles.textarea}
                            rows={6}
                          />
                        </div>
                        <div className={styles.field}>
                          <label>Опыт (Ctrl+Click)</label>
                          <select
                            multiple
                            size={5}
                            value={editingTrainer.experience || []}
                            className={styles.combobox}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                              setEditingTrainer({...editingTrainer, experience: selected});
                            }}
                          >
                            {EXPERIENCE_OPTIONS.map(exp => (
                              <option key={exp} value={exp}>{exp}</option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label>АЛЬБОМ ({(editingTrainer.photoAlbum || []).length})</label>
                          <div className={styles.photoAlbumPreview}>
                            {(editingTrainer.photoAlbum || []).slice(0, 6).map((photo, i) => (
                              <div key={i} className={styles.photoMini}>
                                <img src={photo.url || photo.image || ''} alt={photo.caption} />
                                <span>{photo.caption}</span>
                              </div>
                            ))}
                          </div>
                          <div className={styles.photoAdd}>
                            <input
                              type="text"
                              value={newPhotoCaption}
                              onChange={(e) => setNewPhotoCaption(e.target.value)}
                              placeholder="Подпись"
                              className={styles.input}
                            />
                         <input
  type="file"
  accept="image/*"
  onChange={(e) => setNewPhoto(e.target.files?.[0] || null)}
  className={styles.fileInput}
/>
                            <button
                              onClick={addPhotoToTrainer}
                              disabled={!newPhoto || !newPhotoCaption.trim() || uploading}
                              className={styles.addPhotoBtn}
                            >
                              {uploading ? '⏳...' : '📸 Добавить'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className={styles.formActions}>
                        <button className={styles.saveBtn} onClick={() => updateTrainer(editingTrainer)}>
                          💾 Сохранить
                        </button>
                        <button className={styles.cancelBtn} onClick={cancelEdit}>
                          ❌ Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          },
          {
            title: `👥 Сотрудники (${staff.length})`,
            content: (
              <div className={styles.section}>
                <div className={styles.addForm}>
                  <h4>➕ Новый сотрудник</h4>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label>ФИО</label>
                      <input
                        value={newStaff.name}
                        onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Должность</label>
                      <select
                        value={newStaff.role}
                        onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                        className={styles.select}
                      >
                        {STAFF_ROLES.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Фото</label>
                      <div className={styles.imagePreview}>
                        {newImagePreview && <img src={newImagePreview} alt="Preview" className={styles.previewImg} />}
                      </div>
                      <FileInput
  accept="image/*"
  onChange={(file, preview) => {
    setNewImage(file);
    setNewImagePreview(preview);
  }}
  preview={newImagePreview}
  label="Фото сотрудника"
/>
                    </div>
                    <button 
                      className={styles.addBtn} 
                      onClick={addStaff} 
                      disabled={!newImage || !newStaff.name.trim() || uploading}
                    >
                      {uploading ? '⏳ Загрузка...' : '➕ Добавить сотрудника'}
                    </button>
                  </div>
                </div>

                <div className={styles.programsList}>
                  <div className={styles.grid}>
                    {staff.map(member => (
                      <div key={member.id} className={styles.card}>
                        <div className={styles.cardButtons}>
                          <button className={styles.editBtn} onClick={() => editStaff(member)}>
                            ✏️
                          </button>
                          <button className={styles.deleteBtn} onClick={() => deleteStaff(member.id)}>
                            🗑️
                          </button>
                        </div>
                        <div className={styles.cardImage} style={{backgroundImage: `url(${member.image})`}} />
                        <div className={styles.cardInfo}>
                          <h5>{member.name}</h5>
                          <span className={styles.roleBadge}>{member.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {editingStaff && (
                    <div className={styles.editForm}>
                      <h4>✏️ Редактировать: {editingStaff.name}</h4>
                      <div className={styles.formFields}>
                        <div className={styles.field}>
                          <label>ФИО</label>
                          <input
                            value={editingStaff.name}
                            onChange={(e) => setEditingStaff({
                              ...editingStaff,
                              name: e.target.value
                            })}
                            className={styles.input}
                          />
                        </div>
                        <div className={styles.field}>
                          <label>Должность</label>
                          <select
                            value={editingStaff.role}
                            onChange={(e) => setEditingStaff({
                              ...editingStaff,
                              role: e.target.value
                            })}
                            className={styles.select}
                          >
                            {STAFF_ROLES.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className={styles.formActions}>
                        <button className={styles.saveBtn} onClick={() => updateStaff(editingStaff)}>
                          💾 Сохранить
                        </button>
                        <button className={styles.cancelBtn} onClick={cancelEdit}>
                          ❌ Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          }
        ]}
      />

      <div className={styles.saveSection}>
        <button 
          className={`${styles.saveBtn} ${hasChanges ? styles.active : ''}`}
          onClick={saveChanges}
          disabled={!hasChanges}
        >
          💾 Сохранить ({trainers.length + staff.length} записей)
        </button>
      </div>
    </div>
  );
}
