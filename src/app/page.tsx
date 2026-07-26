'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import SectionSpacer from '@/components/ui/SectionSpacer';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import HomeSlider from '@/components/home/HomeSlider';
import HomeSchedule from '@/components/home/HomeScheduleNew';
import HomePrices from '@/components/home/HomePrices';
import HomePrograms from '@/components/home/HomePrograms';
import HomeTrainers from '@/components/home/HomeTrainers';
import HomeNews from '@/components/home/HomeNews';
import HomeContacts from '@/components/home/HomeContacts';
import GlobalPreloader from '@/components/ui/GlobalPreloader';
import FullScreenImageModal from '@/components/ui/FullScreenImageModal';
import CallModal from '@/components/ui/CallModal';
import StatsCollector from '@/components/ui/StatsCollector';

interface Workout {
  id?: number;
  day: string;
  time: string;
  params?: string[];
}

interface Program {
  id: number;
  name: string;
  image?: string;
  workouts?: Workout[];
}

interface ScheduleImage {
  id: number;
  image?: string;
}

interface PriceImage {
  id: number;
  image?: string;
}

interface Section {
  id: string;
  title: string;
  background: string;
}

type DbData = {
  logo?: string;
  sliders?: any[];
  schedule?: ScheduleImage[];
  programs?: Program[];
  trainers?: any[];
  news?: any[];
  contacts?: any;
  sections?: Section[];
  prices?: any[];
  sliderSettings?: any;
  globalDivider?: {
    enabled: boolean;
    height: string;
    background: string;
    textContent: string;
    fontSize: string;
  };
};

