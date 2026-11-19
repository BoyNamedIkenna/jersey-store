import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { quoteCart } from "../lib/quote";
import { initializeTransaction } from "../lib/paystack";
import { optionalAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  items: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(100) }))
    .min(1)
    .max(20),
  email: z.string().trim().email().max(200).optional(), // required for guests, ignored for signed-in users
  shipping: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(20),
    address: z.string().trim().min(5).max(200),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
  }),
});

ordersRouter.post(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "Invalid order details");
    const { items, shipping } = parsed.data;

    // Signed-in users: the verified account email wins. Guests must supply one.
    const email = req.user?.email ?? parsed.data.email;
    if (!email) throw new AppError(400, "An email address is required");

    const quote = await quoteCart(items);
    if (quote.lines.some((line) => line.status !== "ok")) {
      res.status(409).json({ error: "Some items in your cart changed. Please review it.", lines: quote.lines });
      return;
    }

    const reference = `jrs_${randomUUID().replace(/-/g, "")}`;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: req.user?.id ?? null,
        email,
        total_kobo: quote.subtotalKobo,
        paystack_reference: reference,
        ship_name: shipping.name,
        ship_phone: shipping.phone,
        ship_address: shipping.address,
        ship_city: shipping.city,
        ship_state: shipping.state,
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      quote.lines.map((line) => ({
        order_id: order.id,
        variant_id: line.variantId,
        product_name: line.name,
        size: line.size,
        unit_price_kobo: line.priceKobo,
        quantity: line.quantity,
      })),
    );
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    try {
      const tx = await initializeTransaction({ email, amountKobo: quote.subtotalKobo, reference });
      res.status(201).json({
        orderId: order.id,
        reference,
        accessCode: tx.access_code,
        authorizationUrl: tx.authorization_url,
        totalKobo: quote.subtotalKobo,
      });
    } catch (err) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
      throw err;
    }
  }),
);

// Order summary for the confirmation page. Guest orders are readable by anyone holding the
// unguessable reference; an order that belongs to a user is only readable by that user.
// Shipping address and phone are deliberately not returned.
ordersRouter.get(
  "/:reference",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "user_id, status, total_kobo, created_at, paystack_reference, order_items(product_name, size, unit_price_kobo, quantity)",
      )
      .eq("paystack_reference", req.params.reference)
      .maybeSingle();
    if (error) throw error;
    if (!order || (order.user_id && order.user_id !== req.user?.id)) {
      throw new AppError(404, "Order not found");
    }

    res.json({
      reference: order.paystack_reference,
      status: order.status,
      totalKobo: order.total_kobo,
      createdAt: order.created_at,
      items: order.order_items.map((i) => ({
        name: i.product_name,
        size: i.size,
        quantity: i.quantity,
        unitPriceKobo: i.unit_price_kobo,
      })),
    });
  }),
);