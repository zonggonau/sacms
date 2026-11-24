#!/usr/bin/env bash
set -euo pipefail
umask 077
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT

tar -czf "$work/config.tar.gz" docker-compose.yml Caddyfile docker/cron/crontab db/manual-migrations/*.sql
digest=$(sha256sum "$work/config.tar.gz" | cut -d' ' -f1)
options=(-T -p "$VPS_PORT" -o ConnectTimeout=60 -o ServerAliveInterval=15 -o ServerAliveCountMax=3
  -o StrictHostKeyChecking=accept-new -o "UserKnownHostsFile=$work/known_hosts" -o NumberOfPasswordPrompts=1)
if [[ -n ${VPS_KEY:-} ]]; then
  printf '%s\n' "$VPS_KEY" | tr -d '\r' > "$work/key"
  options+=(-i "$work/key" -o IdentitiesOnly=yes)
fi
if [[ -n ${VPS_PASSWORD:-} ]]; then
  printf '%s\n' '#!/bin/sh' 'printf "%s\n" "$VPS_PASSWORD"' > "$work/askpass"
  chmod 700 "$work/askpass"
  export SSH_ASKPASS="$work/askpass" SSH_ASKPASS_REQUIRE=force DISPLAY=ci
else
  options+=(-o BatchMode=yes)
fi

# One SSH connection per attempt. Only extract after the entire archive arrives.
remote=$(cat <<'REMOTE'
set -eu
archive=$(mktemp)
trap 'rm -f -- "$archive"' EXIT
cat > "$archive"
printf '%s  %s\n' "$expected" "$archive" | sha256sum -c -
mkdir -p /opt/sacms/db/backups /opt/sacms/db/manual-migrations /opt/sacms/caddy_data /opt/sacms/caddy_config /opt/sacms/scripts
tar -xzf "$archive" -C /opt/sacms
REMOTE
)

for attempt in 1 2 3; do
  if ssh "${options[@]}" -- "$VPS_USER@$VPS_HOST" "expected=$digest; $remote" < "$work/config.tar.gz"; then
    exit 0
  else
    status=$?
  fi
  if [[ $status -ne 255 || $attempt -eq 3 ]]; then exit "$status"; fi
  echo "SSH connection failed (attempt $attempt/3). Retrying configuration sync." >&2
  sleep "$((attempt * 10))"
done
