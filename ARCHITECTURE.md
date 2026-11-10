# Tarmoq.uz Marketplace — Architecture (Phase 1)

Place this file at the repo root: `marketplace/ARCHITECTURE.md`.

## 1. Stack (and why)

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) + TypeScript | One codebase for UI + API, SSR for SEO on provider profiles |
| DB | PostgreSQL 15+ | Relational integrity for orders/payments |
| ORM / migrations | Prisma | Typed queries, real migration files |
| Auth | Custom credentials auth: bcryptjs + signed JWT in httpOnly cookie (jose) | No external service needed; role in token, re-checked against DB on sensitive routes |
| Validation | Zod | Shared client/server schemas |
| Styling | Tailwind CSS with design tokens (CSS variables) | One place for colours, type, radii and shadows; responsive |
| Messaging | DB-backed conversations, polling every 5s (route handlers) | Works on any host, no websocket infra |
| Files | Storage driver: `local` (dev) / `s3` (prod, S3-compatible) | Video delivery |
| Payments | Internal **sandbox gateway** with escrow ledger | Real state machine, no fake success (see §5) |
| Tests | Vitest (unit/permissions) + Playwright (e2e) | Covers required scenario |

## 2. Folder structure

```
marketplace/
├─ ARCHITECTURE.md
├─ README.md
├─ package.json
├─ .env.example
├─ next.config.mjs
├─ tailwind.config.ts
├─ middleware.ts                  # route guards by role
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                     # demo accounts, categories, providers
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                 # homepage
│  │  ├─ (auth)/login/page.tsx
│  │  ├─ (auth)/register/page.tsx
│  │  ├─ search/page.tsx          # search + filters
│  │  ├─ providers/[slug]/page.tsx
│  │  ├─ orders/new/page.tsx
│  │  ├─ orders/[id]/page.tsx     # order room: agreement, pay, delivery, review
│  │  ├─ messages/page.tsx
│  │  ├─ messages/[conversationId]/page.tsx
│  │  ├─ checkout/[orderId]/page.tsx    # sandbox checkout
│  │  ├─ dashboard/client/page.tsx
│  │  ├─ dashboard/provider/page.tsx
│  │  ├─ dashboard/provider/profile/wizard/page.tsx
│  │  ├─ admin/page.tsx
│  │  ├─ admin/providers/page.tsx
│  │  ├─ admin/orders/page.tsx
│  │  ├─ admin/reviews/page.tsx
│  │  └─ api/
│  │     ├─ auth/{register,login,logout,me}/route.ts
│  │     ├─ providers/route.ts            # search
│  │     ├─ providers/[id]/route.ts
│  │     ├─ profile/route.ts              # wizard save
│  │     ├─ orders/route.ts
│  │     ├─ orders/[id]/route.ts
│  │     ├─ orders/[id]/agreement/route.ts
│  │     ├─ orders/[id]/delivery/route.ts
│  │     ├─ orders/[id]/approve/route.ts
│  │     ├─ orders/[id]/review/route.ts
│  │     ├─ conversations/route.ts
│  │     ├─ conversations/[id]/messages/route.ts
│  │     ├─ payments/sandbox/{intent,confirm}/route.ts
│  │     ├─ uploads/route.ts
│  │     └─ admin/{providers,orders,reviews,stats}/route.ts
│  ├─ components/
│  │  ├─ ui/                      # Button, Input, Spinner, EmptyState, ErrorState, Toast
│  │  ├─ ProviderCard.tsx
│  │  ├─ FilterPanel.tsx
│  │  ├─ OrderTimeline.tsx
│  │  ├─ AgreementPanel.tsx
│  │  ├─ ChatWindow.tsx
│  │  ├─ ReviewForm.tsx
│  │  └─ wizard/Step*.tsx
│  ├─ lib/
│  │  ├─ db.ts                    # Prisma singleton
│  │  ├─ auth.ts                  # hash, sign/verify, getSession, requireRole
│  │  ├─ validators.ts            # Zod schemas
│  │  ├─ orderMachine.ts          # allowed status transitions
│  │  ├─ payments/sandbox.ts      # sandbox gateway + escrow ledger
│  │  ├─ storage/{index,local,s3}.ts
│  │  └─ audit.ts
│  └─ types/
└─ tests/
   ├─ unit/{permissions,orderMachine,payments}.test.ts
   └─ e2e/client-journey.spec.ts
```

## 3. Roles and permissions

- **CLIENT**: search, order, accept agreement, pay, approve, review own completed orders, message order counterparts.
- **PROVIDER**: own profile/services, accept/decline orders, propose terms, deliver, message.
- **ADMIN**: approve/suspend providers, view all orders, moderate reviews, view stats. Enforced in `middleware.ts` (UI) **and** `requireRole('ADMIN')` in every `/api/admin/*` handler (never trust middleware alone).
- Object-level checks: every order/conversation/message route verifies the caller is a participant.

## 4. Order state machine

