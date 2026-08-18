# Gate C0 — архитектурный preflight YouTube video flow

**Цикл:** review и доведение уже реализованного video vertical.
**Статус:** preflight выполнен, дефекты подтверждены, реализация выполнена в
Gate C1 этого же цикла (см. `CLAUDE_VIDEO_IMPLEMENTATION_REPORT.md`).

## 0. Идентификация агента и рабочей области

| Поле | Значение |
| --- | --- |
| `agent_product` | Claude Code |
| `model_display_name` | Claude Opus 5 |
| `model_id` | `claude-opus-5` |
| `effort` | maximum |
| `base_sha` | `8ee374f6ba914e70f10696ec26c626ae6242cd4d` |
| `base_ref` | tip ветки `p0/reconcile-production` |
| `base_status` | tracked tree clean |
| `branch` | `fix/video-release-review` |

Замечание о model ID, как требует execution plan §4: интерфейс сообщает
`claude-opus-5`. Публичная документация Anthropic на дату handoff перечисляет
Opus 4.8, поэтому `Opus 5` следует считать product-specific preview/alias.
Записано как есть, без сокрытия.

### 0.1 Read-only git state на входе

```
git status --short --branch   ## content/phase-0-preflight
                              ?? docs/development/CLAUDE_VIDEO_FIX_AUDIT_PROMPT.md
                              ?? test_for_students/
git rev-parse HEAD            231c9a16db5c2caa032b235f0ae9bf25e847913f
git branch -vv                p0/reconcile-production 8ee374f [ahead 2]
                              content/phase-0-preflight 231c9a1
                              main 8cb56ac
```

Ожидаемый baseline подтверждён: `p0/reconcile-production` = `8ee374f`, содержит
`925d173` и `8ee374f`. Ветка `content/phase-0-preflight` (работа Gemini) —
**не предок** `p0/reconcile-production` и в этот цикл не входит.
`test_for_students/` принадлежит владельцу и не трогалась.

### 0.2 Инверсия гейтов

Execution plan предполагает C0 → C1. Фактически исходная реализация video
vertical уже содержалась в base SHA (`925d173`, `8ee374f`). Поэтому данный
preflight — аудит существующей реализации, а не greenfield-план.

## 1. Текущий data flow: admin -> DB -> student DTO -> player

```
admin UI  ──POST /v1/admin/lessons/:id/materials──▶ parseMaterialTextBody
                                                     youtubeVideoSource()
                                                       normalizeYoutubeVideoId()   backend/src/youtube.js
                                                       canonicalYoutubeWatchUrl()
                                                   INSERT lesson_materials(external_url, video_id)

          ──PATCH /v1/admin/materials/:id──────────▶ publish / hide / repair (normalizer)

DB        lessons.video_id, lessons.video_quarantined
          lesson_materials.video_id
          lesson_materials_payload_shape: playable ИЛИ unpublished quarantine
          lesson_video_events (аналитика, идемпотентна по суткам Bishkek)

student   publicLesson()          contentUrl вырезается при lock / video_id / quarantine
DTO       publicLessonMaterial()  external_url отсутствует; только { available, sessionPath }

session   POST /v1/platform/lessons/:id/video
          POST /v1/platform/materials/:id/video
          POST /v1/platform/video-events
          → currentStudent → active online enrollment → published lesson → unlocked
          → для материала: принадлежит уроку, published, clean, video_id NOT NULL

player    components/student/LessonVideo.tsx (общий desktop+mobile)
          mobile/components/LessonVideoPlayer.tsx (локальный документ + baseUrl)
          youtube-nocookie, загрузка только после клика
```

## 2. Threat model

