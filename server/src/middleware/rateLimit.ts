import rateLimit from "express-rate-limit";

function limiter(windowMinutes: number, limit: number, message: string) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: message },
  });
}

// Everything not listed below. Generous, because phones and offices put many people behind one address.
export const generalLimiter = limiter(15, 600, "Too many requests. Please slow down and try again shortly.");

// Creating or restarting an order writes to the database and calls Paystack.
export const orderWriteLimiter = limiter(15, 15, "Too many checkout attempts. Please wait a few minutes and try again.");

// Each verify call asks Paystack about a payment.
export const paymentLimiter = limiter(15, 40, "Too many payment checks. Please wait a few minutes and try again.");