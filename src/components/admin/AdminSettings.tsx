'use client';
import { useState, useEffect } from 'react';
import styles from './AdminSettings.module.css';
import FileInput from '@/components/ui/FileInput';


interface SiteSettings {
  logo: string;
  favicon: string;
  clientNotification?: string;
}

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  adminEmail: string;
  errorEmail: string[];
}

interface AdminSettingsProps {
  siteSettings: SiteSettings;
  emailConfig: EmailConfig;
  onSave: (siteSettings: SiteSettings, emailConfig: EmailConfig) => void;
}

export default function AdminSettings({ 
  siteSettings: initialSiteSettings = { logo: '', favicon: '' }, 
  emailConfig: initialEmailConfig = {
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPass: '',
    fromName: '',
    adminEmail: '',
    errorEmail: []
  },
  onSave 
}: AdminSettingsProps) {
  const [clientNotification, setClientNotification] = useState(initialSiteSettings.clientNotification || '');
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(initialSiteSettings);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(initialEmailConfig);
  const [logoPreview, setLogoPreview] = useState('');
  const [faviconPreview, setFaviconPreview] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [errorEmails, setErrorEmails] = useState<string[]>(initialEmailConfig.errorEmail || []);
  const [newErrorEmail, setNewErrorEmail] = useState('');
const [hasChanges, setHasChanges] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailError, setTestEmailError] = useState('');

  useEffect(() => {
    setSiteSettings(initialSiteSettings);
    setLogoPreview(initialSiteSettings.logo);
    setFaviconPreview(initialSiteSettings.favicon);
    setClientNotification(initialSiteSettings.clientNotification || ''); // ✅
    setEmailConfig(initialEmailConfig);
    setErrorEmails(initialEmailConfig.errorEmail || []);
  }, [initialSiteSettings, initialEmailConfig]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setSiteSettings({...siteSettings, logo: reader.result as string});
        setHasChanges(true);
      };
    }
  };

  const handleFaviconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaviconFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFaviconPreview(reader.result as string);
        setSiteSettings({...siteSettings, favicon: reader.result as string});
        setHasChanges(true);
      };
    }
  };

  const addErrorEmail = () => {
    if (newErrorEmail.trim() && !errorEmails.includes(newErrorEmail.trim())) {
      setErrorEmails([...errorEmails, newErrorEmail.trim()]);
      setEmailConfig({...emailConfig, errorEmail: [...errorEmails, newErrorEmail.trim()]});
      setNewErrorEmail('');
      setHasChanges(true);
    }
  };

  const removeErrorEmail = (index: number) => {
    const newEmails = errorEmails.filter((_, i) => i !== index);
    setErrorEmails(newEmails);
    setEmailConfig({...emailConfig, errorEmail: newEmails});
    setHasChanges(true);
  };

  const saveChanges = () => {
     onSave({...siteSettings, clientNotification}, emailConfig); // ✅
  setHasChanges(false);
  };

  const sendTestEmail = async () => {
    setTestEmailLoading(true);
    setTestEmailError('');
    setTestEmailSent(false);
    try {
      // Отправляем текущий конфиг из формы (можно тестировать до сохранения)
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailConfig })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Неизвестная ошибка');
      }
      setTestEmailSent(true);
      setTimeout(() => setTestEmailSent(false), 5000);
    } catch (error: any) {
      console.error('Test email failed:', error);
      setTestEmailError(error.message || 'Ошибка отправки');
    } finally {
      setTestEmailLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>⚙️ Настройки сайта ({hasChanges ? '✨ изменения' : '✅ сохранено'})</h3>
      </div>

      <div className={styles.content}>
        <div className={styles.grid}>
          
          {/* ✅ БЛОК ЛОГО/ФАВИКОН */}
          <div className={styles.settingsCard}>
            <h4>🌐 Внешний вид сайта</h4>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Логотип (header/footer)</label>
                <div className={styles.imagePreview}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className={styles.logoPreview} />
                  ) : (
                    <div className={styles.noImage}>Нет логотипа</div>
                  )}
                </div>
                <FileInput
  accept="image/*"
  onChange={(file, preview) => {
    setLogoFile(file);
    setLogoPreview(preview);
    setSiteSettings({...siteSettings, logo: preview});
    setHasChanges(true);
  }}
  preview={logoPreview}
  label="Логотип (header/footer)"
/>
              </div>
              <div className={styles.field}>
                <label>Favicon (вкладка браузера)</label>
                <div className={styles.imagePreview}>
                  {faviconPreview ? (
                    <img src={faviconPreview} alt="Favicon preview" className={styles.faviconPreview} />
                  ) : (
                    <div className={styles.noImage}>Нет favicon</div>
                  )}
                </div>
<FileInput
  accept="image/*,.ico"
  onChange={(file, preview) => {
    setFaviconFile(file);
    setFaviconPreview(preview);
    setSiteSettings({...siteSettings, favicon: preview});
    setHasChanges(true);
  }}
  preview={faviconPreview}
  label="Favicon (вкладка браузера)"
