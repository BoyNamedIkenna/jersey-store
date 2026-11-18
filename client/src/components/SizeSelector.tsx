import { Button } from "@/components/ui/button";
import type { Variant } from "@/lib/api";

interface Props {
  variants: Variant[];
  selectedId: string | null;
  onSelect: (variantId: string) => void;
}

export function SizeSelector({ variants, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
      {variants.map((v) => {
        const soldOut = v.stock === 0;
        const selected = v.id === selectedId;
        return (
          <Button
            key={v.id}
            role="radio"
            aria-checked={selected}
            aria-label={soldOut ? `${v.size}, sold out` : v.size}
            disabled={soldOut}
            variant={selected ? "default" : "outline"}
            className={`min-w-14 ${soldOut ? "line-through" : ""}`}
            onClick={() => onSelect(v.id)}
          >
            {v.size}
          </Button>
        );
      })}
    </div>
  );
}