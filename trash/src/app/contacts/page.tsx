'use client';
import { useEffect, useState } from 'react';
import SiteHeader from '@/components/ui/SiteHeader';
import CallModal from '@/components/ui/CallModal';
import { Phone, Mail, MapPin, MessageCircle, Send, Bell } from 'lucide-react';

export default function ContactsPage() {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Общий запрос');

  const openCallModal = (reason: string = 'Общий запрос') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  useEffect(() => {
    fetch('/api/db')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const contacts = data.contacts || {
    address: 'г. Екатеринбург, ул. 8 Марта, 70',
    phone: '+7 (902) 258-45-47',
    email: 'centr-fr@yandex.ru',
    vk: '',
    telegram: ''
  };

  const additionalContacts = data.additionalContacts || {
    enabled: true,
    groups: [],
    yandexMap: { enabled: true }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500">
        <div className="text-white text-xl font-bold">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader 
        pageTitle="Контакты - Шифу Панда"
        onOpenCallModal={openCallModal}
      />

      {/* Разделитель */}
      <div style={{ height: '60px' }} />

      {/* Основные контакты */}
      <section className="py-16 bg-white">
        <div className="max-w-[95vw] mx-auto px-4">
          <h1 className="text-page-title md:text-page-title font-black text-center mb-12 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            Наши контакты
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Адрес */}
            <a 
              href="https://yandex.ru/profile/-/CPQK4QYu"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl hover:from-yellow-50 hover:to-orange-50 transition-all duration-300 border-2 border-gray-200 hover:border-yellow-400 hover:shadow-xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">📍 Адрес</h3>
              <p className="text-gray-600 text-lg leading-relaxed">{contacts.address}</p>
              <p className="text-yellow-600 font-semibold mt-4 group-hover:translate-x-2 transition-transform">Открыть на карте →</p>
            </a>

            {/* Телефон */}
            <a 
              href={`tel:${contacts.phone.replace(/\D/g, '')}`}
              onClick={() => openCallModal('Контакты - звонок')}
              className="group p-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl hover:from-yellow-50 hover:to-orange-50 transition-all duration-300 border-2 border-gray-200 hover:border-yellow-400 hover:shadow-xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">📞 Телефон</h3>
              <p className="text-gray-600 text-lg font-semibold">{contacts.phone}</p>
              <p className="text-yellow-600 font-semibold mt-4 group-hover:translate-x-2 transition-transform">Позвонить →</p>
            </a>

            {/* Email */}
            <a 
              href={`mailto:${contacts.email}`}
              className="group p-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl hover:from-yellow-50 hover:to-orange-50 transition-all duration-300 border-2 border-gray-200 hover:border-yellow-400 hover:shadow-xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">✉️ Email</h3>
              <p className="text-gray-600 text-lg">{contacts.email}</p>
              <p className="text-yellow-600 font-semibold mt-4 group-hover:translate-x-2 transition-transform">Написать →</p>
            </a>
          </div>

          {/* Социальные сети */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-center mb-8">Мы в социальных сетях</h2>
            <div className="flex flex-wrap justify-center gap-6">
              {contacts.vk && (
                <a 
                  href={contacts.vk}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:from-blue-500 hover:to-blue-600 hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  <span className="font-bold text-lg">VK</span>
                  <MessageCircle className="w-6 h-6" />
                </a>
              )}
              {contacts.telegram && (
                <a 
                  href={contacts.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-blue-400 to-teal-500 text-white rounded-2xl hover:from-blue-300 hover:to-teal-400 hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  <span className="font-bold text-lg">Telegram</span>
                  <MessageCircle className="w-6 h-6" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Разделитель */}
      <div style={{ height: '40px' }} />

      {/* Дополнительные контакты / Подписки */}
      {additionalContacts.enabled && additionalContacts.groups && additionalContacts.groups.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-yellow-50 to-orange-50">
          <div className="max-w-[95vw] mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-4">
              {additionalContacts.title || 'Подпишитесь на нас'}
            </h2>
            <p className="text-gray-600 text-center mb-12 text-lg">
              Выберите удобный способ получать новости и обновления
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {additionalContacts.groups.map((group: any, index: number) => (
                <div 
                  key={group.id || index}
                  className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-gray-100 hover:border-yellow-400"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                      <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{group.title}</h3>
                      <span className="text-sm text-gray-500 capitalize">{group.platform}</span>
                    </div>
                  </div>
                  
                  {group.url && (
                    <a 
                      href={group.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      Подписаться
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Разделитель */}
      <div style={{ height: '40px' }} />

      {/* Яндекс карта */}
      {additionalContacts.yandexMap?.enabled && (
        <section className="py-16 bg-white">
          <div className="max-w-[95vw] mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-8">
              Как нас найти
            </h2>
            
            <div className="bg-gray-100 rounded-3xl overflow-hidden shadow-2xl">
              <iframe
                src={`https://yandex.ru/map-widget/v1/?ll=${additionalContacts.yandexMap.center?.[1]}%2C${additionalContacts.yandexMap.center?.[0]}&z=${additionalContacts.yandexMap.zoom}&pt=${additionalContacts.yandexMap.placemark?.[1]}%2C${additionalContacts.yandexMap.placemark?.[0]}`}
                width="100%"
                height="500"
                frameBorder="0"
                allowFullScreen
                className="w-full"
                title="Яндекс карта"
              ></iframe>
            </div>
            
            {additionalContacts.yandexMap.address && (
              <p className="text-center text-gray-600 mt-6 text-lg">
                📍 {additionalContacts.yandexMap.address}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Подвал только с копирайтом */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-[95vw] mx-auto px-4 text-center">
          <p className="text-gray-400 text-lg">
            © 2026 <span className="font-black text-white">Шифу Панда</span>. Екатеринбург. Все права защищены.
          </p>
        </div>
      </footer>

      <CallModal 
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />
    </div>
  );
}
