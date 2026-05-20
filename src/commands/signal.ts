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
 * Compiles and displays a discovery dashboard showing active Solana signals.
 */
export async function showRecommendations(ctx: Context) {
  try {
    const loadingMsg = await ctx.reply("Scanning Solana markets and compiling agent-ready signals...");

    const symbols = ["SOL", "JUP", "RAY", "JTO", "WIF", "BONK", "POPCAT", "BOME", "PYTH", "RENDER"];
    const pairsRecord = await fetchMultipleTokenPairs(symbols);
    const profile = await getRiskProfile((ctx.from?.id || "").toString());
    const mode = profile.antiRugEnabled ? "SAFE" : "DEGEN";

    let messageText =
      `*SolPilot Signal Deck*\n\n` +
      `Mode: *${mode}*\n` +
      `Agent rule cap: *$${profile.maxTradeSize.toFixed(2)} per entry*, SL *-${profile.stopLossPct.toFixed(1)}%*, TP *+${profile.takeProfitPct.toFixed(1)}%*\n\n` +
      `These are scan targets for research, manual paper buys, or the autonomous paper agent.\n\n`;

    const categories = [
      { name: "Core Solana / DeFi", syms: ["SOL", "JUP", "RAY", "JTO"] },
      { name: "Solana Meme Momentum", syms: ["WIF", "BONK", "POPCAT", "BOME"] },
      { name: "Infra / DePIN", syms: ["PYTH", "RENDER"] }
    ];

    for (const cat of categories) {
      messageText += `*${cat.name}*\n`;
      for (const sym of cat.syms) {
        const pair = pairsRecord[sym];
        if (!pair) {
          messageText += `- *${sym}*: No live pair found\n`;
          continue;
        }

        const risk = analyzeTokenRisk(pair);
        const priceUsd = pair.priceUsd
          ? `$${parseFloat(pair.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
          : "N/A";
        const change24h = pair.priceChange?.h24 !== undefined ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";
        const liquidity = pair.liquidity?.usd ? `$${Math.round(pair.liquidity.usd).toLocaleString()}` : "N/A";

        let action = "Watch";
        if (risk.isRugPotential) action = mode === "DEGEN" ? "High-risk hunt" : "Blocked";
        else if (risk.score > 35) action = mode === "DEGEN" ? "Speculative" : "Wait";
        else action = mode === "DEGEN" ? "Momentum candidate" : "Research candidate";

        messageText += `- *${sym}*: ${priceUsd} (${change24h}) | Liq ${liquidity} | Risk ${risk.score}/100 | *${action}*\n`;
      }
      messageText += "\n";
    }

    messageText +=
      `Use the agent when you want SolPilot to follow rules automatically. Use token buttons when you want a single-token inspection.`;

    const keyboard = [
      [
        { text: "Start Paper Agent", callback_data: "agent_start" },
        { text: "Agent Rules", callback_data: "agent_rules" }
      ],
      [
        { text: "SOL", callback_data: "select_signal_SOL" },
        { text: "JUP", callback_data: "select_signal_JUP" },
        { text: "RAY", callback_data: "select_signal_RAY" },
        { text: "JTO", callback_data: "select_signal_JTO" }
      ],
      [
        { text: "WIF", callback_data: "select_signal_WIF" },
        { text: "BONK", callback_data: "select_signal_BONK" },
        { text: "POPCAT", callback_data: "select_signal_POPCAT" },
        { text: "BOME", callback_data: "select_signal_BOME" }
      ],
      [
        { text: "PYTH", callback_data: "select_signal_PYTH" },
        { text: "RENDER", callback_data: "select_signal_RENDER" },
        { text: "Custom Token", callback_data: "action_custom_ticker" }
      ],
      [
        { text: "Deposit / Live Access", callback_data: "menu_deposit" },
        { text: "Portfolio", callback_data: "menu_portfolio" }
      ]
    ];

    (ctx as any).session = { awaitingSymbol: true };

    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    } catch (e) {}

    await ctx.replyWithMarkdown(messageText, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    logger.error("showRecommendations error:", error);
    await ctx.reply("An error occurred loading token recommendations. Enter a token ticker directly, for example SOL, BONK, or WIF.");
    (ctx as any).session = { awaitingSymbol: true };
  }
}

/**
 * Performs DexScreener fetching, anti-rug audit, and AI signal analysis for a token.
 */
export async function analyzeAndReplySignal(ctx: Context, symbol: string) {
  try {
    const loadingMsg = await ctx.reply(`Analyzing "${symbol.toUpperCase()}" with DexScreener metrics, risk heuristics, and AI commentary...`);

    const pair = await fetchTokenPairDetails(symbol);
    if (!pair) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
      } catch (e) {}
      await ctx.reply(`No active trading pairs found for "${symbol.toUpperCase()}" on Solana. Check symbol or mint spelling.`);
      return;
    }

    const risk = analyzeTokenRisk(pair);
    const profile = await getRiskProfile((ctx.from?.id || "").toString());
    const mode = profile.antiRugEnabled ? "SAFE" : "DEGEN";
    const aiCommentary = await buildSignalExplanation(symbol, pair, risk, mode);

    const priceUsd = pair.priceUsd
      ? `$${parseFloat(pair.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
      : "N/A";
    const change24h = pair.priceChange?.h24 !== undefined ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";
    const liquidity = pair.liquidity?.usd ? `$${Math.round(pair.liquidity.usd).toLocaleString()}` : "N/A";
    const volume = pair.volume?.h24 ? `$${Math.round(pair.volume.h24).toLocaleString()}` : "N/A";
    const verdict = risk.isRugPotential ? "High risk" : risk.score > 35 ? "Speculative" : "Agent-watchable";

    const replyMsg =
      `*${pair.baseToken.symbol.toUpperCase()} / ${pair.quoteToken.symbol.toUpperCase()} Signal*\n\n` +
      `*Market*\n` +
      `- Price: *${priceUsd}*\n` +
      `- 24h Change: *${change24h}*\n` +
      `- Liquidity: *${liquidity}*\n` +
      `- 24h Volume: *${volume}*\n` +
      `- DEX: *${pair.dexId.toUpperCase()}*\n\n` +
      `*Risk Layer*\n` +
      `- Mode: *${mode}*\n` +
      `- Score: *${risk.score}/100* lower is safer\n` +
      `- Verdict: *${verdict}*\n` +
      `${risk.warnings.length > 0 ? risk.warnings.map(w => `  - ${w}`).join("\n") + "\n" : ""}\n` +
      `*AI Commentary*\n` +
      `${aiCommentary}\n\n` +
      `_${brand.disclaimer}_`;

    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    } catch (e) {}

    await ctx.replyWithMarkdown(replyMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `Paper Buy $50 ${pair.baseToken.symbol.toUpperCase()}`, callback_data: `quick_buy_${pair.baseToken.symbol}_50` },
            { text: `Paper Buy $100 ${pair.baseToken.symbol.toUpperCase()}`, callback_data: `quick_buy_${pair.baseToken.symbol}_100` }
          ],
          [
            { text: "Start Agent", callback_data: "agent_start" },
            { text: "Agent Rules", callback_data: "agent_rules" }
          ],
          [
            { text: "Refresh Signal", callback_data: `select_signal_${pair.baseToken.symbol}` },
            { text: "Signal Deck", callback_data: "menu_signal" }
          ]
        ]
      }
    });
  } catch (error) {
    logger.error("analyzeAndReplySignal error:", error);
    await ctx.reply("An error occurred during market signal extraction. Please verify your token query and try again.");
  }
}

