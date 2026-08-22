# Актуальный handoff для AI-агентов Zhangak

**Актуально на:** 2026-08-22
**Последний зафиксированный handoff baseline:** `fc31d3d` (`docs: record
Zhangak release candidate verification`).
Это ориентир, а не замена командам `git status`, `git branch --show-current` и
`git rev-parse HEAD` перед началом работы.
**Назначение:** обязательная точка входа для AI-агента, который анализирует или
изменяет Zhangak. Это не release manifest: перед работой агент обязан сверить
текущий Git SHA, production health и фактическую схему.

## 1. Источники истины

При расхождении информации используйте следующий приоритет:

1. применённые `backend/migrations/*.sql` и ledger `schema_migrations`;
2. backend routes и тесты в `backend/src/` и `backend/test/`;
3. web/mobile код и контрактные тесты;
4. текущая документация из `docs/`;
5. архивные отчёты — только как история решений.

Нельзя объявлять функцию готовой только потому, что она описана в Markdown или
видна в UI. Проверяйте server-side authorization, реальные данные и тест.

## 2. Текущая архитектура

- Next.js App Router/BFF — порт `3200`.
- Собственный Node.js HTTP API — loopback `127.0.0.1:3210`.
- PostgreSQL — private/loopback; схема состоит из 26 последовательных миграций
  `001`–`026` на дату документа.
- Private storage — `$ZHANGAK_STORAGE_ROOT`; файлы выдаются только через
  authenticated streaming endpoint.
- Expo-клиент использует собственную bearer/refresh-сессию.
- Supabase полностью выведен из runtime. Архив Supabase не является запасным
  data plane и не разрешает вернуть SDK, Auth, PostgREST или Storage.

Домены и сессии изолированы:

| Домен | Контур |
| --- | --- |
| `zhangak.com` | маркетинг и заявки |
| `platform.zhangak.com` | самостоятельный online-курс ОРТ |
| `offline.zhangak.com` | offline-ученики и преподаватели |
| `admin.zhangak.com` | staff/admin/super-admin |

Online-доступ и зачисление относятся к одному общему курсу ОРТ. В интерфейсе
Roadmap внутри него показаны **два самостоятельных направления** — математика
и кыргызский язык — со своими последовательностями уроков и прогрессом. Это не
два взаимоисключающих тарифа. Тип ученика — только `online` или `offline`;
сессии и интерфейсы этих контуров разные.

## 3. Реализованные домены данных

Миграции `001`–`022` покрывают auth/RBAC, learning core, университеты,
настройки профиля, зачисления и сроки доступа, offline classroom, private
materials, gamification/trainer/daily challenge, заявки, roadmap, push
subscriptions, YouTube sources, quests/achievements, социальный
профиль и друзей, унификацию online-курса и claim наград.

Последние изменения:

- `023_remove_product_ai.sql` удаляет product AI из runtime и схемы;
- `024_content_studio_revisions.sql` добавляет основу ревизий Content Studio;
- `025_lesson_test_score_progress.sql` хранит честный результат теста урока,
  проценты и звёзды;
- `026_mock_exam_registrations.sql` добавляет расписание и регистрацию на
  очный пробный ОРТ.

Редактор вопросов завершает безопасный CRUD-контур без физического удаления:
создание и изменение заданий с ровно четырьмя вариантами `a/b/c/d`, явным
правильным ответом и объяснением, archive/restore, server-side фильтры и
пагинация, lesson-scoped workspace и корректная свободная позиция. История
попыток остаётся неизменяемой. Серия реализации зафиксирована commits
`13f07fd` и `796994a`; `37104ac` отдельно закрывает строгий Roadmap DTO.
Актуальный Git и release gate всё равно проверяются заново перед выводом о
готовности.

Это краткая карта, а не замена чтению SQL. Для точного контракта всегда
открывайте соответствующую миграцию и route.

## 4. Неприкосновенные инварианты

- `correct_answer` и server explanation не отдаются до завершённой попытки.
- XP, звёзды, quest progress, leaderboard и lesson completion рассчитывает
  сервер; клиент не присылает итоговые значения как источник истины.
- Student видит только собственные приватные данные. Teacher работает только
  со своими назначенными offline-группами. Admin и super-admin имеют разные
  capability-границы.
- Online learning требует активного зачисления и непросроченного доступа.
- Прямых публичных URL private materials нет.
- PII/chat exports нельзя импортировать автоматически.
- Product runtime AI отсутствует: не добавляйте provider keys, LLM routes или
  внешние model calls без нового утверждённого архитектурного решения.
- Production secrets и demo credentials нельзя сохранять в Git, screenshots,
  отчётах или browser storage exports.
- Старые применённые миграции не редактируются: только новая forward migration.

## 5. Что прочитать по задаче

| Задача | Канонический документ |
| --- | --- |
| Архитектура/security | `docs/development/architecture.md` |
| Разработка | `docs/development/README.md` |
| Импорт материалов | `docs/development/content-import-pipeline.md` |
| Формат материалов | `docs/education/material-submission-guide.md` |
| Production/deploy | `docs/operations/production.md`, `deploy/README.md` |
| Аккаунты/RBAC | `docs/operations/accounts-and-roles.md` |
| Online access | `docs/operations/student-access-and-monitoring.md` |
| Gamification | `docs/product/gamification-quests.md` |
| Roadmap | `docs/product/roadmap-implementation.md` |
| Product/growth audit Gemini | `docs/development/GEMINI_PRODUCT_GROWTH_AUDIT_PROMPT.md` |
| Текущий release ledger | `docs/development/CLAUDE_PROJECT_CONTINUATION.md` |
| История предыдущей Claude-итерации | `docs/development/CLAUDE_PROJECT_FINISH_CONTEXT.md`, `docs/development/CLAUDE_PROJECT_FINISH_PROMPT.md` |

Архив находится в `docs/archive/`. Архивные документы нельзя использовать как
актуальную инструкцию без повторной сверки с кодом.

## 6. Обязательный порядок работы агента

1. Зафиксировать `git status`, branch, HEAD и пользовательские изменения.
2. Прочитать этот handoff, архитектуру и профильный документ.
3. Проверить реальный route/schema/test, а не полагаться на название файла.
4. Сформулировать границы задачи, роли, данные, ошибки и rollback.
5. Делать минимальный логический diff, не трогая чужие изменения.
6. Проверить mobile/desktop, loading/empty/error и keyboard/focus состояния.
7. Выполнить тесты и сообщить точные команды, результаты и непроверенные зоны.
8. Не commit/push/deploy без прямого разрешения пользователя.

## 7. Базовая верификация

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run check:security
npm run check:own-backend
npm --prefix backend run check
npm --prefix backend test
git diff --check
```

Для UI запускайте `npm run test:e2e`; для release — production build,
standalone smoke и внешний health. Для миграции нужен disposable PostgreSQL и
двойное применение ledger. Конкретные `check:*` выбирайте по изменённому
домену из `package.json`.

## 8. Правило отчёта

Отчёт должен отделять:

- подтверждённый факт с маршрутом/файлом/test evidence;
- вывод или продуктовую гипотезу;
- блокер, который нельзя проверить без владельца/секрета/реального устройства;
- выполненное изменение;
- оставшийся риск и способ его закрытия.

Фразы «всё работает», «готово к production» или «UX хороший» без матрицы
проверок и доказательств запрещены.
