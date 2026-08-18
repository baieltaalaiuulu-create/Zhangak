# 🤖 Руководство по передаче проекта ИИ-Агенту (AI Agent Handoff Guide)

> **Актуальная передача на 2026-08-19:** для продолжения проекта Claude или
> другим агентом сначала используйте `docs/development/CLAUDE_HANDOFF.md`.
> Этот документ сохранён как общий исторический guide и может содержать
> устаревшие количества миграций или проверок.

**Статус проекта:** Preprod Release
**Версия документации:** 2.0
**Стек:** Node.js API (:3210) + Next.js App Router BFF (:3200) + PostgreSQL 16 (:5433) + Expo React Native (Mobile) + Custom Private Storage

---

## 1. Контекст и архитектурный контракт

Платформа **Zhangak** — это высоконадежная система подготовки к ОРТ/ЖРТ в Кыргызстане. Проект полностью автономен: **Supabase выведен из эксплуатации и запрещен в runtime**.

### Главные доменные контуры (Multi-Host Routing через `proxy.ts`):
1. `zhangak.com` -> Публичный лендинг, прием заявок (`/v1/public/*`).
2. `platform.zhangak.com` -> Личный кабинет онлайн-ученика (`/v1/platform/*`).
3. `offline.zhangak.com` -> Офлайн-кабинет для очных групп и журнал преподавателя.
4. `admin.zhangak.com` -> Административная панель (`/v1/admin/*`).
5. `mobile/` -> Нативное мобильное приложение на Expo с Bearer-авторизацией (`native-auth.ts`).

---

## 2. Ключевые файлы и где искать информацию

| Сущность / Задача | Локальный путь в проекте | Назначение |
|---|---|---|
| **Архитектура и границы** | [`docs/development/architecture.md`](file:///C:/Users/user/Documents/Zhangak/docs/development/architecture.md) | Границы безопасности, порты, сессии, домены |
| **Инструкция по импорту файлов** | [`docs/development/CONTENT_INGESTION_MANUAL.md`](file:///C:/Users/user/Documents/Zhangak/docs/development/CONTENT_INGESTION_MANUAL.md) | Пошаговый пайплайн загрузки материалов |
| **Реестр всех 849 материалов** | [`sorted_data/00_documentation_and_indexes/FULL_MATERIAL_AUDIT_REPORT.md`](file:///C:/Users/user/Documents/Zhangak/sorted_data/00_documentation_and_indexes/FULL_MATERIAL_AUDIT_REPORT.md) | Паспорт каждого файла, язык, тема, готовность |
| **Манифесты папок** | `sorted_data/**/DIRECTORY_MANIFEST.txt` | Текстовые паспорта в каждой из 23 папок |
| **Web-Preview документов** | `sorted_data_preview/**/index.html` | Готовые HTML/WebP превью страниц для Iframe |
| **Схема БД (Миграции)** | [`backend/migrations/`](file:///C:/Users/user/Documents/Zhangak/backend/migrations/) | 11 SQL-миграций (`001_core.sql` - `011_ai_conversations.sql`) |
| **Собственный HTTP API** | [`backend/src/`](file:///C:/Users/user/Documents/Zhangak/backend/src/) | Сервер, роуты, авторизация, RBAC, работа с PostgreSQL |
| **Приватное хранилище** | [`backend/src/storage.js`](file:///C:/Users/user/Documents/Zhangak/backend/src/storage.js) | Стриминг файлов, MIME sniffing, SHA-256 |
| **Тестовые и validation скрипты** | [`scripts/`](file:///C:/Users/user/Documents/Zhangak/scripts/) | 18 автоматических quality/security чекеров |

---

## 3. Жесткие правила и инварианты (DOs and DONTs)

> [!CAUTION]
> **Никогда не нарушайте следующие правила:**

1. **Никакого Supabase в runtime**: Любые обращения к `@supabase/*` в `backend/src` или `app/` запрещены проверкой `scripts/check-own-backend.mjs`.
2. **Безопасность тестов (Zero-Leak)**: Поля `correct_answer` и `explanation` в `practice_questions` запрещено отдавать клиенту до завершения и фиксации попытки (`practice_attempts.status = 'submitted'`).
3. **Строгий формат 4 или 5 вариантов (A-D / A-E)**:
   - В текущей миграции `002_learning_core.sql` варианты валидируются через JSONB констрейнт на 4 ключа `{"a","b","c","d"}`.
   - Если импортируются тесты с вариантом "Д / E", **сначала** примените SQL-расширение схемы (см. `CONTENT_INGESTION_MANUAL.md`), иначе запрос упадет с ошибкой базы.
4. **Хранилище файлов**: Файлы сохраняются **только** на локальный диск в `$ZHANGAK_STORAGE_ROOT/lesson/{lessonId}/{uuid}`, а в базу пишется относительный `storage_key`. Прямых публичных ссылок нет.
5. **Изоляция архивов чатов**: Папка `06_chat_exports_and_history` содержит персональные данные и **заблокирована** для автоимпорта и отправки в AI.
6. **Immutable Snapshots**: Попытка сдачи теста (`practice_attempts`) делает моментальный снимок вопросов в `practice_attempt_items`. Изменение теста задним числом не ломает историю ученика.

---

## 4. Чек-лист проверки перед коммитом (Verification Suite)

Перед завершением любой задачи обязательно запустите следующие проверки из корня проекта:

```bash
# 1. Проверка синтаксиса и безопасности backend
npm --prefix backend test
node scripts/check-api-security.mjs
node scripts/check-own-backend.mjs

# 2. Проверка SQL-миграций
node scripts/check-sql-migrations.mjs

# 3. Проверка обучения и границ доступа
node scripts/check-learning-boundary.mjs

# 4. Проверка мобильного data plane
node scripts/check-mobile-first-party-data-plane.mjs
```
