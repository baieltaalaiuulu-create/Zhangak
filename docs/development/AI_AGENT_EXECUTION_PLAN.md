# План выполнения Zhangak через Claude Opus 5 и Gemini 3.7 Flash

**Базовый commit:** последний clean commit ветки `p0/reconcile-production`,
содержащий этот документ; агент обязан записать его полный SHA в preflight.

**Production deploy owner:** только основной Codex-инженер

**Claude:** код, архитектура, security и тесты

**Gemini Antigravity:** мультимодальный аудит, OCR, каталогизация и content QA

## 1. Непереговорное разделение ответственности

Claude и Gemini могут:

- читать репозиторий и разрешённые материалы;
- создавать собственную ветку/worktree;
- изменять код и документацию в пределах своей задачи;
- запускать локальные тесты и disposable PostgreSQL;
- создавать локальные commits в своей ветке;
- готовить review artifacts и deployment packet.

Claude и Gemini не могут:

- подключаться по SSH к VPS;
- читать `/etc/zhangak*`, production secrets или private keys;
- применять SQL к production PostgreSQL;
- переключать `current`/`previous` release;
- запускать `systemctl`, Certbot, Nginx или production timers;
- пушить напрямую в `main` или сливать свою ветку;
- публиковать материалы/вопросы без human review;
- выполнять deploy даже при зелёных тестах.

Только основной Codex-инженер:

1. принимает handoff agents;
2. проверяет diff и provenance;
3. интегрирует commits;
4. ждёт зелёный CI;
5. создаёт backup;
6. применяет forward-only migrations;
7. собирает Node 22.22.2 release;
8. атомарно разворачивает web/API одним SHA;
9. проверяет четыре домена и выполняет rollback при сбое.

## 2. Изоляция рабочих директорий

Не запускайте двух пишущих агентов в одном worktree. Рекомендуемая схема:

```text
C:\Users\user\Documents\Zhangak          canonical/integration
C:\Users\user\Documents\Zhangak-claude  agent/claude-video-player
C:\Users\user\Documents\Zhangak-gemini  agent/gemini-content-audit
```

Оба worktree создаются от одного base SHA. Агент не должен использовать
`git reset --hard`, удалять чужую ветку или исправлять файлы другого агента.

## 3. Общий обязательный prompt обоим агентам

```text
Ты работаешь над Zhangak. Production deploy, VPS, production DB и secrets
находятся вне твоих полномочий. Никогда не выполняй SSH/systemctl/nginx/certbot,
не читай production env и не применяй migration к production.

Работай только в назначенном отдельном worktree и собственной ветке. Перед
изменением зафиксируй base SHA, git status, scope и список файлов. Не изменяй
чужие dirty changes. Supabase запрещён.

Каждый этап имеет stop-gate. На gate сохрани artifacts, commit SHA, тесты,
unresolved risks и остановись. Не переходи дальше из желания «закончить всё».

Никакое заявление модели не является доказательством. Доказательства:
machine-readable manifest, source hash, tests, reproducible commands, diff и
human sign-off. Не выдумывай отсутствующие данные и не скрывай ограничения.

Финальный результат должен быть deployment candidate, а не deployment.
Основной Codex-инженер отдельно проверит, интегрирует и развернёт release.
```

## 4. Claude Opus 5 — последовательность задач

### Настройки

- Model: `Claude Opus 5`, если exact model ID доступен.
- Effort: maximum/highest.
- Один длинный implementation session допустим, но commit после каждого
  завершённого вертикального среза.
- Если display name не совпадает с documented model ID, записать фактический ID
  в отчёт и продолжить как preview, не скрывая это.

### Claude Gate C0 — архитектурный preflight

Передать Claude:

```text
Прочитай полностью:
- docs/development/CLAUDE_HANDOFF.md
- docs/development/AI_AGENT_EXECUTION_PLAN.md
- docs/development/CLAUDE_YOUTUBE_PLAYER_PROMPT.md
- все прямо указанные там migrations/routes/UI/tests.

Выполни только read-only preflight. Верни:
1. base SHA и clean/dirty status;
2. текущий video data flow admin -> DB -> student DTO -> player;
3. threat model;
4. точные файлы/schema/API, которые нужно менять;
5. совместимость и rollback risks;
6. план commits;
7. план tests.

Не изменяй файлы на Gate C0. Остановись после PRECHECK_CLAUDE_VIDEO.md.
```

