import type { Bot } from "grammy";
import { i18n } from "./i18n.ts";
import type { BotContext } from "./context.ts";
import { env } from "../config/env.ts";

const PUBLIC = [
  "start",
  "book",
  "my",
  "ask",
  "about",
  "settings",
  "help",
  "terms",
  "support",
  "cancel",
] as const;

export async function setCommands(api: Bot<BotContext>["api"]): Promise<void> {
  for (const locale of ["en", "ru"] as const) {
    const cmds = PUBLIC.map((command) => ({
      command,
      description: i18n.t(locale, `cmd-${command === "cancel" ? "cancel" : command}`),
    }));
    await api.setMyCommands(cmds, {
      language_code: locale,
      scope: { type: "all_private_chats" },
    });
  }

  const adminCmds = [
    ...PUBLIC.map((command) => ({
      command,
      description: i18n.t("en", `cmd-${command}`),
    })),
    { command: "admin", description: i18n.t("en", "cmd-admin") },
    ...(env.DEMO_MODE
      ? [{ command: "admin_demo", description: i18n.t("en", "cmd-admin-demo") }]
      : []),
  ];
  for (const id of env.adminIds) {
    await api.setMyCommands(adminCmds, { scope: { type: "chat", chat_id: id } });
  }
}
