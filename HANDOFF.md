# HANDOFF: how any agent can pick up Tarmoq.uz work (written 2026-11-16, usage limits hit; NOT committed on purpose)

Read in this order: this file -> `status.md` (the owner's list, same folder) -> `/Users/furb-x/.claude/plans/shimmying-napping-gadget.md`
(the ten-task plan, wave table, Appendix A = language design) -> memory `tarmoq-ten-task-plan.md`
(`/Users/furb-x/.claude/projects/-Users-furb-x/memory/`). A copy of this file is in `/Users/furb-x/.claude/plans/HANDOFF.md`.

## The product and the rules
Tarmoq.uz: marketplace of video creators in Uzbekistan (roles CLIENT=mijoz, PROVIDER=ijodkor, ADMIN). Next.js 16 + React 19 + Tailwind 3.4 +
Prisma 5.22 + Postgres (Supabase). Live: https://tarmoq-uz.onrender.com (Render free plan, auto-deploys `main`, runs
`prisma migrate deploy` on start). Repo: github.com/samandar-dev01/tarmoq-uz. Owner: Samandar, non-expert, wants decisions made for them.
OWNER'S RULES (binding): one branch per task; push only VERIFIED branches; NEVER merge, NEVER touch `main`, NEVER touch branch
`fix-payout-card-save` (another session's); no installs except Claude skills (ask first for anything else); no live changes
without saying so (Supabase buckets are the one exception: private, additive, announced); UI work follows the `ui-consistency`
skills; default Uzbek text stays byte-identical (keys use ʻ U+02BB); NO payment promise in meta/OG/JSON-LD/FAQ/llms text (uz and ru);
additive DB migrations only; never print secrets; card number is deliberately not stored anywhere.

## Where the work is (git, 2026-11-16)
| Branch | State | Tip |
|---|---|---|
| `main` | LIVE. PR #10 merged the first 7 branches (hide creators, chore/health/rig, login door, SEO, light theme, app shell, i18n core) | 3d49309 |
| `feat-i18n-public` | pushed, verified, NOT merged: Russian for home/search/creator page/SEO/404 (stacked on main) | 2664d9c |
| `feat-i18n-app` | pushed, verified, NOT merged: Russian for orders/checkout/agreement/cabinets/wizard/messages/server leftovers, duplicates removed, completeness test covers all of `src/` except admin + notify. STACKED on `feat-i18n-public`: merge public first, "Create a merge commit" | 566f228 |
| `wip-settings-and-avatars` | pushed WIP, UNVERIFIED, DO NOT MERGE: first third of settings + photos (migration `account_settings`, token version `tv`, `/api/account/*`, `/api/avatars/[userId]`, avatars storage area, byte checks) | 2667133 |
| `fix-order-note-for-non-clients` | old, left alone by the owner's decision | 53de4bc |
Verified numbers on `feat-i18n-app` tip: tsc clean; 394 unit tests; rig: 145 passed + 3 skipped, then 146 + 2 (run twice on the same DB).
Russian is OFF for visitors: `RUSSIAN_LIVE` is false in code. Switching on = a tiny last branch `feat-russian-live` that adds
`RUSSIAN_LIVE: "1"` as a plain env value in `render.yaml` (NOT created yet). Never set it by accident; it is the owner's go/no-go.

## How to run the checks (the "rig")
- `RIG_BASE_PORT=3000 RIG_RUNS=2 PG_MODULE_DIR=<dir containing node_modules/embedded-postgres> caffeinate -dims bash scripts/e2e-prod/run.sh`
  (production build + throwaway Postgres + a forwarder that gives each request its own address, because production builds ignore
  RATE_LIMIT_DISABLED; it also starts a second build with RUSSIAN_LIVE=1 on base+301 for the Russian specs). About 6 minutes. Read the log
  (`grep -n "passed\|failed\|EXIT"`). Use a different RIG_BASE_PORT (3100, 3200...) when two rigs run at once. `caffeinate` matters: the Mac
  sleeping gives fake timeouts. `scripts/e2e-prod/README.md` has details. Run it twice (the 2nd pass runs the review-hiding test).
- `PG_MODULE_DIR` was `/private/tmp/claude-501/-Users-furb-x/488a1871-4660-4e5c-a546-4c2de2a9cc26/scratchpad/pg` (embedded-postgres, NOT a project
  dependency). If /tmp was cleared it is gone: ask the owner before installing that ONE package into a scratch folder outside the repo.
- Unit: `npx tsc --noEmit` and `npx vitest run`. After `git worktree add`, copy dependencies with `cp -cR node_modules <worktree>/node_modules` (instant APFS
  clone, no download) and run `npx prisma generate` if the schema changed.
- Worktrees live under the session scratchpad `.../scratchpad/wt-*` (temporary). Everything important is on GitHub; recreate with
  `git worktree add -b <branch> <path> <base>` or `git fetch` + `git worktree add <path> origin/<branch>`. The Agent tool's `isolation: "worktree"` fails
  when the session folder is not the repo: create worktrees by hand and give builders the path.

## What to do next, in order
1. RUSSIAN, finish: (a) run the `ru-reviewer` agent (`.claude/agents/ru-reviewer.md`, model fable, READ-ONLY) over `src/i18n/ru/*.ts`; its job list: glossary
   (ijodkor=«креатор», mijoz=«заказчик», buyurtma=«заказ», kelishuv=«соглашение», toʻlov=«оплата», paket=«пакет», sharh=«отзыв», tuzatish=«правка»,
   soʻm=«сум»), polite «вы», one concept one word, overflow risk in buttons at 390 px, no payment words in meta/FAQ, doubts: «Я оплатил(а)», «Ждут ваших действий»,
   «с {name}», «Срок: N дн.», «Правок: N», «Подтверждён», «Стоимость», «Креаторы», «Деньги под защитой» (home card), the agreement reading in `src/lib/agreements.ts`.
   Apply its MUST FIX list by hand. (b) The owner should have a lawyer read the Russian agreement reading and the privacy wording. (c) Create `feat-russian-live`.
2. SETTINGS + AVATARS (task 6), finish from `wip-settings-and-avatars`: the `/settings` page (tabs Profil/Xavfsizlik/Koʻrinish via `?tab=`), Avatar component with photo
   fallback to initials, account-menu entry «Sozlamalar», client-side 512 px WebP resize, Russian fragment `src/i18n/ru/settings.ts` registered in `ru/index.ts`, unit +
   e2e tests (`settings.spec.ts`: per-role name change, avatar upload/refuse a text file renamed .png, password change keeps this session and kills another, wrong
   current password, email change needs password, sign out everywhere, old token without `tv` still works), widen the completeness scope. Then I (the dispatcher) create
   the Supabase bucket `avatars` (private, 2 MB, image/jpeg+png+webp) through the Supabase tool and `S3_AVATARS_BUCKET: avatars` goes in `render.yaml` (a missing env for avatars THROWS by design).
3. MESSAGES CORE (tasks 9, 10): plan file 'Task 9' + 'Foundation (e) messaging v2'. SSE is PROVEN to work through Render (a curl of /api/health/stream showed ticks 2 s apart),
   so `/api/events` is viable; keep polling as a fallback. Messages already in the DB posted by the system (11 call sites) are stored in Uzbek and cannot be translated per viewer:
   turn them into SYSTEM messages with a `systemCode`. Add the `/privacy` page and tell users admins can read chats, including deleted/original text (owner: lawyer check).
4. SUPPORT/HELP (task 4): Help sheet = in-site SUPPORT thread (admin answers in `/admin/support`) + link https://t.me/justuzbe; Telegram alert carries who + link, never the text, throttled 10 min.
5. Then `feat-order-story`, `feat-dashboards`, `feat-discovery-alive`, `feat-admin-console`, final regression (plan wave table). The Menu piece (src/components/ui/Menu.tsx) and AccountMenu exist; ConfirmDialog/Sheet/Tabs/Toast are NOT built yet.
Per branch: builder (Sonnet) writes code + tests + runs the rig on its own ports; the dispatcher re-runs the rig on the rebased tip; a separate Fable verifier does `ui-consistency:verifying` + browser checks when budget allows; push; add the PR text and the owner's 5-minute test to `status.md` ("PULL REQUEST GUIDE").

## Traps learned (save yourself the time)
- `admin.spec.ts` approves the demo creator Sevara, so later specs must create throwaway data (see `seo.spec.ts`). The review-hiding test skips itself on the first run on an empty DB.
- i18n rules: keys are one-line double-quoted Uzbek literals inside `t(`/`tk(`/`msg(`; one key lives in ONE fragment (a unit test fails on duplicates); `ru/errors.ts` is server-only; admin pages stay Uzbek;
  Telegram texts stay English; `localHref(locale, path)` for public links only; never edit `src/app/layout.tsx` metadata for language (already done).
- Admin signs in at `/login?role=admin` (the client/creator tabs refuse admins on purpose, since PR #10). Tell the owner if they forget.
- A creator never sees the creator list (`canBrowseCreators` in `src/lib/authRole.ts`, re-exported from `auth.ts`).
- `render.yaml` pins `APP_URL`; a blueprint sync overwrites hand-edited dashboard values for plain values (secrets use `sync: false`).
- After a stacked branch is rebased on the previous one, re-run the WHOLE suite. A merge conflict is usually just two lists in `tests/unit/i18nCompleteness.test.ts` or the rig README: keep both.
- Usage: the Fable 5-hour limit hit several times; Sonnet builders are cheaper; run ONE builder at a time when the owner's weekly usage is high (it was 92% on 2026-11-16).
