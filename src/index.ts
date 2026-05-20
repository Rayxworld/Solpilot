import { createBot } from "./bot/bot";
import { validateConfig } from "./config/env";
import { runTriggerSlTpEvaluation } from "./trading/paperTrading";
import { brand } from "./branding";
import { logger } from "./utils/logger";

// 1. Validate environment configuration
validateConfig();

// Read active process type from environment
const WORKER_TYPE = process.env.WORKER_TYPE;

/**
 * Bootstraps specific workers or all workers depending on configuration
 */
async function bootstrap() {
  logger.info(`Starting SolPilot process. Worker Role: ${WORKER_TYPE || "ALL-IN-ONE (Development)"}`);

  if (!WORKER_TYPE || WORKER_TYPE === "web") {
    // Start Express dashboard and metrics server to satisfy Render port binding
    await import("./server");
  }

  if (!WORKER_TYPE || WORKER_TYPE === "bot") {
    // 2. Instantiate and launch the Telegram bot
    const bot = createBot();
    await bot.launch();
    logger.info(`${brand.name} bot is running in long-polling mode. Ready at t.me/solpilotai_bot`);

    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  }

  if (!WORKER_TYPE || WORKER_TYPE === "market") {
    // Load market worker
    await import("./workers/marketWorker");
    logger.info("Market Scanner Worker activated successfully.");
  }

  if (!WORKER_TYPE || WORKER_TYPE === "ai") {
    // Load AI worker
    await import("./workers/aiWorker");
    logger.info("AI Analysis Worker activated successfully.");
  }

  if (!WORKER_TYPE || WORKER_TYPE === "notification") {
    // Load notification worker
    await import("./workers/notificationWorker");
    logger.info("Notification Outbound Worker activated successfully.");
  }

  if (!WORKER_TYPE || WORKER_TYPE === "trade") {
    // Load trade worker
    await import("./workers/tradeWorker");
    logger.info("Trade Engine Worker active.");

    // Simulated order book engine: poll for SL/TP breaches every 30 seconds
    const SL_TP_POLL_INTERVAL_MS = 30 * 1000;
    const intervalId = setInterval(async () => {
      logger.debug("Running background Stop-Loss / Take-Profit trigger checks...");
      const closedCount = await runTriggerSlTpEvaluation();
      if (closedCount > 0) {
        logger.info(`Simulated order engine auto-closed ${closedCount} breached paper positions.`);
      }
    }, SL_TP_POLL_INTERVAL_MS);

    process.once("SIGINT", () => clearInterval(intervalId));
    process.once("SIGTERM", () => clearInterval(intervalId));
  }
}

bootstrap().catch((err) => {
  logger.error("Failed to start SolPilot worker:", err);
  process.exit(1);
});
