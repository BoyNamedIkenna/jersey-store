import { Link, Route, Routes } from "react-router";
import { CartDrawer } from "@/components/CartDrawer";
import { Button } from "@/components/ui/button";
import CataloguePage from "@/pages/CataloguePage";
import ProductPage from "@/pages/ProductPage";
import { useCartCount } from "@/store/cart";
import { useCartUi } from "@/store/cartUi";

export default function App() {
  const cartCount = useCartCount();
  const setCartOpen = useCartUi((s) => s.setOpen);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link to="/" className="text-lg font-semibold">
            Jersey Store
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted-foreground sm:inline">Demo store · test payments only</span>
            <Button variant="outline" size="sm" onClick={() => setCartOpen(true)}>
              Cart ({cartCount})
            </Button>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<CataloguePage />} />
        <Route path="/products/:slug" element={<ProductPage />} />
        <Route path="*" element={<p className="p-6">Page not found.</p>} />
      </Routes>

      <CartDrawer />
    </div>
  );
}