import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import SiteStyles from '@/components/SiteStyles';

const inter = Inter({ 
  subsets: ['latin', 'cyrillic'], 
  display: 'swap',
  variable: '--font-panda'
});

export const metadata: Metadata = {
  title: 'Шифу Панда - Центр Функционального Развития Екатеринбург',
  description: 'ушу, фитнес и боевые искусства для всех возрастов. Профессиональные тренеры, современный зал.',
  keywords: 'ушуу, екатеринбург, шифу панда, боевые искусства, фитнес',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <SiteStyles />
      <body className={`${inter.variable} font-panda antialiased`}>
     
        <main>{children}</main>
      </body>
    </html>
  );
}
