import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { brand } from "../branding";

export async function handleStart(ctx: Context) {
  const telegramId = ctx.from?.id.toString();
  if (telegramId) {
    await ensureUser(telegramId, ctx.from?.username);
  }

  await ctx.replyWithMarkdown(
    `*${brand.name}*\n_${brand.tagline}_\n\n` +
      `SolPilot is your Solana strategy agent, not just a buy/sell chat bot.\n\n` +
      `Use signals to inspect tokens, set risk rules, then start the paper agent to scan, size, enter, and auto-manage simulated positions. Live deposits stay locked until production wallet controls are ready.`,
    {
      reply_markup: {
        keyboard: [
          [
            { text: "AI Signals" },
            { text: "SolPilot Agent" }
          ],
          [
            { text: "Portfolio" },
            { text: "Risk Settings" }
          ],
          [
            { text: "Deposit / Live Access" },
            { text: "Verify Account" }
          ],
          [
            { text: "Help" }
          ]
        ],
        resize_keyboard: true
      }
    }
  );
}
