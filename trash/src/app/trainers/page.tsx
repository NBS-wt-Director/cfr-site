'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users, UserCog } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import CallModal from '@/components/ui/CallModal';
import StatsCollector from '@/components/ui/StatsCollector';
import Image from 'next/image';

interface Trainer {
  id: string;
  name: string;
  image: string;
  experience?: string;
  specialization?: string;
  photoAlbum?: { image: string; caption?: string }[];
}

interface Staff {
  id: string;
  name: string;
  image: string;
  role?: string;
}

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [siteSettings, setSiteSettings] = useState({ clientNotification: '' });
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');

  const openCallModal = (reason: string) => {
    setCallReason(reason);
    setCallModalOpen(true);
  };
  // Загрузка данных тренеров и сотрудников
  useEffect(() => {
    Promise.all([
      fetch('/api/trainers'),
      fetch('/api/employees')
    ])
      .then(([trainersRes, staffRes]) => {
        if (!trainersRes.ok) throw new Error('Ошибка загрузки тренеров');
        if (!staffRes.ok) throw new Error('Ошибка загрузки сотрудников');
        return Promise.all([trainersRes.json(), staffRes.json()]);
      })
      .then(([trainersData, staffData]) => {
        console.log('✅ Тренеры:', trainersData);
        console.log('✅ Сотрудники:', staffData);
        setTrainers(trainersData);
        setStaff(staffData);
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ Ошибка загрузки:', err);
        setError('Ошибка загрузки данных');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-8" />
          <p className="text-2xl">Загрузка команды...</p>
        </div>
      </div>
    );
  }

  // Фиксированная сетка 3 колонки (выбор колонок отключен)
  const gridClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="min-h-screen bg-gray-50">
      <StatsCollector />
      <SiteHeader 
        pageTitle="Наша команда"
        onOpenCallModal={openCallModal}
      />
      
      {/* Команда тренеров */}
      <section className="py-24 bg-white">
        <div className="max-w-[95vw] mx-auto px-4">
          <div className="text-center mb-20">
            <h3 className="text-4xl md:text-5xl font-black text-gray-400 mb-6">
                Наши тренеры
              </h3>
          </div>

          {trainers.length === 0 ? (
            <div className="text-center py-32">
              <Users className="w-32 h-32 text-gray-300 mx-auto mb-8" />
              <h3 className="text-4xl md:text-5xl font-black text-gray-400 mb-6">
                Данные не заполнены
              </h3>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                Тренера скоро появятся в админке!
              </p>
            </div>
          ) : (
            <>
              {/* Выбор колонок отключен */}
              
              <div className={`grid ${gridClass} gap-6`}>
                {trainers.map((trainer) => {
                  return (
                <div
                  key={trainer.id}
                  className="group relative bg-white p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-yellow-500 overflow-hidden flex flex-col"
                >
                  {/* Десктоп: клик по картинке = переход на страницу */}
                  <div 
                    className="relative flex-shrink-0 mb-4 h-64 overflow-hidden mx-auto w-full bg-gray-100 hidden md:block cursor-pointer"
                    onClick={() => {
                      window.location.href = `/trainers/${trainer.id}`;
                    }}
                  >
                    <Image 
                      src={trainer.image} 
                      alt={trainer.name}
                      fill
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  {/* Мобильная картинка - только просмотр */}
                  <div 
                    className="relative flex-shrink-0 mb-4 h-64 overflow-hidden mx-auto w-full bg-gray-100 md:hidden cursor-pointer"
                  >
                    <Image 
                      src={trainer.image} 
                      alt={trainer.name}
                      fill
                      className="w-full h-full object-contain"
                    />
                  </div>
                  
                  {/* Имя - как на главной */}
                  <div className="flex-1 flex flex-col justify-end">
                    <h3 className="text-xl font-black text-yellow-500 group-hover:text-yellow-600 transition-colors line-clamp-2">{trainer.name}</h3>
                    
                    {/* Десктоп: обе кнопки как на главной */}
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
                    
                    {/* Мобильная версия: обе кнопки */}
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
              )})}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Помощники - показываем только если есть сотрудники */}
      {staff.length > 0 && (
      <section className="py-24 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-[95vw] mx-auto px-4">
          <div className="text-center mb-20">
          <h3 className="text-4xl md:text-5xl font-black text-gray-400 mb-6">
                персоонал
              </h3>
          </div>

          {staff.length === 0 ? (
            <div className="text-center py-32">
              <UserCog className="w-32 h-32 text-gray-300 mx-auto mb-8" />
              <h3 className="text-4xl md:text-5xl font-black text-gray-400 mb-6">
                тут пусто
              </h3>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                Работаем над этим! Скоро добавим администраторов, менеджеров и других помощников тренеров.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {staff.map((member) => (
                <div
                  className="group relative bg-white p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-4 border-2 border-gray-100 hover:border-yellow-200 overflow-hidden h-[480px] flex flex-col"
                >
                 {/* Фото БЕЗ обрезки */}
<div className="relative flex-shrink-0 mb-8 h-72 shadow-2xl group-hover:shadow-3xl transition-all duration-500 overflow-hidden mx-auto">
  <img 
    src={member.image} 
    alt={member.name}
    className="w-full h-full object-contain bg-gray-100 group-hover:scale-105 transition-transform duration-500"
  />
  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
</div>
                  
                  {/* Имя и роль */}
                  <div className="flex-1 flex flex-col justify-end">
                    <h3 className="text-3xl font-black text-center mb-4 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent">
                      {member.name}
                    </h3>
                    {member.role && (
                      <p className="text-xl text-gray-600 text-center font-semibold">
                        {member.role}
                      </p>
                    )}
                  </div>
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      <Footer />

      <CallModal 
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />
    </div>
  );
}
