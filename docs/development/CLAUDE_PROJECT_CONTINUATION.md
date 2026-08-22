# Claude continuation: закончить незавершённый release candidate Zhangak

**Снимок:** 2026-08-22. Этот файл предназначен для нового Claude Code chat в
том же рабочем каталоге. Он заменяет устаревшие progress-утверждения из finish
context, но не отменяет его архитектурные и security-инварианты.

## Команда для нового чата

Продолжай текущую незавершённую работу Zhangak с существующего dirty worktree.
Не начинай заново и не ограничивайся планом. Исправь перечисленные ниже дефекты,
доведи тесты до честного результата, проведи финальный аудит и подготовь
локальные логические commits. Не выполняй push, SSH или deploy.

## 1. Сначала зафиксируй состояние

Выполни:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log --oneline -5
git diff --stat
git diff --name-status
```

Ожидаемый baseline:

- branch `fix/video-release-review`;
- HEAD `37104ac0b82c24ffc13668872de63d35c0121017`;
- remote остаётся на `5c77156`, локальная ветка впереди на два commit;
- worktree **грязный**: это незавершённая работа предыдущего Claude и ранее
  подготовленные handoff docs.

Запрещено использовать `git reset`, `git checkout --`, destructive clean,
перезаписывать или выбрасывать текущий diff. Не stash без необходимости и не
смешивать массовое форматирование с функциональными исправлениями.

## 2. Что уже закончено

Отдельный локальный commit `37104ac fix(roadmap): stop shipping a DTO the
client must reject` закрывает P0 Roadmap:

- blank legacy descriptions сервер нормализует в `null`;
- completed lesson больше не может одновременно быть `done` и `locked`;
- строгий client parser не ослаблен;
- regression tests добавлены;
- payload не содержит answer key.

Не переписывай этот fix. Только включи его в итоговую verification и помни:
commit ещё не push/deploy.

## 3. Что частично сделано, но НЕ закоммичено

Текущий diff уже содержит:

- server-side `q/status/section/difficulty` filters и offset pagination в
  `backend/src/routes/admin-assessments.js`;
- query DTO/client в `lib/admin-assessments-client.ts`;
- reversible archive/restore через `PATCH {isActive}` без HTTP `DELETE`;
- audit actions `archive_practice_question` и `restore_practice_question`;
- admin UI: page size 25, поиск, фильтры, range, Prev/Next, confirmation dialog;
- shared lesson question workspace вместо старой заглушки;
- удаление неподтверждённого `app/admin/mock/[id]/questions/page.tsx`;
- скрытие migration-only sidebar sections из release navigation;
- настоящий desktop lesson search и русские склонения;
- unit/backend/static tests, новый Playwright spec и screenshot harness;
- after-screenshots в
  `artifacts/finish-after/{390x844,768x1024,1440x900}/`.

Это не доказательство готовности. Проверь diff, исправь найденные ниже ошибки и
не присваивай себе уже готовую часть.

## 4. Точная точка остановки и обязательные исправления

### P0/P1-A. Lesson-scoped editor сейчас сломан

`AdminAssessmentWorkspace({ lessonId })` запускает lesson `loadTests`, но generic
effect с `selectedCourseId === null` затем увеличивает `testRequest`, очищает
state и делает ответ устаревшим. Дополнительно:

- `selectedCourse` и `selectedLesson` остаются `null`;
- заголовок ошибочно показывает «Весь курс»;
- обе кнопки создания теста disabled;
- `TestFormModal` требует `selectedCourse`;
- retry может уйти в `loadCourses()` вместо lesson reload.

Исправь архитектурно, не таймингом. Нужен один детерминированный initialization
path для общего и lesson-scoped режима. Если для формы не хватает данных урока
или курса, добавь/используй явный first-party read contract либо передавай
проверенный course context из lessons page; не угадывай связь по ID. Добавь
Playwright/contract test прямого `/admin/lessons/:id/questions`.

### P0/P1-B. Свободная позиция вопроса вычисляется неверно

`nextQuestionPosition(questions)` видит только текущие 25 строк и текущий
фильтр. В банке 200 вопросов первая страница предлагает `26`, хотя позиция уже
занята; другая страница может предложить `1`. Create системно получает `409`.

Источник `nextAvailablePosition` должен быть серверным и учитывать **весь тест,
включая archived и строки вне фильтра**. Верни metadata в list DTO либо создай
узкий endpoint/atomic create contract. Для полного диапазона 1–200 верни честное
состояние «свободных позиций нет». Не вычисляй позицию из page rows.

При `409 practice_question_position_conflict` форма сохраняет введённые данные,
показывает inline explanation и предлагает актуальную свободную позицию.

### P1-C. Пагинация и синхронизация

- `count(*) OVER()` даёт `total=0`, когда offset уже за последней строкой.
  Верни корректный filtered total и автоматически перейди на последнюю
  существующую страницу после archive/filter changes.
- После create/edit refetch текущего catalogue query: запись могла перестать
  соответствовать search/status/section/difficulty, а page нельзя раздувать
  сверх 25.
- Active count изменяй через previous -> saved delta или перечитывай test
  summary; повторный ответ/двойное действие не должен искажать число.
- Section filter не должен отправлять запрос на каждый символ без debounce или
  явного Apply.
- Empty state при активных фильтрах должен говорить «ничего не найдено» и
  предлагать сброс, а не «в тесте пока нет заданий».
- Сохрани deterministic order `position, id` и stale-request protection.

### P1-D. Формы и доступность

Question/Test modal всё ещё не закрывают требования finish prompt. Добавь:

- `role=dialog`, `aria-modal`, корректный label;
- focus trap, Escape и возврат focus к opener;
- autofocus на первое ошибочное поле;
- inline validation рядом с полем плюс общий server error;
- dirty/unsaved-changes confirmation при close/Escape/navigation;
- для нового вопроса `correctAnswer` начинается как `null`: администратор обязан
  осознанно выбрать A/B/C/D. Не предвыбирай A автоматически; edit сохраняет
  существующий ключ;
- visible loading/success/error feedback;
- archive `409` должен быть виден внутри dialog, а не только позади overlay;
- минимум 44 px touch targets и отсутствие horizontal overflow на 390 px.

Физический `DELETE` по-прежнему запрещён. Immutable attempt/trainer/daily
history не изменять. Последний active question опубликованного теста нельзя
архивировать.

### P1-E. E2E сейчас красный

`tests/e2e/admin-questions.spec.ts`: **5/5 FAIL**. Все сценарии остаются на
«Проверяем права доступа…» и не доходят до workspace.

На `127.0.0.1:3311` был долгоживущий Next standalone, а Playwright настроен с
`reuseExistingServer: true`; вероятен stale build/static mismatch. Исправляй не
таймаутом и не удалением assertions:

1. проверь владельца процесса 3311 и не завершай чужой процесс вслепую;
2. запусти свежий isolated production E2E server/port либо гарантированно
   пересобери собственный test server;
3. переиспользуй рабочий auth-stub pattern из `tests/e2e/responsive.spec.ts`;
4. при необходимости блокируй service worker в test context;
5. логируй console/pageerror/requestfailed и докажи, почему auth не завершался;
6. добейся 5/5 pass, затем добавь lesson-scoped и `409` recovery cases.

Stubbed browser test не доказывает backend authorization. Добавь/расширь real
PostgreSQL integration cases для admin/super_admin allow, manager/teacher/
student deny, archive/restore, published last-active guard, filtered pagination
и того, что archived question не попадает в новую student attempt.

### P2-F. Завершить polish без расширения scope

- Убери дублирующиеся «Новый тест» CTA; один главный action на контекст.
- Исправь stale mock copy: расписание пробного ОРТ уже существует отдельно от
  assessment content. Удалённый mock `[id]/questions` не должен оставить broken
  ссылку; границу `mock_exam_sessions` vs `practice_tests` задокументируй.
- StudentTopbar search и `балл/балла/баллов` уже начаты: проверь реальный URL,
  keyboard submit, empty result, back/clear и plural cases. Не оставляй fake UI.
- Обнови устаревшие success-тексты static checks, которые всё ещё говорят
  «question editor safely unavailable»/migration notices.
- Синхронизируй `CLAUDE_PROJECT_FINISH_CONTEXT.md` с фактическим результатом.
- Не реализуй пять unrelated «Скоро» разделов; release nav может скрывать их.

## 5. Уже полученные test evidence

Подтверждено на текущем dirty diff:

- `git diff --check` — pass;
- `npm run typecheck` — pass;
- admin client + plural unit tests — `6/6` pass;
- `backend/test/admin-assessments.test.js` — `8/8` pass;
- полный backend run — `127 pass`, `1 intentional skip`;
- `check-admin-learning-journey` и `check-admin-legacy-cutover` — pass;
- `check:no-product-ai` и `check:own-backend` — pass;
- свежий `npm run build` на текущем dirty tree — pass;
- новый admin Playwright — `5/5 fail`, это текущий главный verification blocker.

Full lint имеет три известные baseline-ошибки
`react-hooks/set-state-in-effect` в `app/admin/content/page.tsx`. Не используй их
как оправдание: changed-file lint должен быть чистым; baseline failures укажи
отдельно и не исправляй unrelated файл без необходимости.

## 6. Обязательная финальная проверка

После исправлений выполни как минимум:

```bash
git diff --check
npm run typecheck
npm run lint
npm run test:unit
npm run check:security
npm run check:learning-boundary
npm run check:admin-learning-journey
npm run check:admin-legacy-cutover
npm run check:own-backend
npm run check:no-product-ai
npm run check:migrations
npm --prefix backend run check
npm --prefix backend test
npm run build
npm run test:e2e
```

Также проверь real browser 390x844, 768x1024, 1440x900. Existing after-shots
не заменяют acceptance test и не имеют before-пары. Сделай новые финальные
screenshots изменённых экранов после зелёной сборки и укажи пути.

## 7. Commit policy

Только после исправления P0/P1 и честной verification создай локальные commits:

1. `feat(admin): finish safe question catalogue management`;
2. `polish(ui): complete assessment and lesson search UX`;
3. `docs: record Zhangak release candidate verification` — если docs менялись.

Не amend commit `37104ac`, не push и не deploy. Не включай `test-results`,
`.next`, временные server files или секреты. Screenshot artifacts включай только
если политика репозитория явно считает их release evidence; иначе укажи local
paths в отчёте.

## 8. Definition of Done и финальный ответ

Нельзя писать READY, пока:

- lesson-scoped editor реально загружает и создаёт/редактирует тесты/вопросы;
- next position корректен для 200 вопросов и любых filters/pages;
- archive/restore безопасны и корректно отражаются в counts/history;
- все 5 текущих admin E2E плюс новые regression cases зелёные;
- full build выполнен на свежем artifact;
- security/data-plane/answer-boundary проверки зелёные;
- нет незадокументированных P0/P1.

Финальный отчёт:

1. Existing vs added.
2. Root causes исправленных дефектов.
3. Files по commits.
4. API/DTO/RBAC/audit/rollback.
5. Полная test matrix с pass/fail/skip и точными командами.
6. Screenshot paths/viewports.
7. Оставшиеся P2 и реальные blockers.
8. Branch, HEAD и локальные commit SHA.
9. Последняя строка только после выполнения DoD: `READY FOR CODEX REVIEW`.

Не останавливайся после анализа: реализуй, проверь, исправь найденные регрессии
и подготовь рабочее дерево к проверке Codex.
