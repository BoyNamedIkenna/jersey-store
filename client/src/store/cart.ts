import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Pattern, QuoteLine, Sport } from "@/lib/api";

// Everything the cart needs to display a line without refetching the product.
// priceKobo is for display only. The server recomputes prices from the database at checkout.
export interface CartItem {
  variantId: string;
  slug: string;
  name: string;
  size: string;
  priceKobo: number;
  quantity: number;
  maxStock: number; // stock when the item was added; checkout will re-check it
  sport: Sport;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: Pattern;
}

interface CartState {
  items: CartItem[];
  // Adds up to `quantity` of the item, never beyond the stock we know about.
  // Returns how many were actually added (0 if the cart already holds all of it).
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => number;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  // Applies fresh server data: updates price, name and stock limit, and trims quantities
  // that no longer fit. Sold-out and unavailable lines are left for the drawer to flag.
  syncWithQuote: (lines: QuoteLine[]) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item, quantity = 1) => {
        const existing = get().items.find((i) => i.variantId === item.variantId);
        const inCart = existing?.quantity ?? 0;
        const toAdd = Math.max(0, Math.min(quantity, item.maxStock - inCart));
        if (toAdd === 0) return 0;

        set((state) => ({
          items: existing
            ? state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + toAdd, maxStock: item.maxStock, priceKobo: item.priceKobo }
                  : i
              )
            : [...state.items, { ...item, quantity: toAdd }],
        }));
        return toAdd;
      },

      setQuantity: (variantId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxStock)) } : i
          ),
        })),

      remove: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),

      clear: () => set({ items: [] }),

      syncWithQuote: (lines) =>
        set((state) => ({
          items: state.items.map((item) => {
            const line = lines.find((l) => l.variantId === item.variantId);
            if (!line || line.status === "sold_out" || line.status === "unavailable") return item;
            return {
              ...item,
              name: line.name ?? item.name,
              priceKobo: line.priceKobo,
              maxStock: line.stock,
              quantity: Math.min(item.quantity, line.stock),
            };
          }),
        })),
    }),
    { name: "jersey-cart" } // localStorage key
  )
);

// Selectors: components that use these only re-render when the derived value changes.
export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
export const useCartTotalKobo = () => useCart((s) => s.items.reduce((sum, i) => sum + i.priceKobo * i.quantity, 0));