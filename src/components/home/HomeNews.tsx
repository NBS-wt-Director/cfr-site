'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Heart, ThumbsUp, Clapperboard } from 'lucide-react';
import styles from './HomeNews.module.css';

interface NewsItem {
  id: number;
  image: string;
  title:string,
  text: string;
  description: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  reactions?: {
    likes: number;
    hearts: number;
    claps: number;
  };
}

interface HomeNewsProps {
  news: NewsItem[];
  openImageModal: (url: string, alt: string) => void;
}

// Функция для получения ID видео VK
function getVkVideoEmbedUrl(url: string): string {
  // Прямые ссылки vkvideo.ru
  const vkvideoMatch = url.match(/vkvideo\.ru\/video(-?\d+)_(\d+)/);
  if (vkvideoMatch) {
    return `https://vk.com/video_ext.php?oid=${vkvideoMatch[1]}&id=${vkvideoMatch[2]}&hash=YOUR_HASH`;
  }
  
  // Ссылки vk.com/video
  const vkMatch = url.match(/vk\.com\/video(-?\d+)_(\d+)/);
  if (vkMatch) {
    return `https://vk.com/video_ext.php?oid=${vkMatch[1]}&id=${vkMatch[2]}&hash=YOUR_HASH`;
  }
  
  return '';
}

export default function HomeNews({
  news = [],
  openImageModal
}: HomeNewsProps) {
  const safeNews: NewsItem[] = Array.isArray(news) ? news : [];
  const [userReactions, setUserReactions] = useState<Record<number, string>>({});

  // Определяем, является ли URL VK видео
  const isVkVideo = (url: string) => {
    return url && (url.includes('vk.com/video') || url.includes('vkvideo.ru'));
  };

  // Обработка реакций
  const handleReaction = (newsId: number, type: string) => {
    const currentReaction = userReactions[newsId];
    
    setUserReactions(prev => {
      const newReactions = { ...prev };
      if (currentReaction === type) {
        delete newReactions[newsId];
      } else {
        newReactions[newsId] = type;
      }
      return newReactions;
    });
  };

  return (
    <section id="news" className={styles.news}>
      <div className="max-w-[95vw] mx-auto px-4">
        <h2 className="text-section-title md:text-section-title font-black text-center mb-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-2xl">
         Наши события. 
        </h2>
        
        {safeNews.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {safeNews.map((item: NewsItem) => {
              // Проверяем mediaType или наличие videoUrl
              const isVideo = item.mediaType === 'video' || (item.videoUrl && !item.image);
              const videoUrl = item.videoUrl;
              
              return (
                <div key={item.id} className="group cursor-pointer hover:scale-[1.02] transition-transform duration-300 flex flex-col h-full">
                  <div 
                    className="relative h-48 sm:h-56 bg-gray-100 rounded-t-xl overflow-hidden shadow-2xl group-hover:shadow-3xl transition-all duration-500 flex-shrink-0"
                    onClick={() => !isVideo && item.image ? openImageModal(item.image, item.text) : undefined}
                  >
                    {/* Если это видео */}
                    {isVideo && videoUrl ? (
                      isVkVideo(videoUrl) ? (
                        // VK Video - используем iframe
                        <iframe
                          src={`https://vk.com/video_ext.php?oid=${videoUrl.match(/video(-?\d+)/)?.[1] || '0'}&id=${videoUrl.match(/_(\d+)/)?.[1] || '0'}&hash=YOUR_HASH`}
                          className="w-full h-full"
                          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      ) : videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.includes('/uploads/') ? (
                        // Обычное видео с сервера
                        <video
                          src={videoUrl}
                          className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                          controls
                          preload="metadata"
                        />
                      ) : (
                        // Ссылка на видео (не файл) - показываем как iframe
                        <iframe
                          src={videoUrl}
                          className="w-full h-full"
                          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      )
                    ) : item.image ? (
                      <Image
                        src={item.image}
                        alt={item.text || ''}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        Нет изображения
                      </div>
                    )}
                  </div>
                  <div className="mt-6 p-6 bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                    <h3 className="text-button font-bold text-gray-900 mb-4 line-clamp-2 leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 mb-6 leading-relaxed text-lg">
                      {item.text}
                    </p>
                    
                    {/* Реакции */}
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleReaction(item.id, 'likes'); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                          userReactions[item.id] === 'likes' 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <ThumbsUp size={16} />
                        <span>{item.reactions?.likes || 0}</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleReaction(item.id, 'hearts'); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                          userReactions[item.id] === 'hearts' 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Heart size={16} className={userReactions[item.id] === 'hearts' ? 'fill-current' : ''} />
                        <span>{item.reactions?.hearts || 0}</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleReaction(item.id, 'claps'); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                          userReactions[item.id] === 'claps' 
                            ? 'bg-amber-100 text-amber-600' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Clapperboard size={16} />
                        <span>{item.reactions?.claps || 0}</span>
                      </button>
                    </div>
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
