# Zhangak: короткий контекст завершения проекта для Claude

**Назначение:** минимальный пакет фактов для реализации следующего release
candidate без полного перечитывания репозитория.

**Baseline при создании:** `0824881` от 2026-08-22. Перед изменениями Claude
обязан сверить текущие branch, HEAD и dirty files. Код, применённые SQL-миграции
и тесты имеют приоритет над этим документом.

## 1. Прочитать только это

Обязательный первый проход:

1. этот файл;
2. `docs/development/architecture.md`;
3. `backend/migrations/002_learning_core.sql`;
4. `backend/src/routes/admin-assessments.js`;
5. `lib/admin-assessments-client.ts`;
6. `components/admin/AdminAssessmentWorkspace.tsx`;
7. `backend/test/admin-assessments.test.js`;
8. `tests/admin/admin-assessments-client.test.ts`;
9. `app/student/online/roadmap/page.tsx`;
10. `lib/platform-roadmap.ts`;
11. `backend/src/routes/platform-roadmap.js`;
12. `package.json`.

Открывать остальные файлы только по прямой зависимости изменяемого кода.
Не читать целиком `docs/archive/`, `.next/`, `node_modules/`, release bundles,
backup, сырые Telegram/WhatsApp-экспорты и `sorted_data/06_chat_exports_and_history/`.
Не искать и не открывать `.env` или production-секреты.
Root-отчёты `FINAL_VERDICT.md`, `AUDIT_EXECUTIVE_SUMMARY.md` и
`TECHNICAL_AND_DATA_RISKS.md` относятся к старому SHA и ошибочно считают
AI-коуч активным; не использовать их как текущий контракт.

## 2. Архитектура, которую нельзя менять

- Web: Next.js App Router и same-origin BFF, порт `3200`.
- API: собственный Node HTTP server `backend/src/server.js`, loopback `3210`.
- DB: PostgreSQL 16, private/loopback `5433`, миграции `001`–`026`.
- Файлы: private volume, выдача только authenticated endpoint.
- Supabase запрещён во всём runtime.
- Product AI удалён миграцией `023`; LLM routes, SDK и provider keys не
  возвращать.
- Старые применённые миграции immutable; изменение схемы — только новой
  forward migration.
- Не SSH, не push и не deploy: deployment выполняет Codex после отдельной
  проверки release candidate.

Домены имеют раздельные сессии:

| Домен | Назначение |
| --- | --- |
| `zhangak.com` | маркетинг и заявки |
| `platform.zhangak.com` | самостоятельное online-обучение |
| `offline.zhangak.com` | offline-ученики и преподаватели |
| `admin.zhangak.com` | staff/admin/super-admin |

Online-зачисление относится к одному общему курсу ОРТ. В Roadmap внутри него
два отдельных учебных направления: математика и кыргызский язык.

## 3. Уже реализовано — не писать заново

- Cookie/Bearer auth, RBAC/capabilities и собственный BFF/API.
- Урок: video -> test -> result; ответ и объяснение открываются после submit.
- Roadmap снизу вверх, отдельные направления math/kyr, lesson-level процент и
  `0–3` звезды.
- Trainer, daily challenge, quests, XP, achievements, leaderboard и профили.
- Сроки online-доступа, freeze/extend, мониторинг учеников.
- Пробный ОРТ: расписание и самостоятельная регистрация.
- `/admin/questions` и редактор тестов/вопросов.
- Создание вопроса: `POST /v1/admin/practice-tests/:testId/questions`.
- Редактирование: `PATCH /v1/admin/practice-questions/:questionId`.
- Форма уже содержит текст, ровно A–D, явный правильный вариант, объяснение,
  раздел, тему, сложность, HTTPS image URL, позицию и `isActive`.
- Published-тест не может остаться без активного вопроса.

Известные несоответствия на момент создания этого документа (2026-08-22,
baseline `0824881`) — все закрыты релиз-кандидатом `fix/video-release-review`:

- `app/admin/lessons/[id]/questions/page.tsx` больше не показывает migration
  notice: он монтирует `AdminAssessmentWorkspace` с `lessonId`, и workspace
  резолвит собственный курс/урок через `GET /v1/admin/lessons/:id` +
  `GET /v1/admin/courses/:id`, а не угадывает связь;
