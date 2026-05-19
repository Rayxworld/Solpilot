import { Worker, Job } from "bullmq";
import { runTriggerSlTpEvaluation } from "../trading/paperTrading";
import { redisConnection } from "../services/queueService";
import { logger } from "../utils/logger";

/**
 * Trade Engine Worker: Processes paper portfolio order book and automatic SL/TP triggers
 */
export const tradeWorker = new Worker(
  "trade-evaluation-queue",
  async (job: Job) => {
    logger.debug(`Trade Worker: Commencing automated Stop-Loss/Take-Profit target scan (Job #${job.id})`);
    
    try {
      const closedCount = await runTriggerSlTpEvaluation();
      if (closedCount > 0) {
        logger.info(`Trade Worker: Automatic safety trigger closed ${closedCount} breached positions.`);
      }
      return { success: true, closedCount };
    } catch (error) {
      logger.error("Trade Worker: SL/TP evaluation check failed:", error);
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

tradeWorker.on("completed", (job) => {
  logger.debug(`Trade Worker: Job #${job.id} completed successfully.`);
});

tradeWorker.on("failed", (job, err) => {
  logger.error(`Trade Worker: Job #${job?.id} failed:`, err);
});
