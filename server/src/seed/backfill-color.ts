import "dotenv/config"; // must stay first so env vars exist before other modules read them
import { colorFamily } from "../lib/color";
import { supabase } from "../lib/supabase";

async function main() {
  const { data, error } = await supabase.from("products").select("id, slug, primary_color").order("slug");
  if (error) throw error;

  for (const row of data ?? []) {
    const family = colorFamily(row.primary_color);
    const { error: updateError } = await supabase.from("products").update({ color_family: family }).eq("id", row.id);
    if (updateError) throw updateError;
    console.log(`${family.padEnd(7)} ${row.primary_color}  ${row.slug}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});