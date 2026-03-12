'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import SectionSpacer from '@/components/ui/SectionSpacer';
import CallModal from '@/components/ui/CallModal';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  media: string | null;
  enabled: boolean;
  code: string;
}

export default function DynamicPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');

  const openCallModal = (reason: string = 'Общий запрос') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  useEffect(() => {
    if (!slug) return;

    fetch(`/api/pages/${slug}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Page not found');
        }
        return res.json();
      })
      .then(data => {
        if (!data.enabled) {
          // Страница выключена - редирект на главную
          router.push('/');
          return;
        }
        setPage(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [slug, router]);

  // Если страница выключена, показываем загрузку (редирект)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-500">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-8" />
          <p className="text-2xl font-bold">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-black text-gray-800 mb-4">404</h1>
          <p className="text-xl text-gray-600 mb-8">Страница не найдена</p>
          <Link href="/" className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader 
        pageTitle={page.title}
        onOpenCallModal={openCallModal}
      />

      <SectionSpacer height="lg" background="default" />

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Медиа (фото или видео) */}
        {page.media && !page.code && (
          <div className="mb-8">
            {page.media.endsWith('.mp4') || page.media.endsWith('.webm') ? (
              <video
                src={page.media}
                controls
                className="w-full max-h-[500px] rounded-2xl shadow-xl"
              />
            ) : (
              <Image
                src={page.media}
                alt={page.title}
                width={800}
                height={500}
                className="w-full h-auto max-h-[500px] object-contain rounded-2xl shadow-xl"
              />
            )}
          </div>
        )}

        {/* Контент страницы */}
        {!page.code && page.content && (
          <div className="prose max-w-none">
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-8">
              {page.title}
            </h1>
            <div className="text-lg text-gray-700 whitespace-pre-wrap">
              {page.content}
            </div>
          </div>
        )}

        {/* Кастомный код (MD или HTML) */}
        {page.code && (
          <div className="prose max-w-none">
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-8">
              {page.title}
            </h1>
            <div 
              className="bg-white p-8 rounded-2xl shadow-lg"
              dangerouslySetInnerHTML={{ 
                __html: page.code
                  // Простой markdown -> html конвертер
                  .replace(/^## (.+)$/gm, '<h2 class="text-3xl font-bold text-gray-900 mt-8 mb-4">$1</h2>')
                  .replace(/^### (.+)$/gm, '<h3 class="text-2xl font-bold text-gray-800 mt-6 mb-3">$1</h3>')
                  .replace(/^#### (.+)$/gm, '<h4 class="text-xl font-bold text-gray-800 mt-4 mb-2">$1</h4>')
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.+?)\*/g, '<em>$1</em>')
                  .replace(/^\- (.+)$/gm, '<li class="ml-4 mb-2">$1</li>')
                  .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-2">$1</li>')
                  .replace(/\n\n/g, '</p><p class="mb-4">')
                  .replace(/^(.+)$/gm, (match) => {
                    if (match.startsWith('<')) return match;
                    return `<p class="mb-4">${match}</p>`;
                  })
              }} 
            />
          </div>
        )}
      </main>

      <Footer />

      <CallModal 
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />
    </div>
  );
}
