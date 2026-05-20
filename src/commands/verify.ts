import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { formatVerificationPrompt, isUserVerified, verificationKeyboard, verifyUser } from "../services/verificationService";
import { logger } from "../utils/logger";

export async function handleVerify(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    if (isUserVerified(userId)) {
      await ctx.replyWithMarkdown(
        `*Account Verified*\n\nTelegram ID *${userId}* is already verified for this running SolPilot session.`
      );
      return;
    }

    await ctx.replyWithMarkdown(formatVerificationPrompt(ctx), verificationKeyboard());
  } catch (error) {
    logger.error("handleVerify error:", error);
    await ctx.reply("An error occurred while preparing account verification.");
  }
}

export async function confirmVerification(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);
    const verifiedAt = await verifyUser(userId);

    await ctx.replyWithMarkdown(
      `*Account Verified*\n\n` +
        `Telegram ID *${userId}* is now bound to this SolPilot session.\n` +
        `Verified at: *${verifiedAt.toLocaleString()}*\n\n` +
        `You can now use /agent start 100 or /deposit.`
    );
  } catch (error) {
    logger.error("confirmVerification error:", error);
    await ctx.reply("An error occurred while verifying your account.");
  }
}

