-- CitaFácil: negocios, servicios y citas.
-- Los clientes finales NO tienen cuenta: reservan solo a través de book_appointment(), que valida todo.

-- ───────────── Negocios ─────────────
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null check (char_length(name) between 2 and 80),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ()-]{7,20}$'),
  timezone text not null default 'America/Santo_Domingo',
  open_time time not null default '09:00',
  close_time time not null default '18:00',
  open_days int[] not null default '{1,2,3,4,5,6}', -- ISO: 1 = lunes … 7 = domingo
  slot_minutes int not null default 30 check (slot_minutes between 5 and 240),
  created_at timestamptz not null default now(),
  check (close_time > open_time)
);
alter table public.businesses enable row level security;
create policy "businesses: el dueño gestiona el suyo" on public.businesses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "businesses: lectura pública para la página de reservas" on public.businesses
  for select using (true);

-- ───────────── Servicios ─────────────
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  duration_minutes int not null check (duration_minutes between 5 and 480),
  price numeric(10,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists services_business_idx on public.services (business_id);
alter table public.services enable row level security;
create policy "services: el dueño gestiona los suyos" on public.services
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );
create policy "services: lectura pública de los activos" on public.services
  for select using (active);

-- ───────────── Citas ─────────────
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade, -- dueño del negocio
  business_id uuid not null references public.businesses on delete cascade,
  service_id uuid references public.services on delete set null,
  service_name text not null,
  client_name text not null check (char_length(client_name) between 2 and 80),
  client_phone text not null check (client_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'confirmed' check (status in ('confirmed', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now()
);
create index if not exists appointments_business_time_idx on public.appointments (business_id, starts_at);
alter table public.appointments enable row level security;
-- Sin política de INSERT: solo se crean mediante book_appointment().
create policy "appointments: el dueño ve las suyas" on public.appointments
  for select using (auth.uid() = user_id);
create policy "appointments: el dueño actualiza las suyas" on public.appointments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "appointments: el dueño borra las suyas" on public.appointments
  for delete using (auth.uid() = user_id);

-- ───────────── Horarios ocupados (públicos, sin datos del cliente) ─────────────
create or replace function public.get_busy_slots(p_business uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at
  from public.appointments a
  where a.business_id = p_business
    and a.status <> 'cancelled'
    and a.starts_at < p_to
    and a.ends_at > p_from
  order by a.starts_at;
$$;

-- ───────────── ¿Negocio con plan de pago? (solo un booleano, sin datos de facturación) ─────────────
create or replace function public.is_pro_business(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions sub join public.businesses b on b.user_id = sub.user_id
    where b.id = p_business and sub.status in ('active', 'trialing') and sub.plan_id <> 'free'
  );
$$;

-- ───────────── Reserva pública ─────────────
-- El límite del plan gratis (30/mes) debe coincidir con FREE_MONTHLY_BOOKINGS en lib/limits.ts.
create or replace function public.book_appointment(
  p_business uuid, p_service uuid, p_starts timestamptz, p_name text, p_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b public.businesses;
  s public.services;
  v_end timestamptz;
  v_local timestamp;
  v_local_end timestamp;
  v_is_pro boolean;
  v_count int;
  v_id uuid;
begin
  select * into b from public.businesses where id = p_business;
  if not found then raise exception 'Negocio no encontrado'; end if;

  select * into s from public.services where id = p_service and business_id = p_business and active;
  if not found then raise exception 'Ese servicio ya no está disponible'; end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(p_name) > 80 then
    raise exception 'Escribe tu nombre';
  end if;
  if coalesce(p_phone, '') !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Escribe un teléfono válido';
  end if;
  if p_starts < now() + interval '15 minutes' or p_starts > now() + interval '60 days' then
    raise exception 'Esa hora ya no está disponible';
  end if;

  v_end := p_starts + make_interval(mins => s.duration_minutes);
  v_local := p_starts at time zone b.timezone;
  v_local_end := v_end at time zone b.timezone;
  if not (extract(isodow from v_local)::int = any (b.open_days))
     or v_local::time < b.open_time
     or v_local_end::time > b.close_time
     or v_local_end::date <> v_local::date then
    raise exception 'Esa hora está fuera del horario del negocio';
  end if;

  -- Serializa las reservas de un mismo negocio para que nunca haya dos citas a la vez.
  perform pg_advisory_xact_lock(hashtext(p_business::text));

  if exists (
    select 1 from public.appointments a
    where a.business_id = p_business and a.status <> 'cancelled'
      and a.starts_at < v_end and a.ends_at > p_starts
  ) then
    raise exception 'Alguien acaba de reservar esa hora. Elige otra.';
  end if;

  -- Antispam: máximo 3 citas futuras activas por teléfono en un mismo negocio.
  if (
    select count(*) from public.appointments a
    where a.business_id = p_business and a.status = 'confirmed' and a.starts_at > now()
      -- Compara los últimos 10 dígitos: "+1 (809) 111-2222" y "8091112222" son el mismo número.
      and right(regexp_replace(a.client_phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
  ) >= 3 then
    raise exception 'Ya tienes 3 citas pendientes en este negocio. Si necesitas otra, escríbele por WhatsApp.';
  end if;

  select exists (
    select 1 from public.subscriptions
    where user_id = b.user_id and status in ('active', 'trialing') and plan_id <> 'free'
  ) into v_is_pro;
  if not v_is_pro then
    select count(*) into v_count from public.appointments
    where business_id = p_business and status <> 'cancelled' and created_at >= date_trunc('month', now());
    if v_count >= 30 then
      raise exception 'Este negocio no acepta más reservas online este mes. Contáctalo por WhatsApp.';
    end if;
  end if;

  insert into public.appointments (user_id, business_id, service_id, service_name, client_name, client_phone, starts_at, ends_at)
  values (b.user_id, b.id, s.id, s.name, trim(p_name), trim(p_phone), p_starts, v_end)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.get_busy_slots(uuid, timestamptz, timestamptz) from public;
revoke all on function public.book_appointment(uuid, uuid, timestamptz, text, text) from public;
revoke all on function public.is_pro_business(uuid) from public;
grant execute on function public.is_pro_business(uuid) to anon, authenticated;
grant execute on function public.get_busy_slots(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text) to anon, authenticated;