| # | Угроза | Контроль | Статус |
| --- | --- | --- | --- |
| T1 | Чужой ученик получает видео | session → role → enrollment → lock, повторно на каждом запросе | закрыт, доказан PG-тестами |
| T2 | Ученик достаёт video ID | минимизированный DTO, POST-сессия | **принимаемый остаточный риск** |
| T3 | Распространение id вовне | отсутствует | **принимаемый остаточный риск** |
| T4 | Playlist/shorts/live/канал | normalizer + DB constraint | закрыт |
| T5 | Lookalike-домен, protocol trick | точный host-set, запрет credentials/порта/fragment | закрыт |
| T6 | Подделка `ended` ради XP | события не читаются grading-путями | закрыт |
| T7 | Клиент подделывает identity/videoId | id из сессии, video_id server-derived | закрыт |
| T8 | Утечка quarantine URL ученику | `video_quarantined` вырезает contentUrl; материал не публикуется | закрыт |
| T9 | Framing/clickjacking | `frame-ancestors 'self'`, `frame-src` — два origin | закрыт |
| T10 | Трекинг до согласия | nocookie + загрузка по клику | закрыт до клика |
| T11 | XSS через inline-скрипты | — | **открыт**, см. F5 |
| T12 | WebView без identity (error 153) | локальный документ + baseUrl + origin | код готов, **нужен device-тест** |

## 3. Точные файлы, schema и API

**Schema (миграция 015, не применена в production, не запушена — правится):**
`lesson_materials.video_id`, `lessons.video_id`, `lessons.video_quarantined`,
замена `lesson_materials_payload_shape`, таблица `lesson_video_events`.

**API:** `POST /v1/platform/{lessons,materials}/:id/video`,
`POST /v1/platform/video-events`, `PATCH /v1/admin/materials/:materialId`
(publish/hide/repair).

**Файлы:** `backend/src/youtube.js`, `backend/src/routes/platform-learning.js`,
`backend/src/routes/admin-learning.js`, `lib/lesson-video.ts`,
`lib/youtube-iframe-api.ts`, `components/student/LessonVideo.tsx`,
`mobile/lib/lessons.ts`, `mobile/components/LessonVideoPlayer.tsx`,
`deploy/nginx/zhangak.conf`.

## 4. Совместимость и rollback

| Риск | Оценка | Действие |
| --- | --- | --- |
| DTO-breaking: `externalUrl` исчез из материалов | средний | web и Expo обновлены одним срезом; старый установленный Expo выбросит `NativeDtoError` |
| 015 ужесточает constraint | низкий | quarantine-состояние допускается, миграция не падает |
| Откат кода без отката 015 | безопасен | старый код игнорирует новые колонки |
| Откат 015 после публикации видео | потеря | ветка video в 006 неработоспособна; фиксируется как forward-only |

Rollback target: `d87c19f`.

## 5. План commits

1. `fix(video): authorize material analytics independently`
2. `fix(video): identify mobile webview embeds`
3. `fix(video): quarantine and repair legacy sources`
4. `test(video): add rendered and migration acceptance coverage`
5. `docs(video): record audit and release candidate`

## 6. План тестов

| Уровень | Что доказывает |
| --- | --- |
| `backend/test/lesson-video.test.js` | нормализация URL, проекции DTO, форма событий |
| `backend/test/lesson-video-integration.test.js` (PostgreSQL) | авторизация, изоляция курсов, quarantine/repair, идемпотентность |
| `tests/learning/lesson-video.test.ts` | клиентский контракт, отказ от raw URL |
| `tests/learning/youtube-iframe-api.test.ts` | timeout, retry, конкурентность загрузки API |
| `tests/e2e/lesson-video.spec.ts` (Playwright) | реальная вёрстка 320–1280, клавиатура, focus, отсутствие запросов до клика |
| `mobile/scripts/check-video-embed.mjs` | identity/параметры companion-embed |

## 7. Что осталось владельцу

1. Принять T2/T3.
2. Подтвердить, остаётся ли `lessons.content_url` допустимым источником видео
   наряду с `lesson_material type=video`.
3. Реальный Android/iOS device-тест (T12) — release blocker.
4. Решение по nonce-based CSP (T11) как отдельной вертикали.
