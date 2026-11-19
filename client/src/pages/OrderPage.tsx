import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingPayment } from "@/hooks/usePendingPayment";
import { ApiError, fetchOrder, verifyPayment } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useAuth } from "@/store/auth";

export default function OrderPage() {
  const { reference = "" } = useParams();
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  const authLoading = useAuth((s) => s.loading);
  const token = session?.access_token;
  const [checking, setChecking] = useState(false);

  // A retried payment gets a new reference, so move the URL along with it.
  const { pay, busyReference, error: payError } = usePendingPayment({
    onReference: (newReference) => navigate(`/order/${newReference}`, { replace: true }),
  });

  // If someone who was signed in on this page signs out, leave. Guests are never bounced.
  const hadSession = useRef(false);
  useEffect(() => {
    if (authLoading) return;
    if (session) hadSession.current = true;
    else if (hadSession.current) navigate("/", { replace: true });
  }, [session, authLoading, navigate]);

  const order = useQuery({
    queryKey: ["order", reference],
    queryFn: () => fetchOrder(reference, token),
    enabled: !authLoading && reference !== "",
    // While pending, poll every 3 seconds (up to about a minute) in case the webhook confirms the payment.
    refetchInterval: (q) => (q.state.data?.status === "pending" && q.state.dataUpdateCount < 20 ? 3000 : false),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  async function recheck() {
    setChecking(true);
    try {
      await verifyPayment(reference, token);
    } catch {
      /* the refetch below shows the real status */
    } finally {
      await order.refetch();
      setChecking(false);
    }
  }

  if (authLoading || order.isPending) {
    return (
      <main className="mx-auto max-w-xl space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </main>
    );
  }

  if (order.isError) {
    const notFound = order.error instanceof ApiError && order.error.status === 404;
    return (
      <main className="mx-auto max-w-xl space-y-4 p-6">
        <p className="text-destructive">{notFound ? "We could not find that order." : "We could not load this order."}</p>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Back to the store
        </Link>
      </main>
    );
  }

  const o = order.data;

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      {o.status === "paid" && (
        <div>
          <h1 className="text-2xl font-semibold">Thank you, your order is confirmed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep this page's link. It is your receipt. This is a demo store, so nothing will actually ship.
          </p>
        </div>
      )}

      {o.status === "pending" && (
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">Waiting for payment</h1>
          <p className="text-sm text-muted-foreground">
            If you already paid, this page updates by itself. Otherwise you can complete the payment below.
          </p>
          {payError && (
            <p role="alert" className="text-sm text-destructive">
              {payError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => pay(reference)} disabled={busyReference !== null}>
              {busyReference !== null ? "Opening payment…" : "Complete payment"}
            </Button>
            <Button variant="outline" size="sm" onClick={recheck} disabled={checking}>
              {checking ? "Checking…" : "Check payment status"}
            </Button>
          </div>
        </div>
      )}

      {(o.status === "failed" || o.status === "cancelled") && (
        <div>
          <h1 className="text-2xl font-semibold">This order could not be completed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            If you were charged, the payment will be refunded. You are welcome to try again.
          </p>
        </div>
      )}

      <section className="space-y-3 rounded-lg border p-4">
        <div className="text-xs text-muted-foreground">Reference {o.reference}</div>
        <ul className="space-y-2 text-sm">
          {o.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {item.name} <span className="text-muted-foreground">· Size {item.size} · Qty {item.quantity}</span>
              </span>
              <span>{formatNaira(item.unitPriceKobo * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-3 font-semibold">
          <span>Total</span>
          <span>{formatNaira(o.totalKobo)}</span>
        </div>
      </section>

      <Link to="/" className={buttonVariants({ variant: "outline" })}>
        Continue shopping
      </Link>
    </main>
  );
}