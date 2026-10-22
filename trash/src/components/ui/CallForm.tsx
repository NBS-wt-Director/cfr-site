'use client';
import { useState } from 'react';
import { X, Loader2, CheckCircle } from 'lucide-react';

export default function CallForm() {
  const [formData, setFormData] = useState({ name: '', phone: '', question: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showForm, setShowForm] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setShowForm(false), 2000);
      }
    } catch {
      alert('Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) return null;

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-12 rounded-3xl max-w-md w-full text-center shadow-2xl">
          <CheckCircle className="w-24 h-24 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Отправлено!</h2>
          <p className="text-gray-600 mb-8">Перезвон в течение часа</p>
          <button 
            onClick={() => setShowForm(false)}
            className="bg-green-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-green-600"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Заказать звонок</h2>
          <button 
            onClick={() => setShowForm(false)}
            className="p-2 hover:bg-gray-100 rounded-2xl transition-colors"
          >
            <X size={28} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            placeholder="Ваше имя *"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100"
            required
            disabled={loading}
          />
          <input
            type="tel"
            placeholder="+7 (___) ___-__-__ *"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100"
            required
            disabled={loading}
          />
          <textarea
            placeholder="Вопрос (необязательно)"
            value={formData.question}
            onChange={(e) => setFormData({...formData, question: e.target.value})}
            rows={4}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 resize-vertical"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !formData.name || !formData.phone}
            className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black py-5 px-8 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Отправляем...</span>
              </>
            ) : (
              'Отправить заявку'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
