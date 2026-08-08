# Тикет 6.3: Проверка соответствия итоговой БД проекту

> **Цель:** Проверить, что все 5 миграций (`001_initial.sql` → `005_clean.sql`) соответствуют
> проекту `данные/DB/new_format.md` строго по фактам. Ничего не потеряно, ничего не лишнее.

## Что проверяем

### 1. Таблицы (63 штуки)

Сопоставить каждую таблицу из `new_format.md` с CREATE TABLE в миграциях.

**cfr_* таблицы (из проекта):**
- [ ] cfr_persons — persons-центричная, все поля (site_user_id, ФИО, sex, birth_date, телефоны, email, avatar_url, parent_person_id_1/2, address, notes, status, created_at, updated_at)
- [ ] cfr_client_statuses — справочник статусов (id, name, slug, colour, description, sort_order)
- [ ] cfr_clients — 1:1 persons (person_id, agreement_number, barcode, archive, status_id, friend_person_id, id_foto, annotation, legacy_data, status)
- [ ] cfr_teachers — 1:1 persons (person_id, short_code, status, own_salary_options, own_second_salary_options, id_foto, image, experience, description, specialization, is_director, sort_order, record_status)
- [ ] cfr_teacher_photos — удалена в 004 (замещена cfr_media)
- [ ] cfr_media — универсальная (id, entity_type, entity_id, file_path, original_filename, caption, position, is_main, width, height, file_size, created_at, record_status)
- [ ] cfr_admins — CRM (person_id, login, password_hash, password_md5, is_root, rights, last_login_at, last_computer_id, admin_status, record_status)
- [ ] cfr_branches — филиалы (id, name, record_status, address, phone, email, website, hours, hall_ids, created_at)
- [ ] cfr_halls — залы (id, name, branch_id, hall_status, can_combine, floor_type, max_capacity, area_sqm, record_status)
- [ ] cfr_styles — программы+стили (id, name, client_name, description, type, record_status)
- [ ] cfr_tags — теги (id, name, colour, position, description, record_status — удалён в 004)
- [ ] cfr_informers — источники (id, name, record_status — удалён в 004)
- [ ] cfr_reservation_statuses — статусы брони (id, name, colour, position, description, record_status — удалён в 004)
- [ ] cfr_teacher_balance_types — типы баланса (id, name, slug, factor, annotation, record_status — удалён в 004)
- [ ] cfr_charges — статьи расходов (id, name, description, annotation, record_status — удалён в 004)
- [ ] cfr_products — товары (id, name, barcode, measurement, unit, product_status, purchase_cost, markup, markup_percent, annotation, record_status — удалён в 004)
- [ ] cfr_entities — единая таблица сущностей (id, entity_type, online_type, name, style_id, teacher_person_id, hall_id, branch_id, record_status, colour, max_capacity, price_per_session, created_at, updated_at)
- [ ] cfr_accounts — абонементы (id, number, person_id, entity_id, entity_type, account_type_name, account_type_cost, original_cost, discount, discount_percent, payment_type, create_date, begin_date, days_count, add_days_count, training_count, free_training_count, is_perpetual, is_unlimited, annotation, account_status, source, record_status, created_at, updated_at, legacy_data)
- [ ] cfr_visits — визиты (id, visit_date, person_id, entity_id, entity_type, branch_id, account_id, cost, payment_type, annotation, source, record_status, created_at, legacy_data + training_type_name + training_type_cost удалены в 004)
- [ ] cfr_reservations — бронирования (id, reservation_type, status_id, person_id, entity_id, entity_type, last_name, first_name, birth_date, mobile_phone, client_type, reservation_time, parent_last_name, parent_mobile_phone, comments, branch_id, record_status — ФИО/телефоны удалены в 004)
- [ ] cfr_schedule_changes — изменения расписания (id, entity_id, entity_type, change_time, change_type, change_date_time, new_date_time, reason, original_teacher_person_id, replacement_candidates, replacement_teacher_person_id, sum_type, record_status — удалён в 004)
- [ ] cfr_notes — заметки (id, text, closed, colour, note_date, close_date, record_status)
- [ ] cfr_tasks — задачи (id, text, closed, task_type, creator_person_id, closer_person_id, assignee_person_id, task_time, close_time, record_status)
- [ ] cfr_messages — сообщения (id, person_id, target, phone, text, msg_status, cost, message_time, record_status)
- [ ] cfr_client_tags — M:N клиенты↔теги (person_id, tag_id)
- [ ] cfr_client_informers — M:N клиенты↔источники (person_id, informer_id)
- [ ] cfr_group_clients — M:N состав групп (entity_id, entity_type, person_id, joined_at, left_at)
- [ ] cfr_teacher_styles — M:N тренеры↔стили (person_id, style_id)
- [ ] cfr_account_groups — M:N абонементы↔группы (account_id, group_id)
- [ ] cfr_card_uses — удалена в 004
- [ ] cfr_transactions — транзакции (id, person_id, transaction_type, amount, balance_after, account_id, visit_id, description, source, transaction_date, record_status)
- [ ] cfr_account_stages — этапы абонементов (id, account_id, stage_name, stage_data, sort_order, record_status)
- [ ] cfr_pages — страницы (id, slug, title, content, media, enabled, sort_order, record_status)
- [ ] cfr_contacts — контакты (id, type, value, label, sort_order, record_status)
- [ ] cfr_user_photos — удалена в 004 (замещена cfr_media)
- [ ] cfr_schedule_entries — расписание (id, entity_id, entity_type, day_of_week, start_time, end_time, hall_id, notes, branch_id, record_status)
- [ ] cfr_footer — настройки футера (id, enabled, show_contacts, show_social, show_copyright, show_dev_info, copyright_text, settings, updated_at, record_status)
- [ ] cfr_footer_links — ссылки футера (id, footer_id, text, href, position, record_status)
- [ ] cfr_footer_social — удалена в 004 (данные → cfr_footer_links)
- [ ] cfr_footer_menu — удалена в 004 (данные → cfr_footer_links)
- [ ] cfr_page_views — просмотры страниц (id, page, viewed_at)
- [ ] cfr_form_submissions — отправки форм (id, form_type, submitted_at)
- [ ] bridge_queue — очередь моста (id, file_name, file_hash, file_size, file_path, entity, content, status, records_count, error_msg, created_at, processed_at)
- [ ] cfr_schema_migrations — история миграций (id, version, name, success, applied_at)

