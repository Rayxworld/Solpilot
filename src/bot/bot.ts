import { Telegraf, Context, session } from "telegraf";
import { config } from "../config/env";
import { registerCommands } from "../commands/index";
import { rateLimiterMiddleware } from "../middleware/rateLimiter";
import { analyzeAndReplySignal, showRecommendations } from "../commands/signal";
import { handlePortfolio } from "../commands/portfolio";
import { handleWatchlist } from "../commands/watchlist";
import { handleSettings } from "../commands/settings";
import { handleHelp } from "../commands/help";
import { handleAgent } from "../commands/agent";
import { handleDeposit } from "../commands/deposit";
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

  bot.telegram.setMyCommands([
    { command: "menu", description: "Open SolPilot control dashboard" },
    { command: "agent", description: "Start or inspect the autonomous paper agent" },
    { command: "deposit", description: "View deposit and live-agent access" },
    { command: "signal", description: "Get AI-driven market signal analysis" },
    { command: "portfolio", description: "View your paper wallet and positions" },
    { command: "watchlist", description: "Manage your token watchlist" },
    { command: "papertrade", description: "Execute simulated buy/sell trades" },
    { command: "settings", description: "Adjust trading risk parameters" },
    { command: "status", description: "Check Solana and database health" },
    { command: "help", description: "View command usage and guide" }
  ]).catch(err => logger.error("Failed to set Telegram command list:", err));

  bot.use(session());
  bot.use(rateLimiterMiddleware());
  registerCommands(bot);

  bot.hears(["AI Signals", "Get AI Signal"], async (ctx) => {
    try {
      await showRecommendations(ctx);
    } catch (error) {
      logger.error("Hears 'AI Signals' error:", error);
    }
  });

  bot.hears("SolPilot Agent", async (ctx) => {
    try {
      await handleAgent(ctx);
    } catch (error) {
      logger.error("Hears 'SolPilot Agent' error:", error);
    }
  });

  bot.hears(["Portfolio", "My Portfolio"], async (ctx) => {
    try {
      await handlePortfolio(ctx);
    } catch (error) {
      logger.error("Hears 'Portfolio' error:", error);
    }
  });

  bot.hears("Watchlist", async (ctx) => {
    try {
      await handleWatchlist(ctx);
    } catch (error) {
      logger.error("Hears 'Watchlist' error:", error);
    }
  });

  bot.hears(["Risk Settings", "Settings"], async (ctx) => {
    try {
      await handleSettings(ctx);
    } catch (error) {
      logger.error("Hears 'Risk Settings' error:", error);
    }
  });

  bot.hears("Deposit / Live Access", async (ctx) => {
    try {
      await handleDeposit(ctx);
    } catch (error) {
      logger.error("Hears 'Deposit / Live Access' error:", error);
    }
  });

  bot.hears("Help", async (ctx) => {
    try {
      await handleHelp(ctx);
    } catch (error) {
      logger.error("Hears 'Help' error:", error);
    }
  });

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

