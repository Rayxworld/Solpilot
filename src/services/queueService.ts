import { Queue } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../utils/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const isSsl = REDIS_URL.startsWith("rediss://");
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  ...(isSsl ? { tls: { rejectUnauthorized: false } } : {})
});

redisConnection.on("connect", () => {
  logger.info(`Queue Manager: Connected to Redis at ${REDIS_URL}`);
});

redisConnection.on("error", (err) => {
  logger.error("Queue Manager: Redis connection error:", err);
});

// Define core queues
export const marketScanQueue = new Queue("market-scan-queue", { connection: redisConnection });
export const signalAnalysisQueue = new Queue("signal-analysis-queue", { connection: redisConnection });
export const tradeEvaluationQueue = new Queue("trade-evaluation-queue", { connection: redisConnection });
export const notificationQueue = new Queue("notification-queue", { connection: redisConnection });
export const portfolioUpdateQueue = new Queue("portfolio-update-queue", { connection: redisConnection });

logger.info("BullMQ asynchronous task queues initialized successfully.");
