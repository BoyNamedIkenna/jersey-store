import { supabase } from "./supabase";
import { verifyTransaction } from "./paystack";
import { AppError } from "../middleware/error";

export type PaymentStatus = "paid" | "pending";

// viewer is passed by /payments/verify. If the order belongs to a user, only that user may confirm it.
// Guest orders (user_id null) are confirmed by anyone holding the unguessable reference.
// The webhook passes no viewer: its authority is the signature check.
export async function confirmPayment(
  reference: string,
  viewer?: { userId: string | null },
): Promise<PaymentStatus> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, status, total_kobo")
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (error) throw error;
  if (!order || (viewer && order.user_id && order.user_id !== viewer.userId)) {
    throw new AppError(404, "Order not found");
  }

  if (order.status === "paid") return "paid";
  if (order.status !== "pending") throw new AppError(409, "This order can no longer be paid");

  const tx = await verifyTransaction(reference);
  if (tx.status !== "success") return "pending";

  if (tx.amount !== order.total_kobo || tx.currency !== "NGN") {
    console.error(`Amount mismatch on ${reference}: paid ${tx.amount} ${tx.currency}, expected ${order.total_kobo}`);
    throw new AppError(409, "Payment amount does not match the order");
  }

  const { error: payError } = await supabase.rpc("mark_order_paid", { p_reference: reference });
  if (payError) {
    if (payError.message.includes("insufficient_stock")) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
      console.error(`REFUND NEEDED: order ${order.id} (${reference}) was paid but is out of stock`);
      throw new AppError(409, "Payment received, but an item sold out before we could confirm. You will be refunded.");
    }
    throw payError;
  }
  return "paid";
}