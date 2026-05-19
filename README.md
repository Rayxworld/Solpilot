# SolPilot MVP 🚀
**Tagline:** Your AI trading copilot for Solana.

SolPilot is a production-grade, highly modular Telegram-based AI trading assistant designed for the Solana ecosystem. It empowers users to automate research, monitor meme coin trading parameters, implement custom risk strategies, observe addresses, and execute paper transactions inside a safe sandbox.

> [!IMPORTANT]
> This is a **simulated paper trading platform** first. It does not store private keys, take direct custody of user funds, or promise guaranteed financial returns. The core philosophy is safety, backtesting, and automated risk awareness.

---

## 🏗️ Architecture & Directory Overview

We have designed a clean, separation-of-concerns modular architecture inside `/src`:

```text
/src
  /bot
    bot.ts             # Bot instance, middlewares (session, anti-spam)
  /commands
    index.ts           # Command aggregator and inline interactive menus
    start.ts           # Welcomes user & initializes SQL databases
    help.ts            # Detailed command list
    signal.ts          # Evaluates risk heuristics & gets AI explanations
    portfolio.ts       # Visualizes cash, holdings, and active PnL
    watchlist.ts       # Tracks personal watched tokens
    papertrade.ts      # Main interface for BUY/SELL simulations
    risk.ts            # Safe trading guidelines advisory
    settings.ts        # Configures limits (cooldown, max size, SL/TP %)
    status.ts          # Solana blockchain cluster connection status
  /services
    riskService.ts     # Risk profile settings, cooldowns, trade limits
    portfolioService.ts# Active open positions, PnL math, transaction history
    walletService.ts   # Observes public wallet SOL balances (no keys stored)
  /ai
    aiEngine.ts        # Custom OpenAI wrapper with risk-conscious prompts
  /market
    dexScreener.ts     # Polls DexScreener API, sorts by pool liquidity
  /solana
    solanaUtils.ts     # Shared web3 connection & blockchain RPC pingers
  /database
    sqliteDb.ts        # Database schema definitions and user setup
  /middleware
    rateLimiter.ts     # In-memory rate limiting against spam attacks
  /utils
    logger.ts          # Structured timestamped logging console
  /config
    env.ts             # Strict environment validation
```

---

## 🔒 Security Principles

1. **Zero Private Key Storage:** SolPilot does not request, load, or store private keys or seed phrases. All chain integrations are read-only public RPC queries.
2. **Anti-Spam Controls:** Every incoming bot update goes through our `rateLimiterMiddleware` which restricts spam attacks (max 30 queries per minute per user).
3. **Strict Input Sanitization:** Commands like `/papertrade` and `/settings` strictly typecast numerical parameters to prevent SQL injection or runtime crashes.
4. **Anti-Rug Filters:** Buy orders automatically scan DexScreener for suspicious contract patterns (low liquidity, pool age, negligible volume) and block transaction execution if metrics breach safety boundaries.

---

## 📊 MVP Command Guide

* **Ecosystem & Signals**
  * `/start` — Initializes your profile, gives you a starting balance of $10,000, and prints the menu.
  * `/help` — Lists commands and usage guidance.
  * `/signal <ticker|mint>` — Runs a multi-factor risk heuristic and compiles an uncertainty-aware AI signal explanation.
  * `/status` — Validates RPC cluster connectivity.
  * `/risk` — Displays standard risk advisor disclosures.

* **Simulated Sandbox & Trade Rules**
  * `/portfolio` — Shows cash balance, open position values, all-time realized profits, and position IDs.
  * `/watchlist` — Manages your personal ticker list (e.g. `/watchlist add WIF`).
  * `/papertrade buy <ticker|address> <size_in_usd>` — Simulates a token purchase with auto stop-loss/take-profit triggers.
  * `/papertrade sell <position_id>` — Closes out an active position at live market rates.
  * `/settings` — Configures customized trade bounds (SL/TP percentages, cooldown periods, max trade limits).

---

## 🚀 Quick Start Guide

### 1. Configure Secrets
Copy the template and fill in your details:
```bash
cp .env.example .env
```
*Specify `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY` (and options like `SOLANA_RPC_URL` or custom models).*

### 2. Standard Local Run
Ensure you have Node.js v18+ or v20+ installed.
```bash
npm install
npm run build
npm start
```
*For active hot-reloading development:*
```bash
npm run dev
```

### 3. Docker Deployment (Recommended for Production)
The codebase includes a highly secure, multi-stage `Dockerfile` and a simple `docker-compose.yml` for instant, persisted deployments:
```bash
docker-compose up -d --build
```
*This starts the bot in long-polling mode, mounts a local SQLite volume at `./data` for persistent user portfolios, and exposes the optional Web UI server on port 3000.*

---

## 🔮 Future Roadmap

* **Live Custody Integration:** Secure multi-signature integrations (using tools like Squads or Turnkey) to let users execute real on-chain trades after paper backtesting.
* **Auto-Trailing Stops:** Sophisticated triggers that update Stop Loss parameters dynamically as token price breaks resistance.
* **Autonomous AI Agents:** Agent parameters that monitor watchlists and execute automated buy orders based on specific social sentiment or volume spikes.
* **Advanced Web UI Charts:** Responsive TradingView visual charting alongside the AI control panels.
