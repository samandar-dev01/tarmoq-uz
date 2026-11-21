# Tarmoq.uz: creators marketplace

A working marketplace where clients find and hire creators across Uzbekistan (for example mobile videographers), agree on written terms, pay through an escrow-style **sandbox** payment, receive the finished video, approve it, and leave a review. Includes provider onboarding, messaging, and an admin back office.

**The interface is in Uzbek (Latin script).** Visible text is written inline in the components, and the API error messages and the agreement template are Uzbek too. This README stays in English and quotes Uzbek button labels with an English gloss in brackets.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL · Prisma · Tailwind · Zod · Vitest · Playwright

> **Important:** payments are a **sandbox**. No real money moves. See "Going live with real payments" before launching publicly.

---

## 1. What is included

| Area | Where | Notes |
|---|---|---|
| Auth (register, login, logout, roles) | `src/lib/auth.ts`, `src/app/api/auth/*` | bcrypt, signed httpOnly cookie, role re-checked against the DB on every API call |
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
| Design system | `tailwind.config.ts`, `src/app/globals.css`, `src/components/ui` | Colours (CSS variables), fonts, radii and shadows live in one place: change a variable in `globals.css` to re-skin the site. Two colour schemes share those variables: dark (the default for a first visit) and light (`html[data-theme="light"]`). The header's sun/moon button (`ThemeToggle`) flips it and remembers the choice in the `theme` cookie; the root layout reads the cookie, so the first byte of every page is already in the right scheme. A new colour needs a value in both blocks (`tests/unit/themeContrast.test.ts` checks every real pairing for contrast). Shared pieces: `Button`/`ButtonLink`, `Card`, `Container`, `Field`, `Avatar`, `Stars`, `StatTile`, `NavLink`, `Alert`, `EmptyState`, `Icon`, `ThemeToggle`, `Menu` (a dropdown with keyboard support). A signed-in person gets one account menu in the header (`AccountMenu`, built on `Menu`), and the footer's links follow who is looking; both lists come from `src/lib/shellNav.ts`. |

## 2. Requirements

- Node.js 20.9 or newer
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

