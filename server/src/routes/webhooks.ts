import express, { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { confirmPayment } from "../lib/payments";
import { AppError, asyncHandler } from "../middleware/error";

export const webhooksRouter = Router();

// express.raw keeps the body as an untouched Buffer, which the signature check needs.
webhooksRouter.post(
  "/paystack",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key || !Buffer.isBuffer(req.body)) {
      res.sendStatus(400);
      return;
    }

    const expected = Buffer.from(createHmac("sha512", key).update(req.body).digest("hex"));
    const given = Buffer.from(String(req.headers["x-paystack-signature"] ?? ""));
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      res.sendStatus(401);
      return;
    }

    const event = JSON.parse(req.body.toString("utf8")) as { event?: string; data?: { reference?: string } };

    if (event.event === "charge.success" && event.data?.reference) {
      try {
        await confirmPayment(event.data.reference);
      } catch (err) {
        // Business problems (sold out, amount mismatch) will not fix themselves on a retry, so answer 200.
        // Anything unexpected (database down) rethrows as a 500 so Paystack retries later.
        if (err instanceof AppError) console.error("Webhook:", err.message);
        else throw err;
      }
    }
    res.sendStatus(200);
  }),
);