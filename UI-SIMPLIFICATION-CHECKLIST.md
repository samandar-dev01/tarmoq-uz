# Tarmoq.uz — UI clarity & sign-up friction: implementation checklist

A task-by-task plan drawn from our discussion. It is ordered by **evidence strength and value**, not by
how much is covered. Honest framing up front:

- The app is **already above-average in clarity** (consistent design system, a real `nextAction()`
  next-step engine, honest status labels, good empty states). This is a tune-up, **not a rewrite**.
- The sign-up drop-off is backed by **weak evidence** ("a few people said they would, didn't", drop-off
  point unknown). So **Phase 0 (measure) comes first** — most of the rest is a guess until there's data.
- Decisions already locked by you: keep **email/password + Google** (no phone/OTP/Telegram auth).

Each task has: **files**, **what to do**, **done when**. Check boxes as you go.
Before the first code task, run the `ui-consistency:finding-patterns` phase; after each UI change,
run `ui-consistency:verifying`. Validate any Uzbek wording with a native speaker, and the whole thing
with **one real (non-developer) user** — that outranks every item below.

---

## Phase 0 — Measure first (do before building anything else)

- [ ] **0.1 Add sign-up funnel logging.**
  - Files: `src/app/(auth)/register/page.tsx`, `src/components/auth/RegisterForm.tsx`,
    `src/app/api/auth/register/*`.
  - Do: record three events — `register_viewed` → `register_submitted` → `register_succeeded`
    (plus `register_failed` with the reason). Use whatever lightweight analytics/log sink you prefer;
    no UI change.
  - Done when: you can read, for a given week, how many reached the form, submitted, and succeeded.

- [ ] **0.2 Ask the actual people one question.** (Not code.) Go back to those who said they'd sign up
  and ask only: *"What stopped you?"* Write the answers down.
  - Done when: you have ≥3 first-hand reasons, or confirmation that it was just politeness.

> After Phase 0 you may find the auth work below is unnecessary — that's a success, not wasted effort.

---

## Phase 1 — Sign-up friction (highest-probability, low-effort)

- [ ] **1.1 Confirm Google sign-in is actually off in your live deployment.**
  - Files: `.env` / deployment env; logic in `src/lib/googleAuth.ts` (needs `GOOGLE_CLIENT_ID` +
    `GOOGLE_CLIENT_SECRET`). Note: these keys are **not** in `.env.example` today — only the unrelated
    SEO `GOOGLE_SITE_VERIFICATION` is.
  - Done when: you know for certain whether the Google button renders in production.

- [ ] **1.2 Enable Google sign-in.**
  - Do: create a Google OAuth 2.0 client (authorized redirect to your `/api/auth/google/*` routes),
    set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the deployment.
  - Files: deployment env; add both keys to `.env.example` with a comment so it's documented.
  - Done when: the "Continue with Google" button appears and a full round-trip sign-in works for both
    client and creator doors.

- [x] **1.3 Move Google above the email form.**
  - **Status (2026-11-26): done.** `GoogleButton` now draws the button first and the "yoki" divider under it; both
    forms place it before the fields (sign-up keeps it under the account-type cards, because the chosen type decides
    which account Google makes). Invisible until task 1.2 turns Google on.
  - Files: `src/components/auth/RegisterForm.tsx`, `src/components/auth/LoginForm.tsx`,
    `src/components/auth/GoogleButton.tsx`.
  - Do: render the Google button **first**, then an "yoki" (or) divider, then the email/password fields.
    (Today it sits below the form.)
  - Done when: on both login and register, the one-tap option is the first thing offered.

- [ ] **1.4 Carry reassurance into the sign-up *gate* (point of intent).**
  - Files: wherever sign-in is forced — `orders/new` (`requirePageRole("CLIENT")`), messaging pages.
  - Do: when a visitor is sent to sign in to order/message, show *why* and the existing reassurance,
    e.g. *"Buyurtma berish uchun bir daqiqalik hisob kerak — bank kartasi shart emas."*
  - Done when: the forced sign-in moment explains the reason and that no card is needed.

- [ ] **1.5 Add a show/hide toggle on the password field.** (Small friction cut.)
  - **Status: HELD, needs a decision.** The project has no such control yet, and the UI process says to ask before
    creating a new shared control. Open question: put it inside the shared `Field` (every password field gets it) or
    in a new `PasswordField` used by the two auth forms?
  - Files: `src/components/auth/RegisterForm.tsx`, `src/components/auth/LoginForm.tsx`,
    possibly `src/components/ui/Field.tsx`.
  - Done when: users can reveal the password they typed.

> Explicitly **out of scope** (your call): phone/OTP/Telegram login. Don't build it.

---

## Phase 2 — "One obvious next thing" (core clarity, low effort)

- [x] **2.1 Make the next-step hint the hero of the order page.**
  - **Status (2026-11-26): done in a smaller form than planned.** The "Keyingi qadam" card now has larger text and
    padding; it was NOT moved, and no action button was copied into it. Reason: the action controls live in the
    sections they belong to (agreement, payment, delivery), and a duplicate pay link would clash with the existing one.
    Moving the card's action in is a bigger redesign: decide separately.
  - Files: `src/app/orders/[id]/page.tsx` (the saffron "Keyingi qadam" card), uses `nextAction()` from
    `src/lib/orderUi.ts`.
  - Do: promote the next-step message + its single action button to the **top, large**; demote the rest
    of the cards below it.
  - Done when: on any order, the first thing you see is what to do now and the one button to do it.

