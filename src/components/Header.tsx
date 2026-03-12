'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Head from 'next/head';
import { Menu, X } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  pageTitle?: string;
  logo?: string;
  openCallModal?: (reason: string) => void;
   clientNotification?: string; 
}

interface MenuItem {
  id: number | string;
  name: string;
}

export default function Header({ 
  pageTitle = 'Фитнес-клуб',
  logo = '/logo.png',
openCallModal = () => {},
  clientNotification = '' // ✅
}: HeaderProps) {
   const shouldShowNotification = clientNotification?.trim() && 
    clientNotification.trim().length > 0 &&
    clientNotification !== '\t';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProgramsOpen, setIsProgramsOpen] = useState(false);
  const [isTrainersOpen, setIsTrainersOpen] = useState(false);
  const [programsForMenu, setProgramsForMenu] = useState<MenuItem[]>([]);
  const [trainersForMenu, setTrainersForMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/db')
      .then(res => res.json())
      .then(data => {
        setProgramsForMenu(
          Array.isArray(data.programs) 
            ? data.programs.map((p: any) => ({ id: p.id, name: p.name }))
            : []
        );
        setTrainersForMenu(
          Array.isArray(data.trainers) 
            ? data.trainers.map((t: any) => ({ id: t.id, name: t.name }))
            : []
        );
        setLoading(false);
      })
      .catch(err => {
        console.error('Header fetch error:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    document.title = `${pageTitle} | Центр Функционального Развития Шифу Панда`;
  }, [pageTitle]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProgramsOpen(false);
        setIsTrainersOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(event.target as Node) && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    const handleScroll = () => {
      setIsProgramsOpen(false);
      setIsTrainersOpen(false);
      if (mobileMenuOpen) setMobileMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [mobileMenuOpen]);

  if (loading) {
    return (
      <header className={styles.header}>
        <div className={styles.topRow}>
          <div className={styles.logoSkeleton} />
          <div className={styles.navSkeleton} />
        </div>
      </header>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle} | Центр Функционального Развития Шифу Панда</title>
      </Head>
      <header className={`${styles.header} ${shouldShowNotification ? styles.withNotification : ''}`}>
        {/* ✅ 1. МЕНЮ - 60px */}
        <div className={styles.topRow}>
          <Link href="/" className={styles.logoLink}>
            {logo ? (
              <Image 
                src={logo} 
                alt="Логотип фитнес-клуба" 
                className={styles.logo}
                width={64}
                height={64}
                priority
              />
            ) : (
              <div className={styles.logoPlaceholder}>ФК</div>
            )}
          </Link>

          <button 
            className={styles.mobileToggle}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Меню"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <nav className={styles.desktopNav} ref={dropdownRef}>
            <ul className={styles.navList}>
              <li><Link href="/" className={styles.navLink}>Главная</Link></li>
              <li><Link href="/schedule" className={styles.navLink}>Расписание</Link></li>
              <li><Link href="/lk" className={styles.navLink}>Личный кабинет </Link></li>
              <li className={styles.dropdown}>
                <span className={styles.dropdownToggle} onClick={() => setIsProgramsOpen(!isProgramsOpen)}>
                  Программы ▼
                </span>
                <div className={`${styles.dropdownMenu} ${isProgramsOpen ? styles.open : ''}`}>
                  <Link href="/programs" className={`${styles.dropdownLink} ${styles.dropdownHeader}`}>
                    Все программы
                  </Link>
                  {programsForMenu.map((program) => (
                    <Link key={program.id} href={`/programs/${program.id}`} className={styles.dropdownLink}>
                      {program.name}
                    </Link>
                  ))}
                </div>
              </li>
              <li className={styles.dropdown}>
                <span className={styles.dropdownToggle} onClick={() => setIsTrainersOpen(!isTrainersOpen)}>
                  Коллектив ▼
                </span>
                <div className={`${styles.dropdownMenu} ${isTrainersOpen ? styles.open : ''}`}>
                  <Link href="/trainers" className={`${styles.dropdownLink} ${styles.dropdownHeader}`}>
                    Наш коллектив
                  </Link>
                  {trainersForMenu.map((trainer) => (
                    <Link key={trainer.id} href={`/trainers/${trainer.id}`} className={styles.dropdownLink}>
                      {trainer.name}
                    </Link>
                  ))}
                </div>
              </li>
            </ul>
          </nav>
        </div>

        {/* ✅ 2. ЗАГОЛОВОК - 30px */}
        <div className={styles.bottomRow}>
          <div className={styles.pageTitleContainer}>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
          </div>
        </div>

        {/* ✅ УВЕДОМЛЕНИЕ - ПОД ЗАГОЛОВКОМ */}
        {shouldShowNotification && (
          <div className={styles.notificationBanner}>
            <div className={styles.notificationContent}>
              <span className={styles.notificationIcon}>🔔</span>
              <span className={styles.notificationText}>{clientNotification}</span>
              <button className={styles.notificationClose}>×</button>
            </div>
          </div>
        )}

{/* ✅ МОБИЛЬНОЕ МЕНЮ */}
<div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileOpen : ''}`} ref={mobileRef}>
        <ul className={styles.mobileNavList}>
          <li><a href="/" className={styles.mobileNavLink}>Главная</a></li>
          <li><a href="/schedule" className={styles.mobileNavLink}>Расписание</a></li>
          <li><a href="/trainers" className={styles.mobileNavLink}>Коллектив</a></li>
           <li><a href="/programs" className={styles.mobileNavLink}>Все программы</a></li> 
           <li><a href="/lk" className={styles.mobileNavLink}>Личный кабинет</a></li>
           <span className={styles.mobileDropdownToggle}>Наши программы:</span>
           {programsForMenu.map((program: any) => (
                <li><a key={program.id} href={`/programs/${program.id}`} className={styles.mobileNavLink}>
                {program.name}
              </a></li>
              ))}
              <span className={styles.mobileDropdownToggle}>Наши тренеры:</span>
              {trainersForMenu.map((trainer: any) => (
                <li><a key={trainer.id} href={`/trainers/${trainer.id}`} className={styles.mobileNavLink}>
                  {trainer.name}
                </a></li>
              ))}

                  </ul>

      </div>

        {mobileMenuOpen && <div className={styles.mobileOverlay} onClick={() => setMobileMenuOpen(false)} />}
      </header>
    </>
  );
}
