# Zhangak PostgreSQL backup on the second VPS volume

This deployment asset writes one verified logical PostgreSQL archive per day to
the separately mounted VPS volume:

```text
/mnt/HC_Volume_106608581/zhangak-backups/postgres/
```

The archive is created with `pg_dump --format=custom`, checked with
`pg_restore --list`, and written together with a SHA-256 checksum. Files older
than the configured retention period are removed only inside that exact
directory. The timer starts at 02:15 UTC with up to 20 minutes of jitter.

## Install on the VPS

Copy these tracked files as `root`, then keep the runtime configuration out of
Git:

```sh
install -D -m 0700 deploy/backup/zhangak-postgres-backup.sh /usr/local/sbin/zhangak-postgres-backup
install -D -m 0644 deploy/backup/zhangak-postgres-backup.service /etc/systemd/system/zhangak-postgres-backup.service
install -D -m 0644 deploy/backup/zhangak-postgres-backup.timer /etc/systemd/system/zhangak-postgres-backup.timer
install -D -m 0644 deploy/backup/README.md /usr/local/share/doc/zhangak/backup/README.md
install -m 0600 deploy/backup/zhangak-backup.env.example /etc/zhangak-backup.env
systemctl daemon-reload
systemctl enable --now zhangak-postgres-backup.timer
systemctl start zhangak-postgres-backup.service
systemctl status zhangak-postgres-backup.service --no-pager
systemctl list-timers zhangak-postgres-backup.timer
```

Do not install the service if the second volume is not mounted. The unit fails
closed through `ConditionPathIsMountPoint`.

## Verify and restore

Verify the newest archive without restoring it:

```sh
cd /mnt/HC_Volume_106608581/zhangak-backups/postgres
sha256sum --check --strict zhangak-<timestamp>.dump.sha256
docker exec -i zhangak-postgres pg_restore --list < zhangak-<timestamp>.dump >/dev/null
```

Restore only into a disposable database, never directly into production:

```sh
createdb -h 127.0.0.1 -p 5433 -U zhangak zhangak_restore_test
docker exec -i zhangak-postgres pg_restore --clean --if-exists --no-owner --no-acl --username=zhangak --dbname=zhangak_restore_test < zhangak-<timestamp>.dump
```

The second volume is still attached to the same VPS. It protects against an
accidental root-volume problem, not total server loss. Add an encrypted,
tested off-server copy before storing real student data.

## Optional OOM safety net

The VPS has 3.7 GiB RAM and no swap by default. A 2 GiB swap file on the
second volume gives the kernel a last-resort buffer during memory spikes; it
does not add normal application capacity and should stay lightly used.

```sh
fallocate -l 2G /mnt/HC_Volume_106608581/zhangak.swap
chmod 0600 /mnt/HC_Volume_106608581/zhangak.swap
mkswap /mnt/HC_Volume_106608581/zhangak.swap
swapon /mnt/HC_Volume_106608581/zhangak.swap
printf '%s\n' '/mnt/HC_Volume_106608581/zhangak.swap none swap sw 0 0' >> /etc/fstab
install -D -m 0644 deploy/backup/zhangak-memory.conf /etc/sysctl.d/99-zhangak-memory.conf
sysctl --system
swapon --show
```

Only run this once and verify the swap path is absent before allocating it.
