# Executable migrations

This directory is intentionally empty until the live Supabase schema has been
captured and reviewed as a baseline.

Only forward-only, reproducible SQL migrations belong here. Never copy SQL from
an AI transcript, never edit an applied migration, and never run a linked reset
against production. The recovery workflow is documented in
`docs/archive/supabase/schema-recovery-2026-08.md`.
