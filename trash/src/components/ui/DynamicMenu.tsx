'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import styles from './DynamicMenu.module.css';

interface MenuItem {
  id: number;
  name: string;
  href?: string;
}

interface DynamicMenuProps {
  trainers: MenuItem[];
  programs: MenuItem[];
  isMobile?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function DynamicMenu({ 
  trainers, 
  programs, 
  isMobile = false, 
  isOpen, 
  onToggle 
}: DynamicMenuProps) {
  const [openSections, setOpenSections] = useState({
    trainers: false,
    programs: false
  });

  const toggleSection = (section: 'trainers' | 'programs') => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (isMobile && !isOpen) return null;

  return (
    <div className={styles[isMobile ? 'mobileMenu' : 'desktopMenu']}>
      {!isMobile && (
        <>
          <Link href="/schedule" className={styles.menuItem}>Расписание</Link>
          <div className={styles.dropdownContainer}>
            <button className={styles.dropdownButton} onClick={() => toggleSection('trainers')}>
              Наш коллектив <ChevronDown className={styles.chevron} />
            </button>
            {openSections.trainers && (
              <div className={styles.dropdown}>
                {trainers.slice(0, 8).map(trainer => (
                  <Link 
                    key={trainer.id} 
                    href={`/trainers/${trainer.id}`} 
                    className={styles.dropdownItem}
                  >
                    {trainer.name}
                  </Link>
                ))}
                {trainers.length > 8 && (
                  <Link href="/trainers" className={styles.dropdownItem}>Все тренеры ({trainers.length})</Link>
                )}
              </div>
            )}
          </div>
          <div className={styles.dropdownContainer}>
            <button className={styles.dropdownButton} onClick={() => toggleSection('programs')}>
              Программы <ChevronDown className={styles.chevron} />
            </button>
            {openSections.programs && (
              <div className={styles.dropdown}>
                {programs.slice(0, 6).map(program => (
                  <Link 
                    key={program.id} 
                    href={`/programs/${program.id}`} 
                    className={styles.dropdownItem}
                  >
                    {program.name}
                  </Link>
                ))}
                {programs.length > 6 && (
                  <Link href="/programs" className={styles.dropdownItem}>Все программы ({programs.length})</Link>
                )}
              </div>
            )}
          </div>
          <Link href="/news" className={styles.menuItem}>Новости</Link>
        </>
      )}

      {isMobile && (
        <div className={styles.mobileContainer}>
          <button onClick={onToggle!} className={styles.mobileToggle}>
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
          <nav className={styles.mobileNav}>
            <Link href="/schedule" className={styles.mobileLink}>📅 Расписание</Link>
            <button className={styles.mobileSection} onClick={() => toggleSection('trainers')}>
              👥 Наш коллектив ({trainers.length}) <ChevronRight size={20} />
            </button>
            {openSections.trainers && trainers.map(trainer => (
              <Link key={trainer.id} href={`/trainers/${trainer.id}`} className={styles.mobileSubLink}>
                {trainer.name}
              </Link>
            ))}
            <button className={styles.mobileSection} onClick={() => toggleSection('programs')}>
              🎯 Программы ({programs.length}) <ChevronRight size={20} />
            </button>
            {openSections.programs && programs.map(program => (
              <Link key={program.id} href={`/programs/${program.id}`} className={styles.mobileSubLink}>
                {program.name}
              </Link>
            ))}
            <Link href="/news" className={styles.mobileLink}>📰 Новости</Link>
          </nav>
        </div>
      )}
    </div>
  );
}
