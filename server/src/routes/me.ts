import { Router } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";

export const meRouter = Router();

// GET /me: who is signed in, and what role do they have.
// The user id comes from the verified token, never from the request.
meRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;

    res.json({
      id: user.id,
      email: user.email,
      fullName: data?.full_name ?? null,
      role: data?.role ?? "customer",
    });
  })
);