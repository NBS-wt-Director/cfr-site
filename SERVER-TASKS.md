# СЕРВЕРНЫЕ ЗАДАЧИ (F12-F16)

> ⚠️ **Эти задачи касаются сервера, а не сайта.**
> **НЕ загружать в git.** Хранить локально.

---

## ТИКЕТ F12: Мессенджер balloo (Fix: Деплой мессенджера)

**Контекст:** Мессенджер — отдельный проект, на ~89% готовности, параллельный воркспейс.
Зона диска: `/data/messenger` (3.5 ТБ, уже отформатирован и примонтирован).

**Что нужно сделать:**
1. Склонировать проект мессенджера на сервер (путь уточнить у пользователя)
2. Поднять его БД в PostgreSQL (новая база `balloo`)
3. Настроить NGINX-конфиг для домена мессенджера
4. Запустить через PM2
5. Настроить автозапуск

**Критерии готовности:**
- [ ] Проект развёрнут
- [ ] БД создана
- [ ] Сайт работает
- [ ] Автозапуск настроен

---

## ТИКЕТ F13: Файловое хранилище (Fix: files.центр-фр.рф)

**Контекст:** Создать локальное файловое хранилище как Я.Диск. 2 поддомена:
- `files.центр-фр.рф`
- `creatorfd.balloo.su`

**Что нужно сделать:**

1. Создать LVM-том из свободного места на sda3 (системный диск, ~3.6 ТБ свободно в LVM-группе `ubuntu-vg`):
   ```bash
   sudo lvcreate -L 3T -n files ubuntu-vg
   sudo mkfs.ext4 /dev/ubuntu-vg/files
   sudo mkdir -p /srv/files
   sudo mount /dev/ubuntu-vg/files /srv/files
   # fstab
   echo '/dev/ubuntu-vg/files /srv/files ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
   ```

2. Развернуть файловое хранилище (FileBrowser / Nextcloud / custom):
   - Рекомендация: FileBrowser — лёгкий, веб-интерфейс, загрузка/скачивание/шаринг
   - Или Nextcloud — полноценный Я.Диск (тяжелее, требует PHP/Redis)
   - Выбор за пользователем

3. Настроить домены через NGINX + SSL (Let's Encrypt)

**Критерии готовности:**
- [ ] Том /srv/files создан и в fstab
- [ ] Файловый менеджер развёрнут
- [ ] Оба домена работают через HTTPS
- [ ] Автозапуск настроен

---

## ТИКЕТ F14: Безопасность сервера (Fix: Укрепление безопасности)

**Что нужно сделать:**

1. **UFW (фаервол):**
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw allow 5432/tcp from 127.0.0.1  # PG только локально
   sudo ufw enable
   ```

2. **Fail2ban (защита от брутфорса):**
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable --now fail2ban
   ```

3. **SSH:**
   - Отключить вход по паролю (PasswordAuthentication no)
   - Включить только ключи (PubkeyAuthentication yes)
   - Отключить root login (PermitRootLogin no)

4. **Автообновления:**
   ```bash
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure --priority=low unattended-upgrades
   ```

5. **Бэкапы db.json и БД:**
   - Ежедневный cron-бэкап db.json → /data/raid/backups/
   - Ежедневный pg_dump → /data/raid/backups/pg/

**Критерии готовности:**
- [ ] UFW включён, внешний доступ только 22/80/443
- [ ] PG порт недоступен снаружи
- [ ] Fail2ban активен
- [ ] SSH только по ключам
- [ ] Автообновления включены
- [ ] Бэкапы настроены и протестированы

---

## ТИКЕТ F15: Ollama + qwen2.5:14b (Fix: Установка Ollama)

**Контекст:** Модель для разработки Next.js, литературы и лекций. Выбрана qwen2.5:14b (Q4, ~9 ГБ RAM). RAM 125 ГБ — хватит.

**Что нужно сделать:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:14b
ollama run qwen2.5:14b  # тест
```

**Критерии готовности:**
- [ ] Ollama установлена и запущена
- [ ] Модель qwen2.5:14b скачана
- [ ] Отвечает на русском
- [ ] Автозапуск настроен

---

## ТИКЕТ F16: Модули Cockpit (Fix: Установка модулей)

**Контекст:** На сервере есть Cockpit (веб-панель). Нужно поставить модули.

**Что нужно сделать:**
```bash
sudo apt install -y cockpit-storaged cockpit-sosreport cockpit-scripts
```

**Критерии готовности:**
- [ ] cockpit-storaged — управление дисками через веб
- [ ] cockpit-sosreport — сбор отчётов
- [ ] cockpit-scripts — веб-терминал

---

## ПОСЛЕДОВАТЕЛЬНОСТЬ (сервер)

```
F12: Мессенджер balloo     🔴 ← МОЖНО ПАРАЛЛЕЛЬНО
F13: Файловое хранилище    🔴 ← ПОСЛЕ ДЕПЛОЯ САЙТА
F14: Безопасность          🔴 ← ПОСЛЕ ОСНОВНЫХ СЕРВИСОВ
F15: Ollama                🔴 ← ПОСЛЕДНИЙ
F16: Cockpit               🔴 ← ПОСЛЕДНИЙ
```

**НЕ НАЧИНАТЬ СЛЕДУЮЩИЙ ШАГ БЕЗ ПОДТВЕРЖДЕНИЯ.**

---

## ВАЖНО

- Эти задачи **НЕ относятся к сайту** (cfr-site)
- **НЕ загружать в git**
- Выполнять на сервере напрямую через SSH
- Координировать с пользователем перед каждым шагом