export default function HomePage() {
  const [displayData, setDisplayData] = useState<DbData>({});
  const [data, setData] = useState<DbData>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalImage, setModalImage] = useState({ open: false, url: '', alt: '' });
  
  // ✅ ФОРМА ЗВОНКА
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');

  const router = useRouter();

  useEffect(() => {
    fetch('/api/db')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setDisplayData(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const adminToken = localStorage.getItem('adminToken');
      setIsAdmin(!!adminToken);
    }
  }, []);

  // Обработка scrollTo параметра для навигации к разделам
  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const scrollTo = params.get('scrollTo');
      
      if (scrollTo) {
        // Убираем параметр из URL чтобы не скроллило при обновлении
        window.history.replaceState({}, '', '/');
        
        // Скроллим к разделу
        setTimeout(() => {
          const element = document.getElementById(scrollTo);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }
  }, [loading]);

  // ✅ ФУНКЦИИ ДЛЯ ВСЕХ КОМПОНЕНТОВ
  const openImageModal = (url: string, alt: string) => {
    setModalImage({ open: true, url, alt });
  };

  const openCallModal = (reason: string = 'Общий запрос') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  // ✅ Порядок секций из настроек (или默认值)
  const defaultSections: Section[] = [
    { id: "schedule", title: "Расписание занятий", background: "yellow-orange" },
    { id: "prices", title: "Наши цены", background: "green-blue" },
    { id: "programs", title: "Программы тренировок", background: "emerald-teal" },
    { id: "trainers", title: "Наши тренеры", background: "gray-white" },
    { id: "news", title: "Новости", background: "indigo-purple" }
  ];

  const sectionsOrder = data.sections || defaultSections;

  // ✅ Получаем настройки глобального разделителя из БД
  const globalDivider: any = data.globalDivider || {
    enabled: true,
    height: 'xxl',
    background: 'gradientBlue',
    textContent: '🏃 🏋️ 🧘 💪',
    fontSize: 'large'
  };

  // Функция получения настроек разделителя между секциями (использует globalDivider)
  const getDividerConfig = (sectionId: string, nextSectionId: string) => {
    if (!globalDivider.enabled) return null;
    return {
      height: globalDivider.height || 'xxl',
      background: globalDivider.background || 'gradientBlue',
      textContent: globalDivider.textContent || '',
      fontSize: globalDivider.fontSize || 'large'
    };
  };

  // ✅ Компоненты секций
  const renderSection = (sectionId: string, index: number) => {
    const showSpacer = index > 0;
    const nextSection = sectionsOrder[index + 1];
    const dividerConfig = nextSection ? getDividerConfig(sectionId, nextSection.id) : null;
    
    switch (sectionId) {
      case 'schedule':
        return (
          <>
            {showSpacer && dividerConfig && (
              <SectionSpacer 
                height={dividerConfig.height}
                background={dividerConfig.background}
                textContent={dividerConfig.textContent}
                fontSize={dividerConfig.fontSize}
              />
            )}
            <section id="schedule">
              <HomeSchedule openImageModal={openImageModal} programs={data.programs || []} scheduleImages={data.schedule || []} />
            </section>
          </>
        );
      case 'prices':
        return (
          <>
            {showSpacer && dividerConfig && (
              <SectionSpacer 
                height={dividerConfig.height}
                background={dividerConfig.background}
                textContent={dividerConfig.textContent}
                fontSize={dividerConfig.fontSize}
              />
            )}
            <section id="prices">
              <HomePrices openImageModal={openImageModal} prices={data.prices || []} />
            </section>
          </>
        );
      case 'programs':
        return (
          <>
            {showSpacer && dividerConfig && (
              <SectionSpacer 
                height={dividerConfig.height}
                background={dividerConfig.background}
                textContent={dividerConfig.textContent}
                fontSize={dividerConfig.fontSize}
              />
            )}
            <section id="programs">
              <HomePrograms 
                programs={(data?.programs || []) as any}
                openCallModal={openCallModal}
                openImageModal={openImageModal}
              />
            </section>
          </>
        );
      case 'trainers':
        return (
          <>
            {showSpacer && dividerConfig && (
              <SectionSpacer 
                height={dividerConfig.height}
                background={dividerConfig.background}
                textContent={dividerConfig.textContent}
                fontSize={dividerConfig.fontSize}
              />
            )}
            <section id="trainers">
              <HomeTrainers 
                trainers={data.trainers || []} 
                openCallModal={openCallModal}
                openImageModal={openImageModal}
              />
            </section>
          </>
        );
      case 'news':
        return (
          <>
            {showSpacer && dividerConfig && (
              <SectionSpacer 
                height={dividerConfig.height}
                background={dividerConfig.background}
                textContent={dividerConfig.textContent}
                fontSize={dividerConfig.fontSize}
              />
            )}
            <HomeNews 
              news={Array.isArray(data?.news) ? data.news : []}
              openImageModal={openImageModal}
            />
          </>
        );
      default:
        return null;
    }
  };

  if (loading) return <GlobalPreloader />;

  return (
    <>
      <StatsCollector />

      <SiteHeader 
        pageTitle="Центр Функционального Развития «Шифу Панда»"
        onOpenCallModal={openCallModal}
        isHomePage={true}
      />
      
      {/* ✅ Слайдер */}
      <HomeSlider 
        sliders={data.sliders || []} 
        settings={data.sliderSettings}
      />
      
      {/* ✅ Разделитель после слайдера (если есть секции и разделитель включен) */}
      {sectionsOrder.length > 0 && globalDivider.enabled && (
        <SectionSpacer 
          height={globalDivider.height}
          background={globalDivider.background}
          textContent={globalDivider.textContent}
          fontSize={globalDivider.fontSize}
        />
      )}
      
      {/* ✅ Рендерим секции в порядке из настроек */}
      {sectionsOrder.map((section, index) => (
        <div key={section.id}>
          {renderSection(section.id, index)}
        </div>
      ))}

      {/* ✅ Разделитель перед контактами - ОТКЛЮЧЕН */}
      {/* Контакты отключены по запросу */}
      {/* }globalDivider.enabled && (
        <SectionSpacer 
          height={globalDivider.height}
          background={globalDivider.background}
          textContent={globalDivider.textContent}
          fontSize={globalDivider.fontSize}
        />
      )}
      <section id="contacts"><HomeContacts contacts={data.contacts || {}} /></section> */}
      
      {/* ✅ Общий футер */}
      <Footer />
      
      {/* ✅ МОДАЛКИ */}
      <FullScreenImageModal 
        isOpen={modalImage.open}
        imageUrl={modalImage.url}
        alt={modalImage.alt}
        onClose={() => setModalImage({ open: false, url: '', alt: '' })}
      />
      
      <CallModal 
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />
    </>
  );
}
