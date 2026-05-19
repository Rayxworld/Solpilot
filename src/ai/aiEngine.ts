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

  try {
    const response = await openai.chat.completions.create({
      model: config.openAiModel,
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

    return response.choices?.[0]?.message?.content?.trim() || "Failed to generate market signal commentary.";
  } catch (error) {
    logger.error("buildSignalExplanation error:", error);
    return "Error communicating with the AI Engine. Please check the network or token parameters.";
  }
}
