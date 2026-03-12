'use client';
import Image from 'next/image';
import styles from './HomeSchedule.module.css';

interface HomeScheduleProps {
  openImageModal: (url: string, alt: string) => void;
}

export default function HomeSchedule({ openImageModal }: HomeScheduleProps) {
  const fixedSchedule = [
    { id: 1, image: '/расписание1.jpg' },
    { id: 2, image: '/расписание2.jpg' }
  ];

  return (
    <section id="schedule" className={styles.schedule}>
      <div className="max-w-[95vw] mx-auto px-4">
        <h2 className="text-section-title md:text-section-title font-black text-center mb-20 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent drop-shadow-2xl">
          Расписание занятий
        </h2>
        
        <div className="flex gap-8 overflow-x-auto pb-4 -mb-4 snap-x snap-mandatory scrollbar-hide">
          {fixedSchedule.map(item => (
            <div 
              key={item.id}
              className="flex-shrink-0 w-96 group cursor-pointer hover:scale-105 transition-all duration-300 snap-center"
              onClick={() => openImageModal(item.image, `Расписание ${item.id}`)}
            >
              <Image
                src={item.image}
                alt={`Расписание ${item.id}`}
                width={384}
                height={500}
                className="w-full h-auto max-h-[500px] object-contain rounded-br-[1%] shadow-2xl group-hover:shadow-3xl transition-all duration-500 hover:-translate-y-2"
                priority={true}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
