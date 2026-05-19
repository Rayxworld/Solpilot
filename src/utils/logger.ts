import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// Create pino structured logger
export const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      }
});

export const logger = {
  info: (message: string, ...args: any[]) => {
    pinoLogger.info(args.length > 0 ? { args } : {}, message);
  },
  warn: (message: string, ...args: any[]) => {
    pinoLogger.warn(args.length > 0 ? { args } : {}, message);
  },
  error: (message: string, ...args: any[]) => {
    pinoLogger.error(args.length > 0 ? { args } : {}, message);
  },
  debug: (message: string, ...args: any[]) => {
    pinoLogger.debug(args.length > 0 ? { args } : {}, message);
  }
};