Основной инженер или владелец подтверждает C0.

### Claude Gate C1 — реализация video vertical

После подтверждения:

```text
Реализуй утверждённый YouTube player vertical строго по
CLAUDE_YOUTUBE_PLAYER_PROMPT.md. Не импортируй и не публикуй 18 видео; создай
безопасный workflow и player foundation.

Требования:
- server-authorized access;
- canonical YouTube ID parser;
- минимизированный student DTO;
- youtube-nocookie + exact origin + supported parameters;
- shared responsive accessible component;
- no client-authoritative XP/completion;
- forward-only migration только при доказанной необходимости;
- backend/web/security/responsive tests;
- документация остаточного риска обнаружения video ID.

Сделай небольшие commits, запусти полный verification suite, но не выполняй
deploy и не подключайся к VPS. Создай CLAUDE_VIDEO_IMPLEMENTATION_REPORT.md и
остановись.
```

### Claude Gate C2 — исправления после независимого review

Gemini получает diff C1 только в read-only режиме. После review Claude получает
список findings с evidence:

```text
Разбери findings по valid / invalid / needs-decision. Исправь только valid
findings, добавь regression tests и не расширяй scope. Не применяй советы
автоматически. Обнови implementation report, создай финальный commit и
deployment packet. Не деплой.
```

### Будущие задачи Claude после player

Каждая выполняется отдельным циклом C0 -> C1 -> review -> C2:

1. importer для утверждённого Gemini manifest, dry-run first;
2. transactional push producers results/announcements;
3. offline classroom completion;
4. content/admin validation UX;
5. off-site backup tooling без production credentials в Git.

## 5. Gemini 3.7 Flash / Antigravity — последовательность задач

### Настройки

- Model: `Gemini 3.7 Flash`, thinking `high`, если exact model ID виден.
- Если это undocumented preview, выполнить pilot comparison с стабильным
  `Gemini 3.5 Flash`.
- Использовать structured outputs, bounded batches и deterministic reducer.
- Не давать нескольким subagents писать один и тот же output-файл.

### Роли Antigravity subagents

Разрешены параллельные read-only роли:

1. `inventory-agent` — paths, MIME, hashes, duplicates;
2. `pii-gate-agent` — только classification metadata, без чтения blocked chats;
3. `pdf-ocr-agent` — разрешённые PDF и page evidence;
4. `image-ocr-agent` — только safe-approved images;
5. `video-agent` — URL/title/channel/captions/embed inventory;
6. `taxonomy-agent` — subject/section/topic candidate mapping;
7. `validator-agent` — schema and invariant checks;
8. `reducer-agent` — объединяет outputs детерминированно, ничего не додумывая.

`pii-gate-agent` не отправляет body переписки другим агентам. Reducer принимает
blocked items только как hash/path/reason.

### Gemini Gate G0 — filesystem preflight

```text
Прочитай полностью:
- docs/development/CLAUDE_HANDOFF.md
- docs/development/AI_AGENT_EXECUTION_PLAN.md
- docs/development/GEMINI_ANTIGRAVITY_CONTENT_PROMPT.md
- перечисленные там schema/routes/manifests.

Выполни только Phase 0. Не OCR-ь, не исправляй и не импортируй. Создай:
- PRECHECK_REPORT.md;
- content_file_inventory.jsonl;
- duplicate_candidates.json;
- blocked_pii.jsonl без body;
- missing_or_corrupt.csv.

Зафиксируй exact model ID/version/thinking. Сверь ожидаемые 20 файлов
test_for_students и 18 YouTube URLs, включая gap `3 сабак`. Остановись на G0.
```

### Gemini Gate G1 — pilot batch

После подтверждения G0:

```text
Обработай только pilot:
- по одному PDF каждого предмета либо ограниченный набор страниц;
- 3–5 safe-approved JPEG;
- 2 математических видео и 2 видео серии «сабак».

Запусти тот же pilot на Gemini 3.7 Flash и baseline Gemini 3.5 Flash. Сравни:
OCR, кыргызские символы, LaTeX, варианты A-D, source evidence, structured output,
пропуски и hallucinations. Создай PILOT_MODEL_COMPARISON.md и raw machine
outputs. Не выбирай победителя без измеримых criteria. Остановись.
```

### Gemini Gate G2 — полный corpus audit

После выбора модели владельцем:

