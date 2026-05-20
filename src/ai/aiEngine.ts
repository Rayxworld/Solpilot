import OpenAI from "openai";
import { config } from "../config/env";
import { TokenPair, RiskAnalysis } from "../market/dexScreener";
import { logger } from "../utils/logger";

const openai = new OpenAI({
  apiKey: config.openAiApiKey,
  baseURL: config.openAiBaseUrl
});

function buildFallbackSignal(symbol: string, pair: TokenPair | null, risk: RiskAnalysis | null, mode: "SAFE" | "DEGEN"): string {
  if (!pair) {
    return [
      `- Market read: I could not confirm an active Solana pair for ${symbol.toUpperCase()}.`,
      "- Agent stance: Do not paper-enter until a valid pair and price feed are available.",
      "- Risk check: Unknown liquidity and routing make this unsuitable for beta agent execution."
    ].join("\n");
  }

  const liquidity = pair.liquidity?.usd || 0;
  const volume24h = pair.volume?.h24 || 0;
  const change24h = pair.priceChange?.h24;
  const riskScore = risk?.score ?? 0;
  const stance = risk?.isRugPotential
    ? mode === "DEGEN" ? "High-risk watch only" : "Blocked by SAFE mode"
    : riskScore > 35 ? "Watchlist candidate" : "Paper-agent candidate";

  return [
    `- Market read: ${pair.baseToken.symbol} has about $${Math.round(liquidity).toLocaleString()} liquidity and $${Math.round(volume24h).toLocaleString()} 24h volume${change24h !== undefined ? `, with ${change24h >= 0 ? "+" : ""}${change24h}% 24h change` : ""}.`,
    `- Agent stance: ${stance}.`,
    `- Risk check: Score ${riskScore}/100. ${risk?.warnings.length ? risk.warnings.join(" ") : "No major heuristic warning from the current data."}`
  ].join("\n");
}

/**
 * Builds a professional, uncertainty-aware trading signal summary using OpenAI.
 */
export async function buildSignalExplanation(
  symbol: string,
  pair: TokenPair | null,
  risk: RiskAnalysis | null,
  mode: "SAFE" | "DEGEN" = "SAFE"
): Promise<string> {
  let contextInfo = "";

  if (pair) {
    const price = pair.priceUsd || "N/A";
    const change24h = pair.priceChange?.h24 !== undefined ? `${pair.priceChange.h24}%` : "N/A";
    const change1h = pair.priceChange?.h1 !== undefined ? `${pair.priceChange.h1}%` : "N/A";
    const change5m = pair.priceChange?.m5 !== undefined ? `${pair.priceChange.m5}%` : "N/A";
    const liquidity = pair.liquidity?.usd ? `$${pair.liquidity.usd.toLocaleString()}` : "N/A";
    const volume24h = pair.volume?.h24 ? `$${pair.volume.h24.toLocaleString()}` : "N/A";
    const volume1h = pair.volume?.h1 ? `$${pair.volume.h1.toLocaleString()}` : "N/A";
    const txns5m = pair.txns?.m5 ? `${pair.txns.m5.buys} buys / ${pair.txns.m5.sells} sells` : "N/A";
    const dex = pair.dexId || "N/A";

    contextInfo = `
Real-time market metrics for ${symbol}:
- Price: $${price}
- 5m Change: ${change5m}
- 1h Change: ${change1h}
- 24h Change: ${change24h}
- Liquidity: ${liquidity}
- 1h Trading Volume: ${volume1h}
- 24h Trading Volume: ${volume24h}
- 5m Transactions: ${txns5m}
- DEX: ${dex}
`;

    if (risk) {
      contextInfo += `
Safety Heuristic Profile:
- Risk Score: ${risk.score}/100
- Warnings: ${risk.warnings.join("; ") || "None"}
- High Rug Risk Detected: ${risk.isRugPotential ? "YES" : "NO"}
`;
    }
  } else {
    contextInfo = `No live token pair found for ${symbol} on Solana.`;
  }

  const prompt = `
You are SolPilot, an AI strategy copilot for Solana paper trading beta users. Explain the market situation for "${symbol.toUpperCase()}" using only the supplied real-time data.

${contextInfo}

MODE INSTRUCTIONS (${mode}):
- If mode is DEGEN, focus on momentum/tempo, acknowledge higher rug risk clearly, and describe what would invalidate the idea.
- If mode is SAFE, focus on downside, uncertainty, and risk reduction.

CRITICAL DIRECTIVES:
1. Never guarantee profits, imply certainty, or create FOMO.
2. Do not tell the user to use real money. This product is in paper-agent beta.
3. Be concise and actionable.
4. Use exactly 3 bullets with these labels:
   - Market read:
   - Agent stance:
   - Risk check:
5. Keep the output under 120 words.
`;

  const fallbackModels = [
    config.openAiModel,
    "google/gemini-2.5-flash:free",
    "meta-llama/llama-3-8b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free"
  ].filter(Boolean);

  let lastError: any = null;

  for (const model of fallbackModels) {
    try {
      logger.info(`Attempting to generate AI commentary using model: ${model}`);
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are a cautious Solana paper-trading research assistant. You speak objectively, never promise profits, and always separate paper beta signals from real-money advice."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 180,
        temperature: 0.35
      });

      const content = response.choices?.[0]?.message?.content?.trim();
      if (content) {
        logger.info(`Successfully generated AI commentary with model: ${model}`);
        return content;
      }
    } catch (error: any) {
      lastError = error;
      logger.warn(`Model ${model} failed to generate commentary: ${error?.message || error}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  logger.error("All fallback models failed in buildSignalExplanation. Last error:", lastError);
  return buildFallbackSignal(symbol, pair, risk, mode);
}

