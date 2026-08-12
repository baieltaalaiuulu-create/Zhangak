# Trusted practice submission (phase 2)

## Status

The HTTP contract, strict parsers, reference grading model, and regression tests
are implemented. The endpoint is deliberately fail-closed while
`PRACTICE_TRUSTED_SUBMISSION_ENABLED` is not `1`.

Do not enable the flag yet. The live Supabase schema has not been captured and
the two required database functions do not exist in the reviewed migration
history. The legacy browser flow remains active until this document's database
and migration gates pass.

## Trust boundary

The browser may choose a test/topic and submit answer letters. It may not author
or override:

- student identity;
- attempt number or eligibility;
- score, total, pass state, XP, or rank;
- completion/start timestamps;
- the assigned question set or answer keys.

`GET /api/practice` validates the Bearer user and begins an attempt through one
database call. Its public question projection contains question text and options
but no answer-key field. `POST /api/practice` accepts only an attempt UUID, a
submission idempotency UUID, elapsed seconds, and unique question/answer pairs.
Both responses are validated before they leave the server.

The route is an adapter only. It does not query or mutate learning tables
directly and it does not use the service-role client.

## HTTP contract

Begin a lesson/test attempt:

```text
GET /api/practice?mode=test&testId=42&idempotencyKey=<uuid>
Authorization: Bearer <Supabase access token>
```

Begin an exact topic attempt (topic must not be ignored):

```text
GET /api/practice?mode=topic&section=math&topic=Дроби&idempotencyKey=<uuid>
Authorization: Bearer <Supabase access token>
```

Finalize an attempt:

```json
{
  "attemptId": "<uuid>",
  "idempotencyKey": "<uuid>",
  "elapsedSeconds": 480,
  "answers": [
    { "questionId": 101, "answer": "b" },
    { "questionId": 102, "answer": "d" }
  ]
}
```

Unknown fields, duplicate question IDs, uppercase/invalid letters, more than 200
answers, invalid UUIDs, and durations outside `0..86400` are rejected. The raw
POST body is capped at 32 KB.

## Required database functions

The future baseline migration must define:

```text
begin_practice_attempt_v2(
  p_contract_version,
  p_mode,
  p_test_id,
  p_section,
  p_topic,
  p_idempotency_key
) -> jsonb

submit_practice_attempt_v2(
  p_contract_version,
  p_attempt_id,
  p_idempotency_key,
  p_elapsed_seconds,
  p_answers
) -> jsonb
```

Both functions must derive identity from `auth.uid()`; neither accepts a user ID.
They must be `SECURITY DEFINER`, set an empty safe `search_path`, schema-qualify
every object, validate the authenticated student's role, and be executable only
by `authenticated`.

### Begin transaction

In one transaction the function must:

1. acquire a row/advisory lock for the student and attempt scope;
2. verify that the test/content is active, published, and already scheduled;
3. count only the explicitly defined finalized/open attempt states;
4. enforce `max_attempts` under the lock;
5. reuse an existing attempt for the same `(student, idempotency key)`;
6. select the exact requested topic, not the full subject section;
7. persist the assigned question IDs and an immutable answer-key snapshot;
8. return only the safe camel-case JSON described by
   `lib/learning/practice-contract.ts`.

A `count` followed by a separate insert is forbidden: two concurrent requests
could otherwise exceed the attempt limit.

### Submit transaction

In one transaction the function must:

1. lock the attempt and verify ownership with `auth.uid()`;
2. reject an expired, cancelled, foreign, or unassigned attempt;
3. reject submitted question IDs outside the persisted assignment;
4. grade against the private snapshot, treating omitted answers as wrong;
5. return the stored result for a retry with the same idempotency key;
6. reject a second finalization with a different key;
7. write exactly one finalized result/projection and completion timestamp;
8. roll back the whole transaction if any projection write fails.

Unique constraints must support the idempotency and attempt-number invariants.
The exact table/column names will be chosen only after the live schema snapshot;
the quarantined SQL files are not a source of truth.

## Tests required before enabling

- pgTAP: anonymous access denied; student A cannot begin/read/submit B's attempt.
- Student JSON never contains a pre-submission answer key.
- Inactive, future, missing, and exhausted tests are denied.
- Two simultaneous begin calls cannot exceed `max_attempts`.
- Same begin/submission idempotency key returns the same row/result.
- A different submission key cannot create a second result.
- Extra, duplicate, malformed, and unassigned answers fail closed.
- Missing answers are scored as wrong; the client cannot supply score or user ID.
- A forced result-projection failure leaves no finalized attempt or partial XP.
- Local reset succeeds twice, database lint passes, and final schema diff is empty.

## Activation order

1. Rotate/fix the Supabase runtime key and capture the read-only live baseline.
2. Restore the baseline locally and generate database types.
3. Add the reviewed attempt tables/functions, RLS, grants, and pgTAP tests.
4. Pass concurrency/integration tests against a disposable database.
5. Migrate practice and mobile lesson clients to `/api/practice`.
6. Migrate mock, daily challenge, math, and AI/stat consumers off direct answer
   keys and direct result writes.
7. Revoke student table/column access to answer keys and authoritative fields.
8. Deploy with the feature flag still `0`, run smoke tests, then enable it in a
   controlled release with rollback available.
