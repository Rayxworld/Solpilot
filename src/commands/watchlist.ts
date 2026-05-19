import { Context } from "telegraf";
import { prisma, ensureUser } from "../database/prismaDb";
import { fetchTokenPairDetails } from "../market/dexScreener";
import { logger } from "../utils/logger";

export async function handleWatchlist(ctx: Context) {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ensureUser(userId, ctx.from?.username);

    const text = (ctx.message as any)?.text || "";
    const parts = text.split(" ").slice(1);
    const action = parts[0]?.toLowerCase();
    const symbol = parts[1]?.toUpperCase();

    if (action === "add" && symbol) {
      // Validate that the token exists
      const pair = await fetchTokenPairDetails(symbol);
      if (!pair) {
        await ctx.reply(`⚠️ Cannot find token "${symbol}" to add to watchlist.`);
        return;
      }

      await prisma.watchlistItem.upsert({
        where: {
          userId_tokenSymbol: {
            userId,
            tokenSymbol: pair.baseToken.symbol.toUpperCase()
          }
        },
        create: {
          userId,
          tokenSymbol: pair.baseToken.symbol.toUpperCase(),
          tokenMint: pair.baseToken.address
        },
        update: {
          tokenMint: pair.baseToken.address
        }
      });

      await ctx.reply(`✅ Added *${pair.baseToken.symbol.toUpperCase()}* to your watchlist.`, { parse_mode: "Markdown" });
      return;
    }

    if (action === "remove" && symbol) {
      const res = await prisma.watchlistItem.deleteMany({
        where: {
          userId,
          tokenSymbol: symbol
        }
      });
      
      if (res.count > 0) {
        await ctx.reply(`✅ Removed *${symbol}* from your watchlist.`, { parse_mode: "Markdown" });
      } else {
        await ctx.reply(`⚠️ Token "${symbol}" is not in your watchlist.`);
      }
      return;
    }

    // Default: list watchlist
    const rows = await prisma.watchlistItem.findMany({
      where: { userId }
    });
    if (rows.length === 0) {
      await ctx.replyWithMarkdown(
        `*Your Watchlist is empty.* 👁️\n\n` +
        `To add a token, use:\n` +
        `\`/watchlist add <symbol>\` (e.g. /watchlist add SOL)`
      );
      return;
    }

    let listText = "*Your SolPilot Watchlist:* 👁️\n\n";
    for (const r of rows) {
      const pair = await fetchTokenPairDetails(r.tokenSymbol);
      const price = pair?.priceUsd ? `$${parseFloat(pair.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "N/A";
      const change = pair?.priceChange?.h24 !== undefined ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";
      listText += `• *${r.tokenSymbol}*: ${price} (${change} 24h)\n`;
    }

    listText += `\nTo remove: \`/watchlist remove <symbol>\``;
    await ctx.replyWithMarkdown(listText);
  } catch (error) {
    logger.error("handleWatchlist error:", error);
    await ctx.reply("An error occurred while accessing your watchlist.");
  }
}
