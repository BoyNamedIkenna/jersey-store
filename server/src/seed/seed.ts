import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { leagues, teams, products } from "./data";
import { colorFamily } from "../lib/color";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env");
}

// Service-role key bypasses RLS. It belongs on the server only, never in the client.
const supabase = createClient(url, key, { auth: { persistSession: false } });

const SIZES = ["S", "M", "L", "XL", "XXL"];
const SEASON: Record<string, string> = {
  football: "2026/27",
  basketball: "2026/27",
  baseball: "2026",
};

const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1);

function indexBy<T>(items: T[], getKey: (item: T) => string) {
  return new Map(items.map((item) => [getKey(item), item] as const));
}

async function main() {
  // 1. Leagues
  const { data: leagueRows, error: leagueErr } = await supabase
    .from("leagues")
    .upsert(leagues, { onConflict: "slug" })
    .select("id, slug");
  if (leagueErr) throw leagueErr;
  const leagueId = new Map<string, string>(
    (leagueRows ?? []).map((l): [string, string] => [l.slug, l.id])
  );

  // 2. Teams
  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .upsert(
      teams.map((t) => ({
        league_id: leagueId.get(t.league),
        name: t.name,
        slug: t.slug,
        short_name: t.short,
      })),
      { onConflict: "slug" }
    )
    .select("id, slug");
  if (teamErr) throw teamErr;
  const teamId = new Map<string, string>(
    (teamRows ?? []).map((t): [string, string] => [t.slug, t.id])
  );

  // 3. Products
  const teamBySlug = indexBy(teams, (t) => t.slug);
  const leagueBySlug = indexBy(leagues, (l) => l.slug);

  const productRows = products.map((p) => {
    const team = teamBySlug.get(p.team);
    if (!team) throw new Error(`Unknown team slug: ${p.team}`);
    const sport = leagueBySlug.get(team.league)!.sport;
    const season = SEASON[sport];
    return {
      team_id: teamId.get(p.team),
      slug: `${p.team}-${season?.replace("/", "-")}-${p.kit}`,
      name: `${team.name} ${season} ${cap(p.kit)} Jersey`,
      kit: p.kit,
      season,
      description: p.description,
      price_kobo: p.price,
      primary_color: p.primary,
      color_family: colorFamily(p.primary),
      secondary_color: p.secondary,
      accent_color: p.accent,
      pattern: p.pattern,
    };
  });

  const { data: savedProducts, error: productErr } = await supabase
    .from("products")
    .upsert(productRows, { onConflict: "slug" })
    .select("id, slug");
  if (productErr) throw productErr;

  // 4. Variants: one row per size. Re-running this script resets stock.
  const variantRows = (savedProducts ?? []).flatMap((p, i) =>
    SIZES.map((size, s) => ({
      product_id: p.id,
      size,
      sku: `${p.slug}-${size}`.toUpperCase(),
      // Varied stock so the UI has low-stock and sold-out sizes to handle.
      stock: [4, 8, 10, 6, i % 4 === 0 ? 0 : 3][s],
    }))
  );

  const { error: variantErr } = await supabase
    .from("product_variants")
    .upsert(variantRows, { onConflict: "sku" });
  if (variantErr) throw variantErr;

  console.log(
    `Seeded ${leagueRows?.length} leagues, ${teamRows?.length} teams, ` +
      `${savedProducts?.length} products, ${variantRows.length} variants.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});