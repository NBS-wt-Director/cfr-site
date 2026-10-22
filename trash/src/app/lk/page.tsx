'use client';
import { useState, useEffect, useCallback } from 'react';
import SiteHeader from '@/components/ui/SiteHeader';
import Footer from '@/components/Footer';
import SectionSpacer from '@/components/ui/SectionSpacer';
import CallModal from '@/components/ui/CallModal';
import styles from './page.module.css';

type Page = 'login' | 'dashboard' | 'visits' | 'payments' | 'certs' | 'accounts' | 'homework' | 'diary';

interface FamilyMember {
  id: number;
  name: string;
  role: 'self' | 'child';
  is_parent: boolean;
}

interface NextClass {
  day: string;
  time: string;
  program: string;
  trainer: string;
  hall: string;
}

interface Stats {
  remaining_sessions: number;
  remaining_rubles: number;
  visits_31d: number;
  bonuses: number;
  paid_31d: number;
  spent_31d: number;
}

interface Visit {
  id?: number;
  date: string;
  program: string;
  trainer: string;
  hall: string;
  type: string;
  cost: string;
}

interface Payment {
  id?: number;
  date: string;
  type: string;
  subtype: string | null;
  amount: number;
  amountDisplay: string;
  description: string;
  status: string;
}

export default function LkPage() {
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReason, setCallReason] = useState('Личный кабинет');
  const [page, setPage] = useState<Page>('login');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [activePerson, setActivePerson] = useState<number | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [nextClass, setNextClass] = useState<NextClass | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [isBirthday, setIsBirthday] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  // Login form
  const [phone, setPhone] = useState('');
  const [agreementNumber, setAgreementNumber] = useState('');

  // Check localStorage on load
  useEffect(() => {
    const savedToken = localStorage.getItem('lk-token');
    if (savedToken) {
      setToken(savedToken);
      loadProfile(savedToken, 'dashboard');
    }
  }, []);

  // Load family members
  const loadFamily = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/lk/profile?section=family', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFamily(data.family || []);
        if (data.family && data.family.length > 0) {
          setActivePerson(data.family[0].id);
        }
      }
    } catch (e) {
      console.error('Ошибка загрузки семьи:', e);
    }
  }, []);

  const loadProfile = async (authToken: string, targetPage: Page = 'dashboard') => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lk/profile?section=overview', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('lk-token');
          setToken(null);
          setPage('login');
        }
        setError('Сессия истекла. Войдите снова.');
        return;
      }
      const data = await res.json();
      setUser(data.user);
      
      if (data.next_class) setNextClass(data.next_class);
      if (data.stats) setStats(data.stats);
      if (data.recent_visits) setRecentVisits(data.recent_visits);
      if (data.is_birthday !== undefined) setIsBirthday(data.is_birthday);
      
      setPage(targetPage);
    } catch {
      setError('Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/lk/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, agreement_number: agreementNumber }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('lk-token', data.token);
        setToken(data.token);
        setUser(data.user);
        await loadFamily(data.token);
        loadProfile(data.token, 'dashboard');
      } else {
        setError(data.error || 'Неверный номер телефона или номер договора');
      }
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('lk-token');
    setToken(null);
    setUser(null);
    setFamily([]);
    setActivePerson(null);
    setVisits([]);
    setPayments([]);
    setPage('login');
    setPhone('');
    setAgreementNumber('');
  };

  // Load visits
  const loadVisits = async (personId?: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const url = `/api/lk/profile?section=visits&page=${currentPage}&person_id=${personId || ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setVisits(data.visits || []);
      setTotalPages(data.pagination?.total_pages || 1);
      setPage('visits');
    } catch {
      setError('Ошибка загрузки посещений');
    } finally {
      setLoading(false);
    }
  };

  // Load payments
  const loadPayments = async (personId?: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const url = `/api/lk/profile?section=payments&person_id=${personId || ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setPayments(data.payments || []);
      setTotalPaid(data.totals?.total_paid || 0);
      setTotalSpent(data.totals?.total_spent || 0);
      setPage('payments');
    } catch {
      setError('Ошибка загрузки оплат');
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (p: Page) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  const toggleStatExpand = (key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handlePersonChange = (personId: number) => {
    setActivePerson(personId);
    // Reload data for selected person
    if (page === 'visits') loadVisits(personId);
    else if (page === 'payments') loadPayments(personId);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadVisits(activePerson || undefined);
  };

  const openCallModal = (reason: string = 'Личный кабинет') => {
    setCallReason(reason);
    setCallModalOpen(true);
  };

  // ============ RENDER LOGIN ============
  const renderLogin = () => (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginIcon}>🐼</div>
        <h1 className={styles.loginTitle}>Личный кабинет</h1>
        <p className={styles.loginSubtitle}>
          Введите номер телефона и номер договора
        </p>
        <form onSubmit={handleLogin} className={styles.loginForm}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Номер телефона</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              className={styles.input}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Номер договора</label>
            <input
              type="text"
              value={agreementNumber}
              onChange={e => setAgreementNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Номер договора"
              className={styles.input}
              required
            />
          </div>
          {error && <div className={styles.loginError}>{error}</div>}
          <button type="submit" className={styles.loginBtn} disabled={loading}>
            {loading ? '⏳ Вход...' : '🚪 Войти'}
          </button>
        </form>
        <p className={styles.loginHelp}>
          Нет доступа? Позвоните: <a href="tel:+79022584547">+7 (902) 258-45-47</a>
        </p>
      </div>
    </div>
  );

  // ============ RENDER PERSON SWITCHER ============
  const renderPersonSwitcher = () => {
    if (!family || family.length <= 1) return null;
    
    const leftDisabled = family.findIndex(f => f.id === activePerson) === 0;
    const rightDisabled = family.findIndex(f => f.id === activePerson) === family.length - 1;

    return (
      <div className={styles.topbar}>
        <button
          className={styles.personNavBtn}
          disabled={leftDisabled}
          onClick={() => {
            const idx = family.findIndex(f => f.id === activePerson);
            if (idx > 0) handlePersonChange(family[idx - 1].id);
          }}
        >
          ←
        </button>
        <div className={styles.personScroll}>
          <div className={styles.personTrack}>
            {family.map(member => (
              <button
                key={member.id}
                className={`${styles.personBtn}${member.id === activePerson ? ` ${styles.active}` : ''}`}
                onClick={() => handlePersonChange(member.id)}
              >
                <span className={styles.personName}>{member.name}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          className={styles.personNavBtn}
          disabled={rightDisabled}
          onClick={() => {
            const idx = family.findIndex(f => f.id === activePerson);
            if (idx < family.length - 1) handlePersonChange(family[idx + 1].id);
          }}
        >
          →
        </button>
      </div>
    );
  };

  // ============ RENDER DASHBOARD ============
  const renderDashboard = () => (
    <div>
      {renderPersonSwitcher()}

      {/* Welcome card */}
      <div className={styles.welcomeCard}>
        <div className={styles.welcomeAvatar}>
          {user?.name ? user.name[0].toUpperCase() : '👤'}
        </div>
        <div className={styles.welcomeInfo}>
          <h2>{user?.name || 'Клиент'}</h2>
          <p>📞 {user?.phone}</p>
          <p>📄 Договор №{user?.agreement_number || '—'}</p>
        </div>
      </div>

      {/* Birthday banner */}
      {isBirthday && (
        <div className={styles.birthdayBanner}>
          <span className={styles.bannerIcon}>🎉</span>
          <div>
            <div className={styles.bannerTitle}>🎂 С днём рождения, {user?.name?.split(' ')[1] || 'Иван'}!</div>
            <div className={styles.bannerSubtitle}>Приходи на тренировку в течение 3 дней и получи подарок от студии!</div>
          </div>
        </div>
      )}

      {/* Next class */}
      {nextClass && (
        <div className={styles.nextClass}>
          <span className={styles.nextClassIcon}>📅</span>
          <div>
            <div className={styles.nextClassTitle}>Ближайшая тренировка</div>
            <div className={styles.nextClassDetail}>
              {nextClass.day}, {nextClass.time} — {nextClass.program}, тренер {nextClass.trainer}, {nextClass.hall}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className={styles.statsGrid}>
          {/* Остаток */}
          <div
            className={`${styles.statCard}${styles.statCardExpandable}`}
            onClick={() => toggleStatExpand('remaining')}
          >
            <div className={styles.statIcon}>🎫</div>
            <div className={styles.statValue}>
              ~ {stats.remaining_sessions} тренировок
              <span className={styles.tooltipTrigger}>
                <span className={styles.tooltipText}>
                  Остаток абонемента в деньгах: {stats.remaining_rubles} ₽. Примерно ~{stats.remaining_sessions} тренировок осталось. Точное количество зависит от цены программ.
                </span>
              </span>
            </div>
            <div className={styles.statLabel}>
              Остаток · суммарно за 31 день: {stats.remaining_rubles} ₽
            </div>
            <div className={styles.statExpandHint}>
              Нажмите для подробностей ▾
            </div>
            <div className={styles.statExpandContent}>
              <div className={styles.expandNote}>
                Точное количество зависит от цены программ, на которые вы ходите
              </div>
            </div>
          </div>

          {/* За 31 день */}
          <div
            className={`${styles.statCard}${styles.statCardExpandable}`}
            onClick={() => toggleStatExpand('visits31d')}
          >
            <div className={styles.statIcon}>📅</div>
            <div className={styles.statValue}>
              {stats.visits_31d}
              <span className={styles.tooltipTrigger}>
                <span className={styles.tooltipText}>Посещения за 31 день. За весь срок: 48.</span>
              </span>
            </div>
            <div className={styles.statLabel}>За 31 день</div>
            <div className={styles.statExpandHint}>Нажмите для подробностей ▾</div>
            <div className={styles.statExpandContent}>
              <div className={styles.expandNote}>За весь срок: 48 посещений</div>
            </div>
          </div>

          {/* Бонусы */}
          <div className={styles.statCard}>
            <div className={styles.statIcon}>⭐</div>
            <div className={styles.statValue}>{stats.bonuses} ₽</div>
            <div className={styles.statLabel}>
              Бонусы
              <span className={styles.tooltipTrigger}>
                <span className={styles.tooltipText}>Акционные бонусы по акции «Приведи друга».</span>
              </span>
            </div>
          </div>

          {/* Оплачено / потрачено */}
          <div
            className={`${styles.statCard}${styles.statCardExpandable}`}
            onClick={() => toggleStatExpand('paidSpent')}
          >
            <div className={styles.statIcon}>💰</div>
            <div className={styles.statValue} style={{ fontSize: '1.1rem' }}>
              {stats.paid_31d.toLocaleString()} ₽ / {stats.spent_31d.toLocaleString()} ₽
              <span className={styles.tooltipTrigger}>
                <span className={styles.tooltipText}>
                  Оплачено за 31 день (положено на счёт): {stats.paid_31d.toLocaleString()} ₽. Потрачено за 31 день (по тренировкам): {stats.spent_31d.toLocaleString()} ₽.
                </span>
              </span>
            </div>
            <div className={styles.statLabel}>Оплачено / потрачено</div>
            <div className={styles.statExpandHint}>Нажмите для подробностей ▾</div>
            <div className={styles.statExpandContent}>
              <div className={styles.expandNote}>Оплачено — положено на счёт, потрачено — по тренировкам</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent visits */}
      <div className={`${styles.sectionTitle} tooltipTrigger`}>
        📅 Последние посещения
        <span className={styles.tooltipText}>
          Показаны посещения за последние 31 день. Полная история — во вкладке «Посещения».
        </span>
      </div>
      <div className={styles.recentList}>
        {recentVisits.map((v: any, i: number) => (
          <div key={i} className={styles.recentItem}>
            <span className={styles.visitDate}>{v.date}</span>
            <span className={styles.visitInfo}>
              <strong>{v.program}</strong> · тренер {v.trainer}
            </span>
          </div>
        ))}
      </div>

      <button
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
        style={{ width: '100%', marginTop: '1rem' }}
        onClick={() => loadVisits(activePerson || undefined)}
      >
        Посмотреть все посещения
      </button>
    </div>
  );

  // ============ RENDER VISITS ============
  const renderVisits = () => (
    <div>
      {renderPersonSwitcher()}
      <div className={styles.sectionTitle}>📅 История посещений</div>
      <div className={styles.filters}>
        <select className={`${styles.filterSelect} ${styles.filterLg}`}>
          <option>Все месяцы</option>
          <option>Август 2026</option>
          <option>Июль 2026</option>
          <option>Июнь 2026</option>
        </select>
        <select className={`${styles.filterSelect} ${styles.filterLg}`}>
          <option>Все программы</option>
          <option>Кунг-фу</option>
          <option>Персональная</option>
        </select>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Загрузка...</div>
      ) : visits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px' }}>
          <p>История посещений пуста.</p>
          <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '8px' }}>Посещения появятся после импорта данных из CRM.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Программа</th>
                  <th>Тренер</th>
                  <th>Зал</th>
                  <th>Тип</th>
                  <th>Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id || v.date}>
                    <td>{v.date}</td>
                    <td>{v.program}</td>
                    <td>{v.trainer}</td>
                    <td>{v.hall}</td>
                    <td>{v.type}</td>
                    <td>{v.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <button disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>
              Назад
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <button
                key={i + 1}
                className={currentPage === i + 1 ? styles.active : ''}
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <span className={styles.pageInfo}>из {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>
              Вперёд
            </button>
          </div>
          <div className={styles.totals}>
            Всего посещений: <strong>{visits.length}</strong> · Суммарная стоимость: <strong>{visits.reduce((s: number, v: any) => {
              const cost = parseInt(v.cost?.replace(/\D/g, '') || '0');
              return s + cost;
            }, 0).toLocaleString()} ₽</strong>
          </div>
        </>
      )}
    </div>
  );

  // ============ RENDER PAYMENTS ============
  const renderPayments = () => (
    <div>
      {renderPersonSwitcher()}
      <div className={styles.sectionTitle}>💰 Оплаты и списания</div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Загрузка...</div>
      ) : payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px' }}>
          <p>История оплат пуста.</p>
          <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '8px' }}>Оплаты появятся после импорта данных из CRM.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Подтип</th>
                  <th>Сумма</th>
                  <th>Описание</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id || p.date}>
                    <td>{p.date}</td>
                    <td>{p.type}</td>
                    <td>{p.subtype || '—'}</td>
                    <td style={{
                      fontWeight: 700,
                      color: p.type === 'Списание' && p.subtype !== 'Возврат' ? '#EF4444' : '#10B981',
                    }}>
                      {p.amountDisplay}
                    </td>
                    <td>{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.totals}>
            Всего оплачено: <strong>{totalPaid.toLocaleString()} ₽</strong> · Баланс депозита: <strong>{(totalPaid - totalSpent).toLocaleString()} ₽</strong>
          </div>
        </>
      )}
    </div>
  );

  // ============ RENDER PLACEHOLDER ============
  const renderPlaceholder = (title: string, icon: string, description: string, features: string[]) => (
    <div>
      <div className={styles.sectionTitle}>{icon} {title}</div>
      <div className={styles.placeholder}>
        <div className={styles.placeholderIcon}>{icon}</div>
        <h3>{description}</h3>
        <p>{description} — раздел появится после интеграции с CRM.</p>
        <div className={styles.placeholderFeatures}>
          {features.map((f, i) => (
            <span key={i} className={styles.placeholderFeature}>{f}</span>
          ))}
        </div>
        <div className={styles.placeholderHint}>Раздел в разработке</div>
      </div>
    </div>
  );

  // ============ SIDEBAR NAV ITEMS ============
  const navItems = [
    { page: 'dashboard' as Page, icon: '📊', label: 'Обзор' },
    { page: 'visits' as Page, icon: '📅', label: 'Посещения' },
    { page: 'payments' as Page, icon: '💰', label: 'Оплаты и списания' },
  ];

  const soonItems = [
    { page: 'certs' as Page, icon: '📜', label: 'Сертификаты' },
    { page: 'accounts' as Page, icon: '🎫', label: 'Абонементы' },
    { page: 'homework' as Page, icon: '📝', label: 'Домашнее задание' },
    { page: 'diary' as Page, icon: '📓', label: 'Дневник' },
  ];

  // ============ RENDER LK ============
  return (
    <div className={styles.lkContainer}>
      <SiteHeader pageTitle="Личный кабинет" />
      
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* User info */}
        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar}>
            {user?.name ? user.name[0].toUpperCase() : '👤'}
          </div>
          <div className={styles.sidebarUserInfo}>
            <div className={styles.sidebarUserName}>{user?.name || 'Клиент'}</div>
            <div className={styles.sidebarUserPhone}>{user?.phone}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.sidebarNav}>
          <div className={styles.sidebarNavTitle}>Разделы</div>
          {navItems.map(item => (
            <button
              key={item.page}
              className={`${styles.sidebarNavItem}${page === item.page ? ` ${styles.active}` : ''}`}
              onClick={() => {
                if (item.page === 'visits') loadVisits(activePerson || undefined);
                else if (item.page === 'payments') loadPayments(activePerson || undefined);
                else if (item.page === 'dashboard') loadProfile(token!, 'dashboard');
                navigateTo(item.page);
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          {/* Accordion "В разработке" */}
          <div className={styles.sidebarAccordion}>
            <button
              className={styles.sidebarAccordionToggle}
              onClick={() => setAccordionOpen(!accordionOpen)}
            >
              <span>В разработке</span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`${styles.accordionChevron}${accordionOpen ? ` ${styles.open}` : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {accordionOpen && (
              <div className={`${styles.sidebarAccordionContent}${accordionOpen ? ` ${styles.open}` : ''}`}>
                {soonItems.map(item => (
                  <button
                    key={item.page}
                    className={`${styles.sidebarNavItem} ${styles.sidebarNavItemSoon}`}
                    onClick={() => navigateTo(item.page)}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Logout */}
        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>Выйти</button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.mainContent}>
        {page === 'login' && renderLogin()}
        {page === 'dashboard' && renderDashboard()}
        {page === 'visits' && renderVisits()}
        {page === 'payments' && renderPayments()}
        {page === 'certs' && renderPlaceholder('Сертификаты', '📜', 'Сертификаты — в разработке', [
          '📋 Номера', '💰 Остатки', '📅 История',
        ])}
        {page === 'accounts' && renderPlaceholder('Абонементы', '🎫', 'Абонементы — в разработке', [
          '📋 Номера', '📅 Даты', '📊 Остатки',
        ])}
        {page === 'homework' && renderPlaceholder('Домашнее задание', '📝', 'Домашнее задание — в разработке', [
          '📋 Задания', '✅ Выполнение', '💬 Комментарии',
        ])}
        {page === 'diary' && renderPlaceholder('Дневник самоконтроля', '📓', 'Дневник самоконтроля — в разработке', [
          '📏 Замеры тела', '📈 Графики прогресса', '😊 Самочувствие',
        ])}
      </main>

      <Footer />
      <CallModal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        reason={callReason}
      />
    </div>
  );
}
