'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './HomeTrainers.module.css';

interface Trainer {
  id: number;
  image: string;
  name: string;
  specialty: string;
  photoAlbum?: { image: string; caption?: string }[];
}

interface HomeTrainersProps {
  trainers: Trainer[];
  openCallModal: (reason: string) => void;
  openImageModal: (url: string, alt: string) => void;
}

export default function HomeTrainers({ 
  trainers = [], 
  openCallModal, 
  openImageModal 
}: HomeTrainersProps) {
  const safeTrainers: Trainer[] = Array.isArray(trainers) ? trainers : [];

  // Фиксированная сетка 3 колонки (выбор колонок отключен)
  const gridClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <section id="trainers" className={styles.trainers}>
      <div className="max-w-[95vw] mx-auto px-4">
        <h2 className="text-section-title md:text-section-title font-black text-center mb-20 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-2xl">
          Наши тренеры
        </h2>
        
        {safeTrainers.length > 0 ? (
          <>
            {/* Выбор колонок отключен */}
            
            <div className={`grid ${gridClass} gap-6 mb-12`}>
              {safeTrainers.map((trainer) => {
                return (
                <div key={trainer.id} className="text-center group">
                  <div className="relative bg-white shadow-lg overflow-hidden border-2 border-yellow-500 transition-all hover:shadow-xl">
                    {/* Десктоп: клик по картинке = переход на страницу тренера */}
                    <div 
                      className="w-full h-64 mx-auto bg-gray-100 overflow-hidden cursor-pointer relative hidden md:block"
                      onClick={() => {
                        window.location.href = `/trainers/${trainer.id}`;
                      }}
                    >
                      <Image 
                        src={trainer.image} 
                        alt={trainer.name} 
                        width={320} 
                        height={400} 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {/* Мобильная картинка - только для просмотра */}
                    <div 
                      className="w-full h-64 mx-auto bg-gray-100 overflow-hidden cursor-pointer relative md:hidden"
                      onClick={() => openImageModal(trainer.image, trainer.name)}
                    >
                      <Image 
                        src={trainer.image} 
                        alt={trainer.name} 
                        width={320} 
                        height={400} 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-bold text-yellow-500 group-hover:text-yellow-600 transition-colors line-clamp-2">{trainer.name}</h3>
                      
                      {/* Десктоп: кнопки "записаться" и "подробнее" - подробнее под записаться */}
                      <div className="flex flex-col gap-2 justify-center hidden md:flex mt-3">
                        <button 
                          className="w-full px-4 py-3 bg-yellow-500 text-white font-bold border-2 border-yellow-500 hover:bg-white hover:text-yellow-500 transition-all duration-300 shadow-md hover:shadow-lg rounded-none !rounded-none"
                          style={{fontSize: '22px', borderRadius: '0px'}}
                          onClick={() => openCallModal(`Тренер ${trainer.name}`)}
                        >
                          Записаться
                        </button>
                        <a 
                          href={`/trainers/${trainer.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full px-4 py-3 bg-yellow-500 text-white font-bold border-2 border-yellow-500 hover:bg-white hover:text-yellow-500 transition-all duration-300 shadow-md hover:shadow-lg text-center rounded-none !rounded-none"
                          style={{fontSize: '22px', borderRadius: '0px'}}
                        >
                          Подробнее
                        </a>
                      </div>
                      
                      {/* Мобильная версия: обе кнопки, "подробнее" внизу */}
                      <div className="flex flex-col gap-2 justify-center md:hidden">
                        <button 
                          className="w-full px-4 py-3 bg-yellow-500 text-white font-bold border-2 border-yellow-500 hover:bg-white hover:text-yellow-500 transition-all duration-300 shadow-md hover:shadow-lg rounded-none !rounded-none"
                          style={{fontSize: '22px', borderRadius: '0px'}}
                          onClick={() => openCallModal(`Тренер ${trainer.name}`)}
                        >
                          Записаться
                        </button>
                        
                        <a 
                          href={`/trainers/${trainer.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full px-4 py-3 bg-yellow-500 text-white font-bold border-2 border-yellow-500 hover:bg-white hover:text-yellow-500 transition-all duration-300 shadow-md hover:shadow-lg text-center rounded-none !rounded-none"
                          style={{fontSize: '22px', borderRadius: '0px'}}
                        >
                          Подробнее
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500" style={{fontSize: '22px'}}>Тренеров скоро добавят</p>
          </div>
        )}

        {/* ✅ КНОПКА ВЕСЬ КОЛЛЕКТИВ */}
        <div className="text-center">
          <Link 
            href="/trainers"
            className="inline-flex px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold border-2 border-blue-600 hover:bg-white hover:text-blue-600 shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all duration-300"
            style={{fontSize: '22px'}}
          >
            Весь наш коллектив →
          </Link>
        </div>
      </div>
    </section>
  );
}
