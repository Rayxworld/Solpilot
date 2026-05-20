import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { logger } from "../utils/logger";

/**
 * /deposit command
 *
 * MVP for now: acknowledges deposit intent and records it as a placeholder.
 * Real implementation (on-chain wallet + transfer tracking) will be added later.
 */
export async function handleDeposit(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    const text = (ctx.message as any)?.text || "";
    const parts = text.split(" ").slice(1);
    const amountStr = parts[0];

    // For MVP, we just parse and confirm.
    const amount = amountStr ? parseFloat(amountStr) : NaN;

    if (amountStr && (isNaN(amount) || amount <= 0)) {
      await ctx.reply("Usage: /deposit <amount_in_SOL> (example: /deposit 1.5)");
      return;
    }

    if (!amountStr) {
      await ctx.reply(
        "Deposit agent is not fully enabled yet in this MVP.\n" +
          "Next steps (planned): track a wallet deposit and then let the agent execute DEGEN swaps/snipes.\n\n" +
          "Usage (planned): /deposit <amount_in_SOL>\nExample: /deposit 1.5"
      );
      return;
    }

    await ctx.reply(
      `✅ Deposit request received (MVP): $${amount.toFixed(4)} SOL intent.\n` +
        `Next: on-chain wallet tracking + agent start + real swaps/snipes.\n\n` +
        `If you want paper-trading DEGEN behavior now, use /settings antirug 0 and press the Buy buttons.`
    );
  } catch (error: any) {
    logger.error("handleDeposit error:", error);
    await ctx.reply("An error occurred during deposit handling.");
  }
}

