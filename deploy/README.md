# Zhangak release deployment

The production process runs an immutable Next.js standalone release. Every release directory is named by the exact Git commit SHA and contains `release.json` with the same SHA, the Next.js build ID, and the Node.js version used for the build. Runtime secrets remain in `/etc/zhangak/zhangak.env`; they are never copied into the release.

## One-time server setup

Use two unprivileged accounts with separate responsibilities:

- `deploy` owns `/var/www/zhangak`, uploads releases, and changes the `current` symlink.
- `zhangak` runs the service and has read-only access through the `zhangak` group.
- `root` owns `/etc/zhangak/zhangak.env` as `root:zhangak` with mode `0640`.

Create `/var/www/zhangak/releases` and `/var/www/zhangak/incoming` on the same filesystem, owned by `deploy:zhangak` with mode `2750` so uploaded children inherit the `zhangak` group. Install `zhangak.service` in `/etc/systemd/system/`, the populated environment template in `/etc/zhangak/zhangak.env`, and `activate-release.sh` as `/usr/local/bin/zhangak-activate` owned by root with mode `0755`. Validate and install the narrow sudoers rule from `sudoers-zhangak-deploy.example`; do not grant the deploy account unrestricted sudo.

The server Node.js version must match `.node-version`. After installing the unit, run `systemctl daemon-reload` and `systemctl enable zhangak.service`. The first start happens after the first release is uploaded.

## Build a SHA-addressed artifact

Build only from a clean, committed checkout using the Node.js version pinned in `.node-version`:

```sh
npm ci
npm run build
node scripts/package-standalone.mjs
node scripts/smoke-standalone.mjs
```

`package-standalone.mjs` copies only public assets and Next.js static assets into the generated `.next/standalone` tree and writes `.next/standalone/release.json`. It does not create an archive, read a runtime environment file, or copy project secrets. It refuses a dirty Git worktree and rejects common secret-file names in the artifact root. `ALLOW_DIRTY_RELEASE=1` exists only for local diagnostics; never use it for a production release.

Read the SHA without parsing console text:

```sh
SHA=$(node -p "require('./.next/standalone/release.json').gitSha")
```

## Upload and activate

Upload into an incomplete directory first. Do not rsync directly into `current` or a live release:

```sh
ssh deploy@SERVER "mkdir -p /var/www/zhangak/incoming/$SHA"
rsync -rlt --delete --chmod=Du=rwx,Dg=rx,Do=,Fu=rw,Fg=r,Fo= .next/standalone/ "deploy@SERVER:/var/www/zhangak/incoming/$SHA/"
ssh deploy@SERVER "mv /var/www/zhangak/incoming/$SHA /var/www/zhangak/releases/$SHA && /usr/local/bin/zhangak-activate /var/www/zhangak/releases/$SHA"
```

The activation script validates the manifest, requires its build-time Node.js version to match the server, checks the runtime files, atomically replaces the `current` symlink, restarts the service, and requires `/api/health` to report the same SHA. On a failed restart or health check it restores the prior symlink and restarts the prior release. The application process always runs as `zhangak`, never as root.

## Roll back manually

`previous` points at the release that was active immediately before the last successful activation. Roll it back through the same validation and health-check path:

```sh
ssh deploy@SERVER "/usr/local/bin/zhangak-activate /var/www/zhangak/previous"
```

Verify the externally routed service after any change:

```sh
curl --fail --silent https://zhangak.com/api/health
```

## Domain split

`deploy/nginx/zhangak.conf` serves one immutable Next.js release through three
HTTPS hosts:

- `zhangak.com` for the public, indexable marketing website;
- `platform.zhangak.com` for student/parent accounts and the PWA;
- `admin.zhangak.com` for staff workspaces.

All three A records must resolve to the VPS before requesting a certificate.
Install the tracked config only after confirming that the existing
`/etc/letsencrypt/live/zhangak.com` certificate path is present. Extend that
certificate with the two subdomains and let Certbot validate through Nginx:

```sh
sudo certbot --nginx --cert-name zhangak.com \
  -d zhangak.com \
  -d platform.zhangak.com \
  -d admin.zhangak.com
sudo nginx -t
sudo systemctl reload nginx
```

Do not add `www.zhangak.com` to the certificate or Nginx names until its DNS
record exists. After deployment, verify redirects, surface isolation, noindex,
the PWA manifest, and the certificate names:

```sh
curl -I https://zhangak.com/
curl -I https://zhangak.com/student/online
curl -I https://platform.zhangak.com/
curl -I https://admin.zhangak.com/
curl -I https://platform.zhangak.com/robots.txt
curl -I https://admin.zhangak.com/robots.txt
curl -I https://platform.zhangak.com/platform.webmanifest
openssl s_client -connect 127.0.0.1:443 -servername platform.zhangak.com </dev/null
```

Authentication storage remains origin-scoped: student accounts sign in on the
platform host and staff accounts sign in on the admin host. The login page
rejects a valid account on the wrong workspace and signs that local session
back out; tokens are not shared through the parent marketing domain.

A successful response contains only `status` and `releaseSha`; it never exposes configuration or credentials.
