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
import { handleVerify } from "../commands/verify";
import { handleBeta } from "../commands/beta";
import { handleFeedback, saveFeedback } from "../commands/feedback";
import { logger } from "../utils/logger";

interface MySession {
  awaitingSymbol?: boolean;
  awaitingFeedback?: boolean;
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
    { command: "beta", description: "Open beta launch checklist" },
    { command: "go", description: "Start the paper agent with default rules" },
    { command: "off", description: "Stop the active agent" },
    { command: "v", description: "Verify your Telegram account" },
    { command: "s", description: "Open AI signal deck" },
    { command: "me", description: "View portfolio" },
    { command: "fund", description: "View deposit and live-agent access" },
    { command: "fb", description: "Send beta feedback" },
    { command: "whoami", description: "Show your Telegram chat ID" },
    { command: "rules", description: "Adjust trading risk settings" },
    { command: "agent", description: "Advanced agent controls" },
    { command: "trade", description: "Manual simulated trades" },
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

  bot.hears("Beta Guide", async (ctx) => {
    try {
      await handleBeta(ctx);
    } catch (error) {
      logger.error("Hears 'Beta Guide' error:", error);
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

  bot.hears("Verify Account", async (ctx) => {
    try {
      await handleVerify(ctx);
    } catch (error) {
      logger.error("Hears 'Verify Account' error:", error);
    }
  });

  bot.hears("Send Feedback", async (ctx) => {
    try {
      await handleFeedback(ctx);
    } catch (error) {
      logger.error("Hears 'Send Feedback' error:", error);
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

      if (ctx.session?.awaitingFeedback) {
        ctx.session.awaitingFeedback = false;
        await saveFeedback(ctx, text);
        return;
      }

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
