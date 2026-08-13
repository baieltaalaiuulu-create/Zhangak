# First-party practice attempts

## Status

The web practice flow is active on the Zhangak backend. It uses the private
PostgreSQL learning schema from `backend/migrations/002_learning_core.sql` and
the cookie-authenticated `/v1/platform` BFF. The retired `/api/practice`
handler no longer exists and always returns `404`.

Before publishing content, apply migration `002_learning_core.sql`, create a
course/group membership for the student, and publish a test with at least one
active question. The platform intentionally shows an honest empty state until
that data exists; it never fabricates questions or results.

## Routes

All routes require the first-party HttpOnly Zhangak session and accept only
`student` or `math_student` roles.

```text
GET  /v1/platform/practice-tests
POST /v1/platform/practice-attempts
GET  /v1/platform/practice-attempts
GET  /v1/platform/practice-attempts/:attemptId
POST /v1/platform/practice-attempts/:attemptId/submit
```

Start an attempt with a new UUID that the browser reuses when retrying:

```json
{
  "testId": 42,
  "idempotencyKey": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
}
```

Submit an open attempt:

```json
{
  "idempotencyKey": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "elapsedSeconds": 480,
  "answers": [
    { "questionId": 101, "answer": "b" },
    { "questionId": 102, "answer": "d" }
  ]
}
```

The API rejects unknown fields, duplicate IDs, malformed UUIDs, answer letters
outside `a`–`d`, more than 200 answers, and elapsed time outside `0..86400`.
The client cannot send a user ID, score, pass state, attempt number, answer key,
XP, rank, or completion time.

## Server trust boundary

At begin time, the backend transaction locks the student, checks publication,
availability, group membership, and `max_attempts`, then creates an immutable
snapshot of each active question and its answer key. A repeated start request
with the same key replays the same attempt; concurrent starts cannot consume
extra attempts.

The open-attempt response contains question text, options, and safe metadata
only. It never contains `correctAnswer`, explanations, selected answers, or
server-authored result fields.

At submission time, the backend locks the attempt and its snapshot items,
checks ownership and deadline, rejects questions outside the assignment, grades
against the private snapshots, and finalizes the attempt atomically. Omitted
answers are marked incorrect. Retrying the same submit key returns the stored
result; a different key cannot produce a second result. Review data, including
the correct answer and explanation, is available only after finalization to the
owner of the attempt.

## Regression gates

Run these before a release:

```sh
npm run check:learning-boundary
npm run test:unit
npm --prefix backend test
```

The contract tests cover request validation, answer-key-free open attempts,
idempotent submission, immutable snapshot scoring, limits, and forbidden
client-authored authority fields.
