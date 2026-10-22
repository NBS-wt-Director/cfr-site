'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import SectionSpacer from '@/components/ui/SectionSpacer';
import CallModal from '@/components/ui/CallModal';
import StatsCollector from '@/components/ui/StatsCollector';

interface GalleryItem {
  src: string;
  alt: string;
  sourcePage: string;
  sourceUrl: string;
}

export default function GalleryPage() {
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');

  const openCallModal = (reason: string = 'Общий запрос') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  useEffect(() => {
    // Загружаем данные о тренерах и программах
    Promise.all([
      fetch('/api/trainers'),
      fetch('/api/programs')
    ])
      .then(([trainersRes, programsRes]) => {
        return Promise.all([trainersRes.json(), programsRes.json()]);
      })
      .then(([trainers, programs]) => {
        const items: GalleryItem[] = [];
        
        // Добавляем фото тренеров
        if (Array.isArray(trainers)) {
          trainers.forEach((trainer: any) => {
            if (trainer.image) {
              items.push({
                src: trainer.image,
                alt: trainer.name,
                sourcePage: `Тренер ${trainer.name}`,
                sourceUrl: `/trainers/${trainer.id}`
              });
            }
            // Добавляем фото из альбома тренера
            if (trainer.photoAlbum && Array.isArray(trainer.photoAlbum)) {
              trainer.photoAlbum.forEach((photo: any) => {
                items.push({
                  src: photo.image,
                  alt: photo.caption || `Фото тренера ${trainer.name}`,
                  sourcePage: `Тренер ${trainer.name}`,
                  sourceUrl: `/trainers/${trainer.id}`
                });
              });
            }
          });
        }
        
        // Добавляем фото программ
        if (Array.isArray(programs)) {
          programs.forEach((program: any) => {
            if (program.image) {
              items.push({
                src: program.image,
                alt: program.name,
                sourcePage: `Программа "${program.name}"`,
                sourceUrl: `/programs/${program.id}`
              });
            }
            // Добавляем фото из альбома программы
            if (program.photoAlbum && Array.isArray(program.photoAlbum)) {
              program.photoAlbum.forEach((photo: any) => {
                items.push({
                  src: photo.image,
                  alt: photo.caption || `Фото программы ${program.name}`,
                  sourcePage: `Программа "${program.name}"`,
                  sourceUrl: `/programs/${program.id}`
                });
              });
            }
          });
        }
        
        setGalleryItems(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % galleryItems.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + galleryItems.length) % galleryItems.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-600">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-8" />
          <p className="text-2xl font-bold">Загрузка галереи...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StatsCollector />
      <SiteHeader 
        pageTitle="Медиагалерея"
        onOpenCallModal={openCallModal}
      />

      <SectionSpacer height="lg" background="default" />

      <section className="max-w-[95vw] mx-auto px-4 py-12">
        <h1 className="text-page-title md:text-page-title font-black text-center mb-16 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Медиагалерея
        </h1>

        {galleryItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block p-12 bg-white rounded-3xl shadow-xl">
              <div className="text-6xl mb-6">🖼️</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Галерея пуста</h2>
              <p className="text-gray-600 text-lg">Добавьте фото в программы и тренеры</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Слайдер */}
            <div className="relative h-[70vh] min-h-[500px] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl">
              {galleryItems.map((item, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    index === currentSlide ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className="object-contain"
                    priority={index === currentSlide}
                  />
                </div>
              ))}
              
              {/* Кнопка назад */}
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300"
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Кнопка вперёд */}
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300"
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              {/* Счётчик */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full text-white text-sm">
                {currentSlide + 1} / {galleryItems.length}
              </div>
            </div>
            
            {/* Подпись с ссылкой */}
            {galleryItems[currentSlide] && (
              <div className="mt-6 text-center">
                <Link
                  href={galleryItems[currentSlide].sourceUrl}
                  target="_blank"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all duration-300"
                >
                  <span>🔗</span>
                  <span>{galleryItems[currentSlide].sourcePage}</span>
                </Link>
              </div>
            )}
            
            {/* Миниатюры */}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {galleryItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                    index === currentSlide ? 'border-blue-600 ring-2 ring-blue-600/50' : 'border-gray-300 opacity-60 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={item.src}
                    alt={item.alt}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка на главную */}
        <div className="text-center mt-12">
          <Link 
            href="/"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-lg"
          >
            ← На главную
          </Link>
        </div>
      </section>

      <Footer />

      <CallModal 
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />
    </div>
  );
}
