import { AppError } from "../middleware/error";

const BASE = "https://api.paystack.co";

async function paystack<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    });
  } catch {
    throw new AppError(502, "Could not reach the payment provider");
  }

  const json = (await res.json().catch(() => null)) as
    | { status?: boolean; message?: string; data?: T }
    | null;

  if (!res.ok || !json?.status || !json.data) {
    console.error("Paystack error:", res.status, json?.message);
    throw new AppError(502, "Payment provider error");
  }
  return json.data;
}

export interface InitializedTransaction {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
}): Promise<InitializedTransaction> {
  return paystack<InitializedTransaction>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo, // Paystack takes the smallest unit, which is kobo, same as our database
      reference: input.reference,
      currency: "NGN",
    }),
  });
}

export interface VerifiedTransaction {
  status: string; // "success" | "abandoned" | "failed" | ...
  amount: number;
  currency: string;
  reference: string;
}

export function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  return paystack<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}