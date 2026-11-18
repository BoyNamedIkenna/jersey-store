import { Link } from "react-router";
import { Jersey } from "@/components/Jersey";
import { QuantityStepper } from "@/components/QuantityStepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatNaira } from "@/lib/format";
import { useCart, useCartCount, useCartTotalKobo } from "@/store/cart";
import { useCartUi } from "@/store/cartUi";

export function CartDrawer() {
  const open = useCartUi((s) => s.open);
  const setOpen = useCartUi((s) => s.setOpen);

  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const count = useCartCount();
  const total = useCartTotalKobo();

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
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-3">
                  <div className="w-20 shrink-0 self-start rounded-md bg-muted p-2">
                    <Jersey
                      sport={item.sport}
                      primary={item.primaryColor}
                      secondary={item.secondaryColor}
                      accent={item.accentColor}
                      pattern={item.pattern}
                      title={item.name}
                      className="w-full"
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
                      <p className="text-xs text-muted-foreground">
                        Size {item.size} · {formatNaira(item.priceKobo)} each
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <QuantityStepper
                        value={item.quantity}
                        max={item.maxStock}
                        onChange={(q) => setQuantity(item.variantId, q)}
                        label={`Quantity for ${item.name}, size ${item.size}`}
                      />
                      <p className="text-sm font-semibold">{formatNaira(item.priceKobo * item.quantity)}</p>
                    </div>

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
              ))}
            </ul>

            <SheetFooter className="border-t p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-lg font-semibold">{formatNaira(total)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Shipping and payment are handled at checkout.</p>
              {/* Wired up in the checkout step, after sign-in exists. */}
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