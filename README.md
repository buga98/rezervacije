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

## Deploy

Predviđeni direktorij: `/opt/rezervacije`. Predviđeni port: `127.0.0.1:3700`.

Detaljne upute i puna specifikacija nalaze se u repozitoriju.