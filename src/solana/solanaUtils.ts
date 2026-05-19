import { Connection } from "@solana/web3.js";
import { config } from "../config/env";
import { logger } from "../utils/logger";

export const connection = new Connection(config.solanaRpcUrl, { commitment: "confirmed" });

/**
 * Checks RPC connection and cluster health
 */
export async function getChainHealth(): Promise<string> {
  try {
    const version = await connection.getVersion();
    return `Connected to Solana cluster ${version['solana-core']} on ${config.solanaRpcUrl}`;
  } catch (error: any) {
    logger.error("getChainHealth error:", error);
    return `Solana RPC cluster is currently unreachable: ${error.message || error}`;
  }
}
