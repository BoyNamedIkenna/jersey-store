import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrders, type OrderStatus } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { usePendingPayment } from "@/hooks/usePendingPayment";

const STATUS_LABEL: Record<OrderStatus, string> = {
    paid: "Paid",
    pending: "Awaiting payment",
    failed: "Failed",
    cancelled: "Cancelled",
};

const STATUS_STYLE: Record<OrderStatus, string> = {
    paid: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    cancelled: "bg-muted text-muted-foreground",
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

export function OrderHistory() {
    const session = useAuth((s) => s.session);
    const token = session?.access_token;

    const orders = useQuery({
        queryKey: ["orders", session?.user.id],
        queryFn: () => fetchOrders(token!),
        enabled: !!token,
    });
    const { pay, busyReference, error: payError } = usePendingPayment();

    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold">Your orders</h2>

            {orders.isPending && (
                <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            )}

            {orders.isError && (
                <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                    <p className="text-sm text-destructive">We could not load your orders.</p>
                    <Button variant="outline" size="sm" onClick={() => orders.refetch()}>
                        Retry
                    </Button>
                </div>
            )}

            {orders.isSuccess && orders.data.length === 0 && (
                <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">You have not placed any orders yet.</p>
                    <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Browse jerseys
                    </Link>
                </div>
            )}
            {payError && (
                <p role="alert" className="text-sm text-destructive">
                    {payError}
                </p>
            )}

            {orders.isSuccess && orders.data.length > 0 && (
                <ul className="space-y-3">
                    {orders.data.map((order) => {
                        const units = order.items.reduce((n, i) => n + i.quantity, 0);
                        return (
                            <li key={order.reference} className="space-y-2 rounded-lg border p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status]}`}>
                                        {STATUS_LABEL[order.status]}
                                    </span>
                                </div>

                                <ul className="space-y-0.5 text-sm">
                                    {order.items.map((item, i) => (
                                        <li key={i}>
                                            {item.name} <span className="text-muted-foreground">· Size {item.size} · Qty {item.quantity}</span>
                                        </li>
                                    ))}
                                </ul>

                                {order.status === "pending" && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Unpaid orders are removed automatically after 2 days.</p>
                                        <Button size="sm" onClick={() => pay(order.reference)} disabled={busyReference !== null}>
                                            {busyReference === order.reference ? "Opening payment…" : "Complete payment"}
                                        </Button>
                                    </div>
                                )}

                                <div className="flex items-center justify-between border-t pt-2">
                                    <span className="text-sm font-semibold">
                                        {formatNaira(order.totalKobo)}{" "}
                                        <span className="font-normal text-muted-foreground">
                                            · {units} {units === 1 ? "item" : "items"}
                                        </span>
                                    </span>
                                    <Link to={`/order/${order.reference}`} className="text-sm underline">
                                        View
                                    </Link>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}