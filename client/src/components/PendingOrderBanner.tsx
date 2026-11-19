import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { ApiError, fetchOrder } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { usePendingOrder } from "@/store/pendingOrder";

export function PendingOrderBanner() {
  const reference = usePendingOrder((s) => s.reference);
  const clear = usePendingOrder((s) => s.clear);
  const authLoading = useAuth((s) => s.loading);
  const token = useAuth((s) => s.session?.access_token);
  const { pathname } = useLocation();

  const order = useQuery({
    queryKey: ["order", reference],
    queryFn: () => fetchOrder(reference!, token),
    enabled: !!reference && !authLoading,
    retry: false,
  });

  // Forget the order once it is paid, cancelled, deleted by the cleanup job, or no longer visible to this user.
  const gone = order.isError && order.error instanceof ApiError && order.error.status === 404;
  const settled = order.isSuccess && order.data.status !== "pending";
  useEffect(() => {
    if (gone || settled) clear();
  }, [gone, settled, clear]);

  if (!reference || !order.isSuccess || order.data.status !== "pending") return null;
  if (pathname.startsWith("/order/") || pathname === "/checkout") return null;

  return (
    <div className="border-b bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 p-3 text-sm">
        <span>You have an unpaid order.</span>
        <Link to={`/order/${reference}`} className="font-medium underline">
          Complete payment
        </Link>
      </div>
    </div>
  );
}