**Старые таблицы сайта:**
- [ ] trainers — тренеры (id, image, name, experience, type, description, specialization, is_director, created_at, updated_at)
- [ ] trainer_photos — фото тренеров (id, trainer_id, image, caption, position)
- [ ] programs — программы (id, image, name, type, description)
- [ ] program_photos — фото программ (id, program_id, image, caption, position)
- [ ] program_trainers — тренеры программ (id, program_id, trainer_id, UNIQUE)
- [ ] program_workouts — тренировки программ (id, program_id, day, time, params)
- [ ] news — новости (id, image, title, text, description)
- [ ] sliders — слайдеры (id, title, image, interval, position)
- [ ] schedule_items — расписание (id, image)
- [ ] prices — цены (id, image)
- [ ] staff — сотрудники (id, name, image, role)
- [ ] sections — разделы (id, title, background, cols)
- [ ] workouts — тренировки (id, day, time, program_id, program_name, params, created_at)
- [ ] settings — настройки (id, key, value, created_at, updated_at)
- [ ] db_meta — метаданные (id, source, records, migrated_at)

**Таблицы ЛК:**
- [ ] users — пользователи (id, phone, password_hash, name, email, created_at)
- [ ] user_visits — посещения ЛК (id, user_id, program_id, visit_date, created_at)
- [ ] user_subscriptions — подписки ЛК (id, user_id, program_id, status, created_at, updated_at)
- [ ] user_payments — оплаты ЛК (id, user_id, amount, description, program_id, source, payment_date, created_at)

### 2. ENUM-типы (24 шт.)

- [ ] cfr_payment_type — 8 значений (cash, card, deposit, bonus, free, mixed, paid, prepayment, transfer)
- [ ] cfr_group_status — 4 (admission, active, closed, paused)
- [ ] cfr_hall_status — 2 (active, inactive)
- [ ] cfr_teacher_status — 3 (active, inactive, fired)
- [ ] cfr_product_status — 3 (active, inactive, discontinued)
- [ ] cfr_product_unit — 6 (piece, hour, minute, day, session, month)
- [ ] cfr_reservation_type — 3 (group, individual, rent)
- [ ] cfr_client_type — 2 (new, existing)
- [ ] cfr_tenant_type — 2 (client, external)
- [ ] cfr_reservation_status — 6 (confirmed, cancelled, pending, checked_in, no_show, waitlist)
- [ ] cfr_schedule_change_type — 3 (cancel, move, replace)
- [ ] cfr_sum_type — 4 (target, replacement, bonus, penalty)
- [ ] cfr_task_type — 5 (call, meeting, other, payment, notification)
- [ ] cfr_message_status — 5 (pending, sent, delivered, failed, auth_failed)
- [ ] cfr_message_target — 5 (sms, viber, whatsapp, telegram, email)
- [ ] cfr_transaction_type — 10 (deposit_add, deposit_use, deposit_refund, bonus_add, bonus_use, bonus_expire, payment, charge, refund, adjustment)
- [ ] cfr_entity_type — 6 (group, individual, massage, online, split, rent)
- [ ] cfr_online_type — 3 (online, offline, hybrid)
- [ ] cfr_bridge_packet_status — 5 (received, processing, completed, error, retry_pending)
- [ ] cfr_sex — 3 (male, female, other)
- [ ] cfr_record_status — 3 (normal, removed, archived)
- [ ] cfr_floor_type — 7 (резина, мат, дерево, металл, бетон, линолиум, комбинированно)
- [ ] cfr_account_status — 4 (active, expired, frozen, cancelled)
- [ ] cfr_media_entity_type — 13 (teacher, hall, person, style, entity, news, slider, page, program, product, branch, client, reservation)

