import type { RequestHandler } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "./error";

export interface AuthUser {
  id: string;
  email: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function verifyBearer(header: string): Promise<AuthUser> {
  const token = header.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new AppError(401, "Invalid or expired session");
  return {
    id: data.claims.sub,
    email: (data.claims as { email?: string }).email ?? null,
  };
}

// Protects a route. Never trust a user id that comes from the request body or query.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AppError(401, "Sign in required");
    req.user = await verifyBearer(header);
    next();
  } catch (err) {
    next(err);
  }
};

// For routes that guests may use. No token means guest (req.user stays undefined).
// A token that is present but invalid is still rejected, so an expired session
// asks the shopper to sign in again instead of quietly becoming a guest order.
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) req.user = await verifyBearer(header);
    next();
  } catch (err) {
    next(err);
  }
};