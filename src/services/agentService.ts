import { fetchMultipleTokenPairs, analyzeTokenRisk, TokenPair } from "../market/dexScreener";
import { getRiskProfile } from "./riskService";
import { executePaperBuy } from "../trading/paperTrading";
import { createAuditLog } from "../database/prismaDb";
import { logger } from "../utils/logger";

export type AgentMode = "PAPER" | "LIVE_LOCKED";

export interface AgentSession {
  userId: string;
  active: boolean;
  mode: AgentMode;
  budgetUsd: number;
  perTradePct: number;
  universe: string[];
  startedAt: Date;
  lastScanAt?: Date;
  lastAction?: string;
  timer?: NodeJS.Timeout;
}

export interface AgentCandidate {
  symbol: string;
  pair: TokenPair;
  score: number;
  riskScore: number;
  reason: string;
}

const DEFAULT_UNIVERSE = ["SOL", "JUP", "RAY", "JTO", "WIF", "BONK", "POPCAT", "BOME", "PYTH", "RENDER"];
const DEFAULT_BUDGET_USD = 100;
const DEFAULT_PER_TRADE_PCT = 10;
const AGENT_SCAN_INTERVAL_MS = 60 * 1000;

const sessions = new Map<string, AgentSession>();

function clampBudget(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value <= 0) return DEFAULT_BUDGET_USD;
  return Math.min(Math.max(value, 10), 10_000);
}

function scorePair(pair: TokenPair): number {
  const liquidity = pair.liquidity?.usd || 0;
  const volume1h = pair.volume?.h1 || 0;
  const volume5m = pair.volume?.m5 || 0;
  const change5m = pair.priceChange?.m5 || 0;
  const change1h = pair.priceChange?.h1 || 0;
  const buys5m = pair.txns?.m5?.buys || 0;
  const sells5m = pair.txns?.m5?.sells || 0;
  const buyPressure = buys5m - sells5m;

  let score = 0;
  if (liquidity >= 20_000) score += 25;
  if (liquidity >= 100_000) score += 15;
  if (volume1h >= 10_000) score += 20;
  if (volume5m >= 1_000) score += 15;
  if (change5m > 0) score += Math.min(change5m, 15);
  if (change1h > 0) score += Math.min(change1h / 2, 15);
  if (buyPressure > 0) score += Math.min(buyPressure, 10);

  return Math.round(score);
}

function buildReason(pair: TokenPair, riskScore: number): string {
  const liquidity = pair.liquidity?.usd || 0;
  const volume1h = pair.volume?.h1 || 0;
  const change5m = pair.priceChange?.m5 || 0;
  return `liq $${Math.round(liquidity).toLocaleString()}, 1h vol $${Math.round(volume1h).toLocaleString()}, 5m ${change5m >= 0 ? "+" : ""}${change5m}%, risk ${riskScore}/100`;
}

export async function findAgentCandidates(userId: string, universe = DEFAULT_UNIVERSE): Promise<AgentCandidate[]> {
  const profile = await getRiskProfile(userId);
  const pairs = await fetchMultipleTokenPairs(universe);

  const candidates: AgentCandidate[] = [];
  for (const symbol of universe) {
    const pair = pairs[symbol];
    if (!pair || !pair.priceUsd) continue;

    const risk = analyzeTokenRisk(pair);
    const isSafeEnough = profile.antiRugEnabled ? risk.score <= 35 : risk.score <= 80;
    const liquidity = pair.liquidity?.usd || 0;
    const hasMinimumLiquidity = profile.antiRugEnabled ? liquidity >= 20_000 : liquidity >= 5_000;

    if (!isSafeEnough || !hasMinimumLiquidity) continue;

    const score = scorePair(pair) - Math.round(risk.score / 3);
    if (score <= 0) continue;

    candidates.push({
      symbol,
      pair,
      score,
      riskScore: risk.score,
      reason: buildReason(pair, risk.score)
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

async function runAgentTick(userId: string): Promise<void> {
  const session = sessions.get(userId);
  if (!session?.active) return;

  session.lastScanAt = new Date();

  try {
    const profile = await getRiskProfile(userId);
    const candidates = await findAgentCandidates(userId, session.universe);
    const best = candidates[0];

    if (!best) {
      session.lastAction = "Scanned market. No candidate passed the current rules.";
      return;
    }

    const rawSize = session.budgetUsd * (session.perTradePct / 100);
    const tradeSize = Math.max(1, Math.min(rawSize, profile.maxTradeSize));
    const result = await executePaperBuy(userId, best.symbol, tradeSize);

    session.lastAction = result.success
      ? `Paper entry: ${best.symbol} for $${tradeSize.toFixed(2)}. ${best.reason}.`
      : `Skipped ${best.symbol}: ${result.message}`;

    await createAuditLog(userId, "AGENT_PAPER_TICK", session.lastAction);
  } catch (error: any) {
    logger.error(`Agent tick failed for user ${userId}:`, error);
    session.lastAction = `Agent scan failed: ${error.message || error}`;
  }
}

export async function startPaperAgent(userId: string, budgetUsd?: number): Promise<AgentSession> {
  const existing = sessions.get(userId);
  if (existing?.timer) clearInterval(existing.timer);

  const session: AgentSession = {
    userId,
    active: true,
    mode: "PAPER",
    budgetUsd: clampBudget(budgetUsd),
    perTradePct: DEFAULT_PER_TRADE_PCT,
    universe: DEFAULT_UNIVERSE,
    startedAt: new Date(),
    lastAction: "Agent armed. First scan is starting now."
  };

  session.timer = setInterval(() => {
    runAgentTick(userId).catch((error) => logger.error(`Agent interval failed for ${userId}:`, error));
  }, AGENT_SCAN_INTERVAL_MS);
  session.timer.unref?.();

  sessions.set(userId, session);
  await createAuditLog(userId, "AGENT_STARTED", `Paper agent started with $${session.budgetUsd.toFixed(2)} budget.`);
  await runAgentTick(userId);
  return session;
}

export async function stopAgent(userId: string): Promise<AgentSession | null> {
  const session = sessions.get(userId);
  if (!session) return null;

  if (session.timer) clearInterval(session.timer);
  session.active = false;
  session.lastAction = "Agent stopped by user.";
  sessions.set(userId, session);
  await createAuditLog(userId, "AGENT_STOPPED", "Paper agent stopped.");
  return session;
}

export function getAgentSession(userId: string): AgentSession | null {
  return sessions.get(userId) || null;
}

export function formatAgentStatus(session: AgentSession | null): string {
  if (!session) {
    return [
      "*SolPilot Agent*",
      "",
      "Status: *OFFLINE*",
      "Mode: *Paper strategy agent*",
      "",
      "Start with `/agent start 100` to let SolPilot scan, size, and paper-trade from a $100 strategy budget.",
      "Live swaps remain locked until wallet custody and execution controls are enabled."
    ].join("\n");
  }

  return [
    "*SolPilot Agent*",
    "",
    `Status: *${session.active ? "ACTIVE" : "STOPPED"}*`,
    `Mode: *${session.mode === "PAPER" ? "Paper strategy agent" : "Live locked"}*`,
    `Budget: *$${session.budgetUsd.toFixed(2)}*`,
    `Per-entry size: *${session.perTradePct}%* of budget, capped by /settings size`,
    `Universe: *${session.universe.join(", ")}*`,
    `Last scan: *${session.lastScanAt ? session.lastScanAt.toLocaleString() : "Pending"}*`,
    "",
    `Last action: ${session.lastAction || "No action yet."}`
  ].join("\n");
}

