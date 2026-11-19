import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { quoteCart } from "../lib/quote";
import { initializeTransaction } from "../lib/paystack";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/error";
import { confirmPayment } from "../lib/payments";

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

interface OrderRow {
  paystack_reference: string;
  status: string;
  total_kobo: number;
  created_at: string;
  order_items: { product_name: string; size: string; unit_price_kobo: number; quantity: number }[];
}

const ORDER_COLUMNS =
  "user_id, status, total_kobo, created_at, paystack_reference, order_items(product_name, size, unit_price_kobo, quantity)";

// One shape for both endpoints. Shipping address and phone are deliberately never returned.
function toSummary(order: OrderRow) {
  return {
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
  };
}

// Attaches guest orders to an account when the account's email is VERIFIED and matches the order's email.
// Fails closed: if verification is unclear, nothing is linked. Linking on an unverified email would let
// anyone read someone else's order history just by signing up with their address.
async function claimGuestOrders(userId: string) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    const user = data?.user;
    if (error || !user?.email) return;
    const email = user.email.toLowerCase();

    const verified = (user.identities ?? []).some((identity) => {
      const d = identity.identity_data as { email?: string; email_verified?: boolean } | undefined;
      return d?.email_verified === true && d.email?.toLowerCase() === email;
    });
    if (!verified) return;

    const { error: claimError } = await supabase.rpc("claim_guest_orders", { p_user_id: userId, p_email: email });
    if (claimError) throw claimError;
  } catch (err) {
    console.error("claimGuestOrders failed:", err); // never block the order list over this
  }
}

// Order history for the signed-in user. The user id comes from the verified token, never from the request.
// The server's secret key bypasses RLS, so this explicit filter is what keeps users out of each other's orders.
ordersRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    await claimGuestOrders(req.user!.id);
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;

    res.json((data as unknown as OrderRow[]).map(toSummary));
  }),
);

// Order summary for the confirmation page. Guest orders are readable by anyone holding the
// unguessable reference; an order that belongs to a user is only readable by that user.
ordersRouter.get(
  "/:reference",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("paystack_reference", req.params.reference)
      .maybeSingle();
    if (error) throw error;

    const order = data as unknown as (OrderRow & { user_id: string | null }) | null;
    if (!order || (order.user_id && order.user_id !== req.user?.id)) {
      throw new AppError(404, "Order not found");
    }
    res.json(toSummary(order));
  }),
);

interface PayableOrder {
  id: string;
  user_id: string | null;
  email: string;
  status: string;
  total_kobo: number;
  paystack_reference: string;
  order_items: { variant_id: string; quantity: number }[];
}

// Starts a fresh payment for an order that is still pending (guest orders work too, by reference).
ordersRouter.post(
  "/:reference/pay",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, email, status, total_kobo, paystack_reference, order_items(variant_id, quantity)")
      .eq("paystack_reference", req.params.reference)
      .maybeSingle();
    if (error) throw error;

    const order = data as unknown as PayableOrder | null;
    if (!order || (order.user_id && order.user_id !== req.user?.id)) throw new AppError(404, "Order not found");

    if (order.status === "paid") {
      res.json({ status: "paid", reference: order.paystack_reference });
      return;
    }
    if (order.status !== "pending") throw new AppError(409, "This order can no longer be paid");

    // 1. Did the shopper already pay through the earlier popup? Settle that instead of charging twice.
    if ((await confirmPayment(order.paystack_reference)) === "paid") {
      res.json({ status: "paid", reference: order.paystack_reference });
      return;
    }

    // 2. Prices and stock may have changed since the order was placed.
    const quote = await quoteCart(order.order_items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity })));
    const unchanged = quote.lines.every((l) => l.status === "ok") && quote.subtotalKobo === order.total_kobo;
    if (!unchanged) {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id).eq("status", "pending");
      throw new AppError(409, "Prices or stock changed since you placed this order, so it was cancelled. Please place a new order.");
    }

    // 3. Swap in a new reference (Paystack rejects reusing one), guarded so two clicks can't race.
    const newReference = `jrs_${randomUUID().replace(/-/g, "")}`;
    const { data: swapped, error: swapError } = await supabase
      .from("orders")
      .update({ paystack_reference: newReference })
      .eq("id", order.id)
      .eq("status", "pending")
      .eq("paystack_reference", order.paystack_reference)
      .select("id");
    if (swapError) throw swapError;
    if (!swapped?.length) throw new AppError(409, "This order was just updated. Please refresh and try again.");

    try {
      const tx = await initializeTransaction({ email: order.email, amountKobo: order.total_kobo, reference: newReference });
      res.json({ status: "ready", reference: newReference, accessCode: tx.access_code, totalKobo: order.total_kobo });
    } catch (err) {
      // Put the old reference back so the order isn't left pointing at a payment that never started.
      await supabase.from("orders").update({ paystack_reference: order.paystack_reference }).eq("id", order.id);
      throw err;
    }
  }),
);