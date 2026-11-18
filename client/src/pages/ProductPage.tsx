import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Jersey } from "@/components/Jersey";
import { QuantityStepper } from "@/components/QuantityStepper";
import { SizeSelector } from "@/components/SizeSelector";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchProduct, type ProductDetail } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/store/cart";
import { useCartUi } from "@/store/cartUi";

const LOW_STOCK = 3;

function ProductView({ product }: { product: ProductDetail }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const add = useCart((s) => s.add);
  const setCartOpen = useCartUi((s) => s.setOpen);
  // How many of the selected size are already in the cart.
  const inCart = useCart((s) => s.items.find((i) => i.variantId === selectedId)?.quantity ?? 0);

  const selected = product.variants.find((v) => v.id === selectedId);
  // What can still be added: stock minus what the cart already holds.
  const remaining = selected ? Math.max(0, selected.stock - inCart) : 0;
  // If the cart grew since the stepper was set, keep the shown quantity within bounds.
  const qty = Math.min(quantity, Math.max(remaining, 1));

  function handleSelect(variantId: string) {
    setSelectedId(variantId);
    setQuantity(1);
  }

  function handleAdd() {
    if (!selected || remaining === 0) return;
    const added = add(
      {
        variantId: selected.id,
        slug: product.slug,
        name: product.name,
        size: selected.size,
        priceKobo: product.priceKobo,
        maxStock: selected.stock,
        sport: product.sport,
        primaryColor: product.primaryColor,
        secondaryColor: product.secondaryColor,
        accentColor: product.accentColor,
        pattern: product.pattern,
      },
      qty
    );
    if (added > 0) setCartOpen(true);
    setQuantity(1);
    setFeedback(added === 1 ? "Added 1 to cart" : `Added ${added} to cart`);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
  }

  let buttonLabel = "Select a size";
  if (selected) buttonLabel = remaining === 0 ? "Maximum quantity in your cart" : `Add ${qty} to cart`;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="rounded-xl bg-muted p-8">
        <Jersey
          sport={product.sport}
          primary={product.primaryColor}
          secondary={product.secondaryColor}
          accent={product.accentColor}
          pattern={product.pattern}
          title={product.name}
          className="mx-auto w-full max-w-md"
        />
      </div>

      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {product.kit}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {product.league.name} · {product.season}
          </span>
        </div>

        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="text-2xl font-semibold">{formatNaira(product.priceKobo)}</p>
        <p className="text-muted-foreground">{product.description}</p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Size</p>
          <SizeSelector variants={product.variants} selectedId={selectedId} onSelect={handleSelect} />
          {selected && (
            <p className="text-sm text-muted-foreground">
              {selected.stock <= LOW_STOCK ? `Only ${selected.stock} left` : "In stock"}
              {inCart > 0 && ` · ${inCart} in your cart`}
            </p>
          )}
        </div>

        {selected && remaining > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Quantity</p>
            <QuantityStepper value={qty} max={remaining} onChange={setQuantity} />
          </div>
        )}

        <Button size="lg" className="w-full" disabled={!selected || remaining === 0} onClick={handleAdd}>
          {buttonLabel}
        </Button>
        <p role="status" className="min-h-5 text-sm">
          {feedback}
        </p>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { slug = "" } = useParams();

  const query = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProduct(slug),
    // A 404 will not fix itself, so do not retry it.
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });

  const is404 = query.error instanceof ApiError && query.error.status === 404;

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <Link to="/" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Back to jerseys
      </Link>

      {query.isPending && <ProductSkeleton />}

      {is404 && (
        <div className="rounded-md border p-6 text-center">
          <p className="mb-3">We could not find that jersey.</p>
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Browse all jerseys
          </Link>
        </div>
      )}

      {query.isError && !is404 && (
        <div className="rounded-md border p-6 text-center">
          <p className="mb-3">Could not load this jersey.</p>
          <Button onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}

      {/* key resets the selected size and quantity when you navigate from one product to another */}
      {query.data && <ProductView key={query.data.id} product={query.data} />}
    </main>
  );
}