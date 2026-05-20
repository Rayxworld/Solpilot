import { Context } from "telegraf";
import { ensureUser, createAuditLog } from "../database/prismaDb";
import { config } from "../config/env";
import { logger } from "../utils/logger";

export async function handleFeedback(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    const text = ((ctx.message as any)?.text || "").trim();
    const parts = text.startsWith("/") ? text.split(/\s+/).slice(1) : [];
    const feedback = parts.join(" ").trim();

    if (!feedback) {
      (ctx as any).session = {
        ...((ctx as any).session || {}),
        awaitingFeedback: true
      };

      await ctx.replyWithMarkdown(
        `*Send Beta Feedback*\n\n` +
          `Reply with what felt confusing, broken, useful, or missing.\n\n` +
          `Examples:\n` +
          `- \`/fb signal deck is clear but agent status is too long\`\n` +
          `- \`/fb I expected /fund to show a wallet address\`\n` +
          `- \`/fb AI explanation was too cautious for DEGEN mode\``
      );
      return;
    }

    await saveFeedback(ctx, feedback);
  } catch (error) {
    logger.error("handleFeedback error:", error);
    await ctx.reply("An error occurred while saving feedback.");
  }
}

export async function saveFeedback(ctx: Context, feedback: string) {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const username = ctx.from?.username ? `@${ctx.from.username}` : "no_username";
  const trimmed = feedback.trim().slice(0, 2000);

  if (!trimmed) {
    await ctx.reply("Feedback was empty. Send a short note when you are ready.");
    return;
  }

  await createAuditLog(userId, "BETA_FEEDBACK", `${username}: ${trimmed}`);

  if (config.adminFeedbackChatId) {
    try {
      await ctx.telegram.sendMessage(
        config.adminFeedbackChatId,
        [
          "New SolPilot beta feedback",
          "",
          `From: ${username}`,
          `Telegram ID: ${userId}`,
          `Name: ${[ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || "Unknown"}`,
          "",
          trimmed
        ].join("\n")
      );
    } catch (error) {
      logger.error("Failed to forward beta feedback to admin chat:", error);
    }
  }

  await ctx.replyWithMarkdown(
    `*Feedback saved.*\n\nThanks. This beta gets better from exactly this kind of note.`
  );
}
