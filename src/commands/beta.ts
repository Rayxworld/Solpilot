import { Context } from "telegraf";
import { isUserVerified } from "../services/verificationService";
import { getAgentSession } from "../services/agentService";

export async function handleBeta(ctx: Context) {
  const userId = ctx.from?.id.toString();
  const verified = userId ? isUserVerified(userId) : false;
  const agent = userId ? getAgentSession(userId) : null;

  await ctx.replyWithMarkdown(
    `*SolPilot Beta Launch Checklist*\n\n` +
      `1. Verify account: *${verified ? "Done" : "Needed"}*\n` +
      `   Command: \`/v\`\n\n` +
      `2. Review paper-agent rules\n` +
      `   Command: \`/rules\`\n\n` +
      `3. Open the AI signal deck\n` +
      `   Command: \`/s\`\n\n` +
      `4. Start paper agent\n` +
      `   Command: \`/go\`\n\n` +
      `5. Track portfolio\n` +
      `   Command: \`/me\`\n\n` +
      `Current agent: *${agent?.active ? "Active" : "Offline"}*\n\n` +
      `_Beta scope: AI analysis, paper trades, account verification, Telegram UX, and strategy feedback. Real funds are locked._`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Verify", callback_data: "verify_user" },
            { text: "Signal Deck", callback_data: "menu_signal" }
          ],
          [
            { text: "Agent Rules", callback_data: "agent_rules" },
            { text: "Start Agent", callback_data: "agent_start" }
          ],
          [
            { text: "Portfolio", callback_data: "menu_portfolio" },
            { text: "Live Access", callback_data: "menu_deposit" }
          ],
          [
            { text: "Send Feedback", callback_data: "action_feedback" }
          ]
        ]
      }
    }
  );
}
