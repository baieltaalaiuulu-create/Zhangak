# Жёсткий prompt для Claude — защищённый YouTube player Zhangak

Скопируйте весь блок ниже в Claude после передачи
`docs/development/CLAUDE_HANDOFF.md`.

**Рекомендуемая модель:** Claude Sonnet 5 с высоким effort для основной
реализации. Для финального security/threat-model review при доступном бюджете —
отдельный проход Claude Opus 4.8 без автоматического применения его правок.

```text
Ты работаешь в каноническом репозитории C:\Users\user\Documents\Zhangak.
Сначала полностью прочитай:

1. docs/development/CLAUDE_HANDOFF.md
2. docs/development/architecture.md
3. docs/operations/private-material-storage.md
4. docs/education/content-authoring.md
5. backend/migrations/006_course_delivery_enrollments_and_materials.sql
6. backend/src/routes/admin-learning.js
7. backend/src/routes/platform-learning.js
8. app/student/online/lessons/[id]/page.tsx
9. components/student/mobile/MobileLessonVideo.tsx

После чтения проверь git status, HEAD, существующие тесты и фактический live
контракт. Не начинай с переписывания UI. Не возвращай Supabase.

## Цель вертикального среза

Сделай единый production-ready YouTube player для опубликованных online-уроков.
Видео создаёт admin/super-admin как lesson_material type=video. Ученик может
смотреть его только при active online enrollment и доступном/unlocked уроке.
Плеер должен быть responsive и безопасно работать в browser/PWA на 320, 360,
390, 430, 768 px и desktop.

## Непереговорные ограничения

1. Не обещай DRM и полное сокрытие YouTube URL. Browser обязан получить video
   ID/embed URL, поэтому технически подготовленный пользователь может увидеть
   его в DevTools/network. Зафиксируй это в документации и UI не называй такую
   защиту «невозможно скачать» или «ссылка полностью скрыта».
2. Реальная граница защиты — авторизация Zhangak, active enrollment, unlocked
   lesson, отсутствие прямой watch-ссылки в UI и server-side audit.
3. Не проксируй видео-трафик через Zhangak, не скачивай и не перезаливай YouTube
   видео, не обходи YouTube Terms.
4. Не пытайся перекрыть YouTube controls прозрачными overlay, блокировать
   accessibility или ломать required player functionality.
5. `correct_answer`, XP, lesson completion и платёжный статус не должны стать
   client-authoritative из-за событий плеера.
6. Не возвращай raw external_url в общем public lesson/material DTO, если UI
   может работать через scoped video session/material projection. Не делай
   security by obscurity: даже после минимизации DTO документируй остаточное
   ограничение YouTube embeds.
7. Никаких секретов, API keys или signed DB credentials в browser bundle.

## Требуемый design

Сначала напиши короткий implementation plan с точными файлами, schema/API
изменениями, threat model и тестами. Затем реализуй:

### Backend

- Нормализуй только `youtube.com/watch?v=`, `youtu.be/` и допустимые YouTube
  embed URLs в один проверенный 11-character video ID.
- Reject protocol tricks, credentials, fragments, lookalike domains, arbitrary
  iframe HTML, playlists, shorts/live URLs без отдельного контракта.
- Admin хранит каноническую video reference только server-side.
- Student video endpoint/session должен повторно проверить:
  authenticated user -> student role -> active online enrollment -> published
  material -> clean/published state -> published and unlocked lesson.
- Отдавай минимальный player config. Никогда не отдавай admin metadata,
  unpublished material или другой course.
- Любой progress event idempotent и принадлежит текущему user/material. Событие
  `ended` может быть аналитикой, но само по себе не выдаёт XP и не завершает
  защищённый lesson/test flow.
- Добавь audit только для значимых server events без хранения лишнего PII.
- Используй forward-only migration, только если текущей schema недостаточно.
  Никогда не редактируй 006 или уже применённые migrations.

### Web player

- Используй официальный YouTube IFrame Player API и
  `https://www.youtube-nocookie.com/embed/{id}` для privacy-enhanced embed.
- Укажи `enablejsapi=1`, точный `origin=https://platform.zhangak.com`,
  `playsinline=1`, `rel=0` и только реально поддерживаемые параметры.
- Не используй deprecated `modestbranding`, `showinfo`, `autohide`.
- Не подавляй HTTP Referer: YouTube требует Referer для embedded player.
- Загружай iframe/API только после явного клика «Смотреть», чтобы не отправлять
  third-party запрос до действия ученика.
- Сохрани keyboard controls, focus-visible, accessible name, captions и
  fullscreen. Добавь honest error/retry state.
- Соблюди официальный minimum player viewport 200x200. На узком телефоне не
  допускай горизонтальный scroll; на широких экранах используй 16:9.
- Не показывай кнопку/anchor «Открыть на YouTube» в собственном UI. Если YouTube
  сам покажет переход, не пытайся незаконно скрывать или перекрывать его.
- CSP должна разрешать только необходимые YouTube frame/script/image/connect
  origins и не ослаблять остальные host boundaries.
- Один shared component должен использоваться desktop/mobile, чтобы поведение
  не расходилось.

### Ограничение YouTube

В документации явно напиши:

- unlisted video скрыт из поиска, но доступен любому, у кого есть ссылка;
- обычный YouTube embed не является DRM;
- allowlist доменов доступен только отдельным YouTube Studio Content Manager
  партнёрам и не является гарантированным решением для Zhangak;
- если владельцу понадобится настоящая защита, отдельный будущий проект —
  собственный video hosting/CDN с signed HLS/DASH и DRM. Не внедряй его сейчас.

## Acceptance tests

Обязательно добавь automated tests, которые доказывают:

1. invalid/lookalike YouTube URLs rejected;
2. student A не получает video material курса student B;
3. inactive enrollment, locked lesson, unpublished material -> 403/404;
4. public lesson/material JSON не содержит raw watch URL или admin fields;
5. iframe config использует youtube-nocookie, exact origin и не использует
   deprecated параметры;
6. 320/360/390/430/768 px без horizontal overflow и control overlap;
7. keyboard/focus/accessible label работают;
8. spoofed `ended` не выдаёт XP и не завершает test;
9. logout/revoked session больше не получает scoped config;
10. CSP и host-routing checks остаются зелёными.

Запусти весь verification suite из CLAUDE_HANDOFF.md, production build и
standalone smoke. Не деплой при красном CI. Перед production deploy покажи
владельцу threat-model summary и честно укажи остаточный риск обнаружения video
ID. После одобрения деплой web/API одним SHA с rollback и проверь четыре домена.

## Первые 18 видео для дальнейшей привязки

Не публикуй их автоматически. Реализуй player и admin workflow, а привязку к
урокам оставь content-review процессу Gemini/методиста. Список source URLs
находится в docs/development/GEMINI_ANTIGRAVITY_CONTENT_PROMPT.md.
```

## Почему URL нельзя полностью скрыть

Официальный YouTube embed загружает `https://www.youtube.com/embed/VIDEO_ID`
или privacy-enhanced вариант на `youtube-nocookie.com`. Следовательно, video ID
присутствует в запросах браузера. Zhangak может защищать доступ к своему уроку,
не показывать прямую ссылку и минимизировать DTO, но не может превратить обычный
YouTube iframe в DRM.
