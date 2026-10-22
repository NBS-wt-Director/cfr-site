'use client';
import { useState } from 'react';
import styles from './HomeNews.module.css';

interface NewsItem {
  id: number;
  image: string;
  title: string;
  text: string;
}

interface HomeNewsProps {
  news: NewsItem[];
  openImageModal: (url: string, alt: string) => void;
}

export default function HomeNews({
  news = [],
  openImageModal
}: HomeNewsProps) {
  const safeNews: NewsItem[] = Array.isArray(news) ? news : [];

  return (
    <section id="news" className={styles.news}>
      <div className="max-w-[95vw] mx-auto px-4">
        <h2 className="text-section-title md:text-section-title font-black text-center mb-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-2xl">
          Наши события. 
        </h2>
        
        {safeNews.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {safeNews.map((item: NewsItem) => {
              return (
                <div key={item.id} className="group cursor-pointer hover:scale-[1.02] transition-transform duration-300 flex flex-col h-full">
                  {item.image && (
                    <div 
                      className="relative h-48 sm:h-56 bg-gray-100 rounded-t-xl overflow-hidden shadow-2xl group-hover:shadow-3xl transition-all duration-500 flex-shrink-0"
                      onClick={() => openImageModal(item.image, item.title)}
                    >
                      <img
                        src={item.image}
                        alt={item.title || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className={`mt-6 p-6 bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 ${item.image ? 'rounded-tl-xl rounded-tr-xl' : ''}`}>
                    <h3 className="text-button font-bold text-gray-900 mb-4 line-clamp-2 leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 mb-6 leading-relaxed text-lg whitespace-pre-wrap">
                      {item.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-xl text-gray-500">Новостей пока нет</p>
          </div>
        )}
      </div>
    </section>
  );
}
