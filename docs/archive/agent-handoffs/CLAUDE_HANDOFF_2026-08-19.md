# [АРХИВ] Claude handoff — Zhangak preproduction

**Дата:** 2026-08-19  
**Канонический репозиторий:** `C:\Users\user\Documents\Zhangak`  
**Рабочая ветка:** `p0/reconcile-production`  
**Git SHA при передаче:** `b73148298c9cea4cf1eae84c75d185265e5d2eb0`  
**Live web/API SHA:** `b73148298c9cea4cf1eae84c75d185265e5d2eb0`

Этот документ можно целиком передать Claude. Если текст документа расходится с
текущим кодом, источником истины являются применённые SQL-миграции,
server-side маршруты и автоматические тесты.

## 1. Роль и цель

Ты работаешь как senior full-stack engineer и архитектор образовательной
платформы Zhangak для подготовки к ОРТ/ЖРТ в Кыргызстане. Продолжай текущую
preproduction-версию небольшими, проверяемыми вертикальными срезами. Не
возвращай старую архитектуру и не подменяй отсутствующую функцию фальшивыми
данными.

Перед любым изменением:

1. прочитай этот файл;
2. прочитай `docs/development/architecture.md`;
3. прочитай профильную инструкцию в `docs/operations/`;
4. проверь `git status`, текущий SHA и существующие тесты;
5. найди фактический API/DB-контракт в `backend/src/routes` и
   `backend/migrations`.

## 2. Архитектура, которую нельзя менять без отдельного решения владельца

```text
Browser / installed PWA / Expo
              |
              | HTTPS, domain-isolated session
              v
Next.js App Router + same-origin /v1 BFF (:3200)
              |
              | loopback only
              v
Node.js HTTP API (:3210)
              |
              +-- PostgreSQL 16 (:5433, loopback/private)
              +-- private file storage on the second VPS volume
              +-- DeepSeek provider through server-only gateway
```

- `zhangak.com` — публичный многостраничный сайт и заявки.
- `platform.zhangak.com` — самостоятельное онлайн-обучение и PWA.
- `offline.zhangak.com` — отдельный интерфейс офлайн-ученика и преподавателя.
- `admin.zhangak.com` — интерфейсы сотрудников.
- `mobile/` — Expo companion с Bearer auth через собственный API.
- Старый `/api/*` retired, кроме `/api/health`. Рабочий namespace — `/v1/*`.
- Browser auth использует HttpOnly cookies. Mobile использует access/refresh
  tokens в SecureStore. Сессии разных доменов не объединяются.

### Supabase запрещён

Supabase полностью выведен из runtime. Запрещено добавлять:

- `@supabase/*`;
- Supabase Auth, PostgREST или Storage;
- прямые клиентские записи в базу;
- переменные `NEXT_PUBLIC_SUPABASE_*` или `SUPABASE_*` в runtime.

Архив Supabase допустим только как read-only источник контролируемой миграции.
Проверка `npm run check:own-backend` должна оставаться зелёной.

## 3. Зафиксированные продуктовые решения владельца

### Типы обучения

- Ученик находится только в одном режиме: `online` или `offline`; hybrid нет.
- Admin может переключить режим, одновременно состоять в двух режимах нельзя.
- Online — индивидуальный самостоятельный курс, преподавателя и группы нет.
- Offline — отдельные группы; преподаватель видит назначенные группы, ведёт
  посещаемость, оценки 0–100 и комментарии, но не создаёт группы.
- Admin и super-admin видят всех учеников. Teacher — только свой offline-контур.

### Контент и прогресс

- Основные предметы v1: математика и кыргызский язык.
- Урок содержит текст, LaTeX, изображения, несколько PDF и YouTube-видео.
- Online видит книги и видео. Offline видит цифровые книги, видео не требуется.
- PDF до 200 MiB, изображения до 30 MiB; UI предупреждает о превышении.
- Платный материал открывается после ручного подтверждения оплаты менеджером
  или admin. Статусы: ожидает подтверждения, активно, приостановлено, истекло.
- Roadmap является главным student-разделом, визуально идёт снизу вверх.
- После урока открывается тест. Около 15 вопросов, попытки не ограничены.
- Звёзды: 1 при результате от 50%, 2 от 75%, 3 от 90%.
- XP и завершение рассчитывает только backend.

### Вопросы, daily и trainer

- Текущий формат: четыре варианта, один правильный ответ.
- Вопросы классифицируются по предмету, разделу и сложности.
- Daily одинаков для учеников одного курса, порядок вопросов различается;
  доступен календарные сутки с 00:00 Asia/Bishkek, XP один раз в сутки.
