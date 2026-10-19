# SlotBot — Architecture

Version 1.0 · 2026-10-15 · Versions verified against npm / official docs on 2026-10-15.

Related: [SPEC.md](./SPEC.md) (what) · [PLAN.md](./PLAN.md) (order of work, Decisions log)

---

## 1. Overview

One Node.js process ("bot service") runs four things that share one database pool and one service layer:

1. **grammY bot** — long polling through `@grammyjs/runner` (concurrent, sequentialized per chat).
2. **Jobs** — `croner` timers: a 30-second tick (expire holds, send reminders) and a nightly demo reset.
3. **HTTP server** — Hono on port 3000: `/healthz` from Phase 1; `/api/*` + static Mini App in Phase 9.
4. **Service layer** — domain logic (slots, bookings, payments, AI, stats) used by all of the above.

```mermaid
flowchart LR
  user((Client)) --> tg[Telegram]
  tg <-->|getUpdates / Bot API| runner
  subgraph svc[slotbot bot container · Node 24]
    runner[grammY runner] --> handlers[Handlers · conversations · keyboards]
    jobs[croner jobs] --> services
    http[Hono HTTP] --> services
    handlers --> services[Services: slots · bookings · payments · ai · stats · demo]
    services --> drizzle[Drizzle ORM + postgres.js]
  end
  drizzle --> pg[(PostgreSQL 18)]
  services -->|Responses API| openai[OpenAI]
  tg -.->|invoice / card data| stripe[Stripe TEST]
  user -.->|Mini App over HTTPS| caddy[Shared Caddy] --> http
```

Why a single process: one salon, tiny traffic, long polling allows exactly one consumer anyway, and in-process jobs avoid
Redis/queues. All durable state (holds, reminders, conversation state, demo state) lives in PostgreSQL, so restarts are safe.

## 2. Stack

Exact packages and versions (use `^major.minor` ranges in `package.json`; lockfile pins patches).

### Runtime & tooling

| Package / tool | Version | Why |
| --- | --- | --- |
| Node.js | 24 LTS (24.22) | Current Active LTS ("Krypton"); 26 is not LTS until late Oct 2026 |
| pnpm | 12.11 | Workspaces; v12 is a native binary — install with `npm i -g pnpm@12.11.2`; settings live in `pnpm-workspace.yaml` (`allowBuilds`) |
| typescript | 6.0 | Strict typing. **Not 7.0**: `typescript-eslint` 8.71 supports `>=4.8.4 <6.1.0` |
| tsx | 4.23 | Dev runner with watch; runs CLI scripts |
| tsdown | 0.23 | Bundles `apps/bot` to `dist/` and inlines workspace TS packages (`@slotbot/shared`) |
| eslint / @eslint/js | 10.12 / 10.0 | Flat config |
| typescript-eslint | 8.71 | Type-aware rules (`no-floating-promises` matters for bot handlers) |
| eslint-config-prettier | 10.1 | Disable stylistic rules (`eslint-config-prettier/flat`) |
| globals | 17.13 | Browser globals for the Mini App lint block |
| prettier | 3.9 | Formatting |
| @types/node | 24.19 | Match the runtime major (npm `latest` is 26.x — do not use) |

### Bot service (`apps/bot`)

