
'use client';
import { useEffect, useState } from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import FullScreenImageModal from '@/components/ui/FullScreenImageModal';
import CallModal from '@/components/ui/CallModal';
import { notFound } from 'next/navigation';

interface Trainer {
  id: string;
  name: string;
  description: string;
  image: string;
  isDemo?: boolean;
  photoAlbum?: string[];
  workouts?: Array<{
    day: string;
    time: string;
    duration: string;
    location: string;
  }>;
}

interface Photo {
  image: string;
  caption: string;
}

export default function TrainerPage({ params }: { params: Promise<{ id: string }> }) {
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });
  const [formReason, setFormReason] = useState('');
  
  // ✅ МОДАЛКА ФОТО
  const [imageModal, setImageModal] = useState({ open: false, url: '', alt: '' });
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');

  const openCallModal = (reason: string) => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  useEffect(() => {
    const loadTrainer = async () => {
      const { id } = await params;
      fetch(`/api/trainers/${id}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: Trainer) => {
          setTrainer(data);
          setFormReason(`записаться к тренеру "${data.name}"`);
          setLoading(false);
        })
        .catch(err => {
          console.error('❌ Ошибка загрузки тренера:', err);
          setLoading(false);
        });
    };
    loadTrainer();
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData, reason: formReason };
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', phone: '', email: '', message: '' });
        alert('✅ Заявка отправлена!');
      }
    } catch {
      alert('Ошибка отправки');
    }
  };

  // ✅ ОТКРЫТИЕ ФОТО В МОДАЛКЕ
  const openImageModal = (url: string, alt: string) => {
    setImageModal({ open: true, url, alt });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-8" />
          <p className="text-2xl">Загрузка профиля тренера...</p>
        </div>
      </div>
    );
  }

  if (!trainer) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader 
        pageTitle={trainer.name}
        onOpenCallModal={openCallModal}
      />

      {/* Основная информация */}
      <section className="pt-24 pb-20 bg-gradient-to-br from-yellow-50 to-orange-50">
        <div className="max-w-4xl mx-auto px-4">
          {trainer.isDemo && (
            <div className="bg-yellow-100 border-2 border-yellow-300 text-yellow-800 px-8 py-6 rounded-3xl max-w-4xl mx-auto mb-12 text-center shadow-lg mb-16">
              <div className="text-2xl font-bold mb-4">⚠️ Демо-режим</div>
              <p className="text-xl">{trainer.description}</p>
            </div>
          )}
          
          {/* ✅ ГЛАВНОЕ ФОТО - КЛИКАбельное */}
          <div className="max-w-4xl mx-auto mb-16">
            <div 
              className="relative bg-white rounded-3xl shadow-2xl overflow-hidden cursor-pointer hover:shadow-3xl transition-all duration-300 hover:scale-[1.02]"
              onClick={() => openImageModal(trainer.image, trainer.name)}
            >
              <img 
                src={trainer.image} 
                alt={trainer.name}
                className="w-full h-[500px] md:h-[600px] object-contain bg-gradient-to-br from-gray-100 to-gray-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800";
                }}
              />
            </div>
          </div>

          {/* ИМЯ + ОПИСАНИЕ */}
          <div className="text-left mb-16 space-y-8 max-w-2xl">
            <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent drop-shadow-2xl">
              {trainer.name}
            </h1>
            <div 
              className="text-xl md:text-2xl text-gray-700 leading-relaxed whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: trainer.description }}
            />
          </div>
        </div>
      </section>

      {/* ✅ Фотогалерея - ВСЕ КЛИКАбельные */}
      {trainer.photoAlbum && trainer.photoAlbum.length > 0 && (
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-black text-center mb-20 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent drop-shadow-2xl">
              📸 Фотоальбом
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {trainer.photoAlbum.map((photo: Photo, idx: number) => (
                <div 
                  key={idx} 
                  className="group relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-3 overflow-hidden cursor-pointer"
                  onClick={() => openImageModal(photo.image, photo.caption)}
                >
                  <div className="w-full h-80 p-4 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-3xl">
                    <img 
                      src={photo.image} 
                      alt={photo.caption}
                      className="w-full h-full max-h-72 object-contain rounded-2xl shadow-lg group-hover:scale-105 transition-transform duration-500 max-w-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400";
                      }}
                    />
                  </div>
                  <div className="p-6">
                    <p className="font-semibold text-lg text-gray-800 line-clamp-2 group-hover:text-yellow-600 transition-colors">
                      {photo.caption}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Расписание тренировок */}
      {trainer.workouts && trainer.workouts.length > 0 && (
        <section className="py-24 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-black text-center mb-20 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent drop-shadow-2xl">
              📅 Расписание тренировок
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-3xl shadow-2xl border border-gray-200">
                <thead>
                  <tr className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black">
                    <th className="p-6 text-left font-bold text-xl rounded-tl-3xl">День</th>
                    <th className="p-6 text-left font-bold text-xl">Время</th>
                    <th className="p-6 text-left font-bold text-xl">Продолжительность</th>
                    <th className="p-6 text-left font-bold text-xl rounded-tr-3xl">Место</th>
                  </tr>
                </thead>
                <tbody>
                  {trainer.workouts.map((workout, idx) => (
                    <tr key={idx} className="hover:bg-yellow-50 transition-colors border-t border-gray-100">
                      <td className="p-6 font-semibold text-xl">{workout.day}</td>
                      <td className="p-6 font-bold text-xl text-yellow-600">{workout.time}</td>
                      <td className="p-6 font-semibold text-lg">{workout.duration}</td>
                      <td className="p-6 text-lg">{workout.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Кнопка записи */}
      <section className="py-24 bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-8 drop-shadow-2xl">
            Записаться к тренеру {trainer.name}
          </h2>
          <p className="text-xl text-yellow-100 mb-12 max-w-2xl mx-auto leading-relaxed">
            Оставьте заявку и тренер свяжется с вами для записи на тренировку
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-gray-900 px-16 py-8 rounded-3xl font-black text-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 mb-12"
          >
            Записаться к {trainer.name}
          </button>
        </div>
      </section>

      {/* Форма записи */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl p-10 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-3xl border border-white/50">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent">
                Запись к тренеру
                <br />
                <span className="text-2xl text-gray-600">«{trainer.name}»</span>
              </h2>
              <button onClick={() => setShowForm(false)} className="p-3 hover:bg-gray-200 rounded-2xl transition-all">
                <X size={32} />
              </button>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <input 
                type="text" 
                placeholder="Ваше имя *" 
                required
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-6 border-2 border-gray-200 rounded-3xl text-xl font-semibold focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              />
              <input 
                type="tel" 
                placeholder="+7 (___) ___-__-__ *" 
                required
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full p-6 border-2 border-gray-200 rounded-3xl text-xl font-semibold focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              />
              <input 
                type="email" 
                placeholder="email@example.com"
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-6 border-2 border-gray-200 rounded-3xl text-xl font-semibold focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              />
              <input 
                type="text" 
                placeholder="Желание" 
                value={formReason} 
                readOnly
                className="w-full p-6 border-2 border-yellow-200 bg-yellow-50 rounded-3xl text-xl font-semibold cursor-not-allowed"
              />
              <textarea 
                placeholder="Вопросы к тренеру" 
                rows={4}
                value={formData.message} 
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                className="w-full p-6 border-2 border-gray-200 rounded-3xl text-xl font-semibold focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              />
              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-black py-8 px-12 rounded-3xl font-black text-2xl shadow-2xl hover:shadow-3xl hover:scale-105 flex items-center justify-center space-x-3"
              >
                <CheckCircle size={32} />
                <span>Записаться к тренеру</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ✅ МОДАЛКА ФОТО */}
      <FullScreenImageModal 
        isOpen={imageModal.open}
        imageUrl={imageModal.url}
        alt={imageModal.alt}
        onClose={() => setImageModal({ open: false, url: '', alt: '' })}
      />

      <CallModal 
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />

      <Footer />
    </div>
  );
}