- В trainer правильно решённый вопрос больше не показывается этому ученику.
- Неправильный может повториться. История прошлых вопросов доступна.
- Reset trainer progress не отнимает ранее заработанный XP.
- Награда trainer фиксируется по разделу, а не бесконечно за каждый новый ответ.
- AI генерирует только draft. Публикацию подтверждает admin или super-admin.
- Язык AI/контента: русский или кыргызский; язык интерфейса выбирает ученик.

## 4. Безопасность и server-authoritative инварианты

1. `correct_answer` и `explanation` не возвращаются ученику до server-side
   submit/finalization.
2. Попытка сохраняет immutable snapshot вопросов и вариантов.
3. Клиент не передаёт доверенные `studentId`, score, XP, stars, role или
   timestamps.
4. Backend получает user id только из проверенной сессии/token.
5. Начало/submit/idempotency/max-attempt enforcement выполняются транзакционно.
6. Online endpoints требуют active online enrollment; offline endpoints —
   соответствующий offline scope.
7. Admin UI не является границей авторизации. Каждый `/v1/admin/*` endpoint
   проверяет capability/role сервером.
8. Обычный `admin` управляет контентом и student accounts. Только super-admin
   управляет staff roles и видит минимизированный access audit.
9. Приватные материалы не имеют публичного URL. Файл выдаётся только через
   authenticated streaming endpoint после ownership/access check.
10. `sorted_data/06_chat_exports_and_history/` запрещена для импорта и AI из-за
    PII.
11. Секреты нельзя печатать, коммитить, передавать браузеру или включать в
    release artifact.

## 5. Схема и данные

В `backend/migrations/` находятся 14 активных forward-only миграций:

- `001` auth/RBAC;
- `002` learning core, tests and attempts;
- `003` universities;
- `004` student preferences;
- `005` controlled legacy import ledger;
- `006` delivery modes, enrollments and lesson materials;
- `007` offline classroom;
- `008` private storage;
- `009` XP, daily and trainer;
- `010` public applications and manual activation;
- `011` AI conversations and consent;
- `012` course roadmaps;
- `013` private storage constraint fix;
- `014` Web Push subscriptions.

Никогда не редактируй уже применённую миграцию. Добавляй следующую
forward-only миграцию, затем тестируй весь ledger на чистом PostgreSQL 16.
Production ledger сейчас заканчивается на `014_push_notifications.sql`.

Большой локальный архив `sorted_data/` может отсутствовать в чистом CI. Тесты,
которые анализируют сами исходные материалы, должны честно skip-аться при
отсутствии архива; security/static tests импортёров выполняются всегда.

## 6. VPS и релизы

VPS: `178.105.33.204`, Ubuntu ARM64, Node `22.22.2`, npm `10.9.7`.
Подключение доступно владельцу по SSH key; не копируй приватный ключ в проект и
не выводи содержимое `/etc/zhangak*`.

Второй том `/mnt/HC_Volume_106608581` подключён постоянно:

| Данные | Физическое расположение | Стабильный mount |
|---|---|---|
| web releases | `zhangak-runtime/web` | `/var/www/zhangak` |
| API releases | `zhangak-runtime/api` | `/var/www/zhangak-api` |
| materials | `zhangak-materials` | через `ZHANGAK_STORAGE_ROOT` |
| local DB backups | `zhangak-backups/postgres` | server-only |

Это bind mounts из `/etc/fstab`, не symlink. Перед удалением или перемещением
чего-либо проверяй точные `findmnt`/`realpath`. Не форматируй том и не удаляй
`current`, `previous` или последний успешный backup.

Web и API релизы immutable и называются полным Git SHA. Деплой считается
завершённым, только если:

- CI для этого SHA зелёный;
- web и API собраны Node 22.22.2 из чистого checkout;
- `/v1/ready` показывает тот же SHA и последнюю migration;
- все четыре `/api/health` показывают тот же SHA;
- предыдущие releases сохранены для rollback.

Подробности: `deploy/README.md`, `deploy/api/README.md` и
`docs/operations/storage-pwa-push.md`.

## 7. Уже реализовано и развёрнуто

- собственная PostgreSQL/auth/RBAC архитектура без Supabase;
- раздельные домены и сессии;
- student roadmap, lessons, private materials, practice, daily, trainer,
  leaderboard, settings and universities;
- offline student dashboard и teacher classroom foundation;
- admin accounts/access, courses, lessons, roadmap, assessments, groups,
  applications and manual enrollment activation;
