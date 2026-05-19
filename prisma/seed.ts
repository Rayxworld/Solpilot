import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const cleanUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.split("?")[0] : "";
const pool = new Pool({
  connectionString: cleanUrl,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database initial models...");

  // Seed system user to support global administrative alerts or audit logs
  const adminId = "SYSTEM_ADMIN";
  
  await prisma.user.upsert({
    where: { telegramId: adminId },
    update: {},
    create: {
      telegramId: adminId,
      username: "solpilot_system",
      riskProfile: {
        create: {
          maxTradeSize: 1000.0,
          cooldownMinutes: 1,
          stopLossPct: 5.0,
          takeProfitPct: 50.0,
          antiRugEnabled: true
        }
      },
      portfolio: {
        create: {
          cashBalance: 100000.0 // Admin portfolio starts with $100k
        }
      }
    }
  });

  // Seed standard watchlist item
  await prisma.watchlistItem.upsert({
    where: {
      userId_tokenSymbol: {
        userId: adminId,
        tokenSymbol: "SOL"
      }
    },
    update: {},
    create: {
      userId: adminId,
      tokenSymbol: "SOL",
      tokenMint: "So11111111111111111111111111111111111111112"
    }
  });

  // Create initial boot audit log
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: "SYSTEM_SEED",
      details: "Initial production database seed script successfully executed."
    }
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
