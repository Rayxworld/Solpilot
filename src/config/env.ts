import dotenv from "dotenv";

dotenv.config();

export const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  databasePath: process.env.DATABASE_PATH || "./solpilot.db"
};

export function validateConfig() {
  const missing = [];
  if (!config.botToken) missing.push("TELEGRAM_BOT_TOKEN");
  if (!config.openAiApiKey) missing.push("OPENAI_API_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
