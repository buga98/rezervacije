#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/rezervacije}"
REPO_URL="${REPO_URL:-https://github.com/buga98/rezervacije.git}"
DOMAIN="${DOMAIN:-rezervacije.lineaplusdev.com}"
DB_NAME="${DB_NAME:-rezervacije}"
DB_USER="${DB_USER:-rezervacije_user}"
SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-admin@lineaplusdev.com}"

log() { printf '\n\033[1;36m[rezervacije]\033[0m %s\n' "$*"; }
fail() { printf '\n[rezervacije] ERROR: %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null || fail "git nije instaliran"
command -v docker >/dev/null || fail "Docker nije instaliran"
command -v openssl >/dev/null || fail "openssl nije instaliran"
command -v mariadb >/dev/null || fail "MariaDB client nije instaliran"

docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin nije dostupan"

log "Provjera sudo pristupa"
sudo -v

log "Priprema ${APP_DIR}"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  [[ -z "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]] || fail "$APP_DIR nije prazan i nije Git repozitorij"
  git clone --branch main "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  DB_PASS="$(openssl rand -hex 24)"
  AUTH_SECRET="$(openssl rand -hex 48)"
  CRON_SECRET="$(openssl rand -hex 32)"
  SUPERADMIN_PASSWORD="$(openssl rand -hex 12)"
  DEMO_OWNER_PASSWORD="$(openssl rand -hex 12)"

  log "Kreiranje lokalne MariaDB baze i korisnika"
  sudo mariadb --protocol=socket <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

  umask 077
  cat > .env <<ENV
NODE_ENV=production
APP_URL=https://${DOMAIN}
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}
DB_POOL_SIZE=10
AUTH_SECRET=${AUTH_SECRET}
CRON_SECRET=${CRON_SECRET}
SUPERADMIN_EMAIL=${SUPERADMIN_EMAIL}
SUPERADMIN_PASSWORD=${SUPERADMIN_PASSWORD}
SEED_DEMO=true
DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD}

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Linea+ Rezervacije <noreply@lineaplusdev.com>"

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:${SUPERADMIN_EMAIL}
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_SMS_FROM=
TWILIO_WHATSAPP_FROM=
ENV

  chmod 600 .env
else
  log ".env već postoji; ne diram postojeće tajne i postavke"
  SUPERADMIN_PASSWORD=""
  DEMO_OWNER_PASSWORD=""
fi

log "Docker build"
docker compose build --pull

if ! grep -q '^VAPID_PUBLIC_KEY=.$' .env 2>/dev/null && [[ -z "$(grep '^VAPID_PUBLIC_KEY=' .env | cut -d= -f2-)" ]]; then
  log "Generiranje VAPID ključeva za PWA push"
  VAPID_JSON="$(docker compose run --rm --no-deps app node -e "const w=require('web-push'); console.log(JSON.stringify(w.generateVAPIDKeys()))")"
  VAPID_PUBLIC="$(printf '%s' "$VAPID_JSON" | tail -n1 | python3 -c 'import json,sys; print(json.load(sys.stdin)["publicKey"])')"
  VAPID_PRIVATE="$(printf '%s' "$VAPID_JSON" | tail -n1 | python3 -c 'import json,sys; print(json.load(sys.stdin)["privateKey"])')"
  sed -i "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${VAPID_PUBLIC}|" .env
  sed -i "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=${VAPID_PRIVATE}|" .env
fi

log "Primjena migracija"
docker compose run --rm --no-deps app npx prisma migrate deploy

log "Seed SuperAdmina i demo salona"
docker compose run --rm --no-deps app npm run db:seed

log "Pokretanje app + notification workera"
docker compose up -d --remove-orphans

log "Health check"
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:3700/api/health >/dev/null; then
    printf '\n✅ Rezervacije rade na http://127.0.0.1:3700\n'
    printf '🌐 Nakon Hestia proxyja: https://%s\n' "$DOMAIN"
    if [[ -n "${SUPERADMIN_PASSWORD:-}" ]]; then
      printf '\nSuperAdmin: %s\nLozinka: %s\n' "$SUPERADMIN_EMAIL" "$SUPERADMIN_PASSWORD"
      printf '\nDemo owner: demo@lineaplusdev.com\nLozinka: %s\n' "$DEMO_OWNER_PASSWORD"
      printf '\nSpremi ove lozinke; nalaze se i u %s/.env.\n' "$APP_DIR"
    fi
    exit 0
  fi
  sleep 2
done

docker compose ps
docker compose logs --tail=100 app
fail "Aplikacija nije prošla health check"
