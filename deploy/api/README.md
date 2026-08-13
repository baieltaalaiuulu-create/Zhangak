# Zhangak API staging deployment

The first deployment is deliberately internal-only:

- PostgreSQL listens on `127.0.0.1:5433`;
- the API listens on `127.0.0.1:3210`;
- Nginx does not receive the `/v1` location until a frontend migration slice
  passes integration tests.

Server-only files:

- `/etc/zhangak-api/postgres-password`, root-only mode `0600`;
- `/etc/zhangak-api/zhangak-api.env`, root:`zhangak-api` mode `0640`.

Release source is installed under `/var/www/zhangak-api/releases/<git-sha>` and
`current` is an atomic symlink. Each release includes only `package.json`,
`package-lock.json`, `src`, `scripts`, `migrations` and production
`node_modules`; it never includes `.env` or bootstrap credentials.

Readiness checks:

```sh
curl --fail http://127.0.0.1:3210/v1/health
curl --fail http://127.0.0.1:3210/v1/ready
```

Do not create the first super administrator until the owner supplies an email,
name and strong password through the server environment. Never commit or print
that password.
