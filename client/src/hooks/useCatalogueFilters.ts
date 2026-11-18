import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { CatalogueFilters } from "@/lib/api";

const SPORTS = ["football", "basketball", "baseball"] as const;
const KITS = ["home", "away"] as const;
const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
const SORTS = ["newest", "price_asc", "price_desc"] as const;

// URLs can be edited by hand, so anything unexpected is ignored instead of sent to the API.
function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((a) => a === value);
}

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return value !== null && Number.isInteger(n) && n > 0 ? n : undefined;
}

export type FilterChanges = Record<string, string | number | undefined>;

export function useCatalogueFilters() {
  const [params, setParams] = useSearchParams();

  const filters: CatalogueFilters = useMemo(
    () => ({
      sport: oneOf(params.get("sport"), SPORTS),
      league: params.get("league") ?? undefined,
      team: params.get("team") ?? undefined,
      kit: oneOf(params.get("kit"), KITS),
      size: oneOf(params.get("size"), SIZES),
      maxPrice: positiveInt(params.get("maxPrice")),
      sort: oneOf(params.get("sort"), SORTS) ?? "newest",
      page: positiveInt(params.get("page")) ?? 1,
    }),
    [params]
  );

  // Pass several changes at once. A value of undefined removes that parameter.
  // Changing any filter sends the user back to page 1 unless the change sets the page itself.
  const update = useCallback(
    (changes: FilterChanges) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        if (!("page" in changes)) next.delete("page");
        return next;
      });
    },
    [setParams]
  );

  const clear = useCallback(() => setParams({}), [setParams]);

  return { filters, update, clear };
}