- DeepSeek server gateway, consent/history/rate boundaries;
- PWA manifest, Service Worker, install UX and safe-area adaptation;
- Web Push subscription/test/reminder infrastructure;
- ежедневный push timer около 19:00 Asia/Bishkek;
- web/API runtime и backup artifacts перенесены на второй VPS volume;
- GitHub CI с PostgreSQL migration verification, backend/web/mobile/security,
  build, secret scan, standalone package and smoke tests.

Push permission всегда запрашивается только после явного клика ученика.
Автоматический producer сейчас реализован для daily study reminder. Preferences
для results/announcements уже хранятся, но соответствующие event producers ещё
нужно подключить к реальным server-side событиям.

## 8. Рекомендуемые следующие задачи

Выполняй по одной вертикали и не обещай готовность до live QA:

1. Подключить transactional push events для опубликованного объявления и
   готового результата; обеспечить idempotency, preferences и session scope.
2. Завершить content QA: сопоставить импортированные PDF/вопросы с курсом,
   уроком, языком и roadmap; не публиковать непроверенные ответы.
3. Довести offline-контур: расписание, посещаемость, домашние задания, оценки и
   private teacher notes с точными role boundaries.
4. Провести полный student mobile E2E на 320/360/390/430/768 px, установленной
   PWA Android и iOS; исправлять source, не локальный prototype.
5. Добавить зашифрованный off-site PostgreSQL backup и реальный restore drill.
   Второй том той же VPS не является disaster recovery.
6. Закрыть VPS hardening debt: минимальный sudo для deploy, firewall и
   мониторинг диска/сервисов без нарушения соседних приложений.
7. Подключать университетские данные только из подтверждённых источников с
   датой актуальности; не придумывать проходные баллы или стоимость.

## 9. Обязательная проверка каждого изменения

Из корня проекта:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run check:security
npm run check:learning-boundary
npm run check:student-mobile-ux
npm run check:own-backend
npm run check:web-data-plane
npm run check:mobile-data-plane
npm run check:first-party-auth
npm run check:migrations
npm run audit:prod
npm --prefix backend ci
npm --prefix backend run check
npm --prefix backend test
npm run build
```

Для SQL дополнительно запусти `npm --prefix backend run verify:migrations`
против disposable PostgreSQL 16. Для mobile запусти TypeScript и auth/data-plane
checks из `mobile/`. Не используй production DB для экспериментов.

## 10. Правила Git и отчёта

- Не перезаписывай чужой dirty worktree и не используй `git reset --hard`.
- Не делай массовое удаление без проверки абсолютных путей.
- Сначала тесты, затем отдельный осмысленный commit и push текущей ветки.
- Не деплой SHA с красным CI.
- После деплоя сообщи точный Git SHA, migration, health всех доменов, rollback
  target и результаты тестов.
- Если задача требует продуктового решения, которого здесь нет, задай владельцу
  один конкретный вопрос до изменения schema/API.
- Не включай в документацию пароли demo accounts, DeepSeek key, VAPID private
  key, database password или SSH private key.

## 11. Короткий стартовый prompt для Claude

```text
Открой C:\Users\user\Documents\Zhangak и прочитай полностью
docs/development/CLAUDE_HANDOFF.md, docs/development/architecture.md и профильную
инструкцию в docs/operations. Сначала проверь git status, HEAD, CI и фактический
API/DB контракт. Zhangak использует только собственный Node API + PostgreSQL;
Supabase запрещён. Не меняй применённые миграции и не раскрывай секреты.

Перед реализацией кратко сформулируй: цель текущего вертикального среза,
затрагиваемые таблицы/API/UI, security invariants и тесты. Затем реализуй только
этот срез, запусти обязательные проверки из handoff, сделай осмысленный commit
и не деплой до зелёного CI. Для production deploy сохрани rollback и проверь
одинаковый SHA web/API на всех четырёх доменах.
```

## 12. Профильные prompts для делегирования

- `docs/development/AI_AGENT_EXECUTION_PLAN.md` — разделение задач Claude и
  Antigravity, stop-gates, cross-review и deployment candidate contract.
- `docs/development/CLAUDE_YOUTUBE_PLAYER_PROMPT.md` — честная модель защиты,
  реализация и тесты YouTube player без ложного обещания DRM.
- `docs/development/GEMINI_ANTIGRAVITY_CONTENT_PROMPT.md` — многофазный аудит,
  OCR, классификация и проверка учебных материалов с PII/human-review gates.
