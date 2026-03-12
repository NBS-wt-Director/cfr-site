'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Mail, MapPin, Send, MessageCircle, Share2 } from 'lucide-react';

interface SiteData {
  contacts: {
    address: string;
    phone: string;
    email: string;
    telegram?: string;
    vk?: string;
    social?: Array<{
      id: string;
      title: string;
      url: string;
    }>;
  };
  pages?: Array<{
    id: string;
    slug: string;
    title: string;
    enabled: boolean;
  }>;
}

interface FooterSettings {
  enabled: boolean;
  showContacts: boolean;
  showSocial: boolean;
  showCopyright: boolean;
  copyrightText: string;
  showDevInfo: boolean;
  links: Array<{ text: string; href: string }>;
  menuLinks: Array<{ text: string; href: string; enabled: boolean }>;
}

interface FooterProps {
  onCallClick?: (reason: string) => void;
}

export default function Footer({ onCallClick }: FooterProps) {
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [footerSettings, setFooterSettings] = useState<FooterSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ ЗАГРУЗКА ДАННЫХ ИЗ БД, СТРАНИЦ И НАСТРОЕК ФУТЕРА
  useEffect(() => {
    Promise.all([
      fetch('/api/db').then(res => res.json()),
      fetch('/api/pages').then(res => res.json()).catch(() => []),
      fetch('/data/footer.json').then(res => res.json()).catch(() => null)
    ])
      .then(([data, pages, footerData]) => {
        setSiteData({ ...data, pages });
        setFooterSettings(footerData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Footer fetch error:', err);
        setLoading(false);
      });
  }, []);

  // Если футер отключен в настройках - не рендерим
  if (footerSettings && !footerSettings.enabled) {
    return null;
  }

  const contacts = siteData?.contacts || {
    address: 'г. Екатеринбург, ул. 8 Марта, 70',
    phone: '+7 (902) 258-45-47',
    email: 'centr-fr@yandex.ru',
    social: []
  };

  const showContacts = footerSettings?.showContacts !== false;
  const showSocial = footerSettings?.showSocial !== false;
  const showCopyright = footerSettings?.showCopyright !== false;
  const footerLinks = footerSettings?.links || [];
  const menuLinks = footerSettings?.menuLinks || [
    { text: 'Главная', href: '/', enabled: true },
    { text: 'Программы', href: '/programs', enabled: true },
    { text: 'Тренеры', href: '/trainers', enabled: true },
    { text: 'Новости', href: '/news', enabled: true }
  ];
  const copyrightText = footerSettings?.copyrightText || '© 2026 Шифу Панда. Екатеринбург. Все права защищены.';

  // Получаем включенные страницы для меню
  const pages = siteData?.pages?.filter((p: any) => p.enabled) || [];

  const handleCallClick = () => {
    onCallClick?.('заказать звонок из футера');
  };

  if (loading) {
    return (
      <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white">
        <div className="max-w-[95vw] mx-auto px-4 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-gray-700 rounded-lg mb-8"></div>
            <div className="h-32 bg-gray-700 rounded-xl"></div>
            <div className="h-20 bg-gray-700 rounded-xl"></div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white relative overflow-hidden">
      {/* ФОНОВЫЕ ЭФФЕКТЫ */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-orange-500/5"></div>
      
      <div className="max-w-[95vw] mx-auto px-4 py-16 relative z-10">
        {/* Основной контент */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start mb-12">
          {/* 🐼 ЛОГО + КОНТАКТЫ */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-16 h-16 relative flex-shrink-0">
                <Image 
                  src='/logo.png'
                  alt="Логотип"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <h3 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                  Шифу Панда
                </h3>
                <p className="text-yellow-400 font-bold text-lg">Центр Функционального Развития</p>
              </div>
            </div>

            {showContacts && (
              <>
                {/* 📍 АДРЕС */}
                <a 
                  href="https://yandex.ru/profile/-/CPQK4QYu"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex items-start gap-4 p-6 bg-white/5 backdrop-blur-xl rounded-3xl hover:bg-white/10 hover:-translate-y-2 transition-all duration-500 border border-white/20 shadow-xl hover:shadow-2xl"
                >
                  <MapPin className="w-7 h-7 mt-1 flex-shrink-0 text-yellow-400 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xl mb-2 text-white">📍 Адрес</p>
                    <p className="text-gray-200 leading-relaxed text-lg line-clamp-3">{contacts.address}</p>
                  </div>
                </a>

                {/* 📞 ТЕЛЕФОН */}
                <a 
                  href={`tel:${contacts.phone.replace(/\D/g, '')}`}
                  className="group flex items-center gap-4 p-6 mt-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-xl rounded-3xl hover:from-yellow-500/30 hover:to-orange-500/30 hover:shadow-2xl hover:scale-[1.02] hover:rotate-[1deg] transition-all duration-500 border border-yellow-500/30 shadow-xl"
                  onClick={handleCallClick}
                >
                  <Phone className="w-7 h-7 flex-shrink-0 text-yellow-300 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xl mb-1">{contacts.phone}</p>
                    <p className="text-yellow-200 font-semibold text-lg">📲 Позвонить</p>
                  </div>
                </a>

                {/* ✉️ EMAIL */}
                <a 
                  href={`mailto:${contacts.email}`}
                  className="group flex items-center gap-4 p-6 mt-4 bg-white/5 backdrop-blur-xl rounded-3xl hover:bg-white/10 hover:-translate-y-1.5 transition-all duration-400 border border-white/20 shadow-xl hover:shadow-2xl"
                >
                  <Mail className="w-7 h-7 flex-shrink-0 text-yellow-400 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
                  <div>
                    <p className="font-bold text-xl mb-1">{contacts.email}</p>
                    <p className="text-gray-300 font-semibold text-lg">💬 Написать</p>
                  </div>
                </a>
              </>
            )}
          </div>

          {/* 🧭 НАВИГАЦИЯ */}
          <div className="lg:col-span-1">
            <h4 className="text-2xl font-black mb-8 flex items-center gap-3">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
              <span>Перейти к</span>
            </h4>
            <nav className="space-y-3">
              <Link href="/" className="group flex items-center gap-3 p-4 rounded-2xl hover:bg-white/10 hover:-translate-x-3 hover:scale-[1.02] transition-all duration-400 border border-white/10">
                <span className="w-3 h-3 bg-yellow-400 rounded-full group-hover:scale-125 group-hover:rotate-180 transition-all duration-300" />
                <span className="text-gray-200 hover:text-white font-semibold text-lg">🏠 Главная</span>
              </Link>
              <Link href="/programs" className="group flex items-center gap-3 p-4 rounded-2xl hover:bg-white/10 hover:-translate-x-3 hover:scale-[1.02] transition-all duration-400 border border-white/10">
                <span className="w-3 h-3 bg-emerald-400 rounded-full group-hover:scale-125 group-hover:rotate-180 transition-all duration-300" />
                <span className="text-gray-200 hover:text-white font-semibold text-lg">🥋 Программы</span>
              </Link>
              <Link href="/trainers" className="group flex items-center gap-3 p-4 rounded-2xl hover:bg-white/10 hover:-translate-x-3 hover:scale-[1.02] transition-all duration-400 border border-white/10">
                <span className="w-3 h-3 bg-blue-400 rounded-full group-hover:scale-125 group-hover:rotate-180 transition-all duration-300" />
                <span className="text-gray-200 hover:text-white font-semibold text-lg">👥 Тренеры</span>
              </Link>
              <Link href="/news" className="group flex items-center gap-3 p-4 rounded-2xl hover:bg-white/10 hover:-translate-x-3 hover:scale-[1.02] transition-all duration-400 border border-white/10">
                <span className="w-3 h-3 bg-purple-400 rounded-full group-hover:scale-125 group-hover:rotate-180 transition-all duration-300" />
                <span className="text-gray-200 hover:text-white font-semibold text-lg">📰 Новости</span>
              </Link>
              
              {/* Ссылки на созданные страницы */}
              {pages.map((page: any) => (
                <Link 
                  key={page.id} 
                  href={page.slug}
                  className="group flex items-center gap-3 p-4 rounded-2xl hover:bg-white/10 hover:-translate-x-3 hover:scale-[1.02] transition-all duration-400 border border-white/10"
                >
                  <span className="w-3 h-3 bg-orange-400 rounded-full group-hover:scale-125 group-hover:rotate-180 transition-all duration-300" />
                  <span className="text-gray-200 hover:text-white font-semibold text-lg">📄 {page.title}</span>
                </Link>
              ))}
              
              {/* Дополнительные ссылки из настроек футера */}
              {footerSettings?.showLinks && footerLinks.map((link, idx) => (
                <a 
                  key={idx}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 p-4 rounded-2xl hover:bg-white/10 hover:-translate-x-3 hover:scale-[1.02] transition-all duration-400 border border-white/10"
                >
                  <span className="w-3 h-3 bg-cyan-400 rounded-full group-hover:scale-125 group-hover:rotate-180 transition-all duration-300" />
                  <span className="text-gray-200 hover:text-white font-semibold text-lg">🔗 {link.text}</span>
                </a>
              ))}
            </nav>
          </div>

          {/* 🌐 СОЦИАЛЬНЫЕ СЕТИ */}
          <div className="lg:col-span-1">
            {showSocial && (
              <>
                <h4 className="text-2xl font-black mb-8 flex items-center gap-3">
                  <Share2 className="w-8 h-8 text-yellow-400" />
                  <span>Мы в сети</span>
                </h4>
                
                <div className="space-y-4">
                  {/* VK */}
                  {contacts.vk && (
                    <a 
                      href={contacts.vk} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 p-6 bg-gradient-to-r from-blue-600/20 to-blue-700/20 backdrop-blur-xl rounded-3xl hover:from-blue-500/30 hover:to-blue-600/30 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 border border-blue-500/30"
                    >
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all">
                        <span className="text-white font-bold text-xl">VK</span>
                      </div>
                      <div>
                        <p className="font-bold text-lg text-white">ВКонтакте</p>
                        <p className="text-blue-200 font-semibold text-sm">Перейти в группу</p>
                      </div>
                    </a>
                  )}

                  {/* Telegram */}
                  {contacts.telegram && (
                    <a 
                      href={contacts.telegram} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 p-6 bg-gradient-to-r from-blue-400/20 to-teal-500/20 backdrop-blur-xl rounded-3xl hover:from-blue-400/30 hover:to-teal-500/30 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 border border-teal-400/30"
                    >
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-white">Telegram</p>
                        <p className="text-teal-200 font-semibold text-sm">Чат клуба</p>
                      </div>
                    </a>
                  )}

                  {/* Другие соцсети */}
                  {contacts.social?.map((social, idx) => (
                    social.url && social.id !== 'vk' && social.id !== 'telegram' ? (
                      <a 
                        key={idx}
                        href={social.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group flex items-center gap-4 p-6 bg-white/10 backdrop-blur-xl rounded-3xl hover:bg-white/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 border border-white/20"
                      >
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                          <span className="text-black font-bold text-lg">{social.id.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-bold text-lg text-white">{social.title}</p>
                          <p className="text-gray-300 font-semibold text-sm">Скоро здесь</p>
                        </div>
                      </a>
                    ) : null
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Нижняя полоса */}
        {showCopyright && (
          <div className="border-t border-white/10 pt-12 mt-16">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 text-center lg:text-left">
              <p className="text-gray-400 text-lg font-medium">
                {copyrightText}
              </p>
              <div className="flex gap-4 text-gray-400 text-sm">
              </div>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
