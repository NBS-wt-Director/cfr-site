/**
 * Обёртка над PostgreSQL для новой схемы DanceStudio (cfr_*)
 * Возвращает данные в старом формате { trainers, programs, news, ... }
 * для обратной совместимости с фронтендом.
 */

import pool from './postgres';

// ============================================
// ТРЕНЕРЫ (cfr_teachers + cfr_persons + cfr_media)
// ============================================

export async function getAllTrainers() {
  const client = await pool.connect();
  try {
    // Тренеры
    const teachers = await client.query(`
      SELECT t.person_id, t.short_code, t.status, t.image, t.experience,
             t.description, t.specialization, t.is_director, t.sort_order,
             p.last_name, p.first_name, p.middle_name, p.mobile_phone, p.avatar_url
      FROM cfr_teachers t
      JOIN cfr_persons p ON p.id = t.person_id
      WHERE p.status != 'removed' AND t.record_status != 'removed'
      ORDER BY t.sort_order, p.last_name, p.first_name
    `);

    // Фото тренеров (из cfr_media)
    const photos = await client.query(`
      SELECT entity_id, file_path, caption, position, width, height, file_size
      FROM cfr_media
      WHERE entity_type = 'teacher' AND record_status != 'removed'
      ORDER BY entity_id, position
    `);

    // Группируем фото по тренеру
    const photoMap: Record<string, any[]> = {};
    for (const p of photos.rows) {
      if (!photoMap[p.entity_id]) photoMap[p.entity_id] = [];
      photoMap[p.entity_id].push({
        image: p.file_path,
        caption: p.caption || '',
        width: p.width,
        height: p.height,
      });
    }

    // Стили тренеров
    const teacherStyles = await client.query(`
      SELECT person_id, style_id FROM cfr_teacher_styles
    `);
    const styleMap: Record<string, number[]> = {};
    for (const ts of teacherStyles.rows) {
      if (!styleMap[ts.person_id]) styleMap[ts.person_id] = [];
      styleMap[ts.person_id].push(Number(ts.style_id));
    }

    const styles = await client.query(`SELECT id, name, client_name FROM cfr_styles WHERE record_status != 'removed'`);
    const styleNameMap: Record<number, string> = {};
    for (const s of styles.rows) {
      styleNameMap[s.id] = s.client_name || s.name;
    }

    return teachers.rows.map((t: any) => {
      const fullName = [t.last_name, t.first_name, t.middle_name].filter(Boolean).join(' ');
      const photoAlbum = photoMap[t.person_id] || [];
      const styleNames = (styleMap[t.person_id] || []).map((sid: number) => styleNameMap[sid]).filter(Boolean);

      return {
        id: t.person_id,
        name: fullName || t.first_name || 'Без имени',
        short_code: t.short_code,
        experience: t.experience || '',
        type: t.specialization || 'trainer',
        description: t.description || '',
        specialization: t.specialization || '',
        isDirector: t.is_director || false,
        phone: t.mobile_phone || '',
        image: t.avatar_url || t.image || '',
        photoAlbum,
        styles: styleNames,
        status: t.status,
      };
    });
  } finally {
    client.release();
  }
}

// ============================================
// ПРОГРАММЫ / СТИЛИ (cfr_entities + cfr_styles + cfr_schedule_entries)
// ============================================

