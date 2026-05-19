import { Context } from "telegraf";
import { brand } from "../branding";

export async function handleRisk(ctx: Context) {
  await ctx.replyWithMarkdown(
    `*SolPilot Safe Trading & Risk Advisory* ⚠️\n\n` +
    `Meme coins and new token launches in the Solana ecosystem are subject to extreme market forces. Please review our safety criteria before engaging in paper or live trading:\n\n` +
    `*1. Heuristic Risk Analysis Score:*\n` +
    `Our built-in engine checks every token for common rug-pull markers: liquidity pool depth, pool age, trading volumes, and extreme volatility. A risk rating is calculated automatically to help you identify bad contracts.\n\n` +
    `*2. Volatility Warnings:*\n` +
    `Solana tokens can experience price swings of +/- 90% in minutes. Always ensure your risk profiles (Stop-Loss and Take-Profit) are configured in /settings to automate downside protection.\n\n` +
    `*3. The Golden Rule:*\n` +
    `Never risk funds you cannot afford to lose. Utilize our paper trading sandbox (/papertrade) to fully backtest your strategy parameters in real-time before moving to live funds.\n\n` +
    `*Standard Risk Disclosure:*\n` +
    `_${brand.disclaimer}_`
  );
}
