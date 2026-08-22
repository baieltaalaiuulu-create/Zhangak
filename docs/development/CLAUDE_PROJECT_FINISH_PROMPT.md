# Copy-paste prompt для Claude: завершение Zhangak

Скопируйте весь блок ниже в Claude Code из корня репозитория Zhangak.

```text
Ты — senior full-stack engineer и release-candidate owner проекта Zhangak.
Твоя задача — не проводить поверхностный аудит, а довести текущую реализацию до
проверяемого release candidate. Ты можешь менять код, тесты и актуальную
документацию и делать локальные логические commits. Ты НЕ можешь выполнять
SSH, push, deploy, менять production, читать секреты или добавлять их в Git.
Выкладку после твоего отчёта делает Codex.

КРИТИЧЕСКИ ВАЖНО ДЛЯ ЭКОНОМИИ КОНТЕКСТА:
1. Сначала выполни только:
   git status --short
   git branch --show-current
   git rev-parse HEAD
2. Полностью прочитай один файл:
   docs/development/CLAUDE_PROJECT_FINISH_CONTEXT.md
3. Затем прочитай только перечисленный в нём обязательный минимальный набор.
4. Не сканируй весь repo, docs/archive, sorted_data, node_modules, .next,
   release bundles, backup и chat exports. Открывай дополнительный файл только
   если на него указывает import, route registration, test failure или прямое
   требование контекста. В отчёте перечисли такие дополнительные файлы и зачем
   они понадобились.
5. Не используй root-отчёты FINAL_VERDICT.md, AUDIT_EXECUTIVE_SUMMARY.md и
   TECHNICAL_AND_DATA_RISKS.md: они относятся к старому SHA и удалённому AI.

АРХИТЕКТУРНЫЕ ЗАПРЕТЫ:
- только собственные Next BFF + Node API + PostgreSQL + private storage;
- Supabase не возвращать;
- product AI/LLM полностью удалён: не добавлять SDK, routes, prompts, keys или
  вызовы провайдеров;
- applied SQL migrations не редактировать, только новая forward migration;
- correct answer/explanation не отдавать student до submit;
- XP, stars, score и progress считает только server;
- не трогать пользовательские dirty files и не делать массовое форматирование.

СНАЧАЛА СВЕРЬ ФАКТЫ:
- create и edit вопросов A–D уже реализованы;
- отсутствующий результат — законченный безопасный delete/archive flow,
  restore, поиск/фильтры/пагинация и UX-доводка;
- online — один общий курс ОРТ/одно зачисление, но Roadmap показывает два
  отдельных направления: математика и кыргызский язык.
Если код расходится с контекстом, зафиксируй evidence и следуй коду/SQL/test,
после чего обнови контекстный документ.

ВЫПОЛНИ ПО ЭТАПАМ:

Этап 1 — точечный gap audit.
- Составь матрицу: requirement -> existing evidence -> gap -> target file/test.
- Не начинай переписывание готовых частей.

Этап 2 — P0 Roadmap.
- С разрешённым demo-аккаунтом воспроизведи live-ошибку Roadmap, при которой
  главная загружается, а карта курса нет. Сними точный request/status/body.
- Найди контрактный разрыв между route, production-like DB row и строгим
  client parser; не добавляй fake fallback и не скрывай ошибку.
- Исправь минимально, добавь regression test и проверь math/kyr paths,
  bottom-to-top order, lock/current/progress/stars и student answer boundary.

Этап 3 — законченный question management.
- Сохрани существующие create/edit формы с ровно A, B, C, D и явным answer key.
- Добавь пользовательское «Удалить» как soft archive (isActive=false),
  отдельное «Восстановить» и confirmation dialog.
- Не делай физический DELETE и не меняй immutable attempt history.
- Защити archive/restore теми же content capabilities admin/super_admin.
- Сохрани инвариант: опубликованный тест не остаётся без active question.
- Сохрани контракт без HTTP DELETE; имеющийся тест отсутствия destructive
  DELETE должен остаться зелёным.
- Audit должен различать edit/archive/restore и не хранить answer text/PII.
- Добавь server-side search, status/section/difficulty filters и pagination.
- UI обязан показывать total/range/prev/next и не терять форму при 409.
- Добавь inline validation, unsaved-changes warning, focus/keyboard states,
  loading/empty/error/success feedback и мобильную форму без overflow.
- Замени устаревший lesson questions migration notice на реальный
  lesson-scoped editor. Для mock route сначала отдели расписание очной сессии
  от assessment content и не связывай сущности по догадке.
- Обнови `check-admin-learning-journey` и `check-admin-legacy-cutover`: сейчас
  они сами требуют старые migration notices. Новый check должен доказывать
  рабочий editor и сохранённую first-party/security границу, а не просто менять
  строку ради зелёного результата.

Этап 4 — умеренный design polish.
- Не делай ребрендинг и не заменяй архитектуру страниц.
- Начни с admin question workspace: ясная цепочка
  курс -> урок -> тест -> вопросы, компактные фильтры, аккуратная типографика,
  понятные primary/secondary/destructive actions.
- Затем проверь student Roadmap, home, quests и profile только на доказанные
  проблемы согласованности: отступы, CTA, loading/empty/error, safe area,
  нижняя навигация, 44px touch targets, focus, overflow.
- Не превращай интерфейс в набор одинаковых AI-style карточек; используй
  существующую палитру, Lucide-иконки и текущие design tokens. Emoji не добавлять.
- Не реализуй пять несвязанных sidebar-разделов «Скоро» в рамках этой задачи;
  убери их из primary release navigation или оставь за честным feature flag.
- В StudentTopbar не оставляй fake search: реализуй узкий поиск уроков/тем с
  keyboard/result states либо убери поле. Исправь склонение цели
  `балл/балла/баллов`.
- Сделай before/after screenshots 390x844, 768x1024, 1440x900 для изменённых
  экранов. Не подменяй реальные данные fake UI.

Этап 5 — verification и финальный аудит.
- Напиши/обнови backend, client-contract и Playwright tests на новую логику.
- Проверь отрицательные роли, A–D validation, 409 position conflict,
  archive/restore, last-active published guard, student answer boundary,
  search/filter/pagination и responsive keyboard flow.
- Выполни все команды из раздела 8 контекстного документа, включая build.
- Если что-то невозможно проверить, не скрывай: укажи точный blocker,
  воспроизводимую команду и остаточный риск.
- Проведи финальный аудит своих изменений P0/P1/P2. Исправь все найденные P0/P1;
  P2 либо исправь, либо аргументированно оставь в отчёте.

GIT:
- один локальный commit для question CRUD/security;
- отдельный локальный commit для design polish;
- отдельный docs commit только если он действительно нужен;
- не push и не deploy;
- не переписывай чужую историю и не используй destructive git команды.

ФОРМАТ ФИНАЛА:
1. Outcome.
2. Existing vs implemented — без присвоения уже готовой работы.
3. Files grouped by feature.
4. API/DB/RBAC/audit/rollback.
5. Test matrix: command, pass/fail/skip, evidence.
6. Screenshot paths and viewport.
7. Remaining P0/P1/P2 and blockers.
8. Branch + SHA + local commit list.
9. Последняя строка: READY FOR CODEX REVIEW

Не останавливайся после плана. Реализуй, проверь, исправь регрессии и только
после этого отдай финальный отчёт.
```
