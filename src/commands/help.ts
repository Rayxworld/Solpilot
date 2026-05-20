import { Context } from "telegraf";

export async function handleHelp(ctx: Context) {
  await ctx.replyWithMarkdown(
    `*SolPilot Command Guide*\n\n` +
      `*Fast Commands*\n` +
      `/v - Verify your Telegram account\n` +
      `/go - Start the paper agent with $100 default budget\n` +
      `/off - Stop the agent\n` +
      `/s - Open the signal deck\n` +
      `/s BONK - Analyze one token\n` +
      `/me - View portfolio\n` +
      `/fund - View deposit/live access\n` +
      `/rules - Update risk settings\n` +
      `/trade - Manual simulated trades\n\n` +
      `*Advanced Commands*\n` +
      `/agent start 250 - Start agent with a custom paper budget\n` +
      `/agent rules - View the rules the agent must obey\n` +
      `/settings size 25 - Set max entry size\n` +
      `/settings sl 8 - Set stop-loss percent\n` +
      `/settings tp 30 - Set take-profit percent\n` +
      `/settings antirug 0 - Switch to DEGEN mode\n\n` +
      `Use /menu for the button dashboard.`
  );
}
