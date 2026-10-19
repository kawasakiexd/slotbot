import { logger } from "../logger.ts";
import { resetDemo } from "../services/demo.ts";

const log = logger.child({ module: "demo-reset" });

export async function resetDemoJob(): Promise<void> {
  try {
    await resetDemo();
    log.info("nightly reset done");
  } catch (err) {
    log.error({ err }, "nightly reset failed");
  }
}
