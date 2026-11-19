import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { OrderHistory } from "@/components/OrderHistory";

// First page that talks to a protected API route. If this loads, the whole chain works:
// browser session -> access token -> Express middleware -> database.
export default function AccountPage() {
  const userId = useAuth((s) => s.session?.user.id);

  const query = useQuery({
    queryKey: ["me", userId],
    queryFn: () => {
      // Read the token at call time so a refreshed token is always used.
      const token = useAuth.getState().session?.access_token;
      if (!token) throw new Error("Not signed in");
      return fetchMe(token);
    },
    enabled: Boolean(userId),
  });

  return (
    <main className="mx-auto max-w-2xl p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-semibold">Your account</h1>

      {query.isPending && <p className="text-muted-foreground">Loading…</p>}
      {query.isError && <p className="text-destructive">Could not load your account.</p>}

      {query.data && (
        <dl className="space-y-3 rounded-md border p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{query.data.fullName ?? "Not set"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{query.data.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize">{query.data.role}</dd>
          </div>
        </dl>
      )}

      <OrderHistory />
    </main>
  );
}