import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CatalogueFilters as Filters, Kit, League, Size, Sport } from "@/lib/api";
import type { FilterChanges } from "@/hooks/useCatalogueFilters";
import { formatNaira } from "@/lib/format";

// Radix Select does not allow an empty-string item value, so "no filter" uses a sentinel.
const ALL = "all";

const SPORT_OPTIONS: { value: Sport; label: string }[] = [
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "baseball", label: "Baseball" },
];
const KIT_OPTIONS: { value: Kit; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
];
const SIZE_OPTIONS: { value: Size; label: string }[] = (["S", "M", "L", "XL", "XXL"] as const).map((s) => ({
  value: s,
  label: s,
}));
const PRICE_CEILINGS_KOBO = [5500000, 6000000, 6500000, 7000000, 8000000];
const SORT_OPTIONS = [
  { value: "newest", label: "Featured" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

// Clicking the selected option again clears it.
function ButtonGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T | undefined;
  onSelect: (value: T | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button
          key={o.value}
          size="sm"
          variant={selected === o.value ? "default" : "outline"}
          aria-pressed={selected === o.value}
          onClick={() => onSelect(selected === o.value ? undefined : o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function FilterSelect({
  value,
  options,
  allLabel,
  onChange,
}: {
  value: string | undefined;
  options: { value: string; label: string }[];
  allLabel?: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === null || v === ALL ? undefined : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface Props {
  filters: Filters;
  leagues: League[];
  update: (changes: FilterChanges) => void;
  onClear: () => void;
}

export function CatalogueFilters({ filters, leagues, update, onClear }: Props) {
  // League and team menus only offer options that make sense for what is already chosen.
  const visibleLeagues = leagues.filter((l) => !filters.sport || l.sport === filters.sport);
  const visibleTeams = (filters.league ? visibleLeagues.filter((l) => l.slug === filters.league) : visibleLeagues)
    .flatMap((l) => l.teams)
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasFilters = Boolean(
    filters.sport || filters.league || filters.team || filters.kit || filters.size || filters.maxPrice
  );

  return (
    <div className="space-y-5">
      <Group label="Sport">
        {/* Changing the sport clears league and team, which may no longer apply. */}
        <ButtonGroup
          options={SPORT_OPTIONS}
          selected={filters.sport}
          onSelect={(sport) => update({ sport, league: undefined, team: undefined })}
        />
      </Group>

      <Group label="League">
        <FilterSelect
          value={filters.league}
          allLabel="All leagues"
          options={visibleLeagues.map((l) => ({ value: l.slug, label: l.name }))}
          onChange={(league) => update({ league, team: undefined })}
        />
      </Group>

      <Group label="Team">
        <FilterSelect
          value={filters.team}
          allLabel="All teams"
          options={visibleTeams.map((t) => ({ value: t.slug, label: t.name }))}
          onChange={(team) => update({ team })}
        />
      </Group>

      <Group label="Kit">
        <ButtonGroup options={KIT_OPTIONS} selected={filters.kit} onSelect={(kit) => update({ kit })} />
      </Group>

      <Group label="Size (in stock)">
        <ButtonGroup options={SIZE_OPTIONS} selected={filters.size} onSelect={(size) => update({ size })} />
      </Group>

      <Group label="Max price">
        <FilterSelect
          value={filters.maxPrice !== undefined ? String(filters.maxPrice) : undefined}
          allLabel="Any price"
          options={PRICE_CEILINGS_KOBO.map((k) => ({ value: String(k), label: `Up to ${formatNaira(k)}` }))}
          onChange={(v) => update({ maxPrice: v ? Number(v) : undefined })}
        />
      </Group>

      <Group label="Sort by">
        <FilterSelect value={filters.sort} options={SORT_OPTIONS} onChange={(sort) => update({ sort })} />
      </Group>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear all filters
        </Button>
      )}
    </div>
  );
}