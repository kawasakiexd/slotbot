# SlotBot — Implementation Plan

Read [SPEC.md](./SPEC.md) then [ARCHITECTURE.md](./ARCHITECTURE.md) before writing code. This file is the order of work. Tick every `- [ ]` when done. Run the phase **Verification** before starting the next. Do not skip phases. Do not write tests unless the owner asks.

Effort is wall-clock for one implementer who already has a BotFather token. Total **~64 h core (8 days) + ~16 h Mini App**.

---

## How to work

1. Implement only the files listed in the current phase (plus tiny fixes in earlier files if Verification fails).
2. After each task, `pnpm typecheck` should still pass once Phase 0 tooling exists.
3. User-facing strings go into `apps/bot/locales/en.ftl` first, then `ru.ftl`. Copy source: SPEC §9.
4. If a library API differs from ARCHITECTURE, trust the installed docs, fix the code, add a Decisions log row.

---

## Phase 0 — Scaffold (4 h)

**Goal:** empty runnable workspace. `pnpm typecheck` / `lint` / `format:check` succeed. Postgres starts. No bot logic yet.

- [x] 0.1 Root files from ARCHITECTURE §3: `package.json` (`packageManager: "pnpm@12.11.2"`), `pnpm-workspace.yaml` (`packages: ["apps/*", "packages/*"]` + `allowBuilds` per ARCHITECTURE §2), `tsconfig.base.json` (strict, ESM, NodeNext), `.nvmrc` (`24`), `.editorconfig`, `.gitignore`, `.prettierignore`, `.prettierrc.json`, `eslint.config.js` (flat, typescript-eslint type-checked, prettier), `LICENSE` (MIT), `.env.example` (every var in ARCHITECTURE §9.1 with placeholders).
- [x] 0.2 `packages/shared`: `package.json` name `@slotbot/shared`, `src/{index,constants,money}.ts`. Constants: `LOCALES`, `BOOKING_STATUSES`, `DEPOSIT_PERCENTS`, `DEMO_SEED_ID_LIMIT = 1000`.
- [x] 0.3 `apps/bot/package.json` (`@slotbot/bot`), `tsconfig.json`, `tsdown.config.ts` (bundle to `dist/`, inline workspace TS). Scripts exactly as ARCHITECTURE §13.
- [x] 0.4 `docker-compose.dev.yml`: Postgres 18 alpine, `127.0.0.1:5432`, volume, healthcheck. `pnpm db:up` / `db:down` at root.
- [x] 0.5 Stub `apps/bot/src/index.ts` that logs `"slotbot boot"` and exits 0. Root scripts wire `dev`/`build`/`typecheck`/`lint`/`format`.

### Verification

```
pnpm install
pnpm db:up
pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
```

Postgres healthy (`docker compose -f docker-compose.dev.yml ps`). No secrets in git.

---

## Phase 1 — Process, DB, seed, health (8 h)

**Goal:** bot process starts, migrates, seeds, serves `/healthz`, shuts down cleanly. Telegram not required yet (token still needed by env).

- [x] 1.1 `config/env.ts` — zod schema for ARCHITECTURE §9.1. `z.stringbool()`, `z.coerce.number()`. Reject `PAYMENT_PROVIDER_TOKEN` that does not contain `:TEST:` when payments are on. Export `env`.
- [x] 1.2 `logger.ts` — pino as ARCHITECTURE §10. `pino-pretty` only in development. Redact paths listed there.
- [x] 1.3 `lib/{paths,time,format,html,errors,prng}.ts` — signatures:

```ts
// lib/time.ts — ONLY place that converts zones
export function salonZone(): string;                 // env.SALON_TIMEZONE, validated
export function nowUtc(): Date;
export function localDay(d: Date): string;           // yyyy-MM-dd in salon TZ
export function dayBoundsUtc(yyyyMmDd: string): { start: Date; end: Date };
export function localToUtc(date: string, minutes: number): Date | null; // null = DST gap
export function utcToLocalMinutes(d: Date): { date: string; minutes: number };
export function epochMinutes(d: Date): number;
export function fromEpochMinutes(n: number): Date;
```

