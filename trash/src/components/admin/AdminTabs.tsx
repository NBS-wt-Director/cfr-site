'use client';
import styles from './AdminTabs.module.css';
import AdminGroups from './AdminGroups';

interface AdminTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <div className={styles.tabs}>
      <AdminGroups activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