/>
              </div>
            </div>
          </div>

          {/* ✅ БЛОК EMAIL */}
          <div className={styles.settingsCard}>
            <h4>📧 Настройки email</h4>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>SMTP Host</label>
                <input
                  value={emailConfig.smtpHost}
                  onChange={(e) => {
                    setEmailConfig({...emailConfig, smtpHost: e.target.value});
                    setHasChanges(true);
                  }}
                  className={styles.input}
                  placeholder="smtp.yandex.ru"
                />
              </div>
              <div className={styles.field}>
                <label>SMTP Port</label>
                <input
                  type="number"
                  value={emailConfig.smtpPort}
                  onChange={(e) => {
                    setEmailConfig({...emailConfig, smtpPort: Number(e.target.value)});
                    setHasChanges(true);
                  }}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>SSL/TLS</label>
                <input
                  type="checkbox"
                  checked={emailConfig.smtpSecure}
                  onChange={(e) => {
                    setEmailConfig({...emailConfig, smtpSecure: e.target.checked});
                    setHasChanges(true);
                  }}
                />
              </div>
              <div className={styles.field}>
                <label>Email отправителя</label>
                <input
                  value={emailConfig.smtpUser}
                  onChange={(e) => {
                    setEmailConfig({...emailConfig, smtpUser: e.target.value});
                    setHasChanges(true);
                  }}
                  className={styles.input}
                  type="email"
                />
              </div>
              <div className={styles.field}>
                <label>Пароль SMTP</label>
                <input
                  value={emailConfig.smtpPass}
                  onChange={(e) => {
                    setEmailConfig({...emailConfig, smtpPass: e.target.value});
                    setHasChanges(true);
                  }}
                  className={styles.input}
                  type="password"
                />
              </div>
              <div className={styles.field}>
                <label>Имя отправителя</label>
                <input
                  value={emailConfig.fromName}
                  onChange={(e) => {
                    setEmailConfig({...emailConfig, fromName: e.target.value});
                    setHasChanges(true);
                  }}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label>Админ email</label>
                <input
                  value={emailConfig.adminEmail}
                  onChange={(e) => {
                    setEmailConfig({...emailConfig, adminEmail: e.target.value});
                    setHasChanges(true);
                  }}
                  className={styles.input}
                  type="email"
                />
              </div>
            </div>

            {/* ✅ СПИСОК EMAIL НА ОШИБКИ */}
            <div className={styles.field}>
              <label>Email на ошибки (уведомления)</label>
              <div className={styles.emailList}>
                {errorEmails.map((email, index) => (
                  <div key={index} className={styles.emailItem}>
                    <span>{email}</span>
                    <button 
                      className={styles.removeEmailBtn}
                      onClick={() => removeErrorEmail(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.addEmailRow}>
                <input
                  value={newErrorEmail}
                  onChange={(e) => setNewErrorEmail(e.target.value)}
                  placeholder="новый@email.ru"
                  className={styles.input}
                />
                <button 
                  className={styles.addEmailBtn}
                  onClick={addErrorEmail}
                  disabled={!newErrorEmail.trim()}
                >
                  ➕ Добавить
                </button>
              </div>
            </div>

{/* ✅ ТЕСТ EMAIL */}
            <div className={styles.testSection}>
              <button 
                className={styles.testEmailBtn}
                onClick={sendTestEmail}
                disabled={!emailConfig.smtpUser || !emailConfig.smtpPass || testEmailLoading}
              >
                {testEmailLoading
                  ? '⏳ Отправка...'
                  : testEmailSent
                    ? '✅ Тест отправлен!'
                    : '📧 Тестовое письмо'}
              </button>
              {testEmailError && (
                <p className={styles.testEmailError}>
                  ❌ {testEmailError}
                </p>
              )}
            </div>
          </div>
        </div>
         
<div className={styles.settingsCard}>
  <h4>📢 Уведомление клиентов</h4>
  <div className={styles.field}>
    <label>Текст уведомления (показывается в Header)</label>
    <textarea
      value={clientNotification}
      onChange={(e) => {
        setClientNotification(e.target.value);
        setSiteSettings({...siteSettings, clientNotification: e.target.value});
        setHasChanges(true);
      }}
      className={styles.textarea}
      rows={4}
      placeholder="Важное объявление для всех клиентов..."
    />
    <small className={styles.helperText}>
      Пустое поле или только пробелы/табуляция = не показывать
    </small>
  </div>
</div>
        <div className={styles.saveSection}>
          <button 
            className={`${styles.saveBtn} ${hasChanges ? styles.saveBtnActive : ''}`}
            onClick={saveChanges}
            disabled={!hasChanges}
          >
            💾 Сохранить настройки
          </button>
        </div>
      </div>
    </div>
  );
}
