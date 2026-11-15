# SaaS Factory — instrucciones para Claude

Este repositorio es la fábrica de SaaS de Francisco. Contiene:

- `src/` — la fábrica autónoma (CLI `npm run factory -- …`): agentes ideador, PM, arquitecto, ingeniero, revisor, crecimiento y QA, más el despliegue a GitHub, Supabase, Stripe y Vercel. Necesita claves en `.env` (ver `.env.example`).
- `template/` — plantilla base de cada SaaS: Next.js 15 + Supabase + Stripe + Tailwind v4. Lee `template/CONVENTIONS.md` antes de tocarla.
- `generated/<slug>/` — SaaS ya construidos y probados, listos para `factory deploy`. Ver `generated/README.md`.
- `tools/supabase-mock.mjs` — Supabase simulado (Auth + PostgREST) sobre Postgres embebido con RLS real, para probar sin cuenta.

El usuario escribe en español (República Dominicana). Responde en español, breve: suele leer desde el móvil.

## Construir un SaaS nuevo "a mano" (sin claves)

Cuando el usuario pida un SaaS nuevo en el chat, sigue el mismo proceso que la fábrica:

1. **PRD**: nombre, slug, tagline, problema, cliente, propuesta de valor, 3-5 funciones, planes (uno `free` + uno de pago mensual), modelo de datos y copy de la landing. Mercado por defecto: República Dominicana / Latinoamérica, interfaz en español.
2. **Scaffold**: `cp -r template generated/<slug>` (sin `node_modules`/`.next`) y ejecuta `personalize(root, prd)` de `src/pipeline.ts` con `npx tsx`.
3. **Migración** `supabase/migrations/0002_<nombre>.sql`: RLS en todas las tablas; los límites del plan gratis y cualquier escritura pública se validan en Postgres (funciones `security definer` con `search_path` fijo, y `grant execute` solo a lo necesario). No dejes políticas de INSERT públicas.
4. **Pruebas SQL** en `tests/sql.test.mjs` con `@electric-sql/pglite` (copia el arranque de `generated/citafacil/tests/sql.test.mjs`): RLS entre dueños, acceso anónimo, límites del plan y casos límite.
5. **Pantallas**: panel del dueño en `app/dashboard/*` con Server Actions que validan al usuario y redirigen con `?ok=` / `?error=` (`components/flash.tsx`), y la parte pública del producto. Mobile-first.
6. **Crecimiento**: 3 artículos SEO y kit de lanzamiento con `writeGrowthFiles()` de `src/pipeline.ts`. **Nunca inventes experiencias, testimonios, clientes ni cifras**: deja huecos `[Cuenta aquí tu experiencia real]`.
7. **Verificación** (no declares terminado sin esto):
   - `npm run typecheck` y `npm run build` con `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`.
   - `node ../../tools/supabase-mock.mjs supabase/migrations 54321` + `npx next start -p 3200`.
   - E2E en Chrome con `playwright-core` (`executablePath: /usr/bin/google-chrome`) como dueño y como cliente, en viewport móvil 390×844 (copia la sesión falsa de `generated/menufacil/tests/e2e.test.mjs`).
   - Smoke de la fábrica: `smokeTest()` de `src/smoke.ts` contra `http://localhost:3200`.
   - **Mira las capturas** y corrige lo que se vea mal en el móvil.
   - Antes de cada nueva ejecución: `pkill -f next-server; pkill -f supabase-mock` (un servidor viejo en el puerto da resultados falsos).
8. **Entrega**: `generated/<slug>/README.md`, `.factory/state.json` con `stage: "deploy"` (añádelo con `git add -f`), fila nueva en `generated/README.md`, commit y push. Envía al usuario un collage de capturas del móvil.

Si un error de prueba viene de la prueba y no de la app, dilo así; no "arregles" la app para pasar una prueba mal escrita.

## Mejorar la fábrica

- Todo lo que sirva a todos los SaaS va a `template/` y se documenta en `template/CONVENTIONS.md`.
- Comprueba siempre `npx tsc --noEmit` en la raíz y en `template/` (con `npm install` temporal).

## Cosas que solo puede hacer el usuario

Crear cuentas, poner tarjetas y pegar claves (Anthropic, GitHub, Vercel, Supabase, Stripe). Nunca pidas que pegue claves en el chat: van en GitHub → Settings → Secrets, o en su `.env` local.
