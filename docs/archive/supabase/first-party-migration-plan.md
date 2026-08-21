# [ARCHIVE] Migration to the Zhangak backend

> [!NOTE]
> Это исторический план перехода с Supabase. Номера и статусы slices ниже не
> являются актуальным roadmap проекта. Для текущей навигации используйте
> [портал документации](../README.md), а для фактической схемы — каталог
> `backend/migrations/` и [архитектурную карту](../development/architecture.md).
> Документ сохранён как журнал принятых решений и ограничений миграции.

## Target architecture

- `zhangak.com`: public marketing pages only.
- `platform.zhangak.com`: student and parent web/PWA.
- `admin.zhangak.com`: staff workspaces.
- `/v1/*` on the platform and admin hosts: Nginx proxy to the private Zhangak API.
- Zhangak API: Node.js 22 on `127.0.0.1:3210`.
- Zhangak PostgreSQL: private container/network, never exposed publicly.
- Authentication: short-lived access cookie plus rotating refresh cookie. The API
  verifies current account state on protected requests so banning a user takes
  effect immediately.

The legacy Supabase project is an archived migration source only. The web
application and first-party backend must not add or restore Supabase calls.

## Delivery slices

### Slice 1 — API production baseline

- versioned PostgreSQL migrations and a migration ledger;
- fail-fast configuration with no default JWT/database secrets;
- `/v1/health` and `/v1/ready`;
- bounded JSON, strict origins, security headers and graceful shutdown;
- immutable SHA releases and a sandboxed systemd service;
- internal-only staging deployment before Nginx receives `/v1` traffic.

### Slice 2 — first-party identity

- login, refresh rotation, logout and `/auth/me`;
- HttpOnly, Secure, SameSite cookies for web clients;
- optional Bearer access tokens for the native app;
- login throttling, generic credential errors and session revocation;
- administrator bootstrap through a server-only CLI, never seed credentials.

### Slice 3 — online learning (web baseline complete)

- lessons and content catalog;
- server-authored practice attempts;
- atomic attempt limits and scoring;
- migrate student dashboard, lessons and practice clients;
- delete answer keys and result writes from browser bundles.

Mock scheduling, daily challenges, XP, and ranking require their own reviewed
tables and are intentionally shown as migration states rather than reusing the
retired data plane.

### Slice 4 — offline and teacher

- groups, schedules, attendance, grades, homework and materials;
- teacher ownership checks for every group/lesson/student mutation;
- student read model scoped to the authenticated account;
- private file delivery with signed short-lived downloads.

### Slice 5 — administration and universities

- account role hierarchy and audit log;
- content, universities, advantages, specialties and announcements;
- immutable audit entries for privileged changes;
- migrate all current Next.js admin API routes to the Zhangak API.

### Slice 6 — business modules and AI

- finance/CRM, Math roles, prizes and notifications;
- server-derived AI context, rate/cost budgets and conversation ownership;
- background jobs for notification and document processing.

### Slice 7 — web Supabase removal (complete)

- `check:web-data-plane` requires zero web SDK imports, packages, and runtime
  variables;
- the web dependencies, browser client, old API handlers, and dead dependent
  modules are removed;
- the retired `/api/*` namespace remains deny-listed with a uniform `404`;
- archived database-recovery evidence remains under `supabase/quarantine` and
  is not executable product code.

The separate Expo application in `mobile/` is not part of the web release and
still needs a dedicated migration to native first-party bearer auth and `/v1`,
or a deliberate retirement decision, before the whole repository can be called
Supabase-free.

## Deployment gates for every slice

1. Types/lint/unit/contract tests pass.
2. Database migration applies twice from a clean disposable database.
3. No secrets occur in browser or release artifacts.
4. API starts on localhost and `/v1/ready` confirms PostgreSQL connectivity.
5. Unauthenticated and cross-role requests fail before data access.
6. Release is activated atomically and rolls back on failed health/readiness.
7. External host/TLS/routing smoke passes before traffic is enabled.

## Current constraint

Legacy data has not been imported into the new PostgreSQL database. We therefore
do not fabricate production users, learning content, scores, or university
facts. Account/content import remains a separate backed-up and reviewed
operation; the new API can safely operate with an empty database until it is
performed.
