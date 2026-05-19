import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { logger } from "../utils/logger";

const cleanUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.split("?")[0] : "";
const pool = new Pool({
  connectionString: cleanUrl,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: [
    { level: "query", emit: "event" },
    { level: "info", emit: "stdout" },
    { level: "warn", emit: "stdout" },
    { level: "error", emit: "stdout" }
  ]
});

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Log raw database queries in debug mode
prisma.$on("query" as any, (e: any) => {
  logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
});

/**
 * Ensures user profile, portfolio, and default risk profile exist in PostgreSQL
 */
export async function ensureUser(telegramId: string, username?: string) {
  try {
    await prisma.$transaction(async (tx: TransactionClient) => {
      const user = await tx.user.findUnique({
        where: { telegramId }
      });

      if (!user) {
        await tx.user.create({
          data: {
            telegramId,
            username: username || null,
            riskProfile: {
              create: {
                maxTradeSize: 100.0,
                cooldownMinutes: 5,
                stopLossPct: 10.0,
                takeProfitPct: 20.0,
                antiRugEnabled: true
              }
            },
            portfolio: {
              create: {
                cashBalance: 10000.0
              }
            }
          }
        });
        logger.info(`Prisma: Initialized new user profile for Telegram ID: ${telegramId}`);
      }
    });
  } catch (error) {
    logger.error(`ensureUser database error for ${telegramId}:`, error);
    throw error;
  }
}

/**
 * Creates a system audit log record for security tracking
 */
export async function createAuditLog(userId: string | null, action: string, details: string, ipAddress?: string) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress: ipAddress || null
      }
    });
  } catch (error) {
    logger.error("Failed to write audit log:", error);
  }
}
