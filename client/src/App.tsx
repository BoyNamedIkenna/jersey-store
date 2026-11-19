import { Link, Route, Routes } from "react-router";
import { CartDrawer } from "@/components/CartDrawer";
import { RequireAuth } from "@/components/RequireAuth";
import { Button, buttonVariants } from "@/components/ui/button";
import AccountPage from "@/pages/AccountPage";
import AuthPage from "@/pages/AuthPage";
import CataloguePage from "@/pages/CataloguePage";
import ProductPage from "@/pages/ProductPage";
import { useCartCount } from "@/store/cart";
import { useCartUi } from "@/store/cartUi";
import { signOut, useAuth } from "@/store/auth";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderPage from "@/pages/OrderPage";

export default function App() {
  const cartCount = useCartCount();
  const setCartOpen = useCartUi((s) => s.setOpen);
  const session = useAuth((s) => s.session);
  const authLoading = useAuth((s) => s.loading);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
          <Link to="/" className="text-lg font-semibold">
            Jersey Store
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground lg:inline">Demo store · test payments only</span>

            {!authLoading &&
              (session ? (
                <>
                  <Link to="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Account
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    Sign out
                  </Button>
                </>
              ) : (
                <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Sign in
                </Link>
              ))}

            <Button variant="outline" size="sm" onClick={() => setCartOpen(true)}>
              Cart ({cartCount})
            </Button>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<CataloguePage />} />
        <Route path="/products/:slug" element={<ProductPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:reference" element={<OrderPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<p className="p-6">Page not found.</p>} />
      </Routes>

      <CartDrawer />
    </div>
  );
}