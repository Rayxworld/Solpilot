import express from "express";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import client from "prom-client";
import { config, validateConfig } from "./config/env";
import { fetchTokenPairDetails, analyzeTokenRisk } from "./market/dexScreener";
import { buildSignalExplanation } from "./ai/aiEngine";
import { prisma } from "./database/prismaDb";
import { TokenSignalSchema } from "./validators/requestValidators";
import { marketScanQueue } from "./services/queueService";
import { logger } from "./utils/logger";

validateConfig();

const app = express();
const port = process.env.PORT || 3000;

// ==========================================
// 1. Prometheus Metrics Configuration
// ==========================================
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests processed",
  labelNames: ["method", "route", "status"],
});
register.registerMetric(httpRequestCounter);

// ==========================================
// 2. Security Hardening Middleware
// ==========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://api.dexscreener.com"]
    }
  }
}));

app.use(express.json());

// Global API rate limiter (max 60 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

// Custom metric tracking middleware
app.use((req, res, next) => {
  res.on("finish", () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });
  next();
});

// Static assets
app.use(express.static(path.join(__dirname, "../public")));

// ==========================================
// 3. API Endpoints
// ==========================================

// Token Signal Generation Endpoint
app.post("/api/signal", async (req, res) => {
  try {
    // Validate request inputs using Zod
    const validation = TokenSignalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }

    const { symbol } = validation.data;
    logger.info(`API: Signal request received for symbol "${symbol}"`);

    // Fetch token market details
    const pairData = await fetchTokenPairDetails(symbol);
    const risk = pairData ? analyzeTokenRisk(pairData) : null;
    
    // Call AI signal commentary
    const signal = await buildSignalExplanation(symbol, pairData, risk);

    return res.json({
      symbol: symbol.toUpperCase(),
      signal,
      pairData: pairData ? {
        priceUsd: pairData.priceUsd,
        priceChange24h: pairData.priceChange?.h24,
        liquidityUsd: pairData.liquidity?.usd,
        volume24h: pairData.volume?.h24,
        dexId: pairData.dexId,
        address: pairData.baseToken?.address
      } : null
    });
  } catch (error) {
    logger.error("API Signal generation failed:", error);
    return res.status(500).json({ error: "Internal server error compilation failed." });
  }
});

// ==========================================
// 4. Prometheus Metrics Endpoint
// ==========================================
app.get("/metrics", async (req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.send(await register.metrics());
});

// ==========================================
// 5. Internal Admin Dashboard System
// ==========================================

// Admin Uptime & Health Status
app.get("/admin/health", async (req, res) => {
  try {
    // Quick Prisma database ping
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: "HEALTHY",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now(),
      database: "CONNECTED",
      nodeVersion: process.version
    });
  } catch (err) {
    logger.error("Admin Healthcheck Error:", err);
    return res.status(500).json({
      status: "UNHEALTHY",
      database: "DISCONNECTED",
      error: String(err)
    });
  }
});

// Admin Queue Dashboard Statistics
app.get("/admin/queues", async (req, res) => {
  try {
    const jobCounts = await marketScanQueue.getJobCounts();
    return res.json({
      queues: {
        "market-scan-queue": jobCounts
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to query queue counts: " + String(err) });
  }
});

// Admin Performance & Usage Statistics
app.get("/admin/stats", async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    const positionCount = await prisma.paperTrade.count({
      where: { status: "OPEN" }
    });
    const avgCashBalance = await prisma.portfolio.aggregate({
      _avg: {
        cashBalance: true
      }
    });

    return res.json({
      activeUsers: userCount,
      activeOpenPositions: positionCount,
      averagePortfolioCash: avgCashBalance._avg.cashBalance || 0
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to gather statistics: " + String(err) });
  }
});

// Security Hardening: Failed Authentications & Error Logging
app.get("/admin/errors", async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 20,
      orderBy: {
        createdAt: "desc"
      }
    });
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch error audits: " + String(err) });
  }
});

app.listen(port, () => {
  logger.info(`SolPilot Production Admin Site and Metrics running at http://localhost:${port}`);
});
