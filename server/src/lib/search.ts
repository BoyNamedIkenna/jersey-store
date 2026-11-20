import OpenAI from "openai";
import { supabase } from "./supabase";
import type { ColorFamily } from "./color";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SIZE_ORDER = ["S", "M", "L", "XL", "XXL"];

export interface SearchFilters {
    sport?: "football" | "basketball" | "baseball" | undefined;
    league?: string | undefined; // league slug, e.g. "premier-league"
    teams?: string[] | undefined; // team slugs, e.g. ["arsenal", "liverpool"]
    kit?: "home" | "away" | "third" | undefined;
    maxPriceKobo?: number | undefined;
    size?: "S" | "M" | "L" | "XL" | "XXL" | undefined; // only products with that size in stock
    color?: ColorFamily | undefined; // colour family of the jersey's primary colour
    minPriceKobo?: number | undefined;
}

export interface SearchHit {
    id: string;
    slug: string;
    name: string;
    priceKobo: number;
    similarity: number;
}

export interface ProductDetails {
    id: string;
    slug: string;
    name: string;
    kit: string;
    season: string;
    priceKobo: number;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    pattern: string;
    sport: string;
    team: { name: string; slug: string };
    league: { name: string; slug: string };
    description: string;
    sizesInStock: string[];
}

// Hard constraints (price, size, league) are applied in SQL; the fuzzy part ("retro look", "good gift")
// is handled by similarity.
export async function searchProducts(query: string, filters: SearchFilters = {}, limit = 6): Promise<SearchHit[]> {
    const embedded = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query.trim() || "sports jersey",
    });
    const vector = embedded.data[0]?.embedding;
    if (!vector) throw new Error("The embeddings response was empty");

    const { data, error } = await supabase.rpc("match_products", {
        query_embedding: vector,
        p_sport: filters.sport ?? null,
        p_league: filters.league ?? null,
        p_kit: filters.kit ?? null,
        p_max_price_kobo: filters.maxPriceKobo ?? null,
        p_size: filters.size ?? null,
        match_count: limit,
        p_teams: filters.teams?.length ? filters.teams : null,
        p_color: filters.color ?? null,
        p_min_price_kobo: filters.minPriceKobo ?? null,
        
    });
    if (error) throw error;

    return (data ?? []).map((row: { id: string; slug: string; name: string; price_kobo: number; similarity: number }) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        priceKobo: row.price_kobo,
        similarity: row.similarity,
    }));
}


// Loads full details for the given product ids, in the same order. If routes/products.ts already
// has a row-to-Product mapper, reuse it here so the cards match the catalogue exactly.
export async function fetchProductDetails(ids: string[]): Promise<ProductDetails[]> {
    if (ids.length === 0) return [];

    const { data, error } = await supabase
        .from("products")
        .select(
            "id, slug, name, kit, season, price_kobo, primary_color, secondary_color, accent_color, pattern, description, " +
            "teams!inner(name, slug, leagues!inner(name, slug, sport)), product_variants(size, stock)",
        )
        .in("id", ids);
    if (error) throw error;

    const rows = new Map<string, any>(((data ?? []) as any[]).map((row) => [row.id, row]));

    return ids.flatMap((id) => {
        const row = rows.get(id);
        if (!row) return [];
        return [
            {
                id: row.id,
                slug: row.slug,
                name: row.name,
                kit: row.kit,
                season: row.season,
                priceKobo: row.price_kobo,
                primaryColor: row.primary_color,
                secondaryColor: row.secondary_color,
                accentColor: row.accent_color ?? row.secondary_color,
                pattern: row.pattern,
                sport: row.teams.leagues.sport,
                team: { name: row.teams.name, slug: row.teams.slug },
                league: { name: row.teams.leagues.name, slug: row.teams.leagues.slug },
                description: row.description,
                sizesInStock: (row.product_variants as { size: string; stock: number }[])
                    .filter((v) => v.stock > 0)
                    .map((v) => v.size)
                    .sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)),
            },
        ];
    });
}