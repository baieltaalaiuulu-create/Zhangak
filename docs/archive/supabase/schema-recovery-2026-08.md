# [ARCHIVE] Supabase schema recovery

## Current state

- Project host observed from the VPS: `olqikkvjeutdgewmhnub.supabase.co`.
- The configured public key is rejected by Supabase as `Invalid API key`.
- The VPS has no service-role key, database URL/password, or AI-provider key.
- The three historical SQL files were corrupted and are quarantined outside the
  executable migration path.
- No production database mutation has been performed during this recovery.

## Required access

Obtain a current Supabase publishable/anon key for runtime and, separately, an
owner-approved Supabase access token plus database password for schema capture.
Keep all private values out of Git, shell history, screenshots, and build logs.

## Read-only capture sequence

Use a separate recovery branch and a project-local Supabase CLI version pinned
for this recovery (`2.114.0`, verified 2026-08-13). Docker Desktop (or another
compatible container runtime) must be running. Upgrade the pin later only in a
reviewed dependency change.

```sh
npm install --save-dev --save-exact supabase@2.114.0
npx supabase init
npx supabase login
npx supabase link --project-ref olqikkvjeutdgewmhnub
npx supabase migration list --linked
npx supabase db dump --linked --schema public -f backups/YYYYMMDD/public-schema.sql
npx supabase db dump --linked --role-only -f backups/YYYYMMDD/roles.sql
npx supabase gen types typescript --linked --schema public > lib/database.types.ts
```

Store any data-only backup encrypted and outside the repository. Review dumps for
credentials, owners/grants, security-definer functions, unsafe `search_path`,
views, policies, indexes, publications, and storage policies before committing a
schema baseline.

Capture the live schema as a single new baseline in a clean temporary checkout.
If `db pull` asks whether to update remote migration history, answer **No** during
discovery. Do not use `migration repair` until the remote history and schema have
been independently compared and a backup restore has succeeded.

## Commands forbidden against production

- `supabase db reset --linked`
- `supabase db push` without a reviewed `--dry-run`
- automatic `migration repair`
- replaying anything under `supabase/quarantine`
- marking the corrupted historical timestamps as applied

## Local proof before any push

```sh
npx supabase start
npx supabase db reset --local --no-seed
npx supabase db lint --local --schema public --level warning --fail-on error
npx supabase test db
npx supabase db reset --local --no-seed
npx supabase db diff --local --schema public
```

The second reset must succeed and the final diff must be empty. Restore the dump
to a disposable project/local database and run pgTAP tests for RLS inventory,
profile role immutability, result ownership, hidden answer keys, chat ownership,
domain role boundaries, and storage policies.

Production remains blocked until the runtime key is rotated, the live schema is
captured, the baseline restores cleanly, and all allow/deny tests pass.
