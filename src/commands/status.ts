import { Context } from "telegraf";
import { getChainHealth } from "../solana/solanaUtils";

export async function handleStatus(ctx: Context) {
  await ctx.reply("🔌 Checking Solana RPC node connections...");
  const statusMsg = await getChainHealth();
  await ctx.reply(`*Solana Network Status:*\n\n${statusMsg}`, { parse_mode: "Markdown" });
}
