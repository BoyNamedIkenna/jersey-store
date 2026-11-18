import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { embedTexts } from "../lib/embeddings";

// Usage: npm run try-search -- "a light shirt that is comfortable in hot weather"
const question = process.argv.slice(2).join(" ");
if (!question) {
  throw new Error('Pass a question, e.g. npm run try-search -- "bold bright shirt"');
}

// Edit these to test the hard filters. null means "no filter".
// Examples: p_sport: "football", p_league: "premier-league", p_kit: "home",
//           p_max_price_kobo: 6500000, p_size: "L"
const filters = {
  p_sport: null,
  p_league: null,
  p_kit: null,
  p_max_price_kobo: null,
  p_size: null,
  match_count: 6,
};

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env");
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const [queryEmbedding] = await embedTexts([question]);

  const { data, error } = await supabase.rpc("match_products", {
    query_embedding: queryEmbedding,
    ...filters,
  });
  if (error) throw error;

  console.log(`\nQuestion: ${question}\n`);
  console.table(
    (data ?? []).map((r: any) => ({
      name: r.name,
      price: `₦${(r.price_kobo / 100).toLocaleString("en-NG")}`,
      similarity: Number(r.similarity).toFixed(3),
    }))
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});