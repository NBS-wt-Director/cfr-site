'use client';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, Calendar, Clock } from 'lucide-react';

interface Workout {
  id: number;
  day: string;
  time: string;
  programId: number | null;
  programName: string;
  params: string[];
}

interface Program {
  id: number;
  name: string;
}

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

interface AdminWorkoutsProps {
  workouts: Workout[];
  programs: Program[];
  onSave: (workouts: Workout[]) => void;
}

export default function AdminWorkouts({ workouts, programs, onSave }: AdminWorkoutsProps) {
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>(workouts);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // Форма
  const [formData, setFormData] = useState({
    day: 'Понедельник',
    time: '10:00',
    programId: '' as string,
    programName: '' as string,
    params: '' as string
  });

  useEffect(() => {
    setLocalWorkouts(workouts);
  }, [workouts]);

  const resetForm = () => {
    setFormData({
      day: 'Понедельник',
      time: '10:00',
      programId: '',
      programName: '',
      params: ''
    });
    setEditingId(null);
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const program = programs.find(p => p.id === Number(formData.programId));
    const paramsArray = formData.params 
      ? formData.params.split(',').map(p => p.trim()).filter(p => p)
      : [];

    const workoutData = {
      day: formData.day,
      time: formData.time,
      programId: formData.programId ? Number(formData.programId) : null,
      programName: program?.name || formData.programName || '',
      params: paramsArray
    };

    try {
      if (editingId) {
        // Обновление
        const res = await fetch(`/api/workouts/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workoutData)
        });
        if (res.ok) {
          const updated = await res.json();
          setLocalWorkouts(prev => prev.map(w => w.id === editingId ? updated : w));
        }
      } else {
        // Создание
        const res = await fetch('/api/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workoutData)
        });
        if (res.ok) {
          const created = await res.json();
          setLocalWorkouts(prev => [...prev, created]);
        }
      }
      resetForm();
      onSave(localWorkouts);
    } catch (err) {
      console.error('Ошибка:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (workout: Workout) => {
    setFormData({
      day: workout.day,
      time: workout.time,
      programId: workout.programId ? String(workout.programId) : '',
      programName: workout.programName,
      params: workout.params?.join(', ') || ''
    });
    setEditingId(workout.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить тренировку?')) return;
    
    try {
      const res = await fetch(`/api/workouts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLocalWorkouts(prev => prev.filter(w => w.id !== id));
        onSave(localWorkouts.filter(w => w.id !== id));
      }
    } catch (err) {
      console.error('Ошибка удаления:', err);
    }
  };

  // Группировка по дням
  const workoutsByDay = DAYS.reduce((acc, day) => {
    acc[day] = localWorkouts.filter(w => w.day === day).sort((a, b) => a.time.localeCompare(b.time));
    return acc;
  }, {} as Record<string, Workout[]>);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">📅 Управление расписанием</h2>
          <p className="text-gray-500">Добавьте тренировки в расписание</p>
        </div>
        <button
          onClick={() => { setIsAdding(true); setEditingId(null); setFormData({
            day: 'Понедельник',
            time: '10:00',
            programId: '',
            programName: '',
            params: ''
          }); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Plus size={20} /> Добавить тренировку
        </button>
      </div>

      {/* Форма добавления/редактирования */}
      {isAdding && (
        <div className="bg-white border-2 border-emerald-500 rounded-xl p-6 mb-6 shadow-lg">
          <h3 className="text-lg font-bold mb-4">
            {editingId ? '✏️ Редактировать тренировку' : '➕ Новая тренировка'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">День недели</label>
                <select
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg"
                  required
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Время</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full p-2 border-2 border-gray-200 rounded-lg"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Программа</label>
              <select
                value={formData.programId}
                onChange={(e) => setFormData({ ...formData, programId: e.target.value })}
                className="w-full p-2 border-2 border-gray-200 rounded-lg"
              >
                <option value="">-- Выберите программу --</option>
                {programs.map(program => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Параметры (через запятую)</label>
              <input
                type="text"
                value={formData.params}
                onChange={(e) => setFormData({ ...formData, params: e.target.value })}
                placeholder="с родителем, для начинающих"
                className="w-full p-2 border-2 border-gray-200 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : (editingId ? 'Сохранить' : 'Добавить')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Список тренировок по дням */}
      <div className="space-y-4">
        {DAYS.map(day => {
          const dayWorkouts = workoutsByDay[day];
          if (dayWorkouts.length === 0) return null;
          
          return (
            <div key={day} className="bg-white rounded-xl shadow overflow-hidden">
              <div className="bg-emerald-100 px-4 py-2 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-emerald-800">{day}</span>
                <span className="text-sm text-emerald-600">({dayWorkouts.length} тренировок)</span>
              </div>
              <div className="divide-y">
                {dayWorkouts.map(workout => (
                  <div key={workout.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="font-bold">{workout.time}</span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {workout.programName || 'Общая тренировка'}
                        </div>
                        {workout.params && workout.params.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {workout.params.map((param, i) => (
                              <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                {param}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(workout)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(workout.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {localWorkouts.length === 0 && !isAdding && (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Тренировки пока не добавлены</p>
        </div>
      )}
    </div>
  );
}
