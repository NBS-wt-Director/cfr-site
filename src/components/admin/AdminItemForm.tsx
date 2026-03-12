'use client';
import { useState, useEffect } from 'react';
import styles from './AdminItemForm.module.css';

interface AdminItemFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  fields: string[];
}

export default function AdminItemForm({ onSubmit, initialData, fields }: AdminItemFormProps) {
  // ✅ ИСПРАВЛЕНИЕ: Защита от null + дефолтные значения
  const [formData, setFormData] = useState<{ [key: string]: string }>({});

  // ✅ Инициализация формы при изменении initialData
  useEffect(() => {
    if (initialData) {
      const initialFormData: { [key: string]: string } = {};
      fields.forEach(field => {
        initialFormData[field] = initialData[field] || '';
      });
      setFormData(initialFormData);
    } else {
      // Сброс формы при отсутствии initialData
      const emptyFormData: { [key: string]: string } = {};
      fields.forEach(field => {
        emptyFormData[field] = '';
      });
      setFormData(emptyFormData);
    }
  }, [initialData, fields]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {fields.map((field) => (
        <div key={field} className={styles.field}>
          <label className={styles.label}>
            {field.charAt(0).toUpperCase() + field.slice(1)}
          </label>
          <input
            type={field === 'image' ? 'file' : 'text'}
            value={formData[field] || ''}
            onChange={(e) => handleChange(field, e.target.value)}
            className={styles.input}
            accept={field === 'image' ? 'image/*' : undefined}
            placeholder={`Введите ${field}`}
          />
        </div>
      ))}
      <button type="submit" className={styles.submit}>
        Сохранить
      </button>
    </form>
  );
}
