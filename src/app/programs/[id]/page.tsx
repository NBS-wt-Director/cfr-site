'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CallModal from '@/components/ui/CallModal';

interface Program {
  id: string;
  name: string;
  description: string;
  image: string;
  gallery?: string[];
  photoAlbum?: Array<{ image: string; caption: string }>;
  trainers?: Array<{
    id: string;
    name: string;
    image: string;
    experience: string;
  }>;
  workouts?: Array<{
    day: string;
    time: string;
    trainer: string;
    location: string;
    params?: string[];
  }>;
}

export default function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });
  const [formReason, setFormReason] = useState('');
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');

  const openCallModal = (reason: string) => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  // ✅ ИСПРАВЛЕНО: await params
  useEffect(() => {
    const loadProgram = async () => {
      const { id } = await params; // ← await params.id
      fetch(`/api/programs/${id}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: Program) => {
          setProgram(data);
          setFormReason(`записаться на программу "${data.name}"`);
          
          setLoading(false);
        })
        .catch(err => {
          console.error('❌ Ошибка загрузки программы:', err);
          setError('Программа не найдена');
          setLoading(false);
        });
    };

    loadProgram();
  }, [params]); // ← params целиком в зависимостях

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-8" />
          <p className="text-2xl">Загрузка программы...</p>
        </div>
      </div>
    );
  }

  if (error || !program) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader
        pageTitle={program.name}
        onOpenCallModal={openCallModal}
      />
      
      <section className="pt-24 pb-20 bg-gradient-to-br from-yellow-50 to-orange-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="max-w-4xl mx-auto">
              <p className="text-xl md:text-2xl text-gray-700 leading-relaxed mb-12">{program.description}</p>
            </div>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-white shadow-2xl">
              <img 
                src={program.image} 
                alt={program.name}
                className="w-full h-96 md:h-[500px] object-contain bg-gray-100"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = 
                    '<div class="w-full h-96 md:h-[500px] bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center"><ImageIcon className="w-24 h-24 text-gray-400 mx-auto" /></div>';
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Секция тренеров */}
      {program.trainers && program.trainers.length > 0 && (
        <section className="py-24 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-black text-center mb-16 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent">
              👨‍🏫 Тренеры программы
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {program.trainers.map((trainer: any, idx: number) => (
                <Link 
                  key={idx} 
                  href={`/trainers/${trainer.id}`}
                  className="block bg-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                >
                  <div className="relative h-64">
                    <img 
                      src={trainer.image} 
                      alt={trainer.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{trainer.name}</h3>
                    <p className="text-gray-600">{trainer.experience}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Секция расписания тренировок */}
      {program.workouts && program.workouts.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-12 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent">
              📅 Расписание
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {program.workouts.map((workout: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all text-white">
                  <div className="bg-white/20 px-3 py-1 rounded-lg font-bold">
                    {workout.day}
                  </div>
                  <div className="font-semibold text-lg">
                    {workout.time}
                  </div>
                  {workout.params && workout.params.length > 0 && (
                    <div className="flex gap-1">
                      {workout.params.map((param: string, pIdx: number) => (
                        <span key={pIdx} className="bg-white/20 px-2 py-1 rounded text-sm">
                          {param}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Слайдер фотоальбома */}
      {program.photoAlbum && program.photoAlbum.length > 0 && (
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-black text-center mb-20 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent drop-shadow-2xl">
              📸 Фотогалерея
            </h2>
            
            {/* Слайдер */}
            <div className="relative">
              {/* Главное изображение */}
              <div className="relative aspect-video bg-gray-100 rounded-3xl overflow-hidden shadow-2xl">
                <img 
                  src={program.photoAlbum[galleryIndex]?.image} 
                  alt={program.photoAlbum[galleryIndex]?.caption || `Фото ${galleryIndex + 1}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%23f3f4f6" width="400" height="300"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="20">Фото не найдено</text></svg>';
                  }}
                />
                
                {/* Кнопка назад */}
                {program.photoAlbum.length > 1 && (
                  <button 
                    onClick={() => setGalleryIndex(prev => prev === 0 ? program.photoAlbum.length - 1 : prev - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
                  >
                    <ChevronLeft size={32} className="text-gray-800" />
                  </button>
                )}
                
                {/* Кнопка вперёд */}
                {program.photoAlbum.length > 1 && (
                  <button 
                    onClick={() => setGalleryIndex(prev => prev === program.photoAlbum.length - 1 ? 0 : prev + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
                  >
                    <ChevronRight size={32} className="text-gray-800" />
                  </button>
                )}
                
                {/* Счётчик */}
                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-4 py-2 rounded-full font-semibold">
                  {galleryIndex + 1} / {program.photoAlbum.length}
                </div>
              </div>
              
              {/* Миниатюры */}
              {program.photoAlbum.length > 1 && (
                <div className="flex gap-3 mt-6 overflow-x-auto pb-2 justify-center">
                  {program.photoAlbum.map((photo: any, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => setGalleryIndex(idx)}
                      className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden shadow-lg transition-all hover:scale-105 ${
                        idx === galleryIndex ? 'ring-4 ring-yellow-400 ring-offset-2' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img 
                        src={photo.image} 
                        alt={`Миниатюра ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">?</text></svg>';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Кнопка записи */}
      <section className="py-24 bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-8 drop-shadow-2xl">
            Записаться на программу
          </h2>
          <p className="text-xl text-yellow-100 mb-12 max-w-2xl mx-auto leading-relaxed">
            Оставьте заявку и наш менеджер свяжется с вами в ближайшее рабочее время
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-gray-900 px-16 py-8 rounded-3xl font-black text-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 mb-12"
          >
            Записаться сейчас
          </button>
        </div>
      </section>

      {/* Форма */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl p-10 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-3xl border border-white/50">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent">
                Запись на "{program.name}"
              </h2>
              <button onClick={() => setShowForm(false)} className="p-3 hover:bg-gray-200 rounded-2xl transition-all">
                <X size={32} />
              </button>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <input type="text" placeholder="Ваше имя *" required
                value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-6 border-2 border-gray-200 rounded-3xl text-xl font-semibold focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
              <input type="tel" placeholder="+7 (___) ___-__-__ *" required
                value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full p-6 border-2 border-gray-200 rounded-3xl text-xl font-semibold focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
              <input type="email" placeholder="email@example.com"
                value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-6 border-2 border-gray-200 rounded-3xl text-xl font-semibold focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
              <input type="text" placeholder="Желание" value={formReason} readOnly
                className="w-full p-6 border-2 border-yellow-200 bg-yellow-50 rounded-3xl text-xl font-semibold cursor-not-allowed" />
              <textarea placeholder="Вопросы по программе" rows={4}
                value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})}
                className="w-full p-6 border-2 border-gray-200 rounded-3xl text-xl font-semibold focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
              <button type="submit" 
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-black py-8 px-12 rounded-3xl font-black text-2xl shadow-2xl hover:shadow-3xl hover:scale-105 flex items-center justify-center space-x-3">
                <CheckCircle size={32} />
                <span>Записаться на программу</span>
              </button>
            </form>
          </div>
        </div>
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
