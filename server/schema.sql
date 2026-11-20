-- =====================================================================
-- Jersey Store: database schema (Supabase / Postgres)
--
-- For a FRESH Supabase project. Run it once in the Supabase SQL editor.
-- A database that already has these objects should not re-run it.
--
-- Before running:
--   * The `vector` extension is enabled below.
--   * The cleanup job at the very bottom needs `pg_cron`. Enable it in the
--     dashboard first (Database > Extensions), then run that last section separately.
--
-- Conventions:
--   * Money is stored as integer kobo (100 kobo = 1 naira), the same unit Paystack uses.
--   * The Express server uses Supabase's secret (service-role) key, which bypasses
--     Row Level Security. The policies at the bottom only govern anything the
--     browser does directly.
--   * The seed script must fill products.color_family (server/src/lib/color.ts).
-- =====================================================================

create extension if not exists vector;

create type sport_type   as enum ('football', 'basketball', 'baseball');
create type kit_type     as enum ('home', 'away', 'third');
create type order_status as enum ('pending', 'paid', 'failed', 'cancelled');
create type user_role    as enum ('customer', 'admin');

-- ---------- Catalogue ----------

create table leagues (
  id      uuid primary key default gen_random_uuid(),
  sport   sport_type not null,
  name    text not null,                 -- 'Premier League'
  slug    text not null unique,          -- 'premier-league'
  country text
);

create table teams (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references leagues(id) on delete restrict,
  name       text not null,
  slug       text not null unique,
  short_name text
);

create table products (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete restrict,
  slug            text not null unique,
  name            text not null,
  kit             kit_type not null,
  season          text not null,                      -- '2026/27'
  description     text not null,                      -- 60-100 words, this is what gets embedded
  price_kobo      integer not null check (price_kobo > 0),
  primary_color   text not null,                      -- hex, drives the SVG jersey
  secondary_color text not null,
  accent_color    text,
  pattern         text not null default 'solid'
                  check (pattern in ('solid', 'stripes', 'hoops', 'sash', 'halves')),
  color_family    text not null,                      -- red, orange, yellow, green, blue, purple, pink, black, white, grey
                                                      -- derived from primary_color by server/src/lib/color.ts
  is_active       boolean not null default true,
  embedding       vector(1536),                       -- text-embedding-3-small
  embedded_hash   text,                               -- hash of the text last embedded; re-embed when it changes
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (team_id, kit, season)
);

create index products_team_idx on products (team_id);
create index products_embedding_idx on products using hnsw (embedding vector_cosine_ops);

create table product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  size       text not null check (size in ('S', 'M', 'L', 'XL', 'XXL')),
  stock      integer not null default 0 check (stock >= 0),
  sku        text not null unique,
  unique (product_id, size)
);

-- ---------- Users ----------

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       user_role not null default 'customer',
  created_at timestamptz not null default now()
);

-- Creates a profile row whenever someone signs up.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Orders ----------

create table orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references profiles(id) on delete set null,   -- null for guest orders
  email              text not null,                                     -- contact address; also how guest orders are matched to an account
  status             order_status not null default 'pending',
  total_kobo         integer not null check (total_kobo > 0),           -- computed on the server, never trusted from the client
  paystack_reference text not null unique,
  ship_name          text not null,
  ship_phone         text not null,
  ship_address       text not null,
  ship_city          text not null,
  ship_state         text not null,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz,
  reminder_sent_at   timestamptz                                        -- for the planned "unpaid order" reminder email
);

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  variant_id      uuid not null references product_variants(id) on delete restrict,
  product_name    text not null,       -- snapshot, so later edits don't rewrite history
  size            text not null,
  unit_price_kobo integer not null check (unit_price_kobo > 0),
  quantity        integer not null check (quantity > 0)
);

create index orders_user_idx on orders (user_id);
create index order_items_order_idx on order_items (order_id);

-- ---------- updated_at ----------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---------- Payment: idempotent and stock-safe ----------
-- Called by BOTH /payments/verify and the Paystack webhook, so it must be safe to call twice.
-- Returns true if this call moved the order to paid, false if it was already paid.
-- If any size is out of stock the whole transaction rolls back (order stays pending)
-- and the API catches 'insufficient_stock' and flags the order for refund.

create or replace function mark_order_paid(p_reference text)
returns boolean
language plpgsql as $$
declare
  v_order orders%rowtype;
  v_item  record;