export async function getAllPrograms() {
  const client = await pool.connect();
  try {
    // Группы (entities типа 'group')
    const entities = await client.query(`
      SELECT e.id, e.name, e.entity_type, e.online_type, e.colour, e.max_capacity,
             e.price_per_session, e.style_id, e.teacher_person_id, e.hall_id, e.branch_id,
             s.name as style_name, s.client_name as style_client_name,
             p.last_name, p.first_name
      FROM cfr_entities e
      LEFT JOIN cfr_styles s ON s.id = e.style_id
      LEFT JOIN cfr_persons p ON p.id = e.teacher_person_id
      WHERE e.entity_type = 'group' AND e.record_status != 'removed'
      ORDER BY e.name
    `);

    // Расписание
    const schedule = await client.query(`
      SELECT entity_id, entity_type, day_of_week, start_time, end_time,
             hall_id, notes, branch_id
      FROM cfr_schedule_entries
      WHERE record_status != 'removed'
      ORDER BY entity_id, day_of_week, start_time
    `);

    // Группируем расписание по entity
    const scheduleMap: Record<string, any[]> = {};
    for (const s of schedule.rows) {
      if (!scheduleMap[s.entity_id]) scheduleMap[s.entity_id] = [];
      const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
      scheduleMap[s.entity_id].push({
        day: dayNames[s.day_of_week] || String(s.day_of_week),
        dayOfWeek: s.day_of_week,
        time: `${s.start_time?.toString?.() || ''} - ${s.end_time?.toString?.() || ''}`,
        startTime: s.start_time,
        endTime: s.end_time,
        hall_id: s.hall_id,
        notes: s.notes,
        branch_id: s.branch_id,
      });
    }

    // Состав групп (кто записан)
    const groupClients = await client.query(`
      SELECT entity_id, entity_type, person_id, joined_at, left_at
      FROM cfr_group_clients
      WHERE left_at IS NULL
      ORDER BY entity_id, joined_at
    `);
    const clientMap: Record<string, string[]> = {};
    for (const gc of groupClients.rows) {
      if (!clientMap[gc.entity_id]) clientMap[gc.entity_id] = [];
      clientMap[gc.entity_id].push(gc.person_id);
    }

    // Имена клиентов
    const personIds = [...new Set(groupClients.rows.map((gc: any) => gc.person_id))];
    let clientNames: Record<string, string> = {};
    if (personIds.length > 0) {
      const persons = await client.query(
        `SELECT id, last_name, first_name FROM cfr_persons WHERE id = ANY($1)`,
        [personIds]
      );
      for (const p of persons.rows) {
        clientNames[p.id] = [p.last_name, p.first_name].filter(Boolean).join(' ');
      }
    }

    return entities.rows.map((e: any) => {
      const clients = (clientMap[e.id] || []).map((pid: string) => clientNames[pid] || pid);
      const entitySchedule = scheduleMap[e.id] || [];

      return {
        id: e.id,
        name: e.name || 'Без названия',
        type: e.style_client_name || e.style_name || 'Группа',
        description: e.name || '',
        image: '', // из cfr_media
        style_id: e.style_id,
        style_name: e.style_name || '',
        teacher_id: e.teacher_person_id,
        teacher_name: [e.last_name, e.first_name].filter(Boolean).join(' ') || null,
        hall_id: e.hall_id,
        branch_id: e.branch_id,
        max_capacity: e.max_capacity,
        price_per_session: e.price_per_session?.toString?.() || '0',
        colour: e.colour,
        online_type: e.online_type,
        schedule: entitySchedule,
        clients,
        photoAlbum: [],
        workouts: entitySchedule.map((s: any) => ({
          day: s.day,
          time: s.time,
          params: [],
        })),
        trainings: [],
        reviews: [],
      };
    });
  } finally {
    client.release();
  }
}

// ============================================
// НОВОСТИ (cfr_media entity_type='news')
// ============================================

export async function getAllNews() {
  const client = await pool.connect();
  try {
    const news = await client.query(`
      SELECT id, file_path, caption, position, width, height, file_size, created_at
      FROM cfr_media
      WHERE entity_type = 'news' AND record_status != 'removed'
      ORDER BY position, created_at DESC
    `);

    return news.rows.map((n: any) => ({
      id: n.id,
      image: n.file_path,
      title: n.caption || '',
      text: '',
      description: '',
    }));
  } finally {
    client.release();
  }
}

// ============================================
// СОТРУДНИКИ (cfr_teachers + cfr_persons, все тренеры)
// ============================================

export async function getAllEmployees() {
  return getAllTrainers();
}

// ============================================
// ТРЕНИРОВКИ (из расписания групп)
// ============================================

