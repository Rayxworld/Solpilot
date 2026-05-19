import { logger } from "../utils/logger";

export interface TokenPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

export interface RiskAnalysis {
  score: number; // 0 (safe) to 100 (extremely risky / potential rug)
  warnings: string[];
  isRugPotential: boolean;
}

/**
 * Service to fetch market data from DexScreener API
 */
export async function fetchTokenPairDetails(symbolOrAddress: string): Promise<TokenPair | null> {
  const url = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(symbolOrAddress)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.pairs || data.pairs.length === 0) return null;

    // Filter for Solana pairs where the symbol or address matches the query case-insensitively
    const queryUpper = symbolOrAddress.toUpperCase();
    const solanaPairs = data.pairs.filter((p: any) => {
      if (p.chainId !== "solana") return false;
      const baseSymbol = p.baseToken?.symbol?.toUpperCase();
      const baseAddress = p.baseToken?.address?.toUpperCase();
      return baseSymbol === queryUpper || baseAddress === queryUpper;
    });

    if (solanaPairs.length === 0) return null;

    // Sort by liquidity USD descending to prioritize the main trading pool
    solanaPairs.sort((a: any, b: any) => {
      const liqA = a.liquidity?.usd || 0;
      const liqB = b.liquidity?.usd || 0;
      return liqB - liqA;
    });

    return solanaPairs[0];
  } catch (error) {
    logger.error("fetchTokenPairDetails error:", error);
    return null;
  }
}

/**
 * Analyzes active market metrics to detect suspicious or high-risk meme coins
 */
export function analyzeTokenRisk(pair: TokenPair): RiskAnalysis {
  let score = 0;
  const warnings: string[] = [];

  const liquidity = pair.liquidity?.usd || 0;
  const volume24h = pair.volume?.h24 || 0;
  const priceChange24h = Math.abs(pair.priceChange?.h24 || 0);
  const pairCreatedAt = pair.pairCreatedAt;

  // 1. Low Liquidity Check
  if (liquidity < 5000) {
    score += 45;
    warnings.push("Extremely low liquidity (< $5k USD) — highly susceptible to rugs and slippage.");
  } else if (liquidity < 20000) {
    score += 25;
    warnings.push("Low liquidity (< $20k USD) — volatile slippage warning.");
  }

  // 2. Volume Check
  if (volume24h < 2000) {
    score += 20;
    warnings.push("Negligible trading volume (< $2k 24h) — token might be dead or inactive.");
  }

  // 3. Volatility Check
  if (priceChange24h > 150) {
    score += 20;
    warnings.push(`Extreme 24h price volatility (${pair.priceChange?.h24}%).`);
  }

  // 4. Token Age Heuristic
  if (pairCreatedAt) {
    const ageHours = (Date.now() - pairCreatedAt) / (1000 * 60 * 60);
    if (ageHours < 2) {
      score += 30;
      warnings.push("Extremely fresh pool (< 2 hours old) — high risk of developer exit.");
    } else if (ageHours < 24) {
      score += 15;
      warnings.push("Fresh pool (< 24 hours old).");
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  return {
    score,
    warnings,
    isRugPotential: score >= 60
  };
}
