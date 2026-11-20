const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const PAGE_SIZE = 12;

export type Sport = "football" | "basketball" | "baseball";
export type Kit = "home" | "away" | "third";
export type Size = "S" | "M" | "L" | "XL" | "XXL";
export type SortKey = "newest" | "price_asc" | "price_desc";
export type Pattern = "solid" | "stripes" | "hoops" | "sash" | "halves";
export type QuoteStatus = "ok" | "reduced" | "sold_out" | "unavailable";
export type PaymentStatus = "paid" | "pending";
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";


export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
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

export interface CheckoutInput {
  items: { variantId: string; quantity: number }[];
  email?: string; // guests only; the server uses the account email when signed in
  shipping: { name: string; phone: string; address: string; city: string; state: string };
}

export interface CreatedOrder {
  orderId: string;
  reference: string;
  accessCode: string;
  authorizationUrl: string;
  totalKobo: number;
}

export interface OrderSummary {
  reference: string;
  status: OrderStatus;
  totalKobo: number;
  createdAt: string;
  items: { name: string; size: string; quantity: number; unitPriceKobo: number }[];
}

export interface AssistantProduct extends Product {
  sizesInStock: string[];
}

export interface AssistantFilters {
  query: string;
  sport: Sport | null;
  league: string | null;
  teams: string[];
  kit: Kit | null;
  color: string | null;
  maxPriceNaira: number | null;
  size: Size | null;
  minPriceNaira: number | null;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantReply {
  reply: string;
  products: AssistantProduct[];
  filters: AssistantFilters | null;
}

export type AssistantStreamEvent =
  | { type: "status"; text: string }
  | { type: "products"; products: AssistantProduct[]; filters: AssistantFilters | null }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "done"; reply: string; products: AssistantProduct[]; filters: AssistantFilters | null }
  | { type: "error"; message: string };


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

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(new URL(path, API_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof json?.error === "string" ? json.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, json);
  }
  return json as T;
}

export function createOrder(input: CheckoutInput, token?: string): Promise<CreatedOrder> {
  return post<CreatedOrder>("/orders", input, token);
}

export function verifyPayment(reference: string, token?: string): Promise<{ status: PaymentStatus }> {
  return post<{ status: PaymentStatus }>("/payments/verify", { reference }, token);
}

export function fetchOrder(reference: string, token?: string): Promise<OrderSummary> {
  return get<OrderSummary>(`/orders/${encodeURIComponent(reference)}`, {}, token);
}

export function fetchOrders(token: string): Promise<OrderSummary[]> {
  return get<OrderSummary[]>("/orders", {}, token);
}

export type PayOrderResult =
  | { status: "paid"; reference: string }
  | { status: "ready"; reference: string; accessCode: string; totalKobo: number };

export function payForOrder(reference: string, token?: string): Promise<PayOrderResult> {
  return post<PayOrderResult>(`/orders/${encodeURIComponent(reference)}/pay`, {}, token);
}

export function askAssistant(messages: AssistantMessage[]): Promise<AssistantReply> {
  return post<AssistantReply>("/assistant", { messages });
}


// Reads the server-sent events from POST /assistant/stream. EventSource cannot POST, so this uses fetch.
export async function streamAssistant(
  messages: AssistantMessage[],
  onEvent: (event: AssistantStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(new URL("/assistant/stream", API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    ...(signal ? { signal } : {}),
  });

  // Limits and validation fail before the stream starts, as plain JSON errors.
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => null);
    const message = typeof json?.error === "string" ? json.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, json);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line.
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)) as AssistantStreamEvent);
      boundary = buffer.indexOf("\n\n");
    }
  }
}