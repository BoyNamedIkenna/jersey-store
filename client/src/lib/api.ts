const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const PAGE_SIZE = 12;

export type Sport = "football" | "basketball" | "baseball";
export type Kit = "home" | "away" | "third";
export type Size = "S" | "M" | "L" | "XL" | "XXL";
export type SortKey = "newest" | "price_asc" | "price_desc";
export type Pattern = "solid" | "stripes" | "hoops" | "sash" | "halves";
export type QuoteStatus = "ok" | "reduced" | "sold_out" | "unavailable";


export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Variant {
  id: string;
  size: Size;
  stock: number;
}

export interface ProductDetail extends Product {
  description: string;
  variants: Variant[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  kit: Kit;
  season: string;
  priceKobo: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: Pattern;
  sport: Sport;
  team: { name: string; slug: string };
  league: { name: string; slug: string };
}

export interface ProductPage {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface League {
  name: string;
  slug: string;
  sport: Sport;
  country: string | null;
  teams: { name: string; slug: string }[];
}

export interface CatalogueFilters {
  sport?: Sport;
  league?: string;
  team?: string;
  kit?: Kit;
  size?: Size;
  maxPrice?: number; // kobo
  sort: SortKey;
  page: number;
}

export interface QuoteLine {
  variantId: string;
  status: QuoteStatus;
  requested: number;
  quantity: number;
  stock: number;
  priceKobo: number;
  lineTotalKobo: number;
  name?: string;
  slug?: string;
  size?: string;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalKobo: number;
}

export interface Me {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "customer" | "admin";
}

async function get<T>(path: string, params: Record<string, string | number | undefined> = {},token?: string): Promise<T> {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
 const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export  function fetchProducts(filters: CatalogueFilters): Promise<ProductPage> {
  return get<ProductPage>("/products", { ...filters, pageSize: PAGE_SIZE });
}

export function fetchLeagues(): Promise<League[]> {
  return get<League[]>("/leagues");
}

export function fetchProduct(slug: string): Promise<ProductDetail> {
  return get<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
}

export async function fetchQuote(items: { variantId: string; quantity: number }[]): Promise<Quote> {
  const res = await fetch(new URL("/cart/quote", API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);
  return res.json() as Promise<Quote>;
}

export function fetchMe(token: string): Promise<Me> {
  return get<Me>("/me", {}, token);
}