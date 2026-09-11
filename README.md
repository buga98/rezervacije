# Linea+ Rezervacije

Produkcijski orijentiran, multi-tenant sustav za rezervacije termina za frizerske salone, masaže, beauty, wellness i druge uslužne djelatnosti. Projekt je mobile-first, responzivan i PWA-ready, s Public Booking Clientom, Staff/Owner Dashboardom i SuperAdmin panelom.

## Stack

- Next.js 16.3.4 + React 19 + TypeScript
- MariaDB/MySQL + Prisma ORM 7
- Docker Compose, port `127.0.0.1:3700`
- HttpOnly JWT session + RBAC
- Email preko SMTP/Nodemailer
- PWA Web Push preko VAPID
- Stripe PaymentIntent priprema za akontaciju/kartice/Apple Pay/Google Pay
- Worker/outbox za pouzdane obavijesti

## UX flow za klijenta

1. **Usluga** — naziv, opis, trajanje i cijena.
2. **Djelatnik** — “Bilo tko” ili specifični djelatnik.
3. **Pametni kalendar** — samo stvarno slobodni termini; salon hours + staff shift + pauze + overrideovi + appointments + prep/cleanup buffer.
4. **Podaci klijenta** — ime, telefon, email, napomena.
5. **Potvrda / akontacija** — termin je `CONFIRMED`, ili `PENDING` ako tenant zahtijeva akontaciju.
6. **Manage link** — tokenizirani link za otkazivanje/promjenu; online otkazivanje default do 12 h prije.

Cilj dizajna je da korisnik bilo koje dobi može rezervirati bez uputa: jedna odluka po ekranu, velike dodirne mete, jasna cijena i trajanje, bez skrivenih koraka.

## Staff / Owner Dashboard

- dnevni i tjedni pregled termina
- promet, broj termina i no-show KPI
- responzivni kalendar; događaji su drag-and-drop
- ručni Walk-in API
- klijentski karton: kontakti, broj posjeta, potrošnja, no-show, blokada i interne napomene
- PWA instalacija i push obavijesti
- javni booking link po tenant slug-u: `/book/{slug}`

## SuperAdmin

- pregled svih firmi/tenant-a
- status pretplate (`TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED`)
- broj korisnika, klijenata i termina
- ulazna točka za budući billing, planove i feature flags

## Baza / relacijski model

Glavne tablice:

- `Tenant` — firma/salon, timezone, valuta, cancellation policy, deposit postavke
- `User` — login + `SUPERADMIN/OWNER/MANAGER/STAFF`
- `StaffProfile`, `StaffService`
- `ServiceCategory`, `Service`
- `WorkingHour`, `StaffBreak`, `ScheduleOverride`
- `Customer`
- `Appointment`
- `AppointmentSlotLock` — zaštita od double-bookinga
- `Payment`
- `PushSubscription`
- `NotificationJob`

Detaljna veza i race-condition strategija su u `ARCHITECTURE.md`.

## Slot Generation API

```text
GET /api/public/{tenantSlug}/availability
  ?date=2026-09-17
  &serviceId=...
  &staffId=any
```

Core funkcija je `lib/booking/availability.ts::getAvailableSlots`. Vraća:

```json
{
  "slots": [
    { "start": "09:00", "startsAt": "2026-09-17T07:00:00.000Z", "staffId": "...", "staffName": "Ana" }
  ]
}
```

## Double booking / race conditions

Sama provjera dostupnosti nikad nije dovoljna. Ovaj projekt radi dvije zaštite:

- booking se zapisuje u `Serializable` transakciji
- svaki zauzeti interval (uključujući prep + cleanup) se u koracima od 5 minuta upisuje u `AppointmentSlotLock`; DB unique `(staffId, startsAt)` fizički onemogućuje dva termina u istom intervalu

Ako dvije osobe kliknu isti termin istovremeno, jedna transakcija uspije, druga dobije `409`, frontend osvježi dostupnost i traži drugi termin.

## Obavijesti

Na kreiranju termina queue se puni s:

- potvrdom klijentu na email
- emailom OWNER/MANAGER korisnicima
- push obavijesti firmi
- reminderima 24 h i 2 h prije (konfigurabilno po tenant-u)

Na otkazivanju se budući reminderi gase i šalje se obavijest objema stranama. Worker provjerava queue svakih 15 sekundi.

SMS/WhatsApp: dodati Twilio adapter u `lib/notifications/send.ts` za već postojeće enum kanale `SMS` i `WHATSAPP`.

## Lokalno pokretanje

```bash
cp .env.example .env
# upiši DATABASE_URL i AUTH_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Demo seed:

- SuperAdmin email/lozinka dolaze iz `.env`
- Owner: `demo@lineaplusdev.com` / `Demo123!`
- Public demo: `/book/demo-salon`

Obavezno promijeni demo lozinke prije produkcije.

## Deploy na tvoj VPS

Predviđeni direktorij: `/opt/rezervacije`. Predviđeni port: `127.0.0.1:3700`.

### 1. Kreiraj MariaDB bazu i usera

Primjer naziva:

```sql
CREATE DATABASE rezervacije CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rezervacije_user'@'%' IDENTIFIED BY 'JAKA_LOZINKA';
GRANT ALL PRIVILEGES ON rezervacije.* TO 'rezervacije_user'@'%';
FLUSH PRIVILEGES;
```

Ako bazu kreiraš kroz HestiaCP, samo upotrijebi Hestia DB/user vrijednosti u `DATABASE_URL`.

### 2. Server

```bash
cd /opt
sudo git clone <GITHUB_REPO_URL> rezervacije
sudo chown -R luka:luka /opt/rezervacije
cd /opt/rezervacije
cp .env.example .env
nano .env
```

Generiraj tajne:

```bash
openssl rand -base64 48
npx web-push generate-vapid-keys
```

Zatim:

```bash
docker compose build
docker compose run --rm app npx prisma migrate deploy
docker compose run --rm app npm run db:seed
docker compose up -d
curl http://127.0.0.1:3700/api/health
```

### 3. Hestia

Za `rezervacije.lineaplusdev.com` SSL ostaje na Hestiji. Reverse proxy vodi na `127.0.0.1:3700`. Primjer je u `deploy/hestia-nginx.conf`.

Nakon aktivnog SSL-a u `.env` mora biti:

```env
APP_URL=https://rezervacije.lineaplusdev.com
```

## PWA

Manifest je `/manifest.webmanifest`, service worker `/sw.js`. Owner/Staff nakon login-a može uključiti push kroz gumb **Uključi obavijesti**. Za iPhone PWA treba dodati stranicu na Home Screen; Web Push radi za instalirane web aplikacije na podržanim iOS verzijama.

## Sljedeći production koraci

1. Stripe webhook + automatsko oslobađanje neplaćenog `PENDING` holda.
2. UI za postavke usluga, djelatnika, smjena, pauza i godišnjih.
3. Reschedule flow na klijentskom manage linku.
4. Twilio SMS/WhatsApp adapter i consent postavke.
5. Audit log, rate limiting i login brute-force protection.
6. Subscription billing za tenant-e i feature flags po paketu.
7. Dnevni backup baze + restore test.
8. E2E testovi za simultani booking i DST promjene timezonea.