export async function getAllWorkouts() {
  const client = await pool.connect();
  try {
    const schedule = await client.query(`
      SELECT e.id as entity_id, e.name as entity_name,
             s.day_of_week, s.start_time, s.end_time,
             s.hall_id, s.notes, s.branch_id,
             sty.client_name as style_name
      FROM cfr_schedule_entries s
      JOIN cfr_entities e ON e.id = s.entity_id
      LEFT JOIN cfr_styles sty ON sty.id = e.style_id
      WHERE s.record_status != 'removed' AND e.entity_type = 'group'
      ORDER BY s.day_of_week, s.start_time
    `);

    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

    return schedule.rows.map((s: any) => ({
      id: `${s.entity_id}-${s.day_of_week}`,
      day: dayNames[s.day_of_week] || String(s.day_of_week),
      time: `${s.start_time?.toString?.() || ''} - ${s.end_time?.toString?.() || ''}`,
      programId: s.entity_id,
      programName: s.entity_name || '',
      params: [],
      styleName: s.style_name || '',
      hall_id: s.hall_id,
      branch_id: s.branch_id,
    }));
  } finally {
    client.release();
  }
}

// ============================================
// СТРАНИЦЫ (cfr_pages)
// ============================================

export async function getAllPages() {
  const client = await pool.connect();
  try {
    const pages = await client.query(`
      SELECT id, slug, title, content, media, enabled, sort_order, record_status
      FROM cfr_pages
      ORDER BY sort_order, id
    `);

    return pages.rows.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content || '',
      media: p.media || '',
      enabled: p.enabled !== false,
      sort_order: p.sort_order || 0,
    }));
  } finally {
    client.release();
  }
}

export async function getPageBySlug(slug: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, slug, title, content, media, enabled, sort_order
       FROM cfr_pages WHERE slug = $1 AND enabled = true`,
      [slug]
    );
    if (result.rows.length === 0) return null;
    const p = result.rows[0];
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content || '',
      media: p.media || '',
      enabled: p.enabled !== false,
      sort_order: p.sort_order || 0,
    };
  } finally {
    client.release();
  }
}

// ============================================
// КОНТАКТЫ (cfr_contacts)
// ============================================

export async function getAllContacts() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, type, value, label, sort_order
      FROM cfr_contacts
      WHERE record_status != 'removed'
      ORDER BY sort_order
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

// ============================================
// ФИТЕР (cfr_footer + cfr_footer_links/social/menu)
// ============================================

export async function getFooter() {
  const client = await pool.connect();
  try {
    const footerResult = await client.query(`
      SELECT enabled, show_contacts, show_social, show_copyright, show_dev_info,
             copyright_text, settings
      FROM cfr_footer WHERE id = 1
    `);

    const linksResult = await client.query(`
      SELECT text, href, position FROM cfr_footer_links
      WHERE footer_id = 1 AND record_status != 'removed'
      ORDER BY position
    `);

    const socialResult = await client.query(`
      SELECT social_id, title, url, position FROM cfr_footer_social
      WHERE footer_id = 1 AND record_status != 'removed'
      ORDER BY position
    `);

    const menuResult = await client.query(`
      SELECT text, href, enabled, position FROM cfr_footer_menu
      WHERE footer_id = 1 AND record_status != 'removed'
      ORDER BY position
    `);

    const footer = footerResult.rows[0] || {};
    return {
      ...footer,
      links: linksResult.rows,
      social: socialResult.rows,
      menu: menuResult.rows.filter((m: any) => m.enabled !== false),
    };
  } finally {
    client.release();
  }
}

// ============================================
// ЗАПИСЬ СТАТИСТИКИ (cfr_pages views)
// ============================================

export async function recordPageView(page: string) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO cfr_page_views (page, viewed_at) VALUES ($1, NOW())`,
      [page]
    );
  } finally {
    client.release();
  }
}