- [x] **2.2 Hide developer noise behind a "Tafsilotlar" (Details) disclosure.**
  - **Status (2026-11-26): done for the Payment ID only.** It now sits behind a "Tafsilotlar" toggle. Deliberately
    NOT done: hiding "Kelishuv (N-versiya)" (3 e2e specs pin it, and the version matters when terms are updated and
    the client accepts "the exact version shown") and the commission/income rows (useful to creators). New Uzbek word
    "Tafsilotlar" (Russian: «Подробности») still needs a native speaker's check.
  - Files: `src/app/orders/[id]/page.tsx`.
  - Do: collapse **Toʻlov ID** (mono payment id), raw ledger rows, and the agreement
    **"(N-versiya)"** number (hide from client-facing heading; keep internally) into an optional
    expandable section.
  - Done when: a first-time client sees no monospace IDs or version numbers unless they open Details.

- [ ] **2.3 Audit one primary button per screen.**
  - **Status (2026-11-26): order page audited, no change needed; other screens NOT audited.** Reading the order page
    state by state, only one primary action is shown at a time. The remaining screens still need the same check.
  - Files: all `src/app/**/page.tsx` + order panels; worst offender is `orders/[id]/page.tsx`.
  - Do: exactly one visually-primary action per screen; everything else secondary/link.
  - Done when: no screen shows two equally-weighted primary buttons competing.

---

## Phase 3 — Calm, plain, consistent (medium effort)

- [ ] **3.1 One calm test-mode message instead of scattered badges.**
  - Files: every `TestModeBadge` usage — `src/app/page.tsx`, `src/app/checkout/[orderId]/page.tsx`,
    `src/app/orders/[id]/page.tsx`, plus the component `src/components/ui/TestModeBadge.tsx`.
  - Do: state it **once, clearly, at the point of payment**
    (*"Bu sinov rejimi — haqiqiy pul yechilmaydi."*); remove the repeated inline badges elsewhere so
    money screens don't feel like a demo.
  - Done when: "test mode" is said once where it matters, not sprinkled across the site.

- [ ] **3.2 Plain-language the role words at the login header.**
  - Files: `src/components/Header.tsx` ("Mijoz sifatida kirish" / "Ijodkor sifatida kirish"),
    `HEADING` in `src/app/(auth)/login/page.tsx`.
  - Do: label the two doors by **what the person wants to do**, matching the (already good) register
    cards. Register form needs no change.
  - Done when: a newcomer doesn't have to know the words "mijoz/ijodkor" to pick the right door.

- [ ] **3.3 Plain-word pass on recurring jargon (one name per idea, site-wide).**
  - Files: `src/i18n/*` dictionary + usages.
  - Do:
    - "Ushlab turilgan mablagʻ" (held funds) → align with the homepage's **"Pul himoyada"** so the
      escrow idea has one name everywhere.
    - User-facing "Kabinet" → a plainer label (e.g. "Mening sahifam").
    - First time a user can open a **"Nizo"** (dispute), add a one-line plain explanation of what it is.
  - Done when: the same concept uses the same plain word on every screen.

- [ ] **3.4 Carry the 4-step journey map into the flow.**
  - Files: reuse the homepage "Buyurtma qanday ishlaydi" steps (`src/app/page.tsx`) and/or
    `OrderTimeline`; add a compact strip to `src/app/orders/new/page.tsx` and
    `src/app/checkout/[orderId]/page.tsx`.
  - Done when: during ordering and checkout, the user can see Find → Agree → Pay → Receive and where
    they are.

---

## Phase 4 — Polish (lowest priority)

- [ ] **4.1 Label the icon-only controls** (theme sun/moon, language toggle) in
  `src/components/ui/ThemeToggle.tsx`, `src/components/ui/LangToggle.tsx` — clearer affordance/text so
  nothing on the header bar is a mystery symbol.

- [ ] **4.2 Soften the agreement-acceptance moment.**
  - Files: `src/app/orders/[id]/page.tsx` / `src/components/orders/OrderPanels.tsx`
    ("Yuborganingizda siz shartlarni qabul qilgan hisoblanasiz").
  - Do: add a tiny plain "what accepting means: 1–2–3" beside it.

---

## Protect (do NOT change)

- The design system, `nextAction()` next-step engine, status labels, empty states, and the homepage's
  step/promise sections are the app's strengths. Phases 2–3 **reuse** these on purpose — don't redesign
  them.

## Closing honesty check

- Phases 2–4 are UX judgement, not measured facts. If Phase 0 shows the real problem is elsewhere,
  re-order accordingly.
- Verify Uzbek wording with a native speaker; verify the whole flow with one real user. Both outrank
  my guesses.

## Verification log (2026-11-26, tasks 1.3 / 2.1 / 2.2)

What was run, and what it does and does not prove:

- `tsc --noEmit` clean; all 469 unit tests pass (includes the Russian-translation completeness check for the new word).
- Production-style e2e (real build, real browser, throwaway database), sandbox payments: client journey, language app,
  login doors, shell, Google-off sign-in: **77 passed, 0 failed**.
- Same rig with made-up Google keys (`E2E_GOOGLE_KEYS=1`): Google-sign-in + login-doors: **25 passed, 0 failed**. This is
  the real test of task 1.3 (the button shows on both sign-in doors and both sign-up pages, follows the account type,
  and is absent on the admin door).
- **Not verified:** `manual-payments.spec.ts` cannot run in the container I used. Its upload step
  (`POST /api/payments/manual/submit`) fails with `ECONNRESET`, and it fails identically on the code from before these
  changes, so it is not caused by them. That spec holds the only test that matches the "Keyingi qadam: …" sentence, so
  task 2.1's card restyle was NOT exercised by a test. The sentence is unchanged and still in one `<p>`, so a match
  should still work, but run that spec somewhere it works before relying on it.
- **Not looked at:** nobody has viewed the changed order page or the "Tafsilotlar" toggle in a browser (no screenshot).
