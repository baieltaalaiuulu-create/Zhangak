#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_ROOT="/var/www/zhangak"
readonly RELEASES_ROOT="${APP_ROOT}/releases"
readonly SERVICE="zhangak.service"
readonly HEALTH_URL="http://127.0.0.1:3200/api/health"

die() {
  printf 'activate-release: %s\n' "$*" >&2
  exit 1
}

if [[ ${EUID} -eq 0 ]]; then
  die "run this script as the non-root deploy user"
fi

if [[ $# -ne 1 ]]; then
  die "usage: $0 /var/www/zhangak/releases/<git-sha>"
fi

release_path="$(realpath -e -- "$1")" || die "release does not exist"
case "${release_path}" in
  "${RELEASES_ROOT}"/*) ;;
  *) die "release must resolve below ${RELEASES_ROOT}" ;;
esac

[[ -f "${release_path}/server.js" ]] || die "server.js is missing"
[[ -f "${release_path}/release.json" ]] || die "release.json is missing"
[[ -d "${release_path}/public" ]] || die "public assets are missing"
[[ -d "${release_path}/.next/static" ]] || die "Next.js static assets are missing"

release_sha="$({
  /usr/bin/node -e '
    const fs = require("node:fs");
    const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!/^[0-9a-f]{7,64}$/i.test(manifest.gitSha || "")) process.exit(1);
    if (typeof manifest.buildId !== "string" || !manifest.buildId.trim()) process.exit(1);
    if (manifest.node !== process.version) process.exit(1);
    process.stdout.write(manifest.gitSha.toLowerCase());
  ' "${release_path}/release.json"
} 2>/dev/null)" || die "release.json is invalid or its Node.js version does not match the server"

[[ "$(basename -- "${release_path}")" == "${release_sha}" ]] || \
  die "release directory name must equal release.json gitSha"

previous_target=""
if [[ -L "${APP_ROOT}/current" ]]; then
  previous_target="$(realpath -e -- "${APP_ROOT}/current")" || die "current symlink is broken"
fi

link_tmp="${APP_ROOT}/.current.${release_sha}.$$"
cleanup() {
  rm -f -- "${link_tmp}"
}
trap cleanup EXIT

ln -s -- "${release_path}" "${link_tmp}"
mv -Tf -- "${link_tmp}" "${APP_ROOT}/current"
if ! sudo -n /usr/bin/systemctl restart "${SERVICE}"; then
  if [[ -n "${previous_target}" ]]; then
    restart_rollback_tmp="${APP_ROOT}/.restart-rollback.${release_sha}.$$"
    ln -s -- "${previous_target}" "${restart_rollback_tmp}"
    mv -Tf -- "${restart_rollback_tmp}" "${APP_ROOT}/current"
    sudo -n /usr/bin/systemctl restart "${SERVICE}" || true
    die "service restart failed; restored the previous release symlink"
  fi
  die "service restart failed and there was no previous release to restore"
fi

healthy=false
for _ in {1..30}; do
  if response="$(curl --fail --silent --show-error --max-time 3 "${HEALTH_URL}" 2>/dev/null)" && \
    /usr/bin/node -e '
      const body = JSON.parse(process.argv[1]);
      if (body.status !== "ok" || body.releaseSha !== process.argv[2]) process.exit(1);
    ' "${response}" "${release_sha}"; then
    healthy=true
    break
  fi
  sleep 0.5
done

if [[ "${healthy}" == true ]]; then
  if [[ -n "${previous_target}" && "${previous_target}" != "${release_path}" ]]; then
    previous_tmp="${APP_ROOT}/.previous.${release_sha}.$$"
    ln -s -- "${previous_target}" "${previous_tmp}"
    mv -Tf -- "${previous_tmp}" "${APP_ROOT}/previous"
  fi
  printf 'Activated Zhangak release %s\n' "${release_sha}"
  exit 0
fi

if [[ -n "${previous_target}" ]]; then
  rollback_tmp="${APP_ROOT}/.rollback.${release_sha}.$$"
  ln -s -- "${previous_target}" "${rollback_tmp}"
  mv -Tf -- "${rollback_tmp}" "${APP_ROOT}/current"
  sudo -n /usr/bin/systemctl restart "${SERVICE}"
  die "health check failed; rolled back to $(basename -- "${previous_target}")"
fi

die "health check failed and there was no previous release to restore"
