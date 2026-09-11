# Linea+ Rezervacije

Multi-tenant sustav za online rezervacije termina namijenjen salonima, masažama, beauty/wellness djelatnostima i drugim uslužnim firmama. Public booking je mobile-first, a Owner/Staff i SuperAdmin su potpuno responzivni i PWA-ready.

## Stack

- Next.js 16.3.4 + React 19 + TypeScript
- MariaDB/MySQL + Prisma ORM 7
- Docker Compose; aplikacija sluša samo na `127.0.0.1:3700`
- HttpOnly session + RBAC (`SUPERADMIN`, `OWNER`, `MANAGER`, `STAFF`)
- SMTP/Nodemailer email queue
- PWA Web Push / VAPID
- Stripe PaymentIntent priprema za akontaciju
- notification worker/outbox

## Glavne funkcije

Public flow: **Usluga → Djelatnik/Bilo tko → slobodan termin → podaci klijenta → potvrda**. Availability engine računa radno vrijeme salona i djelatnika, pauze, overrideove, postojeće rezervacije te prep/cleanup buffer.

Owner/Staff dobiva kalendar, drag-and-drop pomicanje, Walk-in unos, klijentske kartone, KPI/statistiku i PWA push. SuperAdmin vidi sve tenant firme, statuse i agregirane brojke.

Klijentski manage link podržava otkazivanje/promjenu prema tenant pravilima; zadano online otkazivanje je do 12 sati prije termina.

## Zaštita od double bookinga

Booking se izvršava u `Serializable` transakciji. Zauzeti interval, uključujući buffer, dodatno se zapisuje u 5-minutne `AppointmentSlotLock` segmente. Unique `(staffId, startsAt)` na DB razini fizički sprječava dvije istovremene rezervacije istog djelatnika.

## Struktura

- `app/` — Next.js stranice i API routeovi
- `components/` — responzivne UI komponente
- `lib/booking/` — availability i booking engine
- `lib/notifications/` — email/push queue i senderi
- `prisma/` — schema, migracija i seed
- `scripts/notification-worker.ts` — worker
- `deploy/` — prvi VPS install, update deploy i Hestia proxy primjer
- `.github/workflows/ci.yml` — build provjera
- `.github/workflows/deploy-vps.yml` — produkcijski update workflow

Detaljna specifikacija je u `SPECIFICATION.md`, a arhitektura/ERD u `ARCHITECTURE.md`.

## Lokalno

```bash
cp .env.example .env
# upiši DATABASE_URL, AUTH_SECRET i SUPERADMIN_PASSWORD
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

Ako želiš demo salon, postavi:

```env
SEED_DEMO=true
DEMO_OWNER_PASSWORD=<jaka-lozinka>
```

Public demo tada je `/book/demo-salon`, a demo owner `demo@lineaplusdev.com` koristi lozinku iz `DEMO_OWNER_PASSWORD`. U repozitoriju nema produkcijskih lozinki.

## Prvi deploy na Linea+ VPS

Produkcijski direktorij je `/opt/rezervacije`, domena `rezervacije.lineaplusdev.com`, a reverse proxy cilja `127.0.0.1:3700`.

Nakon SSH prijave na VPS dovoljno je pokrenuti:

```bash
curl -fsSL https://raw.githubusercontent.com/buga98/rezervacije/main/deploy/first-install.sh -o /tmp/rezervacije-install.sh
bash /tmp/rezervacije-install.sh
```

Skripta interaktivno traži samo postojeći `sudo` pristup. Zatim sama:

- klonira/povuče repo u `/opt/rezervacije`
- kreira lokalnu MariaDB bazu `rezervacije` i usera vezanog uz localhost
- generira DB/Auth/Cron/SuperAdmin/demo tajne u `/opt/rezervacije/.env`
- radi Docker build
- generira VAPID ključeve
- primjenjuje Prisma migracije
- seed-a SuperAdmin + sigurni demo salon
- pokreće app i worker
- radi health check na `http://127.0.0.1:3700/api/health`

MariaDB ostaje lokalna na VPS-u; Docker koristi host networking pa bazu nije potrebno otvarati prema Docker bridgeu ili internetu.

Hestia SSL i reverse proxy primjer su u `deploy/hestia-nginx.conf`. `APP_URL` je već predviđen za `https://rezervacije.lineaplusdev.com`.

## Budući deployi

`.github/workflows/deploy-vps.yml` radi update bez ponovnog bootstrapiranja. GitHub repository secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- opcionalno `VPS_PORT` (default 22)

Workflow radi `git reset` na `main`, Docker rebuild, `prisma migrate deploy`, restart i health check. `.env` i sve produkcijske tajne ostaju samo na VPS-u.

## Obavijesti

Booking queue kreira email/push potvrde firmi i klijentu te remindere 24 h i 2 h prije termina. VAPID public key se dohvaća runtime API-jem pa se može konfigurirati na VPS-u bez rebuilda.

Za stvarno slanje emaila u `.env` treba postaviti SMTP podatke. SMS/WhatsApp enum i queue struktura postoje; provider adapter je sljedeći korak.

## CI

Svaki push na `main` provjerava:

- bash deploy skripte
- Docker Compose konfiguraciju
- npm dependency install
- Prisma generate
- Next.js production build

Tek zeleni `main` treba deployati na produkciju.
