import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  loading: boolean; // true until Supabase has reported the stored session once
}

export const useAuth = create<AuthState>()(() => ({ session: null, loading: true }));

// Supabase calls this once on startup with the stored session, then again on sign-in,
// sign-out and every token refresh. Keep it to a plain state update: awaiting other
// Supabase calls inside this callback can deadlock the client.
supabase.auth.onAuthStateChange((_event, session) => {
  useAuth.setState({ session, loading: false });
});

export const signOut = () => supabase.auth.signOut();