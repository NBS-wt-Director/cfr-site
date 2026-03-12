'use client';
import { useState } from 'react';
import { Phone, Mail, MapPin } from 'lucide-react';
import styles from './HomeContactForm.module.css';

interface HomeContactFormProps {
  onSubmit: (formData: FormData) => void;
}

export default function HomeContactForm({ onSubmit }: HomeContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    reason: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    data.append('name', formData.name);
    data.append('phone', formData.phone);
    data.append('email', formData.email);
    data.append('reason', formData.reason);
    
    onSubmit(data);
    setSubmitted(true);
  };

  const handleReasonClick = (reason: string) => {
    setFormData(prev => ({ ...prev, reason }));
  };

  if (submitted) {
    return (
      <div className={styles.thanks}>
        <h3 className={styles.thanksTitle}>Спасибо!</h3>
        <p className={styles.thanksText}>Мы свяжемся с вами в ближайшее время</p>
        <button 
          onClick={() => setSubmitted(false)}
          className={styles.resetButton}
        >
          Новый запрос
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label>Имя</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div className={styles.field}>
        <label>Телефон</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          required
        />
      </div>

      <div className={styles.field}>
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        />
      </div>

      <div className={styles.field}>
        <label>Причина звонка</label>
        <div className={styles.reasonButtons}>
          <button 
            type="button"
            className={`${styles.reasonBtn} ${formData.reason === 'Запись на тренировку' ? styles.active : ''}`}
            onClick={() => handleReasonClick('Запись на тренировку')}
          >
            Запись на тренировку
          </button>
          <button 
            type="button"
            className={`${styles.reasonBtn} ${formData.reason === 'Консультация' ? styles.active : ''}`}
            onClick={() => handleReasonClick('Консультация')}
          >
            Консультация
          </button>
          <button 
            type="button"
            className={`${styles.reasonBtn} ${formData.reason === 'Другая причина' ? styles.active : ''}`}
            onClick={() => handleReasonClick('Другая причина')}
          >
            Другая причина
          </button>
        </div>
        <input
          type="text"
          value={formData.reason}
          onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
          placeholder="Выберите причину или напишите свою"
          required
        />
      </div>

      <button type="submit" className={styles.submitButton}>
        <Phone size={20} />
        Запросить звонок
      </button>
    </form>
  );
}
