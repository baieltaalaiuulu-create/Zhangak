# Zhangak

Zhangak is an educational platform for students in Kyrgyzstan: ORT preparation,
practice, mock exams, progress analytics, administration, and separate math and
offline-school workspaces.

The canonical source is this Git repository. Production releases must be built
from one clean commit and identified by that commit SHA; do not deploy files by
copying an uncommitted working directory.

## Local development

Requirements:

- Node.js `22.22.2` (see `.node-version`)
- npm `10.9.7`
- a local `.env.local` based on `.env.example`

```sh
npm ci
npm run dev
```

The web app is available at `http://localhost:3000`.

## Required checks

```sh
npm run typecheck
npm run check:security
npm run test:unit
npm run check:learning-boundary
npm run check:student-mobile-ux
npm run check:university-journey
npm run check:emoji
npm run audit:prod
npm run build
```

`npm run lint` currently exposes inherited quality debt and is being reduced in
stages. CI prevents new security, emoji, and production-dependency regressions.

## Production release

The Next.js build uses standalone output. Build and package only a clean commit:

```sh
GIT_SHA=$(git rev-parse HEAD) npm run build
ZHANGAK_RELEASE_SHA=$(git rev-parse HEAD) npm run package:standalone
npm run smoke:standalone
```

The packager copies `public` and `.next/static`, stamps the service-worker cache
with the release SHA, and creates `.next/standalone/release.json`. Runtime secrets
remain outside the artifact.

Server setup, atomic activation, health checks, and rollback are documented in
[`deploy/README.md`](deploy/README.md).

## Domains

- `zhangak.com` — public marketing website
- `platform.zhangak.com` — student learning platform and installable PWA
- `admin.zhangak.com` — administration and staff workspaces

The host boundary is enforced by `proxy.ts`. Browser page requests are
redirected to the correct host; wrong-host API writes return 404 instead of
redirecting bearer tokens or request bodies. Only the marketing origin is
indexable. Platform and admin return `X-Robots-Tag: noindex` and disallow all
crawlers in their host-specific `robots.txt`. The service worker and web app
manifest are exposed only by the platform surface.

## Security model

- Browser calls to protected same-origin APIs use a Supabase Bearer token.
- API authorization reads the current role from the server-side `profiles` row.
- Role permissions are capability-specific and deny by default.
- Private Supabase and AI keys are runtime-only environment variables.
- Direct browser access to Supabase is still governed by RLS; a versioned,
  auditable schema/RLS baseline is the next blocking platform milestone.
- The phase-2 trusted-practice API contract is implemented but remains
  fail-closed until its atomic Supabase functions pass the live-schema recovery
  and database tests described in [`docs/database/practice-submission.md`](docs/database/practice-submission.md).
