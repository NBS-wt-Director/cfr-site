'use client';
import { useState, useEffect } from 'react';

interface PgTable {
  table_name: string;
  record_count: string;
}

interface StatusData {
  mode: string;
  pgAvailable: boolean;
  connectionTime: number | null;
  tables: PgTable[];
  totalRecords: number;
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/data/status')
      .then(res => res.json())
      .then(setData)
      .catch(() => setData({
        mode: 'json',
        pgAvailable: false,
        connectionTime: null,
        tables: [],
        totalRecords: 0,
      }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', background: '#0f172a', color: '#94a3b8',
        fontFamily: 'system-ui, sans-serif'
      }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif', padding: '2rem'
    }}>
      <button
        onClick={() => window.location.reload()}
        style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: '#3b82f6', color: 'white', border: 'none',
          padding: '0.6rem 1.2rem', borderRadius: '0.75rem',
          fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
        }}
      >
        🔄 Обновить
      </button>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{
          fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>
          🏗️ CFR Site Status
        </h1>
        <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '1.1rem' }}>
          Центр Функционального Развития «Шифу Панда»
        </p>
        <p style={{
          textAlign: 'center', color: '#475569', fontSize: '0.85rem', marginBottom: '2rem'
        }}>
          Обновлено: {new Date().toLocaleString('ru-RU')}
        </p>

        {/* Основной статус */}
        <div style={{
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem',
            color: '#94a3b8'
          }}>🖥️ Основной статус</h2>
          <StatusRow label="Режим работы" value={
            <Badge ok={data!.mode === 'postgres'}>
              {data!.mode === 'postgres' ? 'PostgreSQL' : 'JSON (файл)'}
            </Badge>
          } />
          <StatusRow label="PostgreSQL" value={
            <Badge ok={data!.pgAvailable}>
              {data!.pgAvailable ? 'Доступен' : 'Недоступен'}
              {data!.connectionTime ? ` (${data!.connectionTime}ms)` : ''}
            </Badge>
          } />
        </div>

        {/* Таблицы PostgreSQL */}
        {data!.pgAvailable && data!.tables.length > 0 && (
          <div style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem',
              color: '#94a3b8'
            }}>📊 Таблицы PostgreSQL</h2>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.5rem'
            }}>
              {data!.tables.map(t => (
                <div key={t.table_name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 0.75rem', background: '#0f172a',
                  borderRadius: '0.5rem', border: '1px solid #334155', fontSize: '0.85rem'
                }}>
                  <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{t.table_name}</span>
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}>{t.record_count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Информация */}
        <div style={{
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem',
            color: '#94a3b8'
          }}>ℹ️ Информация</h2>
          <StatusRow label="Версия Next.js" value="16.1.6" />
          <StatusRow label="Среда" value="production" />
          <StatusRow label="Время" value={new Date().toLocaleString('ru-RU')} />
        </div>
      </div>

      <p style={{
        textAlign: 'center', color: '#475569', fontSize: '0.8rem', marginTop: '2rem'
      }}>
        CFR Site © 2026 — Центр Функционального Развития «Шифу Панда»
      </p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.75rem 0', borderBottom: '1px solid #334155'
    }}>
      <span style={{ color: '#cbd5e1' }}>{label}</span>
      <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.95rem' }}>{value}</span>
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.85rem',
      fontWeight: 600,
      background: ok ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
      color: ok ? '#4ade80' : '#f87171',
      border: `1px solid ${ok ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
    }}>
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: ok ? '#4ade80' : '#f87171',
        boxShadow: ok ? '0 0 8px #4ade80' : 'none'
      }} />
      {children}
    </span>
  );
}
