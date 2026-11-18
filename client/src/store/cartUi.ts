import { create } from "zustand";

// UI state only (not saved to localStorage). Lets the header button, the product page
// and the drawer itself all open and close the same cart drawer.
interface CartUiState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useCartUi = create<CartUiState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));