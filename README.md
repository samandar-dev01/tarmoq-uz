# Tarmoq.uz: creators marketplace

A working marketplace where clients find and hire creators across Uzbekistan (for example mobile videographers), agree on written terms, pay through an escrow-style **sandbox** payment, receive the finished video, approve it, and leave a review. Includes provider onboarding, messaging, and an admin back office.

**The interface is in Uzbek (Latin script).** Visible text is written inline in the components, and the API error messages and the agreement template are Uzbek too. This README stays in English and quotes Uzbek button labels with an English gloss in brackets.

**Stack:** Next.js 14 (App Router) · TypeScript · PostgreSQL · Prisma · Tailwind · Zod · Vitest · Playwright

> **Important:** payments are a **sandbox**. No real money moves. See "Going live with real payments" before launching publicly.

---

## 1. What is included

| Area | Where | Notes |
|---|---|---|
| Auth (register, login, logout, roles) | `src/lib/auth.ts`, `src/app/api/auth/*`, `middleware.ts` | bcrypt, signed httpOnly cookie, role re-checked against the DB on every API call |
| Homepage | `src/app/page.tsx` | Hero search with a live creator feed, categories, top creators |
| Search and filters | `src/app/search`, `src/lib/providers.ts` | keyword, city, category, price range, sort, pagination, URL-shareable |
| Provider profiles | `src/app/providers/[slug]` | packages, portfolio, reviews, order button |
| Profile wizard | `src/components/wizard`, `src/app/api/profile` | 5 steps, server-validated, submit for admin review |
| Orders and agreements | `src/app/api/orders/*`, `src/lib/agreements.ts` | versioned terms, SHA-256 hash, acceptance time + IP recorded |
| Order state machine | `src/lib/orderMachine.ts` | one place defines every legal status change |
| Sandbox payments + escrow ledger | `src/lib/payments`, `src/app/api/payments/sandbox`, `src/app/checkout` | server decides the outcome; hold, release, refund, fee |
| Video delivery | `src/app/api/orders/[id]/delivery`, `src/lib/storage` | local disk (dev) or S3-compatible (prod), range-request streaming |
| Messaging | `src/app/messages`, `src/app/api/conversations`, `src/components/chat` | per-order and direct chats, 5-second polling, unread counts |
| Reviews | `src/app/api/orders/[id]/review`, `src/lib/reviews.ts` | one per completed order, rating recalculated |
| Client and provider dashboards | `src/app/dashboard/*` | next-action hints, earnings, escrow |
| Admin | `src/app/admin`, `src/app/api/admin/*` | approve or suspend providers, resolve disputes, hide reviews, stats |
| Audit log | `src/lib/audit.ts` | agreement acceptance, payments, approvals, admin actions |
| Loading, error, empty, success states | `src/components/ui`, `loading.tsx`, `error.tsx` | used on every data screen |
| Design system | `tailwind.config.ts`, `src/app/globals.css`, `src/components/ui` | Colours (CSS variables), fonts, radii and shadows live in one place: change a variable in `globals.css` to re-skin the site. Shared pieces: `Button`/`ButtonLink`, `Card`, `Container`, `Field`, `Avatar`, `Stars`, `StatTile`, `NavLink`, `Alert`, `EmptyState`. |

## 2. Requirements

- Node.js 20 or newer
- PostgreSQL 15 or newer (Docker Compose file included)

## 3. Database setup

```bash
cp .env.example .env
# edit .env: set AUTH_SECRET (generate one with: openssl rand -base64 32)

docker compose up -d        # starts Postgres on localhost:5432 (user/password: postgres/postgres, db: marketplace)
```

Using your own Postgres instead? Set `DATABASE_URL` in `.env`.

## 4. Installation

```bash
npm install
npx prisma migrate dev --name init   # FIRST RUN ONLY: creates prisma/migrations from schema.prisma and applies it
npm run db:constraints               # extra DB rules (rating 1-5, one paid payment per order, ...)
npm run db:seed                      # demo accounts and providers
```

Commit the generated `prisma/migrations` folder. On other machines and in production use:

```bash
npm run db:setup    # = prisma migrate deploy + db:constraints + db:seed (in production the seed creates categories only)
```

> If you change `prisma/schema.prisma`, create a new migration with `npx prisma migrate dev --name <change>`.

## 5. Development

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # TypeScript check
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright); first: npx playwright install chromium
```

## 6. Demo accounts

All demo accounts use the password **`Demo12345!`** (set `SEED_DEMO_PASSWORD` to change it before seeding).

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@demo.test` | `/admin` |
| Client | `client@demo.test` | |
| Provider, Andijon | `jasur@demo.test` | packages 300 000, 700 000, 1 500 000 UZS |
| Provider, Andijon | `madina@demo.test` | packages 450 000, 900 000 UZS |
| Provider, Andijon | `bobur@demo.test` | packages 150 000, 600 000 UZS |
| Provider, Toshkent | `dilshod@demo.test` | used to test the city filter |
| Provider, **pending approval** | `sevara@demo.test` | used to test admin approval |

