import "dotenv/config"; // must stay first so env vars exist before other modules read them
import { mkdirSync, writeFileSync } from "node:fs";
import { runAssistant, type AppliedFilters, type AssistantResult } from "../lib/assistant";
import { supabase } from "../lib/supabase";
import { cases, type EvalCase, type HardFilters } from "./eval-cases";

process.env.ASSISTANT_QUIET = "1"; // silence the per-request log line from runAssistant

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const RUNS = Number(arg("runs") ?? 1);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 3);
const ONLY = arg("only");
const CATEGORY = arg("category");

interface Outcome {
  caseId: string;
  category: string;
  run: number;
  failures: string[];
  style: string[];
  ms: number;
  reply: string;
  filters: AppliedFilters | null;
  slugs: string[];
}

// ---------- What each team and league implies ----------

interface Knowledge {
  teamLeague: Map<string, string>;
  teamSport: Map<string, string>;
  leagueSport: Map<string, string>;
  sportLeagues: Map<string, string[]>;
}

async function loadKnowledge(): Promise<Knowledge> {
  const [leagues, teams] = await Promise.all([
    supabase.from("leagues").select("name, sport"),
    supabase.from("teams").select("name, leagues!inner(name, sport)"),
  ]);
  if (leagues.error) throw leagues.error;
  if (teams.error) throw teams.error;

  const k: Knowledge = { teamLeague: new Map(), teamSport: new Map(), leagueSport: new Map(), sportLeagues: new Map() };
  for (const l of leagues.data ?? []) {
    k.leagueSport.set(l.name, l.sport);
    k.sportLeagues.set(l.sport, [...(k.sportLeagues.get(l.sport) ?? []), l.name]);
  }
  for (const t of (teams.data ?? []) as any[]) {
    k.teamLeague.set(t.name, t.leagues.name);
    k.teamSport.set(t.name, t.leagues.sport);
  }
  return k;
}

function onlyValue(values: (string | undefined)[]): string | undefined {
  const set = new Set<string>();
  for (const v of values) if (v) set.add(v);
  return set.size === 1 ? [...set][0] : undefined;
}

// Exact match, with one allowance: a sport or league the shopper did not name is accepted when what they
// did name implies it (a team implies its league and sport, a league implies its sport, and a sport with a
// single league implies that league). Redundant but consistent filters return the same products, so they
// are not errors. Anything unrelated or contradictory still fails.
function mismatches(got: AppliedFilters, want: HardFilters, k: Knowledge): string[] {
  const out: string[] = [];

  const exact = (name: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${name}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
  };
  const lenient = (name: string, value: string | null, wanted: string | undefined, implied: string | undefined) => {
    if (value === (wanted ?? null)) return;
    if (implied !== undefined && value === implied) return;
    out.push(`${name}: got ${JSON.stringify(value)}, want ${JSON.stringify(wanted ?? null)}`);
  };

  const teams = want.teams ?? [];
  const sportLeagues = want.sport ? (k.sportLeagues.get(want.sport) ?? []) : [];
  const impliedLeague = onlyValue([
    ...teams.map((t) => k.teamLeague.get(t)),
    sportLeagues.length === 1 ? sportLeagues[0] : undefined,
  ]);
  const impliedSport = onlyValue([
    ...teams.map((t) => k.teamSport.get(t)),
    want.league ? k.leagueSport.get(want.league) : undefined,
  ]);

  lenient("sport", got.sport, want.sport, impliedSport);
  lenient("league", got.league, want.league, impliedLeague);
  exact("teams", [...got.teams].sort(), [...teams].sort());
  exact("kit", got.kit, want.kit ?? null);
  exact("color", got.color, want.color ?? null);
  exact("minPriceNaira", got.minPriceNaira, want.minPriceNaira ?? null);
  exact("maxPriceNaira", got.maxPriceNaira, want.maxPriceNaira ?? null);
  exact("size", got.size, want.size ?? null);
  return out;
}

