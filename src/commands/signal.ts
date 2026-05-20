import { Context } from "telegraf";
import { fetchTokenPairDetails, analyzeTokenRisk, fetchMultipleTokenPairs } from "../market/dexScreener";
import { buildSignalExplanation } from "../ai/aiEngine";
import { getRiskProfile } from "../services/riskService";
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
    const loadingMsg = await ctx.reply("🔥 Fetching active market signals and compiling Solana buy recommendations...");

    const symbols = ["SOL", "JUP", "RAY", "JTO", "WIF", "BONK", "POPCAT", "BOME", "PYTH", "RENDER"];
    const pairsRecord = await fetchMultipleTokenPairs(symbols);

    let messageText = `🤖 *SolPilot Active Solana AI Signals & Buy Recommendations* 📈\n\n` +
      `Below are the most active and trending tokens in the Solana ecosystem, grouped by sector. *Tap any token button below to view its live AI Commentary & rug audit:*\n\n`;

    // Grouping tokens
    const categories = [
      { name: "⚡ L1 & Core DeFi", syms: ["SOL", "JUP", "RAY", "JTO"] },
      { name: "🔥 Solana Meme Coins", syms: ["WIF", "BONK", "POPCAT", "BOME"] },
      { name: "🌐 Oracle & DePIN Infrastructure", syms: ["PYTH", "RENDER"] }
    ];

    const pairMap = new Map<string, any>();
    for (const sym of symbols) {
      if (pairsRecord[sym]) {
        pairMap.set(sym, pairsRecord[sym]);
      }
    }

    for (const cat of categories) {
      messageText += `*${cat.name}:*\n`;
      for (const sym of cat.syms) {
        const pair = pairMap.get(sym);
        if (pair) {
          const risk = analyzeTokenRisk(pair);
          const priceUsd = pair.priceUsd ? `$${parseFloat(pair.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "N/A";
          const change24h = pair.priceChange?.h24 !== undefined ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";

          const profile = await getRiskProfile((ctx.from?.id || "").toString());
          const mode = profile.antiRugEnabled ? "SAFE" : "DEGEN";

          let riskLabel = mode === "DEGEN" ? "🔥 DEGEN" : "🟢 Low Risk";
          let aiStatus = mode === "DEGEN" ? "🎯 Hunt" : "🟢 Buy";

          if (risk.isRugPotential) {
            riskLabel = mode === "DEGEN" ? "⚠️ HIGH RISK (DEGEN ACCEPTED)" : "🔴 HIGH RISK";
            aiStatus = mode === "DEGEN" ? "🎯 Snipe (High Risk)" : "🔴 Hold";
          } else if (risk.score > 25) {
            riskLabel = mode === "DEGEN" ? "🟠 Volatile (DEGEN)" : "🟡 Moderate";
            aiStatus = mode === "DEGEN" ? "🎯 Watch + Entry" : "🟡 Hold/Volatile";
          } else if (sym === "SOL" || sym === "JUP" || sym === "PYTH") {
            aiStatus = mode === "DEGEN" ? "💢 Aggressive" : "🟢 Strong Buy";
          }


          messageText += `• *${sym}*: ${priceUsd} (${change24h}) | ${riskLabel} | *${aiStatus}*\n`;
        } else {
          messageText += `• *${sym}*: *N/A* (Network issue)\n`;
        }
      }
      messageText += `\n`;
    }

    messageText += `---\n` +
      `💡 *Search or type any other token ticker (e.g. BOME, JTO) or paste its Solana mint address directly to run custom AI analysis.*`;

    const keyboard = [
      [
        { text: "SOL 🟢", callback_data: "select_signal_SOL" },
        { text: "JUP 🟢", callback_data: "select_signal_JUP" },
        { text: "RAY 🟢", callback_data: "select_signal_RAY" },
        { text: "JTO 🟢", callback_data: "select_signal_JTO" }
      ],
      [
        { text: "WIF 🟡", callback_data: "select_signal_WIF" },
        { text: "BONK 🟢", callback_data: "select_signal_BONK" },
        { text: "POPCAT 🟡", callback_data: "select_signal_POPCAT" },
        { text: "BOME 🟡", callback_data: "select_signal_BOME" }
      ],
      [
        { text: "PYTH 🟢", callback_data: "select_signal_PYTH" },
        { text: "RENDER 🟢", callback_data: "select_signal_RENDER" }
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
    const profile = await getRiskProfile((ctx.from?.id || "").toString());
    const mode = profile.antiRugEnabled ? "SAFE" : "DEGEN";
    const aiCommentary = await buildSignalExplanation(symbol, pair, risk, mode);

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
