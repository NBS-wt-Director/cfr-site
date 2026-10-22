'use client';
import { Trash2 } from 'lucide-react';
import styles from './AdminSocialSettings.module.css';

interface SocialItem {
  id: string;
  title: string;
  url: string;
}

interface AdminSocialSettingsProps {
  social: SocialItem[];
  onUpdate: (social: SocialItem[]) => void;
}

export default function AdminSocialSettings({ social, onUpdate }: AdminSocialSettingsProps) {
  const predefinedSocial = [
    { id: 'vk', title: 'ВКонтакте', icon: '📘' },
    { id: 'telegram', title: 'Telegram', icon: '📱' },
    { id: 'balloo', title: 'мы в BALLOO (скоро)', icon: '🎈' },
    { id: 'max', title: 'мы в MAX (скоро)', icon: '⭐' }
  ];

  const updateSocial = (id: string, field: 'title' | 'url', value: string) => {
    const newSocial = social.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    onUpdate(newSocial);
  };

  return (
    <div className={styles.container}>
      <h3 className="text-3xl font-bold mb-8">🌐 Социальные сети</h3>
      
      <div className="space-y-4">
        {predefinedSocial.map(socialItem => {
          const current = social.find(s => s.id === socialItem.id) || 
            { id: socialItem.id, title: socialItem.title, url: '' };
          
          return (
            <div key={socialItem.id} className="p-6 bg-white/50 rounded-2xl border-2 border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-3xl">{socialItem.icon}</span>
                <h4 className="text-xl font-bold">{socialItem.title}</h4>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  value={current.title}
                  onChange={(e) => updateSocial(socialItem.id, 'title', e.target.value)}
                  placeholder="Название кнопки"
                  className="p-4 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:border-yellow-400 focus:outline-none"
                />
                <input
                  value={current.url}
                  onChange={(e) => updateSocial(socialItem.id, 'url', e.target.value)}
                  placeholder="https://vk.com/group"
                  className="p-4 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:border-yellow-400 focus:outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
