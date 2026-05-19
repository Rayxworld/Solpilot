import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { executePaperBuy, executePaperSell } from "../trading/paperTrading";
import { logger } from "../utils/logger";

export async function handlePaperTrade(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    const text = (ctx.message as any)?.text || "";
    const parts = text.split(" ").slice(1);
    const action = parts[0]?.toLowerCase();

    if (action === "buy") {
      const symbol = parts[1];
      const usdSizeStr = parts[2];

      if (!symbol || !usdSizeStr) {
        await ctx.reply("Usage: `/papertrade buy <ticker|address> <size_in_usd>`\nExample: `/papertrade buy SOL 100`", { parse_mode: "Markdown" });
        return;
      }

      const usdSize = parseFloat(usdSizeStr);
      if (isNaN(usdSize) || usdSize <= 0) {
        await ctx.reply("Please enter a valid positive trade size in USD.");
        return;
      }

      await ctx.reply(`⏳ Initiating simulated buy order for ${symbol.toUpperCase()} ($${usdSize.toFixed(2)} size)...`);
      const result = await executePaperBuy(userId, symbol, usdSize);
      await ctx.reply(result.message);
      return;
    }

    if (action === "sell") {
      const idStr = parts[1];
      if (!idStr) {
        await ctx.reply("Usage: `/papertrade sell <position_id>`\nExample: `/papertrade sell 2`", { parse_mode: "Markdown" });
        return;
      }

      const tradeId = parseInt(idStr, 10);
      if (isNaN(tradeId)) {
        await ctx.reply("Please provide a numeric position ID.");
        return;
      }

      await ctx.reply(`⏳ Executing simulated sell order for position #${tradeId}...`);
      const result = await executePaperSell(userId, tradeId);
      await ctx.reply(result.message);
      return;
    }

    // Default response: instructions
    await ctx.replyWithMarkdown(
      `*SolPilot Simulated Paper Trading Sandbox* 🎮\n\n` +
      `You can buy and sell tokens with simulated $USD balance without real money at stake.\n\n` +
      `*How to execute:*\n` +
      `• *BUY:* \`/papertrade buy <ticker|address> <usd_size>\`\n` +
      `  _Example:_ \`/papertrade buy SOL 250\`\n\n` +
      `• *SELL:* \`/papertrade sell <position_id>\`\n` +
      `  _Example:_ \`/papertrade sell 1\`\n\n` +
      `Type /portfolio to check your open position IDs and current paper wallet balance.`
    );
  } catch (error) {
    logger.error("handlePaperTrade error:", error);
    await ctx.reply("An error occurred during simulated transaction execution.");
  }
}
