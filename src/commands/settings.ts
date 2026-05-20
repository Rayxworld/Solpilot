import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { getRiskProfile, updateRiskProfile } from "../services/riskService";
import { logger } from "../utils/logger";

export async function handleSettings(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    const text = (ctx.message as any)?.text || "";
    const parts = text.split(" ").slice(1);
    const param = parts[0]?.toLowerCase();
    const valueStr = parts[1];

    if (param && valueStr) {
      const val = parseFloat(valueStr);

      if (param === "size") {
        if (isNaN(val) || val <= 0) {
          await ctx.reply("Please enter a valid positive maximum size in USD.");
          return;
        }
        await updateRiskProfile(userId, { maxTradeSize: val });
        await ctx.reply(`✅ Updated: Max trade size set to *$${val.toFixed(2)} USD*.`, { parse_mode: "Markdown" });
        return;
      }

      if (param === "cooldown") {
        const minutes = parseInt(valueStr, 10);
        if (isNaN(minutes) || minutes < 0) {
          await ctx.reply("Please enter a valid non-negative integer for cooldown minutes.");
          return;
        }
        await updateRiskProfile(userId, { cooldownMinutes: minutes });
        await ctx.reply(`✅ Updated: Trade cooldown set to *${minutes} minutes*.`, { parse_mode: "Markdown" });
        return;
      }

      if (param === "sl") {
        if (isNaN(val) || val <= 0 || val >= 100) {
          await ctx.reply("Please enter a valid Stop Loss percentage (between 0.1% and 99.9%).");
          return;
        }
        await updateRiskProfile(userId, { stopLossPct: val });
        await ctx.reply(`✅ Updated: Default Stop Loss set to *-${val.toFixed(1)}%*.`, { parse_mode: "Markdown" });
        return;
      }

      if (param === "tp") {
        if (isNaN(val) || val <= 0) {
          await ctx.reply("Please enter a valid positive Take Profit percentage.");
          return;
        }
        await updateRiskProfile(userId, { takeProfitPct: val });
        await ctx.reply(`✅ Updated: Default Take Profit set to *+${val.toFixed(1)}%*.`, { parse_mode: "Markdown" });
        return;
      }

      if (param === "antirug") {
        const enabled = parseInt(valueStr, 10);
        if (enabled !== 0 && enabled !== 1) {
          await ctx.reply("Please use 1 to set to SAFE MODE or 0 to set to DEGEN MODE.");
          return;
        }
        await updateRiskProfile(userId, { antiRugEnabled: enabled === 1 });
        await ctx.reply(
          `✅ Updated: Trading Mode set to *${enabled === 1 ? "🛡️ SAFE MODE" : "🔥 DEGEN MODE"}*.\n\n` +
          `_${enabled === 1 ? "Anti-rug filters will block high-risk trades." : "Anti-rug filters are bypassed. Trade high-risk meme coins at your own risk!"}_`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      await ctx.reply("Unknown setting parameter. Type /settings to see the configuration guide.");
      return;
    }

    // Default: Display active risk settings
    const profile = await getRiskProfile(userId);
    await ctx.replyWithMarkdown(
      `*SolPilot Risk & Trading Mode Settings* ⚙️\n\n` +
      `Review and update your automated risk thresholds for simulated trades:\n\n` +
      `• *Max size per trade:* $${profile.maxTradeSize.toFixed(2)} USD\n` +
      `  _Update:_ \`/settings size <usd_value>\`\n\n` +
      `• *Trade cooldown:* ${profile.cooldownMinutes} minutes\n` +
      `  _Update:_ \`/settings cooldown <minutes>\`\n\n` +
      `• *Default Stop Loss:* -${profile.stopLossPct.toFixed(1)}%\n` +
      `  _Update:_ \`/settings sl <percent>\`\n\n` +
      `• *Default Take Profit:* +${profile.takeProfitPct.toFixed(1)}%\n` +
      `  _Update:_ \`/settings tp <percent>\`\n\n` +
      `• *Trading Mode:* ${profile.antiRugEnabled ? "🛡️ *SAFE MODE* (Anti-Rug Enabled)" : "🔥 *DEGEN MODE* (Anti-Rug Disabled)"}\n` +
      `  _Toggle:_ \`/settings antirug <1_for_Safe_0_for_Degen>\`\n\n` +
      `_Degen Mode allows you to trade high-risk meme coins without anti-rug locks, while Safe Mode blocks trades with high risk scores (>= 60/100)._`
    );
  } catch (error) {
    logger.error("handleSettings error:", error);
    await ctx.reply("An error occurred while fetching your risk management settings.");
  }
}
