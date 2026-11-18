import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/store/auth";

// Wrap routes that need a signed-in user. Visitors are sent to /login and returned afterwards.
// This only improves the experience. The server checks the token on every protected request.
export function RequireAuth() {
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const location = useLocation();

  if (loading) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}