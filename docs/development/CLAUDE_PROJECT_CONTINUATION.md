# Zhangak release-candidate ledger для Claude

**Снимок:** 2026-08-22. Это краткий handoff о завершённой локальной работе, а
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

На момент снимка branch `fix/video-release-review` содержит следующую
последовательность:

- `37104ac` — строгий Roadmap DTO: пустые legacy descriptions нормализуются,
  завершённый урок не помечается одновременно `done` и `locked`, student
  payload не раскрывает answer key;
- `13f07fd` — безопасное управление банком вопросов: create/edit,
  archive/restore без физического `DELETE`, server-side filters и pagination,
  lesson-scoped workspace, корректная свободная позиция, RBAC/audit guards и
  regression coverage;
- `796994a` — lesson search и assessment UX polish, включая настоящий поиск и
  русские склонения;
- `fc31d3d` — release/handoff documentation для этой серии.

Функциональный объём question catalogue завершён: ровно четыре варианта
`a/b/c/d`, явный правильный ответ, explanation, фильтры, пагинация,
course/lesson scope, создание, редактирование, архивирование и восстановление.
История попыток не удаляется. Уроки доступны через реальный поиск, а старый
неподтверждённый mock-route не входит в release navigation.

Это описание реализованного diff, но не утверждение, что свежий checkout уже
прошёл release gate или развёрнут в production.

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
npm --prefix backend run check
npm --prefix backend test
npm run build
npm run test:e2e
```

Для изменённого UI дополнительно проверяются реальные viewports `390x844`,
`768x1024` и `1440x900`; для release — standalone smoke, API readiness,
миграционный ledger и внешние health checks. Старые отчёты и screenshots не
заменяют свежую проверку artifact.

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
