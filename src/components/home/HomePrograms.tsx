'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './HomePrograms.module.css';

interface Program {
  id: number | string;
  image: string;
  name: string;
  description: string;
  photoAlbum?: { image: string; caption?: string }[];
}

interface HomeProgramsProps {
  programs?: Program[];
  openCallModal?: (reason: string) => void;
  openImageModal?: (url: string, alt: string) => void;
}

export default function HomePrograms({
  programs = [],
  openCallModal = () => {},
  openImageModal = () => {}
}: HomeProgramsProps) {
  const safePrograms: Program[] = Array.isArray(programs) 
    ? programs.filter((p): p is Program => {
        if (!p || typeof p !== 'object') return false
        return Boolean(p.id) && Boolean(p.name) && Boolean(p.image)
      })
    : [];

  // Фиксированная сетка 3 колонки
  const gridClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <section id="programs" className={styles.programs}>
      <div className="max-w-[95vw] mx-auto px-4 py-20">
<h2 className="font-black text-center mb-20 bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent drop-shadow-2xl" style={{fontSize: '24px'}}>
          Программы тренировок
        </h2>
        
        {safePrograms.length > 0 ? (
          <>
            {/* ✅ ПЛИТКИ С КНОПКАМИ */}
            <div className={`grid ${gridClass} gap-6 mb-16`}>
              {safePrograms.map((program) => {
                return (
                <div 
                  key={program.id} 
                  className="group cursor-pointer hover:translate-y-[-4px] transition-all duration-300 bg-white shadow-lg hover:shadow-xl overflow-hidden border-2 border-blue-600"
                >
                  {/* ✅ КАРТИНКА - клик = подробнее (на десктопе) */}
                  <div 
                    className="w-full h-48 bg-gray-100 overflow-hidden relative hidden md:block"
                    onClick={() => {
                      // На десктопе клик по картинке = переход на страницу программы
                      window.location.href = `/programs/${program.id}`;
                    }}
                  >
                    <img
                      src={program.image}
                      alt={program.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  {/* Мобильная картинка - только для просмотра */}
                  <div 
                    className="w-full h-48 bg-gray-100 overflow-hidden relative md:hidden"
                    onClick={() => openImageModal(program.image, program.name)}
                  >
                    <img
                      src={program.image}
                      alt={program.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  
                  {/* ✅ КОНТЕНТ */}
                  <div className="p-6 text-center">
                    <h3 
                      className="text-xl font-black text-blue-600 group-hover:text-blue-700 leading-tight cursor-pointer transition-colors line-clamp-2"
                      onClick={() => window.location.href = `/programs/${program.id}`}
                    >
                      {program.name}
                    </h3>
                    
                    {/* ✅ Десктоп: кнопки "записаться" и "подробнее" - подробнее под записаться */}
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
                    
                    {/* ✅ Мобильная версия: обе кнопки, "подробнее" внизу */}
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

            {/* ✅ КНОПКА "ВСЕ ПРОГРАММЫ" ПОД ПЛИТКАМИ */}
            <div className="text-center">
              <Link 
                href="/programs"
                className="inline-flex items-center gap-3 px-12 py-6 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 text-white font-black border-2 border-blue-600 hover:bg-white hover:text-blue-600 shadow-2xl hover:shadow-3xl hover:-translate-y-3 transition-all duration-500 text-xl backdrop-blur-xl hover:from-blue-700 hover:to-blue-800 group"
              >
                <span>🏋️‍♂️ Все программы</span>
                <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-24">
            <div className="inline-block p-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl shadow-2xl border border-blue-200 max-w-2xl mx-auto">
              <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-r from-blue-400 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl">
                <span className="text-4xl font-black text-white">💪</span>
              </div>
              <h3 className="text-4xl font-black text-gray-800 mb-6">Программы в разработке</h3>
              <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto mb-8">
                Мы готовим для вас самые эффективные и современные тренировочные программы. 
                Скоро здесь появится полный каталог!
              </p>
              <Link 
                href="/programs"
                className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black rounded-2xl shadow-2xl hover:shadow-3xl hover:-translate-y-2 transition-all duration-300 text-lg"
              >
                Посмотреть все программы →
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
