# Deployment candidate — YouTube video vertical

Это **кандидат**, а не разрешение на деплой. Production actions выполняет
только основной Codex-инженер.

```text
agent_product:            Claude Code
model_display_name:       Claude Opus 5
model_id:                 claude-opus-5
model_version:            не публикуется интерфейсом; документация Anthropic на
                          дату handoff перечисляет Opus 4.8, поэтому «Opus 5»
                          следует считать product-specific preview/alias
thinking_level:           maximum effort
base_sha:                 8ee374f6ba914e70f10696ec26c626ae6242cd4d
head_sha:                 см. tip ветки; CI подтверждён на 394b2063fb1d8170a960c906bc66b76c0e5a1559
                          и повторно на финальном commit этого файла
branch:                   fix/video-release-review
```

## Commits

1. `a27c896` fix(video): authorize material analytics independently
2. `9fd2537` fix(video): identify mobile webview embeds
3. `39b260a` fix(video): quarantine and repair legacy sources
4. `9625450` test(video): add rendered and migration acceptance coverage
5. `65c098d` docs(video): record audit and release candidate
6. `394b206` docs(video): state the exact packaging blocker
7. финальный commit этого файла — результаты CI

## Scope

Доведение уже реализованного YouTube video vertical до release candidate:
разделение авторизации аналитики, client identity для WebView, обратимый
quarantine legacy-ссылок, ограниченная загрузка IFrame API, частичное усиление
CSP, реальные render/PostgreSQL тесты и документация.

**Вне scope:** импорт и публикация 18 учебных видео, production DB, VPS,
secrets, deploy.

## Files changed

```
.github/workflows/ci.yml
.gitignore
app/admin/lessons/[id]/materials/page.tsx
backend/migrations/015_lesson_video_sources.sql
backend/src/routes/admin-learning.js
backend/src/routes/platform-learning.js
backend/test/admin-learning.test.js
backend/test/lesson-video.test.js
backend/test/lesson-video-integration.test.js   (new)
backend/test/platform-learning.test.js
components/student/LessonVideo.tsx
deploy/nginx/zhangak.conf
docs/development/CLAUDE_VIDEO_IMPLEMENTATION_REPORT.md   (new)
docs/development/DEPLOYMENT_CANDIDATE.md                 (new)
docs/development/PRECHECK_CLAUDE_VIDEO.md                (new)
docs/education/content-authoring.md
lib/admin-learning-client.ts
lib/youtube-iframe-api.ts                                (new)
mobile/components/LessonVideoPlayer.tsx
mobile/lib/lessons.ts
mobile/package.json
mobile/scripts/check-video-embed.mjs                     (new)
package.json
package-lock.json
playwright.config.ts                                     (new)
tests/e2e/lesson-video.spec.ts                           (new)
tests/learning/youtube-iframe-api.test.ts                (new)
```

## Migrations added

`backend/migrations/015_lesson_video_sources.sql` — единственная новая
forward-only миграция. Не применена в production и на момент подготовки
кандидата не была запушена, поэтому исправлялась внутри этого цикла.
Применённые миграции (001–014) не редактировались.

Содержимое: `lesson_materials.video_id`, `lessons.video_id`,
`lessons.video_quarantined`, замена `lesson_materials_payload_shape` (forward-fix
неработоспособной video-ветки из 006), таблица `lesson_video_events`, индексы.

## env names added

Нет новых runtime-переменных.

Только для тестов: `ZHANGAK_TEST_DATABASE_URL` — указывает на **одноразовую**
базу; suite отказывается работать, если имя базы не читается как disposable.
Значения не приводятся.

## data_backfill_required

Да, выполняется самой миграцией и не требует ручного шага:

- распознанные ссылки получают `video_id` и канонический URL;
- нераспознанные сохраняются, помечаются quarantine и снимаются с публикации;
- падения миграции на таких строках нет.

## Tests run / passed

См. таблицу в `CLAUDE_VIDEO_IMPLEMENTATION_REPORT.md` §2. Кратко: typecheck,
lint, unit 97/97, backend 128/128 (в т. ч. 19 PostgreSQL-интеграционных),
`verify:migrations` (15 миграций × 2 прохода на чистом PG 16), mobile auth/video
checks, mobile tsc, Playwright 13/13, build, `nginx -t` — все PASS.

## Tests skipped and why

| Тест | Причина |
| --- | --- |
| `package:standalone`, `smoke:standalone` | локально невозможно: пакетчик считает грязью и untracked файлы, а в дереве лежат `test_for_students/` и prompt-файл владельца, которые трогать нельзя (плюс локальный `.env` блокируется secret-guard). `ALLOW_DIRTY_RELEASE=1` не использовался. **Выполнено в GitHub CI на чистом checkout — оба шага зелёные.** |
| Android/iOS device playback | нет устройства и Expo-сборки в окружении. **Release blocker.** |
| Playwright в GitHub CI | требует шага установки браузера; локально воспроизводимо `npm run test:e2e`. Follow-up. |
| Доставка CSP-заголовка через реальный nginx | локально nginx перед приложением не поднимался; проверяется оператором `curl -I` после деплоя. |

## Known limitations

1. Video ID неизбежно попадает в браузер — это не DRM (T2/T3).
2. `script-src` отсутствует в CSP; нужен отдельный nonce-срез (T11).
3. DTO-breaking для установленного старого Expo-клиента: видео-материал вызовет
   `NativeDtoError` до обновления приложения.
4. Откат миграции 015 после публикации видео вернёт неработоспособную
   video-ветку из 006 — считать forward-only.

## Security review

Выполнен, оформлен в `CLAUDE_VIDEO_IMPLEMENTATION_REPORT.md` §3 (A1–A10).
P0/P1 дефектов в коде не осталось; A3 требует подтверждения на устройстве.

## Human approvals required

1. Принятие остаточного риска обнаружения и распространения video ID.
2. Подтверждение, что `lessons.content_url` остаётся допустимым источником
   видео наряду с `lesson_material type=video`.
3. Успешный Android/iOS device-тест.
4. Решение по nonce-based CSP как отдельной вертикали.

## Rollback notes

- Rollback target: `d87c19f` (последний commit до video vertical).
- Откат кода без отката 015 безопасен: старый код игнорирует новые колонки.
- Откат самой 015 не выполнять после публикации видео-материалов.
- Порядок деплоя: backup → миграция → API → web, одним SHA, с сохранением
  `previous`.

## CI

Run: https://github.com/baieltaalaiuulu-create/Zhangak/actions/runs/32181910077
Триггер: `workflow_dispatch` на ветке (CI настроен на `push: [main]` и
`pull_request`, поэтому push обычной ветки его не запускает; PR не создавался).

Результат: **success**. Оба job зелёные — `verify` и
`Verify PostgreSQL migrations`, включая `Package standalone release`,
`Smoke-test standalone release` и новый шаг
`Run PostgreSQL-backed lesson video integration tests`.

Единственная аннотация — предупреждение GitHub о deprecation Node.js 20 в
`actions/checkout@v4` / `actions/setup-node@v4`. Оно существовало до этого
среза и к нему не относится.

## production_actions_requested

```
none
```

Ни одно production-действие не выполнялось и не запрашивается. VPS, production
DB, secrets и release symlink не затрагивались.
