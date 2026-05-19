import { Worker, Job } from "bullmq";
import { buildSignalExplanation } from "../ai/aiEngine";
import { redisConnection, notificationQueue } from "../services/queueService";
import { logger } from "../utils/logger";

interface AiAnalysisJobData {
  userId: string;
  symbol: string;
  pair: any;
  risk: any;
}

/**
 * AI Analysis Worker: Generates objective, risk-aware trading insights asynchronously
 */
export const aiWorker = new Worker(
  "signal-analysis-queue",
  async (job: Job<AiAnalysisJobData>) => {
    const { userId, symbol, pair, risk } = job.data;
    logger.info(`AI Worker: Generating signal commentary for ${symbol} (Job #${job.id})`);

    const aiCommentary = await buildSignalExplanation(symbol, pair, risk);

    // Enqueue a notification task to deliver the final response to the user async
    await notificationQueue.add(`deliver-signal-${userId}`, {
      userId,
      messageType: "SIGNAL_RESULT",
      payload: {
        symbol,
        pair,
        risk,
        aiCommentary
      }
    });

    return { success: true, aiCommentary };
  },
  { connection: redisConnection, concurrency: 3 }
);

aiWorker.on("completed", (job) => {
  logger.info(`AI Worker: Job #${job.id} completed successfully.`);
});

aiWorker.on("failed", (job, err) => {
  logger.error(`AI Worker: Job #${job?.id} failed:`, err);
});
