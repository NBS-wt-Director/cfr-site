interface Contacts {
    address: string;
    email: string;
    phone: string;
  }
  
  interface Props {
    contacts: Contacts;
  }
  
  export default function ContactsSection({ contacts }: Props) {
    return (
      <section id="contacts" className="py-24 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-[95vw] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="section-title">Свяжитесь с нами</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Мы всегда рады новым ученикам! Запишитесь на пробное занятие бесплатно
            </p>
          </div>
  
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Контактная информация */}
            <div className="space-y-8">
              <div className="bg-white p-10 rounded-3xl shadow-2xl hover:shadow-3xl transition-all hover:-translate-y-2 border border-gray-100">
                <div className="flex items-start space-x-4 mb-6">
                  <div className="w-16 h-16 bg-panda-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📍</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Адрес</h3>
                    <p className="text-xl text-gray-700">{contacts.address}</p>
                  </div>
                </div>
              </div>
  
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl shadow-2xl hover:shadow-3xl transition-all hover:-translate-y-2 border border-gray-100 group">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <span className="text-2xl">📧</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">Email</h4>
                      <a href={`mailto:${contacts.email}`} className="text-xl text-gray-700 hover:text-blue-600 transition-colors">
                        {contacts.email}
                      </a>
                    </div>
                  </div>
                </div>
  
                <div className="bg-white p-8 rounded-3xl shadow-2xl hover:shadow-3xl transition-all hover:-translate-y-2 border border-gray-100 group">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <span className="text-2xl">📞</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">Телефон</h4>
                      <a href={`tel:${contacts.phone.replace(/\D/g, '')}`} className="text-xl text-gray-700 hover:text-blue-600 transition-colors">
                        {contacts.phone}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
  
            {/* Карта */}
            <div className="relative h-[500px] rounded-3xl shadow-2xl overflow-hidden">
              <iframe
                src="https://yandex.ru/maps/org/tsentr_funktsionalnogo_razvitiya/1226243121/?ll=60.604293%2C56.822001&z=16.88"
                width="100%"
                height="100%"
                className="border-0"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>
    );
  }
  
