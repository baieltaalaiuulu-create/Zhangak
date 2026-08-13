# Zhangak API

First-party production API replacing the legacy Supabase data plane. The API
uses Node.js 22 and PostgreSQL and binds to `127.0.0.1:3210` by default.

Implemented in the first migration slice:

- fail-fast production configuration;
- checksummed, ordered PostgreSQL migrations;
- liveness and database readiness endpoints;
- scrypt password hashing;
- short-lived signed access tokens;
- rotating, hashed refresh sessions;
- HttpOnly cookies for web clients and Bearer access tokens for native clients;
- immediate account/session-version checks on authenticated requests;
- database-backed login throttling and safe generic errors;
- server-only super-administrator bootstrap.

The frontend is still being migrated module-by-module. Do not expose `/v1` in
Nginx until the active frontend slice has integration tests against this API.

## Local checks

```sh
npm ci
npm run check
npm test
```

To migrate a PostgreSQL database, populate `.env` outside Git and export its
values before running:

```sh
npm run migrate
```

Create the first administrator only through server environment variables:

```sh
ZHANGAK_ADMIN_EMAIL=... \
ZHANGAK_ADMIN_PASSWORD=... \
ZHANGAK_ADMIN_NAME=... \
npm run create:super-admin
```

No default email or password is included in source or release artifacts.
