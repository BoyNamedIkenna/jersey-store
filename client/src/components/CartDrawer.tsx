import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Jersey } from "@/components/Jersey";
import { QuantityStepper } from "@/components/QuantityStepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchQuote, type QuoteStatus } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useCart, useCartCount } from "@/store/cart";
import { useCartUi } from "@/store/cartUi";

// A price is only shown once the server has confirmed it. Until then, a placeholder.
type PriceState = "fresh" | "loading" | "error";

function Money({ kobo, state }: { kobo: number; state: PriceState }) {
  if (state === "fresh") return <>{formatNaira(kobo)}</>;
  if (state === "error") return <>—</>;
  return <Skeleton className="inline-block h-3.5 w-16 align-middle" />;
}

export function CartDrawer() {
  const open = useCartUi((s) => s.open);
  const setOpen = useCartUi((s) => s.setOpen);

  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const count = useCartCount();

  // Ask the server for current prices and availability whenever the drawer opens, the set of
  // items changes, or the window regains focus. Quantity changes do not refetch: unit prices
  // do not depend on quantity, so line totals are computed from the confirmed unit price.
  const variantKey = items
    .map((i) => i.variantId)
    .sort()
    .join(",");

  const quote = useQuery({
    queryKey: ["cart-quote", variantKey],
    queryFn: async () => {
      const current = useCart.getState().items;
      const result = await fetchQuote(current.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));
      // Write the confirmed prices and limits back into the cart.
      useCart.getState().syncWithQuote(result.lines);
      return result;
    },
    enabled: open && items.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const priceState: PriceState = quote.isError
    ? "error"
    : quote.isSuccess && !quote.isFetching
      ? "fresh"
      : "loading";

  const statusById = new Map<string, QuoteStatus>((quote.data?.lines ?? []).map((l) => [l.variantId, l.status]));
  const isUnavailable = (status: QuoteStatus | undefined) => status === "sold_out" || status === "unavailable";

  const subtotal = items.reduce(
    (sum, item) => (isUnavailable(statusById.get(item.variantId)) ? sum : sum + item.priceKobo * item.quantity),
    0
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Your cart ({count})</SheetTitle>
          <SheetDescription>Review your jerseys before checkout.</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link to="/" onClick={() => setOpen(false)} className={buttonVariants({ variant: "outline" })}>
              Browse jerseys
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-5 overflow-y-auto p-4">
              {items.map((item) => {
                const status = priceState === "fresh" ? statusById.get(item.variantId) : undefined;
                const unavailable = isUnavailable(status);

                return (
                  <li key={item.variantId} className="flex gap-3">
                    <div className="w-20 shrink-0 self-start rounded-md bg-muted p-2">
                      <Jersey
                        sport={item.sport}
                        primary={item.primaryColor}
                        secondary={item.secondaryColor}
                        accent={item.accentColor}
                        pattern={item.pattern}
                        title={item.name}
                        className={`w-full ${unavailable ? "opacity-40" : ""}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <Link
                          to={`/products/${item.slug}`}
                          onClick={() => setOpen(false)}
                          className="text-sm font-medium leading-snug hover:underline"
                        >
                          {item.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          Size {item.size} ·{" "}
                          {unavailable ? "—" : <Money kobo={item.priceKobo} state={priceState} />} each
                        </div>
                      </div>

                      {unavailable && (
                        <p className="text-xs text-destructive">No longer available. Remove it to continue.</p>
                      )}
                      {status === "reduced" && (
                        <p className="text-xs text-muted-foreground">Quantity adjusted to what we can supply.</p>
                      )}

                      {!unavailable && (
                        <div className="flex items-center justify-between gap-2">
                          <QuantityStepper
                            value={item.quantity}
                            max={item.maxStock}
                            onChange={(q) => setQuantity(item.variantId, q)}
                            label={`Quantity for ${item.name}, size ${item.size}`}
                          />
                          <div className="text-sm font-semibold">
                            <Money kobo={item.priceKobo * item.quantity} state={priceState} />
                          </div>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground"
                        onClick={() => remove(item.variantId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <SheetFooter className="border-t p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-lg font-semibold">
                  <Money kobo={subtotal} state={priceState} />
                </span>
              </div>

              {priceState === "loading" && (
                <p className="text-xs text-muted-foreground">Checking current prices…</p>
              )}
              {priceState === "error" && (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-destructive">We could not confirm current prices.</p>
                  <Button variant="outline" size="sm" onClick={() => quote.refetch()}>
                    Retry
                  </Button>
                </div>
              )}
              {priceState === "fresh" && (
                <p className="text-xs text-muted-foreground">Shipping and payment are handled at checkout.</p>
              )}

              {/* Wired up in the checkout step. It will require fresh prices and no unavailable lines. */}
              <Button size="lg" className="w-full" disabled>
                Checkout
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}