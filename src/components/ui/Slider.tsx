'use client';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { Slider, Trainer, type Slider as SliderType } from '@/lib/db';

interface Props {
  slides: Slider[];
}

export default function SliderComponent({ slides }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying || slides.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [slides.length, isAutoPlaying]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    setIsAutoPlaying(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    setIsAutoPlaying(false);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

  if (slides.length === 0) {
    return (
      <section id="slider" className="h-screen bg-gradient-to-br from-panda-50 to-yellow-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-800 mb-4">Шифу Панда</h2>
          <p className="text-xl text-gray-600">Центр физической разминки</p>
        </div>
      </section>
    );
  }

  return (
    <section id="slider" className="relative h-screen overflow-hidden">
      {/* Слайды */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 w-full h-full transition-transform duration-1000 ease-in-out ${
            index === currentIndex
              ? 'translate-x-0 scale-100 opacity-100'
              : index === (currentIndex + 1) % slides.length || index === (currentIndex - 1 + slides.length) % slides.length
              ? 'translate-x-full scale-95 opacity-50'
              : 'translate-x-full scale-90 opacity-0'
          }`}
        >
          <div className="relative w-full h-full">
            <img
              src={slide.image}
              alt={slide.description}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/images/slider/placeholder.jpg';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 drop-shadow-2xl leading-tight">
                Шифу Панда
              </h1>
              <p className="text-xl md:text-2xl lg:text-3xl max-w-4xl mx-auto drop-shadow-xl mb-8">
                {slide.description}
              </p>           
            </div>
          </div>
        </div>
      ))}

      {/* Стрелки навигации */}
      <button
        onClick={goToPrevious}
        className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm p-4 rounded-2xl text-white shadow-2xl hover:shadow-3xl transition-all duration-300 group"
      >
        <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm p-4 rounded-2xl text-white shadow-2xl hover:shadow-3xl transition-all duration-300 group"
      >
        <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Индикаторы */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex space-x-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-4 h-4 rounded-full transition-all duration-300 group ${
              index === currentIndex
                ? 'bg-white scale-125 shadow-lg'
                : 'bg-white/50 hover:bg-white hover:scale-110'
            }`}
          >
            <Circle size={8} className="invisible group-hover:visible" />
          </button>
        ))}
      </div>

      {/* Автовоспроизведение */}
      <div className="absolute top-6 right-6 flex items-center space-x-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg">
        <div className={`w-3 h-3 rounded-full ${isAutoPlaying ? 'bg-green-500' : 'bg-gray-400'}`} />
        <span className="text-sm font-medium text-gray-800">
          {isAutoPlaying ? 'Автовоспроизведение' : 'Пауза'}
        </span>
      </div>
    </section>
  );
}
