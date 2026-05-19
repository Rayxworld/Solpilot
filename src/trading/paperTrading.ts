import { prisma, TransactionClient } from "../database/prismaDb";
import { fetchTokenPairDetails } from "../market/dexScreener";
import { getRiskProfile, validateTradeRisk } from "../services/riskService";
import { logger } from "../utils/logger";

export interface TradeExecutionResult {
  success: boolean;
  message: string;
  pnl?: number;
  price?: number;
}

/**
 * Executes a simulated BUY order, validating funds and risk controls using Prisma PostgreSQL transactions
 */
export async function executePaperBuy(
  userId: string,
  symbolOrAddress: string,
  usdSize: number
): Promise<TradeExecutionResult> {
  try {
    // 1. Fetch token details
    const pair = await fetchTokenPairDetails(symbolOrAddress);
    if (!pair || !pair.priceUsd) {
      return {
        success: false,
        message: `Unable to locate an active trading pair for "${symbolOrAddress}" on DexScreener.`
      };
    }

    const tokenMint = pair.baseToken.address;
    const tokenSymbol = pair.baseToken.symbol;
    const entryPrice = parseFloat(pair.priceUsd);

    // 2. Enforce risk guidelines
    const riskCheck = await validateTradeRisk(userId, pair, usdSize);
    if (!riskCheck.allowed) {
      return {
        success: false,
        message: `Risk check rejected trade: ${riskCheck.reason}`
      };
    }

    // 3. Calculate amount of tokens bought
    const amount = usdSize / entryPrice;
    const costBasis = usdSize;

    // Retrieve default SL/TP parameters from user risk profile
    const profile = await getRiskProfile(userId);
    const stopLossPrice = entryPrice * (1 - profile.stopLossPct / 100);
    const takeProfitPrice = entryPrice * (1 + profile.takeProfitPct / 100);

    // 4. Perform database transaction in PostgreSQL
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const portfolio = await tx.portfolio.findUnique({
        where: { userId }
      });

      if (!portfolio || portfolio.cashBalance < usdSize) {
        throw new Error(`Insufficient simulated funds. Your current paper balance is $${portfolio ? portfolio.cashBalance.toFixed(2) : "0.00"}.`);
      }

      // Deduct funds
      await tx.portfolio.update({
        where: { userId },
        data: {
          cashBalance: {
            decrement: costBasis
          }
        }
      });

      // Insert paper trade position record
      const trade = await tx.paperTrade.create({
        data: {
          userId,
          tokenSymbol,
          tokenMint,
          type: "BUY",
          entryPrice,
          amount,
          costBasis,
          stopLoss: stopLossPrice,
          takeProfit: takeProfitPrice,
          status: "OPEN"
        }
      });

      // Create an audit log entry for this transaction
      await tx.auditLog.create({
        data: {
          userId,
          action: "PAPER_BUY",
          details: `Simulated BUY of ${amount.toFixed(4)} ${tokenSymbol} at $${entryPrice} USD. Cost basis: $${costBasis.toFixed(2)}.`
        }
      });

      return trade;
    });

    logger.info(`User ${userId} executed simulated BUY of ${amount} ${tokenSymbol} at $${entryPrice} (Trade ID: ${result.id})`);
    
    let msg = `Simulated BUY successful!\n` +
              `- Asset: ${tokenSymbol}\n` +
              `- Price: $${entryPrice}\n` +
              `- Amount: ${amount.toFixed(4)}\n` +
              `- Cost: $${usdSize.toFixed(2)}\n` +
              `- Stop Loss set at: $${stopLossPrice.toFixed(4)} (-${profile.stopLossPct}%)\n` +
              `- Take Profit set at: $${takeProfitPrice.toFixed(4)} (+${profile.takeProfitPct}%)`;
    if (riskCheck.warnings.length > 0) {
      msg += `\n\n⚠️ Heuristic Warnings:\n` + riskCheck.warnings.map(w => `- ${w}`).join("\n");
    }
    return { success: true, message: msg, price: entryPrice };
  } catch (error: any) {
    logger.error("executePaperBuy error:", error);
    return {
      success: false,
      message: error.message || "An unexpected error occurred during trade execution."
    };
  }
}

/**
 * Closes an open position by selling back all held tokens at current market price inside a transaction
 */
