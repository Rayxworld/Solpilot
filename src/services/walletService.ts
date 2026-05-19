import { Connection, PublicKey } from "@solana/web3.js";
import { prisma } from "../database/prismaDb";
import { config } from "../config/env";
import { logger } from "../utils/logger";

const connection = new Connection(config.solanaRpcUrl, { commitment: "confirmed" });

export interface WatchedWallet {
  id: number;
  walletAddress: string;
  label?: string;
  balanceSol?: number;
}

/**
 * Service to observe public Solana wallets without private key storage using Prisma
 */
export async function trackWalletAddress(
  userId: string,
  walletAddress: string,
  label?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate Solana address format
    try {
      new PublicKey(walletAddress);
    } catch {
      return { success: false, message: "Invalid Solana wallet address format." };
    }

    await prisma.walletTrack.upsert({
      where: {
        userId_walletAddress: { userId, walletAddress }
      },
      create: {
        userId,
        walletAddress,
        label: label || null
      },
      update: {
        label: label || null
      }
    });

    return { success: true, message: `Successfully added wallet address to your observation watchlist.` };
  } catch (error: any) {
    logger.error("trackWalletAddress error:", error);
    return { success: false, message: `Failed to track wallet address: ${error.message || error}` };
  }
}

/**
 * Retrieve user's tracked wallets with their live SOL balances from RPC using Prisma
 */
export async function getTrackedWallets(userId: string): Promise<WatchedWallet[]> {
  try {
    const rows = await prisma.walletTrack.findMany({
      where: { userId }
    });
    const results: WatchedWallet[] = [];

    for (const row of rows) {
      let balanceSol = 0;
      try {
        const pubKey = new PublicKey(row.walletAddress);
        const balanceLamports = await connection.getBalance(pubKey);
        balanceSol = balanceLamports / 1000000000;
      } catch (err) {
        logger.warn(`Failed to retrieve RPC balance for wallet ${row.walletAddress}:`, err);
        balanceSol = -1; // Indicator of RPC or fetch error
      }

      results.push({
        id: row.id,
        walletAddress: row.walletAddress,
        label: row.label || undefined,
        balanceSol
      });
    }

    return results;
  } catch (error) {
    logger.error("getTrackedWallets error:", error);
    return [];
  }
}

/**
 * Remove a tracked wallet address using Prisma
 */
export async function removeTrackedWallet(userId: string, trackId: number): Promise<boolean> {
  try {
    const res = await prisma.walletTrack.delete({
      where: { id: trackId, userId }
    });
    return !!res;
  } catch (error) {
    logger.error("removeTrackedWallet error:", error);
    return false;
  }
}
