'use client';
import Image from 'next/image';
import styles from './HomePrices.module.css';

interface PriceImage {
  id: number;
  image?: string;
}

interface HomePricesProps {
  openImageModal: (url: string, alt: string) => void;
  prices?: PriceImage[];
}

export default function HomePrices({ 
  openImageModal, 
  prices = []
}: HomePricesProps) {
  // Используем изображения из БД или дефолтные
  const fixedPrices = prices.length > 0 
    ? prices.filter(p => p.image)
    : [{ id: 1, image: '/api/price-image?file=цены1.jpg' }];

  return (
    <section id="prices" className={styles.prices}>
      <div className="max-w-[95vw] mx-auto px-4">
        <h2 className="text-section-title md:text-section-title font-black text-center mb-20 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent drop-shadow-2xl">
          Цены на абонементы
        </h2>
        
        <div className="flex gap-8 overflow-x-auto pb-4 -mb-4 snap-x snap-mandatory scrollbar-hide">
          {fixedPrices.map(item => (
            <div 
              key={item.id}
              className="flex-shrink-0 w-96 group cursor-pointer hover:scale-105 transition-all duration-300 snap-center"
              onClick={() => item.image && openImageModal(item.image!, 'Прайс-лист')}
            >
              <Image
                src={item.image || ''}
                alt="Цены"
                width={384}
                height={500}
                className="w-full h-auto max-h-[500px] object-contain rounded-br-[1%] shadow-2xl group-hover:shadow-3xl transition-all duration-500 hover:-translate-y-2"
                priority={true}
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
