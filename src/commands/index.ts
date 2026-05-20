import { Telegraf } from "telegraf";
import { handleStart } from "./start";
import { handleHelp } from "./help";
import { handleSignal, showRecommendations, analyzeAndReplySignal } from "./signal";
import { handlePortfolio } from "./portfolio";
import { handleWatchlist } from "./watchlist";
import { handlePaperTrade } from "./papertrade";
import { handleSettings } from "./settings";
import { handleRisk } from "./risk";
import { handleStatus } from "./status";
import { getChainHealth } from "../solana/solanaUtils";
import { brand } from "../branding";
import { logger } from "../utils/logger";
import { executePaperBuy } from "../trading/paperTrading";


/**
 * Registers all Telegram bot commands, text listener logic, and callback query menus
 */
export function registerCommands(bot: Telegraf<any>) {
  // Command mappings
  bot.start(handleStart);
  bot.help(handleHelp);
  bot.command("signal", handleSignal);
  bot.command("portfolio", handlePortfolio);
  bot.command("watchlist", handleWatchlist);
  bot.command("papertrade", handlePaperTrade);
  bot.command("settings", handleSettings);
  bot.command("risk", handleRisk);
  bot.command("status", handleStatus);

  // Restart command
  bot.command("restart", async (ctx) => {
    const fromId = ctx.from?.id;
    const username = ctx.from?.username;
    
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminChatId = process.env.ADMIN_CHAT_ID;
    
    if (
      (adminUsername && username === adminUsername) ||
      (adminChatId && String(fromId) === adminChatId) ||
      (!adminUsername && !adminChatId)
    ) {
      logger.info(`Restart command authorized for Telegram User: ${username} (ID: ${fromId})`);
      await ctx.reply("🔄 SolPilot reboot initiated! Shutting down and restarting process on Render...");
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } else {
      await ctx.reply("❌ Unauthorized. Only the bot administrator can restart this service.");
    }
  });

  // Menu command
  bot.command("menu", async (ctx) => {
    await ctx.replyWithMarkdown(
      `*SolPilot Interactive Control Panel* 🎮\n\nUse the persistent menu buttons at the bottom of your screen to automate your research, check your watchlist, adjust settings, or inspect your paper wallet:`,
      {
        reply_markup: {
          keyboard: [
            [
              { text: "📊 Get AI Signal" },
              { text: "💼 My Portfolio" }
            ],
            [
              { text: "👁️ Watchlist" },
              { text: "⚙️ Settings" },
              { text: "❓ Help" }
            ]
          ],
          resize_keyboard: true
        }
      }
    );
  });

  // Callback query dispatcher
  bot.on("callback_query", async (ctx) => {
    try {
      const callbackQuery = ctx.callbackQuery;
      if (!callbackQuery || !("data" in callbackQuery)) {
        await ctx.answerCbQuery();
        return;
      }

      const data = callbackQuery.data;

      if (data === "menu_signal") {
        await showRecommendations(ctx);
      } else if (data.startsWith("select_signal_")) {
        const symbol = data.substring("select_signal_".length);
        await analyzeAndReplySignal(ctx, symbol);
      } else if (data === "action_custom_ticker") {
        await ctx.reply("💬 Enter a custom Solana token ticker or contract address (e.g. BONK, WIF) to run custom AI analysis:");
        ctx.session = { awaitingSymbol: true };
      } else if (data.startsWith("quick_buy_")) {
        const parts = data.substring("quick_buy_".length).split("_");
        const symbol = parts[0];
        const usdSize = parseFloat(parts[1]);
        const userId = ctx.from?.id.toString();
        if (userId) {
          await ctx.reply(`⏳ Initiating simulated buy order for ${symbol.toUpperCase()} ($${usdSize.toFixed(2)} size)...`);
          const result = await executePaperBuy(userId, symbol, usdSize);
          await ctx.reply(result.message);
        }
      } else if (data === "menu_portfolio") {
        await handlePortfolio(ctx);
      } else if (data === "menu_settings") {
        await handleSettings(ctx);
      } else if (data === "menu_watchlist") {
        await handleWatchlist(ctx);
      } else if (data === "menu_status") {
        await handleStatus(ctx);
      } else if (data === "menu_help") {
        await handleHelp(ctx);
      } else if (data === "menu_risk") {
        await handleRisk(ctx);
      }

      await ctx.answerCbQuery();
    } catch (err) {
      logger.error("Callback query dispatch error:", err);
      await ctx.answerCbQuery("An error occurred processing the action.");
    }
  });

  logger.info("Bot commands and callback menu handlers successfully registered.");
}
export { handleStart, handleHelp, handleSignal, handlePortfolio, handleWatchlist, handlePaperTrade, handleSettings, handleRisk, handleStatus };
