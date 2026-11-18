import { Router } from "express";
import { supabase } from "../lib/supabase";
import { asyncHandler } from "../middleware/error";

export const leaguesRouter = Router();

// GET /leagues: every league with its teams, used to build the catalogue filter menus.
leaguesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from("leagues")
      .select("name, slug, sport, country, teams(name, slug)")
      .order("sport")
      .order("name");
    if (error) throw error;

    res.json(
      (data ?? []).map((league: any) => ({
        name: league.name,
        slug: league.slug,
        sport: league.sport,
        country: league.country,
        teams: [...league.teams].sort((a, b) => a.name.localeCompare(b.name)),
      }))
    );
  })
);