'use client';
import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';
import styles from './HomeSchedule.module.css';

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

interface HomeScheduleProps {
  openImageModal: (url: string, alt: string) => void;
  programs?: Program[];
  scheduleImages?: ScheduleImage[];
}

export default function HomeSchedule({ 
  openImageModal, 
  programs = [],
  scheduleImages = []
}: HomeScheduleProps) {
  const [viewMode, setViewMode] = useState<'static' | 'interactive'>('static');
  
  // Используем изображения из БД или дефолтные
  // Фильтруем только те, где есть реальный image путь
  const fixedSchedule = scheduleImages
    .filter(img => img.image)
    .map((img, idx) => ({ id: idx + 1, image: img.image }));
  
  // Если нет изображений из БД, используем дефолтные
  const displaySchedule = fixedSchedule.length > 0 ? fixedSchedule : [
    { id: 1, image: '/расписание1.jpg' },
    { id: 2, image: '/расписание2.jpg' }
  ];

  const handleToggleView = (mode: 'static' | 'interactive') => {
    setViewMode(mode);
  };

  // Получить все тренировки из программ
  const getAllWorkouts = () => {
    const allWorkouts: { day: string; time: string; params: string[]; programName: string }[] = [];
    programs.forEach((program: Program) => {
      if (program.workouts && Array.isArray(program.workouts)) {
        program.workouts.forEach((w: Workout) => {
          allWorkouts.push({ 
            day: w.day, 
            time: w.time, 
            params: w.params || [],
            programName: program.name
          });
        });
      }
    });
    return allWorkouts;
  };

  const workouts = getAllWorkouts();

  // Группировка тренировок по дням
  const getWorkoutsByDay = (day: string) => {
    return workouts.filter(w => w.day.toLowerCase() === day.toLowerCase());
  };

  return (
    <section id="schedule" className={styles.schedule}>
      <div className="max-w-[95vw] mx-auto px-4">
        {/* Заголовок по центру */}
        <div className="text-center mb-8">
          <h2 className="text-section-title md:text-section-title font-black text-center bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent drop-shadow-2xl">
            Расписание занятий
          </h2>
        </div>
        
        {/* Кнопки с краю */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/schedule" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
            >
              Открыть ↗
            </Link>
          </div>
          
          {/* Переключатель режимов - с краю */}
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button
              onClick={() => handleToggleView('static')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                viewMode === 'static' 
                  ? 'bg-blue-500 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📷 Картинка
            </button>
            <button
              onClick={() => handleToggleView('interactive')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                viewMode === 'interactive' 
                  ? 'bg-blue-500 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Таблица
            </button>
          </div>
        </div>
        
        {/* СТАТИЧНЫЙ РЕЖИМ (по умолчанию) */}
        {viewMode === 'static' && (
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            {displaySchedule.map(item => item.image && (
              <div 
                key={item.id}
                className="w-full md:w-96 group cursor-pointer hover:scale-105 transition-all duration-300"
                onClick={() => item.image && openImageModal(item.image, `Расписание ${item.id}`)}
              >
                <Image
                  src={item.image}
                  alt={`Расписание ${item.id}`}
                  width={384}
                  height={500}
                  className="w-full h-auto max-h-[500px] object-contain rounded-br-[1%] shadow-2xl group-hover:shadow-3xl transition-all duration-500 hover:-translate-y-2"
                  priority={true}
                  unoptimized
                />
              </div>
            ))}
          </div>
        )}

        {/* ИНТЕРАКТИВНЫЙ РЕЖИМ */}
        {viewMode === 'interactive' && (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {workouts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map(day => {
                  const dayWorkouts = getWorkoutsByDay(day);
                  return (
                    <div 
                      key={day} 
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 min-h-[120px]"
                    >
                      <h3 className="font-black text-lg text-blue-600 mb-3 border-b-2 border-blue-200 pb-2">
                        {day}
                      </h3>
                      {dayWorkouts.length > 0 ? (
                        <div className="space-y-2">
                          {dayWorkouts.map((workout, idx) => (
                            <div 
                              key={idx}
                              className="bg-white rounded-lg p-2 shadow-sm border border-blue-100"
                            >
                              <div className="font-bold text-gray-800">
                                🕐 {workout.time}
                              </div>
                              {workout.programName && (
                                <div className="text-sm text-orange-600 font-medium">
                                  {workout.programName}
                                </div>
                              )}
                              {workout.params && workout.params.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {workout.params.map((param, pIdx) => (
                                    <span 
                                      key={pIdx}
                                      className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
                                    >
                                      {param}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-sm italic">
                          Выходной
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="text-button font-bold text-gray-600 mb-2">Расписание не заполнено</h3>
                <p className="text-gray-500">
                  Добавьте расписание в админ-панели или переключитесь на режим "Картинка"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