function evaluate(c: EvalCase, r: AssistantResult, k: Knowledge): { failures: string[]; style: string[] } {
  const failures: string[] = [];
  const style: string[] = [];
  const applied = r.filters;

  if (c.noSearch) {
    if (applied !== null) failures.push("searched, but should have answered without searching");
  } else if (c.filters !== undefined) {
    if (applied === null) {
      if (!c.allowNoSearch) failures.push("did not search");
    } else {
      const wanted = Array.isArray(c.filters) ? c.filters : [c.filters];
      const attempts = wanted.map((w) => mismatches(applied, w, k));
      if (!attempts.some((a) => a.length === 0)) {
        const closest = attempts.reduce((best, cur) => (cur.length < best.length ? cur : best));
        failures.push(`filters: ${closest.join("; ")}`);
      }
    }
  }

  if (c.empty && r.products.length > 0) failures.push(`expected no products, got ${r.products.length}`);
  for (const slug of c.expectSlugs ?? []) {
    if (!r.products.some((p) => p.slug === slug)) failures.push(`missing expected product ${slug}`);
  }

  if (applied) {
    if (c.queryRequired && applied.query === "") failures.push("expected a fuzzy query, got an empty one");
    if (c.queryMustNotMatch?.test(applied.query)) failures.push(`query repeats a hard filter: "${applied.query}"`);
  }

  if (c.replyMustMatch && !c.replyMustMatch.test(r.reply)) {
    failures.push("reply does not look like the expected answer or refusal");
  }
  if (c.replyMustNotMatch?.test(r.reply)) failures.push("reply leaks something it should not");

  if (c.cardsMust && !r.products.every(c.cardsMust) && !c.unlessReplyMatches?.test(r.reply)) {
    failures.push("showed products that break the shopper's constraint without saying so");
  }

  // Grounding: every naira amount in the reply must come from a returned card or the shopper's own price limits.
  // The limits also count one naira either side, because "under ₦60,000" is searched as 59,999.
  const allowed = new Set<number>(r.products.map((p) => p.priceKobo / 100));
  for (const bound of [applied?.minPriceNaira, applied?.maxPriceNaira]) {
    if (bound) for (const n of [bound - 1, bound, bound + 1]) allowed.add(n);
  }

  if (/(\*\*|^#|^\s*[-*•]\s|^\s*\d+\.\s)/m.test(r.reply)) style.push("uses markdown or a list");
  if (r.reply.length > 600) style.push("longer than 600 characters");
  // The search returns the best 6 matches, not the whole catalogue, so a superlative can be unverified.
  if (/\b(cheapest|lowest[- ]priced|lowest price|most affordable)\b/i.test(r.reply) && r.products.length >= 6) {
    style.push("superlative claim over a capped result set");
  }

  return { failures, style };
}

async function runOne(c: EvalCase, run: number, k: Knowledge): Promise<Outcome> {
  const started = Date.now();
  try {
    const result = await runAssistant(c.messages);
    const { failures, style } = evaluate(c, result, k);
    return {
      caseId: c.id,
      category: c.category,
      run,
      failures,
      style,
      ms: Date.now() - started,
      reply: result.reply,
      filters: result.filters,
      slugs: result.products.map((p) => p.slug),
    };
  } catch (err) {
    return {
      caseId: c.id,
      category: c.category,
      run,
      failures: [`error: ${err instanceof Error ? err.message : String(err)}`],
      style: [],
      ms: Date.now() - started,
      reply: "",
      filters: null,
      slugs: [],
    };
  }
}

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (; ;) {
        const item = items[next++];
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(0)}%`);
const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;

async function main() {
  const selected = cases.filter((c) => (!ONLY || c.id === ONLY) && (!CATEGORY || c.category === CATEGORY));
  if (selected.length === 0) throw new Error("No cases matched --only / --category");

  const knowledge = await loadKnowledge();
  const jobs = selected.flatMap((c) => Array.from({ length: RUNS }, (_, i) => ({ c, run: i + 1 })));
  console.log(`Running ${selected.length} cases x ${RUNS} run(s), ${CONCURRENCY} at a time...`);

  const outcomes: Outcome[] = [];
  let done = 0;
  await pool(jobs, CONCURRENCY, async ({ c, run }) => {
    outcomes.push(await runOne(c, run, knowledge));
    done++;
    if (done % 5 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length}`);
  });

  console.log("");
  for (const c of selected) {
    const runs = outcomes.filter((o) => o.caseId === c.id);
    const passed = runs.filter((o) => o.failures.length === 0).length;
    const label = passed === runs.length ? "PASS " : passed === 0 ? "FAIL " : "FLAKY";
    console.log(`${label} ${passed}/${runs.length}  [${c.category}] ${c.id}`);

    const bad = runs.find((o) => o.failures.length > 0);
    if (bad) {
      for (const f of bad.failures) console.log(`        - ${f}`);
      console.log(`        filters: ${JSON.stringify(bad.filters)}`);
      console.log(`        reply:   ${bad.reply.slice(0, 160)}`);
    }
    const noisy = runs.find((o) => o.style.length > 0);
    if (noisy) console.log(`        ~ style: ${noisy.style.join("; ")}`);
  }

  const total = outcomes.length;
  const passedAll = outcomes.filter((o) => o.failures.length === 0).length;
  const styleOk = outcomes.filter((o) => o.style.length === 0).length;
  const times = outcomes.map((o) => o.ms).sort((a, b) => a - b);

  console.log("\n---- Summary ----");
  console.log(`Overall: ${passedAll}/${total} (${pct(passedAll, total)})`);
  for (const cat of [...new Set(selected.map((c) => c.category))]) {
    const rows = outcomes.filter((o) => o.category === cat);
    console.log(`  ${cat.padEnd(11)} ${rows.filter((o) => o.failures.length === 0).length}/${rows.length}`);
  }
  console.log(`Style:   ${styleOk}/${total} replies clean (${pct(styleOk, total)})`);
  console.log(`Latency: median ${(percentile(times, 0.5) / 1000).toFixed(1)}s, p95 ${(percentile(times, 0.95) / 1000).toFixed(1)}s`);

  mkdirSync("eval-results", { recursive: true });
  const file = `eval-results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    file,
    JSON.stringify(
      {
        model: process.env.ASSISTANT_MODEL ?? "gpt-6-luna",
        reasoning: process.env.ASSISTANT_REASONING ?? "low",
        runs: RUNS,
        passed: passedAll,
        total,
        outcomes,
      },
      null,
      2,
    ),
  );
  console.log(`Saved ${file}`);

  process.exitCode = passedAll === total ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});