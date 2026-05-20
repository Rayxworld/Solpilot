import { Context } from "telegraf";
import { ensureUser } from "../database/prismaDb";
import { formatAgentStatus, getAgentSession, startPaperAgent, stopAgent } from "../services/agentService";
import { getRiskProfile } from "../services/riskService";
import { logger } from "../utils/logger";

/**
 * Controls the SolPilot autonomous paper strategy agent.
 */
export async function handleAgent(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    const text = (ctx.message as any)?.text || "";
    const parts = text.split(" ").slice(1);
    const action = (parts[0] || "status").toLowerCase();
    const budget = parts[1] ? parseFloat(parts[1]) : undefined;

    if (action === "start") {
      await ctx.reply(
        "Starting SolPilot Agent in paper mode. It will scan the market, apply your risk rules, and simulate entries automatically."
      );
      const session = await startPaperAgent(userId, budget);
      await ctx.replyWithMarkdown(formatAgentStatus(session), agentKeyboard());
      return;
    }

    if (action === "stop") {
      const session = await stopAgent(userId);
      await ctx.replyWithMarkdown(formatAgentStatus(session), agentKeyboard());
      return;
    }

    if (action === "rules") {
      const profile = await getRiskProfile(userId);
      await ctx.replyWithMarkdown(
        `*SolPilot Agent Rules*\n\n` +
          `The agent trades in *paper mode* using the same protection layer as manual paper trades.\n\n` +
          `- Max entry size: *$${profile.maxTradeSize.toFixed(2)}*\n` +
          `- Stop Loss: *-${profile.stopLossPct.toFixed(1)}%*\n` +
          `- Take Profit: *+${profile.takeProfitPct.toFixed(1)}%*\n` +
          `- Cooldown: *${profile.cooldownMinutes} minutes*\n` +
          `- Mode: *${profile.antiRugEnabled ? "SAFE - blocks high-risk tokens" : "DEGEN - allows higher-risk momentum"}*\n\n` +
          `Update rules with /settings. Example: \`/settings size 25\`, \`/settings tp 35\`, \`/settings antirug 0\`.`,
        agentKeyboard()
      );
      return;
    }

    await ctx.replyWithMarkdown(formatAgentStatus(getAgentSession(userId)), agentKeyboard());
  } catch (error: any) {
    logger.error("handleAgent error:", error);
    await ctx.reply("An error occurred while processing the agent command.");
  }
}

export function agentKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Start Paper Agent", callback_data: "agent_start" },
          { text: "Stop Agent", callback_data: "agent_stop" }
        ],
        [
          { text: "Agent Rules", callback_data: "agent_rules" },
          { text: "Portfolio", callback_data: "menu_portfolio" }
        ],
        [
          { text: "Deposit / Live Access", callback_data: "menu_deposit" },
          { text: "Signals", callback_data: "menu_signal" }
        ]
      ]
    }
  };
}

