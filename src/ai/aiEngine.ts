import OpenAI from "openai";
import { config } from "../config/env";
import { TokenPair, RiskAnalysis } from "../market/dexScreener";
import { logger } from "../utils/logger";

const openai = new OpenAI({
  apiKey: config.openAiApiKey,
  baseURL: config.openAiBaseUrl
});

/**
 * Builds a professional, uncertainty-aware trading signal summary using OpenAI
 */
export async function buildSignalExplanation(
  symbol: string,
  pair: TokenPair | null,
  risk: RiskAnalysis | null
): Promise<string> {
  let contextInfo = "";

  if (pair) {
    const price = pair.priceUsd || "N/A";
    const change24h = pair.priceChange?.h24 !== undefined ? `${pair.priceChange.h24}%` : "N/A";
    const liquidity = pair.liquidity?.usd ? `$${pair.liquidity.usd.toLocaleString()}` : "N/A";
    const volume24h = pair.volume?.h24 ? `$${pair.volume.h24.toLocaleString()}` : "N/A";
    const dex = pair.dexId || "N/A";

    contextInfo = `
Real-time market metrics for ${symbol}:
- Price: $${price}
- 24h Change: ${change24h}
- Liquidity: ${liquidity}
- 24h Trading Volume: ${volume24h}
- DEX: ${dex}
`;

    if (risk) {
      contextInfo += `
Safety Heuristic Profile:
- Risk Score: ${risk.score}/100
- Warnings: ${risk.warnings.join("; ")}
- High Rug Risk Detected: ${risk.isRugPotential ? "YES" : "NO"}
`;
    }
  } else {
    contextInfo = `No live token pair found for ${symbol} on Solana. Displaying general ecosystem indicators.`;
  }

  const prompt = `
You are SolPilot, a highly professional backend architect, crypto analyst, and AI copilot for Solana. Your job is to explain the market situation for the token "${symbol.toUpperCase()}" based on real-time data.

${contextInfo}

CRITICAL DIRECTIVES:
1. Speak with professional humility. NEVER guarantee profits, state that a trade is a "guaranteed win", or use hype/FOMO-inducing statements.
2. Emphasize risk. If there are safety warnings or a high rug risk, explicitly mention why this token has increased risks.
3. Be concise and actionable. Explain what the current liquidity, volume, and momentum indicate about the token's trading status.
4. Keep the output under 140 words. Use bullet points for readability if helpful.
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
        model: model,
        messages: [
          { 
            role: "system", 
            content: "You are a professional, highly cautious crypto trading research assistant. You speak objectively and always warn users of high risk and volatility." 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.5
      });

      const content = response.choices?.[0]?.message?.content?.trim();
      if (content) {
        logger.info(`Successfully generated AI commentary with model: ${model}`);
        return content;
      }
    } catch (error: any) {
      lastError = error;
      logger.warn(`Model ${model} failed to generate commentary: ${error?.message || error}`);
      // Wait 500ms before trying the next model
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  logger.error("All fallback models failed in buildSignalExplanation. Last error:", lastError);
  return `⚠️ SolPilot AI commentary is temporarily optimizing its neural weights. Tap "Refresh Signal" to retry, or check back shortly!`;
}

