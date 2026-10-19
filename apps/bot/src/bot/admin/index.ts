import { Composer, InlineKeyboard } from "grammy";
import { env } from "../../config/env.ts";
import { salon } from "../../config/salon.ts";
import { todayCounts } from "../../services/bookings.ts";
import { grantDemoAdmin, demoMinutesLeft, getRole } from "../../services/roles.ts";
import { getUser, type BotContext } from "../context.ts";
import { cb, decode } from "../callbacks.ts";
import { requireAdmin } from "../middlewares/requireAdmin.ts";
import { showScreen, toast } from "../views/screen.ts";
import { localDay, localMonth } from "../../lib/time.ts";
import { registerAdminSchedule } from "./schedule.ts";
import { registerAdminBookings } from "./bookings.ts";
import { registerAdminServices } from "./services.ts";
import { registerAdminMasters } from "./masters.ts";
import { registerAdminHours } from "./hours.ts";
import { registerAdminStats } from "./stats.ts";
import { registerAdminExport } from "./export.ts";
import { registerAdminDemo } from "./demo.ts";

export function adminComposer(): Composer<BotContext> {
  const root = new Composer<BotContext>();

  root.command("admin", async (ctx) => {
    await showAdminHome(ctx);
  });
  root.command("admin_demo", async (ctx) => {
    const user = getUser(ctx);
    if (!env.DEMO_MODE) {
      await ctx.reply(ctx.t("demo-admin-disabled"));
      return;
    }
    if (getRole(user) === "owner") {
      await showAdminHome(ctx);
      return;
    }
    const { granted, until } = await grantDemoAdmin(user);
    ctx.state.user = { ...user, demoAdminUntil: until };
    ctx.state.role = getRole(ctx.state.user);
    if (granted) {
      await ctx.reply(ctx.t("admin-demo-granted", { minutes: env.DEMO_ADMIN_MINUTES }));
    }
    await showAdminHome(ctx);
  });

  const guarded = new Composer<BotContext>();
  guarded.use(requireAdmin);
  guarded.on("callback_query:data", async (ctx, next) => {
    const route = decode(ctx.callbackQuery.data);
    if (route?.t === "ad.h") {
      await showAdminHome(ctx);
      return;
    }
    if (route?.t === "ad.bc") {
      await ctx.conversation.enter("broadcastCompose");
      await ctx.answerCallbackQuery();
      return;
    }
    return next();
  });
  registerAdminSchedule(guarded);
  registerAdminBookings(guarded);
  registerAdminServices(guarded);
  registerAdminMasters(guarded);
  registerAdminHours(guarded);
  registerAdminStats(guarded);
  registerAdminExport(guarded);
  registerAdminDemo(guarded);

  root
    .on("callback_query:data")
    .filter((ctx) => ctx.callbackQuery.data.startsWith("ad:"))
    .use(guarded);
  return root;
}

export async function showAdminHome(ctx: BotContext): Promise<void> {
  const user = getUser(ctx);
  if (!ctx.state.role) {
    await toast(ctx, ctx.t(user.demoAdminUntil ? "admin-demo-expired" : "admin-only"));
    return;
  }
  const counts = await todayCounts();
  let text = ctx.t("admin-home", {
    salon: salon.name,
    todayCount: counts.todayCount,
    pending: counts.pending,
  });
  if (ctx.state.role === "demo") {
    text += `\n${ctx.t("admin-demo-banner", { minutes: demoMinutesLeft(user) })}`;
  }
  const kb = new InlineKeyboard()
    .text(ctx.t("admin-today"), cb({ t: "ad.d", d: localDay(new Date()) }))
    .text(ctx.t("admin-pick-day"), cb({ t: "ad.c", ym: localMonth(new Date()) }))
    .row()
    .text(ctx.t("admin-upcoming"), cb({ t: "ad.up", p: 0 }))
    .text(ctx.t("admin-stats"), cb({ t: "ad.st", per: "7" }))
    .row()
    .text(ctx.t("admin-services"), cb({ t: "ad.svc" }))
    .text(ctx.t("admin-masters"), cb({ t: "ad.mst" }))
    .row()
    .text(ctx.t("admin-hours"), cb({ t: "ad.hrs" }))
    .text(ctx.t("admin-broadcast"), cb({ t: "ad.bc" }))
    .row()
    .text(ctx.t("admin-export"), cb({ t: "ad.ex", per: "7" }));
  if (env.DEMO_MODE) kb.text(ctx.t("admin-restore"), cb({ t: "ad.rs" }));
  await showScreen(ctx, { text, keyboard: kb });
}
