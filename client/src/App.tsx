import { Link, Route, Routes } from "react-router";
import CataloguePage from "@/pages/CataloguePage";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link to="/" className="text-lg font-semibold">
            Jersey Store
          </Link>
          <span className="text-xs text-muted-foreground">Demo store · test payments only</span>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<CataloguePage />} />
        {/* The product page is the next thing we build. */}
        <Route path="*" element={<p className="p-6">Page not found.</p>} />
      </Routes>
    </div>
  );
}