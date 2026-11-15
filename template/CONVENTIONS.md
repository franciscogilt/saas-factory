# Convenciones de la plantilla

## Estructura
- `app/` — rutas (App Router). Server Components por defecto; usa `"use client"` solo si hay interactividad.
- `app/dashboard/` — área privada. El layout ya exige sesión: cualquier página nueva dentro está protegida.
- `app/api/stripe/*` — checkout, portal de cliente y webhook. Ya funcionan: no los reescribas.
- `lib/product.ts` — nombre, copy de la landing, funcionalidades y planes. Fuente única de verdad del producto.
- `lib/supabase/server.ts` → `createClient()` para Server Components, Server Actions y Route Handlers.
- `lib/supabase/client.ts` → `createClient()` para Client Components.
- `lib/supabase/admin.ts` → cliente con service role (solo en servidor, solo para webhooks/tareas de sistema).
- `lib/subscription.ts` → `getSubscription(userId)` y `getUserPlan()` para limitar funciones por plan.
- `components/ui.tsx` — `Button`, `LinkButton`, `Card`, `Input`, `Navbar`.
- `components/flash.tsx` — `Flash` (mensajes `?ok=` / `?error=` tras una Server Action que redirige), `SubmitButton` y `selectCls`. Patrón: la acción valida, hace `redirect('/ruta?error=...')` y la página muestra `<Flash ok={ok} error={error} />`.
- `components/copy-link.tsx` — `CopyLink` para copiar un enlace público.
- `components/legal.tsx` — `Footer` (enlaces a precios/términos/privacidad) y `LegalPage`. Toda página pública debe terminar con `<Footer />`.
- Blog: `/blog` y `/blog/[slug]` leen `lib/posts.ts` (lo escribe el agente de crecimiento). No lo edites a mano.
- Ya existen y no hay que recrearlas: `/blog`, `/terms`, `/privacy`, `/sitemap.xml`, `/robots.txt`, imagen OpenGraph y página 404. Si añades páginas públicas, agrégalas a `app/sitemap.ts`.
- Las pruebas post-despliegue exigen que `/`, `/pricing`, `/login`, `/terms`, `/privacy` respondan 200 y que `/dashboard` redirija sin sesión.
- `supabase/migrations/NNNN_nombre.sql` — numeradas, se aplican en orden. NUNCA edites una existente; crea una nueva.

## Datos
- Toda tabla: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade`, `created_at timestamptz default now()`.
- Siempre `alter table ... enable row level security;` y políticas `using (auth.uid() = user_id)` para select/insert/update/delete.
- Tablas existentes: `profiles` (id = auth.users.id, email), `subscriptions` (user_id, status, plan_id, stripe_customer_id, stripe_subscription_id, current_period_end).

## Mutaciones
- Preferir Server Actions (`"use server"`) en un archivo `actions.ts` junto a la página; tras mutar, `revalidatePath`.
- Validar siempre el usuario con `supabase.auth.getUser()` en el servidor.

## Estilo
- Tailwind v4 (sin config). Diseño limpio: fondo blanco, `zinc` para grises, un color de acento `indigo-600`.
- Componentes de `components/ui.tsx` para mantener consistencia.

## Planes
- Los límites por plan se leen de `lib/product.ts` y `getUserPlan()`. El plan gratis tiene id `free`.
