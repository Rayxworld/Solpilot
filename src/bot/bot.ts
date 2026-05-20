import { Telegraf, Context, session } from "telegraf";
import { config } from "../config/env";
import { registerCommands } from "../commands/index";
import { rateLimiterMiddleware } from "../middleware/rateLimiter";
import { analyzeAndReplySignal } from "../commands/signal";
import { logger } from "../utils/logger";

interface MySession {
  awaitingSymbol?: boolean;
}

interface MyContext extends Context {
  session?: MySession;
}

/**
 * Initializes and configures the Telegraf bot instance with middlewares
 */
export function createBot(): Telegraf<MyContext> {
  logger.info("Initializing Telegraf Bot...");
  const bot = new Telegraf<MyContext>(config.botToken);

  // Register commands list to create the persistent menu button next to the chat bar
  bot.telegram.setMyCommands([
    { command: "menu", description: "Open SolPilot control dashboard 🎮" },
    { command: "signal", description: "Get AI-driven market signal analysis 📈" },
    { command: "portfolio", description: "View your paper wallets & balance 💼" },
    { command: "watchlist", description: "Manage your token watchlist 👁️" },
    { command: "papertrade", description: "Execute mock buy/sell trades 📈" },
    { command: "settings", description: "Adjust trading risk parameters ⚙️" },
    { command: "status", description: "Check Solana & database health 🔌" },
    { command: "restart", description: "Reboot the bot process securely 🔄" },
    { command: "help", description: "View command usage & guide ❓" }
  ]).catch(err => logger.error("Failed to set Telegram command list:", err));

  // 1. Hook up session middleware
  bot.use(session());

  // 2. Hook up anti-spam rate limiting middleware
  bot.use(rateLimiterMiddleware());

  // 3. Register command handlers
  registerCommands(bot);

  // 4. Handle plain text entries (e.g. for /signal prompts or symbol entries)
  bot.on("text", async (ctx) => {
    try {
      const text = (ctx.message?.text || "").trim();

      if (!text || text.startsWith("/")) return;

      if (ctx.session?.awaitingSymbol) {
        ctx.session.awaitingSymbol = false;
        await analyzeAndReplySignal(ctx, text);
      }
    } catch (error) {
      logger.error("Text message handling error:", error);
      await ctx.reply("An error occurred while compiling token details. Please try again.");
    }
  });

  return bot;
}