- `app/admin/mock/[id]/questions/page.tsx` удалён, а не мигрирован. Граница
  `mock_exam_sessions` (расписание) vs `practice_tests` (содержимое теста)
  задокументирована в `docs/development/architecture.md`;
- backend-test по-прежнему намеренно подтверждает отсутствие HTTP `DELETE`.
  Это безопасный инвариант, а не тест, который нужно удалить ради hard delete.

## 4. P0: воспроизвести и исправить live Roadmap

На baseline 2026-08-22 в повторной авторизованной live-проверке главная
online-ученика загружалась и показывала прогресс `2/18`, а
`/student/online/roadmap` показывал «Карта пока недоступна / Не удалось
загрузить дорожную карту курса».

Это наблюдение нужно сначала воспроизвести с разрешённым demo-аккаунтом и
зафиксировать network response. Не угадывать причину и не маскировать ошибку
fallback-данными. Проверить минимально:

- `app/student/online/roadmap/page.tsx`;
- `lib/platform-roadmap.ts` и его строгий parser;
- `backend/src/routes/platform-roadmap.js`;
- реальные production-like строки, включая legacy nullable/blank values;
- соответствие DTO route -> BFF/client parser;
- enrollment/course/subject scoping.

Исправление должно быть server-contract корректным, покрытым regression test и
не ослаблять student data boundary. После fix проверить два отдельных пути
Math/Kyr, порядок снизу вверх, lesson popover, lock/current/progress/stars и
отсутствие answer keys.

## 5. Главный CRUD-результат: полноценное управление вопросами

### 5.1 Безопасное удаление

Пользовательское действие «Удалить» в v1 означает **архивировать**:
`is_active = false`. Нужны отдельные понятные действия «Архивировать» и
«Восстановить», confirmation dialog и success/error feedback.

Физический `DELETE` запрещён, потому что вопрос может участвовать в immutable
истории попыток. Связи с `practice_attempt_items`, trainer и daily challenge
защищены от разрушительного удаления. Не каскадировать и не переписывать их.
Если когда-нибудь понадобится hard delete, он возможен только отдельной новой
задачей для никогда не использованного draft-вопроса.

Backend обязан:

- разрешать мутацию только content-capability для `admin/super_admin`;
- сохранить запрет архивировать последний активный вопрос опубликованного теста;
- вернуть стабильные `400/403/404/409`, не внутренний SQL;
- оставить audit event без текста правильного ответа и без PII;
- отличать в audit metadata обычное редактирование от archive/restore.

### 5.2 Каталог вопросов

Текущий UI загружает первые 100 вопросов и не имеет полноценного поиска.
На baseline это подтверждено реальным 200-вопросным банком: интерфейс показывал
`200/200`, но отрисовал только edit actions для вопросов `1–100` без next/load
more. Это функциональный blocker, а не косметическое пожелание.
Нужно добавить server-side:

- пагинацию с видимыми total/range/prev/next;
- поиск по тексту/теме;
- фильтры `active|archived|all`, section и difficulty;
- детерминированную сортировку `position, id`;
- строгую валидацию query и DTO.

Рекомендуемый размер страницы — 25 или 50. Не загружать весь банк в браузер.
При смене теста/фильтра отменять или игнорировать устаревший ответ запроса.

Статические checks сейчас закрепляют старые заглушки. Их нужно обновить вместе
с рабочим контрактом, а не обходить:

- `scripts/check-admin-learning-journey.mjs` требует текст «Редактор заданий
  переносится»;
- `scripts/check-admin-legacy-cutover.mjs` считает mock question route
  migration notice и проверяет только create/update;
- `backend/test/admin-assessments.test.js` правильно запрещает destructive
  HTTP `DELETE` и должен продолжать это делать после soft archive UI.

### 5.3 Create/Edit UX

Существующую форму сохранить и улучшить, а не переписать:

- четыре и только четыре непустых варианта A–D;
- правильный вариант выбирает администратор, не AI;
- inline ошибки рядом с полем и общий server error;
- предупреждение о несохранённых изменениях при закрытии;
- autofocus на первом ошибочном поле, keyboard/focus trap и Escape;
- кнопки минимум 44 px, корректные состояния disabled/loading;
- мобильная форма 390 px без горизонтального скролла;
- перед публикацией теста понятная сводка активных вопросов.
- lesson-scoped кнопка «Вопросы» открывает реальный editor с уже выбранным
  уроком, а не устаревшее сообщение о миграции.

