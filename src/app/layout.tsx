import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import SiteStyles from '@/components/SiteStyles';

export const metadata: Metadata = {
    title: 'ЦФР - Центр Развития | Шифу Панда',
    description: 'Спорт, развитие детей и взрослых, секции кунг фу, карате, тхэквондо, самбо, боевые искусства. Екатеринбург.',
    keywords: 'спорт, кунг фу, карате, тхэквондо, самбо, боевые искусства, екатеринбург, шифу панда',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ru">
            <SiteStyles />
            <body className="font-panda antialiased">

                <main>{children}</main>
            </body>
        </html>
    );
}
