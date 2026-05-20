# TODO - SolPilot (DEGEN + Agent Trades)

## Phase 1: DEGEN behavior for paper trading + AI framing
- [ ] Inspect current risk gating end-to-end for paper buys (what blocks high risk today).
- [ ] Update `src/services/riskService.ts` so DEGEN mode clearly allows higher-risk trades per user settings (no anti-rug blocks, keep only minimal warnings).
- [ ] Update UI/help text so DEGEN mode is reflected clearly.
- [ ] Update `src/ai/aiEngine.ts` prompt so AI framing matches SAFE vs DEGEN mode.
- [ ] Plumb user mode into AI calls (from settings/profile) and ensure the mode is included in `/signal` output.

## Phase 2: Real trading (deposit + swaps/snipes)
- [ ] Locate/verify any existing real-trading / wallet / Jupiter integration modules.
- [ ] If none exist, design new components:
  - wallet + secure key handling
  - deposit handling
  - trade execution using Jupiter/swap API
  - snipe/swaps executor worker
  - monitoring + confirmations
  - safety limits (max slippage, max trade size, allowlist/denylist)
- [ ] Implement minimum viable real-trading path behind a feature flag.
- [ ] Add commands/endpoints for deposit/start agent.
- [ ] End-to-end test locally with paper mode disabled in a staging environment.

