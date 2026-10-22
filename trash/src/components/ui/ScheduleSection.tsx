import { type FC } from 'react';
import Link from 'next/link';

interface ScheduleSectionProps {
  scheduleImages: string[];
}

const ScheduleSection: FC<ScheduleSectionProps> = ({ scheduleImages }) => {
  return (
    <section id="schedule" className="py-24 bg-white">
      <div className="max-w-[95vw] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Расписание занятий
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Актуальное расписание на февраль 2026
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {scheduleImages.map((image, index) => (
            <img key={index} src={image} alt={`Расписание ${index + 1}`} className="rounded-3xl shadow-2xl w-full h-[500px] object-cover" />
          ))}
        </div>
        <div className="text-center mt-12">
          <Link 
            href="/schedule" 
            className="inline-block px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105"
          >
            📅 Открыть полное расписание
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ScheduleSection;
