import { RiskAnalysis } from "../market/dexScreener";

export type RiskMode = "SAFE" | "DEGEN";

export function buildRiskModeDescriptor(mode: RiskMode, risk: RiskAnalysis | null): string {
  if (mode === "DEGEN") {
    return [
      "Mode: DEGEN (aggressive).",
      "You should frame the output as: higher volatility, higher rug risk, and faster tempo — but still never guarantee profits.",
      "If risk score is high or rug risk is detected, make it explicit WHY and what signs to watch next.",
      "Use actionable bullets: entry trigger concepts, invalidation signals, and size discipline." 
    ].join("\n");
  }

  return [
    "Mode: SAFE (cautious).",
    "You should emphasize uncertainty and downside protection.",
    "If risk score is high, strongly discourage entries and provide safer alternatives." 
  ].join("\n");
}

