# Migration to the Zhangak backend

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

The existing Supabase project is a migration source only. New product features
must not add Supabase calls.

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

### Slice 3 — online learning

- lessons and content catalog;
- server-authored practice/mock/daily attempts;
- atomic attempt limits, scoring, XP and leaderboard writes;
- migrate student dashboard, lessons and practice clients;
- delete answer keys and result writes from browser bundles.

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

### Slice 7 — Supabase removal

- static check requires zero Supabase imports/table calls;
- remove Supabase dependencies and environment variables;
- archive the old project only after backup and restore rehearsal;
- final data reconciliation, load test, rollback rehearsal and production cutover.

## Deployment gates for every slice

1. Types/lint/unit/contract tests pass.
2. Database migration applies twice from a clean disposable database.
3. No secrets occur in browser or release artifacts.
4. API starts on localhost and `/v1/ready` confirms PostgreSQL connectivity.
5. Unauthenticated and cross-role requests fail before data access.
6. Release is activated atomically and rolls back on failed health/readiness.
7. External host/TLS/routing smoke passes before traffic is enabled.

## Current constraint

The live Supabase key is invalid and no trustworthy live schema snapshot is
available. We therefore do not import or fabricate production user/content data.
The new API can be deployed internally and exercised with an empty database;
account/data import is a separate, backed-up and reviewed operation.
