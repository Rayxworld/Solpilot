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
import { logger } from "../utils/logger";
import { executePaperBuy } from "../trading/paperTrading";
import { handleDeposit } from "./deposit";
import { agentKeyboard, handleAgent } from "./agent";
import { formatAgentStatus, getAgentSession, startPaperAgent, stopAgent } from "../services/agentService";
import { getRiskProfile } from "../services/riskService";

function mainKeyboard() {
  return {
    keyboard: [
      [
        { text: "AI Signals" },
        { text: "SolPilot Agent" }
      ],
      [
        { text: "Portfolio" },
        { text: "Risk Settings" }
      ],
      [
        { text: "Deposit / Live Access" },
        { text: "Help" }
      ]
    ],
    resize_keyboard: true
  };
}

async function replyAgentRules(ctx: any) {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const profile = await getRiskProfile(userId);
  await ctx.replyWithMarkdown(
    `*SolPilot Agent Rules*\n\n` +
      `- Max entry size: *$${profile.maxTradeSize.toFixed(2)}*\n` +
      `- Stop Loss: *-${profile.stopLossPct.toFixed(1)}%*\n` +
      `- Take Profit: *+${profile.takeProfitPct.toFixed(1)}%*\n` +
      `- Cooldown: *${profile.cooldownMinutes} minutes*\n` +
      `- Mode: *${profile.antiRugEnabled ? "SAFE" : "DEGEN"}*\n\n` +
      `Update rules with /settings. Example: \`/settings size 25\`, \`/settings tp 35\`, \`/settings antirug 0\`.`,
    agentKeyboard()
  );
}

/**
 * Registers all Telegram bot commands, text listener logic, and callback query menus
 */
export function registerCommands(bot: Telegraf<any>) {
  bot.start(handleStart);
  bot.help(handleHelp);
  bot.command("signal", handleSignal);
  bot.command("portfolio", handlePortfolio);
  bot.command("watchlist", handleWatchlist);
  bot.command("papertrade", handlePaperTrade);
  bot.command("settings", handleSettings);
  bot.command("risk", handleRisk);
  bot.command("deposit", handleDeposit);
  bot.command("agent", handleAgent);
  bot.command("status", handleStatus);

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
      await ctx.reply("SolPilot reboot initiated. Restarting process on Render...");
      setTimeout(() => process.exit(0), 1000);
    } else {
      await ctx.reply("Unauthorized. Only the bot administrator can restart this service.");
    }
  });

  bot.command("menu", async (ctx) => {
    await ctx.replyWithMarkdown(
      `*SolPilot Control Panel*\n\n` +
        `Your workspace for Solana signals, autonomous paper strategy, risk settings, and live-agent readiness.`,
      {
        reply_markup: mainKeyboard()
      }
    );
  });

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
        await ctx.reply("Enter a custom Solana token ticker or contract address, for example BONK or WIF:");
        ctx.session = { awaitingSymbol: true };
      } else if (data === "agent_start") {
        const userId = ctx.from?.id.toString();
        if (userId) {
          await ctx.reply("Starting SolPilot Agent in paper mode with a $100 strategy budget.");
          const session = await startPaperAgent(userId, 100);
          await ctx.replyWithMarkdown(formatAgentStatus(session), agentKeyboard());
        }
      } else if (data === "agent_stop") {
        const userId = ctx.from?.id.toString();
        if (userId) {
          const session = await stopAgent(userId);
          await ctx.replyWithMarkdown(formatAgentStatus(session), agentKeyboard());
        }
      } else if (data === "agent_rules") {
        await replyAgentRules(ctx);
      } else if (data === "menu_agent") {
        const userId = ctx.from?.id.toString();
        if (userId) {
          await ctx.replyWithMarkdown(formatAgentStatus(getAgentSession(userId)), agentKeyboard());
        }
      } else if (data.startsWith("quick_buy_")) {
        const parts = data.substring("quick_buy_".length).split("_");
        const symbol = parts[0];
        const usdSize = parseFloat(parts[1]);
        const userId = ctx.from?.id.toString();
        if (userId) {
          await ctx.reply(`Initiating simulated buy order for ${symbol.toUpperCase()} ($${usdSize.toFixed(2)} size)...`);
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
      } else if (data === "menu_deposit") {
        await handleDeposit(ctx);
      }

      await ctx.answerCbQuery();
    } catch (err) {
      logger.error("Callback query dispatch error:", err);
      await ctx.answerCbQuery("An error occurred processing the action.");
    }
  });

  logger.info("Bot commands and callback menu handlers successfully registered.");
}

export {
  handleStart,
  handleHelp,
  handleSignal,
  handlePortfolio,
  handleWatchlist,
  handlePaperTrade,
  handleSettings,
  handleRisk,
  handleStatus
};

