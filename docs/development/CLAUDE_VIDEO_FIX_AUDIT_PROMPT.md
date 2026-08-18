# Claude prompt — исправление, проверка и публикация video vertical

Скопируй Claude весь блок ниже без сокращений.

```text
Ты работаешь как senior engineer и security reviewer Zhangak. Твоя задача —
довести уже реализованный YouTube video vertical до проверенного release
candidate, устранить подтверждённые дефекты, выполнить независимый self-audit,
сделать небольшие commits и попытаться запушить отдельную ветку в GitHub.

Это не разрешение на deployment, подключение к production DB, изменение VPS,
импорт или публикацию 18 учебных видео. Не деплой. Не используй production
secrets. Не возвращай Supabase.

## 1. Репозиторий и git safety

Канонический репозиторий:

  C:\Users\user\Documents\Zhangak

Перед любыми изменениями полностью прочитай:

- CLAUDE.md
- docs/development/CLAUDE_HANDOFF.md
- docs/development/AI_AGENT_EXECUTION_PLAN.md
- docs/development/CLAUDE_YOUTUBE_PLAYER_PROMPT.md
- docs/operations/lesson-video.md
- backend/migrations/015_lesson_video_sources.sql
- backend/src/youtube.js
- backend/src/routes/platform-learning.js
- backend/src/routes/admin-learning.js
- components/student/LessonVideo.tsx
- lib/lesson-video.ts
- mobile/components/LessonVideoPlayer.tsx
- mobile/lib/lessons.ts
- backend/test/lesson-video.test.js
- tests/learning/lesson-video.test.ts
- scripts/check-lesson-video.mjs
- deploy/nginx/zhangak.conf

Затем выполни только read-only команды:

  git status --short --branch
  git rev-parse HEAD
  git log --oneline --decorate -8
  git branch -vv

Ожидаемый реализованный video baseline находится в локальной ветке
`p0/reconcile-production` на commit `8ee374f6ba914e70f10696ec26c626ae6242cd4d`:

- `925d1733d5c0c4a3e7b4bad9ab9fef61c5825ee7`
- `8ee374f6ba914e70f10696ec26c626ae6242cd4d`

Ветка `content/phase-0-preflight` содержит отдельную работу Gemini поверх этого
baseline. Не смешивай её с video fix. Папка `test_for_students/` принадлежит
владельцу: не изменяй, не удаляй и не добавляй её в git.

Если `p0/reconcile-production` не указывает на ожидаемый SHA, есть неизвестные
tracked changes или переключение ветки может затронуть пользовательские файлы —
остановись и напиши `BLOCKED_GIT_STATE.md`. Не используй reset, checkout --,
clean, stash, force push или удаление файлов.

Если состояние безопасно, создай отдельную ветку:

  git switch -c fix/video-release-review p0/reconcile-production

Если ветка уже существует, не перезаписывай её. Проверь её SHA и остановись при
неожиданном состоянии.

## 2. Подтверждённые findings, которые нужно исправить

### F1 — mobile WebView client identity / YouTube error 153

`mobile/components/LessonVideoPlayer.tsx` сейчас открывает прямой embed URL без
доказанного HTTP Referer/client identity и без `origin`. Для WebView YouTube
требует Referer или эквивалентную идентификацию; иначе воспроизведение может
завершиться error 153.

Исправь по официальному контракту YouTube:

- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/player_parameters

Для React Native WebView используй поддерживаемый подход, который реально
передаёт identity на Android и iOS: например, локальный bounded HTML document с
доверенным `baseUrl`/origin либо документированный Referer header. Не вставляй
непроверенный HTML от сервера. Video ID обязан сначала пройти существующий
11-character parser. Добавь `origin`, `playsinline=1`, `rel=0`; не добавляй
deprecated параметры. Не обещай DRM.

Добавь тесты/checker, которые охватывают именно `mobile/`, а не только web.
Если реальное Android/iOS поведение нельзя подтвердить в текущем окружении,
запиши это как release blocker в отчёт, а не объявляй тест пройденным.

### F2 — события вложенного video material возвращают 404

В `POST /v1/platform/video-events` сначала вызывается
`authorizedLessonVideo()`, который требует `lessons.video_id`, и только потом
обрабатывается `materialId`. Поэтому опубликованный video material может
проигрываться, но его `started/ended` не сохраняются, если у самого урока нет
главного video_id.

Раздели авторизацию доступного/unlocked урока и проверку источника видео:

- `materialId === null`: требуй проверенный `lesson.video_id`;
- `materialId !== null`: требуй, чтобы material принадлежал этому уроку, был
  `video`, `clean`, published и имел verified `video_id`;
- во всех случаях повторно проверяй current student, active online enrollment,
  published/unlocked lesson;
- клиент не передаёт videoId, XP, score, completion или identity;
- событие остаётся аналитикой и не выдаёт XP/звёзды.

Добавь настоящий regression test на material-only lesson. Проверь также случай
чужого materialId и materialId от другого lesson.

### F3 — migration 015 не позволяет безопасно исправить legacy video row

Миграция сначала снимает нераспознанное video с публикации, затем RAISE
EXCEPTION откатывает всю транзакцию. Admin repair route после этого недоступен,
потому что migration не применена.

Миграция 015 ещё не применена в production и не запушена в origin, поэтому её
можно исправить до выпуска. Сделай согласованный reversible quarantine flow:

- распознанные video rows получают canonical video_id и canonical URL;
- нераспознанные legacy video rows сохраняются, становятся unpublished и не
  могут быть отданы ученику;
- DB constraint допускает только строго ограниченное unpublished quarantine
  состояние с NULL video_id либо canonical playable состояние;
- admin видит, что ссылка требует исправления, и может безопасно заменить её
  через normalizer; после исправления строка снова удовлетворяет canonical
  constraint;
- publish с NULL video_id остаётся запрещён;
- student DTO/session никогда не отдаёт quarantine URL;
- никакого удаления или угадывания video ID.

Добавь PostgreSQL integration tests для valid backfill, invalid quarantine,
repair и запрета publish до repair. Не ограничивайся regex-проверкой SQL text.

### F4 — бесконечное состояние загрузки IFrame API

`components/student/LessonVideo.tsx` ждёт global callback без timeout. Добавь
bounded timeout и корректный retry:

- timeout очищается при success/error/unmount;
- rejected global promise сбрасывается, чтобы retry действительно повторял
  загрузку;
- не создавай несколько script tags при параллельных кликах/компонентах;
- если API уже загрузился, resolve немедленно;
- не перезаписывай навсегда чужой `onYouTubeIframeAPIReady`;
- student получает честный error/retry state.

Добавь deterministic unit test для success, network error, timeout и retry.

### F5 — CSP выполнен частично

Текущий patch ограничивает только `frame-src`, но player загружает внешний
IFrame API script. Проведи evidence-based CSP review. Нельзя просто добавить
директивы, которые ломают Next.js inline bootstrap или другие first-party
функции.

Минимальный результат:

- `frame-src` только необходимые YouTube origins;
- `script-src` разрешает first-party runtime и официальный IFrame API без
  wildcard;
- `connect-src`/`img-src` не расширяются без доказанной необходимости;
- `object-src 'none'`, `frame-ancestors`, host routing и auth остаются;
- `nginx -t` или эквивалентный disposable syntax test;
- browser smoke подтверждает, что login, lesson page и player не сломаны.

Если безопасный nonce-based CSP требует отдельного архитектурного среза, не
делай притворное «усиление». Зафиксируй точный residual risk и отдельный backlog
item, но не называй F5 полностью закрытым.

### F6 — реальный responsive/accessibility QA отсутствует

`check:lesson-video` проверяет строки исходников, а не отрисованный интерфейс.
Добавь Playwright/browser acceptance test либо другой воспроизводимый render
test для web player:

- widths 320, 360, 390, 430, 768 и desktop;
- `scrollWidth <= clientWidth`;
- play/retry доступны Tab и Enter/Space;
- focus-visible не скрыт;
- iframe имеет accessible title;
- controls не перекрыты;
- до клика нет запросов к YouTube;
- после logout/revoked session config возвращает 401;
- другой course, locked lesson, unpublished material не получают config;
- spoofed ended не меняет XP/completion.

Внешний YouTube network можно стабильно mock-нуть, но server authorization и
layout assertions не подменяй одной проверкой текста. Отдельно перечисли, что
всё ещё требует ручного real-device test.

### F7 — документация и release packet

Исправь сломанную Markdown-таблицу в
`docs/education/content-authoring.md`: абзац про video сейчас разрывает таблицу
«Обновление контента» перед строками «Новый PDF» и «Жалоба ученика».

Создай и заполни:

- `docs/development/PRECHECK_CLAUDE_VIDEO.md` — восстановленный factual precheck
  для этого review cycle;
- `docs/development/CLAUDE_VIDEO_IMPLEMENTATION_REPORT.md`;
- `docs/development/DEPLOYMENT_CANDIDATE.md`.

Обязательно укажи фактические model display name/model ID/version/effort, base
SHA, head SHA, branch, commits, changed files, migrations, tests, skipped tests,
known limitations, security review, rollback, deployment order и remaining
manual QA. Не выдумывай выполненные проверки.

## 3. Тестирование

После правок выполни полный suite из CLAUDE_HANDOFF, минимум:

  npm run typecheck
  npm run lint
  npm run test:unit
  npm run check:security
  npm run check:learning-boundary
  npm run check:student-mobile-ux
  npm run check:lesson-video
  npm run check:own-backend
  npm run check:web-data-plane
  npm run check:mobile-data-plane
  npm run check:first-party-auth
  npm run check:migrations
  npm run audit:prod
  npm --prefix backend run check
  npm --prefix backend test
  npm --prefix backend run verify:migrations
  npm --prefix mobile run check:auth
  npm --prefix mobile exec tsc -- --noEmit --pretty false
  npm run build
  npm run package:standalone
  npm run smoke:standalone

`verify:migrations` должен выполняться на disposable PostgreSQL и применить все
миграции дважды. Никогда не направляй его на production. Если локальный Docker
недоступен, используй GitHub CI PostgreSQL job после push; до его результата
пометь migration verification как pending.

Не считай warning ошибкой автоматически, но перечисли warnings. Не меняй
unrelated код только ради косметической чистоты.

## 4. Финальный self-audit до commit

После реализации переключись в режим независимого reviewer и перечитай весь
diff от `8ee374f`. Найди проблемы по формату:

  id | severity | file:line | invariant | evidence | reproduction |
  suggested_test | resolution

Проверь отдельно:

- auth/RBAC/enrollment isolation;
- raw URL/admin metadata leakage;
- XP/completion authority;
- migration rollback/legacy rows;
- CSRF/body limits/idempotency;
- WebView Referer/origin;
- CSP/host routing;
- error/retry/unmount races;
- responsive/a11y;
- отсутствие Supabase и client secrets.

Каждый finding классифицируй как fixed, accepted residual risk или blocker.
Если остался P0/P1 blocker — не push как готовый release; сделай WIP commit и
пометь ветку BLOCKED в отчёте.

## 5. Commits и push

Сделай небольшие логические commits, например:

1. `fix(video): authorize material analytics independently`
2. `fix(video): identify mobile webview embeds`
3. `fix(video): quarantine and repair legacy sources`
4. `test(video): add rendered and migration acceptance coverage`
5. `docs(video): record audit and release candidate`

Перед commit покажи `git diff --check` и `git status --short`. Не добавляй
`test_for_students/`, `.env`, keys, build artifacts, screenshots с PII или
production dumps.

После всех локальных проверок выполни обычный non-force push:

  git push -u origin fix/video-release-review

Запрещены `--force`, изменение main, merge, PR merge, deployment и SSH на VPS.

Если push не получился из-за credentials/network/permissions:

- не повторяй опасными способами;
- не меняй remote URL;
- сохрани локальные commits;
- запиши точную команду и безопасно очищенное сообщение ошибки в
  `CLAUDE_VIDEO_IMPLEMENTATION_REPORT.md`;
- в финальном ответе дай branch, HEAD SHA и список commits. Основной инженер
  выполнит push отдельно.

Если push успешен, дождись GitHub CI. Не объявляй release candidate готовым,
пока PostgreSQL migration job, web/backend/mobile/security/build/package/smoke
jobs не зелёные. Если CI красный — исследуй logs, исправь только относящиеся к
этому срезу проблемы, повтори tests и push новым commit без переписывания
истории.

## 6. Финальный ответ

Верни владельцу:

1. короткий outcome;
2. branch и полный HEAD SHA;
3. commits;
4. какие F1–F7 исправлены;
5. все тесты с результатами;
6. CI URL/status, если push успешен;
7. blockers/residual risks/manual QA;
8. подтверждение: production/VPS не изменялись, deployment не выполнялся;
9. рекомендацию GO или NO-GO для независимого инженерного review.

Не скрывай неуспешные или непроведённые тесты. Не пиши «100% готово» без
доказательств.
```

