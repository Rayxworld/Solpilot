import { Context } from "telegraf";
import { ensureUser, createAuditLog } from "../database/prismaDb";
import { requireVerification } from "../services/verificationService";
import { logger } from "../utils/logger";

/**
 * /deposit command
 *
 * Shows the safer SolPilot deposit model. Live custody is intentionally locked
 * until wallet generation, private-key storage, withdrawals, and swap execution
 * are production-ready.
 */
export async function handleDeposit(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);
    if (!(await requireVerification(ctx))) return;

    const text = ((ctx.message as any)?.text || "").trim();
    const parts = text.startsWith("/deposit") || text.startsWith("/fund") ? text.split(/\s+/).slice(1) : [];
    const amountStr = parts[0];
    const amount = amountStr ? parseFloat(amountStr) : undefined;

    if (amountStr && (!amount || Number.isNaN(amount) || amount <= 0)) {
      await ctx.reply("Usage: /deposit <amount_in_SOL>. Example: /deposit 0.1");
      return;
    }

    await createAuditLog(userId, "DEPOSIT_VIEWED", amount ? `Deposit intent viewed for ${amount} SOL.` : "Deposit screen viewed.");

    await ctx.replyWithMarkdown(
      `*SolPilot Deposit & Live Agent Access*\n\n` +
        `You stay in control. SolPilot does not ask for your seed phrase and live trading remains locked until production custody controls are enabled.\n\n` +
        `*Current mode:* Paper agent only\n` +
        `*Live wallet:* Locked until the wallet service can safely create, track, and withdraw funds\n` +
        `*Requested amount:* ${amount ? `${amount.toFixed(4)} SOL` : "Not specified"}\n\n` +
        `What makes SolPilot different:\n` +
        `- Pantr-style command trading is only the base layer.\n` +
        `- SolPilot adds strategy rules, risk sizing, auto exits, and agent scans.\n` +
        `- Live swaps will unlock only after deposits, withdrawals, slippage limits, and audit logs are complete.\n\n` +
        `For now, run \`/agent start 100\` to let the agent trade a simulated $100 strategy budget.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Start Paper Agent", callback_data: "agent_start" },
              { text: "Agent Rules", callback_data: "agent_rules" }
            ],
            [
              { text: "Signals", callback_data: "menu_signal" },
              { text: "Portfolio", callback_data: "menu_portfolio" }
            ]
          ]
        }
      }
    );
  } catch (error: any) {
    logger.error("handleDeposit error:", error);
    await ctx.reply("An error occurred during deposit handling.");
  }
}
