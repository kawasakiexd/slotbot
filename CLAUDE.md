# slotbot

Telegram booking bot for a demo barbershop. One Node process: grammY (long polling) + croner jobs + Hono HTTP. PostgreSQL via Drizzle. Public portfolio demo for foreign Fiverr/Upwork clients.

Implement **[docs/PLAN.md](docs/PLAN.md) phase by phase**. Tick each `- [ ]` when done. Run that phase's **Verification** before starting the next. Product: [docs/SPEC.md](docs/SPEC.md). How: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). If they conflict, SPEC wins for behaviour, ARCHITECTURE for files/stack.

## Commands

```
pnpm install
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev                 # bot + healthz
pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
pnpm db:studio
```

Node 24 LTS. pnpm 12.11.2 (`packageManager` in root `package.json`). `TZ=UTC` in the container.

## Conventions

- Handlers → services → db. No SQL in handlers.
- User-facing strings only in `apps/bot/locales/{en,ru}.ftl` (Mini App: its own dictionary).
- Times: store UTC, convert only in `lib/time.ts` with `SALON_TIMEZONE`.
- Callback data only via `bot/callbacks.ts` (`encode`/`decode`, ≤ 64 bytes).
- Payments: Stripe TEST only (`:TEST:` in the provider token). Physical service → third-party provider is allowed.
- Demo seed IDs: services/masters `< 1000`; seed clients `telegram_id < 0` (never message them).

## Do not

- Do not write tests unless the owner explicitly asks.
- Code comments in English only, and only when they explain a constraint the code cannot show.
- Do not commit `.env` or secrets. Keep `.env.example` up to date.
- Do not add dependencies not listed in docs/ARCHITECTURE.md without a PLAN.md Decisions log entry.
- Never add Co-authored-by / "Made with Cursor" or similar AI trailers to commits.
- Do not use LIVE payment tokens or Telegram Stars.
- Do not use `bot.chatType("private")` (it drops `pre_checkout_query`).
