import { Telegraf } from "telegraf";
import { handleStart } from "./start";
import { handleHelp } from "./help";
import { handleSignal } from "./signal";
import { handlePortfolio } from "./portfolio";
import { handleWatchlist } from "./watchlist";
import { handlePaperTrade } from "./papertrade";
import { handleSettings } from "./settings";
import { handleRisk } from "./risk";
import { handleStatus } from "./status";
import { getChainHealth } from "../solana/solanaUtils";
import { brand } from "../branding";
import { logger } from "../utils/logger";

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
      `*SolPilot Interactive Control Panel* 🎮\n\nChoose an action below to automate your research or check your paper wallet:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📊 Get AI Signal", callback_data: "menu_signal" }],
            [{ text: "💼 View Portfolio", callback_data: "menu_portfolio" }],
            [{ text: "⚙️ Risk Settings", callback_data: "menu_settings" }],
            [{ text: "👁️ Watchlist Manager", callback_data: "menu_watchlist" }],
            [{ text: "🔌 Solana Status", callback_data: "menu_status" }]
          ]
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
        await ctx.reply("Enter a Solana token ticker or address to get a risk-aware AI signal (e.g. SOL, BONK, WIF):");
        ctx.session = { awaitingSymbol: true };
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
