import { Link } from "react-router";
import { Jersey } from "@/components/Jersey";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatNaira } from "@/lib/format";
import type { Product } from "@/lib/api";

export function ProductCard({ product: p }: { product: Product }) {
  return (
    <Link to={`/products/${p.slug}`} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <Jersey
            sport={p.sport}
            primary={p.primaryColor}
            secondary={p.secondaryColor}
            accent={p.accentColor}
            pattern={p.pattern}
            title={p.name}
            className="w-full"
          />
          <div className="mt-auto space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className="capitalize">
                {p.kit}
              </Badge>
              <span className="text-xs text-muted-foreground">{p.league.name}</span>
            </div>
            <h3 className="text-sm font-medium leading-snug">{p.name}</h3>
            <p className="font-semibold">{formatNaira(p.priceKobo)}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}