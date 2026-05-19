import { Worker, Job } from "bullmq";
import { Telegraf } from "telegraf";
import { config } from "../config/env";
import { redisConnection } from "../services/queueService";
import { brand } from "../branding";
import { logger } from "../utils/logger";

interface NotificationJobData {
  userId: string;
  messageType: string;
  payload: any;
}

// Bot instance specifically for pushing outbound notifications
const notificationBot = new Telegraf(config.botToken);

/**
 * Notification Worker: Processes and pushes async messages/alerts to Telegram chat IDs
 */
export const notificationWorker = new Worker(
  "notification-queue",
  async (job: Job<NotificationJobData>) => {
    const { userId, messageType, payload } = job.data;
    logger.info(`Notification Worker: Delivering message of type "${messageType}" to user ${userId} (Job #${job.id})`);

    try {
      if (messageType === "SIGNAL_RESULT") {
        const { symbol, pair, risk, aiCommentary } = payload;
        
        const priceUsd = pair?.priceUsd ? `$${parseFloat(pair.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "N/A";
        const change24h = pair?.priceChange?.h24 !== undefined ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";
        const liquidity = pair?.liquidity?.usd ? `$${Math.round(pair.liquidity.usd).toLocaleString()}` : "N/A";
        const volume = pair?.volume?.h24 ? `$${Math.round(pair.volume.h24).toLocaleString()}` : "N/A";

        const replyMsg = 
          `*${pair?.baseToken?.symbol?.toUpperCase() || symbol.toUpperCase()} / ${pair?.quoteToken?.symbol?.toUpperCase() || "SOL"} Signal* 📈\n\n` +
          `*Live Pricing Metrics (DEX: ${pair?.dexId?.toUpperCase() || "N/A"}):*\n` +
          `- Price: *${priceUsd}*\n` +
          `- 24h Change: *${change24h}*\n` +
          `- Liquidity Pool: *${liquidity}*\n` +
          `- 24h Trading Volume: *${volume}*\n\n` +
          `*Anti-Rug Heuristics Risk Profile:*\n` +
          `- Safety Rating Score: *${risk?.score || 0}/100* (lower is safer)\n` +
          `- Assessment: *${risk?.isRugPotential ? "⚠️ HIGH SUSPICION OF RUG RISK" : (risk?.score || 0) > 25 ? "Moderate risk profile" : "Low risk profile"}*\n` +
          `${risk?.warnings && risk.warnings.length > 0 ? risk.warnings.map((w: string) => `  • ${w}`).join("\n") + "\n" : ""}\n` +
          `*SolPilot AI Commentary:*\n` +
          `${aiCommentary}\n\n` +
          `_${brand.disclaimer}_`;

        await notificationBot.telegram.sendMessage(userId, replyMsg, { parse_mode: "Markdown" });
      } else if (messageType === "SIMPLE_TEXT") {
        await notificationBot.telegram.sendMessage(userId, payload.text, { parse_mode: "Markdown" });
      }
    } catch (err) {
      logger.error(`Notification Worker: Failed to send Telegram alert to user ${userId}:`, err);
      throw err; // Trigger job retry
    }

    return { success: true };
  },
  { connection: redisConnection, concurrency: 5 }
);

notificationWorker.on("completed", (job) => {
  logger.info(`Notification Worker: Job #${job.id} finished.`);
});

notificationWorker.on("failed", (job, err) => {
  logger.error(`Notification Worker: Job #${job?.id} failed:`, err);
});
