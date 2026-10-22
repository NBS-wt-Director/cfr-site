'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ImageIcon } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import SectionSpacer from '@/components/ui/SectionSpacer';
import FullScreenImageModal from '@/components/ui/FullScreenImageModal';
import styles from './page.module.css';
import Image from 'next/image';
import CallModal from "@/components/ui/CallModal";
import StatsCollector from '@/components/ui/StatsCollector';


interface Program {
  id: string | number;
  name: string;
  image: string;
  description?: string;
  photoAlbum?: { image: string; caption?: string }[];
}

export default function ProgramsPage() {
  const [siteSettings, setSiteSettings] = useState({ clientNotification: '' });
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalImage, setModalImage] = useState({ open: false, url: '', alt: '' });
  const [callModalOpen, setCallModalOpen] = useState(false);  // ✅ CallModal состояние
  const [callReason, setCallReason] = useState('Общий запрос');

  // ✅ openCallModal ФУНКЦИЯ
  const openCallModal = (reason: string = 'Общий запрос') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  // ✅ ЗАГРУЗКА ДАННЫХ
  useEffect(() => {
    fetch('/api/db')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: any) => {
        const safePrograms: Program[] = Array.isArray(data.programs)
          ? data.programs.filter((p: any): p is Program => 
              p && p.id && p.name && p.image
            )
          : [];
        setPrograms(safePrograms);
         setSiteSettings(data.settings || {});
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ Ошибка:', err);
        setError('Ошибка загрузки');
        setLoading(false);
      });
  }, []);

  const openImageModal = (url: string, alt: string) => {
    setModalImage({ open: true, url, alt });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-8" />
          <p className="text-2xl font-bold">Загрузка...</p>
        </div>
      </div>
    );
  }

  const safePrograms = Array.isArray(programs) ? programs : [];

  // Фиксированная сетка 3 колонки
  const gridClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="min-h-screen bg-gray-50">
      <StatsCollector />
      <SiteHeader 
        pageTitle="Все программы тренировок"
        onOpenCallModal={openCallModal}
      />

      <SectionSpacer height="lg" background="default" />

      {/* ✅ ПЛИТКИ - как на главной */}
      <section className={styles.programsSection}>
        <div className="max-w-[95vw] mx-auto px-4">
          {error || safePrograms.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-block p-12 bg-gray-100 shadow-2xl">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">🏋️</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-700 mb-4">Программы скоро появятся</h3>
                <p className="text-xl text-gray-500 max-w-md mx-auto">Следите за обновлениями!</p>
              </div>
            </div>
          ) : (
            <>
              {/* Выбор колонок отключен */}
              
              <div className={`grid ${gridClass} gap-6 mb-16`}>
                {safePrograms.map((program) => {
                  return (
                  <div 
                    key={program.id} 
                    className="group cursor-pointer hover:translate-y-[-4px] transition-all duration-300 bg-white shadow-lg hover:shadow-xl overflow-hidden border-2 border-blue-600"
                  >
                    {/* ✅ Десктоп: картинка - клик = подробнее */}
                    <div 
                      className="w-full h-48 bg-gray-100 overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-500 hidden md:block"
                      onClick={() => {
                        window.location.href = `/programs/${program.id}`;
                      }}
                    >
                      <Image
                        src={program.image}
                        alt={program.name}
                        width={400}
                        height={320}
                        className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    {/* Мобильная картинка - клик = модалка */}
                    <div 
                      className="w-full h-48 bg-gray-100 overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-500 md:hidden"
                      onClick={() => openImageModal(program.image, program.name)}
                    >
                      <Image
                        src={program.image}
                        alt={program.name}
                        width={400}
                        height={320}
                        className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                      />
                    </div>

                    {/* ✅ КОНТЕНТ + КНОПКИ - как на главной */}
                    <div className="p-6 text-center">
                        <h3 
                        className="text-xl font-black text-blue-600 group-hover:text-blue-700 leading-tight cursor-pointer transition-colors line-clamp-2"
                        onClick={() => window.location.href = `/programs/${program.id}`}
                      >
                        {program.name}
                      </h3>
                      
                    {/* Десктоп: обе кнопки как на главной */}
                    <div className="flex flex-col gap-2 justify-center hidden md:flex mt-3">
                      <button 
                        className="w-full px-4 py-3 bg-blue-600 text-white font-bold border-2 border-blue-600 hover:bg-white hover:text-blue-600 transition-all duration-300 shadow-md hover:shadow-lg rounded-none !rounded-none"
                        style={{fontSize: '22px', borderRadius: '0px'}}
                        onClick={(e) => {
                          e.stopPropagation();
                          openCallModal(`Программа: ${program.name}`);
                        }}
                      >
                        Записаться
                      </button>
                      <a 
                        href={`/programs/${program.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full px-4 py-3 bg-blue-600 text-white font-bold border-2 border-blue-600 hover:bg-white hover:text-blue-600 transition-all duration-300 shadow-md hover:shadow-lg text-center rounded-none !rounded-none"
                        style={{fontSize: '22px', borderRadius: '0px'}}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Подробнее
                      </a>
                    </div>
                    
                    {/* Мобильная версия: обе кнопки */}
                    <div className="flex flex-col gap-2 justify-center md:hidden">
                      <button 
                        className="w-full px-4 py-3 bg-blue-600 text-white font-bold border-2 border-blue-600 hover:bg-white hover:text-blue-600 transition-all duration-300 shadow-md hover:shadow-lg rounded-none !rounded-none"
                        style={{fontSize: '22px', borderRadius: '0px'}}
                        onClick={(e) => {
                          e.stopPropagation();
                          openCallModal(`Программа: ${program.name}`);
                        }}
                      >
                        Записаться
                      </button>
                      
                      <a 
                        href={`/programs/${program.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold border-2 border-blue-600 hover:bg-white hover:text-blue-600 transition-all duration-300 shadow-md hover:shadow-lg text-center rounded-none !rounded-none"
                        style={{fontSize: '22px', borderRadius: '0px'}}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Подробнее
                      </a>
                    </div>
                    </div>
                  </div>
                )})}
              </div>

              {/* ✅ КНОПКА НА ГЛАВНУЮ */}
              <div className="text-center">
                <Link 
                  href="/"
                  className="inline-flex items-center gap-3 px-12 py-6 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 text-white font-black border-2 border-blue-600 hover:bg-white hover:text-blue-600 shadow-2xl hover:shadow-3xl hover:-translate-y-3 transition-all duration-500 text-xl backdrop-blur-xl hover:from-blue-700 hover:to-blue-800 group"
                >
                  <span>🏠 На главную</span>
                  <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

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
    </div>
  );
}
