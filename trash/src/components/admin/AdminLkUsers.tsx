'use client';
import { useState, useEffect } from 'react';
import styles from './AdminLkUsers.module.css';

interface User {
  id: number;
  phone: string;
  name: string;
  email: string;
  created_at: string;
}

export default function AdminLkUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ login: string; password: string } | null>(null);
  const [activeSection, setActiveSection] = useState<'users' | 'visits' | 'payments' | 'import'>('users');

  // Для вкладки посещений
  const [visits, setVisits] = useState<any[]>([]);
  const [visitUserId, setVisitUserId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitProgramId, setVisitProgramId] = useState('');

  // Для вкладки оплат
  const [payments, setPayments] = useState<any[]>([]);
  const [payUserId, setPayUserId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDesc, setPayDesc] = useState('');

  // Для импорта Excel
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lk/users');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setMessage({ type: 'error', text: 'Ошибка загрузки пользователей' });
    } finally {
      setLoading(false);
    }
  };

  const loadVisits = async () => {
    try {
      const res = await fetch('/api/admin/lk/visits');
      const data = await res.json();
      setVisits(Array.isArray(data) ? data : []);
    } catch {
      setMessage({ type: 'error', text: 'Ошибка загрузки посещений' });
    }
  };

  const loadPayments = async () => {
    try {
      const res = await fetch('/api/admin/lk/payments');
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setMessage({ type: 'error', text: 'Ошибка загрузки оплат' });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    setCreating(true);
    setMessage(null);
    setCreatedCredentials(null);

    try {
      const res = await fetch('/api/admin/lk/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, email }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setCreatedCredentials(data.credentials);
        setPhone('');
        setName('');
        setEmail('');
        loadUsers();
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка создания' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Ошибка сервера' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Удалить пользователя? Это также удалит его посещения и подписки.')) return;
    try {
      await fetch(`/api/admin/lk/users?id=${id}`, { method: 'DELETE' });
      loadUsers();
    } catch {
      setMessage({ type: 'error', text: 'Ошибка удаления' });
    }
  };

  const handleAddVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitUserId) return;
    try {
      const res = await fetch('/api/admin/lk/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parseInt(visitUserId),
          visitDate: visitDate || new Date().toISOString(),
          programId: visitProgramId ? parseInt(visitProgramId) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: '✅ Посещение записано' });
        setVisitUserId('');
        setVisitDate('');
        setVisitProgramId('');
        loadVisits();
      }
    } catch {
      setMessage({ type: 'error', text: 'Ошибка записи посещения' });
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payUserId || !payAmount) return;
    try {
      const res = await fetch('/api/admin/lk/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parseInt(payUserId),
          amount: parseFloat(payAmount),
          description: payDesc,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: '✅ Оплата записана' });
        setPayUserId('');
        setPayAmount('');
        setPayDesc('');
        loadPayments();
      }
    } catch {
      setMessage({ type: 'error', text: 'Ошибка записи оплаты' });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'visits' | 'payments') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (type === 'visits') {
          const res = await fetch('/api/admin/lk/visits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visits: Array.isArray(data) ? data : data.visits }),
          });
          const result = await res.json();
          if (result.success) {
            setMessage({ type: 'success', text: `✅ Импортировано ${result.count} посещений` });
            loadVisits();
          }
        } else {
          const res = await fetch('/api/admin/lk/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'import', payments: Array.isArray(data) ? data : data.payments }),
          });
          const result = await res.json();
          if (result.success) {
            setMessage({ type: 'success', text: `✅ Импортировано ${result.count} оплат` });
            loadPayments();
          }
        }
      } catch {
        setMessage({ type: 'error', text: '❌ Ошибка импорта файла. Формат: JSON' });
      }
    };
    reader.readAsText(file);
    // Сброс input
    e.target.value = '';
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/lk/import-excel', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setImportResult(data);
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка импорта' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Ошибка импорта Excel' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // Навигация
  const tabs = [
    { id: 'users', label: '👥 Пользователи' },
    { id: 'visits', label: '📅 Посещения' },
    { id: 'payments', label: '💰 Оплаты' },
    { id: 'import', label: '📥 Импорт Excel' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🔑 Личный кабинет (администрирование)</h3>
        <p className={styles.description}>
          Управление пользователями, посещениями и оплатами.
          Администратор создаёт ключи доступа (логин = телефон, пароль = 6 цифр).
        </p>
      </div>

      {/* Вкладки */}
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeSection === tab.id ? styles.tabActive : ''}`}
            onClick={() => {
              setActiveSection(tab.id as any);
              setMessage(null);
              if (tab.id === 'visits') loadVisits();
              if (tab.id === 'payments') loadPayments();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========= ПОЛЬЗОВАТЕЛИ ========= */}
      {activeSection === 'users' && (
        <>
          {/* Форма создания */}
          <div className={styles.createCard}>
            <h4>➕ Создать ключ доступа</h4>
            <form onSubmit={handleCreateUser} className={styles.createForm}>
              <div className={styles.formRow}>
                <input
                  type="text"
                  placeholder="📱 Телефон (логин)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={styles.input}
                  required
                />
                <input
                  type="text"
                  placeholder="👤 Имя (необязательно)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={styles.input}
                />
                <input
                  type="email"
                  placeholder="📧 Email (необязательно)"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={styles.input}
                />
                <button type="submit" className={styles.createBtn} disabled={creating}>
                  {creating ? '⏳ Создание...' : '🔑 Создать ключ'}
                </button>
              </div>
            </form>

            {/* Показать созданные credentials */}
            {createdCredentials && (
              <div className={styles.credentialsCard}>
                <h5>✅ Ключ доступа создан!</h5>
                <div className={styles.credRow}>
                  <span className={styles.credLabel}>Логин:</span>
                  <span className={styles.credValue}>{createdCredentials.login}</span>
                  <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(createdCredentials.login)}>📋</button>
                </div>
                <div className={styles.credRow}>
                  <span className={styles.credLabel}>Пароль:</span>
                  <span className={styles.credValue}>{createdCredentials.password}</span>
                  <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(createdCredentials.password)}>📋</button>
                </div>
                <p className={styles.credHint}>Передайте эти данные клиенту. Пароль можно изменить в ЛК.</p>
              </div>
            )}
          </div>

          {/* Список пользователей */}
          <div className={styles.listCard}>
            <h4>👥 Пользователи ({users.length})</h4>
            {loading ? (
              <p className={styles.loading}>Загрузка...</p>
            ) : users.length === 0 ? (
              <p className={styles.empty}>Пользователей пока нет</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Телефон</th>
                      <th>Имя</th>
                      <th>Email</th>
                      <th>Создан</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.phone}</td>
                        <td>{u.name || '—'}</td>
                        <td>{u.email || '—'}</td>
                        <td>{new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
                        <td>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========= ПОСЕЩЕНИЯ ========= */}
      {activeSection === 'visits' && (
        <>
          <div className={styles.createCard}>
            <h4>📅 Записать посещение</h4>
            <form onSubmit={handleAddVisit} className={styles.createForm}>
              <div className={styles.formRow}>
                <input
                  type="number"
                  placeholder="ID пользователя"
                  value={visitUserId}
                  onChange={e => setVisitUserId(e.target.value)}
                  className={styles.input}
                  required
                />
                <input
                  type="datetime-local"
                  value={visitDate}
                  onChange={e => setVisitDate(e.target.value)}
                  className={styles.input}
                />
                <input
                  type="number"
                  placeholder="ID программы (необяз.)"
                  value={visitProgramId}
                  onChange={e => setVisitProgramId(e.target.value)}
                  className={styles.input}
                />
                <button type="submit" className={styles.createBtn}>📝 Записать</button>
              </div>
            </form>

            <div className={styles.importRow}>
              <span className={styles.importLabel}>Импорт из JSON:</span>
              <input
                type="file"
                accept=".json"
                onChange={e => handleImportFile(e, 'visits')}
                className={styles.fileInput}
              />
            </div>
          </div>

          <div className={styles.listCard}>
            <h4>📅 Посещения ({visits.length})</h4>
            <button className={styles.refreshBtn} onClick={loadVisits}>🔄 Обновить</button>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Пользователь</th>
                    <th>Программа</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map(v => (
                    <tr key={v.id}>
                      <td>{v.id}</td>
                      <td>{v.user_name || v.user_phone || v.user_id}</td>
                      <td>{v.program_id || '—'}</td>
                      <td>{new Date(v.visit_date).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========= ОПЛАТЫ ========= */}
      {activeSection === 'payments' && (
        <>
          <div className={styles.createCard}>
            <h4>💰 Записать оплату</h4>
            <form onSubmit={handleAddPayment} className={styles.createForm}>
              <div className={styles.formRow}>
                <input
                  type="number"
                  placeholder="ID пользователя"
                  value={payUserId}
                  onChange={e => setPayUserId(e.target.value)}
                  className={styles.input}
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Сумма"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className={styles.input}
                  required
                />
                <input
                  type="text"
                  placeholder="Описание (необяз.)"
                  value={payDesc}
                  onChange={e => setPayDesc(e.target.value)}
                  className={styles.input}
                />
                <button type="submit" className={styles.createBtn}>💳 Записать</button>
              </div>
            </form>

            <div className={styles.importRow}>
              <span className={styles.importLabel}>Импорт из CRM (JSON):</span>
              <input
                type="file"
                accept=".json"
                onChange={e => handleImportFile(e, 'payments')}
                className={styles.fileInput}
              />
            </div>
          </div>

          <div className={styles.listCard}>
            <h4>💰 Оплаты ({payments.length})</h4>
            <button className={styles.refreshBtn} onClick={loadPayments}>🔄 Обновить</button>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Пользователь</th>
                    <th>Сумма</th>
                    <th>Описание</th>
                    <th>Дата</th>
                    <th>Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.user_name || p.user_phone || p.user_id}</td>
                      <td>{p.amount} ₽</td>
                      <td>{p.description || '—'}</td>
                      <td>{new Date(p.payment_date).toLocaleString('ru-RU')}</td>
                      <td>{p.source === 'crm_import' ? '📥 CRM' : '✏️ Ручной'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========= ИМПОРТ EXCEL ========= */}
      {activeSection === 'import' && (
        <>
          <div className={styles.createCard}>
            <h4>📥 Импорт данных из Excel (CRM)</h4>
            <p className={styles.description}>
              Загрузите Excel-файл (.xlsx) с данными из CRM. 
              Формат: первый лист, колонки должны содержать слова "Телефон", "Дата", "Тип" (Посещение/Оплата/Подписка), "Сумма", "Программа".
            </p>

            <div className={styles.importRow}>
              <span className={styles.importLabel}>Файл Excel (.xlsx):</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                className={styles.fileInput}
                disabled={importing}
              />
            </div>

            {importing && (
              <div className={styles.importingIndicator}>
                <div className={styles.spinner}></div>
                <span>Импорт данных...</span>
              </div>
            )}

            {importResult && (
              <div className={styles.importResultCard}>
                <h5>✅ Результат импорта</h5>
                <div className={styles.importStats}>
                  <div className={styles.importStat}>
                    <span className={styles.importStatValue}>{importResult.stats?.visits || 0}</span>
                    <span className={styles.importStatLabel}>Посещений</span>
                  </div>
                  <div className={styles.importStat}>
                    <span className={styles.importStatValue}>{importResult.stats?.payments || 0}</span>
                    <span className={styles.importStatLabel}>Оплат</span>
                  </div>
                  <div className={styles.importStat}>
                    <span className={styles.importStatValue}>{importResult.stats?.subscriptions || 0}</span>
                    <span className={styles.importStatLabel}>Подписок</span>
                  </div>
                  <div className={styles.importStat}>
                    <span className={styles.importStatValue}>{importResult.stats?.skipped || 0}</span>
                    <span className={styles.importStatLabel}>Пропущено</span>
                  </div>
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className={styles.importErrors}>
                    <h6>⚠️ Ошибки ({importResult.errors.length}):</h6>
                    {importResult.errors.slice(0, 10).map((err: string, i: number) => (
                      <p key={i} className={styles.importErrorItem}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.listCard}>
            <h4>📋 Пример формата Excel</h4>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Телефон</th>
                    <th>Дата</th>
                    <th>Тип</th>
                    <th>Сумма</th>
                    <th>Программа</th>
                    <th>Описание</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>7900123456</td>
                    <td>01.01.2026</td>
                    <td>Посещение</td>
                    <td></td>
                    <td>Йога</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td>7900123456</td>
                    <td>01.01.2026</td>
                    <td>Оплата</td>
                    <td>5000</td>
                    <td>Йога</td>
                    <td>Абонемент январь</td>
                  </tr>
                  <tr>
                    <td>7900123456</td>
                    <td>01.01.2026</td>
                    <td>Подписка</td>
                    <td></td>
                    <td>Йога</td>
                    <td>active</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={styles.hint}>Колонки определяются автоматически по ключевым словам. Порядок не важен.</p>
          </div>
        </>
      )}

      {/* Сообщение */}
      {message && (
        <div className={`${styles.message} ${message.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}