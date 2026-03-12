'use client';
import { useRef, useState } from 'react';
import styles from './FileInput.module.css';

interface FileInputProps {
  accept?: string;
  onChange: (file: File | null, preview: string) => void;
  className?: string;
  preview?: string;
  label?: string;
}

export default function FileInput({ 
  accept = 'image/*', 
  onChange, 
  className = '', 
  preview, 
  label 
}: FileInputProps) {
  const [localPreview, setLocalPreview] = useState(preview || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const previewUrl = reader.result as string;
        setLocalPreview(previewUrl);
        onChange(file, previewUrl);
      };
      reader.readAsDataURL(file);
    } else {
      setLocalPreview('');
      onChange(null, '');
    }
    
    // ✅ КРИТИЧНО: СБРОС input
    e.target.value = '';
  };

  const resetFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setLocalPreview('');
    onChange(null, '');
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      
      {localPreview && (
        <div className={styles.preview}>
          <img src={localPreview} alt="Preview" className={styles.previewImg} />
          <button className={styles.resetBtn} onClick={resetFile}>×</button>
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className={styles.input}
      />
    </div>
  );
}
