import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { getPortfolioSummary, getOpenPositions } from "../services/portfolioService";
import { logger } from "../utils/logger";

export async function handlePortfolio(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);
    
    // Fetch live summary and positions
    const summary = await getPortfolioSummary(userId);
    if (!summary) {
      await ctx.reply("Unable to load portfolio details. Please verify your profile via /start.");
      return;
    }

    const openPositions = await getOpenPositions(userId);

    let positionListText = "";
    if (openPositions.length === 0) {
      positionListText = "No open simulated positions. Use /papertrade to open a position.";
    } else {
      positionListText = openPositions.map((pos) => {
        const sign = pos.unrealizedPnl >= 0 ? "+" : "";
        return `*#${pos.id}: ${pos.tokenSymbol.toUpperCase()}*\n` +
               `  • Holdings: ${pos.amount.toFixed(4)} tokens\n` +
               `  • Cost: $${pos.costBasis.toFixed(2)} | Current: $${pos.currentValue.toFixed(2)}\n` +
               `  • PnL: ${sign}$${pos.unrealizedPnl.toFixed(2)} (${sign}${pos.unrealizedPnlPct.toFixed(2)}%)\n` +
               `  • SL: ${pos.stopLoss ? `$${pos.stopLoss.toFixed(4)}` : "None"} | TP: ${pos.takeProfit ? `$${pos.takeProfit.toFixed(4)}` : "None"}`;
      }).join("\n\n");
    }

    const totalPnL = summary.totalPortfolioValue - 10000.0; // PnL against $10,000 baseline
    const sign = totalPnL >= 0 ? "+" : "";

    await ctx.replyWithMarkdown(
      `*SolPilot Paper Portfolio* 💼\n\n` +
      `- Cash Balance: *$${summary.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n` +
      `- Open Positions Value: *$${summary.totalHoldingsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n` +
      `- Total Portfolio Net Worth: *$${summary.totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n` +
      `- All-time Paper PnL: *${sign}$${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n\n` +
      `*Active Open Positions (${summary.openPositionsCount}):*\n\n` +
      `${positionListText}\n\n` +
      `To close a position, use \`/papertrade sell <position_id>\``
    );
  } catch (error) {
    logger.error("handlePortfolio error:", error);
    await ctx.reply("An error occurred while compiling your portfolio summary.");
  }
}
