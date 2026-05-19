import { prisma } from "../database/prismaDb";
import { TokenPair, analyzeTokenRisk } from "../market/dexScreener";
import { logger } from "../utils/logger";

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
}

/**
 * Service to manage and enforce trading risk thresholds using PostgreSQL and Prisma
 */
export async function getRiskProfile(userId: string) {
  const profile = await prisma.riskProfile.findUnique({
    where: { userId }
  });
  if (!profile) {
    // Default fallback
    return {
      maxTradeSize: 100.0,
      cooldownMinutes: 5,
      stopLossPct: 10.0,
      takeProfitPct: 20.0,
      antiRugEnabled: true
    };
  }
  return profile;
}

/**
 * Updates a user's risk preferences inside PostgreSQL
 */
export async function updateRiskProfile(
  userId: string,
  params: {
    maxTradeSize?: number;
    cooldownMinutes?: number;
    stopLossPct?: number;
    takeProfitPct?: number;
    antiRugEnabled?: boolean;
  }
) {
  await prisma.riskProfile.update({
    where: { userId },
    data: {
      maxTradeSize: params.maxTradeSize,
      cooldownMinutes: params.cooldownMinutes,
      stopLossPct: params.stopLossPct,
      takeProfitPct: params.takeProfitPct,
      antiRugEnabled: params.antiRugEnabled
    }
  });
  logger.info(`Updated risk profile for user ${userId} inside PostgreSQL.`);
}

/**
 * Validates whether a potential paper trade respects all safety, size, and cooldown constraints
 */
export async function validateTradeRisk(
  userId: string,
  pair: TokenPair,
  usdSize: number
): Promise<RiskCheckResult> {
  const warnings: string[] = [];
  const profile = await getRiskProfile(userId);

  // 1. Max Size Check
  if (usdSize > profile.maxTradeSize) {
    return {
      allowed: false,
      reason: `Trade size $${usdSize} exceeds your risk profile limit of $${profile.maxTradeSize}.`,
      warnings
    };
  }

  // 2. Cooldown Timer Check
  const lastTrade = await prisma.paperTrade.findFirst({
    where: { userId },
    orderBy: { openedAt: "desc" }
  });
  if (lastTrade) {
    const elapsedMinutes = (Date.now() - lastTrade.openedAt.getTime()) / (1000 * 60);
    if (elapsedMinutes < profile.cooldownMinutes) {
      const remainingSecs = Math.round((profile.cooldownMinutes - elapsedMinutes) * 60);
      return {
        allowed: false,
        reason: `Trade cooldown active. Please wait ${remainingSecs} seconds before initiating another trade.`,
        warnings
      };
    }
  }

  // 3. Blacklist Check
  const blacklistSymbols = ["SCAM", "RUG", "HACK", "FAKE"];
  const symbolUpper = pair.baseToken.symbol.toUpperCase();
  if (blacklistSymbols.some(s => symbolUpper.includes(s))) {
    return {
      allowed: false,
      reason: `Token "${pair.baseToken.symbol}" is on the platform blacklist.`,
      warnings
    };
  }

  // 4. Anti-Rug Heuristic Check
  if (profile.antiRugEnabled) {
    const riskAnalysis = analyzeTokenRisk(pair);
    if (riskAnalysis.isRugPotential) {
      return {
        allowed: false,
        reason: `Anti-rug filter blocked this trade. Risk score is high: ${riskAnalysis.score}/100. Warnings: ${riskAnalysis.warnings.join(" ")}`,
        warnings: riskAnalysis.warnings
      };
    }
    if (riskAnalysis.score > 30) {
      warnings.push(...riskAnalysis.warnings);
    }
  }

  return {
    allowed: true,
    warnings
  };
}
