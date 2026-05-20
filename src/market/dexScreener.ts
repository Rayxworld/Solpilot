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

export const COMMON_MINTS: { [key: string]: string } = {
  SOL: "So11111111111111111111111111111111111111112",
  WSOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
};

/**
 * Service to fetch multiple market data details from DexScreener API in a single batch request
 */
export async function fetchMultipleTokenPairs(symbolsOrAddresses: string[]): Promise<Record<string, TokenPair>> {
  if (symbolsOrAddresses.length === 0) return {};

  const resolvedAddresses = symbolsOrAddresses.map(sym => {
    const symUpper = sym.trim().toUpperCase();
    return COMMON_MINTS[symUpper] || sym.trim();
  });

  const uniqueAddresses = Array.from(new Set(resolvedAddresses));
  const url = `https://api.dexscreener.com/latest/dex/tokens/${uniqueAddresses.join(",")}`;

  const results: Record<string, TokenPair> = {};

  try {
    logger.info(`Fetching batch market data from DexScreener for ${uniqueAddresses.length} addresses`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      logger.warn(`DexScreener API returned non-OK status: ${response.status} ${response.statusText} for batch`);
      return results;
    }

    const data: any = await response.json();
    if (!data.pairs || data.pairs.length === 0) {
      logger.info(`DexScreener batch endpoint returned 0 pairs`);
      for (const input of symbolsOrAddresses) {
        const pair = await fetchTokenPairDetails(input);
        if (pair) results[input] = pair;
      }
      return results;
    }

    // For each query symbol, map it to the matching pair from the response
    for (let i = 0; i < symbolsOrAddresses.length; i++) {
      const originalInput = symbolsOrAddresses[i];
      const resolvedAddress = resolvedAddresses[i].toUpperCase();

      const matchingPairs = data.pairs.filter((p: any) => {
        if (p.chainId !== "solana") return false;
        const baseAddress = p.baseToken?.address?.toUpperCase();
        return baseAddress === resolvedAddress;
      });

      if (matchingPairs.length > 0) {
        // Sort by liquidity USD descending
        matchingPairs.sort((a: any, b: any) => {
          const liqA = a.liquidity?.usd || 0;
          const liqB = b.liquidity?.usd || 0;
          return liqB - liqA;
        });
        results[originalInput] = matchingPairs[0];
      }
    }

    const missingInputs = symbolsOrAddresses.filter(input => !results[input]);
    for (const input of missingInputs) {
      const pair = await fetchTokenPairDetails(input);
      if (pair) results[input] = pair;
    }

    return results;
  } catch (error) {
    logger.error("fetchMultipleTokenPairs error:", error);
    for (const input of symbolsOrAddresses) {
      if (results[input]) continue;
      const pair = await fetchTokenPairDetails(input);
      if (pair) results[input] = pair;
    }
    return results;
  }
}

/**
 * Service to fetch market data from DexScreener API
 */
export async function fetchTokenPairDetails(symbolOrAddress: string): Promise<TokenPair | null> {
  const query = symbolOrAddress.trim();
  const queryUpper = query.toUpperCase();
  const resolvedQuery = COMMON_MINTS[queryUpper] || query;

  const url = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`;
  try {
    logger.info(`Fetching market data from DexScreener for query: "${query}"`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      logger.warn(`DexScreener API returned non-OK status: ${response.status} ${response.statusText} for query: ${query}`);
      return null;
    }

    const data: any = await response.json();
    if (!data.pairs || data.pairs.length === 0) {
      logger.info(`DexScreener returned 0 pairs for query: ${query}`);
      return null;
    }

    // Filter for Solana pairs where the symbol or address matches the query or resolved address case-insensitively
    const solanaPairs = data.pairs.filter((p: any) => {
      if (p.chainId !== "solana") return false;
      const baseSymbol = p.baseToken?.symbol?.toUpperCase();
      const baseAddress = p.baseToken?.address?.toUpperCase();
      return baseSymbol === queryUpper || baseAddress === queryUpper || baseAddress === resolvedQuery.toUpperCase();
    });

    if (solanaPairs.length === 0) {
      logger.info(`DexScreener found ${data.pairs.length} pairs, but 0 matched Solana chain and symbol/address: ${query}`);
      return null;
    }

    // Sort by liquidity USD descending to prioritize the main trading pool
    solanaPairs.sort((a: any, b: any) => {
      const liqA = a.liquidity?.usd || 0;
      const liqB = b.liquidity?.usd || 0;
      return liqB - liqA;
    });

    logger.info(`Successfully resolved primary Solana pair for ${query} with liquidity: $${solanaPairs[0].liquidity?.usd || 0}`);
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
  // Keep this warning intentionally rare; it fires only for very low volume.
  if (volume24h < 500) {
    score += 20;
    warnings.push("Negligible trading volume (< $500 24h) — token might be dead or inactive.");
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