```text
Обработай разрешённый corpus bounded batches. Для каждого batch сохраняй
checkpoint, source hashes и validation report. Не загружай blocked PII.

Создай outputs, перечисленные в GEMINI_ANTIGRAVITY_CONTENT_PROMPT.md. Любое
сомнение отправляй в unresolved_items, не исправляй предположением. Вопросы и
материалы остаются draft. Остановись со статусом ready_for_human_review.
```

### Gemini Gate G3 — human-reviewed import manifest

Только после sign-off методиста:

```text
Прими список approved/rejected/corrected item IDs. Проверь, что каждая коррекция
имеет reviewer, timestamp и evidence. Создай immutable approved manifest и
import proposal. Не пиши importer в обход backend; не изменяй production DB.

Передай manifest Claude для implementation review. Остановись.
```

## 6. Перекрёстная проверка моделей

### Gemini проверяет Claude

Gemini получает только commit diff, tests и threat model Claude. Он не меняет
код, а возвращает findings:

```text
id, severity, file, line, invariant, evidence, reproduction, suggested_test
```

### Claude проверяет Gemini

Claude получает только безопасные manifests, disputed excerpts и schema.
Никаких blocked chat exports. Он проверяет:

- соответствие DB constraints;
- отсутствие answer leakage/PII;
- importer feasibility;
- deterministic IDs/idempotency;
- unresolved/unsupported items.

Claude не объявляет учебный ответ правильным только на основании reasoning;
финальный answer key подтверждает методист.

## 7. Deployment candidate packet

Каждый coding-agent передаёт основному инженеру файл
`DEPLOYMENT_CANDIDATE.md`:

```text
agent_product:
model_display_name:
model_id:
model_version:
thinking_level:
base_sha:
head_sha:
branch:
commits:
scope:
files_changed:
migrations_added:
env_names_added:        # names only, never values
data_backfill_required:
tests_run:
tests_passed:
tests_skipped_and_why:
known_limitations:
security_review:
human_approvals_required:
rollback_notes:
production_actions_requested: none
```

Пакет отклоняется, если:

- есть uncommitted changes;
- отсутствует base/head SHA;
- тесты описаны словами без команды/результата;
- изменена применённая migration;
- есть secrets/PII;
- агент уже применил production action;
- заявлено «100% правильно» без evidence/human sign-off.

## 8. Инструкция основному Codex-инженеру для деплоя

После получения candidate:

1. сделать read-only audit commits и artifacts;
2. проверить branch ancestry и отсутствие неожиданных файлов;
3. интегрировать в canonical branch отдельным commit/merge;
4. запустить локальный suite и clean PostgreSQL migration replay;
5. push и дождаться полностью зелёного GitHub CI;
6. проверить exact production targets/mounts;
7. создать PostgreSQL backup на втором томе и подтвердить artifact;
8. собрать web/API Node 22.22.2 из clean exact SHA;
9. применить migration через штатный API restart/migrator;
10. атомарно переключить API с readiness rollback;
11. атомарно переключить web через activator;
12. проверить `/v1/ready`, четыре `/api/health`, domain routing и критические
    authenticated flows;
13. проверить logs/timers/disk и сохранить previous release;
14. сообщить владельцу SHA, migration, CI, backup и rollback target.

Ни Claude, ни Gemini не получают production secrets для ускорения этой части.

## 9. Что отправить агентам прямо сейчас

Claude:

```text
Не работай в canonical dirty worktree. Создай отдельный worktree от последнего
clean commit ветки `p0/reconcile-production`, содержащего execution plan, и
запиши точный base SHA. Прочитай полностью
docs/development/CLAUDE_HANDOFF.md,
docs/development/AI_AGENT_EXECUTION_PLAN.md и
docs/development/CLAUDE_YOUTUBE_PLAYER_PROMPT.md. Выполни только Gate C0 и
остановись. Production deploy запрещён и остаётся за основным Codex-инженером.
```

Gemini Antigravity:

```text
Не работай в canonical dirty worktree. Создай отдельный worktree от последнего
clean commit ветки `p0/reconcile-production`, содержащего execution plan, и
запиши точный base SHA. Прочитай полностью
docs/development/CLAUDE_HANDOFF.md,
docs/development/AI_AGENT_EXECUTION_PLAN.md и
docs/development/GEMINI_ANTIGRAVITY_CONTENT_PROMPT.md. Выполни только Gate G0,
не открывай blocked chat/PII и остановись. Production deploy запрещён и
остаётся за основным Codex-инженером.
```
