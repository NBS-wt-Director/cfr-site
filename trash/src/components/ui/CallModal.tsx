'use client';
import { useState } from 'react';
import { X, CheckCircle, Phone } from 'lucide-react';
import styles from './CallModal.module.css';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
}

interface FormData {
  name: string;
  phone: string;
  email: string;
  message: string;
}

export default function CallModal({ isOpen, onClose, reason }: CallModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    email: '',
    message : ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSubmitError('');

    const submitData = { ...formData, reason };

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (res.ok) {
        // Отправляем статистику о форме
        try {
          await fetch('/api/admin/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'form', formType: reason })
          });
        } catch (e) { /* ignore */ }
        
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setFormData({ name: '', phone: '', email: '', message: '' });
        }, 3000);
      } else {
        setSubmitError('Ошибка отправки. Попробуйте позже.');
      }
    } catch (error) {
      setSubmitError('Ошибка соединения. Проверьте интернет.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ✅ ОСНОВНАЯ ФОРМА */}
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.header}>
            <h2 className={styles.title}>
              Заказать обратный звонок
              <br />
              <span className={styles.subtitle}>«{reason}»</span>
            </h2>
            <button onClick={onClose} className={styles.closeButton} aria-label="Закрыть">
              <X size={32} />
            </button>
          </div>

          {success ? (
            <div className={styles.successMessage}>
              <CheckCircle size={64} className={styles.successIcon} />
              <h3 className={styles.successTitle}>Заявка отправлена!</h3>
              <p className={styles.successText}>Мы перезвоним вам в течение 15 минут</p>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <input 
                type="text" 
                placeholder="Ваше имя *" 
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={styles.input}
                disabled={loading}
              />
              
              <input 
                type="tel" 
                placeholder="+7 (___) ___-__-__ *" 
                required
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className={styles.input}
                disabled={loading}
              />
              
              <input 
                type="email" 
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={styles.input}
                disabled={loading}
              />
              
              <input 
                type="text" 
                placeholder={reason}
                value={reason}
                readOnly
                className={`${styles.input} ${styles.readonlyInput}`}
                disabled={loading}
              />
              
              <textarea 
                placeholder="Комментарий (необязательно)"
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                className={`${styles.textarea} ${styles.input}`}
                disabled={loading}
              />

              {submitError && (
                <div className={styles.error}>{submitError}</div>
              )}

              <button 
                type="submit"
                disabled={loading || !formData.name || !formData.phone}
                className={`${styles.submitButton} ${loading || !formData.name || !formData.phone ? styles.disabled : ''}`}
              >
                <Phone size={32} />
                <span>{loading ? 'Отправляем...' : 'Заказать звонок'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ✅ СТИЛЬНЫЙ SUCCESS МОДАЛ */}
      {success && (
        <div className={styles.successOverlay}>
          <div className={styles.successModal}>
            <CheckCircle size={80} className={styles.bigSuccessIcon} />
            <h2 className={styles.bigSuccessTitle}>Спасибо!</h2>
            <p className={styles.bigSuccessText}>Специалист перезвонит вам в ближайшее время</p>
            <div className={styles.successTimer}>Закрывается через 3 сек...</div>
          </div>
        </div>
      )}
    </>
  );
}