```
REQUESTED ──provider accepts/proposes terms──► AGREEMENT_PENDING
AGREEMENT_PENDING ──both parties accept (hash of terms)──► AWAITING_PAYMENT
AWAITING_PAYMENT ──sandbox payment confirmed (funds HELD)──► IN_PROGRESS
IN_PROGRESS ──provider uploads video──► DELIVERED
DELIVERED ──client requests revision──► IN_PROGRESS (revisionsUsed+1)
DELIVERED ──client approves──► COMPLETED (escrow RELEASED to provider)
REQUESTED|AGREEMENT_PENDING|AWAITING_PAYMENT ──cancel/decline──► CANCELLED
IN_PROGRESS|DELIVERED ──dispute──► DISPUTED (admin resolves)
```
Transitions live only in `lib/orderMachine.ts`; routes call it, never set status directly.

## 5. Payment sandbox (no fake success)

- `POST /api/payments/sandbox/intent` creates a `Payment` (status `REQUIRES_PAYMENT`) bound to order amount computed **server-side** from the agreed terms.
- Checkout page collects a test card. `confirm` validates server-side:
  - `4242 4242 4242 4242` → `HELD` (success)
  - `4000 0000 0000 0002` → `FAILED` (declined)
  - `4000 0000 0000 9995` → `FAILED` (insufficient funds)
  - anything else → rejected as invalid test card
- The client can never send "success"; only the server sets `HELD`. Order moves to `IN_PROGRESS` only after `HELD`.
- On approval: `HELD → RELEASED`, platform fee row + provider payout row written to `LedgerEntry`.
- Card numbers are never stored; only brand and last4.
- Production swap: implement the same `PaymentGateway` interface for a real provider (e.g. Payme/Click/Stripe) behind `PAYMENT_PROVIDER` env var.

## 6. Main user flows

1. **Client journey**: register → search (city=Andijon, category=Mobilografiya, price range) → open profile → create order (brief, date, package) → provider accepts → both accept agreement (timestamp, IP, terms hash stored) → sandbox pay → provider delivers video → client approves → transaction shows `COMPLETED` → review.
2. **Provider journey**: register as provider → 5-step wizard (basics, location, services/packages, portfolio, review & submit) → admin approval → receive orders → accept → deliver → get payout ledger entry.
3. **Admin journey**: login → approve/suspend providers → view orders → hide abusive reviews.
4. **Messaging**: conversation auto-created per order (and from profile "Contact"); polling chat with unread counts.

## 7. UI states

Every data view implements: loading (skeleton/spinner), error (message + retry), empty (explanation + CTA), success (toast). Shared components in `components/ui`.

## 8. Delivery phases

1. **Phase 1 (this)**: architecture, structure, schema, env, flows.
2. **Phase 2**: project scaffold, config, migrations, seed, auth, middleware, `lib/*`.
3. **Phase 3**: homepage, search/filters, provider profiles, wizard.
4. **Phase 4**: orders, agreements, state machine, dashboards.
5. **Phase 5**: messaging, reviews, uploads/delivery.
6. **Phase 6**: sandbox payments, admin dashboard.
7. **Phase 7**: tests, README (setup, demo accounts, sandbox guide, deployment).

Nothing in this document has been run yet; test results will be reported only once the code exists and the tests have actually executed.

---

## 9. Final implementation notes (what changed from the plan above)

- Order actions are separate routes instead of one `orders/[id]/route.ts`: `propose`, `agreement`, `cancel`, `revision`, `approve`, `dispute`, `review`, `delivery`, plus `delivery/[deliveryId]` for streaming downloads.
- Admin API: `admin/providers/[id]` (approve, send back, suspend, reinstate), `admin/reviews/[id]` (hide/restore), `admin/orders/[id]/resolve` (release or refund a dispute), `admin/stats`.
- The profile wizard is one client component (`components/wizard/ProfileWizard.tsx`) rather than one file per step.
- `GET /api/orders` and `GET /api/profile` were not built; the dashboards and wizard read the database directly in server components.
- Deliveries use the `Delivery` table; revisions reuse `IN_PROGRESS` with `revisionsUsed` incremented.
- Disputes store their reason in `AuditLog` (`ORDER_DISPUTED`), shown on the admin Orders page.
- `lib/errors.ts` holds `HttpError` so pure modules can be unit-tested without Next.js.
- Database rules that Prisma cannot express are in `prisma/constraints.sql` (rating range, positive amounts, one successful payment per order).
- The interface is in Uzbek (Latin script). Strings are written inline in components, API routes and `lib/` messages (there is no translation layer). City, language and category names are stored in Uzbek (`src/lib/constants.ts`, `prisma/seed.ts`).
- Design tokens live in `tailwind.config.ts` and the `:root` variables in `src/app/globals.css`. Shared UI pieces are in `src/components/ui` (`buttonClasses` and `cardClasses` give non-button elements the same looks).
- Dates are formatted by `src/lib/format.ts` in Tashkent time (UTC+5) with Uzbek month names.
