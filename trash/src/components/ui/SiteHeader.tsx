'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Phone, ChevronDown, User } from 'lucide-react';
import styles from './SiteHeader.module.css';

interface MenuItem {
  id: number | string;
  name: string;
  href?: string;
}

interface SectionItem {
  id: string;
  title: string;
}

interface HeaderSettings {
  titleSuffix: string
  componentsEnabled: {
    callButton: boolean
    pageTitle: boolean
    menu: boolean
  }
  componentsOrder: string[]
  homeMenuEnabled: boolean
  logoAnimation: string
  secondLineText: string
  secondLineAnimation: string
  lkEnabled: boolean
}

interface SiteHeaderProps {
  pageTitle?: string;
  onOpenCallModal?: (reason: string) => void;
  isHomePage?: boolean;
}

export default function SiteHeader({ 
  pageTitle = 'Центр Функционального Развития "Шифу Панда"',
  onOpenCallModal,
  isHomePage = false
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [trainersOpen, setTrainersOpen] = useState(false);
  const [programsForMenu, setProgramsForMenu] = useState<MenuItem[]>([]);
  const [trainersForMenu, setTrainersForMenu] = useState<MenuItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [customPages, setCustomPages] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerSettings, setHeaderSettings] = useState<HeaderSettings | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const homeMenuRef = useRef<HTMLDivElement>(null);

  // Загрузка меню из БД и страниц
  useEffect(() => {
    Promise.all([
      fetch('/api/db').then(res => res.json()),
      fetch('/api/pages').then(res => res.json()).catch(() => [])
    ])
      .then(([data, pages]) => {
        setProgramsForMenu(
          Array.isArray(data.programs) 
            ? data.programs.map((p: any) => ({ id: p.id, name: p.name, href: `/programs/${p.id}` }))
            : []
        );
        setTrainersForMenu(
          Array.isArray(data.trainers) 
            ? data.trainers.map((t: any) => ({ id: t.id, name: t.name, href: `/trainers/${t.id}` }))
            : []
        );
        // Загружаем секции для меню разделов
        if (data.sections && Array.isArray(data.sections)) {
          setSections(data.sections.map((s: any) => ({ id: s.id, title: s.title })));
        }
        // Загружаем настройки хедера
        if (data.headerSettings) {
          setHeaderSettings(data.headerSettings);
        }
        // Загружаем включенные страницы для меню
        if (Array.isArray(pages)) {
          setCustomPages(pages.map((p: any) => ({ 
            id: p.id, 
            name: p.title, 
            href: p.slug 
          })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Установка title
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const suffix = headerSettings?.titleSuffix || ' | Шифу Панда';
      document.title = pageTitle + suffix;
    }
  }, [pageTitle, headerSettings]);

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDesktopMenuOpen(false);
        setProgramsOpen(false);
        setTrainersOpen(false);
      }
      if (homeMenuRef.current && !homeMenuRef.current.contains(e.target as Node)) {
        setHomeMenuOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node) && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Обработчик звонка
  const handleCallClick = () => {
    const reason = `Заказ обратной со страницы "${pageTitle}"`;
    if (onOpenCallModal) {
      onOpenCallModal(reason);
    }
  };

  // Обработчик логотипа на главной - показывает меню разделов
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isHomePage) {
      setHomeMenuOpen(!homeMenuOpen);
    } else {
      window.location.href = '/';
    }
  };

  // Функция скролла к разделу
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Если элемент не найден (возможно, мы не на главной), переходим на главную с параметром
      window.location.href = `/?scrollTo=${sectionId}`;
    }
    setHomeMenuOpen(false);
    setDesktopMenuOpen(false);
  };

  // Базовые пункты меню
  const baseMenuItems = [
    { name: 'Расписание', href: '/schedule' },
    { name: 'Программы', href: '/programs' },
    { name: 'Тренеры', href: '/trainers' },
    { name: 'Контакты', href: '/contacts' },
    { name: 'Личный кабинет', href: '/lk' },
  ];

  return (
    <header className={styles.header}>
      {/* Верхняя строка: логотип | кнопка звонка | заголовок | меню */}
      <div className={styles.topRow}>
        {/* 1. ЛОГОТИП */}
        <div className={styles.logoSection} ref={homeMenuRef}>
          <Link 
            href="/" 
            className={styles.logoLink}
            onClick={handleLogoClick}
          >
            <Image 
              src='/logo.png'
              alt="Логотип" 
              className={`${styles.logo} ${headerSettings?.logoAnimation && headerSettings.logoAnimation !== 'none' ? styles[headerSettings.logoAnimation] : ''}`}
              width={48}
              height={48}
              priority
            />
          </Link>
          
          {/* Меню разделов главной страницы (только на главной) */}
          {isHomePage && homeMenuOpen && sections.length > 0 && (
            <div className={styles.homeMenu}>
              {sections.map((section) => (
                <button 
                  key={section.id}
                  className={styles.homeMenuItem}
                  onClick={() => scrollToSection(section.id)}
                >
                  {section.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. КНОПКА ЗВОНКА (квадратная с иконкой) и ЛК */}
        <div className={styles.rightButtons}>
          <button 
            className={styles.callButton}
            onClick={handleCallClick}
            title="Заказать звонок"
          >
            <Phone size={20} />
          </button>

          {(headerSettings?.lkEnabled ?? true) && (
            <Link 
              href="/lk" 
              className={styles.lkButton}
              title="Личный кабинет"
            >
              <User size={18} />
              <span className={styles.lkButtonText}>Личный кабинет</span>
            </Link>
          )}
        </div>

        {/* 3. ЗАГОЛОВОК СТРАНИЦЫ */}
        <div className={styles.titleSection}>
          <h1 className={`${styles.pageTitle} ${headerSettings?.logoAnimation && headerSettings.logoAnimation !== 'none' ? styles[headerSettings.logoAnimation] : ''}`}>
            {pageTitle}
          </h1>
          
        </div>

        {/* 4. КНОПКА МЕНЮ (десктоп) */}
        <div className={styles.menuSection} ref={menuRef}>
          <button 
            className={`${styles.menuToggle} ${desktopMenuOpen ? styles.menuOpen : ''}`}
            onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
          >
            <Menu size={22} />
            <span>Меню</span>
            <ChevronDown size={16} className={styles.chevron} />
          </button>

          {/* Выпадающее меню (десктоп) */}
          <div className={`${styles.dropdownMenu} ${desktopMenuOpen ? styles.dropdownOpen : ''}`}>
            {/* Главная с подменю разделов (только не на главной) */}
            {!isHomePage && (
              <div className={styles.menuItemWithSubmenu}>
                <Link href="/" className={styles.menuItem}>
                  🏠 Главная
                </Link>
                {sections.length > 0 && (
                  <div className={styles.submenu}>
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        className={styles.submenuItem}
                        onClick={() => scrollToSection(section.id)}
                      >
                        → {section.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Базовые пункты */}
            {baseMenuItems.map((item) => (
              <Link 
                key={item.name} 
                href={item.href} 
                className={styles.menuItem}
                onClick={() => setDesktopMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}

            {/* Новости */}
            <Link 
              href="/news" 
              className={styles.menuItem}
              onClick={() => setDesktopMenuOpen(false)}
            >
              📰 Новости
            </Link>

            {/* Медиагалерея */}
            <Link 
              href="/gallery" 
              className={styles.menuItem}
              onClick={() => setDesktopMenuOpen(false)}
            >
              🖼️ Галерея
            </Link>

            {/* Страницы пользователей */}
            {customPages.map((page) => (
              <Link 
                key={page.id} 
                href={page.href || '#'} 
                className={styles.menuItem}
                onClick={() => setDesktopMenuOpen(false)}
              >
                📄 {page.name}
              </Link>
            ))}

            {/* Программы (сворачиваемое подменю) */}
            {programsForMenu.length > 0 && (
              <div className={styles.menuItemWithSubmenu}>
                <button 
                  className={styles.menuItemButton}
                  onClick={() => setProgramsOpen(!programsOpen)}
                >
                  ▶ Программы
                  <ChevronDown 
                    size={14} 
                    className={`${styles.submenuChevron} ${programsOpen ? styles.submenuChevronOpen : ''}`}
                  />
                </button>
                {programsOpen && (
                  <div className={styles.submenu}>
                    {programsForMenu.map((program) => (
                      <Link 
                        key={program.id} 
                        href={program.href || '#'} 
                        className={styles.submenuItem}
                        onClick={() => {
                          setDesktopMenuOpen(false);
                          setProgramsOpen(false);
                        }}
                      >
                        • {program.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Тренеры (сворачиваемое подменю) */}
            {trainersForMenu.length > 0 && (
              <div className={styles.menuItemWithSubmenu}>
                <button 
                  className={styles.menuItemButton}
                  onClick={() => setTrainersOpen(!trainersOpen)}
                >
                  ★ Тренеры
                  <ChevronDown 
                    size={14} 
                    className={`${styles.submenuChevron} ${trainersOpen ? styles.submenuChevronOpen : ''}`}
                  />
                </button>
                {trainersOpen && (
                  <div className={styles.submenu}>
                    {trainersForMenu.map((trainer) => (
                      <Link 
                        key={trainer.id} 
                        href={trainer.href || '#'} 
                        className={styles.submenuItem}
                        onClick={() => {
                          setDesktopMenuOpen(false);
                          setTrainersOpen(false);
                        }}
                      >
                        • {trainer.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* МОБИЛЬНАЯ КНОПКА МЕНЮ */}
        <button 
          className={styles.mobileToggle}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>
      
      {/* Вторая строка заголовка (внутри header) */}
      {headerSettings?.secondLineText && (
        <div className={`${styles.secondLine} ${headerSettings?.secondLineAnimation && headerSettings.secondLineAnimation !== 'none' ? styles[headerSettings.secondLineAnimation] : ''}`}>
          {headerSettings.secondLineText}
        </div>
      )}
      
      {/* МОБИЛЬНОЕ МЕНЮ */}
      <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileOpen : ''}`} ref={mobileRef}>
        <div className={styles.mobileMenuContent}>
          {/* Главная (если не на главной) */}
          {!isHomePage && (
            <Link href="/" className={styles.mobileMenuItem} onClick={() => setMobileMenuOpen(false)}>
              🏠 Главная
            </Link>
          )}

          {baseMenuItems.map((item) => (
            <Link 
              key={item.name} 
              href={item.href} 
              className={styles.mobileMenuItem}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}

          {/* Новости */}
          <Link 
            href="/news" 
            className={styles.mobileMenuItem}
            onClick={() => setMobileMenuOpen(false)}
          >
            📰 Новости
          </Link>

          {/* Медиагалерея */}
          <Link 
            href="/gallery" 
            className={styles.mobileMenuItem}
            onClick={() => setMobileMenuOpen(false)}
          >
            🖼️ Галерея
          </Link>

          {/* Страницы пользователей */}
          {customPages.map((page) => (
            <Link 
              key={page.id} 
              href={page.href || '#'} 
              className={styles.mobileMenuItem}
              onClick={() => setMobileMenuOpen(false)}
            >
              📄 {page.name}
            </Link>
          ))}

          {/* Программы - сворачиваемое подменю в мобильной версии */}
          {programsForMenu.length > 0 && (
            <div className={styles.mobileAccordion}>
              <button 
                className={styles.mobileAccordionButton}
                onClick={() => setProgramsOpen(!programsOpen)}
              >
                <span>Программы</span>
                <ChevronDown size={18} className={`${styles.mobileChevron} ${programsOpen ? styles.mobileChevronOpen : ''}`} />
              </button>
              {programsOpen && (
                <div className={styles.mobileAccordionContent}>
                  {programsForMenu.map((program) => (
                    <Link 
                      key={program.id} 
                      href={program.href || '#'} 
                      className={styles.mobileMenuItem}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      ▶ {program.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Тренеры - сворачиваемое подменю в мобильной версии */}
          {trainersForMenu.length > 0 && (
            <div className={styles.mobileAccordion}>
              <button 
                className={styles.mobileAccordionButton}
                onClick={() => setTrainersOpen(!trainersOpen)}
              >
                <span>Тренеры</span>
                <ChevronDown size={18} className={`${styles.mobileChevron} ${trainersOpen ? styles.mobileChevronOpen : ''}`} />
              </button>
              {trainersOpen && (
                <div className={styles.mobileAccordionContent}>
                  {trainersForMenu.map((trainer) => (
                    <Link 
                      key={trainer.id} 
                      href={trainer.href || '#'} 
                      className={styles.mobileMenuItem}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      ★ {trainer.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <button 
            className={styles.mobileCallButton}
            onClick={() => {
              handleCallClick();
              setMobileMenuOpen(false);
            }}
          >
            <Phone size={20} />
            Заказать звонок
          </button>

          {headerSettings?.lkEnabled !== false && (
            <Link 
              href="/lk" 
              className={styles.mobileLkButton}
              onClick={() => setMobileMenuOpen(false)}
            >
              <User size={20} />
              <span className={styles.mobileLkButtonText}>ЛК</span>
            </Link>
          )}
        </div>
      </div>

      {/* Оверлей мобильного меню */}
      {mobileMenuOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileMenuOpen(false)} />
      )}
    </header>
  );
}
