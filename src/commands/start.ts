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
    `Choose an option below or type /help to view available commands.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Get Signal", callback_data: "menu_signal" }],
          [{ text: "💼 My Portfolio", callback_data: "menu_portfolio" }],
          [{ text: "⚙️ Risk Settings", callback_data: "menu_settings" }],
          [{ text: "💡 How it works", callback_data: "menu_help" }]
        ]
      }
    }
  );
}
