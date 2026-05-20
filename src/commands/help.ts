import { Context } from "telegraf";

export async function handleHelp(ctx: Context) {
  await ctx.replyWithMarkdown(
    `*SolPilot Command Guide*\n\n` +
      `*Agentic Trading*\n` +
      `/agent - View agent status\n` +
      `/agent start 100 - Start autonomous paper trading with a $100 strategy budget\n` +
      `/agent stop - Stop the active agent\n` +
      `/agent rules - View the rules the agent must obey\n` +
      `/deposit - View deposit and live-agent access status\n\n` +
      `*Signals & Research*\n` +
      `/signal <ticker|mint> - Fetch DexScreener stats and AI commentary\n` +
      `/status - Check Solana RPC and network status\n` +
      `/risk - View platform risk disclosures\n\n` +
      `*Portfolio & Rules*\n` +
      `/portfolio - View simulated balance and open positions\n` +
      `/papertrade - Open or close manual simulated trades\n` +
      `/settings - Update size, cooldown, stop-loss, take-profit, and SAFE/DEGEN mode\n` +
      `/watchlist - Manage tracked tokens\n\n` +
      `Use /menu for the button dashboard.`
  );
}

