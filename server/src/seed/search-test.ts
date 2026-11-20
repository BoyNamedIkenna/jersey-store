import "dotenv/config"; // must stay first so env vars exist before other modules read them
import { searchProducts, type SearchFilters } from "../lib/search";

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

async function run(label: string, query: string, filters: SearchFilters = {}) {
  const hits = await searchProducts(query, filters);
  console.log(`\n${label}\n  query: "${query}"  filters: ${JSON.stringify(filters)}`);
  if (hits.length === 0) console.log("  (no results)");
  for (const h of hits) console.log(`  ${h.similarity.toFixed(3)}  ${h.name}  ${naira(h.priceKobo)}`);
}

async function main() {
  await run("1. One team", "jersey", { teams: ["arsenal"] });
  await run("2. Two teams", "jersey", { teams: ["arsenal", "liverpool"] });
  await run("3. Team + kit", "jersey", { teams: ["arsenal"], kit: "away" });
  await run("4. Team + kit + XXL", "jersey", { teams: ["arsenal"], kit: "home", size: "XXL" });
  await run("5. Team + fuzzy query", "classic and timeless", { teams: ["liverpool", "arsenal"], kit: "home" });
} 
main().catch((err) => {
  console.error(err);
  process.exit(1);
});