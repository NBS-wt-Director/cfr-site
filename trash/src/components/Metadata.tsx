import type { Metadata } from 'next';

interface MetadataProps {
  titlePrefix?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export function generateMetadata({
  titlePrefix,
  description = 'Центр Функционального Развития "Шифу Панда", Екатеринбург',
  keywords = ['ушу', 'здоровье', 'Екатеринбург', 'тренировки', 'УрСФУ'],
  image = '/og-main.jpg',
  ogTitle,
  ogDescription,
  ogImage,
}: MetadataProps): Metadata {
  
  const finalTitle = titlePrefix 
    ? `${titlePrefix} | ЦФР Екатеринбург`
    : 'ЦФР Екатеринбург';

  return {
    title: finalTitle,
    description,
    keywords,
    
    openGraph: {
      title: ogTitle || finalTitle,
      description: ogDescription || description,
      images: [ogImage || image],
      type: 'website',
      locale: 'ru_RU',
    },
    
    twitter: {
      card: 'summary_large_image',
      title: ogTitle || finalTitle,
      description: ogDescription || description,
      images: [ogImage || image],
    },
    
    robots: {
      index: true,
      follow: true,
    },
  };
}
