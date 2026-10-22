'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Heart, ThumbsUp, Clapperboard } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import SectionSpacer from '@/components/ui/SectionSpacer';
import CallModal from '@/components/ui/CallModal';
import StatsCollector from '@/components/ui/StatsCollector';

interface News {
  id: number;
  image: string;
  title: string;
  text: string;
  description?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  reactions?: {
    likes: number;
    hearts: number;
    claps: number;
  };
}

export default function NewsPage() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');
  const [userReactions, setUserReactions] = useState<Record<number, string>>({});

  const openCallModal = (reason: string = 'Общий запрос') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  // Обработка реакций
  const handleReaction = (newsId: number, type: string) => {
    const currentReaction = userReactions[newsId];
    
    setNews(prev => prev.map(item => {
      if (item.id !== newsId) return item;
      const reactions = item.reactions || { likes: 0, hearts: 0, claps: 0 };
      
      // Если уже есть реакция этого типа - убираем
      if (currentReaction === type) {
        setUserReactions(prev => ({ ...prev, [newsId]: '' }));
        return {
          ...item,
          reactions: {
            ...reactions,
            [type === 'likes' ? 'likes' : type === 'hearts' ? 'hearts' : 'claps']: 
              (reactions[type === 'likes' ? 'likes' : type === 'hearts' ? 'hearts' : 'claps'] || 0) - 1
          }
        };
      }
      
      // Иначе - добавляем реакцию (и убираем старую если была)
      setUserReactions(prev => ({ ...prev, [newsId]: type }));
      const newReactions = { ...reactions };
      if (currentReaction) {
        newReactions[currentReaction === 'likes' ? 'likes' : currentReaction === 'hearts' ? 'hearts' : 'claps']--;
      }
      newReactions[type === 'likes' ? 'likes' : type === 'hearts' ? 'hearts' : 'claps']++;
      
      return { ...item, reactions: newReactions };
    }));
  };

  useEffect(() => {
    // Используем тот же источник что и на главной
    fetch('/api/db')
      .then(res => res.json())
      .then(data => {
        // Формат как на главной: { id, image, title, text, description, videoUrl, mediaType }
        const allNews = data?.news || [];
        // Фильтруем: либо есть image, либо есть videoUrl (активные новости)
        const activeNews = allNews.filter((n: any) => n.image || n.videoUrl);
        setNews(activeNews);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-8" />
          <p className="text-2xl font-bold">Загрузка новостей...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StatsCollector />
      <SiteHeader 
        pageTitle="Новости центра"
        onOpenCallModal={openCallModal}
      />

      <SectionSpacer height="lg" background="default" />

      <section className="max-w-[95vw] mx-auto px-4 py-12">
        <h1 className="text-page-title md:text-page-title font-black text-center mb-16 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Новости центра
        </h1>

        {news.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block p-12 bg-white rounded-3xl shadow-xl">
              <div className="text-6xl mb-6">📰</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Новостей пока нет</h2>
              <p className="text-gray-600 text-lg">Следите за обновлениями!</p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-0 items-stretch">
            {news.map((item) => {
              const reactions = item.reactions || { likes: 0, hearts: 0, claps: 0 };
              const userReaction = userReactions[item.id] || '';
              
              return (
              <article 
                key={item.id}
                className="bg-white rounded-none shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 border-r border-b border-gray-200 last:border-r-0 flex flex-col h-full"
              >
                {/* Изображение или видео */}
                <div className="relative h-48 sm:h-56 bg-gray-100">
                  {/* Проверяем: если mediaType === 'video' ИЛИ есть videoUrl (не пустая строка) */}
                  {item.mediaType === 'video' || (item.videoUrl && item.videoUrl.trim()) ? (
                    (item.videoUrl && item.videoUrl.trim()) && (item.videoUrl.endsWith('.mp4') || item.videoUrl.endsWith('.webm') || item.videoUrl.includes('/uploads/')) ? (
                      // Видео файл с сервера
                      <video
                        src={item.videoUrl}
                        className="w-full h-full object-contain"
                        controls
                        preload="metadata"
                      />
                    ) : (
                      // Ссылка на видео (VK или iframe)
                      <iframe
                        src={item.videoUrl || item.image}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    )
                  ) : item.image ? (
                    <img
                      src={item.image}
                      alt={item.text || item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>

                {/* Контент */}
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                    {item.title}
                  </h2>
                  
                  <p className="text-gray-600 mb-4">
                    {item.text || item.description}
                  </p>
                  
                  {/* Реакции */}
                  <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                    <button 
                      onClick={() => handleReaction(item.id, 'likes')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${
                        userReaction === 'likes' 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <ThumbsUp size={16} />
                      <span className="text-sm font-medium">{reactions.likes || 0}</span>
                    </button>
                    <button 
                      onClick={() => handleReaction(item.id, 'hearts')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${
                        userReaction === 'hearts' 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Heart size={16} className={userReaction === 'hearts' ? 'fill-current' : ''} />
                      <span className="text-sm font-medium">{reactions.hearts || 0}</span>
                    </button>
                    <button 
                      onClick={() => handleReaction(item.id, 'claps')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${
                        userReaction === 'claps' 
                          ? 'bg-amber-100 text-amber-600' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Clapperboard size={16} />
                      <span className="text-sm font-medium">{reactions.claps || 0}</span>
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}

        {/* Кнопка на главную */}
        <div className="text-center mt-12">
          <Link 
            href="/"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-lg"
          >
            ← На главную
          </Link>
        </div>
      </section>

      <Footer />

      <CallModal 
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />
    </div>
  );
}
