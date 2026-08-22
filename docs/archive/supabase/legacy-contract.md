# [ARCHIVE] Legacy Supabase database contract inferred from the application

> [!WARNING]
> Это исторический снимок старого Supabase-контракта, сохранённый только для
> аудита и сверки при переносе данных. Он **не описывает текущую схему Zhangak**
> и не должен использоваться для новых запросов, миграций или типов.
> Актуальный источник истины — `backend/migrations/001_*.sql` и последующие
> миграции, проверяемые `backend/scripts/verify-migrations.js`. Карта текущей
> архитектуры находится в [руководстве разработчика](../development/architecture.md).

This is a static contract extracted from the canonical web/mobile code. It is
not a claim about the current live database; the live schema still needs a
credentialed, read-only snapshot.

## Inventory

The code names 34 PostgREST tables:

- Identity/offline/CRM: `profiles`, `courses`, `groups`, `group_students`,
  `lessons`, `attendance`, `test_results`, `homeworks`, `crm_leads`, `income`,
  `expenses`, `payments`.
- Learning: `practice_lessons`, `practice_tests`, `questions`,
  `practice_results`, `mock_registrations`.
- Daily/gamification: `daily_challenges`, `daily_challenge_questions`,
  `daily_challenge_results`, `weekly_leaderboard`, `weekly_prizes`.
- Content/universities/AI: `announcements`, `universities`,
  `university_specialties`, `university_advantages`, `ai_chat_sessions`,
  `ai_chat_messages`, `ai_knowledge_files`, `admin_settings`.
- Math: `math_lessons`, `math_questions`, `math_results`,
  `math_parent_student`.

`homework_submissions` is used as a nested relation. No Postgres RPC call is
present. Storage buckets named by the code are `avatars`, `question-images`,
`questions`, `announcements`, `prize-images`, and `knowledge-files`. The only
Realtime subscription watches all changes to `weekly_leaderboard`.

## Blocking trust-boundary problems

1. Student clients receive answer keys and calculate practice, mock, daily, and
   math scores locally.
2. Student clients write result scores, XP, attempt numbers, and leaderboard
   ranks directly. Repeating daily completion can add XP again.
3. Profile ownership alone does not make the `role` column immutable.
4. AI chat ownership currently depends entirely on unknown live RLS state.
5. Admin, finance, manager, teacher, and math-admin browsers perform direct
   privileged writes that must have matching RLS policies.
6. `knowledge-files` uses public URLs even though the content should be private.

## Required invariants for the baseline

- Every table in an exposed schema has RLS enabled and explicit role policies.
- Answer-key columns are never selectable by student clients; submissions are
  graded atomically by trusted server code or a protected database function.
- Results, XP, ranks, attempts, and completion timestamps are server-authored.
- Daily and weekly writes are idempotent with unique constraints and one
  transaction for result + XP + leaderboard projection.
- Students can update only safe profile fields; role and account state are
  protected with column privileges, a safe API, or an equivalent hard boundary.
- Chat messages are accessible only through a session owned by `auth.uid()`.
- Teachers see assigned groups only; parents see linked children only; domain
  staff permissions match the server route capability matrix.
- Students see only published/active content.
- Storage write policies validate role, ownership prefix, MIME type, and size;
  private learning documents use signed/admin-only downloads.
- Realtime never reveals rows broader than the table's SELECT policy.

The first implementation slice after live-schema recovery is server-authoritative
submission for practice, mock, and daily challenge, because it removes the
largest integrity and XP-farming risk.
