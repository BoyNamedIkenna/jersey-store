import { Router } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { AppError, asyncHandler } from "../middleware/error";

export const productsRouter = Router();

const SIZES = ["S", "M", "L", "XL", "XXL"] as const;

// Every query-string value arrives as a string, so numbers are coerced.
const listQuery = z.object({
  sport: z.enum(["football", "basketball", "baseball"]).optional(),
  league: z.string().min(1).optional(), // league slug
  team: z.string().min(1).optional(), // team slug
  kit: z.enum(["home", "away", "third"]).optional(),
  size: z.enum(SIZES).optional(), // only products with this size in stock
  minPrice: z.coerce.number().int().positive().optional(), // kobo
  maxPrice: z.coerce.number().int().positive().optional(), // kobo
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(36).default(12),
});

// Columns the public API exposes. The embedding vector is deliberately not here.
// "!inner" makes the join required, so filtering on team or league removes products.
const PRODUCT_FIELDS =
  "id, slug, name, kit, season, price_kobo, primary_color, secondary_color, accent_color, pattern, " +
  "teams!inner(name, slug, leagues!inner(name, slug, sport))";

// Database column names (snake_case) to the shape the frontend uses (camelCase).
function toProduct(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kit: row.kit,
    season: row.season,
    priceKobo: row.price_kobo,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    pattern: row.pattern,
    sport: row.teams.leagues.sport,
    team: { name: row.teams.name, slug: row.teams.slug },
    league: { name: row.teams.leagues.name, slug: row.teams.leagues.slug },
  };
}

const SORTS = {
  newest: { column: "created_at", ascending: false },
  price_asc: { column: "price_kobo", ascending: true },
  price_desc: { column: "price_kobo", ascending: false },
} as const;

// GET /products?sport=football&kit=home&maxPrice=6500000&size=L&sort=price_asc&page=1
productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid query parameters",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }
    const q = parsed.data;

    const from = (q.page - 1) * q.pageSize;
    const emptyPage = { items: [], page: q.page, pageSize: q.pageSize, total: 0, totalPages: 0 };

    let query = supabase
      .from("products")
      .select(PRODUCT_FIELDS, { count: "exact" })
      .eq("is_active", true);

    if (q.sport) query = query.eq("teams.leagues.sport", q.sport);
    if (q.league) query = query.eq("teams.leagues.slug", q.league);
    if (q.team) query = query.eq("teams.slug", q.team);
    if (q.kit) query = query.eq("kit", q.kit);
    if (q.minPrice) query = query.gte("price_kobo", q.minPrice);
    if (q.maxPrice) query = query.lte("price_kobo", q.maxPrice);

    // Size filter: find the products that have this size in stock, then restrict to them.
    // Two small queries are fine at this catalogue size; a larger shop would use a SQL view.
    if (q.size) {
      const { data: variants, error: variantErr } = await supabase
        .from("product_variants")
        .select("product_id")
        .eq("size", q.size)
        .gt("stock", 0);
      if (variantErr) throw variantErr;
      const ids = [...new Set((variants ?? []).map((v) => v.product_id))];
      if (ids.length === 0) {
        res.json(emptyPage);
        return;
      }
      query = query.in("id", ids);
    }

    const sort = SORTS[q.sort];
    const { data, count, error } = await query
      .order(sort.column, { ascending: sort.ascending })
      .order("name") // stable order when the sort column ties
      .range(from, from + q.pageSize - 1);
    if (error) throw error;

    const total = count ?? 0;
    res.json({
      items: (data ?? []).map(toProduct),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    });
  })
);

// GET /products/arsenal-2026-27-home
productsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from("products")
      .select(`${PRODUCT_FIELDS}, description, product_variants(id, size, stock)`)
      .eq("slug", String(req.params.slug))
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError(404, "Product not found");

    const variants = [...(data as any).product_variants]
      .sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
      .map((v) => ({ id: v.id, size: v.size, stock: v.stock }));

    res.json({ ...toProduct(data), description: (data as any).description, variants });
  })
);