`DomainError(code, meta?)` with codes from ARCHITECTURE §10.

- [x] 1.4 `db/schema.ts` — copy the Drizzle schema from ARCHITECTURE §6 in full (tables, enums, checks, indexes, relations, exported row types).
- [x] 1.5 `db/client.ts`, `db/migrate.ts`, `db/pgErrors.ts` (`pgErrorCode`, `isExclusionViolation` → `23P01`, `isUniqueViolation` → `23505`), `drizzle.config.ts`.
- [x] 1.6 Generate initial migration (`pnpm db:generate`). Then `pnpm db:generate:custom --name=booking_exclusion` and put this SQL in it (ARCHITECTURE §6):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("master_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('pending_payment', 'confirmed', 'completed', 'no_show'));
```

- [x] 1.7 `db/kvStorage.ts` — VersionedStateStorage on `bot_kv` for `@grammyjs/conversations`. Prefix keys `conv:`.
- [x] 1.8 `config/salon.ts` + `content/knowledge.md` + `services/demo.ts`. Seed: 3 masters, 6 services, hours, ~12 seed clients (`telegram_id` −1..−12), upcoming + past bookings so admin/stats look alive. `resetDemo()` is the same function as `pnpm db:seed` (SPEC AC-13). Users with real Telegram IDs are **kept**.
- [x] 1.9 `cli.ts` (`migrate` | `seed`). `http/server.ts` — Hono `/healthz` → `200 {"ok":true}` after a `SELECT 1`.
- [x] 1.10 `index.ts` startup/shutdown exactly as ARCHITECTURE §5.1. `jobs/scheduler.ts` stubs (`startJobs`/`stopJobs` no-ops). Bot: create with token, `bot.init()`, do **not** start polling yet — log "ready" so we can verify health without flooding Telegram. Actually start the runner already: a `/start` that replies `pong` is fine; full handlers come later.

### Verification

```
pnpm db:migrate && pnpm db:seed
pnpm dev
curl -s http://127.0.0.1:3000/healthz   # {"ok":true}
```

Drizzle Studio shows seed catalog. Ctrl-C exits 0 with no open handles. AC-01 (partial: health + seed).

---

## Phase 2 — Bot shell, i18n, menus (6 h)

**Goal:** `/start` in EN/RU, persistent main menu, about/terms/support/help/settings (language). AC-12 language switch works for these screens.

- [x] 2.1 `bot/context.ts` — types from ARCHITECTURE §5.3.
- [x] 2.2 `bot/i18n.ts` — `@grammyjs/i18n` Fluent. Locale: `user.locale` if set, else `language_code` prefix (`ru*` → `ru`, else `en`). Helper `menuButton(key)` filter for reply-keyboard labels.
- [x] 2.3 `locales/en.ftl` + `ru.ftl` — all SPEC §9 keys plus keys needed by menus/wizard/admin (name them in kebab-case matching SPEC). No hard-coded user strings outside ftl.
- [x] 2.4 Middleware in **exact** order ARCHITECTURE §5.2. `sequentialize` key is `undefined` for `pre_checkout_query`. `privateOnly` must **not** use `bot.chatType("private")`. Rate limit 4 / 2 s, skip payments.
- [x] 2.5 `bot/callbacks.ts` — `Route` union, `encode`/`decode`, assert ≤ 64 bytes. Prefixes: `bk`, `rs`, `my`, `hold`, `set`, `ai`, `ad`, `noop`.
- [x] 2.6 `bot/views/screen.ts` — `Screen`, `showScreen`. Swallow "message is not modified". Always `answerCallbackQuery`.
- [x] 2.7 `bot/keyboards/{mainMenu,common}.ts`. Admin row only when role is owner/demo.
- [x] 2.8 `bot/commands.ts` — `setMyCommands` for `en`/`ru` + admin scope. Commands from SPEC §6.
- [x] 2.9 Handlers: `start.ts`, `info.ts`, `settings.ts` (language only this phase), `fallback.ts`, `chatMember.ts`. Deep links `book`/`my`/`pay-<id>` can no-op until later phases.
- [x] 2.10 `services/users.ts`, `services/roles.ts` (`owner` from `ADMIN_IDS`, `demo` while `demoAdminUntil > now()`).

### Verification

`/start` shows welcome + demo hints (SPEC `welcome`, `demo-hints`) and the reply keyboard. Settings → Русский changes menu and messages. Unknown command → help. Group chat ignored. AC-12 (partial), AC-01.

---

## Phase 3 — Slots + booking wizard, no payment (8 h)

**Goal:** service → master → calendar → time → confirm creates a `confirmed` booking (treat deposit as 0 this phase, or skip sendInvoice). AC-02, AC-05.

- [x] 3.1 `services/catalog.ts`, `services/schedule.ts` — read helpers + localized names.
- [x] 3.2 `services/slots.ts` — pure generator:

```ts
export function generateStarts(input: {
  date: string;              // salon-local yyyy-MM-dd
  durationMin: number;
  work: { startMin: number; endMin: number } | null;
  busy: { start: Date; end: Date }[];     // bookings + time_off, UTC
  now: Date;
  leadMin: number;
  stepMin: number;
  zone: string;
}): Date[]; // UTC instants; skip DST gaps; start aligned to step from work.startMin
```

Availability query loads work + busy for the master (or all masters if "any") and filters. Master assignment for "any": pick the master with fewest overlapping bookings that day, tie-break `sortOrder`.

- [x] 3.3 `services/bookings.ts` — `createBooking` in a transaction: release existing user hold (`replaced`) → insert. Map `23P01` → `DomainError("SLOT_TAKEN")`. Enforce `MAX_ACTIVE_BOOKINGS_PER_USER`, `MIN_LEAD_MINUTES`, `BOOKING_HORIZON_DAYS`. This phase: if `prepayMinor === 0` or `PAYMENTS_ENABLED=false`, status `confirmed`; else still `confirmed` until Phase 4.
- [x] 3.4 Keyboards `calendar.ts`, `timeGrid.ts`. Disabled days via `InlineKeyboard#disabled`. Times as epoch-minutes in callback data.
- [x] 3.5 `handlers/booking.ts` — edit-in-place wizard SPEC §7.2. Back/Cancel. Re-validate slot on every step. Toast + re-render on `SLOT_TAKEN`.
- [x] 3.6 `views/bookingCard.ts` (client card). `myBookings.ts` list+detail (cancel/reschedule buttons can be visible but no-op until Phase 5).

### Verification

Book a no-deposit service in ≤ 6 taps. It appears in My bookings. Two users (or a second Telegram account + a SQL overlapping insert) on the same last slot → one booking, the other sees `slot-taken`. AC-02, AC-05.

---

## Phase 4 — Payments (6 h)

**Goal:** deposit services send a Stripe TEST invoice. AC-03, AC-04 (expiry wired in Phase 6; invoice send is this phase).

- [x] 4.1 `services/payments.ts`:

```ts
export function depositMinor(priceMinor: number, percent: number, currency: string): number;
// ceil(price * percent / 100), raise to currency min ($1.00 for USD), cap at price; 0 if percent=0 or PAYMENTS_ENABLED=false

export function invoiceParams(booking: Booking, serviceTitle: string): {
  title: string; description: string; payload: `bk:${number}`;
  currency: string; prices: { label: string; amount: number }[];
  provider_token: string; start_parameter: `pay-${number}`;
};
export function approvePreCheckout(query: PreCheckoutQuery): Promise<{ ok: true } | { ok: false; error: string }>;
export function confirmPayment(msg: SuccessfulPayment): Promise<void>; // idempotent on telegram_charge_id
```

Pre-checkout: extend `hold_expires_at` by 5 min with `UPDATE … WHERE status='pending_payment' AND hold_expires_at > now()`. Must return within 10 s.

`confirmPayment`: transaction; `INSERT payments … ON CONFLICT (telegram_charge_id) DO NOTHING`; if insert happened, set booking `confirmed`. If hold already expired, savepoint try-revive; on `23P01` mark payment `refund_pending`.

- [x] 4.2 `createBooking` for deposit > 0 → `pending_payment` + `hold_expires_at = now + HOLD_MINUTES`. Then `sendInvoice` (ARCHITECTURE §8.2). Copy-text button for test card `4242 4242 4242 4242`.
- [x] 4.3 `handlers/payments.ts` registered **before** conversations (ARCHITECTURE §5.2 item 8).
- [x] 4.4 Deep link `/start pay-<id>` re-sends invoice if hold still valid.

### Verification

Deposit service → invoice → pay with `4242…4242` → `paid` message, status `confirmed`. Card `4000 0000 0000 0002` declined, hold remains. AC-03. Payload/amount mismatch in a forged pre-checkout is rejected.

---

## Phase 5 — My bookings: cancel + reschedule (5 h)

**Goal:** AC-06.

- [x] 5.1 `bookings.cancel` / `bookings.reschedule` — cutoff `CHANGE_CUTOFF_HOURS`, `MAX_RESCHEDULES`, ownership. Paid cancel → payment `refund_pending` (no Bot API card refunds). Reschedule updates the same row (exclusion still applies). Reset `slotAssignedAt`.
- [x] 5.2 `handlers/myBookings.ts`, `handlers/reschedule.ts` (reuse calendar/time grid).
- [x] 5.3 `services/notifications.ts` — owner admins get new/cancel/reschedule events when `NOTIFY_ADMINS=true`. Never message seed clients. `privacy.ts` masking for demo admins (SPEC §10.3).

### Verification

Cancel/reschedule ≥ 2 h before start works. Inside 2 h → `cutoff`. Third reschedule refused. AC-06.

---

## Phase 6 — Jobs: holds + reminders (4 h)

**Goal:** AC-04, AC-07. Restart-safe.

- [x] 6.1 `jobs/holds.ts` — `UPDATE bookings SET status='cancelled', cancel_reason='payment_timeout', … WHERE status='pending_payment' AND hold_expires_at <= now() RETURNING`. Delete invoice message best-effort. Notify user `hold-expired`.
- [x] 6.2 `jobs/reminders.ts` — claim with `FOR UPDATE SKIP LOCKED`:

```sql
UPDATE bookings SET reminder_24h_sent_at = now()
WHERE id IN (
  SELECT id FROM bookings
  WHERE status = 'confirmed'
    AND reminder_24h_sent_at IS NULL
    AND starts_at BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
  FOR UPDATE SKIP LOCKED
) RETURNING *;
```

Same idea for 2 h (`1h50`–`2h10`). Transient send fail → reset the timestamp to null. 403 → `markBlocked`. At-most-once.

- [x] 6.3 `jobs/scheduler.ts` — croner tick `*/30 * * * * *` `protect: true`; demo-reset cron later in Phase 7. Translate with `i18n.t(locale, key, vars)`.

### Verification

Create a hold, wait (or `UPDATE hold_expires_at = now()`) → slot free, invoice gone. Insert a confirmed booking starting in ~25 h, restart the process, wait for ticks → each reminder once. AC-04, AC-07.

---

## Phase 7 — Admin + demo sandbox (10 h)

**Goal:** AC-09, AC-10, AC-11, AC-13.

- [x] 7.1 Admin composer `bot/admin/index.ts` guarded by `requireAdmin`. `/admin`, `/admin_demo` (only if `DEMO_MODE`; 30 min; owners not downgraded). Home shows remaining demo minutes.
- [x] 7.2 Screens: `schedule.ts` (today/any day, grouped by master), `bookings.ts` (card actions complete/no-show/cancel/mark refunded — sandbox: seed + own only), upcoming list paginated.
- [x] 7.3 Conversations: service/master create, `editText.ts`, `customHours.ts`. Catalog CRUD A-05..A-08. Seed IDs `< 1000` cannot be deactivated (`PROTECTED_ITEM`).
- [x] 7.4 `broadcast.ts` + `broadcastCompose.ts` — demo admin recipients = sender only.
- [x] 7.5 `stats.ts`, `exportXlsx.ts` (exceljs `writeBuffer` → `sendDocument`). Mask names for demo admins.
- [x] 7.6 `admin/demo.ts` restore catalog, cooldown `DEMO_RESTORE_COOLDOWN_MINUTES` stored in `bot_kv` key `app:demo:lastRestoreAt`.
- [x] 7.7 `jobs/demoReset.ts` — `resetDemo()` at `DEMO_RESET_CRON` in salon TZ. Same function as `pnpm db:seed`.

### Verification

Walk SPEC §7.9 and §10. Broadcast only to self. Masked names. Cannot complete another visitor's booking. Restore demo reverts catalog. `pnpm db:seed` keeps real users. Stats match xlsx. AC-09..11, AC-13.

---

## Phase 8 — AI assistant (5 h)

**Goal:** AC-08.

- [x] 8.1 `services/ai/provider.ts` interface; `openai.ts` Responses API as ARCHITECTURE §8.3 (`responses.parse` + `zodTextFormat`, `store: false`, hashed `safety_identifier`, 15 s timeout).
- [x] 8.2 `knowledge.ts` — salon config + DB prices/hours + `content/knowledge.md`, cached, first in `instructions`.
- [x] 8.3 `usage.ts` — per-user / global daily caps (salon-local day) + budget in micro-USD from `AI_PRICE_*`.
- [x] 8.4 `assistant.ts` — limits → provider → persist usage. Empty `OPENAI_API_KEY` → `AI_DISABLED`.
- [x] 8.5 `handlers/ai.ts` — `/ask` intro; free-text fallback (not `/`, not in a conversation). Intent `booking` → "Book now" button `ai:book`. Off-topic refused. Truncate input.

### Verification

Price/address/hours in EN and RU correct. Off-topic refused. 11th question → `ai-limit-user`. Kill the key → friendly disabled. AC-08.

---

## Phase 9 — Mini App (Could, 16 h)

Skip unless the owner says to do it. AC-17.

- [ ] 9.1 `packages/shared/src/api.ts` — zod DTOs shared by Hono and the Mini App.
- [ ] 9.2 Hono `initData.ts` HMAC (ARCHITECTURE §8.4), `auth.ts`, `rateLimit.ts` 60/min, `api.ts` routes wrapping the **same** services. Forged / stale initData → 401.
- [ ] 9.3 Vite React Mini App layout from ARCHITECTURE §3 `apps/miniapp`. Tailwind `@theme` mapped to `--tg-theme-*`. Screens: Services → Masters → Date → Time → Confirm → Done; My bookings.
- [ ] 9.4 Payments: `createInvoiceLink` + `invoice.openUrl`. Same payment handlers confirm.
- [ ] 9.5 Serve static from `apps/miniapp/dist` when `MINIAPP_ENABLED`. `setChatMenuButton`. Dockerfile COPY as commented in ARCHITECTURE §12.2.

### Verification

Book, pay, cancel through the Mini App. Tampered `hash` or `auth_date` > 24 h → 401. AC-17.

---

## Phase 10 — Deploy & portfolio polish (8 h)

**Goal:** AC-14, AC-15, AC-16.

- [x] 10.1 `Dockerfile`, `docker-compose.yml` (bot + postgres, external network `proxy`), `.dockerignore`, `deploy/Caddyfile.snippet`, `deploy/backup.sh`.
- [x] 10.2 `.github/workflows/ci.yml` (format, lint, typecheck, build, `drizzle-kit check`). `deploy.yml` (SSH → git reset → compose up).
- [x] 10.3 README.md (English), outline:

  1. Hero GIF + live bot link (`t.me/<bot>`)
  2. What it does (bullet features from SPEC §5 Must)
  3. Mermaid architecture (copy ARCHITECTURE §1)
  4. Stack table
  5. Getting started (the AC-01 commands)
  6. Env table (link `.env.example`)
  7. Demo mode notes (test card, `/admin_demo`, nightly reset)
  8. Deployment (Hetzner + Caddy snippet)

- [ ] 10.4 Capture media into `docs/media/`:

  | File | Shot |
  | --- | --- |
  | `start.png` | `/start` + main menu |
  | `wizard.gif` | full book flow |
  | `invoice.png` | Stripe TEST invoice |
  | `admin-day.png` | admin day schedule |
  | `stats.png` | stats screen |
  | `xlsx.png` | opened export |
  | `ru.png` | Russian UI |

- [x] 10.5 Final gate: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm build`. Walk AC-01..AC-16 (and AC-17 if Phase 9 shipped).

---

## Effort

| Phase | Hours |
| --- | --- |
| 0 Scaffold | 4 |
| 1 Process + DB | 8 |
| 2 Bot shell | 6 |
| 3 Slots + wizard | 8 |
| 4 Payments | 6 |
| 5 Cancel/reschedule | 5 |
| 6 Jobs | 4 |
| 7 Admin + demo | 10 |
| 8 AI | 5 |
| 10 Deploy + polish | 8 |
| **Core total** | **64** |
| 9 Mini App | 16 |

---

## Decisions log

| ID | Decision | Why |
| --- | --- | --- |
| D1 | One process: grammY + croner + Hono | Tiny traffic; long polling already forbids a second consumer |
| D2 | Long polling, not webhook | Simpler local dev; HTTPS only for health/Mini App |
| D3 | GiST exclusion constraint for overlaps | Variable durations; works for bot and Mini App; survives races |
| D4 | croner in-process, not BullMQ | One instance; durable state is in Postgres |
| D5 | Stripe TEST via Telegram Payments | Physical service → third-party providers allowed (checked 2026-10-15); Stars not used |
| D6 | Fluent i18n (`@grammyjs/i18n`) | Native grammY plugin; jobs can `i18n.t(locale, key)` |
| D7 | pnpm workspaces from day one | Mini App later without a rewrite |
| D8 | Conversations only for admin text forms | Booking wizard is callback-driven (edit-in-place) |
| D9 | No Bot API card refunds | Only Stars are refundable via Bot API; admin "mark refunded" |
| D10 | TypeScript 6.0, not 7 | typescript-eslint 8.71 supports `<6.1` |
| D11 | tsdown `fixedExtension: false` + `hash: false`; skip polling on placeholder BOT_TOKEN | tsdown 0.23 defaults to hashed `.mjs`; ARCHITECTURE CMD is `dist/index.js`. Healthz must start without a BotFather token. |

---

## Open questions for the owner (defaults in bold)

1. Bot username / display name? **`SlotBot Demo` / `slotbot_demo_bot`** until you create the real BotFather bot.
2. Salon timezone? **`America/New_York`** (looks foreign for the portfolio).
3. Your Telegram id in `ADMIN_IDS`? **`494979019`** (from your other projects). Confirm if wrong.
4. Build Phase 9 Mini App now? **No — after core is live on Fiverr.**
5. Domain? **`slotbot.<your-domain>`** placeholder until you buy one.
6. OpenAI key for the public demo? **Yes, with the SPEC caps ($1/day).** Bot stays useful with AI disabled.