## 7. Payment sandbox

Payments run through an internal sandbox gateway. The browser sends card details; **only the server** decides whether the payment succeeded. There is no field the client can send to force success.

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` | Success: money is held in escrow, order moves to *In progress* |
| `5555 5555 5555 4444` | Success (Mastercard) |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Declined: insufficient funds |
| any other number | Rejected as "not a test card" (nothing is recorded as paid) |

Use any future expiry (for example `12/34`) and any 3-digit CVC. The checkout page has "Fill:" buttons for these cards.

How money moves (all recorded in the `LedgerEntry` table):
1. **Pay** → `ESCROW_HOLD`, payment status `HELD`.
2. **Client approves** → `HELD → RELEASED`: `PROVIDER_PAYOUT` plus `PLATFORM_FEE` (`PLATFORM_FEE_PERCENT`, default 10%).
3. **Dispute resolved as refund** → `HELD → REFUNDED`: `REFUND` entry.

A unique database index guarantees an order can have only one successful payment. Card numbers are never stored, only brand and last 4 digits.

## 8. Test scenarios

### 8.1 Manual walkthrough (the required end-to-end scenario)

Open two browsers (or one normal and one private window).

1. **Register** a new client at `/register` ("Buyurtma bermoqchiman", I want to order).
2. Go to **Ijodkorlar** (creators). Set Shahar (city) = Andijon, Yoʻnalish (category) = Mobilografiya, Eng kam narx (min price) 250000, Eng yuqori narx (max price) 350000, **Filtrlarni qoʻllash** (apply filters). Only **Jasur Karimov** is shown.
3. Open his **profile**, click **Buyurtma berish** (order) on "Instagram Reel (60 soniyagacha)".
4. Write a brief (20+ characters) and **Buyurtma yuborish** (send order request). Status: *Soʻrov yuborildi* (requested).
5. In the other browser sign in as `jasur@demo.test`, open the order, **Shartlarni mijozga yuborish** (send terms to client). Status: *Kelishuv kutilmoqda* (agreement pending).
6. As the client, reload, tick "Shartlar bilan tanishib chiqdim va qabul qilaman" (I have read and accept these terms), **Kelishuvni qabul qilish** (accept agreement). Status: *Toʻlov kutilmoqda* (awaiting payment). (The acceptance time, IP and terms hash are stored.)
7. Click **Xavfsiz toʻlash (sinov rejimi)** (pay securely, sandbox), use `4242 4242 4242 4242`, then the **… soʻm toʻlash** (pay) button. Status: *Jarayonda* (in progress).
8. As the provider, reload, choose a small `.mp4`, **Ishni topshirish** (upload delivery). Status: *Topshirildi* (delivered).
9. As the client, reload: play the video, **Qabul qilish va toʻlovni oʻtkazish** (approve & release payment). Status: *Yakunlandi* (completed), and the **Tranzaksiya** (transaction) panel shows "Ijodkorga oʻtkazildi" (released to provider).
10. **Sharhni yuborish** (submit a review). It appears on Jasur's public profile and updates his rating.

### 8.2 Permission checks

- Signed out: `/admin`, `/dashboard/client`, `/messages` redirect to sign in.
- As `client@demo.test`: `/admin` shows the "Ruxsat yoʻq" (no access) page. `GET /api/admin/stats` returns 403.
- As `jasur@demo.test`: `POST /api/orders` returns 403 (providers cannot order). Another provider (`madina@demo.test`) gets 404 on Jasur's order.
- A second client gets 404 on the first client's order and conversation.
- As `admin@demo.test`: `/admin/providers` → **Tasdiqlash** (approve) Sevara; she then appears in `/search?q=Sevara`.

### 8.3 Dispute and refund

After step 7 above, as either party click **Nizo ochish** (open a dispute, reason 10+ characters). As admin open **Admin → Buyurtmalar** (orders), read the reason, and choose **Ijodkorga oʻtkazish** (release to provider) or **Mijozga qaytarish** (refund client).

### 8.4 Automated tests

```bash
npm test             # unit: order state machine, sandbox card rules and fees, agreement hashing, validators, search parsing
npm run test:e2e     # needs the app's database to be migrated and seeded
```

The Playwright suite (`tests/e2e`) covers: the full client journey above through the UI (`client-journey.spec.ts`); anonymous, client, provider and admin permission boundaries and order/conversation privacy (`permissions.spec.ts`); payment tamper-resistance, declined cards, double payment, upload validation, one review per order (`payments.spec.ts`); and admin approval (`admin.spec.ts`).

## 9. Environment variables

See `.env.example`. The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Signs session cookies. Required, 16+ random characters. **Change in production.** |
| `PLATFORM_FEE_PERCENT` | Fee deducted from the provider payout on release (default 10) |
| `STORAGE_DRIVER` | `local` (dev) or `s3` |
| `MAX_UPLOAD_MB` | Largest accepted delivery video (default 100) |
| `S3_*` | Bucket and credentials when `STORAGE_DRIVER=s3` |

## 10. Production deployment

1. **Provision** a managed PostgreSQL database and (recommended) an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, ...). Keep the bucket **private**; the app serves files through signed URLs.
2. **Set environment variables** on your host: `DATABASE_URL`, a fresh `AUTH_SECRET`, `NODE_ENV=production`, `STORAGE_DRIVER=s3` plus the `S3_*` values, `APP_URL`, `PLATFORM_FEE_PERCENT`, `MAX_UPLOAD_MB`.
3. **Build and run**, either:
   - Docker: `docker build -t creators . && docker run -p 3000:3000 --env-file .env creators` (the container applies migrations and DB constraints on start), or
   - Node host: `npm ci && npm run build && npm run db:deploy && npm run db:constraints && npm start`.
4. **Create the first admin** (do not run the demo seed in production). Register normally, then in the database run: `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';`
5. **Put it behind HTTPS** (a reverse proxy such as Caddy or nginx, or your platform's TLS). Cookies are marked `secure` in production. Make sure the proxy forwards `X-Forwarded-For` (used for the agreement acceptance IP and rate limiting).
6. **Back up** the database regularly and enable versioning or lifecycle rules on the bucket.
7. **Set a request body limit** on the proxy at least as large as `MAX_UPLOAD_MB`.

### Going live with real payments

The sandbox is real code with a real state machine, but it does not talk to a bank. Before charging real customers:
- Implement a gateway adapter (for example Payme, Click or Stripe) that creates the payment, confirms it from the **gateway's signed webhook** (not from the browser), and calls the same hold/release/refund functions in `src/lib/payments/sandbox.ts`.
- Check the legal and tax requirements for holding client funds and paying providers in Uzbekistan; many gateways do this through their own marketplace or split-payment products.
- Run the payment tests (`tests/e2e/payments.spec.ts`) against the new adapter.

## 11. Known limitations (be aware before launch)

- **Payments are sandbox only** (see above).
- **No email or SMS.** There is no email verification, password reset, or notification when a message or order arrives. Users must check the site.
- **Messaging uses 5-second polling**, not websockets. Fine for this scale; use a realtime service if you need instant delivery.
- **Video uploads pass through the server** and are held in memory (limit `MAX_UPLOAD_MB`, default 100). For larger files, switch to direct-to-bucket (presigned) uploads.
- **Rate limiting is in-memory** (per server instance). Use Redis or your proxy's rate limiting when running several instances.
- Dates are shown in Tashkent time (UTC+5, a fixed offset: Uzbekistan has no daylight saving).
- Search is a database `ILIKE` query, which is fine for thousands of profiles; consider Postgres full-text search or a search service beyond that.

## 12. Project layout

See `ARCHITECTURE.md` for the design and `src/` for the code. Key conventions:
- Every API route is wrapped in `handle()` (consistent JSON errors) and starts with `requireRole(...)` or `requireUser()`.
- Order status changes go through `assertTransition()` and are applied with conditional `updateMany` so double clicks and races cannot apply twice.
- Pages call `requirePageRole(...)`; middleware is only a first line of defence.

## 13. Free deployment (Render + Supabase)

The site is one Next.js app, so pages and API deploy together. Everything below is on free plans and needs no credit card.

| Part | Where |
|---|---|
| App (pages + API) | Render free web service, built from `Dockerfile`, described by `render.yaml` |
| Database | Supabase free Postgres (use the **Session pooler** connection string, port 5432) |
| Delivered videos | Supabase Storage, private bucket `deliveries` (S3-compatible, `STORAGE_DRIVER=s3`) |
| Keep awake | UptimeRobot free monitor: `GET /` every 5 minutes |

1. **Supabase:** create a project (region `eu-central-1`) and a private bucket `deliveries` (25 MB limit). In *Storage > S3 connection* create access keys. In *Connect* copy the **Session pooler** string (put your database password into it).
2. **GitHub:** push this repo to your own repository (the `.env` file is git-ignored and never leaves your machine).
3. **Render:** *New > Blueprint*, pick the repository. Fill the three prompted secrets: `DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. The container applies migrations and DB constraints on every start.
4. **Seed the categories (once).** From your machine, with `DATABASE_URL` pointing at the production database:
   `npm run db:seed` on the live database creates the categories and nothing else. **Do not put demo accounts on the live site** (they are fake people). For a staging copy only: `NODE_ENV=production SEED_DEMO=true SEED_DEMO_PASSWORD="<long random>" npm run db:seed`.
   To remove demo and test data that is already there: `npm run db:purge-demo` (a dry run that lists what would go), then `npm run db:purge-demo -- --confirm`.
5. **Make yourself admin:** register on the site, then run in the Supabase SQL editor:
   `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';`
6. **UptimeRobot:** HTTP(s) monitor on the site's home page, interval 5 minutes. This keeps the Render instance awake (it sleeps after 15 idle minutes) and stops Supabase pausing the project after a week of silence.

Free-plan limits to know: videos up to 25 MB (set by `MAX_UPLOAD_MB`), 512 MB RAM, shared CPU, no SLA. Payments are still the sandbox.