`GET /api/health` answers `{"status":"ok"}` without touching the database (this is what Render's health check calls). `GET /api/health?db=1` also asks the database one trivial question (`SELECT 1`, 3 second limit) and answers `{"status":"ok","db":"ok"}`, or HTTP 503 `{"status":"degraded","db":"down"}`; one address may ask 30 times a minute. It is for the outside uptime monitor. `GET /api/health/stream` is a one-minute Server-Sent Events test stream (one `data: tick N` line about every 2 seconds) for checking that streaming survives the host's proxy: `curl -N https://<site>/api/health/stream`. At most 5 such streams run at once, and one address may start 10 per minute; beyond that the answer is HTTP 429.

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

### Manual card transfer (real money, by hand)

Set `PAYMENT_PROVIDER=manual` plus `MANUAL_PAY_CARD`, `MANUAL_PAY_HOLDER` (and optionally `MANUAL_PAY_BANK`) to take real payments without a gateway. The test cards are switched off in this mode.

1. Checkout shows the owner's card, the exact amount and a short order code to put in the transfer comment. The client sends the money, attaches the bank receipt (a JPG, PNG, WebP or PDF up to 5 MB, checked by its real contents; the button stays disabled without one) and presses **Men toʻladim** (I paid). The payment becomes *awaiting confirmation* and the admin gets a Telegram alert if Telegram is set up. Receipts are stored like delivery files and only admins can open them (images in the page, PDFs as a download).
2. An admin checks the bank app, then confirms or rejects it under **Admin, Toʻlovlar**. Confirming holds the payment and starts the order (the same `markPaymentHeld` code the sandbox uses). Rejecting lets the client try again. An order cannot be cancelled while a transfer is awaiting confirmation.
3. When the client approves the video, the creator's share (after the platform fee) appears under **Admin, Ijodkorlarga toʻlov** as *pending*. The admin sends the money to the creator's saved card by hand and presses **Oʻtkazdim**. Creators save their payout card on their dashboard; it is stored encrypted under `PAYOUT_ENCRYPTION_KEY` (required in production before the first card is saved; in development a key is derived from `AUTH_SECRET`).
4. A dispute that ends in a refund only marks the payment refunded in the database: the admin must also send the money back to the client by hand.

Confirm a transfer only after you see the money in your own bank app, never from a screenshot alone.

To test this mode end to end (needs the local database from section 4), start the suite with the mode switched on; the test skips itself otherwise. Add `E2E_SHOTS=/some/folder` to also save screenshots of every page at desktop and phone width:

```bash
PAYMENT_PROVIDER=manual MANUAL_PAY_CARD="8600 1234 5678 9012" MANUAL_PAY_HOLDER="TEST OWNER" npx playwright test manual-payments
```

How money moves (all recorded in the `LedgerEntry` table):
1. **Pay** → `ESCROW_HOLD`, payment status `HELD`.
2. **Client approves** → `HELD → RELEASED`: `PROVIDER_PAYOUT` plus `PLATFORM_FEE` (10%, minimum 15 000 UZS; the one constant in `src/lib/fees.ts`).
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

The Playwright suite (`tests/e2e`) covers: the full client journey above through the UI (`client-journey.spec.ts`); anonymous, client, provider and admin permission boundaries and order/conversation privacy (`permissions.spec.ts`); payment tamper-resistance, declined cards, double payment, upload validation, one review per order (`payments.spec.ts`); admin approval (`admin.spec.ts`); and the health check and its test stream (`health.spec.ts`).

### 8.5 Production-style test run

`npm run test:e2e` runs against `next dev`. To test the real production build (`next build` + `next start`) on a fresh throwaway database:

```bash
PG_MODULE_DIR=/path/to/pg-folder npm run test:e2e:prod
```

It needs a folder outside the repo that holds the `embedded-postgres` package, starts and stops everything itself, and never touches the live site or your `.env`. Details, ports and cleanup: [`scripts/e2e-prod/README.md`](scripts/e2e-prod/README.md).

### 8.6 Project agents (`.claude/agents`)

Five Claude Code agents are kept with the project, so they are available in VS Code:

| Agent | What it does |
|---|---|
| `builder` | Implements one task on one branch, following the project rules. Never pushes or merges. |
| `verifier` | Read-only second opinion: re-reads the diff, runs typecheck, unit tests, the production-style rig and browser checks, and reports PASS or FAIL with evidence. |
| `e2e-runner` | Runs `npm run test:e2e:prod` (or one spec) and summarises the failures. |
| `ru-reviewer` | Reviews the Russian dictionary `src/i18n/ru.ts` (once it exists) for wrong, unnatural or inconsistent wording. |
| `a11y-checker` | Checks target sizes, focus, labels, contrast in both themes, keyboard flows and reduced motion. |

## 9. Environment variables

See `.env.example`. The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Signs session cookies. Required, 32+ random characters (`openssl rand -base64 32`); the placeholder from `.env.example` is refused. **Change in production.** |
| `PAYOUT_ENCRYPTION_KEY` | Encrypts creators' payout card numbers: 32 random bytes, base64. **Required in production** before a card can be saved. Set it once and keep it. |
| `STORAGE_DRIVER` | `local` (dev) or `s3` |
| `MAX_UPLOAD_MB` | Largest accepted delivery video (default 100) |
| `S3_*` | Bucket and credentials when `STORAGE_DRIVER=s3` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Optional. When both are set, a Telegram message (creator name and city, plus a link to `/admin/providers`) is sent to the admin each time a creator submits a profile for review. Create the bot with @BotFather, message it once, and use your chat id. Both empty = off. A Telegram failure never affects the creator's submit. The link uses `APP_URL`, or Render's `RENDER_EXTERNAL_URL` if that is unset. |
| `APP_URL` | The site's public address, no trailing slash (live: `https://tarmoq-uz.onrender.com`). Canonical links, the sitemap, `robots.txt`, Open Graph and `llms.txt` are built from it; falls back to Render's `RENDER_EXTERNAL_URL`, then `http://localhost:3000`. See section 14. |
| `GOOGLE_SITE_VERIFICATION`, `YANDEX_VERIFICATION` | Optional. The verification codes from Google Search Console and Yandex Webmaster; when set, the matching `<meta>` tag is added to every page. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional. Switch on "Continue with Google" (see "Sign in with Google" below). Both must be set, or no Google button is shown. |

### Sign in with Google

"Continue with Google" sits under the email and password form on the client and creator sign-in and sign-up pages (never on the admin door). How it behaves:

- **Only verified Google emails.** Google's ID token is checked (signature, issuer, this app as audience, expiry, the nonce of this very sign-in) and the person is refused unless Google marks the email address as verified.
- **They choose their own account.** The request carries `prompt=select_account`, so Google shows its account chooser every time.
- **Who is signed in.** A person already known by their Google id signs in. Otherwise, a client or creator account with the same (verified) email is linked to their Google id and signed in. Otherwise a new account is made for the door they came through (client or creator, with no password and no phone). An admin account is never opened, made or linked through Google. The same door rule as the password form applies.
- Code: `src/lib/googleAuth.ts`, `src/app/api/auth/google/{start,callback}/route.ts`, `src/components/auth/GoogleButton.tsx`.

**One-time setup (Google Cloud, in the owner's Google account):**

1. Open <https://console.cloud.google.com/>, create a project (for example "Tarmoq").
2. Google Auth Platform (older name: APIs & Services, OAuth consent screen): app name, support email, audience **External**, and only the basic scopes `openid`, `email`, `profile`.
3. **Publish the app** ("In production"). With only those basic scopes Google does not need to review it; left in "Testing", only listed test users can sign in.
4. Credentials, Create credentials, OAuth client ID, type **Web application**. Authorized redirect URIs, exactly: `http://localhost:3000/api/auth/google/callback` and `https://tarmoq-uz.onrender.com/api/auth/google/callback` (with a real domain later: that domain, same path).
5. Copy the Client ID and Client secret into `.env` (local) and into the Render service's Environment as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 10. Production deployment

1. **Provision** a managed PostgreSQL database and (recommended) an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, ...). Keep the bucket **private**; the app serves files through signed URLs.
2. **Set environment variables** on your host: `DATABASE_URL`, a fresh `AUTH_SECRET`, `NODE_ENV=production`, `STORAGE_DRIVER=s3` plus the `S3_*` values, `APP_URL`, `MAX_UPLOAD_MB`.
3. **Build and run**, either:
   - Docker: `docker build -t creators . && docker run -p 3000:3000 --env-file .env creators` (the container applies migrations and DB constraints on start), or
   - Node host: `npm ci && npm run build && npm run db:deploy && npm run db:constraints && npm start`.
4. **Create the first admin** (do not run the demo seed in production). Register normally, then in the database run: `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';`
5. **Put it behind HTTPS** (a reverse proxy such as Caddy or nginx, or your platform's TLS). Cookies are marked `secure` in production. The visitor's address (used for rate limiting and the agreement acceptance IP) is read from Cloudflare's `CF-Connecting-IP` header, else from the **last** `X-Forwarded-For` entry. Never from the first entry, which a visitor can write themselves. If you host somewhere without Cloudflare in front, remove the `CF-Connecting-IP` line in `clientIp()` (`src/lib/http.ts`).
6. **Back up** the database regularly and enable versioning or lifecycle rules on the bucket.
7. **Set a request body limit** on the proxy at least as large as `MAX_UPLOAD_MB`.

### Going live with real payments

The sandbox is real code with a real state machine, but it does not talk to a bank. Before charging real customers:
- Implement a gateway adapter (for example Payme, Click or Stripe) that creates the payment, confirms it from the **gateway's signed webhook** (not from the browser), and calls the same hold/release/refund functions in `src/lib/payments/escrow.ts` (`markPaymentHeld`, `releaseEscrow`, `refundEscrow`).
- Check the legal and tax requirements for holding client funds and paying providers in Uzbekistan; many gateways do this through their own marketplace or split-payment products.
- Run the payment tests (`tests/e2e/payments.spec.ts`) against the new adapter.

### Database lock-down (Supabase)

Supabase also publishes every table in the `public` schema over its public Data API, to anyone holding the project's public (anon) key. This app never uses that API: it connects as `postgres`, which owns the tables and bypasses row level security. So `prisma/constraints.sql` (it runs whenever it has changed or a migration was applied, see `scripts/boot.mjs`) turns row level security on for every table, with no policies, and removes every right from the `anon` and `authenticated` roles. Check it any time with Supabase's Security Advisor (it should report no "RLS Disabled in Public").

## 11. Known limitations (be aware before launch)

- **No payment gateway yet.** Payments are either the sandbox (no real money) or the manual card transfer mode, where an admin confirms each payment and sends each payout by hand (see above).
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
- Pages call `requirePageRole(...)`. That check and the one in each API route are the access control. There is no route guard in front of them. `src/proxy.ts` is not one: it only serves the Russian addresses (`/ru`, `/ru/search`, `/ru/providers/<slug>`) and does nothing while Russian is off.
- Text is Uzbek in the code and is translated through `src/i18n` (the guide is the comment at the top of `src/i18n/dictionary.ts`). Russian is behind one switch, `RUSSIAN_LIVE` in `src/i18n/config.ts`, which is **off**: no language button, `/ru/...` is a 404, every page and API answer is Uzbek. For tests and local work only, the environment variable `RUSSIAN_LIVE=1` turns it on for one server process; never set it on the live site.

## 13. Free deployment (Render + Supabase)

The site is one Next.js app, so pages and API deploy together. Everything below is on free plans and needs no credit card.

| Part | Where |
|---|---|
| App (pages + API) | Render free web service, built from `Dockerfile`, described by `render.yaml` |
| Database | Supabase free Postgres (use the **Session pooler** connection string, port 5432) |
| Delivered videos | Supabase Storage, private bucket `deliveries` (S3-compatible, `STORAGE_DRIVER=s3`) |
| Keep awake | UptimeRobot free monitor: `GET /api/health?db=1` every 5 minutes |

1. **Supabase:** create a project (region `eu-central-1`) and a private bucket `deliveries` (25 MB limit). In *Storage > S3 connection* create access keys. In *Connect* copy the **Session pooler** string (put your database password into it).
2. **GitHub:** push this repo to your own repository (the `.env` file is git-ignored and never leaves your machine).
3. **Render:** *New > Blueprint*, pick the repository. Fill the three prompted secrets: `DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. At start the container runs `scripts/boot.mjs`: it applies migrations and the DB constraints only when there is something to apply (a new migration, or a changed `prisma/constraints.sql`), so waking the sleeping free instance skips both. If it cannot tell, it runs both, as before.
4. **Seed the categories (once).** From your machine, with `DATABASE_URL` pointing at the production database:
   `npm run db:seed` on the live database creates the categories and nothing else. **Do not put demo accounts on the live site** (they are fake people). For a staging copy only: `NODE_ENV=production SEED_DEMO=true SEED_DEMO_PASSWORD="<long random>" npm run db:seed`.
   To remove demo and test data that is already there: `npm run db:purge-demo` (a dry run that lists what would go), then `npm run db:purge-demo -- --confirm`.
5. **Make yourself admin:** register on the site, then run in the Supabase SQL editor:
   `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';`
6. **UptimeRobot:** HTTP(s) monitor on `https://<site>/api/health?db=1`, interval 5 minutes. This keeps the Render instance awake (it sleeps after 15 idle minutes) and, because that address asks the database a question, stops Supabase pausing the project after a week of silence. (The home page no longer does that by itself: it is served from a short-lived cache, see `src/lib/publicCache.ts`.) A monitor that still points at `/` keeps the instance awake but no longer touches the database.

Free-plan limits to know: videos up to 25 MB (set by `MAX_UPLOAD_MB`), 512 MB RAM, shared CPU, no SLA. Payments are still the sandbox.

## 14. Search and AI visibility

What exists, so Google, Yandex and AI assistants (ChatGPT, Claude, Perplexity and others) can find and read the site:

- **One address setting.** `APP_URL` (see `src/lib/site.ts`) is the only place that knows the site's address. Canonical links, Open Graph, the sitemap, `robots.txt`, structured data and `llms.txt` all come from it, so a new domain is a one-line change in `render.yaml` (and a redeploy). It is read on each request, not baked in at build time.
- **Indexable pages:** the home page, `/search`, one `/search?category=<slug>` page per category, and every approved creator at `/providers/<slug>`. A search with a word, a city, a price, a sort order or a page number is not indexed (`noindex, follow`, canonical `/search`). Everything else (`/api`, `/admin`, `/dashboard`, `/orders`, `/checkout`, `/messages`, `/settings`, `/login`, `/register`, `/forbidden`) is both disallowed in `robots.txt` and sent with `X-Robots-Tag: noindex, nofollow` (`next.config.mjs`; keep it in step with `PRIVATE_PATHS` in `src/lib/seo.ts`).
- **`/robots.txt`** welcomes the AI crawlers by name (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended) and lists the sitemap. **`/sitemap.xml`** is built from the database on each request: approved creators of active accounts only, up to 5000. **`/llms.txt`** is a plain-text guide for AI assistants (what the site is, the categories, the creators), cached for an hour.
- **Page metadata:** each public page has its own title, description, canonical address and Open Graph card (the picture is `src/app/opengraph-image.tsx`); there is also a web app manifest.
- **Structured data (JSON-LD):** organisation and website with a search box on the home page; a visible FAQ with the same text as `FAQPage` data; a profile page with a person and one offer per active package on each creator page (the star rating only when real reviews are shown); a breadcrumb and a creator list on `/search`. The builders are plain functions in `src/lib/seo.ts`.
- **Rule: no payment promise** in any title, description, Open Graph, JSON-LD, FAQ or `llms.txt` text. Payments are manual or in test mode, and a meta tag cannot carry the "Sinov rejimi" badge. `tests/unit/seo.test.ts` fails if such a word appears, and `tests/e2e/seo.spec.ts` checks the pages themselves.

**Three actions only the owner can do** (nothing here can be done from the code):

1. Add the site to **Google Search Console** and to **Yandex Webmaster** (a "URL prefix" property for the address in `APP_URL`).
2. Copy each verification code (just the code, from the `content="..."` part of the meta tag they show) into Render > the service > Environment, as `GOOGLE_SITE_VERIFICATION` and `YANDEX_VERIFICATION`, and let it redeploy. Then press "Verify" in both tools.
3. Submit `https://<your address>/sitemap.xml` in both tools.

A real domain matters most. `tarmoq-uz.onrender.com` is a subdomain of a shared host, so search engines give it little trust, the address is hard to remember, and every ranking built on it is lost if the site moves. When a domain is bought, point it at Render, change `APP_URL` to it, redeploy, and add the new address to both webmaster tools (the sitemap, canonical links and structured data then follow automatically).
