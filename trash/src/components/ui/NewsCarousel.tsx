'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface Props {
  news: any[];
}

export default function NewsCarousel({ news }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === news.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? news.length - 1 : prev - 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (news.length === 0) {
    return (
      <section id="news" className="py-24 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-gray-800 mb-8">Новости</h2>
          <p className="text-xl text-gray-600">Новости скоро появятся</p>
        </div>
      </section>
    );
  }

  return (
    <section id="news" className="py-24 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="max-w-[95vw] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="section-title">Новости центра</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Последние события и объявления из жизни Шифу Панда
          </p>
        </div>

        <div className="relative">
          {/* Карусель */}
          <div className="overflow-hidden rounded-3xl shadow-2xl">
            <div 
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {news.map((item) => (
                <div key={item.id} className="min-w-full p-4 md:p-8">
                  <div className="bg-white rounded-3xl shadow-2xl h-[500px] flex flex-col overflow-hidden hover:shadow-3xl transition-all duration-300 hover:-translate-y-2">
                    {/* Изображение */}
                    <div className="h-2/3 relative overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.text}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.src = '/images/news-placeholder.jpg';
                        }}
                      />
                      <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg flex items-center space-x-2">
                        <Calendar size={16} className="text-gray-600" />
                        <span className="text-sm font-semibold text-gray-800">
                          {new Date(item.date).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Текст */}
                    <div className="p-8 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-4 leading-tight line-clamp-3">
                          {item.text}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Подробнее →</span>
                        <div className="flex space-x-2">
                          <button className="w-10 h-10 bg-panda-500 hover:bg-panda-600 rounded-xl flex items-center justify-center text-black transition-all hover:scale-110">
                            📱
                          </button>
                          <button className="w-10 h-10 bg-gray-800 hover:bg-gray-900 rounded-xl flex items-center justify-center text-white transition-all hover:scale-110">
                            💬
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Навигация */}
          <button
            onClick={prevSlide}
            className="absolute -left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-2xl p-3 rounded-2xl backdrop-blur-sm group transition-all hover:scale-110"
          >
            <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute -right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-2xl p-3 rounded-2xl backdrop-blur-sm group transition-all hover:scale-110"
          >
            <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Индикаторы */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-3 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-xl">
            {news.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-panda-500 scale-125 shadow-lg'
                    : 'bg-gray-300 hover:bg-gray-400 hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