| Package | Version | Why |
| --- | --- | --- |
| grammy | 1.46 | Bot framework; ships Bot API 10.3 types incl. button `style` and `InlineKeyboard#disabled()` |
| @grammyjs/runner | 2.0 | Concurrent long polling + `sequentialize`; graceful `handle.stop()` |
| @grammyjs/conversations | 2.1 | Multi-step text input (admin forms, broadcast) with Postgres-persisted state |
| @grammyjs/i18n | 1.1 | Fluent `.ftl` translations, `ctx.t`, `i18n.t(locale, key)` for jobs |
| @grammyjs/auto-retry | 2.0 | Retries 429 / network errors (broadcasts, reminders) |
| @grammyjs/ratelimiter | 1.2 | Per-user update rate limit (memory store) |
| drizzle-orm | 0.45 | Typed SQL, relational queries, nested transactions = savepoints. Stable line; 1.0 is still RC |
| drizzle-kit | 0.31 | SQL migrations in git (`generate`, `--custom`, `check`, `studio`) |
| postgres | 3.4 | postgres.js driver: fast, ESM, no native deps |
| zod | 4.6 | Env validation, API DTOs, OpenAI structured output schema |
| pino | 10.4 | JSON logs with redaction; `pino-pretty` 13.2 as devDependency |
| croner | 10.0 | Cron with seconds, IANA time zones and overrun protection (`protect: true`) |
| luxon | 3.7 (+ @types/luxon 3.7) | DST-safe salon-time arithmetic and localized formatting |
| openai | 7.34 | Responses API, `responses.parse` + `zodTextFormat` structured output |
| exceljs | 4.4 | `.xlsx` export (owner's known tool), `writeBuffer()` → Telegram document |
| hono / @hono/node-server | 4.13 / 2.1 | Tiny web-standard HTTP server: health, Mini App API, `serve-static` |

### Mini App (`apps/miniapp`, Phase 9, Could)

| Package | Version | Why |
| --- | --- | --- |
| react / react-dom | 19.3 | UI |
| vite / @vitejs/plugin-react | 8.3 / 6.1 | Dev server + build |
| tailwindcss / @tailwindcss/vite | 4.3 | Styling mapped to Telegram theme CSS variables |
| @tma.js/sdk-react | 3.0 (pulls @tma.js/sdk 3.3) | Typed Mini App SDK (theme, MainButton, BackButton, invoice, launch params). v4 is RC — stay on 3.x. `@telegram-apps/*` packages are the deprecated predecessors. Telegram itself ships no npm SDK (only `telegram-web-app.js`) |
| @tanstack/react-query | 5.104 | Fetch/caching/mutations with minimal code |
| @types/react / @types/react-dom | 19.3 | Types |
| eslint-plugin-react-hooks | 7.1 | Hooks lint rules |

### Infrastructure

| Component | Version | Notes |
| --- | --- | --- |
| PostgreSQL | 18 (`postgres:18-alpine`) | 19 is RC until ~Nov 2026. **PG 18 image: mount the volume at `/var/lib/postgresql`** (not `/data`) |
| btree_gist | contrib, bundled | Needed for the exclusion constraint (`=` on integer inside GiST) |
| Caddy | 2.x, shared, already on the VPS | External Docker network `proxy`; automatic HTTPS |
| GitHub Actions | checkout v7, setup-node v7, pnpm/action-setup v6, appleboy/ssh-action v1.2 | CI + SSH deploy |
| OpenAI model | `gpt-6-luna` ($0.10 in / $0.01 cached / $0.50 out per 1M tokens) | Newest low-cost model; `reasoning.effort: "none"` supported. Cheaper fallback: `gpt-5-nano` |
| Telegram Bot API | 10.3 | Payments for physical services via third-party providers (Stripe TEST); Stars are only for digital goods |

Not used on purpose: `@grammyjs/menu`, grammY sessions, Redis/BullMQ, an ORM other than Drizzle, a date library other than Luxon
(see PLAN.md → Decisions log).

## 3. Repository layout

pnpm workspace from day one so the Mini App is added without restructuring.

```
slotbot/
├── .github/workflows/
│   ├── ci.yml                      # format, lint, typecheck, build, drizzle-kit check
│   └── deploy.yml                  # SSH → git reset → docker compose up -d --build
├── apps/
│   ├── bot/
│   │   ├── content/knowledge.md    # free-text FAQ for the AI (EN)
│   │   ├── drizzle/                # generated SQL migrations + meta/ (committed)
│   │   ├── locales/
│   │   │   ├── en.ftl
│   │   │   └── ru.ftl
│   │   ├── src/
│   │   │   ├── index.ts            # process entry: env → db/migrate → seed-if-empty → bot/http/jobs → shutdown
│   │   │   ├── cli.ts              # `migrate` | `seed`
│   │   │   ├── logger.ts
│   │   │   ├── config/
│   │   │   │   ├── env.ts          # zod-validated env, exported `env`
│   │   │   │   └── salon.ts        # salon facts (name, address, phone, maps, hours text) EN/RU
│   │   │   ├── lib/
│   │   │   │   ├── paths.ts        # APP_ROOT-relative paths (locales, drizzle, content, miniapp dist)
│   │   │   │   ├── time.ts         # Luxon helpers: salon zone, local⇄UTC, day bounds, epoch minutes
│   │   │   │   ├── format.ts       # formatDate/Time/DateTime/Money per locale
│   │   │   │   ├── html.ts         # escapeHtml, bold helpers
│   │   │   │   ├── errors.ts       # DomainError + codes; Telegram error helpers
│   │   │   │   └── prng.ts         # mulberry32 for deterministic seed data
│   │   │   ├── db/
│   │   │   │   ├── schema.ts       # tables, enums, indexes, relations
│   │   │   │   ├── client.ts       # postgres.js + drizzle instance, `closeDb()`
│   │   │   │   ├── migrate.ts      # runMigrations() with drizzle migrator
│   │   │   │   ├── pgErrors.ts     # pgErrorCode(), isExclusionViolation(), isUniqueViolation()
│   │   │   │   └── kvStorage.ts    # VersionedStateStorage on table bot_kv (conversations)
│   │   │   ├── services/
│   │   │   │   ├── users.ts        # upsert, locale cache, setLocale, markBlocked, phone, deleteData
│   │   │   │   ├── roles.ts        # getRole(user) → owner | demo | null, grantDemoAdmin
│   │   │   │   ├── catalog.ts      # services/masters queries + CRUD, localized names
│   │   │   │   ├── schedule.ts     # working hours + days off CRUD
│   │   │   │   ├── slots.ts        # pure slot generator + availability queries + master assignment
│   │   │   │   ├── bookings.ts     # create/confirm/cancel/reschedule/complete/no-show, limits, queries
│   │   │   │   ├── payments.ts     # deposit calc, invoice params, pre-checkout, successful payment, refunds
│   │   │   │   ├── notifications.ts# send to users/admins with locale, blocked/seed guards
│   │   │   │   ├── privacy.ts      # client name/phone masking for demo admins
│   │   │   │   ├── broadcast.ts    # recipients, send loop, progress
│   │   │   │   ├── stats.ts        # aggregate queries for a period
│   │   │   │   ├── exportXlsx.ts   # workbook → Buffer
│   │   │   │   ├── demo.ts         # seed data constants, resetDemo(), restoreCatalog()
│   │   │   │   └── ai/
│   │   │   │       ├── provider.ts # AiProvider interface + types
│   │   │   │       ├── openai.ts   # OpenAI Responses implementation
│   │   │   │       ├── knowledge.ts# builds + caches the knowledge text
│   │   │   │       ├── usage.ts    # per-user / global limits, cost accounting
│   │   │   │       └── assistant.ts# orchestration: limits → prompt → provider → usage
│   │   │   ├── jobs/
│   │   │   │   ├── scheduler.ts    # startJobs()/stopJobs() with croner
│   │   │   │   ├── holds.ts        # expireHolds()
│   │   │   │   ├── reminders.ts    # sendDueReminders()
│   │   │   │   └── demoReset.ts    # nightly reset wrapper
│   │   │   ├── bot/
│   │   │   │   ├── index.ts        # createBot(): middleware order (§5.2)
│   │   │   │   ├── context.ts      # BotContext, ConvContext, BotConversation types
│   │   │   │   ├── i18n.ts         # I18n instance, locale negotiation, menuButton(key) filter
│   │   │   │   ├── callbacks.ts    # typed callback-data codec (≤ 64 bytes)
│   │   │   │   ├── commands.ts     # setMyCommands for en/ru + admin scopes
│   │   │   │   ├── middlewares/
│   │   │   │   │   ├── privateOnly.ts
│   │   │   │   │   ├── rateLimit.ts
│   │   │   │   │   ├── user.ts     # loads/upserts user → ctx.state.user/role
│   │   │   │   │   └── requireAdmin.ts
│   │   │   │   ├── keyboards/
│   │   │   │   │   ├── mainMenu.ts
│   │   │   │   │   ├── calendar.ts
│   │   │   │   │   ├── timeGrid.ts
│   │   │   │   │   └── common.ts   # back/cancel rows, pagination row
│   │   │   │   ├── views/
│   │   │   │   │   ├── bookingCard.ts   # client + admin cards
│   │   │   │   │   └── screen.ts        # Screen = { text, keyboard }; showScreen(ctx, screen) edit-or-reply
│   │   │   │   ├── handlers/
│   │   │   │   │   ├── start.ts    # /start, deep links, /help
│   │   │   │   │   ├── info.ts     # about, terms, support
│   │   │   │   │   ├── settings.ts
│   │   │   │   │   ├── booking.ts  # wizard bk:*
│   │   │   │   │   ├── reschedule.ts # rs:*
│   │   │   │   │   ├── myBookings.ts # my:*, hold:*
│   │   │   │   │   ├── payments.ts # pre_checkout_query, successful_payment
│   │   │   │   │   ├── chatMember.ts # my_chat_member → blocked flag
│   │   │   │   │   ├── ai.ts       # ask button, free-text fallback, ai:book
│   │   │   │   │   └── fallback.ts # unknown callbacks / commands
│   │   │   │   ├── admin/
│   │   │   │   │   ├── index.ts    # admin composer (guarded), home, /admin, /admin_demo
│   │   │   │   │   ├── schedule.ts # day view, day off toggles
│   │   │   │   │   ├── bookings.ts # admin booking card + actions, upcoming list
│   │   │   │   │   ├── services.ts
│   │   │   │   │   ├── masters.ts
│   │   │   │   │   ├── hours.ts
│   │   │   │   │   ├── broadcast.ts
│   │   │   │   │   ├── stats.ts
│   │   │   │   │   ├── export.ts
│   │   │   │   │   └── demo.ts     # restore demo catalog
│   │   │   │   └── conversations/
│   │   │   │       ├── index.ts    # registration list + CONVERSATION_VERSION
│   │   │   │       ├── serviceCreate.ts
│   │   │   │       ├── masterCreate.ts
│   │   │   │       ├── editText.ts # single text/number field edit (title, name, price)
│   │   │   │       ├── customHours.ts
│   │   │   │       └── broadcastCompose.ts
│   │   │   └── http/
│   │   │       ├── server.ts       # Hono app + serve(); /healthz
│   │   │       ├── initData.ts     # Phase 9: validateInitData()
│   │   │       ├── auth.ts         # Phase 9: tma auth middleware
│   │   │       ├── rateLimit.ts    # Phase 9: per-user fixed window
│   │   │       └── api.ts          # Phase 9: /api routes
│   │   ├── drizzle.config.ts
│   │   ├── tsdown.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json            # name @slotbot/bot
│   └── miniapp/                    # Phase 9 only
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx            # tma init, theme binding, QueryClientProvider
│       │   ├── App.tsx             # screen state machine + tabs
│       │   ├── tg.ts               # SDK mount helpers, MainButton/BackButton hooks
│       │   ├── api.ts              # fetch wrapper with `Authorization: tma <initData>`
│       │   ├── i18n.ts             # small EN/RU dictionary
│       │   ├── theme.css           # @import "tailwindcss" + @theme mapped to --tg-theme-*
│       │   ├── screens/{Services,Masters,DatePick,TimePick,Confirm,Done,MyBookings}.tsx
│       │   └── components/{ListItem,Spinner,ErrorState}.tsx
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json            # name @slotbot/miniapp
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── index.ts
│       │   ├── constants.ts        # LOCALES, BOOKING_STATUSES, DEPOSIT_PERCENTS, DEMO_SEED_ID_LIMIT
│       │   ├── money.ts            # formatMoney(minor, currency, locale), toMinor(), fromMinor()
│       │   └── api.ts              # Phase 9: zod DTO schemas shared by bot API and Mini App
│       ├── tsconfig.json
│       └── package.json            # name @slotbot/shared, exports "./src/index.ts"
├── deploy/
│   ├── Caddyfile.snippet           # site block to paste into the shared Caddy config
│   └── backup.sh                   # nightly pg_dump with rotation (host cron)
├── docs/
│   ├── SPEC.md
│   ├── ARCHITECTURE.md
│   ├── PLAN.md
│   └── media/                      # screenshots/GIFs for README (Phase 10)
├── .dockerignore
├── .editorconfig
├── .env.example
├── .gitignore
├── .nvmrc                          # 24
├── .prettierignore
├── .prettierrc.json
├── CLAUDE.md
├── Dockerfile
├── docker-compose.yml              # production: bot + postgres, joins external `proxy`
├── docker-compose.dev.yml          # local: postgres only, 127.0.0.1:5432
├── eslint.config.js
├── LICENSE                         # MIT
├── package.json                    # root scripts, packageManager pnpm@12.11.2
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
└── tsconfig.base.json
```

## 4. Module responsibilities and rules

| Layer | May import | Must not |
| --- | --- | --- |
| `bot/handlers`, `bot/admin` | services, views, keyboards, callbacks, i18n | touch `db` directly, contain business rules |
| `bot/conversations` | services via `conversation.external()` | return `Date`/class instances from `external` (JSON only) |
| `bot/views`, `bot/keyboards` | lib/format, callbacks, i18n types | perform IO |
| `services/*` | db, lib, config, other services | import grammY context types; they receive plain args. Exception: `notifications.ts` and `broadcast.ts` receive a `Api` instance |
| `jobs/*` | services | contain domain rules (call services) |
| `http/*` | services, shared DTOs | duplicate business rules from the bot |
| `lib/*` | config/env only | import services or db |

Key service signatures (full details per phase in PLAN.md):

```ts
// services/slots.ts
export interface BusyInterval { start: number; end: number } // epoch ms, half-open
export function generateDaySlots(input: {
  date: string;                 // salon-local yyyy-MM-dd
  window: { startMin: number; endMin: number } | null;
  durationMin: number;
  stepMin: number;
  busy: BusyInterval[];
  notBefore: Date;              // now + lead time
}): Date[];
export function getMonthAvailability(q: { serviceId: number; masterId: number | null; month: string /* yyyy-MM */; excludeBookingId?: number }): Promise<Set<string /* yyyy-MM-dd */>>;
export function getDaySlots(q: { serviceId: number; masterId: number | null; date: string; excludeBookingId?: number }): Promise<Array<{ startsAt: Date; masterIds: number[] }>>;
export function pickMaster(q: { serviceId: number; startsAt: Date; candidateIds: number[] }): Promise<number>;

// services/bookings.ts
export function createBooking(i: { userId: number; serviceId: number; masterId: number; startsAt: Date; source: "bot" | "miniapp" }): Promise<{ booking: Booking; replacedHold: boolean }>;
export function cancelByClient(i: { userId: number; bookingId: number }): Promise<{ booking: Booking; refundPending: boolean }>;
export function reschedule(i: { userId: number; bookingId: number; startsAt: Date }): Promise<Booking>;
export function cancelByAdmin(i: { actor: Viewer; bookingId: number }): Promise<{ booking: Booking; refundPending: boolean }>;
export function closeBooking(i: { actor: Viewer; bookingId: number; status: "completed" | "no_show" }): Promise<Booking>;
```

## 5. Runtime design

### 5.1 Startup and shutdown (`src/index.ts`)

1. `env` parsed (process exits with a readable list of invalid vars).
2. `runMigrations()` (drizzle migrator, folder `APP_ROOT/drizzle`).
3. If `DEMO_MODE` and `services` is empty → `resetDemo()`.
4. `createBot()`; `await bot.init()`; `setCommands(bot.api)`; if `MINIAPP_ENABLED`, `setChatMenuButton` to `PUBLIC_URL`.
5. `startHttp()` → `startJobs(bot.api)` → `run(bot, { runner: { fetch: { allowed_updates: ["message", "callback_query", "pre_checkout_query", "my_chat_member"] } } })`.
6. `SIGINT`/`SIGTERM` → `stopJobs()` → `await runner.stop()` (finishes in-flight updates) → `await http.close()` → `await closeDb()` → exit 0.
   Docker `stop_grace_period: 15s`.

### 5.2 Middleware order (`bot/index.ts`)

Order matters; keep it exactly:

1. `bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 30 }))`
2. `sequentialize(key)` — key = `chat.id` (or `from.id`); **`undefined` for `pre_checkout_query`** so it never waits behind a slow AI call (Telegram's 10 s deadline).
3. Update logger (debug: update type, user ID, duration).
4. `privateOnly` — ignore updates whose `ctx.chat` exists and is not private (do **not** use `bot.chatType("private")`: it would drop `pre_checkout_query`, which has no chat).
5. `rateLimit` — 4 updates / 2 s per user; skips `pre_checkout_query` and `successful_payment`.
6. `user` middleware — upsert user (throttled `last_seen_at` write ≤ 1/5 min), set `ctx.state.user`, `ctx.state.role`, update locale cache.
7. `i18n` (`bot.use(i18n)`).
8. Payment handlers (`pre_checkout_query`, `message:successful_payment`) — **before** conversations so an active text-input flow can't swallow them.
9. `my_chat_member` handler.
10. `conversations({ storage, plugins: [i18n] })`.
11. `/cancel` command + "✖ Cancel" reply button → `ctx.conversation.exitAll()` (must sit between `conversations()` and `createConversation()`).
12. `createConversation(...)` for each conversation in `conversations/index.ts`.
13. Feature composers: start/help, info, settings, booking, reschedule, myBookings, admin (guarded composer).
14. AI free-text fallback (`message:text` not starting with `/`).
15. `fallback` — unknown commands → help; unknown callbacks → `answerCallbackQuery(t("outdated"))`.
16. `bot.catch` — log + best-effort `error-generic` reply/answer.

### 5.3 Context types (`bot/context.ts`)

```ts
import type { Context } from "grammy";
import type { ConversationFlavor, Conversation } from "@grammyjs/conversations";
import type { I18nFlavor } from "@grammyjs/i18n";
import type { UserRow } from "../db/schema.js";

export type Role = "owner" | "demo" | null;
export interface StateFlavor { state: { user?: UserRow; role: Role } }
export type BaseContext = Context & I18nFlavor & StateFlavor;
export type BotContext = ConversationFlavor<BaseContext>;
export type ConvContext = Context & I18nFlavor;          // inside conversations only i18n is installed
export type BotConversation = Conversation<BotContext, ConvContext>;
```

Helpers: `getUser(ctx): UserRow` (throws if missing), `getRole(ctx): Role`.

### 5.4 Screens and callbacks

- A **Screen** is `{ text: string; keyboard: InlineKeyboard }`. `showScreen(ctx, screen)` edits the callback's message when the update is a
  callback query, otherwise replies; it swallows "message is not modified" and always answers the callback query.
- Callback data is produced only by `bot/callbacks.ts`: a discriminated union `Route` with `encode(route)` / `decode(data)`; segments joined
  by `:`; numeric IDs and **epoch minutes** (UTC) for times; dates as `yyyyMMdd`, months as `yyyyMM`. Every encoded string is asserted ≤ 64 bytes.
  Prefixes: `bk` booking wizard, `rs` reschedule, `my` my bookings, `hold` hold actions, `set` settings, `ai` AI shortcuts, `ad` admin, `noop`.
- Handlers re-validate everything (ownership, role, booking state, slot validity) because callback data can be forged by custom clients.

### 5.5 Booking concurrency guarantees

- **No double booking**: exclusion constraint `bookings_no_overlap` — GiST on `(master_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)`
  for statuses `pending_payment, confirmed, completed, no_show`. Any overlapping insert/update fails with SQLSTATE `23P01` →
  `DomainError("SLOT_TAKEN")`. Works for variable durations, reschedules (same row updated) and both entry points (bot, Mini App).
- **One unpaid hold per user**: partial unique index on `bookings(user_id) WHERE status = 'pending_payment'`. `createBooking` first releases the
  user's existing hold (reason `replaced`) inside the same transaction.
- **Hold vs payment race**: pre-checkout approval extends `hold_expires_at` by 5 min in the same `UPDATE … WHERE status='pending_payment' AND hold_expires_at > now()`.
  `successful_payment` confirms in a transaction; if the hold was already expired, a savepoint tries to revive it; on `23P01` the payment is `refund_pending`.
- **Idempotent payment**: `payments.telegram_charge_id` unique; `INSERT … ON CONFLICT DO NOTHING` decides whether this update was already processed.
- **Reminders**: claimed with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING`, sent after the claim; transient send failures
  reset the claim, permanent ones (403) mark the user blocked. At-most-once per reminder.

### 5.6 Time zones

- DB stores `timestamptz` (UTC). The process runs with `TZ=UTC` (Dockerfile) and never uses local server time.
- `lib/time.ts` is the only place converting: `SALON_TIMEZONE` (IANA, validated with `IANAZone.isValidZone`).
- Working hours are minutes from local midnight per ISO weekday (1 = Mon … 7 = Sun, same as Luxon `weekday`).
- Local → UTC: `DateTime.fromISO(date, { zone }).set({ hour, minute })`; if the resulting local minute-of-day differs from the requested one,
  the time doesn't exist (spring-forward gap) → skip the slot. Ambiguous fall-back times use Luxon's default (earlier offset).
- "Today", AI daily limits and stats periods are salon-local days.
- Display: `formatDateTime(date, locale)` → `Fri, Oct 16 · 2:30 PM` (en-US) / `пт, 16 окт. · 14:30` (ru), plus a zone label from `salon.tzLabel`.

## 6. Data model

Drizzle schema (`apps/bot/src/db/schema.ts`). Column names are explicit snake_case; TS keys camelCase. All timestamps `timestamptz`.

```ts
import { relations, sql } from "drizzle-orm";
import {
  bigint, boolean, char, check, date, index, integer, jsonb, pgEnum, pgTable,
  primaryKey, smallint, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => tstz("created_at").notNull().defaultNow();
const updatedAt = () => tstz("updated_at").notNull().defaultNow().$onUpdate(() => new Date());

export const localeEnum = pgEnum("locale", ["en", "ru"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending_payment", "confirmed", "cancelled", "completed", "no_show",
]);
export const cancelReasonEnum = pgEnum("cancel_reason", ["client", "admin", "payment_timeout", "replaced"]);
export const bookingSourceEnum = pgEnum("booking_source", ["bot", "miniapp", "seed"]);
export const paymentStatusEnum = pgEnum("payment_status", ["succeeded", "refund_pending", "refunded"]);
export const broadcastStatusEnum = pgEnum("broadcast_status", ["sending", "done", "failed"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(), // < 0 = seed client, never messaged
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  username: text("username"),
  languageCode: text("language_code"),
  locale: localeEnum("locale"),                       // null = auto from language_code
  phone: text("phone"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  demoAdminUntil: tstz("demo_admin_until"),
  lastSeenAt: tstz("last_seen_at").notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const masters = pgTable("masters", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity({ startWith: 1000 }), // seed rows use 1..999
  nameEn: text("name_en").notNull(),
  nameRu: text("name_ru"),
  bioEn: text("bio_en"),
  bioRu: text("bio_ru"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const services = pgTable(
  "services",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity({ startWith: 1000 }),
    titleEn: text("title_en").notNull(),
    titleRu: text("title_ru"),
    descriptionEn: text("description_en"),
    descriptionRu: text("description_ru"),
    durationMin: smallint("duration_min").notNull(),
    priceMinor: integer("price_minor").notNull(),
    prepayPercent: smallint("prepay_percent").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("services_duration_chk", sql`${t.durationMin} between 15 and 480`),
    check("services_price_chk", sql`${t.priceMinor} >= 0`),
    check("services_prepay_chk", sql`${t.prepayPercent} in (0, 30, 50, 100)`),
  ],
);

export const masterServices = pgTable(
  "master_services",
  {
    masterId: integer("master_id").notNull().references(() => masters.id, { onDelete: "cascade" }),
    serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.masterId, t.serviceId] }), index("master_services_service_idx").on(t.serviceId)],
);

export const workingHours = pgTable(
  "working_hours",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    masterId: integer("master_id").notNull().references(() => masters.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),   // ISO 1 = Mon … 7 = Sun; no row = day off
    startMin: smallint("start_min").notNull(), // minutes from local midnight
    endMin: smallint("end_min").notNull(),
  },
  (t) => [
    uniqueIndex("working_hours_master_weekday_uq").on(t.masterId, t.weekday),
    check("working_hours_weekday_chk", sql`${t.weekday} between 1 and 7`),
    check("working_hours_range_chk", sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.startMin} < ${t.endMin}`),
  ],
);

export const timeOff = pgTable(
  "time_off",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    masterId: integer("master_id").notNull().references(() => masters.id, { onDelete: "cascade" }),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("time_off_master_starts_idx").on(t.masterId, t.startsAt),
    check("time_off_range_chk", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    masterId: integer("master_id").notNull().references(() => masters.id, { onDelete: "restrict" }),
    serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    status: bookingStatusEnum("status").notNull(),
    source: bookingSourceEnum("source").notNull().default("bot"),
    clientName: text("client_name").notNull(),          // snapshot at booking time
    priceMinor: integer("price_minor").notNull(),        // snapshot
    prepayMinor: integer("prepay_minor").notNull().default(0), // snapshot; 0 = no deposit
    currency: char("currency", { length: 3 }).notNull(),
    holdExpiresAt: tstz("hold_expires_at"),              // set iff status = pending_payment
    invoiceMessageId: integer("invoice_message_id"),
    slotAssignedAt: tstz("slot_assigned_at").notNull().defaultNow(), // reset on reschedule; reminder eligibility
    rescheduleCount: smallint("reschedule_count").notNull().default(0),
    reminder24hSentAt: tstz("reminder_24h_sent_at"),
    reminder2hSentAt: tstz("reminder_2h_sent_at"),
    confirmedAt: tstz("confirmed_at"),
    cancelledAt: tstz("cancelled_at"),
    cancelReason: cancelReasonEnum("cancel_reason"),
    closedAt: tstz("closed_at"),                         // completed / no_show marked
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("bookings_range_chk", sql`${t.startsAt} < ${t.endsAt}`),
    check("bookings_prepay_chk", sql`${t.prepayMinor} between 0 and ${t.priceMinor}`),
    check("bookings_hold_chk", sql`(${t.status} = 'pending_payment') = (${t.holdExpiresAt} is not null)`),
    index("bookings_master_starts_idx").on(t.masterId, t.startsAt),
    index("bookings_user_starts_idx").on(t.userId, t.startsAt),
    index("bookings_starts_idx").on(t.startsAt),
    index("bookings_hold_idx").on(t.holdExpiresAt).where(sql`${t.status} = 'pending_payment'`),
    uniqueIndex("bookings_one_hold_per_user_uq").on(t.userId).where(sql`${t.status} = 'pending_payment'`),
  ],
);

export const payments = pgTable("payments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bookingId: integer("booking_id").notNull().unique().references(() => bookings.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amountMinor: integer("amount_minor").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  status: paymentStatusEnum("status").notNull().default("succeeded"),
  telegramChargeId: text("telegram_charge_id").notNull().unique(),
  providerChargeId: text("provider_charge_id").notNull(),
  refundedAt: tstz("refunded_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    day: date("day", { mode: "string" }).notNull(),     // salon-local yyyy-MM-dd
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicroUsd: integer("cost_micro_usd").notNull().default(0),
    ok: boolean("ok").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ai_usage_day_user_idx").on(t.day, t.userId)],
);

export const broadcasts = pgTable("broadcasts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isSandbox: boolean("is_sandbox").notNull(),
  status: broadcastStatusEnum("status").notNull().default("sending"),
  recipientsTotal: integer("recipients_total").notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: createdAt(),
  finishedAt: tstz("finished_at"),
});

// Conversation state (prefix "conv:") and small app state (prefix "app:", e.g. app:demo:lastRestoreAt)
export const botKv = pgTable("bot_kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const usersRelations = relations(users, ({ many }) => ({ bookings: many(bookings) }));
export const mastersRelations = relations(masters, ({ many }) => ({
  masterServices: many(masterServices), workingHours: many(workingHours), bookings: many(bookings),
}));
export const servicesRelations = relations(services, ({ many }) => ({ masterServices: many(masterServices), bookings: many(bookings) }));
export const masterServicesRelations = relations(masterServices, ({ one }) => ({
  master: one(masters, { fields: [masterServices.masterId], references: [masters.id] }),
  service: one(services, { fields: [masterServices.serviceId], references: [services.id] }),
}));
export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  master: one(masters, { fields: [workingHours.masterId], references: [masters.id] }),
}));
export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  master: one(masters, { fields: [bookings.masterId], references: [masters.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  payment: one(payments),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Master = typeof masters.$inferSelect;
```

Hand-written migration (generated with `pnpm db:generate:custom --name=booking_exclusion`, applied right after the initial one).
drizzle-kit doesn't model exclusion constraints, so it will never try to drop it:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("master_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('pending_payment', 'confirmed', 'completed', 'no_show'));
```

Relations summary: `users 1—n bookings`, `masters n—m services` (via `master_services`), `masters 1—n working_hours`, `masters 1—n time_off`,
`bookings n—1 masters/services/users`, `bookings 1—0..1 payments`, `users 1—n ai_usage`, `users 1—n broadcasts`.
Seed rows: services/masters with IDs < 1000 (`DEMO_SEED_ID_LIMIT = 1000`), users with `telegram_id < 0`.

## 7. Jobs

| Job | Schedule | Work | Idempotency |
| --- | --- | --- | --- |
| `tick` | `*/30 * * * * *`, `protect: true` | `expireHolds()` then `sendDueReminders()` | holds: status transition in one `UPDATE … RETURNING`; reminders: SKIP LOCKED claim |
| `demo-reset` | `DEMO_RESET_CRON` (default `0 0 4 * * *`) in `SALON_TIMEZONE`, only if `DEMO_MODE` | `resetDemo()` in one transaction | full rewrite of demo state; safe to rerun |

Jobs receive `bot.api`, never a context. Locale for job messages = recipient's resolved locale; translate with `i18n.t(locale, key, vars)`.
Croner runs in-process; there is exactly one instance (long polling forbids more), but SQL claims stay safe even if a second instance appeared.

## 8. External integrations

### 8.1 Telegram Bot API (via grammY)

Used methods: `getUpdates` (runner), `sendMessage`, `editMessageText`, `editMessageReplyMarkup`, `deleteMessage`, `answerCallbackQuery`,
`sendChatAction`, `sendDocument` (xlsx), `sendInvoice`, `answerPreCheckoutQuery`, `setMyCommands`, `setChatMenuButton` and
`createInvoiceLink` (Phase 9). Messages use `parse_mode: "HTML"`; dynamic values escaped. Inline buttons use `style` (`success`/`danger`/`primary`),
unavailable calendar days use `InlineKeyboard#disabled(text)`, the test card uses a `copy_text` button.

### 8.2 Telegram Payments + Stripe TEST

Telegram policy (checked 2026-10-15): digital goods/services must be sold for Telegram Stars (`XTR`); **physical goods and services may use
third-party providers**. A barbershop visit is a physical service → Stripe via Telegram Payments is allowed. Test mode: BotFather →
Bot Settings → Payments → "Stripe TEST MODE" → token containing `:TEST:`; test card `4242 4242 4242 4242`.
Telegram's live checklist requires `/terms` and `/support` — both implemented even in test mode.

Flow: `sendInvoice(chat, title, description, payload = "bk:<bookingId>", currency, [{ label, amount: prepayMinor }], { provider_token, start_parameter: "pay-<id>", protect_content: true })`
→ `pre_checkout_query` (answer within 10 s) → `message:successful_payment` (store `telegram_payment_charge_id`, `provider_payment_charge_id`).
Amounts are integers in minor units; USD minimum is $1.00 (Telegram currency table). Refunds: only Stars can be refunded via Bot API, so card
refunds are manual in the Stripe dashboard → status `refund_pending` → admin "Mark refunded".

### 8.3 OpenAI

`client.responses.parse({ model, instructions, input, max_output_tokens, reasoning: { effort }, text: { format: zodTextFormat(AnswerSchema, "salon_answer") }, prompt_cache_key, safety_identifier, store: false })`.
Client options: `timeout: 15_000`, `maxRetries: 1`. Structured output `{ answer: string, intent: "faq" | "booking" | "off_topic", serviceId: number | null }`.
Static knowledge goes first in `instructions` (prompt caching), the user question is `input`. `safety_identifier` = SHA-256 of the Telegram ID.
Cost per call = `(input − cached) × in + cached × cachedIn + output × out` using `AI_PRICE_*` env (USD per 1M tokens) → stored in micro-USD.
Provider interface lets another vendor be plugged in without touching the bot.

### 8.4 Telegram Mini App (Phase 9)

Served from the bot's Hono server at `PUBLIC_URL` (same origin as `/api`, no CORS). Auth header `Authorization: tma <initDataRaw>`; server
validates HMAC-SHA256 with key `HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN)` over the data-check-string (all fields except `hash`, sorted
by key, `key=value` joined by `\n`), timing-safe compare, `auth_date` ≤ `INITDATA_MAX_AGE_SECONDS`. Payments in the Mini App use
`createInvoiceLink` + `invoice.openUrl(link)`; the same `pre_checkout_query`/`successful_payment` handlers confirm the booking.
Since Bot API 10.2 Mini App methods are blocked from foreign origins — the app must be served from the domain registered in BotFather.

## 9. Configuration

### 9.1 Environment variables (`apps/bot/src/config/env.ts`, mirrored in `.env.example`)

Booleans via `z.stringbool()`, numbers via `z.coerce.number()`. One `.env` at the repo root, read by dev scripts (`--env-file-if-exists`) and by Compose.

| Name | Required | Example | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `production` | `development` enables pino-pretty |
| `LOG_LEVEL` | no | `info` | pino level |
| `APP_ROOT` | no | `/app/apps/bot` | Base for locales/drizzle/content paths; default `process.cwd()` |
| `BOT_TOKEN` | **yes** | `7012345678:AA…` | BotFather token |
| `DATABASE_URL` | **yes** | `postgres://slotbot:slotbot@localhost:5432/slotbot` | Overridden in prod Compose to host `postgres` |
| `ADMIN_IDS` | no | `494979019` | Comma-separated owner admin Telegram IDs |
| `NOTIFY_ADMINS` | no | `true` | Send booking events to owner admins |
| `DEMO_MODE` | no | `true` | Enables `/admin_demo`, sandbox, masking, nightly reset (default `false`) |
| `DEMO_ADMIN_MINUTES` | no | `30` | Demo admin session length |
| `DEMO_RESET_CRON` | no | `0 0 4 * * *` | Croner pattern (with seconds) in salon TZ |
| `DEMO_RESTORE_COOLDOWN_MINUTES` | no | `10` | Global cooldown for "Restore demo" |
| `SALON_TIMEZONE` | no | `America/New_York` | IANA zone, validated |
| `CURRENCY` | no | `USD` | ISO 4217 supported by Telegram + Stripe |
| `PAYMENTS_ENABLED` | no | `true` | Global deposit switch (default `false`); `false` → deposit services confirm without payment |
| `PAYMENT_PROVIDER_TOKEN` | if payments on | `284685063:TEST:Yz…` | Must contain `:TEST:` — startup fails otherwise |
| `HOLD_MINUTES` | no | `15` | Unpaid hold length |
| `CHANGE_CUTOFF_HOURS` | no | `2` | Cancel/reschedule cutoff |
| `MIN_LEAD_MINUTES` | no | `60` | Earliest bookable start from now |
| `BOOKING_HORIZON_DAYS` | no | `30` | Latest bookable day |
| `SLOT_STEP_MINUTES` | no | `15` | Start-time grid |
| `MAX_ACTIVE_BOOKINGS_PER_USER` | no | `3` | Upcoming confirmed + pending |
| `MAX_RESCHEDULES` | no | `2` | Per booking |
| `OPENAI_API_KEY` | no | `sk-proj-…` | Empty → AI disabled |
| `AI_MODEL` | no | `gpt-6-luna` | Any Responses-API model with structured outputs |
| `AI_REASONING_EFFORT` | no | `none` | `none`/`minimal`/`low`/`medium` |
| `AI_MAX_OUTPUT_TOKENS` | no | `400` | Hard cap per answer |
| `AI_PRICE_INPUT_PER_1M_USD` | no | `0.10` | For cost accounting |
| `AI_PRICE_CACHED_INPUT_PER_1M_USD` | no | `0.01` | |
| `AI_PRICE_OUTPUT_PER_1M_USD` | no | `0.50` | |
| `AI_USER_DAILY_LIMIT` | no | `10` | Questions per user per salon-local day |
| `AI_GLOBAL_DAILY_REQUESTS` | no | `500` | All users |
| `AI_GLOBAL_DAILY_BUDGET_USD` | no | `1.00` | Estimated spend cap |
| `HTTP_PORT` | no | `3000` | Hono port |
| `PUBLIC_URL` | no | `https://slotbot.example.com` | Mini App URL / menu button |
| `MINIAPP_ENABLED` | no | `false` | Serves Mini App + `/api`, sets menu button |
| `INITDATA_MAX_AGE_SECONDS` | no | `86400` | initData freshness |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose only | `slotbot` / `<random 32 alnum>` / `slotbot` | Used by `docker-compose*.yml` (password URL-safe) |

### 9.2 Salon content

- `src/config/salon.ts` — typed constant: `name`, `address`, `phone`, `mapsUrl`, `supportTelegram`, `hoursText: { en, ru }`, `tzLabel: { en, ru }`
  (e.g. "New York time" / "время Нью-Йорка"). Changing the business = editing this file + seed data in `services/demo.ts`.
- `content/knowledge.md` — free-text FAQ (parking, payment methods at the salon, kids policy, walk-ins, products used, accessibility). EN only;
  the model answers in the user's language.

## 10. Error handling and logging

- `DomainError(code, meta?)` with codes: `SLOT_TAKEN`, `SLOT_TOO_SOON`, `SLOT_INVALID`, `INACTIVE`, `LIMIT_ACTIVE`, `CUTOFF`, `RESCHEDULE_LIMIT`,
  `NOT_FOUND`, `FORBIDDEN`, `SANDBOX_DENIED`, `PROTECTED_ITEM`, `HOLD_EXPIRED`, `COOLDOWN`, `AI_DISABLED`, `AI_LIMIT_USER`, `AI_LIMIT_GLOBAL`.
  Handlers catch and render `error-<code-in-kebab>` keys (toast via `answerCallbackQuery({ show_alert: true })` for callbacks, message otherwise).
- Postgres errors: Drizzle 0.45 wraps driver errors in `DrizzleQueryError` (`.cause` = postgres.js error with `.code`).
  `pgErrorCode(err)` unwraps; `23P01` → `SLOT_TAKEN`, `23505` on `bookings_one_hold_per_user_uq` → retry once after releasing the hold.
- Telegram errors (`GrammyError`): 400 "message is not modified" → ignore; 400 "query is too old" → ignore; 403 → `markBlocked(user)`;
  429 handled by auto-retry. Never let a reminder/broadcast loop die on one recipient.
- `bot.catch`: log `{ err, updateId, userId, updateType }` at `error`, reply `error-generic` best-effort. No stack traces to users.
- Logger: `pino({ level, base: { service: "slotbot" }, redact: { paths: ["*.token", "*.providerToken", "*.phone", "*.initData", "*.authorization"], censor: "[redacted]" } })`,
  `pino-pretty` transport only when `NODE_ENV=development`. Child loggers per module: `logger.child({ module: "reminders" })`.
- Jobs log a summary line per run only when work was done (`{ expired: 2 }`, `{ reminders24h: 1 }`).

## 11. Security considerations

- **Secrets**: only via env; `.env` gitignored; `.env.example` has placeholders. LIVE payment tokens are rejected at startup.
- **Authorization**: role computed per update from DB + `ADMIN_IDS`; admin composer guarded; every admin callback re-checks role and sandbox
  rules in the service layer (`actor: Viewer` argument), not only in the UI. Ownership checks for every client booking action.
- **Forged input**: callback data, initData and API bodies are untrusted — decode/validate with the codec/zod, then authorize.
- **Payments**: amount/currency/owner re-checked in pre-checkout; idempotent processing; no card data ever touches the bot.
- **PII**: name, username, optional phone only. Masked for demo admins (bot, stats, export). Logs redact phone/tokens. "Delete my data" (Could) anonymizes.
- **Abuse**: rate limit middleware, booking limits, single hold, AI per-user/global caps and input truncation, broadcast sandbox, admin inputs length-limited,
  group chats ignored.
- **HTML injection**: every interpolated value in HTML messages goes through `escapeHtml`; broadcast text is sent without `parse_mode`.
- **Mini App API**: HMAC initData, max age, per-user rate limit (60 req/min), zod-validated bodies, same service-layer rules; static files only from `apps/miniapp/dist`.
- **Infrastructure**: Postgres not published in prod Compose; container runs as `node` user; only Caddy exposes 80/443; dependency build scripts
  blocked by default (pnpm `allowBuilds` allow-list).
- **AI**: `store: false`, hashed `safety_identifier`, no other users' data in prompts, system prompt instructs to ignore instructions inside the question.

## 12. Deployment

### 12.1 Topology

- Hetzner VPS (Ubuntu), Docker Engine + Compose plugin. Shared Caddy stack (already exists) on external network `proxy`.
- Project directory `/opt/slotbot` (git clone) with `.env`. Compose project name `slotbot`.
- DNS: `A slotbot.<domain> → VPS IP`. Caddy site `slotbot.<domain>` → `slotbot:3000` (network alias of the bot container).
  The bot itself uses long polling — HTTPS is only needed for `/healthz` monitoring and the Mini App.

### 12.2 Dockerfile (outline)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-slim AS base
ENV TZ=UTC
RUN npm install -g pnpm@12.11.2
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm pnpm fetch --store-dir /var/cache/pnpm
COPY . .
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --offline --frozen-lockfile --store-dir /var/cache/pnpm
RUN pnpm -r --if-present build          # bot (tsdown) and, once it exists, miniapp (vite)
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --offline --frozen-lockfile --prod --filter @slotbot/bot --store-dir /var/cache/pnpm

FROM node:24-slim AS runtime
ENV NODE_ENV=production TZ=UTC APP_ROOT=/app/apps/bot
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=build /app/apps/bot/package.json ./apps/bot/package.json
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
COPY --from=build /app/apps/bot/drizzle ./apps/bot/drizzle
COPY --from=build /app/apps/bot/locales ./apps/bot/locales
COPY --from=build /app/apps/bot/content ./apps/bot/content
# Phase 9: COPY --from=build /app/apps/miniapp/dist ./apps/miniapp/dist
USER node
WORKDIR /app/apps/bot
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/index.js"]
```

`.dockerignore`: `**/node_modules`, `**/dist`, `.git`, `.github`, `.env`, `.env.*`, `docs`, `*.log`.

### 12.3 Compose

`docker-compose.yml` (production):

```yaml
name: slotbot
services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    depends_on:
      postgres: { condition: service_healthy }
    networks:
      default: {}
      proxy: { aliases: [slotbot] }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    stop_grace_period: 15s
    logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }
  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql        # PG 18+: not /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
volumes:
  pgdata: {}
networks:
  proxy: { external: true }
```

`docker-compose.dev.yml`: only `postgres` (same image/healthcheck), `ports: ["127.0.0.1:5432:5432"]`, volume `pgdata-dev`, credentials from `.env`.

`deploy/Caddyfile.snippet`:

```caddyfile
slotbot.<domain> {
	encode zstd gzip
	reverse_proxy slotbot:3000
}
```

### 12.4 CI/CD

- `ci.yml` (push to `main`, PRs): checkout v7 → `pnpm/action-setup@v6` (reads `packageManager`) → `actions/setup-node@v7` (`node-version-file: .nvmrc`, `cache: pnpm`)
  → `pnpm install --frozen-lockfile` → `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm build` → `pnpm db:check` (env `DATABASE_URL` dummy).
- `deploy.yml` (on successful CI for `main` via `workflow_run`, or manual `workflow_dispatch`; `concurrency: deploy-prod`): `appleboy/ssh-action@v1.2.5`
  with secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, script:
  `cd /opt/slotbot && git fetch --prune && git reset --hard origin/main && docker compose up -d --build && docker image prune -f`.
  Migrations run automatically on bot startup.
- Backups: `deploy/backup.sh` via host cron `15 3 * * *` → `docker compose exec -T postgres pg_dump -U slotbot -Fc slotbot > /var/backups/slotbot/$(date +%F).dump`, keep 14.

## 13. Scripts

Root `package.json`:

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `pnpm --filter @slotbot/bot dev` | Bot with watch |
| `start` | `pnpm --filter @slotbot/bot start` | Run built bot |
| `build` | `pnpm -r --if-present build` | Build all packages |
| `typecheck` | `pnpm -r --if-present typecheck` | `tsc --noEmit` everywhere |
| `lint` / `lint:fix` | `eslint .` / `eslint . --fix` | Lint |
| `format` / `format:check` | `prettier --write .` / `prettier --check .` | Format |
| `db:up` / `db:down` | `docker compose -f docker-compose.dev.yml up -d` / `… down` | Local Postgres |
| `db:generate` | `pnpm --filter @slotbot/bot db:generate` | SQL migration from schema diff |
| `db:generate:custom` | `pnpm --filter @slotbot/bot db:generate:custom` | Empty migration for hand-written SQL (pass `--name=…`) |
| `db:migrate` | `pnpm --filter @slotbot/bot db:migrate` | Apply migrations (runtime migrator) |
| `db:seed` | `pnpm --filter @slotbot/bot db:seed` | Full demo reset (same as nightly) |
| `db:studio` | `pnpm --filter @slotbot/bot db:studio` | Drizzle Studio |
| `db:check` | `pnpm --filter @slotbot/bot db:check` | Migration consistency (CI) |
| `miniapp:dev` | `pnpm --filter @slotbot/miniapp dev` | Phase 9 |

`apps/bot/package.json`:

| Script | Command |
| --- | --- |
| `dev` | `tsx watch --env-file-if-exists=../../.env src/index.ts` |
| `build` | `tsdown` |
| `start` | `node --enable-source-maps dist/index.js` |
| `typecheck` | `tsc --noEmit` |
| `db:generate` | `drizzle-kit generate` |
| `db:generate:custom` | `drizzle-kit generate --custom` |
| `db:migrate` | `tsx --env-file-if-exists=../../.env src/cli.ts migrate` |
| `db:seed` | `tsx --env-file-if-exists=../../.env src/cli.ts seed` |
| `db:studio` | `drizzle-kit studio` |
| `db:check` | `drizzle-kit check` |

Production one-offs: `docker compose exec bot node dist/cli.js seed` (manual demo reset), `docker compose logs -f bot`.
