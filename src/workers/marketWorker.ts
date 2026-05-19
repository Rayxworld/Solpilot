import { Worker, Job } from "bullmq";
import { fetchTokenPairDetails, analyzeTokenRisk } from "../market/dexScreener";
import { redisConnection } from "../services/queueService";
import { logger } from "../utils/logger";

interface MarketScanJobData {
  symbolOrAddress: string;
}

/**
 * Market Scanner Worker: Performs DexScreener API polling & risk evaluations
 */
export const marketWorker = new Worker(
  "market-scan-queue",
  async (job: Job<MarketScanJobData>) => {
    const { symbolOrAddress } = job.data;
    logger.info(`Market Worker: Processing scan for "${symbolOrAddress}" (Job #${job.id})`);

    const pair = await fetchTokenPairDetails(symbolOrAddress);
    if (!pair) {
      logger.warn(`Market Worker: No pair discovered for "${symbolOrAddress}"`);
      return { success: false, reason: "No active Solana pair found." };
    }

    const risk = analyzeTokenRisk(pair);
    logger.info(`Market Worker: Successfully scanned ${pair.baseToken.symbol}. Risk score: ${risk.score}/100`);

    return {
      success: true,
      pair,
      risk
    };
  },
  { connection: redisConnection, concurrency: 5 }
);

marketWorker.on("completed", (job) => {
  logger.info(`Market Worker: Job #${job.id} completed successfully.`);
});

marketWorker.on("failed", (job, err) => {
  logger.error(`Market Worker: Job #${job?.id} failed:`, err);
});
