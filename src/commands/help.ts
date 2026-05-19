import { Context } from "telegraf";

export async function handleHelp(ctx: Context) {
  await ctx.replyWithMarkdown(`
*SolPilot Command Guide* 🚀

*Ecosystem & Insights*
/signal <ticker|mint> — Fetch DexScreener stats & get an AI trading commentary
/status — Check Solana RPC and network status
/risk — View the platform risk disclosures & anti-rug warning

*Paper Trading & Portfolio*
/portfolio — View simulated cash balance, holdings, and open positions
/watchlist — Manage your tracked token list
/papertrade — Open simulated buy/sell orders (e.g. /papertrade buy SOL 100)
/settings — Review and update your risk limits, Stop-Loss, and Take-Profit

Use the interactive menu at /menu to easily click buttons.
  `);
}
