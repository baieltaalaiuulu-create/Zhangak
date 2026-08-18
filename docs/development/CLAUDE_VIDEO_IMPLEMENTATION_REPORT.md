# Claude — отчёт по доведению YouTube video vertical

**Ветка:** `fix/video-release-review`
**Base SHA:** `8ee374f6ba914e70f10696ec26c626ae6242cd4d`
**Модель:** Claude Opus 5 (`claude-opus-5`), effort maximum
**Production/VPS:** не изменялись, deploy не выполнялся

## 1. Что исправлено

| ID | Статус | Суть |
| --- | --- | --- |
| F1 | исправлено в коде, **нужен device-тест** | companion рендерит локальный документ под `baseUrl`, а не удалённый embed URL |
| F2 | **исправлено и доказано** | авторизация урока отделена от разрешения источника видео |
| F3 | **исправлено и доказано** | 015 даёт обратимый quarantine вместо `RAISE EXCEPTION` |
| F4 | **исправлено** | загрузка IFrame API с timeout, сбросом кэша и общим script tag |
| F5 | **частично**, остаточный риск зафиксирован | `frame-src` + `form-action`; `script-src` требует nonce-среза |
| F6 | **исправлено** | 13 Playwright-тестов на реальной вёрстке |
| F7 | **исправлено** | таблица восстановлена, три документа созданы |

### F1 — client identity в WebView

`mobile/components/LessonVideoPlayer.tsx` больше не грузит `uri` embed-а.
`mobile/lib/lessons.ts:youtubeEmbedDocument()` строит фиксированный локальный
документ, в который подставляется **только** уже проверенный 11-символьный id;
WebView рендерит его с `baseUrl = https://platform.zhangak.com`, что даёт
документу настоящий origin и Referer. Параметры: `enablejsapi=1`,
`playsinline=1`, `rel=0`, `origin=`. Referer не подавляется, deprecated
параметры не отправляются. Никакого server-supplied HTML.

Проверка: `npm --prefix mobile run check:video` (новый checker, 20 assertions).

**Release blocker:** реальное поведение YouTube на Android/iOS (ошибка 153) в
этом окружении подтвердить нельзя — нет устройств и Expo-сборки. Требуется
ручной device-тест до релиза. Тест **не** объявляется пройденным.

### F2 — события вложенного video material

`authorizedLessonVideo()` требовал `lessons.video_id` до обработки
`materialId`, поэтому у урока без собственного видео события материала
возвращали 404.

Разделено на `authorizedLesson()` (сессия → роль → online → активное
зачисление → published → unlocked) и `authorizedVideoSource()` (источник:
собственное видео урока либо материал, принадлежащий этому уроку, published,
`clean`, с verified `video_id`). Клиент не передаёт videoId, XP, score,
completion или identity; событие остаётся аналитикой.

Доказано интеграционными тестами на реальном PostgreSQL, включая чужой
`materialId`, `materialId` другого урока, другого курса, unpublished,
приостановленное зачисление, locked и unpublished lesson.

### F3 — quarantine и repair

015 больше не откатывает транзакцию. Итоговые состояния video-материала ровно
два, и это выражено в `lesson_materials_payload_shape`:

- **playable** — `video_id` есть, `external_url` канонический для этого id;
- **quarantine** — `video_id` NULL, строка **unpublished**, исходная ссылка
  сохранена.

Публикация из quarantine запрещена базой, а не только кодом. `PATCH
/v1/admin/materials/:materialId` принимает `externalUrl` и прогоняет замену
через тот же normalizer, после чего строка возвращается в canonical-состояние.
Админ видит `needsVideoRepair` и кнопку «Исправить ссылку». Для уроков добавлен
`lessons.video_quarantined`, и `publicLesson` вырезает такую ссылку, чтобы
нераспознанный YouTube-URL не отдавался ученику как обычная ссылка. Ничего не
удаляется и не угадывается.

### F4 — бесконечная загрузка

`lib/youtube-iframe-api.ts`: timeout 10 с, очистка таймера при success/error,
сброс кэшированного промиса при ошибке (иначе retry возвращал бы старый
reject), один script tag на конкурентные вызовы, немедленный resolve если API
уже загружен, сохранение чужого `onYouTubeIframeAPIReady`. Компонент не пишет
state после unmount.

