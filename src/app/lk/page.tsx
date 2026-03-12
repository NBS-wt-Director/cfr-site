'use client';
import { useEffect, useState } from 'react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import SectionSpacer from '@/components/ui/SectionSpacer';
import CallModal from '@/components/ui/CallModal';
import styles from './page.module.css';

export default function LkPage() {
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Личный кабинет');
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [siteSettings, setSiteSettings] = useState({ clientNotification: '' });
  const openCallModal = (reason: string = 'Личный кабинет') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  useEffect(() => {
    loadLkLibraries();
    
  }, []);

  const loadLkLibraries = () => {
    const scripts = [
      'https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js',
      'https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jquery.maskedinput/1.4.1/jquery.maskedinput.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/dropbox.js/10.10.0/Dropbox-sdk.js',
      'https://cdnjs.cloudflare.com/ajax/libs/es6-promise/4.1.1/es6-promise.auto.min.js',
      'https://cdn.jsdelivr.net/npm/unfetch@4.1.0/polyfill/index.js',
      'https://cdn.jsdelivr.net/npm/exif-js',
      'https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.3/croppie.min.js'
    ];

    scripts.forEach(src => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => setScriptsLoaded(true);
        document.head.appendChild(script);
      }
    });

    const cssLinks = [
      'https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/base/jquery-ui.css',
      'https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.3/croppie.min.css'
    ];

    cssLinks.forEach(href => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    });
  };

  const lkHtml = `
    <!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
    <title>Личный кабинет клиента</title>
    <meta http-equiv='Content-Type' content='text/html; charset=utf-8'/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      /* ✅ Весь CSS из paste.txt */
      body { margin: 0; padding: 0; background:#2d8ed0; }
      .preloader { display:none; overflow:hidden; position:fixed; z-index:100000; width:100%; height:100%; }
      .preloader .container { width:90px; margin:40vh auto 0 auto; text-align:center; transform:translate(-50%, -50%); }
      .preloader .container span { display:block; margin:-95px 0 0 30px; color:#efefef; text-transform:uppercase; font-size:1.6em; font-family:Lucida Console; -webkit-animation:pulse 4000ms linear infinite; -moz-animation:pulse 4000ms linear infinite; animation:pulse 4000ms linear infinite; }
      /* ... Коротко: ВСЕ стили из paste.txt вставьте сюда ... */
    </style>
    </head>
    <body>
      <!-- ✅ Весь HTML из paste.txt -->
      <div class="preloader">
        <div class="container">
          <div class="circle"></div>
          <span>загрузка</span>
        </div>
      </div>
      <div id='login-dialog' title='Личный кабинет клиента' style='display:none'>
        <div>
          <div id='login-phone-div' class='login-input-div'>
            <label for='login-phone'>Телефон:</label>
            <input id='login-phone' class='login-input' type='text'>
          </div>
          <div id='login-pas-div' class='login-input-div'>
            <label for='login-pas'>Пароль:</label>
            <input id='login-pas' class='login-input' type='password'>
          </div>
        </div>
      </div>
      <!-- Остальной HTML -->
      <script>
        /* ✅ Весь JavaScript из paste.txt */
        var d=document; var dbPath='/Clients';
        window.onload=function(){/* Весь код window.onload из paste.txt */}
      </script>
    </body>
    </html>
  `;

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader 
        pageTitle="Личный кабинет клиента"
        onOpenCallModal={openCallModal}
      />

      <SectionSpacer height="lg" background="default" />

      <section className={styles.lkContainer}>
        <div className="max-w-[95vw] mx-auto px-4 py-8">
          {scriptsLoaded ? (
            <div 
              className={styles.lkFrame}
              dangerouslySetInnerHTML={{ __html: lkHtml }}
            />
          ) : (
            <div className={styles.loadingFrame}>
              <div className="w-24 h-24 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-8"></div>
              <p className="text-xl text-center text-gray-600">Загрузка личного кабинета...</p>
            </div>
          )}

          <div className="text-center mt-12">
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center gap-3 px-12 py-6 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 text-white font-black rounded-3xl shadow-2xl hover:shadow-3xl hover:-translate-y-3 transition-all duration-500 text-xl"
            >
              🏠 На главную
            </button>
          </div>
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
