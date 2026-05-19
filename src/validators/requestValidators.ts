import { z } from "zod";

/**
 * Validator schema for token signal lookup endpoints
 */
export const TokenSignalSchema = z.object({
  symbol: z.string()
    .min(1, "Token symbol or address is required.")
    .max(50, "Token symbol/address is too long.")
    .regex(/^[a-zA-Z0-9_]+$/, "Invalid characters in token query.")
});

/**
 * Validator schema for paper trading actions
 */
export const PaperTradeSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  symbol: z.string().min(1, "Token symbol is required."),
  usdSize: z.number().positive("USD size must be a positive number.").max(50000, "Trade size exceeds sandbox limit of $50,000.")
});

/**
 * Validator schema for user settings updates
 */
export const SettingsUpdateSchema = z.object({
  maxTradeSize: z.number().positive().optional(),
  cooldownMinutes: z.number().int().nonnegative().optional(),
  stopLossPct: z.number().positive().max(100).optional(),
  takeProfitPct: z.number().positive().optional(),
  antiRugEnabled: z.boolean().optional()
});
