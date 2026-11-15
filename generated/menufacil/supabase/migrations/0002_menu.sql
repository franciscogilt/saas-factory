-- MenúFácil: restaurantes, categorías y productos.
-- Los clientes finales no escriben nada en la base de datos: el pedido viaja por WhatsApp.

-- ───────────── Restaurantes ─────────────
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 200),
  whatsapp text not null check (whatsapp ~ '^\+?[0-9 ()-]{7,20}$'),
  currency text not null default 'DOP' check (currency in ('DOP', 'USD', 'MXN', 'COP', 'EUR')),
  address text check (address is null or char_length(address) <= 200),
  is_open boolean not null default true,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  min_order numeric(10,2) not null default 0 check (min_order >= 0),
  created_at timestamptz not null default now(),
  check (pickup_enabled or delivery_enabled)
);
alter table public.restaurants enable row level security;
create policy "restaurants: el dueño gestiona el suyo" on public.restaurants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "restaurants: lectura pública del menú" on public.restaurants
  for select using (true);

-- ───────────── Categorías ─────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  restaurant_id uuid not null references public.restaurants on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categories_restaurant_idx on public.categories (restaurant_id, position);
alter table public.categories enable row level security;
create policy "categories: el dueño gestiona las suyas" on public.categories
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.user_id = auth.uid())
  );
create policy "categories: lectura pública" on public.categories for select using (true);

-- ───────────── Productos ─────────────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  restaurant_id uuid not null references public.restaurants on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 200),
  price numeric(10,2) not null check (price >= 0),
  available boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id, position);
alter table public.products enable row level security;
create policy "products: el dueño gestiona los suyos" on public.products
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.restaurant_id = products.restaurant_id and c.user_id = auth.uid()
    )
  );
create policy "products: lectura pública" on public.products for select using (true);

-- ───────────── ¿Restaurante con plan de pago? (solo un booleano) ─────────────
create or replace function public.is_pro_restaurant(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s join public.restaurants r on r.user_id = s.user_id
    where r.id = p_restaurant and s.status in ('active', 'trialing') and s.plan_id <> 'free'
  );
$$;
revoke all on function public.is_pro_restaurant(uuid) from public;
grant execute on function public.is_pro_restaurant(uuid) to anon, authenticated;

-- ───────────── Límite del plan gratis: 25 productos ─────────────
-- Debe coincidir con FREE_PRODUCT_LIMIT en lib/menu.ts.
create or replace function public.enforce_product_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pro_restaurant(new.restaurant_id)
     and (select count(*) from public.products where restaurant_id = new.restaurant_id) >= 25 then
    raise exception 'El plan Gratis permite hasta 25 productos. Pasa a Pro para añadir más.';
  end if;
  return new;
end;
$$;
drop trigger if exists products_limit on public.products;
create trigger products_limit before insert on public.products
  for each row execute function public.enforce_product_limit();
