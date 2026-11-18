import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CatalogueFilters } from "@/components/CatalogueFilters";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalogueFilters } from "@/hooks/useCatalogueFilters";
import { PAGE_SIZE, fetchLeagues, fetchProducts } from "@/lib/api";

// Free Render services sleep when idle, so the first request can take 30-60 seconds.
// After a few seconds of loading, tell the visitor why instead of showing a blank grid.
function SlowNotice({ ms = 4000 }: { ms?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  if (!show) return null;
  return (
    <p className="mb-4 rounded-md border bg-muted p-3 text-sm">
      Waking up the server. This demo runs on a free host that sleeps when idle, so the first load can take up to a
      minute.
    </p>
  );
}

export default function CataloguePage() {
  const { filters, update, clear } = useCatalogueFilters();

  const leaguesQuery = useQuery({
    queryKey: ["leagues"],
    queryFn: fetchLeagues,
    staleTime: Infinity, // leagues and teams almost never change
  });

  const productsQuery = useQuery({
    queryKey: ["products", filters],
    queryFn: () => fetchProducts(filters),
    placeholderData: keepPreviousData, // keep the old grid on screen while the next page loads
  });

  const data = productsQuery.data;

  function goToPage(page: number) {
    update({ page: page > 1 ? page : undefined });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <CatalogueFilters filters={filters} leagues={leaguesQuery.data ?? []} update={update} onClear={clear} />
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-baseline justify-between">
            <h1 className="text-xl font-semibold">Jerseys</h1>
            {data && (
              <p className="text-sm text-muted-foreground">
                {data.total} {data.total === 1 ? "result" : "results"}
              </p>
            )}
          </div>

          {productsQuery.isPending && <SlowNotice />}
          
          {productsQuery.isPending && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {Array.from({ length: PAGE_SIZE }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/5] w-full" />
              ))}
            </div>
          )}

          {productsQuery.isError && !data && (
            <div className="rounded-md border p-6 text-center">
              <p className="mb-3">Could not load jerseys.</p>
              <Button onClick={() => productsQuery.refetch()}>Try again</Button>
            </div>
          )}

          {data && data.items.length === 0 && (
            <div className="rounded-md border p-6 text-center">
              <p className="mb-3">No jerseys match these filters.</p>
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            </div>
          )}

          {data && data.items.length > 0 && (
            <>
              <div
                className={`grid grid-cols-2 gap-4 lg:grid-cols-3 ${
                  productsQuery.isPlaceholderData ? "opacity-60 transition-opacity" : ""
                }`}
              >
                {data.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {data.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <Button variant="outline" disabled={data.page <= 1} onClick={() => goToPage(data.page - 1)}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={data.page >= data.totalPages}
                    onClick={() => goToPage(data.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}