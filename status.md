# Tarmoq.uz: what is NOT done yet

Written 2026-11-14, updated 2026-11-15. Nothing in this file is a secret.
To continue in a new Claude window, say: **"continue Tarmoq, read status.md"**.

Live site: https://tarmoq-uz.onrender.com
Code: https://github.com/samandar-dev01/tarmoq-uz (Render deploys `main` automatically)
Render service: `srv-dbpg81gm7kps73argm80`. Supabase project: `gkigkiqzcdjfbysymaur` (name `tarmoq-uz`).

## Where things stand right now

- **NEWEST, 2026-11-28: see the section "STATUS ON 2026-11-28" at the END of this file** (done and to do). Where it differs
  from anything above it, trust it.
- **Google sign-in, the privacy page and the other login options (2026-11-21): see the section "GOOGLE SIGN-IN AND LOGIN OPTIONS" at the END of this file.**
  Pull request #17 is open, NOT merged, and safe to merge with no Google keys (the button stays hidden). The goal is the MVP as soon as possible, so Google is optional for launch.
- **Speed work (2026-11-17): see the section "SPEED WORK" at the END of this file.** Three branches are pushed and verified, NOT merged
  (`perf-db-and-cache`, `perf-indexes`, `perf-fast-boot`); it also lists the checks only the owner can do in the Render, Supabase and UptimeRobot dashboards.
