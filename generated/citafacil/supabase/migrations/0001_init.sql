-- Perfiles
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles: ver el propio" on public.profiles for select using (auth.uid() = id);
create policy "profiles: editar el propio" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Suscripciones (escritas solo por el webhook de Stripe con service role)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  status text not null default 'inactive',
  plan_id text not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions: ver la propia" on public.subscriptions for select using (auth.uid() = user_id);
