# Supabase-to-Zhangak migration preparation

This directory is a **non-executable preparation kit**, not an importer. It
keeps the old Supabase project outside the runtime data plane while providing a
repeatable way to discover and validate a future transfer.

Nothing here connects to Supabase, PostgreSQL, storage, or the network. The
preflight script only reads local JSON and export files, and it deliberately
stops with exit code `78` after validation even when `--apply` is present.

## What the templates are for

| File | Purpose | Must never contain |
| --- | --- | --- |
| `source-inventory.template.json` | Read-only source schema/table/storage inventory. Candidate names come from the archived `docs/archive/supabase/legacy-contract.md`; they are not a claim about the live schema. | URLs with credentials, rows, password hashes, tokens, file contents |
| `mapping-manifest.template.json` | Explicit approved/blocked source-to-target mappings, dependencies, ID policy, and archive-only data. | Secret values or an assumption that a legacy ID is valid in the target |
| `checksum-ledger.template.json` | Lock file for source schema and offline export checksums/counts. | The exports themselves or encrypted backup keys |

Copy these templates to an encrypted, access-controlled directory **outside
Git** only after an owner-approved, read-only capture. Do not turn a template
into an active migration file under `backend/migrations/`.

## Mandatory source-discovery boundaries

1. Use a time-limited database account that can only read the required schemas.
   Capture schema, table/column metadata, row counts, constraints, indexes,
   RLS/policies, functions, and Storage object inventory separately.
2. Take one consistent source snapshot. Record the SHA-256 of its schema dump
   and the capture timestamp in the inventory. Do not use the historical files
   in `supabase/quarantine/`; they are corrupted evidence, not a schema source.
3. Generate data-only exports outside the repository. Store the export's table
   count, byte count, and SHA-256 in the checksum ledger. Keep all real exports
   encrypted and access-controlled.
4. Complete all captured tables with exact primary keys, columns, types and
   nullability. Mark a table `excluded` with a reason instead of silently
   omitting it.
5. Change a mapping from `blocked` to `ready` only after a reviewer has
   approved its source table, fields, transformations, dependencies, and
   rollback/archive treatment.

## Mapping rules already known from the Zhangak schema

- `auth.users` passwords cannot be copied: Zhangak accepts its own scrypt
  format, while Supabase credentials/sessions/MFA material must never leave the
  identity boundary. A password-reset/activation migration is a prerequisite
  for importing accounts.
- The target uses generated numeric IDs for courses, groups, lessons and tests.
  A reviewed importer must build a temporary run-scoped ID map; it must not
  guess that legacy IDs are compatible.
- Existing historical results, XP and leaderboard positions are not safe to
  treat as authoritative because the retired client data plane could author
  them. Archive them until row-level provenance and target invariants have been
  checked.
- University information is only candidate source data. Tuition, scores,
  deadlines, names and URLs require current official-source verification before
  publication.
- Supabase Storage URLs are not a portable asset migration. Assets must be
  inventoried, reviewed, re-hosted by Zhangak, and then referenced through new
  URLs.

## Local preflight gate

The future execution command has all three explicit consent requirements:

```sh
SUPABASE_SOURCE_DATABASE_URL='provided-by-secret-manager' \
ZHANGAK_TARGET_DATABASE_URL='provided-by-secret-manager' \
node backend/scripts/supabase-migration-preflight.js \
  --apply \
  --inventory /secure/capture/source-inventory.json \
  --manifest /secure/capture/mapping-manifest.json \
  --ledger /secure/capture/checksum-ledger.json
```

The script refuses to proceed unless both explicit variables and `--apply` are
present. It also rejects a source that is not Supabase or a target that points
back to Supabase, and requires the direct `db.<project-ref>.supabase.co` source
host to match the completed inventory. It never prints the connection strings. It only verifies
local files, target migration checksums, mapped source columns, dependency
order, artifact byte lengths, and SHA-256 values, then exits `78` with
`preflight-complete-executor-unavailable`.

The normal `DATABASE_URL` is intentionally ignored. Do not put either migration
environment variable in `.env`, CI logs, shell history, GitHub Actions, or a
frontend build.

## Before a separate importer may be proposed

- Restore the exports only into a disposable Zhangak PostgreSQL instance.
- Run target migrations from empty state twice and prove checksums are stable.
- Reconcile source/export/staging/target counts and retained-vs-excluded rows.
- Check foreign keys, uniqueness, normalized emails, role values, date ranges,
  test-question option shape, and target length/score constraints.
- Prove account reset/activation behavior; do not copy sessions, tokens, or
  password hashes.
- Have an owner approve a rollback plan, protected backup retention/deletion
  plan, and publication plan for university and other factual catalog data.

Only after those gates may a separate, reviewed importer be designed. It must
remain outside the normal API startup and use a transaction/rollback plan, an
immutable snapshot lock, audit records, and a dry-run in a disposable database
first.
