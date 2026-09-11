# Funkcionalna i tehnička specifikacija — Linea+ Rezervacije

## 1. Cilj proizvoda

Platforma je SaaS multi-tenant sustav za rezervacije i upravljanje terminima. Primarni korisnici su saloni i uslužne djelatnosti: frizeri, barber shopovi, nokti, pedikura, kozmetika, masaže, wellness, fizioterapija, osobni treneri i slični modeli gdje se rezervira vrijeme određenog djelatnika.

Glavni UX cilj: klijent mora do potvrde termina doći u 30–60 sekundi bez registracije, a djelatnik mora u manje od 10 sekundi vidjeti tko mu dolazi, što radi i kada.

## 2. Domene aplikacije

### Public Booking Client

Ruta: `/book/{tenantSlug}`.

Koraci:

1. izbor usluge
2. izbor djelatnika ili “Bilo tko”
3. izbor dana i slobodnog vremena
4. kontakt podaci i napomena
5. potvrda / akontacija
6. manage link za promjenu ili otkazivanje

Pravila UX-a:

- veliki touch targeti, najmanje 44 px
- jedna glavna odluka po koraku
- cijena i trajanje su uvijek vidljivi prije potvrde
- nema prikaza zauzetih slotova; korisnik vidi samo slobodne
- mobilni ekran je primarni dizajn, desktop koristi istu logiku u 2 stupca
- booking ne zahtijeva account kupca

### Staff/Admin Dashboard

Rute: `/dashboard`, `/dashboard/calendar`, `/dashboard/customers`.

Owner/Manager:

- svi termini tenant-a
- drag-and-drop pomicanje
- Walk-in termin
- svi klijenti i karton klijenta
- uređivanje usluga, cijena, djelatnika, smjena, pauza i blokada vremena
- statistika i promet
- uključivanje PWA push obavijesti
- cancellation/no-show upravljanje

Staff:

- vlastiti raspored
- vlastiti termini
- dopušteni dio klijentskog kartona
- status completed/no-show

### SuperAdmin

Ruta: `/superadmin`.

- tenant-i i status pretplate
- broj korisnika, klijenata, termina
- suspend/activate tenant
- planovi, billing i feature flags
- platform settings, notification health, audit

## 3. Booking domenski model

### Service

- `durationMin`: trajanje koje klijent vidi
- `prepMin`: blokada prije početka, npr. priprema prostorije
- `cleanupMin`: blokada poslije, npr. dezinfekcija
- `priceCents`: integer u centima, nikad floating point
- staff-specific override cijene/trajanja preko `StaffService`

Primjer: masaža traje 60 min, prep 10, cleanup 10. Appointment je 10:00–11:00, ali resource lock je 09:50–11:10.

### Working hours

Salon ima osnovni tjedni raspored. Djelatnik može imati uži raspored; efektivna smjena je presjek salona i djelatnika.

`ScheduleOverride` rješava:

- godišnji / bolovanje / privatni izlazak: `BLOCKED`
- izvanredna radna subota ili produženo vrijeme: `WORKING`

### Customer

Jedinstveni ključ u tenant-u je telefon. Email nije obavezan jer dio korisnika rezervira samo telefonom. Bilješke su interne; osjetljive medicinske bilješke ne bi se smjele zapisivati bez posebne pravne osnove i dizajna privatnosti.

No-show policy može npr. nakon 2 ili 3 nedolaska postaviti `blocked=true`, nakon čega online booking vraća zabranu i traži direktan kontakt sa salonom.

## 4. Availability algoritam

Ulaz:

```ts
{ tenantId, date, serviceId, staffId? }
```

Izlaz:

```ts
Array<{ start, startsAt, staffId, staffName }>
```

Pseudokod:

```text
tenant = load tenant/timezone/step
service = load service
candidateStaff = staff that can perform service

for staff in candidateStaff:
  intervals = intersection(salonHours, staffHours)
  intervals = apply working overrides

  for each interval:
    for start every slotStepMinutes:
      lock = [start - prep, start + duration + cleanup)
      if lock outside shift: reject
      if overlaps staff break: reject
      if overlaps BLOCKED override: reject
      if overlaps PENDING/CONFIRMED appointment: reject
      otherwise return slot

if staffId omitted:
  de-duplicate same startsAt and attach one available staff
```

Svi DB timestampovi spremaju se UTC, a poslovna pravila se računaju u tenant timezoneu (`Europe/Zagreb` po defaultu). To je bitno zbog DST prijelaza.

## 5. Double booking zaštita

Problem: A i B istovremeno učitaju 10:00 kao slobodno. Oboje kliknu potvrdi. Ako backend radi samo `SELECT` pa `INSERT`, oba termina mogu proći.

Rješenje:

- backend ponovno validira slot neposredno prije upisa
- upis je `Serializable` transaction
- appointment stvara lock retke svakih 5 minuta preko cijelog resource intervala
- unique DB index `(staffId, startsAt)` garantira da druga transakcija ne može zauzeti isto vrijeme
- konflikt se pretvara u HTTP 409 i UI ponovno učitava slotove

Ova zaštita radi neovisno o broju Node procesa/container replica.

## 6. Cancellation / reschedule

Tenant definira `cancellationHours` (default 12).

Kod kreiranja termina generira se 256-bitni random manage token. U bazi se sprema samo SHA-256 hash. Link izgleda:

```text
/manage/{appointmentId}?token=...
```

Klijent smije:

