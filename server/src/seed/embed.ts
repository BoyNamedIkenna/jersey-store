import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { buildProductText, hashText, embedTexts } from "../lib/embeddings";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 1. Load every product with its team and league (nested select follows the foreign keys).
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, kit, season, pattern, description, embedded_hash, teams(name, leagues(name, sport))"
    );
  if (error) throw error;

  // 2. Build the text for each product and hash it.
  const rows = (data ?? []).map((p: any) => {
    const text = buildProductText({
      name: p.name,
      sport: p.teams.leagues.sport,
      league: p.teams.leagues.name,
      team: p.teams.name,
      kit: p.kit,
      season: p.season,
      pattern: p.pattern,
      description: p.description,
    });
    return { id: p.id as string, slug: p.slug as string, text, hash: hashText(text), current: p.embedded_hash };
  });

  // 3. Only products whose text changed (or were never embedded) need work.
  const stale = rows.filter((r) => r.hash !== r.current);
  if (stale.length === 0) {
    console.log("Nothing to embed. All products are up to date.");
    return;
  }
  console.log(`Embedding ${stale.length} of ${rows.length} products...`);

  // 4. One API call for all stale products.
  const vectors = await embedTexts(stale.map((r) => r.text));

  // 5. Save each embedding together with the hash of the text it came from.
  for (let i = 0; i < stale.length; i++) {
    const { error: updateErr } = await supabase
      .from("products")
      .update({ embedding: vectors[i], embedded_hash: stale[i]?.hash })
      .eq("id", stale[i]?.id);
    if (updateErr) throw new Error(`Failed on ${stale[i]?.slug}: ${updateErr.message}`);
  }

  console.log(`Done. ${stale.length} products embedded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});