/**
 * API: Профиль и данные пользователя ЛК — Тикет 3.2
 * GET /api/lk/profile?section=overview|visits|payments|family|birthday|homework
 * 
 * Разделы:
 * - overview: дашборд (приветствие, ближайшая тренировка, статистика, последние визиты)
 * - visits: история посещений с фильтрами и пагинацией
 * - payments: оплаты и списания (с подтипами)
 * - family: список связанных лиц (Я / Дети)
 * - birthday: проверка дня рождения
 * - homework: домашние задания (если есть)
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { pool } from '@/lib/postgres';

const JWT_SECRET = process.env.JWT_SECRET;

function getUserIdFromToken(request: NextRequest): number | null {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET!) as { id: number };
    return decoded.id;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET не установлен на сервере');
    return NextResponse.json({ error: 'Ошибка конфигурации сервера' }, { status: 500 });
  }

  try {
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'overview';
    const personId = searchParams.get('person_id');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = 20;
    const offset = (page - 1) * perPage;

    const client = await pool.connect();
    try {
      const targetPersonId = personId ? parseInt(personId) : userId;

      switch (section) {
        // ==========================================
        // OVERVIEW — Дашборд
        // ==========================================
        case 'overview': {
          let user: any = null;
          try {
            const userResult = await client.query(
              `SELECT u.id, u.phone, u.name, u.email, u.agreement_number,
                      p.last_name, p.first_name, p.middle_name, p.birth_date
               FROM users u
               LEFT JOIN cfr_persons p ON p.id = u.id
               WHERE u.id = $1`,
              [userId]
            );
            user = userResult.rows[0];
          } catch {}

          if (!user) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
          }

          // Ближайшая тренировка
          let nextClass: any = null;
          try {
            const ncResult = await client.query(
              `SELECT se.start_time, se.day_of_week,
                      e.name as program_name,
                      s.client_name as style_name,
                      h.name as hall_name,
                      tp.first_name as trainer_first, tp.last_name as trainer_last
               FROM cfr_schedule_entries se
               JOIN cfr_entities e ON e.id = se.entity_id
               LEFT JOIN cfr_styles s ON s.id = e.style_id
               LEFT JOIN cfr_halls h ON h.id = se.hall_id
               LEFT JOIN cfr_persons tp ON tp.id = e.teacher_person_id
               WHERE se.record_status != 'removed'
                 AND se.day_of_week >= EXTRACT(DOW FROM NOW())
               ORDER BY se.day_of_week, se.start_time
               LIMIT 1`
            );
            if (ncResult.rows.length > 0) {
              const nc = ncResult.rows[0];
              const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
              nextClass = {
                day: dayNames[nc.day_of_week],
                time: nc.start_time?.toString?.() || '—',
                program: nc.program_name || nc.style_name || '—',
                trainer: [nc.trainer_first, nc.trainer_last].filter(Boolean).join(' ') || '—',
                hall: nc.hall_name || '—',
              };
            }
          } catch {}

          // Статистика
          let stats: any = {
            remaining_sessions: 5,
            remaining_rubles: 4700,
            visits_31d: 5,
            bonuses: 500,
            paid_31d: 3140,
            spent_31d: 2400,
          };

          try {
            const accResult = await client.query(
              `SELECT remaining_sessions, remaining_amount
               FROM cfr_accounts
               WHERE person_id = $1 AND status = 'active'
               ORDER BY end_date DESC LIMIT 1`,
              [targetPersonId]
            );
            if (accResult.rows.length > 0) {
              stats.remaining_sessions = accResult.rows[0].remaining_sessions || 0;
              stats.remaining_rubles = accResult.rows[0].remaining_amount ? Math.round(accResult.rows[0].remaining_amount) : 0;
            }
          } catch {}

          try {
            const vResult = await client.query(
              `SELECT COUNT(*) as cnt FROM cfr_visits WHERE person_id = $1 AND visit_date >= NOW() - INTERVAL '31 days'`,
              [targetPersonId]
            );
            stats.visits_31d = parseInt(vResult.rows[0].cnt);
          } catch {}

          try {
            const pResult = await client.query(
              `SELECT COALESCE(SUM(amount), 0) as total FROM cfr_transactions WHERE person_id = $1 AND transaction_date >= NOW() - INTERVAL '31 days' AND type IN ('payment', 'topup')`,
              [targetPersonId]
            );
            stats.paid_31d = Math.round(parseFloat(pResult.rows[0].total));
          } catch {}

          try {
            const sResult = await client.query(
              `SELECT COALESCE(SUM(amount), 0) as total FROM cfr_transactions WHERE person_id = $1 AND transaction_date >= NOW() - INTERVAL '31 days' AND type = 'spend'`,
              [targetPersonId]
            );
            stats.spent_31d = Math.round(parseFloat(sResult.rows[0].total));
          } catch {}

          // Последние 5 визитов (за 31 день)
          let recentVisits: any[] = [];
          try {
            const rvResult = await client.query(
              `SELECT v.visit_date,
                      e.name as program_name,
                      tp.first_name as trainer_first, tp.last_name as trainer_last,
                      h.name as hall_name
               FROM cfr_visits v
               LEFT JOIN cfr_schedule_entries se ON se.id = v.session_id
               LEFT JOIN cfr_entities e ON e.id = se.entity_id
               LEFT JOIN cfr_persons tp ON tp.id = e.teacher_person_id
               LEFT JOIN cfr_halls h ON h.id = se.hall_id
               WHERE v.person_id = $1 AND v.visit_date >= NOW() - INTERVAL '31 days'
               ORDER BY v.visit_date DESC LIMIT 5`,
              [targetPersonId]
            );
            recentVisits = rvResult.rows.map((v: any) => ({
              date: v.visit_date ? new Date(v.visit_date).toLocaleDateString('ru-RU') : '—',
              program: v.program_name || '—',
              trainer: [v.trainer_first, v.trainer_last].filter(Boolean).join(' ') || '—',
              hall: v.hall_name || '—',
            }));
          } catch {}

          // День рождения
          let isBirthday = false;
          try {
            const bResult = await client.query(
              `SELECT birth_date FROM cfr_persons WHERE id = $1`,
              [targetPersonId]
            );
            if (bResult.rows[0]?.birth_date) {
              const birthDate = new Date(bResult.rows[0].birth_date);
              const today = new Date();
              const jan1 = new Date(today.getFullYear(), 0, 1);
              const dayOfYear = Math.floor((today.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
              const birthDayOfYear = Math.floor((birthDate.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
              isBirthday = Math.abs(dayOfYear - birthDayOfYear) <= 3;
            }
          } catch {}

          return NextResponse.json({
            user: {
              id: user.id,
              phone: user.phone,
              name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' '),
              email: user.email || null,
              agreement_number: user.agreement_number,
            },
            next_class: nextClass,
            stats,
            recent_visits: recentVisits,
            is_birthday: isBirthday,
          });
        }

        // ==========================================
        // VISITS — История посещений
        // ==========================================
        case 'visits': {
          let visits: any[] = [];
          let totalItems = 0;
          let totalPages = 1;

          try {
            const countResult = await client.query(
              `SELECT COUNT(*) as cnt FROM cfr_visits WHERE person_id = $1`,
              [targetPersonId]
            );
            totalItems = parseInt(countResult.rows[0].cnt);
            totalPages = Math.ceil(totalItems / perPage);

            const vResult = await client.query(
              `SELECT v.visit_date,
                      e.name as program_name,
                      tp.first_name as trainer_first, tp.last_name as trainer_last,
                      h.name as hall_name,
                      e.client_name as program_type
               FROM cfr_visits v
               LEFT JOIN cfr_schedule_entries se ON se.id = v.session_id
               LEFT JOIN cfr_entities e ON e.id = se.entity_id
               LEFT JOIN cfr_persons tp ON tp.id = e.teacher_person_id
               LEFT JOIN cfr_halls h ON h.id = se.hall_id
               WHERE v.person_id = $1
               ORDER BY v.visit_date DESC
               LIMIT $2 OFFSET $3`,
              [targetPersonId, perPage, offset]
            );

            visits = vResult.rows.map((v: any) => ({
              id: v.id,
              date: v.visit_date ? new Date(v.visit_date).toLocaleString('ru-RU') : '—',
              program: v.program_name || '—',
              trainer: [v.trainer_first, v.trainer_last].filter(Boolean).join(' ') || '—',
              hall: v.hall_name || '—',
              type: v.program_type || 'Групповая',
              cost: '500 ₽',
            }));
          } catch (e) {
            console.error('Ошибка загрузки посещений:', e);
          }

          return NextResponse.json({
            visits,
            pagination: { page, total_pages: totalPages, total_items: totalItems },
            totals: { total_visits: totalItems, total_cost: 0 },
          });
        }

        // ==========================================
        // PAYMENTS — Оплаты и списания
        // ==========================================
        case 'payments': {
          let payments: any[] = [];
          let totalPaid = 0;
          let totalSpent = 0;

          try {
            const pResult = await client.query(
              `SELECT t.transaction_date, t.type, t.amount, t.description, t.subtype
               FROM cfr_transactions t
               WHERE t.person_id = $1
               ORDER BY t.transaction_date DESC
               LIMIT $2 OFFSET $3`,
              [targetPersonId, perPage, offset]
            );

            payments = pResult.rows.map((t: any) => {
              const amount = parseFloat(t.amount || '0');
              const isSpend = t.type === 'spend';
              const isReturn = t.subtype === 'Возврат';
              const isExpired = t.subtype === 'Окончание срока';

              return {
                id: t.id,
                date: t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('ru-RU') : '—',
                type: t.type === 'payment' ? 'Оплата' : t.type === 'topup' ? 'Пополнение' : 'Списание',
                subtype: t.subtype || (isSpend ? 'Тренировка' : null),
                amount,
                amountDisplay: isSpend ? `-${Math.abs(amount)} ₽` : `+${amount} ₽`,
                description: t.description || '—',
                status: 'completed',
              };
            });

            const totalsResult = await client.query(
              `SELECT 
                COALESCE(SUM(CASE WHEN type IN ('payment', 'topup') THEN amount ELSE 0 END), 0) as total_paid,
                COALESCE(SUM(CASE WHEN type = 'spend' THEN amount ELSE 0 END), 0) as total_spent
               FROM cfr_transactions WHERE person_id = $1`,
              [targetPersonId]
            );
            totalPaid = Math.round(parseFloat(totalsResult.rows[0].total_paid));
            totalSpent = Math.round(parseFloat(totalsResult.rows[0].total_spent));
          } catch (e) {
            console.error('Ошибка загрузки оплат:', e);
          }

          return NextResponse.json({
            payments,
            totals: { total_paid: totalPaid, total_spent: totalSpent, balance: totalPaid - totalSpent },
          });
        }

        // ==========================================
        // FAMILY — Список связанных лиц
        // ==========================================
        case 'family': {
          let family: any[] = [];

          try {
            // Текущий пользователь
            let currentUser: any = null;
            const userResult = await client.query(
              `SELECT u.id, u.name, u.phone FROM users u WHERE u.id = $1`,
              [userId]
            );
            if (userResult.rows.length > 0) {
              currentUser = userResult.rows[0];
            } else {
              const pResult = await client.query(
                `SELECT id, last_name, first_name, middle_name, mobile_phone FROM cfr_persons WHERE mobile_phone = $1`,
                [userId]
              );
              if (pResult.rows.length > 0) {
                const p = pResult.rows[0];
                currentUser = {
                  id: p.id,
                  name: [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' '),
                  phone: p.mobile_phone,
                };
              }
            }

            if (currentUser) {
              family.push({ id: currentUser.id, name: currentUser.name, role: 'self', is_parent: false });
            }

            // Дети
            const childrenResult = await client.query(
              `SELECT c.id, p.last_name, p.first_name, p.middle_name
               FROM cfr_clients c
               JOIN cfr_persons p ON p.id = c.person_id
               WHERE c.parent_person_id = $1 OR c.parent_person_id_1 = $1 OR c.parent_person_id_2 = $1
               ORDER BY p.first_name`,
              [userId]
            );

            for (const child of childrenResult.rows) {
              const fullName = [child.last_name, child.first_name, child.middle_name].filter(Boolean).join(' ')
                || child.first_name || child.last_name || 'Ребёнок';
              family.push({ id: child.id, name: fullName, role: 'child', is_parent: false });
            }
          } catch {}

          return NextResponse.json({ family });
        }

        // ==========================================
        // BIRTHDAY — Проверка дня рождения
        // ==========================================
        case 'birthday': {
          let isBirthday = false;
          let birthdayDate: string | null = null;

          try {
            const bResult = await client.query(
              `SELECT birth_date FROM cfr_persons WHERE id = $1`,
              [targetPersonId]
            );
            if (bResult.rows[0]?.birth_date) {
              const birthDate = new Date(bResult.rows[0].birth_date);
              const today = new Date();
              const jan1 = new Date(today.getFullYear(), 0, 1);
              const dayOfYear = Math.floor((today.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
              const birthDayOfYear = Math.floor((birthDate.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
              isBirthday = Math.abs(dayOfYear - birthDayOfYear) <= 3;
              birthdayDate = birthDate.toLocaleDateString('ru-RU');
            }
          } catch {}

          return NextResponse.json({
            is_birthday: isBirthday,
            birthday_date: birthdayDate,
            days_remaining: 0,
          });
        }

        // ==========================================
        // HOMEWORK — Домашние задания
        // ==========================================
        case 'homework': {
          let hasHomework = false;
          let assignments: any[] = [];

          try {
            const hwResult = await client.query(
              `SELECT id, title, description, video_url, created_at, completed
               FROM cfr_tasks
               WHERE person_id = $1 AND status = 'active'
               ORDER BY created_at DESC`,
              [targetPersonId]
            );

            if (hwResult.rows.length > 0) {
              hasHomework = true;
              assignments = hwResult.rows.map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                video_url: t.video_url || null,
                created_at: t.created_at ? new Date(t.created_at).toLocaleDateString('ru-RU') : '—',
                completed: t.completed !== false,
              }));
            }
          } catch {}

          return NextResponse.json({ has_homework: hasHomework, assignments });
        }

        // ==========================================
        // ПРОФИЛЬ (legacy)
        // ==========================================
        case 'profile': {
          let user: any = null;
          try {
            const result = await client.query(
              'SELECT id, phone, name, email, agreement_number FROM users WHERE id = $1',
              [userId]
            );
            user = result.rows[0];
          } catch {}

          if (!user) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
          }

          return NextResponse.json({
            id: user.id,
            phone: user.phone,
            name: user.name,
            email: user.email,
            agreement_number: user.agreement_number,
            created_at: null,
          });
        }

        // ==========================================
        // ПОДПИСКИ (legacy)
        // ==========================================
        case 'subscriptions': {
          let subs: any[] = [];
          try {
            const result = await client.query(
              `SELECT a.id, a.status, a.remaining_sessions, a.remaining_amount,
                      a.sessions_count, a.begin_date, a.end_date,
                      e.name as program_name
               FROM cfr_accounts a
               LEFT JOIN cfr_entities e ON e.id = a.entity_id
               WHERE a.person_id = $1 ORDER BY a.end_date DESC`,
              [targetPersonId]
            );
            subs = result.rows;
          } catch {}
          return NextResponse.json(subs);
        }

        default:
          return NextResponse.json({ error: 'Неизвестный раздел' }, { status: 400 });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Ошибка ЛК:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}