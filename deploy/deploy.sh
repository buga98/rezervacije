#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/rezervacije}"
cd "$APP_DIR"
git pull --ff-only
if [ ! -f .env ]; then echo "Missing $APP_DIR/.env" >&2; exit 1; fi
docker compose build --pull
docker compose run --rm app npx prisma migrate deploy
docker compose up -d --remove-orphans
docker compose ps
curl -fsS http://127.0.0.1:3700/api/health && echo