- **Gap audit and agile plan (2026-11-16): see the section "GAP AUDIT AND AGILE PLAN" at the END of this file.** It lists everything found missing
  (tiers T0/T1/T2) and the proposed Scrum setup with Sprint 1. Note: `main` has moved on since the lines below were written (`3d49309`, PR #10).
- **Live and verified:** the security fixes (PR #5), the non-root Dockerfile (PR #6), the Next.js 16 upgrade
  (PR #7), manual card-transfer payments switched on (PR #8) and the separate receipts bucket (PR #9).
  `main` = `956763d`.
  The database is locked to the app (row level security on all 16 tables, the public Supabase roles have no rights),
  upload size limits, safer login lockout, a real Content-Security-Policy, spoof-proof rate limits (tested live).
- **Payments on the live site are MANUAL** (client sends money to the owner's card, uploads the bank receipt, the
  admin confirms in the bank app, creators are paid by hand). The first full live test order ran through
  on 2026-11-15 (see item 4). Not told to real clients yet.
- `PAYOUT_ENCRYPTION_KEY` and a 44-character `AUTH_SECRET` are set on Render.
- **In progress, NOT committed:** hiding the creator list from signed-in creators (item 4b), on the local branch
  `hide-creators-from-creators`.

## Done since the first version of this file

- **PR 2, the Dockerfile (PR #6):** merged, Render built it and it went live on 2026-11-14 at 17:27 UTC.
- **Storage / upload check:** the user tested it on the live site on 2026-11-15, it works.
- **Telegram alert:** fixed on 2026-11-15. `TELEGRAM_CHAT_ID` now holds the user's own chat ID and a test message arrived.
  It will also tell you when a client says "I paid" once manual mode is on.

- **Next.js 14 to 16 (PR #7):** merged 2026-11-15, Render built it in 2 minutes and it is live (React 19.3.1, Next 16.4.6).
  Checked on the live site: pages 200, same security headers as before, `/_next/image` 404, cross-site POST 403,
  no-session POST 401, admin API 401, signed-out `/admin` redirects to `/login`, 1 MB chunked body 413 and the site
  stays up. The Next.js and postcss advisories are gone. Left in `npm audit`: zod 3 (production, kept on purpose)
  and 7 dev-only tools (vitest, tsx and similar) that never run on the server.

## THE BIG PLAN (decided 2026-11-15, the owner is away, work in progress)
The owner's ten tasks (search/AI visibility, RU/UZ language button, sign-in door error, Help + Telegram @justuzbe,
light theme, settings for all roles, a less scattered UI, a less boring design, edit/delete messages with admin
audit, Telegram-like Xabarlar) are planned in `/Users/furb-x/.claude/plans/shimmying-napping-gadget.md` (read it
first; it has the wave table, the decisions and the e2e tests). Decisions: second language = Russian; Claude pushes
each verified branch itself and NEVER merges or touches `main`; Fable agents are also saved as project agent files
in `.claude/agents/` (branch `chore-agents-e2e-prod`) for VS Code; nothing may be installed except Claude skills.
**Branch chain (merge in this order, always "Create a merge commit", never squash):**
1. `hide-creators-from-creators` — DONE and PUSHED (commit `4e025db`), verified twice (112 unit, 18 e2e passed + 2 skipped).
2. `chore-agents-e2e-prod` — being built (agent files, `/api/health`, `/api/health/stream`, `scripts/e2e-prod/` rig, README fix).
3. `feat-login-role-check` and 4. `feat-seo-foundation` — being built in parallel (disjoint files).
Then waves 2-11 as in the plan file (UI kit + light theme, app shell, i18n, settings + avatars, messages core,
support/help, Telegram-feel chat, order story, dashboards, discovery, admin console, final regression).
Also from this file's own list: the `proxy.ts` decision is settled by the plan (delete the dead root file in the i18n
branch, a new minimal `src/proxy.ts` only rewrites `/ru/...`); the "Izoh kodi" box is removed in the order-story
branch if the owner still agrees (they said they do not need it); the nonce CSP stays a later item.
Builders work in separate git worktrees under the session scratchpad (`wt-chore`, `wt-login`, `wt-seo`); they are
temporary. Use `git worktree list` to see them; `git worktree prune` after deleting a branch.

## MERGED AND LIVE 2026-11-16 03:28 UTC: branches 1-7 below went in together as PR #10 (`main` = `3d49309`)
Checked on the live site by Claude (read-only, 2026-11-16): `/api/health` 200 `{"status":"ok"}`; `/robots.txt`, `/sitemap.xml`,
`/llms.txt`, `/search`, `/login?role=admin` all 200; `/login` carries `X-Robots-Tag: noindex, nofollow`; the home page has the
canonical link and the new title; `/ru/search` is 404 (Russian is switched off until the last language branch);
the `Category.nameRu` migration ran on the live database (all four categories have Russian names); the Render deploy
`dep-dbt7fb99aqoc73ai3e40` is live. **Streaming works through Render's proxy**: `curl -N .../api/health/stream` printed
`tick 1` ... `tick 7` exactly 2 seconds apart, so live chat updates (SSE) are possible. NOT yet checked by anyone: the
site seen as a creator, admin sign-in through `/login?role=admin`, the light/dark button and the account menu on a real phone,
the Telegram "I paid" alert. Still yours: Google Search Console / Yandex Webmaster steps in branch 4 below.

## PAUSED 2026-11-16 because of the usage limits (daily and weekly): exactly where things stand
- **FULL HANDOFF FOR ANY AGENT: `HANDOFF.md` in this folder** (and `~/.claude/plans/HANDOFF.md`). UPDATE: the joined browser run finished
  green (145 passed + 3 skipped, then 146 + 2) and BOTH Russian branches are now PUSHED to GitHub (`feat-i18n-public`, `feat-i18n-app`);
  the unfinished settings work is pushed as `wip-settings-and-avatars` (unverified, do not merge).
- Branches 8 and 9 are built and stacked: `feat-i18n-public` (Russian for home, search, creator page, SEO, 404; tip `2664d9c`)
  and `feat-i18n-app` (Russian for orders, checkout, agreement, cabinets, wizard, messages and the leftover server messages; tip
  `566f228`, rebased on top of public, duplicate keys removed, completeness test now covers all of `src/` except admin and
  Telegram texts; 394 unit tests pass). The full browser suite on that joined tip was RUNNING when I paused; its log is
  `<scratchpad>/rig-logs/i18n-joined-run.log` (look for `EXIT 0` and the passed/failed counts). NOT pushed yet unless the log is green
  and this note says so. Russian stays OFF for visitors until a tiny last branch sets `RUSSIAN_LIVE=1` in `render.yaml` (planned
  name `feat-russian-live`); the owner merges it last and can undo it by reverting that one line.
- STILL TO DO for Russian: a native-quality review of all Russian copy (the Fable `ru-reviewer` run was stopped to save usage; its prompt
  is in the transcript), a lawyer's review of the Russian agreement reading, then the switch branch.
- Branch 10 `feat-settings-and-avatars` is about one third built, UNCOMMITTED in the worktree `wt-settings` (schema + migration
  `account_settings`, token version, account/avatar API routes, storage area). Resume by sending its builder a message (id in the
  session) or by starting a new builder in that folder with the plan file's 'Task 6' section.
- Not started: messages core, support/help, Telegram-style chat, order story, dashboards, discovery, admin console, final regression.
- To resume in a new window say: "continue Tarmoq, read status.md and the plan file". Use ONE builder at a time and `model: sonnet`
  to spend less; Fable only for the reviewer and the verifier.

## PULL REQUEST GUIDE: branches ready on GitHub (written 2026-11-15 night; the owner merges, Claude never does)
How: open `https://github.com/samandar-dev01/tarmoq-uz/pull/new/<branch>`, use the title below, press "Create pull
request", then "Merge pull request" and choose **"Create a merge commit"** (NEVER squash: the branches are stacked on
each other). Merge in THIS order, and test on the live site after each merge (Render redeploys in about 2 minutes;
the PR text should end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Until a branch is
merged nothing on the live site changes.

1. `hide-creators-from-creators`: **Hide the creator list from signed-in creators.** Verified: 112 unit tests, 18 browser
   tests (+2 skipped by design). Your 5-minute test: sign in as a creator (creator door): the home page sends you to your
   cabinet, no "Ijodkorlar" link, another creator's page says "Ruxsat yoʻq", your own public profile still opens;
   as a client or logged out everything is as before.
2. `chore-agents-e2e-prod`: **Add health checks, a production-style test rig and project agents.** Verified: 116 unit
   tests, 21 browser tests (+2 skipped). Test: open `/api/health` (answers `{"status":"ok"}`); in Terminal run
   `curl -N https://tarmoq-uz.onrender.com/api/health/stream`: you must see `data: tick 1` and then a new line about
   every 2 seconds for a minute. If every line arrives at once at the end, Render's proxy buffers streams (the chat will
   then fall back to polling). Also adds the five agent files in `.claude/agents/` for VS Code and fixes the README (Next 16).
3. `feat-login-role-check`: **Check the sign-in door against the account's role.** Verified: 138 unit tests, full browser
   suite green on a production build (34-35 passed). Test: sign in with a creator account on the CLIENT tab: a red message
   with a link to the creator door, nobody is signed in; the same the other way round. **IMPORTANT for you: the admin can no
   longer sign in through the client/creator tabs; bookmark `https://tarmoq-uz.onrender.com/login?role=admin`** (the tabs
   tell an admin where to go: link "Admin kirishi"). Signed-out visits to `/admin` send you to the admin door.
4. `feat-seo-foundation`: **Add search and AI visibility.** Verified: 150 unit tests, 46-47 browser tests green on a
   production build. Test: open `/robots.txt` (names GPTBot, ClaudeBot, PerplexityBot...), `/sitemap.xml`, `/llms.txt`;
   a creator page has a canonical link and JSON-LD in "view source"; `/search?q=x` is `noindex`; an unknown address shows
   the new 404 page; the home page has a visible FAQ. `render.yaml` now pins `APP_URL`, so merging also starts a
   blueprint-sync deploy. **Your three actions afterwards:** (a) add `https://tarmoq-uz.onrender.com` to Google Search
   Console and Yandex Webmaster; (b) paste each verification code into Render as `GOOGLE_SITE_VERIFICATION` and
   `YANDEX_VERIFICATION`, let it redeploy, press Verify; (c) submit `/sitemap.xml` in both. A domain you own matters most
   for search ranking (tarmoq.uz belongs to someone else): later it is one `APP_URL` change.
   Note for you: the FAQ and the meta text deliberately say nothing about payments (a rule of this site's search text).
5. `feat-ui-kit-light-theme`: **Add the light theme and the sun/moon button.** Verified: 292 unit tests, 61-62 browser tests
   green on a production build, 72 screenshots looked at. Test: tap the sun/moon button in the header (it is 44 px, next to
   the account button; on a phone it sits next to Menyu): the whole site turns warm "paper" light and back; reload keeps it
   (a cookie `theme`, the server paints the right theme from the first byte, no flash). Dark stays the default for a first visit.
6. `feat-app-shell`: **Add the account menu and a footer that fits the visitor.** Verified: 311 unit tests, 98-99 browser
   tests green. Test: sign in; the header now shows ONE round initials button (account menu: name and role, Kabinet,
   Xabarlar, Ijodkorlar (not for creators), Chiqish); it opens with click or keyboard (Enter, arrows, Esc); the footer shows
   only links that fit you (no sign-up links when signed in). A creator never sees "Ijodkorlar". Removed dead code (the old
   wrong-role flash message and the loose "Chiqish" button).
7. (merged inside PR #10) `feat-i18n-core`: language infrastructure; Russian is hidden, the live site looks the same.
8. `feat-i18n-public`: **Translate the public pages and what search engines read into Russian.** Pushed and verified (unit 375,
   browser 129 passed). Merge AFTER PR #10 (already done). Visitors see NO change (Russian is still off): the effect is only
   hidden code until the switch. Merge with "Create a merge commit".
9. `feat-i18n-app`: **Translate orders, checkout, cabinets and messages into Russian; join the two language branches.** Stacked on
   branch 8: merge 8 first. Verified (unit 394, browser 145-146 passed). Still no visible change until the switch.
10. NOT created yet: `feat-russian-live` (one line in `render.yaml`: `RUSSIAN_LIVE: "1"`). That is the real on-switch for the
   language button and the `/ru` addresses; do it only after the Russian wording review (see HANDOFF.md). To undo: delete that line.
Still to do after that (see HANDOFF.md): settings and photos (a third built, branch `wip-settings-and-avatars`), messages,
support/help, the order story, dashboards, discovery, admin console.

## TO DO, in the order I would do them

### 1. DONE 2026-11-15: payout key backed up (the user said so)
`PAYOUT_ENCRYPTION_KEY` is saved in the user's password manager. **Never change it** in Render: if it is changed,
every saved creator payout card becomes unreadable and creators must enter their cards again.

### 2. DONE 2026-11-15: admin sign-in on the live site works (the user said so)
This proves the stricter `AUTH_SECRET` check works on Next 16. The user also checked a delivery video on the live
site on 2026-11-15 and it works. Still unchecked: Safari.

### 3. The unmerged branch `fix-order-note-for-non-clients`: LEFT AS IT IS for now (the user's decision, 2026-11-15)
**What it is:** commit `53de4bc` (2026-11-13), +11 lines in `src/app/providers/[slug]/page.tsx`, never merged.
**The problem it fixes:** the "Buyurtma berish" (order) button only shows for logged-out visitors and clients. A
signed-in admin or creator sees no button and no explanation, so it looks broken.
**What it adds:** an info box above the package list, only for a signed-in admin or creator on someone else's
approved profile that has packages: "Buyurtma berish uchun mijoz hisobi kerak." with a "Mijoz sifatida kirish" link
that returns to the same profile after the client sign-in. It uses the shared Alert and ButtonLink; ordering rules
are unchanged; clients and logged-out visitors see nothing different.
**State:** it merges cleanly into the current `main` (checked 2026-11-15) and the login page does not redirect a
signed-in user away, so the link works. NOT checked: it was written before the Next 16 upgrade, so it has not been
compiled or looked at on current `main`.
**If picked up later:** Claude re-checks typecheck and the page as admin and as creator, pushes the branch, and the
user opens the PR (`github.com/samandar-dev01/tarmoq-uz/pull/new/fix-order-note-for-non-clients`). Or delete the branch on
GitHub if the message is not wanted. Until then the branch simply stays on GitHub and nothing on the live site changes.

### 4. Manual payments: SWITCHED ON 2026-11-15. LIVE TEST MOSTLY DONE, a few things still open (see the block just below)
**LIVE TEST RESULT (2026-11-15, read from the live database and Render logs by Claude, the clicks done by the user):**
- DONE and works: checkout shows the card; receipt upload (PR #9 merged, `main` = `956763d`; test file
  `UzCombinator-3-mavsum-Tarmoq-uz.png`, a plain Latin name); "Men toʻladim"; admin confirmed the payment in
  `/admin/payments`; the creator delivered a video (upload to S3 works); the client accepted; the order is COMPLETED.
- The payout row exists: **5,000 soʻm, PENDING** (a 20,000 soʻm order is under 150,000, so the 15,000 soʻm minimum fee
  applies: that is the rule in `src/lib/fees.ts`, not a bug). The user confirmed the admin button "Oʻtkazdim" is there
  on `/admin/payouts`. Do NOT press it unless the money was really sent; it is test data.
- STILL OPEN: (a) the creator's payout card: the user said a creator could not enter a card; at the last database check
  (2026-11-15, this session) NO creator had a saved card; the user later wrote "everything is good, kind of", so it is
  not known whether it works now. The form is on the creator dashboard, section "Pul olish", and is hidden if that
  creator never started the profile wizard (one 10 November account has no profile). Server side it was fine: no
  errors in the Render logs, the route answers 401 without a login. Ask which message the creator sees. NOTE: another
  Claude session created a branch `fix-payout-card-save` (a temporary folder under another session's scratchpad,
  at an old commit, no change seen); do not touch it, check with the user first.
  (b) a receipt with a Cyrillic or Uzbek `ʻ` file name has NOT been tried on the live site (the local fix is merged,
  real Supabase behaviour is unproven). (c) the Telegram "I paid" alert for this order was not confirmed by the user.
  (d) test data on the live site (orders, payments, receipts in the `receipts` bucket, one pending payout): clean later
  with `npm run db:purge-demo` (dry run first) and delete the receipt files by hand.
**State:** the user gave the card details and said the legal and tax check is done, set `MANUAL_PAY_CARD` and
`MANUAL_PAY_HOLDER` in Render, and merged PR #8 (`main` = `d154efd`, `PAYMENT_PROVIDER: manual` in `render.yaml`). The
blueprint-sync deploy `dep-dbskb1nj5k9c73et6ofg` went live at 05:41:56 UTC. Checked live by Claude: pages 200, an
unauthenticated POST to the manual-submit route answers 401 (it answered 404 while on sandbox), admin API 401,
cross-site POST 403, CSP header present. The card number is NOT in git or this file; it is in Render's Environment only.
**NOT yet checked:** that the checkout page really shows the card and name (needs a signed-in client with an order
waiting for payment), the receipt upload, the Telegram "I paid" alert, the admin confirm, the payout step.
**TO DO now: one test order, before any real client** (test client, test creator, admin): the client orders and
agrees a price, checkout shows the card + the order reference code, the client attaches any image or PDF as the
receipt and presses "Men toʻladim", you get the Telegram alert, you open `/admin/payments`, view the receipt and
press confirm (test order: no real money moved, so this is only a ledger entry), the creator delivers, you mark
the payout paid. Test data stays in the database; `npm run db:purge-demo` (dry run first) can remove it later.
**FOUND ON THE FIRST LIVE TEST (2026-11-15):** checkout showed the card, name, amount and code correctly, but "Men toʻladim"
failed with the generic error. Render logs: `InvalidMimeType: mime type image/png is not supported` (HTTP 415). The Supabase
bucket `deliveries` accepts only video types, so a receipt could not be stored. The user chose a SEPARATE bucket.
- DONE (live Supabase, 2026-11-15): private bucket `receipts` created: 5 MB limit, image/jpeg, image/png, image/webp,
  application/pdf. The `deliveries` bucket was not touched.
- DONE and MERGED (PR #9, 2026-11-15, now live): branch `receipts-bucket` (commit `ea4d423`; receipts use `S3_RECEIPTS_BUCKET`, `render.yaml`
  gets `S3_RECEIPTS_BUCKET: receipts`; 112 unit tests pass). A Fable agent checked it twice end to end with a strict mock
  storage that refuses types per bucket like Supabase (reproduced the live 415 on main, fix passes; Playwright 16+2
  sandbox and 2 manual pass). PR link: github.com/samandar-dev01/tarmoq-uz/pull/new/receipts-bucket. Until it is merged
  and deployed, "Men toʻladim" still fails live. Not provable here: real Supabase (signature and header echo for a
  non-Latin name). Tiny known edge, left alone: a receipt name over 200 characters with an emoji at the cut fails on
  upload (`slice(0, 200)` splits the emoji); delivery upload has the same slice.
- ALSO FOUND by the verification agent (2026-11-15): a receipt (or delivery video) whose FILE NAME has Cyrillic or Uzbek `ʻ`
  letters crashed the local receipt viewer with a 500 (a raw non-Latin name in the Content-Disposition header). Fixed on
  branch `receipts-bucket` with a shared helper (`src/lib/storage/disposition.ts`: ASCII-safe `filename` + real name in
  `filename*=UTF-8''...`), 6 unit tests, 112 unit tests pass; the real routes were checked end to end (local and strict S3 mock).
  On live (S3) it was unknown whether Supabase would serve such a name, so the live retest MUST include a receipt with a
  non-Latin name.
- Known and left alone: `npm run db:purge-demo` deletes payment rows but only removes delivery files, so test receipts
  stay in the `receipts` bucket (clutter in a private bucket, delete them in Supabase Storage if wanted). A wrong
  `S3_RECEIPTS_BUCKET` name or a variable that does not reach Render fails with the same generic error (no startup
  check): after the deploy, the live retest proves it is set.
- STILL OPEN, the user has not answered yet: (1) the "Izoh kodi" box on checkout: the user said "I don't think we need
  izoh kodi section"; Claude proposed removing it from checkout only and keeping the order reference on the admin payments
  page; (2) the user wrote "if we need to code the payment we need to automate it and show it to the ijodkor": Claude
  asked what that means (a "payment received, you can start" notice for the creator? automation only with a real
  gateway, Click or Payme, which needs a registered business?).
**Rules for real transfers:** confirm every payment in the BANK APP, never from a screenshot; creators are paid by hand.
Original notes below.
How it works: the client sends money to YOUR card in their own bank app, uploads the bank receipt, you check the
money in YOUR bank app and press confirm; creators are paid by hand and you press "paid".
What you need to decide or do first:
- The card number to show clients, the holder name as printed on the card, and (optional) the bank name.
- **Legal and tax check before real clients pay:** holding client money for creators, income on a personal card,
  fiscal receipts. You are not registered yet (no self-employed status, no YaTT/LLC).
- Never confirm a payment from a screenshot. Always confirm in the bank app.
Steps (Claude can do the code part): in `render.yaml` change `PAYMENT_PROVIDER` from `sandbox` to `manual`; in
Render set `MANUAL_PAY_CARD`, `MANUAL_PAY_HOLDER`, optionally `MANUAL_PAY_BANK` (a blueprint sync resets dashboard
edits, so the `render.yaml` change matters). Test the whole flow once before real clients, with three accounts:
a test client (uploads the bank receipt), a test creator, and you as admin (views the receipt and confirms).
The receipt route answers 404 until manual mode is on, so it cannot be tested on the live sandbox.
A real payment gateway (Click or Payme) comes later and needs a registered business.

### 4b. Creators must not see other creators: CODE WRITTEN, checked once, NOT committed, NOT pushed, NOT live
**The user's decision (2026-11-15):** a signed-in creator should not see the creator list or other creators at all
("hide it completely"). Logged-out visitors, clients and admins see everything as before.
**What the change does** (local branch `hide-creators-from-creators`, made from `main` at `956763d`, changes only in the working
tree): one rule `canBrowseCreators(user)` in `src/lib/auth.ts`. For a creator: the home page redirects to
`/dashboard/provider`; `/search` and every other creator's profile redirect to `/forbidden` (own public profile still opens;
a profile that does not exist answers the same as one that does); `GET /api/providers` answers 403; the "Ijodkorlar" link is
gone from the header and the footer; an empty Xabarlar page has a creator text and no "Ijodkorlarni topish" button.
Files: `src/lib/auth.ts`, `src/components/Header.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/search/page.tsx`,
`src/app/providers/[slug]/page.tsx`, `src/app/api/providers/route.ts`, `src/app/messages/page.tsx`,
`tests/e2e/permissions.spec.ts` (2 new tests). New copy for a person to read: "Mijoz sizga yozganda yoki buyurtma berganda,
suhbat shu yerda paydo boʻladi." (creator's empty Xabarlar page).
**Checked (first pass, a Fable agent on a local copy):** typecheck, 112 of 112 unit tests, 18 passed + 2 skipped by design
in Playwright on a production build, and the pages opened as visitor, client, admin and creator (desktop and 390 px phone,
screenshots in the session scratchpad). No loop; logout works; the creator's own profile link works.
**After that pass I changed three small things and have NOT re-run the browser tests, only the typecheck:** the page title of
another creator's profile no longer travels in the redirect response; the profile check now runs before the lookup so a
creator cannot tell which profile addresses exist; the Xabarlar page uses the shared rule. The e2e test was extended
for both (a non-existent slug, no name in the redirect body).
**TO DO:** (1) re-run the full e2e (the agent's scripts are in the scratchpad `verify-hide-creators/`; its database and
build were deleted, so it must be rebuilt); (2) commit on the branch, push, the user opens the PR; (3) after the merge,
look at the live site as a creator. **Known and left alone:** `/search` has a loading screen, so a creator gets a 200
skeleton page and is then redirected by script, no creator data in it; the `/forbidden` button says "Bosh sahifaga qaytish"
but takes a creator to their cabinet (wording); signed-in requests now do three user lookups instead of two; a creator can
still log out and see the public list (it is public by design, hiding it from signed-in creators is not secrecy).

### 5. The route-guard file `proxy.ts`: decide (LOWEST priority, not needed for safety)
**What it is:** a check at the front door of the app (formerly `middleware.ts`, now `proxy.ts` in the project root)
that looks at the signed-in user's role before a page or API handler runs, e.g. a non-admin never reaches `/admin`.
**The situation:** it never ran. The app lives in `src/`, and Next ignores a guard file outside it. This is NOT a
hole: every page and API handler checks the user's role itself (admin API signed out gives 401, a client gets 403),
so the site has always been protected without it.
**Why it is on the list at all:**
1. The README and ARCHITECTURE call it "the first line of defence". That is not true. Fixing the docs is needed
   whichever option is chosen (a few lines).
2. If it were on, it would be a safety net: a future page or API route that forgets its role check would still be
   stopped at the front door. That is its only real benefit.
**Cost of switching it on:** its rules (`RULES` in `proxy.ts`) have never run on real traffic, so a wrong rule could
block someone who should get in (for example a provider on `/orders`), which is why it needs tests first. The role
rules would then live in two places that must be kept in step. Signed-out redirects change slightly (they add `?next=`).
**Options, each its own small PR (decision still open, ask the user):**
- (a) Move it to `src/proxy.ts` to switch it on, with tests for each role on each protected path.
- (b) Delete it and fix the README and ARCHITECTURE. Lowest risk and effort; fine for a small site that is already protected.
- (c) Skip it for now. The docs would stay wrong until someone fixes them.
Claude's view: (b) is the safe minimum; (a) only if the user wants the extra net. Do it after manual payments, which matter more.

### 6. Smaller follow-ups from the Next 16 upgrade
- A stricter Content-Security-Policy with nonces (no `'unsafe-inline'` for scripts) is now possible, because the
  Next 14 nonce advisory no longer applies. Its own PR.
- Dev-only advisories: vitest 2.1.9 and tsx 4.23.15 would clear them. Optional.
- Not proven by the upgrade: real video playback and Safari. Check one delivery video on the live site.

## Decided NOT to change (knowing the risk)
- **Sign-up still says "this email already has an account".** Removing that message would break sign-up unless
  email verification exists. It is rate-limited to 5 tries per hour per address. A real fix means adding email
  verification later.
- **zod stays on version 3.** Version 4 would touch every Uzbek error message. The new 256 KB request size cap
  already blunts its known weakness.
- **The sandbox card form is fine** while payments are in sandbox mode: it is labelled "Sinov rejimi" and the
  server refuses any non-test card before storing anything. It disappears when manual mode is switched on.
- `script-src` in the Content-Security-Policy still needs `'unsafe-inline'`. A stricter nonce version is item 6.

## Smaller things, whenever
- **Homepage shows one creator named "test" many times.** That is real data on the live site, not a bug.
  Remove test data with `npm run db:purge-demo` (a dry run first, then `-- --confirm`).
- **`tarmoq.uz` is NOT your domain.** It belongs to someone else and redirects to `parol.uz`. The site is only at
  `tarmoq-uz.onrender.com`. For a proper address: buy a domain you own, add it as a custom domain on the Render
  service (Render issues the certificate), and point its DNS there.
- **Docker on this Mac (optional):** install Docker Desktop (docker.com) or OrbStack if you want Claude to test
  Dockerfile changes before Render sees them. Not needed otherwise: Render builds it on every deploy.
- Old merged git branches can be deleted on GitHub (`security-fixes`, `dockerfile-non-root`, `ui-dark-redesign`,
  `avatar-initials-only`, ...).

## Rules that keep the site safe
- Claude never pushes, merges, or changes the live database or Render settings without being asked.
- `main` deploys automatically: every merge goes live within minutes.
- Never paste secrets (bot token, `AUTH_SECRET`, `PAYOUT_ENCRYPTION_KEY`, database password) into a chat.

## GAP AUDIT AND AGILE PLAN (2026-11-16)
The owner wants to work in an agile way (Scrum, 1-week sprints) on a project that was already started, and asked for a list of everything that was missed.
Two read-only audits (engineering/process and product/features) read the code that is LIVE (`origin/main` = `3d49309`, PR #10), not the owner's working
folder, which is checked out on an old branch (11 commits behind). Claude re-checked four claims by hand (real-money mode in `render.yaml`, 11 secrets only in
the Render dashboard, the late `AUTH_SECRET` check in `src/lib/token.ts`, the test-mode default in `src/lib/payments/mode.ts`): all confirmed. NOT measured:
speed, how pages look at 390 px, anything on the live site that needs a login. What is said about Render/Supabase free plans is general knowledge and must be
checked against their current terms. The owner's choices: backlog in `BACKLOG.md` in the repo (not created yet), Scrum with 1-week sprints, Sprint 1 =
launch blockers first, free options first for anything that costs money.
Tiers: **T0** = fix before real clients pay; **T1** = important; **T2** = nice to have. The full working plan is `/Users/furb-x/.claude/plans/i-wanted-to-apply-radiant-cherny.md`.

### A1. Money, trust and legal
**T0**
1. Photographers cannot deliver: delivery accepts video only (mp4/mov/m4v/webm) and the live cap is 25 MB, yet "Fotografiya" is a seeded category. `src/lib/deliveryPure.ts`, `render.yaml` (`MAX_UPLOAD_MB: "25"`), `prisma/seed.ts`.
2. No account recovery and no support channel: no password reset, no email verification, no email provider at all; the UI tells people to "contact support" (`dashboard/provider/page.tsx`, wizard, `api/profile/route.ts`) but no support page, Help button or `@justuzbe` link exists. A locked-out user cannot get back in.
3. Refund is bookkeeping only: `refundEscrow` writes `REFUNDED` and a ledger row; nothing records that money was actually sent back, and the admin cannot see a client's email or phone on the orders or payments pages, so cannot reach them. `src/lib/payments/escrow.ts`, `src/app/admin/orders/page.tsx`.
4. Nothing times out: unpaid orders stay open forever; after "I paid" neither side can cancel until the admin acts and the only prompt is one Telegram alert plus a "48 soatdan oshdi" tag; a delivered order is never auto-completed (money stays held); delivery days are text only. `orderMachine.ts`, no cron/`expiresAt`.
5. No terms of service, privacy policy, consent checkbox or cookie notice, while the site stores encrypted payout cards, bank receipts, phone numbers and IP addresses. (A `/privacy` page is planned in wave 5; the agreement and the Russian wording need a lawyer check.)
6. Disputes are decided blind: admin cannot read the order chat, no evidence upload, the opener cannot withdraw, the reason lives only in `AuditLog.meta`. `src/app/orders/[id]/page.tsx`, messages routes.
7. The final video can be downloaded in full quality while the order is still `DELIVERED` (`?download=1`), before the money is released; no preview or watermark step. (Owner decision needed.) `src/app/api/orders/[id]/delivery/[deliveryId]/route.ts`.
8. Test mode fails open: `paymentsAreTest()` is true whenever `PAYMENT_PROVIDER` is unset, so if that variable were ever dropped from Render, the sandbox test card would mark real orders paid with no money. `render.yaml` pins `manual` today. `src/lib/payments/mode.ts`.
9. Live loose ends from the first real test: creator payout card unconfirmed (form hidden for a creator who never started the wizard); a receipt with a Cyrillic or `ʻ` file name never tried live; Telegram "I paid" alert unconfirmed; test orders, receipts and a PENDING payout still in the live data (`db:purge-demo` leaves receipt files); "Izoh kodi" box decision open; "show it to the ijodkor" request never clarified; every real transfer must be confirmed in the bank app, never from a screenshot.
10. No payment gateway (Click/Payme); needs a registered business, which the owner does not have yet.

**T1**
- Creators and clients get no notifications at all (only two admin Telegram events: profile submitted, "I paid"; `src/lib/notify.ts`); no unread badge in the header.
- Admin rejection and suspension take no reason and the creator is not told; a rejected profile looks like a never-submitted draft. Approved creators can change price, bio and packages with no re-review (server has no rule). `api/admin/providers/[id]/route.ts`, `api/profile/route.ts`.
- Order cancellation: the API accepts a `reason` but the UI sends none and uses `window.confirm`. Refund is all-or-nothing (no partial amount).
- Creator has no payout history, only totals; admin page says to contact a creator "via email" that the site cannot send.
- Admin hides a review with no reason and nobody is told.

### A2. Accounts and settings
**T1** No `/settings` page, no password change, no profile edit, no avatars (initials only), no account deletion or data export; phone is collected and never shown; admins are created by SQL. Sign-up still says "email already registered" (accepted risk, needs email verification). Wave 4 is one third done on `wip-settings-and-avatars` (unverified).

### A3. Admin console
**T1** No search or paging (every list is `take: 200`); no user ban (`User.isActive` is read everywhere and never set false); no audit-log viewer (written everywhere, read once); `/admin/payments` shows only payments awaiting confirmation, rejected ones are shown to nobody; no resolve button on the order page; generic `/forbidden`.

### A4. Messaging and support (waves 5-6, nothing built)
**T1** Text only (2000 chars), 5-second polling, last 50 messages only, no attachments, edit, delete, typing, block or report; admin messages appear as an anonymous bubble; the send route does not re-check that the other party is still active or approved; system messages are stored in Uzbek only; no Help button or support thread; no admin view of chats (needed for disputes and for the planned edit/delete audit).

### A5. Creators and discovery
**T1** No identity or phone check for creators (only admin approval). **T2** Portfolio is https links only (no upload, thumbnail or inline playback); search is `ILIKE` with 4 sorts and no rating, language or district filter, autocomplete or favourites; reviews: latest 10 only, no creator reply, edit or report (wave 9 not built).

### A6. Language, UI and experience quality
**T1** Russian is OFF (`RUSSIAN_LIVE = false`). On live, the Russian dictionary has 153 entries and four fragments are empty; roughly 199 Uzbek literals in about 35 UI files, 101 in API files and 94 in library files are not translated. `feat-i18n-public` and `feat-i18n-app` are pushed and verified but not merged. Still to do: run the `ru-reviewer` agent, lawyer check of the Russian agreement text, create the tiny `feat-russian-live` branch (owner's go/no-go).
**T1** Design-kit pieces missing: Dialog/ConfirmDialog, Sheet, Tabs, Toast, Skeleton, phone bottom nav, Help slot; destructive actions still use native `window.confirm` with hard-coded Uzbek text.
**T2** Loading screens exist only for `/search`; no `global-error.tsx`; no skip link; no focus-to-first-error; 390 px overflow checks exist only for shell, theme, language and checkout pages; performance unmeasured (`getCurrentUser()` not memoized so every page does 3+ lookups; images unoptimized and portfolio images hot-linked; SVG filter covers on home); order story and dashboards only partly there (static timeline, flat order list; waves 7-8).

### A7. Security, operations and infrastructure
**T0/T1**
- No CI at all (no `.github/`); nothing runs typecheck or tests on a PR, and a merge to `main` auto-deploys.
- No error tracking, no structured logs (`console.error` only), alerting limited to two Telegram events; nothing alerts on 5xx, database down, a new dispute or a stuck payout; uptime monitoring is one README line.
- No backup or restore procedure for the database or the `deliveries` and `receipts` buckets; no runbook; the 11 secrets exist only in the Render dashboard with no recreate guide; payout key cannot be rotated.
- `AUTH_SECRET` is checked lazily, not at startup: a bad secret signs everyone out and makes logins return 500 while the `/login` health check stays green (`src/lib/token.ts`; `.env.example` wrongly says the app refuses to start). No env validation at boot.
- Everything runs on free plans (Render free: 512 MB, memory capped at 400 MB, uploads buffered in memory; Supabase free). From general knowledge, to verify: free Render services sleep when idle, a free Supabase project can pause after inactivity and has no point-in-time backups. The in-memory rate limiter only works with one instance.
- E2E can write to the wrong database: `manual-payments.spec.ts` and `seo.spec.ts` use `new PrismaClient()` with no check that `DATABASE_URL` is local, and README §13 tells the owner to point `DATABASE_URL` at production to seed.
- Render health check still uses `/login` although `/api/health` exists; no preview/staging environment; no rollback plan; the Dockerfile runs `migrate deploy` and `db:constraints` on every container start.
**T2** Nonce-based CSP (`next.config.mjs` says not implemented); dev-only audit advisories; Docker hygiene (single stage, no `HEALTHCHECK`, unpinned Node 20 base which is past end of life, `.dockerignore` lacks `.git`, `.env.*`, `tests`, `.claude`); CHECK constraints, partial unique indexes and RLS live only in `prisma/constraints.sql`, not in migrations; missing foreign-key indexes (`Delivery.orderId`, `LedgerEntry.paymentId`, `Message.senderId`, `AuditLog.actorId/createdAt`, `Review.authorId`, `Order.serviceId`, plain `Payment.orderId`); unbounded `findMany` in both dashboards and `api/profile`; no data-retention rule (IPs and receipts kept forever); majors behind (zod 3, tailwind 3, prisma 5, vitest 2); sandbox payment code still shipped (about 25 lines in 16 files, `TestModeBadge`); dead code (`otpAllowed`), stale comments; a "Pul himoyada" escrow promise shows without any badge in manual mode.
**Owner actions pending:** Google Search Console and Yandex Webmaster (codes into Render, submit sitemap); a real domain (`tarmoq.uz` belongs to someone else; everything keys off `APP_URL`).

### A8. Testing
**T1** Money-moving routes have only denial tests, no positive path: dispute, revision, admin resolve (release and refund), creator wizard and `PUT /api/profile`, sending a message and unread counts, admin suspend/reinstate/send-back. Many `src/lib` modules have no unit test (`auth`, `audit`, `messaging`, `orders`, `reviews`, `payments/escrow`, `payments/manual`, `storage/*`).
**T2** No coverage report, no component tests, no automated accessibility checks, `retries: 0`, `workers: 1`, an order-dependent skip in `admin.spec.ts`; the production-style rig needs a folder outside the repo (`PG_MODULE_DIR`) so it cannot run in CI as written.

### A9. Process and documentation (the agile gap itself)
- No backlog in the repo: `status.md` is untracked (never committed), `HANDOFF.md` is deliberately uncommitted, the wave plan lives in `~/.claude/plans/`. No user stories, no acceptance criteria attached to items, no human-facing Definition of Done (only the AI agent files in `.claude/agents/`), no retrospectives.
- No `.github/` (no PR or issue template, no CODEOWNERS), no CONTRIBUTING, CHANGELOG, LICENSE or SECURITY, no git tags (`version` still `0.1.0`), no `docs/`, no decision records (decisions are spread over status.md, the plan file and 14 "SECURITY FIX" comments). Branch and release rules exist only in those files.
- Docs that are wrong: README says payments are a sandbox "no real money moves" while live runs `manual`; README env table omits `PAYMENT_PROVIDER`, `MANUAL_PAY_*`, `S3_RECEIPTS_BUCKET`, `SESSION_MAX_AGE_DAYS`, `RUSSIAN_LIVE`; says "three prompted secrets" (there are 11), "first run only migrate dev --name init" (3 migrations exist), 4-5 e2e specs (there are 12), upload default 100 MB (live is 25); ARCHITECTURE says "no translation layer", "nothing in this document has been run yet" and lists files that do not exist; `ru-reviewer.md` points to `src/i18n/ru.ts` (real: `src/i18n/ru/`).
- Git hygiene: the owner's working folder is on an old branch (11 commits behind), local `main` is stale, 9 temp worktrees under `/private/tmp` (volatile), 10 merged remote branches not deleted, a stale `feat-settings-and-avatars` entry in `.git/config`.

### A10. Branches in flight (GitHub, checked 2026-11-16)
| Branch | Tip | State |
|---|---|---|
| `main` | `3d49309` | LIVE (PR #10 = seven branches at once) |
| `feat-i18n-public` | `2664d9c` | pushed, verified (per handoff), not merged; merge first |
| `feat-i18n-app` | `566f228` | pushed, verified, stacked on public; merge second, "Create a merge commit" |
| `wip-settings-and-avatars` | `2667133` | pushed, UNVERIFIED, DO NOT MERGE |
| `fix-order-note-for-non-clients` | `53de4bc` | old, may conflict with the creator-hiding change |
| `fix-payout-card-save` | n/a | another session's worktree, never touch |
Capacity constraint: the owner's weekly Claude usage was 92% on 2026-11-16 and the Fable limit hit several times, so sprint capacity is a usage budget, not calendar time (run one builder at a time).

### A11. Shipped but not yet verified on the live site
Site as a creator (list hidden), admin sign-in at `/login?role=admin`, client flow, light/dark button and account menu on a real phone, Safari video playback, the Telegram "I paid" alert.

### B. Agile setup (Scrum, 1-week sprints). PROPOSED, the files below are NOT created yet
**Roles.** Product Owner = the owner (orders the backlog, accepts at the demo). Developers = Claude builders, each item checked by a separate verifier (never the author). Scrum Master duties = the main Claude session (keeps the board honest, runs the ceremonies, writes the retro).

**Files, all committed to the repo (on a branch `chore-agile-backlog` cut from `origin/main`, in a new worktree; pushed, never merged by Claude; the owner merges):**
1. `BACKLOG.md`: one ordered list built from A1-A11. Each item: ID (`TQ-001`...), user-story title, role, why it matters, acceptance criteria (the owner's 5-minute test), size S/M/L, tier T0/T1/T2, status (Backlog / Ready / Doing / Verify / Done), source (file path or audit), branch/PR. It folds in the `HANDOFF.md` "what to do next" list and every TO DO item of this file, so each appears once. Never copies secrets or the card number.
2. `docs/agile.md`: roles; Definition of Ready (story, acceptance criteria, size, no open question); Definition of Done (typecheck, `npm test`, e2e rig twice, 390 px check, separate verifier PASS, merge commit, checked live, item moved to Done); WIP limit 3; how stacked branches map to items; the traps from `HANDOFF.md`.
3. `docs/sprints/sprint-01.md`: goal, items, notes, demo checklist, retro. One file per sprint; velocity = items Done per sprint, measured against the usage budget.
4. `.github/pull_request_template.md`: what changed, "merge after #N", owner's 5-minute test, Definition of Done checklist.
5. This file (`status.md`) would then shrink to a pointer plus live-state facts (URLs, service IDs); the ten-task plan stays the design source for waves 4-11.

**Weekly rhythm.** Monday sprint planning (owner picks goal and items from the top, Claude confirms sizes and dependencies); mid-week 10-minute check; Friday review as a demo on the live site using each item's 5-minute test, then a retrospective written into the sprint file and the backlog re-ordered.

**Free-options-first rules** (owner's choice). Backups: a scheduled `pg_dump` plus a bucket copy to a private location, with a written restore drill. CI: a free GitHub Actions workflow running typecheck and unit tests (e2e later with a Postgres service container). Monitoring: free tiers only. The owner's standing rule applies: nothing is installed (ESLint, an error-tracking service, anything else) without asking first, and nothing touches `main`. Paid upgrades go in as separate T2 items.

**Sprint 1 goal: "Everything that is live is verified, and real clients can pay safely."**
- Verify PR #10 on live per role (A11).
- Close the money loose ends (A1 item 9) and decide the open owner questions (Izoh kodi, "show it to the ijodkor", download-before-release, photographer delivery plan).
- Safety net: fail closed on `PAYMENT_PROVIDER`, startup check for `AUTH_SECRET` and required env vars, `/api/health` as the Render health check, CI on PRs, a backup and restore note, 5xx alerting.
- Fix the README, ARCHITECTURE and env table.
- Carry-over: merge `feat-i18n-public` then `feat-i18n-app` one at a time (Russian stays off).
Later sprints follow the wave table (settings and avatars, messages, support, order story, dashboards, discovery, admin console, final regression) interleaved with the T0/T1 items above.

---

# SPEED WORK (2026-11-17)

Owner said: "optimize the website, it is not working fast". Answers given: slow everywhere (first open after a pause, every page, dashboards/chat/uploads); **stay on the free Render plan**. Plan file: `~/.claude/plans/optimize-the-website-it-squishy-frost.md`. Everything below was cut from `origin/main` (d19f745), never from the old checkout.

## What was measured (and what it means)
- **Anonymous, warm, from Tashkent** (`bash scripts/perf/measure.sh`, 5 runs): the server answers `/`, `/search`, `/login` and `/api/health` in about 0.12-0.23 s after connecting, and a page costs 0.4-0.65 s in total. Connect + TLS alone is 0.3-0.5 s because Frankfurt is far. So a **warm anonymous page is already close to the distance floor**; code cannot fix that.
- So the real costs are: **(1) the free instance sleeping** and the work it repeats on every wake-up, **(2) signed-in pages**, which ran extra database work, **(3) browser painting** (Wave 4, not started). The wake-up time itself is **still unmeasured**: leave the site alone 16 minutes, then run `bash scripts/perf/measure.sh https://tarmoq-uz.onrender.com 1` and read the first line.
- An early single curl showed 1.0-1.5 s; that was noise or a cold sample, do not quote it as typical.

## The three branches (all pushed, verified, NOT merged; each is independent; merge with "Create a merge commit")
| Branch | Commit | What it does | Verified |
|---|---|---|---|
| `perf-db-and-cache` | `03c503a` | one user lookup per page (was 2), public lists cached for 1 min to 1 h and refreshed at once after an admin approves/suspends a creator, a creator saves the profile or a review changes a rating, one profile query on the creator page, chat poll with no write when nothing is new, constant dummy hash in the login route, Prisma connection limit 5, `/api/health?db=1`, `scripts/perf/measure.sh` | 393 unit tests; full production rig 129 + 130 passed (two runs), exit 0; SQL counted per request on a production build, before vs after, below |
| `perf-indexes` | `95408b4` | 8 missing indexes, additive, safe to run twice | `prisma migrate diff` schema vs migrations: no difference (and 8 differences without the migration); `migrate deploy` makes all 8; second run no-op; 375 unit tests; rig 129 passed, 3 skipped |
| `perf-fast-boot` | `95c1061` | `scripts/boot.mjs`: on start, skip `prisma migrate deploy` and the constraints step when nothing changed | boot script tested with Node on a throwaway PostgreSQL (empty DB, repeat start, changed constraints, new migration, failing migration); 382 unit tests. **The Docker image was NOT built here** |

**SQL statements per request, same database, production build, signed in as a client (unchanged code vs `perf-db-and-cache`):**
| Request | Before | After |
|---|---|---|
| home | 9 (2 user lookups, 1 count, BEGIN/COMMIT) | 4 on the first visit, then 1 (just the user lookup) |
| `/search` | 9 | 5 |
| a creator's page | 10 | 7 |
| chat poll, nothing new (every 5 s per open chat) | 9, with 1 UPDATE | 4, no UPDATE |
| anonymous home / sitemap.xml / llms.txt | 7-8 / 2 / 3 | 4 then 0 / 0 / 0 while cached |
(The earlier survey guessed 3-4 user lookups per page; measured it is 2, because Prisma already merges identical lookups made at the same moment. Now 1.)
Boot step on this Mac, database already up to date: old chain 2.0-6.0 s, new 0.2 s. On Render's very slow CPU the gap is larger, but that is not measured.

## Pull request guide (owner's 5-minute tests)
**`perf-db-and-cache`** (title: "Speed: fewer queries per page, short-lived cache for public lists"): after it is live, (1) open the home page signed out: it looks exactly as before. (2) As admin approve a pending creator, then open the home page as a client: the creator is there at once (not after a minute). (3) Send a chat message between two accounts: the other side sees it within about 5 seconds. (4) Sign in with an unknown email and any password: the message is still "Email yoki parol notoʻgʻri.". (5) Open `https://tarmoq-uz.onrender.com/api/health?db=1`: `{"status":"ok","db":"ok"}`.
**`perf-indexes`**: nothing to see; after the deploy the Render log shows `Applying migration 20261117120000_perf_indexes`. The site will not feel faster today; this protects it as the data grows.
**`perf-fast-boot`**: in the Render log after the next deploy look for `[boot]` lines. The first start after merging prints `constraints.sql has no recorded fingerprint yet` and runs the constraints once; every later start, including each wake-up, prints `[boot] nothing to do: database is up to date`. If the log ever shows `could not tell what is applied`, it ran the old full chain, which is the safe fallback, and tell Claude.
Merge order does not matter. If `perf-indexes` merges AFTER `perf-fast-boot`, the next start sees one pending migration and applies it by itself.

## Owner-only checks (Claude cannot see dashboards or secrets). Do these, they decide whether the code work is enough
1. **Render dashboard, service `tarmoq-uz`:** Settings -> confirm **Instance Type = Free** and **Region = Frankfurt**. Set **Health Check Path** to `/api/health` (today `render.yaml` says `/login`, which renders the whole layout for every check; `/api/health` is cheap and never touches the database).
2. **UptimeRobot** (README says a 5-minute monitor exists; not verified): confirm it exists and is Up. **After `perf-db-and-cache` is merged, change its URL to `https://tarmoq-uz.onrender.com/api/health?db=1`.** Reason: the home page now comes from a cache, so a ping on `/` no longer touches the database, and the free Supabase project pauses after about a week without database activity. The `?db=1` address asks the database one trivial question.
3. **Supabase dashboard:** Project Settings -> General: the region should be Frankfurt (`eu-central-1`), the same as Render. Connect: tell Claude **only whether the pooler port is 5432 or 6543**, never the password. (The code now caps the connection pool at 5 on its own unless the address already says otherwise.)
4. Render's free tier has 750 instance-hours a month: one always-awake service fits (744 h); a second free service in the same account would not.

## Not done, on purpose
- **Wave 4 (first paint, UI-visible):** drop the unneeded `latin-ext` font files (-146 KB preloaded), show the home headline without the 0.6 s fade-in from invisible, add loading skeletons to the creator page, dashboards, order page and messages, and **measure** (Chrome, 4x CPU throttle, mobile) whether the "ikat" SVG filter and blurs on the home page drop frames before any change to the look. Needs the `ui-consistency` skills; it touches `layout.tsx` and page files that `feat-i18n-app` also edits, so do it after that merges or rebase.
- Edge-cached HTML (needs a redesign of the per-visitor layout), native bcrypt or a lower bcrypt cost (a new dependency or a security trade-off: ask first), direct-to-S3 uploads, dashboard and conversation pagination, a slower chat poll in the browser, lazy-loading the Russian dictionary, a trigram search index. Revisit after the live numbers.
- A paid Render plan: ruled out by the owner. It would remove the sleeping entirely and is still the single biggest speed-up if that changes.

## GOOGLE SIGN-IN AND LOGIN OPTIONS (2026-11-21)
Owner goal stated on 2026-11-21: **release the MVP as soon as possible.** Google sign-in is NOT needed for that: email + password already works and the pull request below does not change it. Do Google later, in a calm hour.

**Where the code is:** pull request **#17** https://github.com/samandar-dev01/tarmoq-uz/pull/17 (branch `google-sign-in`, commits `a9b189d` Google sign-in and `3738940` privacy page). Pushed, **NOT merged** (the owner merges, Claude never does). It is safe to merge at any time, even with no Google keys: the "Continue with Google" button stays hidden until both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist.
- What it does: a Google button on the client and creator sign-in and sign-up pages (never the admin door); only Google emails that Google marks verified are accepted; Google's account chooser opens every time (`prompt=select_account`); a client or creator account with the same verified email is linked to the Google id (the owner chose this); an admin account is never opened, made or linked through Google.
- One additive database migration (`20261120090000_google_sign_in`: password optional, new unique `googleSub`); it applies by itself on the next deploy. Render will ask for the two new variables on the blueprint sync: leave them empty.
- **Also in the PR: a public privacy page at `/maxfiylik`** (Uzbek only, contact email and operator "Tarmoq.uz" chosen by the owner). The owner should read it once: it promises "we don't sell your data" and "email us to ask for removal". It is not linked from the footer or the sitemap yet. **This closes the privacy half of the T0 gap "no terms/privacy page" in the audit above; the terms of service are still missing.**
- Tested: typecheck, 469 unit tests, 12 checks on a real Postgres, 18 browser tests of the Google pieces. **NOT done:** the old browser specs `login-doors`, `client-journey`, `authorization` were not rerun to completion on a fresh server (13 failed on a stale dev server; the same login worked on a fresh one); the real Google round trip (needs the keys). `.env.example` has two new `GOOGLE_*` lines that are NOT committed (the local secret-scanner hook flags that file's existing placeholder `postgres://` URL; harmless, README and `render.yaml` document the variables).

**Google Cloud progress (owner did these by following steps):** project "Tarmoq"; consent screen External; Branding saved (home page, authorized domain `tarmoq-uz.onrender.com`, developer email, no logo). **"Publish app" is greyed out** ("complete your configuration on the Branding page"), most likely because it wants the privacy-policy link, which must be live first. The owner was mid-way through "Create OAuth client": the two callback addresses were pasted into "Authorized JavaScript origins" by mistake (that box must stay EMPTY; they go in "Authorized redirect URIs"). Unknown whether the client was created; Claude has no keys.

**Known risk of the auto-link choice:** Tarmoq has no email verification, so someone could pre-register another person's Gmail with a password; after that person's first Google sign-in the account is linked and the pre-registered password still works. Fix later: email verification, or reset the password on first link.

### The options (what to pick when you come back to this)
| # | Option | Work | Verdict |
|---|---|---|---|
| 1 | **Merge #17 now, switch Google on later** | none | Do this. Nothing visible changes; Google can go live whenever the console steps are done. |
| 2 | **Keep Google, unblock Publish** | merge, Render deploy (~10 min), put the privacy link in Branding, Publish (~2 min), keys into Render | The shortest road to Google for everyone, about 15-20 min after the merge. |
| 3 | **Telegram login instead** | ~5 min owner setup (BotFather `/setdomain`, can reuse the admin-alert bot) but a bigger code change: Telegram gives no email and every Tarmoq account needs one | The real alternative to Google; more work than Google was. |
| 4 | **Phone login with an SMS code** | paid Uzbek SMS service (costs per message) + a lot of new code | Later, if ever. |
| 5 | **Email login links** | needs an email sender and a domain you own (`tarmoq.uz` is someone else's) | Not realistic now. |

### Finishing Google (a checklist, ~25-30 min total, in this order)
1. Google Cloud, Clients, Create client: type Web application, name `Tarmoq web`, JavaScript origins EMPTY, redirect URIs exactly `http://localhost:3000/api/auth/google/callback` and `https://tarmoq-uz.onrender.com/api/auth/google/callback`. Copy Client ID and secret (the secret may be shown once). Audience, Test users: add your own Google account.
2. Put both values in the local `.env` (two empty `GOOGLE_CLIENT_*` lines are already at the bottom). Never paste the secret into a chat or commit it.
3. Test locally (Claude sets up a local Postgres, runs `npm run db:setup`, starts the app; you click the button and pick your account).
4. Merge #17, wait for the Render deploy (check `/maxfiylik` opens).
5. Google Cloud, Branding: privacy policy link `https://tarmoq-uz.onrender.com/maxfiylik`, Save; Audience: Publish app. If it is still greyed out, open Verification Center and read what it lists.
6. Render, Environment: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; after the redeploy the button appears. Try it once on the live site.
7. Optional hardening later: rerun the three old browser specs on a fresh server; email verification (closes the auto-link risk); a footer link to the privacy page.

Run-notes: after `prisma generate` or a schema change, restart any running `next dev` (an old one answered 500 on correct-password logins). Embedded Postgres needs `node node_modules/@embedded-postgres/darwin-x64/scripts/hydrate-symlinks.js` run by hand once after `npm install`.

---

# STATUS ON 2026-11-28 (newest)

`main` = `3739b63` (pull request #25). Checked that evening: the live site answers and the Whop payment button is switched on.

## Done and live
- [x] **Marketplace update (PR #23):** white theme, new menu and footer, package search and filters, buying a package directly, settings and profile photos, notifications, custom offers, resolution centre, two-step sign-in.
- [x] Supabase bucket `avatars` created and `S3_AVATARS_BUCKET` added in Render.
- [x] **Online card payment through Whop (PR #24):** a button on the payment page; the order starts by itself after a confirmed payment. Card transfer stays as the backup. Creator payouts and refunds are still by hand.
  - A test payment in Whop's sandbox passed on a local copy and started its order.
  - Live API key, account ID and webhook secret are in Render. The live Whop page opened with the correct so'm price.
- [x] **Google sign-in:** switched on and confirmed working by the owner. A safety fix is merged and deployed (PR #25).
- [x] The three speed branches (`perf-db-and-cache`, `perf-indexes`, `perf-fast-boot`) are in `main`.

## To do, in this order

### 1. Finish Whop (clients can already see the button)
- [ ] **One successful real payment** on a small order. Check three things: you are brought back to the site, the order shows `Jarayonda`, and Whop's webhook delivery shows 200. The first attempt did not complete.
  - If this has to wait: delete `WHOP_API_KEY` in Render and choose "Save and deploy". That hides the button.
- [ ] Find out whether **Uzcard and Humo** work (not tested yet).
- [ ] Turn off "Pay with Crypto" on the Whop page (waiting for the owner's yes).
- [ ] Tidy up the Whop settings after the first successful payment.
- [ ] Ask Whop in writing whether holding a client's money until the work is approved is allowed.
- [ ] Change how the payment looks (owner's note; which screen is still to be said).

How to handle a Whop refund: refund it in Whop, then also on the site (the client opens `Nizo ochish`, the admin presses `Mijozga qaytarish`). Money that arrives for a cancelled or changed order is listed on `/admin/payments`.

### 2. Waiting to be merged or confirmed
- [ ] New home page: branch `homepage-visual-refresh` is pushed and tested, no pull request yet.
- [ ] Google sign-in: follow-up from 11-28 to confirm (see Claude's notes).
- [ ] `seo-landing-pages` is not merged. `fix-order-note-for-non-clients` stays unmerged by the owner's earlier decision.

### 3. Check on the live site
- [ ] Upload a profile photo.
- [ ] Confirm the card number shown for card transfers is the right one (on 11-21 a new number failed the check and was not set).

### 4. Not built yet
- [ ] A client's receipt is refused if the creator changes the terms during the transfer. Suggested fix: the agreed terms stay payable until the change is accepted.
- [ ] Password reset and email confirmation: need an email service (`RESEND_API_KEY`, `MAIL_FROM`).
- [ ] Tips (item 28) and the buyer fee + creator commission (item 30): need the owner's numbers.
- [ ] Item "13" was typed twice in the list of picked items: was 12 or 14 meant?
- [ ] Terms of service page (the privacy page exists).
- [ ] A native speaker's check of the new Uzbek and Russian text.
- [ ] Alerts when the site is closed (Telegram or browser push).
- [ ] Click or Payme payments: not started. Payme needs an individual entrepreneur or a company; whether Click allows a self-employed person to connect a website is not known.

Not re-checked on 11-28: the older lists above (gap audit, dashboard checks from the speed work).

On this Mac: delete the local Whop test settings when they are no longer needed.