Позиция уникальна внутри теста. Конфликт возвращает `409`; UI предлагает
другую свободную позицию и не теряет введённые данные.

## 6. Умеренная доводка дизайна

Это polish, не ребрендинг. Сохранить логотип, палитру, типографику и текущую
информационную архитектуру. Не превращать всё в одинаковые большие карточки и
не добавлять декоративные элементы без функции.

Приоритет:

1. admin question workspace: ясная иерархия «курс -> урок -> тест -> вопросы»,
   компактная панель фильтров, читаемый список и видимые опасные действия;
2. согласовать loading/empty/error/success состояния;
3. проверить student Roadmap, home, quests и profile на единый ритм отступов,
   CTA, заголовки, safe-area и нижнюю навигацию;
4. исправлять только доказанные проблемы, не делать массовый CSS rewrite.

Два подтверждённых P2 в `components/student/StudentTopbar.tsx`:

- desktop search выглядит интерактивным, но не имеет value/onChange/submit.
  Либо реализовать узкий проверяемый поиск уроков/тем, либо убрать ложную
  affordance из release UI;
- цель отображается как `${targetScore} балл` без склонения. Использовать
  корректные `балл/балла/баллов`.

Пять sidebar-разделов со статусом «Скоро» не нужно срочно реализовывать в этой
задаче. Перед release их следует честно убрать из primary navigation или
оставить за явным feature flag/backlog; заглушка не является готовой функцией.

Требования к проверке: 390x844, 768x1024 и 1440x900; keyboard-only; zoom 200%;
видимый focus; контраст; отсутствие горизонтального overflow. Иконки — Lucide
или существующая графика, не emoji.

## 7. Неприкосновенные учебные границы

- В базе `practice_questions.options` — JSONB с точными ключами
  `{a,b,c,d}`; `correct_answer` только `a|b|c|d`.
- До submit student DTO никогда не содержит `correctAnswer`, `correct_answer`,
  `explanation` или скрытый answer key.
- После submit сервер сам делает scoring и выдаёт review.
- XP, stars, progress и completion вычисляет сервер.
- Данные админского DTO с ключом ответа не импортировать в student component.
- Не генерировать вопросы и ответы через AI.

## 8. Минимальный набор тестов

Добавить тесты именно на новую логику, затем выполнить:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run check:security
npm run check:learning-boundary
npm run check:admin-learning-journey
npm run check:own-backend
npm run check:no-product-ai
npm run check:migrations
npm --prefix backend run check
npm --prefix backend test
npm run build
git diff --check
```

Для UI запустить релевантные Playwright-сценарии с mobile/tablet/desktop.
Если полный `npm run test:e2e` блокируется окружением, указать точную причину и
дать проверенные альтернативные evidence; не писать «всё прошло» без вывода.

Обязательные новые кейсы:

- student/teacher/manager получают `403` на question mutations;
- create/reject malformed A–D;
- edit и position conflict `409`;
- archive, restore, повторный idempotent UI flow;
- нельзя архивировать последний active question published-теста;
- archived вопрос не попадает в новую student attempt;
- до submit ключ/объяснение отсутствуют;
- search/filter/pagination не смешивают тесты и не дублируют строки;
- mobile modal, confirmation, keyboard flow и empty state.

## 9. Definition of Done и отчёт

Работа закончена только когда:

- create/edit/archive/restore доступны в `admin.zhangak.com` и защищены API;
- Roadmap загружает реальные данные для demo/active online enrollment и имеет
  regression test на найденный contract/data edge case;
- четыре варианта и answer key валидируются БД/API/client;
- история попыток не удаляется и student boundary не ослаблена;
- список управляем при 200 вопросах;
- visual polish не ломает 390/768/1440 и существующие сценарии;
- тесты и production build имеют точный результат;
- документация обновлена вместе с кодом.

Финальный отчёт Claude должен содержать:

1. branch и итоговый SHA;
2. список изменённых файлов по фичам;
3. что было уже готово и что реально добавлено;
4. миграции/route/roles/audit/rollback;
5. таблицу команд и результатов;
6. пути к before/after screenshots;
7. незакрытые P0/P1/P2 риски;
8. текст `READY FOR CODEX REVIEW`, но не утверждение о production-ready и не
   самостоятельный deploy.
