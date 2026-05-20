import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { logger } from "../utils/logger";

/**
 * /agent command
 *
 * MVP for now: acknowledges that the agent would start.
 * Real implementation will create a background worker loop for watchlist/snipe execution.
 */
export async function handleAgent(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    const text = (ctx.message as any)?.text || "";
    const parts = text.split(" ").slice(1);
    const action = (parts[0] || "status").toLowerCase();

    if (action === "start") {
      await ctx.reply(
        "🤖 Agent start requested (MVP).\n" +
          "Next: connect wallet/deposit tracking and enable real swaps/snipes execution."
      );
      return;
    }

    if (action === "stop") {
      await ctx.reply(
        "🛑 Agent stop requested (MVP).\n" +
          "Next: implement cancellation + worker shutdown." 
      );
      return;
    }

    await ctx.reply(
      "🤖 Agent controls (MVP)\n\n" +
        "• /agent start\n" +
        "• /agent stop\n" +
        "• /agent status\n\n" +
        "Real execution requires: wallet management, deposit tracking, and Jupiter/swap execution." 
    );
  } catch (error: any) {
    logger.error("handleAgent error:", error);
    await ctx.reply("An error occurred while processing the agent command.");
  }
}