export async function executePaperSell(
  userId: string,
  tradeId: number
): Promise<TradeExecutionResult> {
  try {
    // 1. Fetch current price
    const trade = await prisma.paperTrade.findFirst({
      where: { id: tradeId, userId, status: "OPEN" }
    });
    if (!trade) {
      return {
        success: false,
        message: "Active position matching the provided ID was not found."
      };
    }

    const pair = await fetchTokenPairDetails(trade.tokenMint);
    if (!pair || !pair.priceUsd) {
      return {
        success: false,
        message: `Unable to look up active price feed for ${trade.tokenSymbol} to close trade.`
      };
    }

    const exitPrice = parseFloat(pair.priceUsd);
    const currentValue = trade.amount * exitPrice;
    const pnl = currentValue - trade.costBasis;
    const now = new Date();

    // 2. Perform database transaction in PostgreSQL
    await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.portfolio.update({
        where: { userId },
        data: {
          cashBalance: {
            increment: currentValue
          }
        }
      });

      await tx.paperTrade.update({
        where: { id: tradeId },
        data: {
          status: "CLOSED",
          exitPrice,
          closedAt: now,
          pnl
        }
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "PAPER_SELL",
          details: `Simulated SELL of ${trade.amount.toFixed(4)} ${trade.tokenSymbol} at $${exitPrice} USD. Proceeds: $${currentValue.toFixed(2)} | PnL: $${pnl.toFixed(2)}.`
        }
      });
    });

    logger.info(`User ${userId} executed simulated SELL of ${trade.amount} ${trade.tokenSymbol} at $${exitPrice} (PnL: $${pnl.toFixed(2)})`);

    const pnlPct = (pnl / trade.costBasis) * 100;
    return {
      success: true,
      message: `Simulated SELL successful!\n` +
               `- Closed: ${trade.tokenSymbol}\n` +
               `- Entry Price: $${trade.entryPrice.toFixed(4)}\n` +
               `- Exit Price: $${exitPrice.toFixed(4)}\n` +
               `- Proceeds: $${currentValue.toFixed(2)}\n` +
               `- Realized PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`,
      pnl,
      price: exitPrice
    };
  } catch (error: any) {
    logger.error("executePaperSell error:", error);
    return {
      success: false,
      message: error.message || "An unexpected error occurred during trade exit."
    };
  }
}

/**
 * Periodically reviews open positions to auto-trigger Stop Loss / Take Profit closing orders
 */
export async function runTriggerSlTpEvaluation(): Promise<number> {
  let closedCount = 0;
  try {
    const openTrades = await prisma.paperTrade.findMany({
      where: { status: "OPEN" }
    });

    for (const trade of openTrades) {
      try {
        const pair = await fetchTokenPairDetails(trade.tokenMint);
        if (!pair || !pair.priceUsd) continue;

        const currentPrice = parseFloat(pair.priceUsd);
        let triggerType = "";

        // Check SL trigger
        if (trade.stopLoss && currentPrice <= trade.stopLoss) {
          triggerType = "Stop Loss";
        }
        // Check TP trigger
        else if (trade.takeProfit && currentPrice >= trade.takeProfit) {
          triggerType = "Take Profit";
        }

        if (triggerType !== "") {
          const currentValue = trade.amount * currentPrice;
          const pnl = currentValue - trade.costBasis;
          const now = new Date();

          await prisma.$transaction(async (tx: TransactionClient) => {
            await tx.portfolio.update({
              where: { userId: trade.userId },
              data: {
                cashBalance: {
                  increment: currentValue
                }
              }
            });

            await tx.paperTrade.update({
              where: { id: trade.id },
              data: {
                status: "CLOSED",
                exitPrice: currentPrice,
                closedAt: now,
                pnl
              }
            });

            await tx.auditLog.create({
              data: {
                userId: trade.userId,
                action: "AUTO_CLOSE_TRIGGER",
                details: `Auto-closed position #${trade.id} of ${trade.tokenSymbol} due to ${triggerType} breach at $${currentPrice}. Realized PnL: $${pnl.toFixed(2)}.`
              }
            });
          });
          
          logger.info(`AUTO-TRIGGER CLOSED: ${trade.tokenSymbol} position #${trade.id} reached ${triggerType} target of $${currentPrice}. PnL: $${pnl.toFixed(2)}`);
          closedCount++;
        }
      } catch (tradeError) {
        logger.error(`Error auto-evaluating trade ID ${trade.id}:`, tradeError);
      }
    }
  } catch (error) {
    logger.error("runTriggerSlTpEvaluation error:", error);
  }
  return closedCount;
}
