import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: "esm",
  platform: "node",
  sourcemap: true,
  clean: true,
  hash: false,
  fixedExtension: false,
  outExtensions: () => ({ js: ".js" }),
  deps: {
    alwaysBundle: ["@slotbot/shared"],
  },
});
