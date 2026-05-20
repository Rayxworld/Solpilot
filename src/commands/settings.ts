import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { getRiskProfile, updateRiskProfile } from "../services/riskService";
import { logger } from "../utils/logger";

export async function handleSettings(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    const text = ((ctx.message as any)?.text || "").trim();
    const parts = text.startsWith("/") ? text.split(/\s+/).slice(1) : [];
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
        await ctx.reply(`Updated: Max paper entry size set to *$${val.toFixed(2)}*.`, { parse_mode: "Markdown" });
        return;
      }

      if (param === "cooldown") {
        const minutes = parseInt(valueStr, 10);
        if (isNaN(minutes) || minutes < 0) {
          await ctx.reply("Please enter a valid non-negative integer for cooldown minutes.");
          return;
        }
        await updateRiskProfile(userId, { cooldownMinutes: minutes });
        await ctx.reply(`Updated: Agent cooldown set to *${minutes} minutes*.`, { parse_mode: "Markdown" });
        return;
      }

      if (param === "sl") {
        if (isNaN(val) || val <= 0 || val >= 100) {
          await ctx.reply("Please enter a valid stop-loss percentage between 0.1 and 99.9.");
          return;
        }
        await updateRiskProfile(userId, { stopLossPct: val });
        await ctx.reply(`Updated: Default paper stop-loss set to *-${val.toFixed(1)}%*.`, { parse_mode: "Markdown" });
        return;
      }

      if (param === "tp") {
        if (isNaN(val) || val <= 0) {
          await ctx.reply("Please enter a valid positive take-profit percentage.");
          return;
        }
        await updateRiskProfile(userId, { takeProfitPct: val });
        await ctx.reply(`Updated: Default paper take-profit set to *+${val.toFixed(1)}%*.`, { parse_mode: "Markdown" });
        return;
      }

      if (param === "mode") {
        const normalized = valueStr.toLowerCase();
        if (normalized !== "safe" && normalized !== "degen") {
          await ctx.reply("Use `/rules mode safe` or `/rules mode degen`.", { parse_mode: "Markdown" });
          return;
        }
        await updateRiskProfile(userId, { antiRugEnabled: normalized === "safe" });
        await ctx.reply(
          `Updated: Paper agent mode set to *${normalized.toUpperCase()}*.\n\n` +
            `_${normalized === "safe" ? "SAFE blocks high-risk tokens." : "DEGEN allows higher-risk momentum candidates for paper testing."}_`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      if (param === "antirug") {
        const enabled = parseInt(valueStr, 10);
        if (enabled !== 0 && enabled !== 1) {
          await ctx.reply("Please use 1 for SAFE mode or 0 for DEGEN mode.");
          return;
        }
        await updateRiskProfile(userId, { antiRugEnabled: enabled === 1 });
        await ctx.reply(
          `Updated: Paper agent mode set to *${enabled === 1 ? "SAFE" : "DEGEN"}*.\n\n` +
            `_${enabled === 1 ? "SAFE blocks high-risk tokens." : "DEGEN allows higher-risk momentum candidates for paper testing."}_`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      await ctx.reply("Unknown rule. Type /rules to see the beta rule guide.");
      return;
    }

    const profile = await getRiskProfile(userId);
    await ctx.replyWithMarkdown(
      `*SolPilot Beta Rules*\n\n` +
        `These rules control paper-agent entries and manual paper trades.\n\n` +
        `- Max entry size: *$${profile.maxTradeSize.toFixed(2)}*\n` +
        `  Update: \`/rules size 25\`\n\n` +
        `- Agent cooldown: *${profile.cooldownMinutes} minutes*\n` +
        `  Update: \`/rules cooldown 5\`\n\n` +
        `- Stop-loss: *-${profile.stopLossPct.toFixed(1)}%*\n` +
        `  Update: \`/rules sl 8\`\n\n` +
        `- Take-profit: *+${profile.takeProfitPct.toFixed(1)}%*\n` +
        `  Update: \`/rules tp 30\`\n\n` +
        `- Mode: *${profile.antiRugEnabled ? "SAFE" : "DEGEN"}*\n` +
        `  Update: \`/rules mode safe\` or \`/rules mode degen\`\n\n` +
        `_Beta note: SolPilot is paper-trading only. Live deposits and swaps are locked._`
    );
  } catch (error) {
    logger.error("handleSettings error:", error);
    await ctx.reply("An error occurred while fetching your beta rules.");
  }
}

