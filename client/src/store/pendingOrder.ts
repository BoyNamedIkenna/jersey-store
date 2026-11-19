import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PendingOrderState {
  reference: string | null;
  remember: (reference: string) => void;
  clear: () => void;
}

export const usePendingOrder = create<PendingOrderState>()(
  persist(
    (set) => ({
      reference: null,
      remember: (reference) => set({ reference }),
      clear: () => set({ reference: null }),
    }),
    { name: "jersey-pending-order" },
  ),
);