### F5 — CSP (закрыт частично, осознанно)

Добавлены `frame-src` (ровно два origin YouTube) и `form-action 'self'`.
Сохранены `object-src 'none'`, `frame-ancestors 'self'`, `base-uri 'self'`.

`script-src` **не добавлен**, и это зафиксированный остаточный риск.
Доказательство: в production-сборке присутствуют inline `<script>` без nonce
(Next.js bootstrap + регистрация service worker). `script-src` без
`'unsafe-inline'` сломает приложение; `script-src` **с** `'unsafe-inline'`
разрешает ровно тот инжектированный inline-скрипт, против которого политика и
нужна, то есть был бы притворным усилением. Закрытие требует per-request nonce
из `proxy.ts`, протянутых в Next runtime, — отдельный архитектурный срез.

Синтаксис проверен: `nginx -t` в одноразовом контейнере `nginx:1.27-alpine` —
`syntax is ok / test is successful`. Browser smoke выполнен против
production-сборки Playwright-ом (login-страница поднимается, lesson page и
плеер работают), но **не** через сам nginx: локально nginx перед приложением не
поднимался, поэтому фактическая доставка заголовка проверяется оператором после
деплоя (`curl -I`).

### F6 — реальный render/a11y QA

`tests/e2e/lesson-video.spec.ts`, 13 тестов, production-сборка Next.js:

- 320/360/390/430/768/1280 — `scrollWidth <= clientWidth`, плеер ≥ 200×200;
- до клика **ноль** запросов к YouTube;
- Tab-фокус, видимый focus-ring (`outline-style != none`, ширина > 0);
- Enter и Space активируют воспроизведение;
- iframe: `youtube-nocookie`, точный `origin`, `enablejsapi/playsinline/rel`,
  отсутствие deprecated параметров, непустой `title`;
- 401 сессии → `role="alert"` + retry, **ни одного** iframe, video ID
  отсутствует в DOM;
- урок без видео не показывает плеер и не содержит watch-URL;
- собственных ссылок на YouTube в UI нет.

Границы честно: `/v1` и YouTube в этом наборе замоканы. Серверная авторизация
доказывается **отдельно** на реальном PostgreSQL, а не этим набором.

## 2. Тесты и результаты

| Команда | Результат |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors, 8 pre-existing warnings) |
| `npm run test:unit` | PASS 97/97 |
| `npm run check:security` | PASS |
| `npm run check:learning-boundary` | PASS |
| `npm run check:student-mobile-ux` | PASS |
| `npm run check:lesson-video` | PASS |
| `npm run check:own-backend` | PASS |
| `npm run check:web-data-plane` | PASS |
| `npm run check:mobile-data-plane` | PASS |
| `npm run check:first-party-auth` | PASS |
| `npm run check:migrations` | PASS (15 migrations) |
| `npm run check:emoji` | PASS |
| `npm run check:client-secrets` | PASS |
| `npm run audit:prod` | PASS |
| `npm --prefix backend run check` | PASS (75 files) |
| `npm --prefix backend test` | PASS 128/128 (включая 19 PostgreSQL-интеграционных) |
| `npm --prefix backend run verify:migrations` | PASS — 15 миграций, два прохода, disposable PG 16 |
| `npm --prefix mobile run check:auth` | PASS |
| `npm --prefix mobile run check:video` | PASS |
| `npm --prefix mobile exec tsc -- --noEmit` | PASS |
| `npx playwright test` | PASS 13/13 |
| `npm run build` | PASS |
| `nginx -t` (disposable container) | PASS |

Предупреждения `npm run lint` (8, все существовавшие до среза): 7 ×
`@next/next/no-img-element` в `app/landing/page.tsx` и `app/math/page.tsx`,
1 × `no-page-custom-font` в `app/layout.tsx`, 1 × неиспользуемая переменная в
`scripts/check-learning-boundary.mjs`. Число не выросло.

### Не выполнено