### 3. Индексы (28 шт.)

- [ ] idx_persons_phone, idx_persons_email, idx_persons_site_user, idx_persons_name
- [ ] idx_media_entity, idx_media_position, idx_media_main
- [ ] idx_entities_type, idx_entities_teacher, idx_entities_style, idx_entities_hall
- [ ] idx_accounts_person, idx_accounts_entity
- [ ] idx_visits_person, idx_visits_date, idx_visits_person_date, idx_visits_entity, idx_visits_account
- [ ] idx_bridge_queue_status, idx_bridge_queue_created
- [ ] idx_page_views_page
- [ ] idx_form_submissions_type
- [ ] idx_users_phone
- [ ] idx_user_visits_user, idx_user_visits_date
- [ ] idx_user_subs_user
- [ ] idx_user_payments_user, idx_user_payments_date

### 4. Функции (7 шт.)

- [ ] cfr_check_main_media() — триггерная, защита is_main
- [ ] cfr_reorder_media() — смена позиции медиа
- [ ] process_bridge_queue() — обработка очереди моста
- [ ] bridge_insert_client() — перенос клиента из моста
- [ ] bridge_insert_teacher() — перенос тренера из моста
- [ ] bridge_insert_visit() — перенос визита из моста
- [ ] bridge_insert_account() — перенос абонемента из моста
- [ ] cfr_find_replacement_candidates() — подбор кандидатов на замену
- [ ] cfr_auto_cancel_no_candidates() — автоотмена при отсутствии кандидатов
- [ ] cfr_sanitize_text() — очистка от XSS

### 5. Триггеры (8 шт.)

- [ ] trg_check_main_media — защита is_main (BEFORE INSERT OR UPDATE ON cfr_media)
- [ ] trg_auto_cancel_no_candidates — автоотмена (BEFORE INSERT OR UPDATE ON cfr_schedule_changes)
- [ ] trg_xss_clean_persons — XSS-защита (BEFORE INSERT OR UPDATE ON cfr_persons)
- [ ] trg_xss_clean_notes — XSS-защита (BEFORE INSERT OR UPDATE ON cfr_notes)
- [ ] trg_xss_clean_messages — XSS-защита (BEFORE INSERT OR UPDATE ON cfr_messages)
- [ ] trg_xss_clean_tasks — XSS-защита (BEFORE INSERT OR UPDATE ON cfr_tasks)
- [ ] trg_xss_clean_reservations — XSS-защита (BEFORE INSERT OR UPDATE ON cfr_reservations)

### 6. Заполнение справочников

Проверить, что в миграциях есть seed-данные:
- [ ] cfr_branches — хотя бы 1 запись
- [ ] cfr_footer — 1 запись
- [ ] cfr_footer_links — ссылки из футера
- [ ] cfr_contacts — контакты
- [ ] cfr_client_statuses — базовые статусы
- [ ] settings — базовые настройки

### 7. Соответствие проекту new_format.md

- [ ] Все таблицы из раздела 2-13 проекта созданы
- [ ] Все поля соответствуют описанию (типы, nullable, defaults)
- [ ] Все FK указаны правильно
- [ ] Все ENUM из раздела 2 проекта созданы
- [ ] Все индексы из проекта созданы
- [ ] Все триггеры из проекта созданы
- [ ] Все функции из проекта созданы
- [ ] legacy_data TEXT (не JSONB!) — добавлена в 3 таблицы
- [ ] bridge_queue — единственная таблица с JSONB
- [ ] cfr_footer объединён (social+menu → links)

### 8. Покрытие донора

- [ ] Все 31 сущность донора покрыта
- [ ] Дубликаты удалены (8 шт.)
- [ ] Уникальные данные → legacy_data (3 таблицы)
- [ ] Rent (73 записи) сохранён
- [ ] Пустые сущности (DayBalance, Param, Passport, TablesSummary, TeacherBalance) учтены

---

## Команда для запуска

```bash
Прочитай документ cfr-site/MULTITICKET-DANCESTUDIO.md и выполни тикет 6.3
```