import { Router } from "express";
import { z } from "zod";
import { confirmPayment } from "../lib/payments";
import { optionalAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";

export const paymentsRouter = Router();

const verifySchema = z.object({ reference: z.string().min(1).max(100) });

paymentsRouter.post(
  "/verify",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "A payment reference is required");

    const status = await confirmPayment(parsed.data.reference, { userId: req.user?.id ?? null });
    res.json({ status });
  }),
);