- `npm run package:standalone` / `npm run smoke:standalone` — **не выполнены**.
  Две независимые причины, обе связаны с файлами владельца, а не с этим срезом:

  1. `scripts/package-standalone.mjs:45` проверяет чистоту через
     `git status --porcelain=v1 --untracked-files=normal`, то есть **untracked
     файлы тоже считаются грязью**. В рабочем дереве лежат `test_for_students/`
     и `docs/development/CLAUDE_VIDEO_FIX_AUDIT_PROMPT.md` — оба принадлежат
     владельцу, добавлять или удалять их запрещено.
  2. До коммитов пакетчик дополнительно отклонял артефакт из-за локального
     `.env`, который Next копирует в `.next/standalone/`
     (`possible secret files found in standalone root: .env`). Файл содержит
     ключ выведенного из эксплуатации Supabase; перемещать чужой файл с
     секретом я не стал.

  На чистом CI-checkout ни того, ни другого нет, поэтому шаг должен пройти в
  CI. До результата CI считать **pending**. `ALLOW_DIRTY_RELEASE=1` для обхода
  не использовался: он существует только для локальной диагностики.
- Реальный Android/iOS device-тест (F1) — pending, release blocker.
- Playwright не подключён к GitHub CI (требует шага установки браузера);
  запускается локально `npm run test:e2e`. Отдельный follow-up.

## 3. Self-audit

Формат: `id | severity | file:line | invariant | evidence | resolution`.

```
A1 | P1 | backend/src/routes/platform-learning.js:1016 | material analytics must be authorized independently of the lesson's own video | material-only lesson returned 404 for every event; no test covered materialId != null | FIXED — authorizedLesson/authorizedVideoSource split, proven by PG integration tests
A2 | P1 | backend/migrations/015:  | a legacy row must stay repairable | RAISE EXCEPTION rolled back the unpublish, so the admin repair route was unreachable | FIXED — two-state constraint, no exception path
A3 | P1 | mobile/components/LessonVideoPlayer.tsx | embedded player needs client identity | remote uri gives no Referer/origin -> YouTube error 153 | FIXED in code; device verification PENDING (blocker)
A4 | P2 | components/student/LessonVideo.tsx | a hung API must not spin forever | no timeout, cached rejected promise poisoned retry | FIXED — bounded loader + unit tests
A5 | P2 | backend/src/routes/platform-learning.js (publicLesson) | quarantined URL must not reach a student | an undecodable YouTube content_url would have been served as a plain link | FIXED — lessons.video_quarantined
A6 | P2 | deploy/nginx/zhangak.conf | XSS policy | no script-src; inline Next bootstrap has no nonce | ACCEPTED RESIDUAL RISK — pretend hardening refused, nonce slice tracked
A7 | P3 | backend/src/routes/platform-learning.js:313 (base) | no dead security helpers | assertNoRawVideoUrl exported with zero callers implied a control that ran nowhere | FIXED — removed
A8 | P3 | migration 015 unique index | analytics keys must distinguish sources | two materials with the same video on one lesson collapsed | FIXED — COALESCE(material_id, 0) in the key
A9 | P3 | app/admin/lessons/[id]/materials/page.tsx | repair UX | window.prompt is crude for an admin tool | ACCEPTED — functional and bounded; a proper form is a UX follow-up
A10 | P3 | mobile/components/LessonVideoPlayer.tsx | originWhitelist | ['https://*'] is broader than the single embed host needs | ACCEPTED — the document is local and its iframe src is fixed
```

Проверено отдельно и без находок: enrollment isolation (PG-тесты), отсутствие
raw URL/admin-полей в student DTO, отсутствие client-authoritative XP или
completion, CSRF (access cookie `SameSite=Lax` не отправляется при cross-site
POST), лимиты тела запроса (2 000 / 4 000 байт), идемпотентность событий,
host routing, отсутствие Supabase и client secrets (`check:own-backend`,
`check:web-data-plane`, `check:mobile-data-plane`, `check:client-secrets`).

**P0/P1 blockers в коде не осталось.** Единственный незакрытый пункт —
верификация A3 на реальном устройстве, это проверка, а не дефект кода.

## 4. Push

Команда: `git push -u origin fix/video-release-review`

Результат записан в разделе ниже после выполнения.

## 5. Ручной QA, который всё ещё обязателен

1. Android и iOS: воспроизведение видео в установленном companion (ошибка 153).
2. Реальное устройство: 320/360/390/430 px в установленной PWA.
3. После деплоя: `curl -I` подтверждает доставку CSP-заголовка nginx-ом.
4. Проверка админом: карантинный материал не публикуется до замены ссылки.
