import { Context } from "telegraf";
import { logger } from "../utils/logger";

const rateLimits = new Map<string, { count: number; lastReset: number }>();

const LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 30; // Max 30 messages per minute

/**
 * Basic in-memory rate limiter middleware to prevent bot spam
 */
export function rateLimiterMiddleware() {
  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      return next();
    }

    const now = Date.now();
    const userLimit = rateLimits.get(userId) || { count: 0, lastReset: now };

    // Reset window if elapsed
    if (now - userLimit.lastReset > LIMIT_WINDOW_MS) {
      userLimit.count = 0;
      userLimit.lastReset = now;
    }

    userLimit.count++;
    rateLimits.set(userId, userLimit);

    if (userLimit.count > MAX_REQUESTS_PER_WINDOW) {
      logger.warn(`Rate limit exceeded for user ${userId} (${ctx.from?.username})`);
      // Only reply once in a while to not spam the user
      if (userLimit.count === MAX_REQUESTS_PER_WINDOW + 1) {
        await ctx.reply("⚠️ Rate limit reached. Please hold on a moment before sending more messages.");
      }
      return;
    }

    return next();
  };
}
