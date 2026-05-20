import { Context } from "telegraf";
import { createAuditLog } from "../database/prismaDb";

const verifiedUsers = new Map<string, Date>();

export function isUserVerified(userId: string): boolean {
  return verifiedUsers.has(userId);
}

export async function verifyUser(userId: string): Promise<Date> {
  const verifiedAt = new Date();
  verifiedUsers.set(userId, verifiedAt);
  await createAuditLog(userId, "USER_VERIFIED", `Telegram user verified at ${verifiedAt.toISOString()}.`);
  return verifiedAt;
}

export function formatVerificationPrompt(ctx: Context): string {
  const user = ctx.from;
  const username = user?.username ? `@${user.username}` : "No username set";
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unknown";

  return [
    "*Verify Your SolPilot Account*",
    "",
    "Before agent or deposit actions, confirm this Telegram account is the one SolPilot should bind to your trading profile.",
    "",
    `Telegram ID: *${user?.id || "Unknown"}*`,
    `Username: *${username}*`,
    `Name: *${displayName}*`,
    "",
    "Tap *Verify Me* to continue."
  ].join("\n");
}

export function verificationKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Verify Me", callback_data: "verify_user" }
        ],
        [
          { text: "Help", callback_data: "menu_help" }
        ]
      ]
    }
  };
}

export async function requireVerification(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id.toString();
  if (!userId) return false;
  if (isUserVerified(userId)) return true;

  await ctx.replyWithMarkdown(formatVerificationPrompt(ctx), verificationKeyboard());
  return false;
}

