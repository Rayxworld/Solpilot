import { Context } from "telegraf";
import { brand } from "../branding";

export async function handleRisk(ctx: Context) {
  await ctx.replyWithMarkdown(
    `*SolPilot Beta Risk Advisory*\n\n` +
      `SolPilot beta is for AI-assisted research and paper trading only. Live deposits, withdrawals, and real swaps are locked.\n\n` +
      `*1. AI is a research layer*\n` +
      `AI commentary explains available market data. It can be wrong, stale, incomplete, or overconfident if upstream data is bad.\n\n` +
      `*2. Paper trades are simulations*\n` +
      `Paper entries do not include real slippage, failed transactions, priority fees, routing delays, MEV, or liquidity changes between quote and execution.\n\n` +
      `*3. Risk engine is heuristic*\n` +
      `SolPilot checks liquidity, age, volume, volatility, and suspicious conditions. These signals reduce obvious mistakes but cannot prove a token is safe.\n\n` +
      `*4. Before live funds*\n` +
      `The product still needs secure wallet handling, deposit reconciliation, withdrawal controls, transaction simulation, slippage limits, and emergency shutdowns.\n\n` +
      `*Disclosure*\n` +
      `_${brand.disclaimer}_`
  );
}

