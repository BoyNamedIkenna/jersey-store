import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in the server environment");
}

// Server-only client. The secret key bypasses RLS, so every route that uses it
// must do its own checks (validation now, auth and admin checks later).
export const supabase = createClient(url, key, { auth: { persistSession: false } });