begin
  select * into v_order from orders where paystack_reference = p_reference for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = 'paid' then return false; end if;
  if v_order.status <> 'pending' then raise exception 'order_not_payable'; end if;

  for v_item in select variant_id, quantity from order_items where order_id = v_order.id loop
    update product_variants
       set stock = stock - v_item.quantity
     where id = v_item.variant_id and stock >= v_item.quantity;
    if not found then raise exception 'insufficient_stock'; end if;
  end loop;

  update orders set status = 'paid', paid_at = now() where id = v_order.id;
  return true;
end $$;

-- ---------- Guest orders: attach to an account ----------
-- Called by the server only, and only after it has confirmed the account's email is VERIFIED.
-- Returns how many orders were attached.

create or replace function claim_guest_orders(p_user_id uuid, p_email text)
returns integer
language plpgsql as $$
declare v_count integer;
begin
  update orders set user_id = p_user_id
   where user_id is null and lower(email) = lower(p_email);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Supabase exposes every function in the public schema through its REST API by default.
-- These two must only ever be called by the server (service role).
revoke execute on function mark_order_paid(text) from public, anon, authenticated;
revoke execute on function claim_guest_orders(uuid, text) from public, anon, authenticated;
grant  execute on function mark_order_paid(text) to service_role;
grant  execute on function claim_guest_orders(uuid, text) to service_role;

-- ---------- Assistant: filters + vector similarity in one query ----------
-- The Express assistant turns a shopper's message into filters plus a short "fuzzy" query,
-- embeds the query, and calls this. Embeddings are built from descriptions only, so
-- everything with a clear right answer (team, kit, colour, price, size, league, sport)
-- is filtered here in SQL. Similarity only ranks what is left.

create or replace function match_products(
  query_embedding  vector(1536),
  p_sport          sport_type default null,
  p_league         text       default null,   -- league slug
  p_teams          text[]     default null,   -- team slugs
  p_kit            kit_type   default null,
  p_color          text       default null,   -- colour family of the primary colour
  p_min_price_kobo integer    default null,   -- inclusive
  p_max_price_kobo integer    default null,   -- inclusive
  p_size           text       default null,   -- only products with this size in stock
  match_count      integer    default 6
)
returns table (id uuid, slug text, name text, price_kobo integer, similarity float)
language sql stable as $$
  select p.id, p.slug, p.name, p.price_kobo,
         1 - (p.embedding <=> query_embedding) as similarity
  from products p
  join teams t   on t.id = p.team_id
  join leagues l on l.id = t.league_id
  where p.is_active
    and p.embedding is not null
    and (p_sport is null or l.sport = p_sport)
    and (p_league is null or l.slug = p_league)
    and (p_teams is null or t.slug = any(p_teams))
    and (p_kit is null or p.kit = p_kit)
    and (p_color is null or p.color_family = p_color)
    and (p_min_price_kobo is null or p.price_kobo >= p_min_price_kobo)
    and (p_max_price_kobo is null or p.price_kobo <= p_max_price_kobo)
    and (p_size is null or exists (
          select 1 from product_variants v
          where v.product_id = p.id and v.size = p_size and v.stock > 0))
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------- Row Level Security ----------
-- Express uses the service-role key (bypasses RLS) for all writes and admin work.
-- These policies only govern anything that talks to Supabase directly from the browser.

alter table leagues          enable row level security;
alter table teams            enable row level security;
alter table products         enable row level security;
alter table product_variants enable row level security;
alter table profiles         enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;

create policy "public read leagues"  on leagues          for select using (true);
create policy "public read teams"    on teams            for select using (true);
create policy "public read products" on products         for select using (is_active);
create policy "public read variants" on product_variants for select using (true);
create policy "own profile"          on profiles         for select using (auth.uid() = id);
create policy "own orders"           on orders           for select using (auth.uid() = user_id);
create policy "own order items"      on order_items      for select using (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
);

-- Make the API pick up new tables and functions straight away.
notify pgrst, 'reload schema';

-- ---------- Scheduled cleanup (run SEPARATELY, after enabling pg_cron) ----------
-- Deletes unpaid orders older than two days, once a day at 03:00 UTC. order_items go with them
-- (on delete cascade). Only 'pending' is deleted: 'failed' can mean "paid but sold out, refund owed".
--
-- select cron.schedule(
--   'delete-stale-pending-orders',
--   '0 3 * * *',
--   $$ delete from orders
--      where status = 'pending'
--        and created_at < now() - interval '2 days' $$
-- );
--
-- Check it with:  select jobname, schedule from cron.job;
-- Run history:    select * from cron.job_run_details order by start_time desc limit 5;