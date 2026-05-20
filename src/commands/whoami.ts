import { Context } from "telegraf";

export async function handleWhoami(ctx: Context) {
  const user = ctx.from;
  const chat = ctx.chat;

  await ctx.replyWithMarkdown(
    `*Telegram Identity*\n\n` +
      `User ID: \`${user?.id || "Unknown"}\`\n` +
      `Chat ID: \`${chat?.id || "Unknown"}\`\n` +
      `Username: ${user?.username ? `@${user.username}` : "No username set"}\n\n` +
      `Set \`ADMIN_FEEDBACK_CHAT_ID=${chat?.id || "YOUR_CHAT_ID"}\` in your environment to receive beta feedback here.`
  );
}