export async function getPageViews(limit = 100) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT page, COUNT(*) as count, MAX(viewed_at) as last_viewed
      FROM cfr_page_views
      GROUP BY page
      ORDER BY count DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getFormSubmissions(limit = 100) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT form_type, COUNT(*) as count, MAX(submitted_at) as last_submitted
      FROM cfr_form_submissions
      GROUP BY form_type
      ORDER BY count DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  } finally {
    client.release();
  }
}

// ============================================
// ЗАПИСИ ПОЛЬЗОВАТЕЛЕЙ (users)
// ============================================

export async function getUserByIdPg(id: number) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, phone, name, email, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

// ============================================
// ЗАГРУЗКА ВСЕХ ДАННЫХ В СТАРОМ ФОРМАТЕ
// ============================================

export async function loadAllFromPg(): Promise<Record<string, any>> {
  const [trainers, programs, news, employees, workouts, pages, contacts, footer] =
    await Promise.all([
      getAllTrainers(),
      getAllPrograms(),
      getAllNews(),
      getAllEmployees(),
      getAllWorkouts(),
      getAllPages(),
      getAllContacts(),
      getFooter(),
    ]);

  return {
    trainers,
    programs,
    news,
    staff: [],
    employees,
    workouts,
    pages,
    contacts,
    footer,
    schedule: [],
    prices: [],
    sections: [],
    sliders: [],
    visits: [],
    mediaUsage: 0,
    defaultInterval: 5,
  };
}

// ============================================
// СОХРАНЕНИЕ В НОВУЮ СХЕМУ (из старого формата)
// ============================================

export async function saveAllToPg(data: Record<string, any>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Тренеры → cfr_persons + cfr_teachers
    const trainers = data.trainers || [];
    for (const t of trainers) {
      // persons
      const nameParts = (t.name || '').split(' ');
      const lastName = nameParts[0] || '';
      const firstName = nameParts[1] || '';
      const middleName = nameParts.slice(2).join(' ') || '';

      const personResult = await client.query(
        `INSERT INTO cfr_persons (last_name, first_name, middle_name, mobile_phone, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [lastName, firstName, middleName, t.phone || null, t.image || null]
      );

      let personId = personResult.rows[0]?.id;
      if (!personId) {
        // Уже существует — ищем по phone
        const findResult = await client.query(
          'SELECT id FROM cfr_persons WHERE mobile_phone = $1',
          [t.phone]
        );
        personId = findResult.rows[0]?.id;
      }

      if (personId) {
        await client.query(
          `INSERT INTO cfr_teachers (person_id, short_code, status, image, experience,
                                    description, specialization, is_director, sort_order, record_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'normal')
           ON CONFLICT (person_id) DO UPDATE SET
             short_code = EXCLUDED.short_code, status = EXCLUDED.status,
             image = EXCLUDED.image, experience = EXCLUDED.experience,
             description = EXCLUDED.description, specialization = EXCLUDED.specialization,
             is_director = EXCLUDED.is_director, sort_order = EXCLUDED.sort_order`,
          [personId, t.short_code || null, 'active', t.image || null,
           t.experience || null, t.description || null, t.specialization || null,
           t.isDirector || false, t.id || 0]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ saveAllToPg error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// ============================================
// ПОДСЧЁТ ЗАПИСЕЙ
// ============================================

export async function getTableCounts() {
  const client = await pool.connect();
  try {
    const tables = [
      'cfr_persons', 'cfr_clients', 'cfr_teachers', 'cfr_media',
      'cfr_styles', 'cfr_halls', 'cfr_branches', 'cfr_entities',
      'cfr_accounts', 'cfr_visits', 'cfr_reservations',
      'cfr_schedule_entries', 'cfr_transactions', 'cfr_tasks',
      'cfr_messages', 'cfr_pages', 'cfr_contacts',
      'users', 'user_visits', 'user_payments', 'user_subscriptions',
      'bridge_queue',
    ];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
        counts[table] = parseInt(result.rows[0].cnt, 10);
      } catch {
        counts[table] = 0;
      }
    }
    return counts;
  } finally {
    client.release();
  }
}

export { pool };
