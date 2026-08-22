# Zhangak release-candidate ledger для Claude

**Снимок:** 2026-08-23. Это краткий handoff о завершённой локальной работе, а
не незавершённый prompt и не доказательство production-ready состояния.

## Всегда начинайте с фактического Git

Перед анализом или изменением проекта выполните:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log --oneline -8
git diff --stat
```

Не предполагайте, что SHA, branch или чистота рабочего дерева из этого снимка
остались прежними. Не сбрасывайте и не перезаписывайте обнаруженные изменения.

## Завершённая серия commits

На момент снимка branch `fix/video-release-review` содержит (в порядке):

- `37104ac` — строгий Roadmap DTO;
- `13f07fd` — безопасное управление банком вопросов (create/edit,
  archive/restore, server-side фильтры/пагинация, lesson-scoped workspace);
- `796994a` — lesson search и assessment UX polish;
- `fc31d3d` — release/handoff документация той серии;
- `fd113ca` — Content Studio: defer loading effects (Codex);
- `755c4dd` — стабилизация теста position conflict recovery (Codex);
- `3cdd571` — refresh release candidate handoff (Codex);
- `8ecb019` — полный банк вопросов на странице задания дня (был жёсткий
  `limit=200` при максимуме API 100), видимость нового вопроса при активных
  фильтрах, честный статус "банк заполнен 200/200", статусы публикации
  материалов (Codex);
- `7ef2335` — **`backend/scripts/seed-lesson-assessment-demo.js`** и
  **`seed-demo-student.js`**: закрывают главный продуктовый разрыв — до этого
  почти ни один урок не имел lesson-scoped `practice_tests`, поэтому цепочка
  «Видео → Тест → Результат → Следующий урок» почти нигде не срабатывала
  (`has_active_bound_practice_test` в `platform-learning.js` /
  `platform-roadmap.js` требует привязанный опубликованный тест с активным
  вопросом). Скрипт идемпотентен, `--dry-run` по умолчанию, не трогает
  существующие курсовые банки, не угадывает связь вопрос↔урок по совпадению
  `topic`/`section`, авторские вопросы только для `math` (арифметика,
  ответы проверены вручную и независимо переверены в тесте). `--subject kyr`
  **намеренно отклоняется** — это открытый блокер, не выполненная задача:
  проверка правильного кыргызского ответа требует лингвиста/методиста.

Функциональный объём question catalogue завершён, включая честные состояния
"сохранено/черновик/опубликовано/скрыто/ошибка" и полную загрузку банка мимо
лимита API в 100 строк на странице. История попыток не удаляется.

## Известный блокер этой сессии: нет доступного PostgreSQL

В этой рабочей копии нет `.env`, ничего не слушает `127.0.0.1:5433/:3210`, и
Docker Desktop (установлен) не поднял backend в разумное время — `docker ps`
не отвечал even after launching Docker Desktop.exe и ожидания. Поэтому:

- `seed-lesson-assessment-demo.js` и `seed-demo-student.js` **не запускались
  с `--apply` против реальной базы** в этой сессии — только верифицированы
  code review'ом против CHECK-constraints `002_learning_core.sql` и
  unit-тестами их чистой логики (`backend/test/seed-*.test.js`), которые не
  требуют подключения к БД;
- полный ручной проход всех demo-сценариев ученика/админа в браузере против
  живого backend **не выполнялся** — вместо этого пройден статический код
  review каждого маршрута (freeze/extend доступа, друзья/блокировки, quest
  claim идемпотентность, trainer-изоляция lesson-scoped тестов через
  `test_type='practice' <> 'bank'`) и полный прогон `npm run test:e2e`
  (mocked `/v1/**`, реальный production build и React-код) — 135/135 pass.

Следующему агенту/Codex: перед release нужно поднять реальный/disposable
PostgreSQL, применить 26 миграций, запустить оба seed-скрипта с `--apply` и
пройти сценарии из ЭТАП 2/3 пользовательского запроса руками против реального
API. Это не «доказательство», что seed-скрипты сломаны — это честная граница
того, что можно было проверить без базы данных.

## Обязательный release gate

Перед release повторно запустите проверки на текущем HEAD и сохраните точные
результаты, включая fail/skip:

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
npm run check:mobile-data-plane
npm --prefix backend run check
npm --prefix backend test
npm run build
npm run test:e2e
```

Для release нужно ДОПОЛНИТЕЛЬНО: disposable/staging PostgreSQL с применёнными
миграциями, `seed-lesson-assessment-demo.js --apply` и `seed-demo-student.js
--apply` против него, ручной проход ключевых сценариев (Stage 2/3 в исходном
запросе) в браузере, standalone smoke, API readiness и внешние health checks.

## Границы ответственности

- `CLAUDE_PROJECT_FINISH_CONTEXT.md` и `CLAUDE_PROJECT_FINISH_PROMPT.md`
  сохраняют исторический scope предыдущей итерации. Их старые blockers и
  baseline нельзя исполнять как текущую очередь работ.
- Новая задача определяется актуальным запросом пользователя и фактическим
  состоянием Git, routes, migrations и tests.
- Claude может анализировать, исправлять и готовить локальные логические
  commits только в пределах порученной задачи.
- Push, SSH, миграции и deployment на VPS выполняет **Codex** после отдельной
  release-проверки и явного разрешения пользователя.
- Supabase и product runtime AI запрещены; security/data-plane/answer-boundary
  инварианты из `AI_AGENT_HANDOFF.md` и `architecture.md` остаются обязательны.

## Формат следующего handoff

Сообщите branch/HEAD/worktree, изменённые contracts, точные команды и результаты
проверок, непроверенные зоны и rollback. Не пишите `READY` или «всё работает»
без свежей release matrix.
