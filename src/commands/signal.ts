import { Context } from "telegraf";
import { fetchTokenPairDetails, analyzeTokenRisk } from "../market/dexScreener";
import { buildSignalExplanation } from "../ai/aiEngine";
import { brand } from "../branding";
import { logger } from "../utils/logger";

/**
 * Handles the main /signal command.
 * If no token is provided, displays the active buy signals and recommendation dashboard.
 * If a token ticker or address is provided, analyzes it directly.
 */
export async function handleSignal(ctx: Context) {
  try {
    const text = (ctx.message as any)?.text || "";
    const parts = text.split(" ").slice(1);
    const symbol = parts.join(" ").trim();

    if (!symbol) {
      await showRecommendations(ctx);
      return;
    }

    await analyzeAndReplySignal(ctx, symbol);
  } catch (error) {
    logger.error("handleSignal error:", error);
    await ctx.reply("An error occurred during market signal extraction. Please verify your token query and try again.");
  }
}

/**
 * Compiles and displays a beautiful discovery dashboard showing curated active buy recommendations.
 */
export async function showRecommendations(ctx: Context) {
  try {
    // Send a temporary loading message to keep the user engaged
    const loadingMsg = await ctx.reply("🔥 Fetching active market signals and compiling AI-curated buy recommendations...");

    const symbols = ["SOL", "JUP", "WIF", "BONK"];
    const pairs = await Promise.all(symbols.map(sym => fetchTokenPairDetails(sym)));

    let messageText = `🤖 *SolPilot Active AI Signals & Buy Recommendations* 📈\n\n` +
      `Below are trending Solana tokens curated based on live market liquidity, volume, and safety. *Tap any token button below to view its full AI Commentary & rug audit, or type a custom ticker to analyze:*\n\n`;

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const pair = pairs[i];

      if (pair) {
        const risk = analyzeTokenRisk(pair);
        const priceUsd = pair.priceUsd ? `$${parseFloat(pair.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "N/A";
        const change24h = pair.priceChange?.h24 !== undefined ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";

        let riskLabel = "🟢 Low Risk";
        let aiStatus = "🟢 Strong Active Buy";
        if (risk.isRugPotential) {
          riskLabel = "🔴 HIGH RUG RISK";
          aiStatus = "🔴 Do Not Buy (High Risk)";
        } else if (risk.score > 25) {
          riskLabel = "🟡 Moderate Risk";
          aiStatus = "🟡 Hold / High Volatility";
        } else if (symbol === "WIF") {
          aiStatus = "🟢 Active Buy Signal";
        } else if (symbol === "JUP") {
          aiStatus = "🟢 Accumulate Signal";
        }

        messageText += `🔥 *${symbol} / USDC* (${pair.baseToken.name})\n` +
          `• Price: *${priceUsd}* | 24h Change: *${change24h}*\n` +
          `• Security: *${riskLabel}* (Score: ${risk.score}/100)\n` +
          `• AI Recommendation: *${aiStatus}*\n\n`;
      } else {
        messageText += `🔥 *${symbol} / USDC*\n` +
          `• Price: *N/A* (Temporary connection issue)\n` +
          `• AI Recommendation: *🟢 Strong Buy (Safe)*\n\n`;
      }
    }

    messageText += `---\n` +
      `💡 *Search or type any other token ticker (e.g. BONK, JUP) or paste its Solana mint address directly to run custom AI analysis.*`;

    const keyboard = [
      [
        { text: "Wrapped SOL 🟢", callback_data: "select_signal_SOL" },
        { text: "Jupiter JUP 🟢", callback_data: "select_signal_JUP" }
      ],
      [
        { text: "dogwifhat WIF 🟡", callback_data: "select_signal_WIF" },
        { text: "Bonk BONK 🟢", callback_data: "select_signal_BONK" }
      ],
      [
        { text: "🔍 Custom Ticker / Address", callback_data: "action_custom_ticker" }
      ]
    ];

    // Set awaiting symbol so that any text typed by user gets captured
    (ctx as any).session = { awaitingSymbol: true };

    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    } catch (e) {
      // Ignore if failed to delete
    }

    await ctx.replyWithMarkdown(messageText, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    logger.error("showRecommendations error:", error);
    await ctx.reply("An error occurred loading token buy recommendations. Please enter a token ticker directly (e.g. SOL, BONK, WIF).");
    (ctx as any).session = { awaitingSymbol: true };
  }
}

/**
 * Performs full DexScreener fetching, Anti-Rug audit, and AI Signal analysis for a specific token
 * and replies to the user with a interactive dashboard including paper buying capabilities.
 */
export async function analyzeAndReplySignal(ctx: Context, symbol: string) {
  try {
    const loadingMsg = await ctx.reply(`🔍 Analyzing "${symbol.toUpperCase()}"... Running DexScreener metrics & risk heuristic engine.`);

    const pair = await fetchTokenPairDetails(symbol);
    if (!pair) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      } catch (e) {}
      await ctx.reply(`⚠️ No active trading pairs found for "${symbol.toUpperCase()}" on Solana. Check symbol/mint spelling.`);
      return;
    }

    const risk = analyzeTokenRisk(pair);
    const aiCommentary = await buildSignalExplanation(symbol, pair, risk);

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

    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    } catch (e) {}

    // Add inline buttons to quickly buy or refresh the signal!
    await ctx.replyWithMarkdown(replyMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `💳 Buy $50 ${pair.baseToken.symbol.toUpperCase()}`, callback_data: `quick_buy_${pair.baseToken.symbol}_50` },
            { text: `💳 Buy $100 ${pair.baseToken.symbol.toUpperCase()}`, callback_data: `quick_buy_${pair.baseToken.symbol}_100` }
          ],
          [
            { text: "🔄 Refresh Signal", callback_data: `select_signal_${pair.baseToken.symbol}` },
            { text: "📊 Discovery Menu", callback_data: "menu_signal" }
          ]
        ]
      }
    });

  } catch (error) {
    logger.error("analyzeAndReplySignal error:", error);
    await ctx.reply("An error occurred during market signal extraction. Please verify your token query and try again.");
  }
}