- promijeniti termin do cutoffa
- otkazati termin do cutoffa

Otkazivanje:

- `status=CANCELLED`
- obriši slot lockove
- pending reminder jobovi → `SKIPPED`
- queue email/push obavijest firmi i kupcu

Reschedule:

- ponovno provjeri availability
- u jednoj transakciji zamijeni stare lockove novima
- ako dođe race conflict, stari termin ostaje očuvan jer se cijela transakcija rollbacka

## 7. Notifications

Implementiran je outbox model `NotificationJob`.

Zašto queue umjesto slanja u requestu:

- SMTP može trajati nekoliko sekundi
- push provider može privremeno pasti
- booking mora vratiti odgovor brzo
- lakše je pratiti `PENDING/SENT/FAILED/SKIPPED`

Default događaji:

- customer confirmation
- admin new appointment
- customer reminder 24h
- customer reminder 2h
- cancellation customer/admin
- reschedule confirmation

Kanali:

- EMAIL: implementirano
- PUSH: implementirano
- SMS: adapter predviđen
- WHATSAPP: adapter predviđen

Za SMS/WhatsApp preporuka je Twilio ili drugi EU provider uz eksplicitne opt-in/consent postavke.

## 8. Payment model

Akontacija je tenant opcija. `depositPercent` određuje iznos.

Tok:

1. slot se kratkotrajno rezervira kao `PENDING`
2. backend kreira Stripe PaymentIntent
3. Payment Element klijentu nudi karticu i wallet metode koje Stripe podržava za njegov uređaj/merchant konfiguraciju
4. `payment_intent.succeeded` webhook: Payment → `PAID`, Appointment → `CONFIRMED`
5. timeout job nakon npr. 15 min briše neplaćeni appointment i lockove

Važno: “NFC” nije generički browser payment API. Za online booking realan put su Stripe kartice/Apple Pay/Google Pay; fizički tap-to-pay na recepciji je zaseban POS/Tap to Pay integration.

## 9. RBAC i tenant izolacija

Session sadrži `userId`, `tenantId`, `role` i potpisan je `AUTH_SECRET` ključem u HttpOnly Secure SameSite=Lax cookieju.

Backend pravila:

- nikad ne vjerovati `tenantId` poslanom iz browsera admin dijela
- tenant se izvodi iz sessiona
- svaki query mora imati tenant scope
- `STAFF` appointment query dodatno se ograničava na `staffProfile.id`
- `SUPERADMIN` je zasebna kontrolna ravnina

Produkcijski dodatno:

- login rate-limit po IP/emailu
- audit log za appointment/billing/permission promjene
- CSRF za osjetljive POST radnje ako se prijeđe iz same SameSite zaštite
- Content Security Policy
- rotacija secretova
- backup i periodični restore test

## 10. PWA

Manifest i service worker su uključeni.

Admin PWA:

- instalacija na iPhone/Android/desktop
- standalone prikaz
- Web Push za nove/cancelled termine
- responsive sidebar → bottom navigation

Offline strategija u ovoj verziji je konzervativna: shell može biti cachean, ali termini nisu source-of-truth offline jer bi offline zapisivanje rezervacija bez sinkronizacijskog protokola povećalo rizik konflikta. Sljedeća faza može dodati read-only offline raspored i queued admin akcije s conflict resolutionom.

## 11. Performanse

- availability query je ograničen na jedan dan i relevantne staff ID-eve
- indeksi postoje za `(tenantId, startsAt, status)`, `(staffId, startsAt, endsAt)`, working hours, overrides i notification queue
- booking client učitava catalog jednom, availability samo na promjenu dana/staffa
- DB connection pool default 10 po app procesu
- notification worker je odvojen od web procesa

Za veći promet:

- Redis cache za catalog i working-hours konfiguraciju
- queue broker (Redis/BullMQ) umjesto DB outbox polling-a
- horizontalne app replike iza Nginxa
- read replica za analytics, ne za booking consistency path

## 12. API površina

Public:

- `GET /api/public/:slug/catalog`
- `GET /api/public/:slug/availability`
- `POST /api/public/:slug/appointments`
- `POST /api/public/:slug/payment-intent`
- `POST /api/public/manage/:id/cancel`
- `POST /api/public/manage/:id/reschedule`

Admin:

- `POST /api/auth/login`
- `GET /api/admin/appointments`
- `POST /api/admin/walkin`
- `POST /api/admin/appointments/:id/move`
- `POST /api/admin/push/subscribe`

Ops:

- `GET /api/health`
- `POST /api/cron/reminders` kao alternativni cron entrypoint workeru

## 13. Preporučeni razvoj po fazama

### Faza 1 — trenutni projekt

Booking, slot engine, DB model, auth, osnovni dashboard, superadmin, email/push queue, PWA, cancellation/reschedule, Docker/VPS.

### Faza 2 — poslovna administracija

CRUD usluga/kategorija/djelatnika, rasporedi, godišnji, detaljni calendar modal, walk-in forma, customer detail, completed/no-show workflow.

### Faza 3 — monetizacija

Stripe webhook + subscription billing tenant-a, planovi, trial, invoice status, feature flags.

### Faza 4 — komunikacija i automatizacija

Twilio/WhatsApp, template editor, review request nakon termina, reactivation kampanje, waiting list, recurring appointments.

### Faza 5 — napredni analytics

occupancy, revenue per staff/service, cancellation rate, no-show, returning customers, cohort retention, best hours/days.
