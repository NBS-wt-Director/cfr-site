'use client';
import { useEffect, useState } from 'react';
import { Loader2, Calendar, Clock, MapPin, Filter, Image as ImageIcon, Users, Tag } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import SectionSpacer from '@/components/ui/SectionSpacer';
import CallModal from '@/components/ui/CallModal';
import FullScreenImageModal from '@/components/ui/FullScreenImageModal';
import Link from 'next/link';
import Image from 'next/image';

interface Workout {
  id: number;
  day: string;
  time: string;
  programId: number | null;
  programName: string;
  params: string[];
  trainerId?: number;
  trainerName?: string;
  location?: string;
}

interface Program {
  id: number;
  name: string;
  image: string;
}

interface Trainer {
  id: number;
  name: string;
  image: string;
}

interface ScheduleImage {
  id: number;
  image?: string;
}

interface DbSettings {
  scheduleSettings?: {
    showListMode?: boolean;
  };
}

const DAYS_ORDER = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export default function SchedulePage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [scheduleImages, setScheduleImages] = useState<ScheduleImage[]>([]);
  const [dbSettings, setDbSettings] = useState<DbSettings>({});
  const [loading, setLoading] = useState(true);
  
  // Фильтры
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [selectedTrainer, setSelectedTrainer] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');
  const [modalImage, setModalImage] = useState({ open: false, url: '', alt: '' });

  const openCallModal = (reason: string = 'Общий запрос') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  const openImageModal = (url: string, alt: string) => {
    setModalImage({ open: true, url, alt });
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/workouts').then(r => r.json()),
      fetch('/api/programs').then(r => r.json()),
      fetch('/api/trainers').then(r => r.json()),
      fetch('/api/db').then(r => r.json())
    ]).then(([workoutsData, programsData, trainersData, dbData]) => {
      setWorkouts(workoutsData);
      setPrograms(programsData);
      setTrainers(trainersData);
      setScheduleImages(dbData.schedule || []);
      setDbSettings(dbData);
      setLoading(false);
    }).catch(err => {
      console.error('Ошибка загрузки:', err);
      setLoading(false);
    });
  }, []);

  // Фильтрация тренировок
  const filteredWorkouts = workouts.filter(w => {
    // По программе
    if (selectedProgram !== 'all' && String(w.programId) !== selectedProgram && w.programName !== selectedProgram) {
      return false;
    }
    // По тренеру
    if (selectedTrainer !== 'all' && String(w.trainerId) !== selectedTrainer && w.trainerName !== selectedTrainer) {
      return false;
    }
    // По длительности (часовые/полуторачасовые)
    if (durationFilter !== 'all') {
      const hasHour = w.params?.some(p => p.toLowerCase().includes('1 час') || p.toLowerCase().includes('60 мин'));
      const hasHourHalf = w.params?.some(p => p.toLowerCase().includes('1.5 час') || p.toLowerCase().includes('90 мин') || p.toLowerCase().includes('полутора'));
      
      if (durationFilter === 'hour' && !hasHour) return false;
      if (durationFilter === 'hourhalf' && !hasHourHalf) return false;
    }
    // По локации (онлайн/офлайн/параллельно)
    if (locationFilter !== 'all') {
      const paramsStr = w.params?.join(' ').toLowerCase() || '';
      const hasOnline = paramsStr.includes('онлайн') || paramsStr.includes('zoom') || paramsStr.includes('видео');
      const hasOffline = paramsStr.includes('офлайн') || paramsStr.includes('зал') || !hasOnline;
      const hasParallel = paramsStr.includes('параллельно') || paramsStr.includes('параллельн');
      
      if (locationFilter === 'online' && !hasOnline) return false;
      if (locationFilter === 'offline' && !hasOffline) return false;
      if (locationFilter === 'parallel' && !hasParallel) return false;
    }
    // По цене (нужно получить из программы)
    if (priceFilter !== 'all') {
      // Пока заглушка - нужно добавить цену в программу
    }
    
    return true;
  });

  // Группировка по дням недели
  const workoutsByDay = DAYS_ORDER.reduce((acc, day) => {
    const dayWorkouts = filteredWorkouts
      .filter(w => w.day === day)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (dayWorkouts.length > 0) {
      acc[day] = dayWorkouts;
    }
    return acc;
  }, {} as Record<string, Workout[]>);

  // Получить имя программы
  const getProgramName = (workout: Workout) => {
    if (workout.programName) return workout.programName;
    const program = programs.find(p => p.id === workout.programId);
    return program?.name || 'Общая тренировка';
  };

  // Получить изображение программы
  const getProgramImage = (workout: Workout): string | undefined => {
    const program = programs.find(p => p.id === workout.programId);
    return program?.image;
  };

  // Очистить все фильтры
  const clearFilters = () => {
    setSelectedProgram('all');
    setSelectedTrainer('all');
    setDurationFilter('all');
    setLocationFilter('all');
    setPriceFilter('all');
  };

  // Проверка, есть ли активные фильтры
  const hasActiveFilters = selectedProgram !== 'all' || selectedTrainer !== 'all' || 
    durationFilter !== 'all' || locationFilter !== 'all' || priceFilter !== 'all';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-500">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-8" />
          <p className="text-2xl font-bold">Загрузка расписания...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader 
        pageTitle="Расписание тренировок"
        onOpenCallModal={openCallModal}
      />
      
      <SectionSpacer height="lg" background="default" />

      <section className="max-w-[95vw] mx-auto px-4 pb-20">
        {/* Заголовок по центру */}
        <div className="text-center mb-10">
          <h1 className="text-page-title md:text-page-title font-black text-gray-900 mb-4">
            📅 Расписание тренировок
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Выберите удобное время и запишитесь на тренировку
          </p>
        </div>

        {/* Фильтры - только программа */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-orange-600" />
              <span className="font-bold text-gray-900">Фильтр</span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                Очистить ✕
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* По программе - единственный фильтр */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Tag className="w-4 h-4 inline mr-1" /> Программа
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                <option value="all">Все программы</option>
                {programs.map(program => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredWorkouts.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block p-12 bg-gray-100 rounded-2xl shadow-lg">
              <Calendar className="w-24 h-24 mx-auto mb-6 text-gray-400" />
              <h3 className="text-2xl font-bold text-gray-700 mb-4">Расписание пока пустое</h3>
              <p className="text-gray-500 mb-6">Нет тренировок по выбранным фильтрам</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Таблица по дням */
          <div className="grid gap-6">
            {Object.entries(workoutsByDay).map(([day, dayWorkouts]) => (
              <div key={day} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                  <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {day}
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {dayWorkouts.map((workout) => (
                    <div key={workout.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                      {/* Время */}
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Clock className="w-5 h-5 text-orange-600 flex-shrink-0" />
                        <span className="font-bold text-lg text-orange-700">{workout.time}</span>
                      </div>
                      
                      {/* Программа */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {getProgramImage(workout) && (
                            <div className="w-12 h-12 rounded-xl overflow-hidden relative flex-shrink-0">
                              <Image
                                src={getProgramImage(workout)}
                                alt={getProgramName(workout)}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div>
                            <Link 
                              href={workout.programId ? `/programs/${workout.programId}` : '#'}
                              className="font-bold text-lg text-gray-900 hover:text-orange-600 transition-colors"
                            >
                              {getProgramName(workout)}
                            </Link>
                            {workout.trainerName && (
                              <p className="text-sm text-gray-500">тренер: {workout.trainerName}</p>
                            )}
                            {workout.params && workout.params.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {workout.params.map((param, i) => (
                                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {param}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Кнопка записи */}
                      <button
                        onClick={() => openCallModal(`Записаться на ${getProgramName(workout)} в ${day} в ${workout.time}`)}
                        className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors whitespace-nowrap"
                      >
                        Записаться
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Кнопки внизу */}
        <div className="flex flex-wrap justify-center gap-4 mt-12">
          <Link 
            href="/programs"
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-lg"
          >
            🏋️ Все программы
          </Link>
          <Link 
            href="/trainers"
            className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-lg"
          >
            👨‍🏫 Тренеры
          </Link>
          <button 
            onClick={() => openCallModal('Консультация по расписанию')}
            className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-lg"
          >
            📞 Задать вопрос
          </button>
        </div>
      </section>

      <Footer />
      
      <CallModal 
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />

      <FullScreenImageModal 
        isOpen={modalImage.open}
        imageUrl={modalImage.url}
        alt={modalImage.alt}
        onClose={() => setModalImage({ open: false, url: '', alt: '' })}
      />
    </div>
  );
}
