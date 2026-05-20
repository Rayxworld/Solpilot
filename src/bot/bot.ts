import { Telegraf, Context, session } from "telegraf";
import { config } from "../config/env";
import { registerCommands } from "../commands/index";
import { rateLimiterMiddleware } from "../middleware/rateLimiter";
import { handleSignal } from "../commands/signal";
import { fetchTokenPairDetails } from "../market/dexScreener";
import { analyzeTokenRisk } from "../market/dexScreener";
import { buildSignalExplanation } from "../ai/aiEngine";
import { brand } from "../branding";
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
        await ctx.reply(`🔍 Analyzing "${text.toUpperCase()}"... Running DexScreener metrics & risk heuristic engine.`);

        const pair = await fetchTokenPairDetails(text);
        if (!pair) {
          await ctx.reply(`⚠️ No active trading pairs found for "${text.toUpperCase()}" on Solana. Check symbol/mint spelling.`);
          ctx.session.awaitingSymbol = false;
          return;
        }

        const risk = analyzeTokenRisk(pair);
        const aiCommentary = await buildSignalExplanation(text, pair, risk);

        const priceUsd = pair.priceUsd ? `$${parseFloat(pair.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "N/A";
        const change24h = pair.priceChange?.h24 !== undefined ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";
        const liquidity = pair.liquidity?.usd ? `$${Math.round(pair.liquidity.usd).toLocaleString()}` : "N/A";
        const volume = pair.volume?.h24 ? `$${Math.round(pair.volume.h24).toLocaleString()}` : "N/A";

        const replyMsg = 
          `*${pair.baseToken.symbol.toUpperCase()} / ${pair.quoteToken.symbol.toUpperCase()} Signal* 📈\n\n` +
          `*Live Pricing Metrics (DEX: ${pair.dexId.toUpperCase()}):*\n` +
          `- Price: *${priceUsd}*\n` +
          `- 24h Change: *${change24h}*\n` +
          `- Liquidity Pool: *${liquidity}*\n` +
          `- 24h Trading Volume: *${volume}*\n\n` +
          `*Anti-Rug Heuristics Risk Profile:*\n` +
          `- Safety Rating Score: *${risk.score}/100* (lower is safer)\n` +
          `- Assessment: *${risk.isRugPotential ? "⚠️ HIGH SUSPICION OF RUG RISK" : risk.score > 25 ? "Moderate risk profile" : "Low risk profile"}*\n` +
          `${risk.warnings.length > 0 ? risk.warnings.map(w => `  • ${w}`).join("\n") + "\n" : ""}\n` +
          `*SolPilot AI Commentary:*\n` +
          `${aiCommentary}\n\n` +
          `_${brand.disclaimer}_`;

        await ctx.replyWithMarkdown(replyMsg);
        ctx.session.awaitingSymbol = false;
      }
    } catch (error) {
      logger.error("Text message handling error:", error);
      await ctx.reply("An error occurred while compiling token details. Please try again.");
    }
  });

  return bot;
}
