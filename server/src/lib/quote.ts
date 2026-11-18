import { supabase } from "./supabase";

export interface QuoteRequestItem {
  variantId: string;
  quantity: number;
}

// ok          = the full requested quantity can be bought
// reduced     = some stock exists, but less than requested
// sold_out    = the size exists but has no stock
// unavailable = the variant is gone or its product was deactivated
export type QuoteStatus = "ok" | "reduced" | "sold_out" | "unavailable";

export interface QuoteLine {
  variantId: string;
  status: QuoteStatus;
  requested: number;
  quantity: number; // how many can actually be bought
  stock: number;
  priceKobo: number; // current unit price from the database
  lineTotalKobo: number; // priceKobo * quantity
  name?: string;
  slug?: string;
  size?: string;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalKobo: number;
}

// The only place a cart is priced. The cart drawer shows this result, and order creation
// will call this same function, so what a shopper sees and what they are charged cannot drift apart.
export async function quoteCart(items: QuoteRequestItem[]): Promise<Quote> {
  // The same variant might appear twice in a request, so merge before looking anything up.
  const requested = new Map<string, number>();
  for (const item of items) {
    requested.set(item.variantId, (requested.get(item.variantId) ?? 0) + item.quantity);
  }
  const ids = [...requested.keys()];

  const { data, error } = await supabase
    .from("product_variants")
    .select("id, size, stock, products!inner(slug, name, price_kobo, is_active)")
    .in("id", ids);
  if (error) throw error;

  const variants = new Map<string, any>((data ?? []).map((v: any) => [v.id, v]));

  const lines: QuoteLine[] = ids.map((id) => {
    const want = requested.get(id)!;
    const variant = variants.get(id);

    if (!variant || !variant.products.is_active) {
      return { variantId: id, status: "unavailable", requested: want, quantity: 0, stock: 0, priceKobo: 0, lineTotalKobo: 0 };
    }

    const product = variant.products;
    const quantity = Math.min(want, variant.stock);
    const status: QuoteStatus = variant.stock === 0 ? "sold_out" : quantity < want ? "reduced" : "ok";

    return {
      variantId: id,
      status,
      requested: want,
      quantity,
      stock: variant.stock,
      priceKobo: product.price_kobo,
      lineTotalKobo: product.price_kobo * quantity,
      name: product.name,
      slug: product.slug,
      size: variant.size,
    };
  });

  return {
    lines,
    subtotalKobo: lines.reduce((sum, line) => sum + line.lineTotalKobo, 0),
  };
}