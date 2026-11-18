import { Router } from "express";
import { z } from "zod";
import { quoteCart } from "../lib/quote";
import { AppError, asyncHandler } from "../middleware/error";

export const cartRouter = Router();

const quoteBody = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1)
    .max(50),
});

// POST /cart/quote  { "items": [{ "variantId": "...", "quantity": 2 }] }
// Returns current prices and availability. It changes nothing, so it needs no sign-in.
cartRouter.post(
  "/quote",
  asyncHandler(async (req, res) => {
    const parsed = quoteBody.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid cart",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }
    res.json(await quoteCart(parsed.data.items));
  })
);