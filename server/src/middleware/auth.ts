import type { RequestHandler } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "./error";

export interface AuthUser {
  id: string;
  email: string | null;
}

// Lets route handlers read req.user with the right type.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Protects a route. The browser sends "Authorization: Bearer <access token>".
// getClaims() verifies the token's signature (against Supabase's published signing keys, cached)
// and checks it has not expired. Never trust a user id that comes from the request body or query.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AppError(401, "Sign in required");

    const token = header.slice("Bearer ".length);
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) throw new AppError(401, "Invalid or expired session");

    req.user = {
      id: data.claims.sub,
      email: (data.claims as { email?: string }).email ?? null,
    };
    next();
  } catch (err) {
    next(err);
  }
};