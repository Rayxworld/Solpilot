import { Context } from "telegraf";
import { fetchTokenPairDetails, analyzeTokenRisk } from "../market/dexScreener";
import { buildSignalExplanation } from "../ai/aiEngine";
import { brand } from "../branding";
import { logger } from "../utils/logger";

export async function handleSignal(ctx: Context) {
  try {
    const text = (ctx.message as any)?.text || "";
    const parts = text.split(" ").slice(1);
    const symbol = parts.join(" ").trim();

    if (!symbol) {
      await ctx.reply("Please provide a token symbol or address after /signal (e.g. /signal SOL or /signal WIF)");
      return;
    }

    await ctx.reply(`🔍 Analyzing "${symbol.toUpperCase()}"... Running DexScreener metrics & risk heuristic engine.`);

    const pair = await fetchTokenPairDetails(symbol);
    if (!pair) {
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

    await ctx.replyWithMarkdown(replyMsg);
  } catch (error) {
    logger.error("handleSignal error:", error);
    await ctx.reply("An error occurred during market signal extraction. Please verify your token query and try again.");
  }
}
