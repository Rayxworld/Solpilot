import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { brand } from "../branding";

export async function handleStart(ctx: Context) {
  const telegramId = ctx.from?.id.toString();
  if (telegramId) {
    await ensureUser(telegramId, ctx.from?.username);
  }

  await ctx.replyWithMarkdown(
    `*${brand.name}* 🚀\n_${brand.tagline}_\n\nHello, I'm your AI trading copilot for Solana.\n` +
    `I help you analyze Solana tokens with data-driven AI signals, track portfolio performance, and simulate trades in a paper trading sandbox.\n\n` +
    `Use the persistent dashboard menu at the bottom of your screen to navigate quickly, or type /help to view available commands.`,
    {
      reply_markup: {
        keyboard: [
          [
            { text: "📊 Get AI Signal" },
            { text: "💼 My Portfolio" }
          ],
          [
            { text: "👁️ Watchlist" },
            { text: "⚙️ Settings" },
            { text: "❓ Help" }
          ]
        ],
        resize_keyboard: true
      }
    }
  );
}
