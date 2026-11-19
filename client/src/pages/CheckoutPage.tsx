import { useQuery } from "@tanstack/react-query";
import { useState, type ComponentProps, type FormEvent } from "react";
import PaystackPop from "@paystack/inline-js";
import { Link, useNavigate } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createOrder, fetchQuote, verifyPayment, type QuoteLine } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { useCart } from "@/store/cart";
import { usePendingOrder } from "@/store/pendingOrder";

interface FormState {
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
}
type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = { email: "", name: "", phone: "", address: "", city: "", state: "" };

// Mirrors the server's zod rules, so the server stays the real gatekeeper and this just saves a round trip.
function validate(form: FormState, needsEmail: boolean): FormErrors {
  const errors: FormErrors = {};
  if (needsEmail && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address";
  if (form.name.trim().length < 2) errors.name = "Enter your full name";
  if (form.phone.trim().length < 7) errors.phone = "Enter a phone number";
  if (form.address.trim().length < 5) errors.address = "Enter your delivery address";
  if (form.city.trim().length < 2) errors.city = "Enter your city";
  if (form.state.trim().length < 2) errors.state = "Enter your state";
  return errors;
}

function Field({
  id,
  label,
  error,
  ...props
}: { id: string; label: string; error?: string } & ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  const authLoading = useAuth((s) => s.loading);
  const token = session?.access_token;

  const items = useCart((s) => s.items);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const variantKey = items
    .map((i) => i.variantId)
    .sort()
    .join(",");

  // Same idea as the drawer: the server prices everything, and the confirmed result is written back into the cart.
  const quote = useQuery({
    queryKey: ["checkout-quote", variantKey],
    queryFn: async () => {
      const current = useCart.getState().items;
      const result = await fetchQuote(current.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));
      useCart.getState().syncWithQuote(result.lines);
      return result;
    },
    enabled: items.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  if (authLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-6 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Browse jerseys
        </Link>
      </main>
    );
  }

  const nameById = new Map(items.map((i) => [i.variantId, i]));
  const lines = quote.data?.lines ?? [];
  const blocked = lines.filter((l) => l.status === "sold_out" || l.status === "unavailable");
  const adjusted = lines.some((l) => l.status === "reduced");
  const pricesReady = quote.isSuccess && !quote.isFetching;
  const canPay = pricesReady && blocked.length === 0 && !submitting;
  const accountEmail = session?.user.email ?? null;

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function finish(reference: string) {
    // The popup reported success. Ask the server to confirm; if that call fails, the webhook or the
    // confirmation page's own check settles the order, so the shopper is never stuck here.
    try {
      await verifyPayment(reference, token);
    } catch {
      /* the confirmation page shows the real status */
    }
    navigate(`/order/${reference}`);
    useCart.getState().clear();
    usePendingOrder.getState().clear();
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = validate(form, !session);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const order = await createOrder(
        {
          items: useCart.getState().items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          email: session ? undefined : form.email.trim(),
          shipping: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
          },
        },
        token,
      );
      usePendingOrder.getState().remember(order.reference);

      const popup = new PaystackPop();
      popup.resumeTransaction(order.accessCode, {
        onSuccess: () => {
          void finish(order.reference);
        },
        onCancel: () => {
          setSubmitting(false);
          setFormError("Payment cancelled. Your cart is unchanged, so you can try again.");
        },
        onError: () => {
          setSubmitting(false);
          setFormError("The payment window ran into a problem. Please try again.");
        },
      });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 409) {
        // The cart changed between the last price check and now. Apply what the server says and re-check.
        const changed = (err.body as { lines?: QuoteLine[] } | null)?.lines;
        if (changed) useCart.getState().syncWithQuote(changed);
        void quote.refetch();
        setFormError("Some items in your cart changed. Please review the order summary and try again.");
      } else if (err instanceof ApiError && err.status === 401) {
        setFormError("Your session expired. Please sign in again.");
      } else {
        setFormError("We could not start the payment. Please try again.");
      }
    }
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-4 md:grid-cols-[1fr_380px] md:p-6">
      <form onSubmit={handlePay} className="space-y-6" noValidate>
        <h1 className="text-2xl font-semibold">Checkout</h1>

        <section className="space-y-4">
          <h2 className="font-medium">Contact</h2>
          {session ? (
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="text-foreground">{accountEmail}</span>
            </p>
          ) : (
            <>
              <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                error={errors.email}
              />
              <p className="text-xs text-muted-foreground">
                Checking out as a guest. Have an account?{" "}
                <Link to="/login?next=/checkout" className="underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-medium">Delivery</h2>
          <Field
            id="name"
            label="Full name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            error={errors.name}
          />
          <Field
            id="phone"
            label="Phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            error={errors.phone}
          />
          <Field
            id="address"
            label="Address"
            autoComplete="street-address"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            error={errors.address}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="city"
              label="City"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              error={errors.city}
            />
            <Field
              id="state"
              label="State"
              autoComplete="address-level1"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              error={errors.state}
            />
          </div>
        </section>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={!canPay}>
          {submitting ? "Opening payment…" : pricesReady ? `Pay ${formatNaira(quote.data?.subtotalKobo ?? 0)}` : "Checking prices…"}
        </Button>
        <p className="text-xs text-muted-foreground">Demo store: payments run in Paystack test mode and no real money moves.</p>
      </form>

      <aside className="h-fit space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">Order summary</h2>

        {quote.isError && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">We could not confirm current prices.</p>
            <Button variant="outline" size="sm" type="button" onClick={() => quote.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!quote.isError && !pricesReady && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {pricesReady && (
          <>
            <ul className="space-y-3 text-sm">
              {lines.map((line) => {
                const cartItem = nameById.get(line.variantId);
                const name = line.name ?? cartItem?.name ?? "Item";
                const size = line.size ?? cartItem?.size;
                const out = line.status === "sold_out" || line.status === "unavailable";
                return (
                  <li key={line.variantId} className="flex justify-between gap-3">
                    <div className={out ? "text-muted-foreground line-through" : ""}>
                      {name}
                      <div className="text-xs text-muted-foreground">
                        Size {size} · Qty {out ? line.requested : line.quantity}
                      </div>
                    </div>
                    <div>{out ? "—" : formatNaira(line.lineTotalKobo)}</div>
                  </li>
                );
              })}
            </ul>

            {blocked.length > 0 && (
              <p className="text-sm text-destructive">
                Some items are no longer available. Remove them from your cart to continue.{" "}
                <button type="button" className="underline" onClick={() => useCart.getState().remove(blocked[0].variantId)}>
                  Remove {nameById.get(blocked[0].variantId)?.name ?? "item"}
                </button>
              </p>
            )}
            {adjusted && (
              <p className="text-sm text-muted-foreground">We adjusted some quantities to what we can supply.</p>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-semibold">{formatNaira(quote.data?.subtotalKobo ?? 0)}</span>
            </div>
          </>
        )}
      </aside>
    </main>
  );
}