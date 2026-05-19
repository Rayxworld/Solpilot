import { prisma } from "../database/prismaDb";
import { logger } from "../utils/logger";

export interface PortfolioSummary {
  cashBalance: number;
  totalHoldingsValue: number;
  totalPortfolioValue: number;
  openPositionsCount: number;
}

export interface OpenPosition {
  id: number;
  tokenSymbol: string;
  tokenMint: string;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradeHistory {
  id: number;
  tokenSymbol: string;
  type: string;
  entryPrice: number;
  exitPrice?: number;
  amount: number;
  costBasis: number;
  pnl?: number;
  status: string;
  openedAt: number;
  closedAt?: number;
}

/**
 * Calculates current PnL and holds portfolio query methods using Prisma/PostgreSQL
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary | null> {
  try {
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId }
    });
    if (!portfolio) return null;

    const cash = portfolio.cashBalance;

    // Get open positions
    const openTrades = await prisma.paperTrade.findMany({
      where: { userId, status: "OPEN" }
    });
    
    let holdingsValue = 0;
    for (const trade of openTrades) {
      let currentPrice = trade.entryPrice;
      try {
        const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(trade.tokenMint)}`);
        if (dexResponse.ok) {
          const data = await dexResponse.json();
          const solanaPair = data.pairs?.find((p: any) => p.chainId === "solana" && p.baseToken?.address === trade.tokenMint);
          if (solanaPair && solanaPair.priceUsd) {
            currentPrice = parseFloat(solanaPair.priceUsd);
          }
        }
      } catch (e) {
        // Suppress network errors silently
      }
      holdingsValue += trade.amount * currentPrice;
    }

    return {
      cashBalance: cash,
      totalHoldingsValue: holdingsValue,
      totalPortfolioValue: cash + holdingsValue,
      openPositionsCount: openTrades.length
    };
  } catch (error) {
    logger.error("getPortfolioSummary error:", error);
    return null;
  }
}

/**
 * Retrieves list of open trading positions for the paper trade engine using Prisma
 */
export async function getOpenPositions(userId: string): Promise<OpenPosition[]> {
  try {
    const openTrades = await prisma.paperTrade.findMany({
      where: { userId, status: "OPEN" }
    });
    const positions: OpenPosition[] = [];

    for (const trade of openTrades) {
      let currentPrice = trade.entryPrice;
      try {
        const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(trade.tokenMint)}`);
        if (dexResponse.ok) {
          const data = await dexResponse.json();
          const solanaPair = data.pairs?.find((p: any) => p.chainId === "solana" && p.baseToken?.address === trade.tokenMint);
          if (solanaPair && solanaPair.priceUsd) {
            currentPrice = parseFloat(solanaPair.priceUsd);
          }
        }
      } catch (e) {
        // Fallback to entry price silently
      }

      const currentValue = trade.amount * currentPrice;
      const unrealizedPnl = currentValue - trade.costBasis;
      const unrealizedPnlPct = (unrealizedPnl / trade.costBasis) * 100;

      positions.push({
        id: trade.id,
        tokenSymbol: trade.tokenSymbol,
        tokenMint: trade.tokenMint,
        entryPrice: trade.entryPrice,
        currentPrice,
        amount: trade.amount,
        costBasis: trade.costBasis,
        currentValue,
        unrealizedPnl,
        unrealizedPnlPct,
        stopLoss: trade.stopLoss || undefined,
        takeProfit: trade.takeProfit || undefined
      });
    }

    return positions;
  } catch (error) {
    logger.error("getOpenPositions error:", error);
    return [];
  }
}

/**
 * Gets historic records for the user's paper trading activity using Prisma
 */
export async function getTradeHistory(userId: string): Promise<TradeHistory[]> {
  try {
    const rows = await prisma.paperTrade.findMany({
      where: { userId },
      orderBy: { openedAt: "desc" }
    });
    return rows.map((r: any) => ({
      id: r.id,
      tokenSymbol: r.tokenSymbol,
      type: r.type,
      entryPrice: r.entryPrice,
      exitPrice: r.exitPrice || undefined,
      amount: r.amount,
      costBasis: r.costBasis,
      pnl: r.pnl !== null ? r.pnl : undefined,
      status: r.status,
      openedAt: r.openedAt.getTime(),
      closedAt: r.closedAt ? r.closedAt.getTime() : undefined
    }));
  } catch (error) {
    logger.error("getTradeHistory error:", error);
    return [];
  }
}
