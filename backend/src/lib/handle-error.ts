import { MedusaResponse } from "@medusajs/framework/http";
import { AppError } from "../errors";
import { logger } from "./logger";

export function handleError(err: unknown, res: MedusaResponse, ctx?: object): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  logger.error({ err, ...ctx }, "Unhandled error");
  res.status(500).json({ error: "An unexpected error occurred. Please try again." });
}
