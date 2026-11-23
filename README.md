# 🏭 SaaS Factory

> **SaaS listos para publicar:** [CitaFácil](generated/citafacil/) (reservas para salones y barberías) y [MenúFácil](generated/menufacil/) (menú con QR y pedidos por WhatsApp). Construidos y probados; solo falta publicarlos. Ver [generated/](generated/).

Una fábrica de software autónoma: le das un nicho o una idea y un equipo de agentes de IA (Claude) diseña, programa, prueba y **despliega** un SaaS completo con login, base de datos y cobros por suscripción.

```
 nicho ─► 💡 Ideador ─► 📋 PM ─► 🏗️ Arquitecto ─► 👩‍💻 Ingeniero ─► 🔍 Revisor ─► 📈 Crecimiento ─► 🧪 QA ─► 🚀 DevOps ─► ✅ Verificación
          ideas       PRD +     tareas         código         seguridad    build     GitHub ·     pruebas sobre
          puntuadas   precios                                 RLS, huecos  verde     Supabase ·   el sitio en vivo
                                                                                     Stripe · Vercel
```

Cada SaaS sale con: landing, blog con 3 artículos SEO, kit de lanzamiento (Product Hunt, X, LinkedIn, Reddit, email) en `docs/LAUNCH.md`, precios, términos, privacidad, SEO (sitemap, robots, imagen para redes), login por enlace mágico, dashboard privado, facturación (Stripe Checkout + portal + webhook), base de datos Postgres con RLS y la funcionalidad principal que definió el PRD.

## 0. Desarrollar con cualquier stack en tu máquina

La fábrica trabaja con cualquier tecnología, en proyectos nuevos o en los que ya tienes. Usa tu sesión de Claude Code (sin clave de API).

```bash
# Proyecto nuevo: combina tecnologías con +
npm run factory -- new "Sistema de inventario para ferreterías" --stack "angular + springboot + postgresql + docker-compose"
npm run factory -- new "API de reservas" --stack "fastapi + postgresql" --dir ~/proyectos/reservas
npm run factory -- new "Portal de clientes" --stack ".net con c# + react + aws"
npm run factory -- new "Bot de facturas" --stack "Go con la librería estándar"   # sin paquete: lo resuelve la IA

# Proyecto existente (debe ser un repositorio git sin cambios pendientes)
npm run factory -- improve ~/proyectos/mi-api "Añade autenticación con JWT y pruebas"

npm run factory -- stacks             # paquetes disponibles y sus comandos
npm run factory -- resume <carpeta>   # retoma si se detuvo (límite del plan, error…)
```

**Paquetes incluidos** (`stacks/`): `fastapi`, `django`, `dotnet` (.NET/C#), `springboot`, `express` (Node), `angular`, `react`, `nextjs`, `postgresql`, `docker-compose`, `aws` (infraestructura con CDK) y `nextjs-supabase` (la plantilla SaaS). Se reconocen también por alias: "spring boot", ".net", "c#", "node", "postgres", "docker"…

**Qué hace `new`:** define el alcance → resuelve el stack (paquetes + IA para lo que no tenga paquete) → **te muestra los comandos y te pide confirmación** → crea el proyecto (frontend y backend en `frontend/` y `backend/` si hay ambos) → planifica → programa → revisa (seguridad, pruebas, completitud) → instala y ejecuta la verificación de cada componente hasta que todo pase → primer commit. Deja un `CLAUDE.md` y un `factory.stack.json` para que futuros cambios sepan cómo trabajar.

**Qué hace `improve`:** lee `factory.stack.json` o detecta el stack y sus pruebas → crea la rama `factory/<tarea>` (tu rama principal no se toca) → comprueba si las pruebas ya fallaban antes → planifica, programa, revisa y verifica hasta verde → commit en la rama. Al final te dice cómo revisar (`git diff`), aceptar (`git merge`) o descartar el cambio.

**Seguridad en tu máquina:**
- El agente solo ejecuta los comandos del stack (p. ej. `mvn`, `dotnet`, `npm`, `.venv/bin/python`), de uno en uno, sin encadenar ni redirigir.
- Siempre prohibidos: `sudo`, `curl`/`wget`, `bash`/`sh`, `git push`, `git reset --hard`, y desplegar en la nube (`cdk deploy`, `aws`, `terraform apply`, `docker push`). La infraestructura de AWS se prepara, pero el despliegue (y su coste) lo decides tú.
- Si la IA propone un stack con comandos prohibidos, se rechaza antes de ejecutar nada.
- Lo generado (`node_modules`, `.venv`, `bin/obj`, `target`, `dist`, `.env`…) nunca se versiona: en proyectos nuevos va al `.gitignore`; en los tuyos, a `.git/info/exclude` para no tocar tus archivos.

**Añadir tu propio stack:** crea `stacks/<id>/stack.json` (nombre, tipo, comandos de instalar/verificar/arrancar, comandos permitidos, cómo crearlo) y `stacks/<id>/CONVENTIONS.md` con tus reglas. Copia uno existente como base. También puedes tenerlos fuera del repositorio con `FACTORY_STACKS_DIR`.

**En Windows:** usa WSL (los comandos de Python usan `.venv/bin/…`).

## 1. Instalación (una sola vez)

Requisitos: Node 20+ y git.

```bash
npm install
cp .env.example .env     # rellena tus claves
npm link                 # opcional: habilita el comando `factory`
```

**Claude no necesita clave**: la fábrica usa tu sesión de Claude Code (plan Pro, Max o Team). Instálalo con `npm i -g @anthropic-ai/claude-code` y entra con `claude`. En GitHub Actions, ejecuta `claude setup-token` en tu computadora y guarda el resultado como secreto `CLAUDE_CODE_OAUTH_TOKEN`. Lo que hagan los agentes cuenta contra los límites de uso de tu plan; si los alcanzas, `factory resume <slug>` sigue donde quedó.

| Servicio | Qué necesitas | Dónde |
|---|---|---|
| GitHub | token con permiso `repo` + tu usuario | github.com/settings/tokens |
| Vercel | token + **instalar la app de GitHub de Vercel** | vercel.com/account/tokens |
| Supabase | access token + id de organización | supabase.com/dashboard/account/tokens |
| Stripe | clave secreta (empieza con `sk_test_`) | dashboard.stripe.com/apikeys |

> Ojo con Supabase: el plan gratis permite 2 proyectos activos. Para muchos SaaS necesitas el plan Pro o pausar los que no uses.

## 2. Uso

```bash
# Modo 100 % autónomo: genera ideas, elige las 3 mejores, las construye y las publica
npm run factory -- auto "herramientas para clínicas dentales en Latinoamérica" -n 3

# Paso a paso
npm run factory -- ideate "freelancers de diseño" -n 15     # → ideas.json
npm run factory -- batch ideas.json --top 5                # construye las 5 mejores
npm run factory -- build "Generador de facturas para freelancers con recordatorios de cobro"

# Sin publicar (solo genera y compila en ./projects)
npm run factory -- build "..." --no-deploy
npm run factory -- deploy <slug>                           # publicarlo después

# Operación
npm run factory -- doctor            # comprueba que todas las claves funcionan
npm run factory -- status            # tabla con etapa, tareas, tokens y URL de cada SaaS
npm run factory -- resume <slug>     # retoma donde se quedó si algo falló
npm run factory -- dashboard         # panel web en http://localhost:4000 con progreso y registros en vivo
```

### Piloto automático semanal

Sube la fábrica a un repositorio de GitHub y el workflow `.github/workflows/factory.yml` lanzará nuevos SaaS cada lunes. Configura en *Settings → Secrets and variables → Actions*:

- **Secrets:** `CLAUDE_CODE_OAUTH_TOKEN` (de `claude setup-token`), `FACTORY_GITHUB_TOKEN`, `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`
- **Variables:** `FACTORY_NICHE`, `FACTORY_GITHUB_OWNER`, `SUPABASE_ORG_ID` (y `VERCEL_TEAM_ID` si usas equipo)

También puedes lanzarlo a mano desde la pestaña *Actions → SaaS Factory → Run workflow*. Elige **solo-revisar-claves** para comprobar la configuración sin gastar nada, o **probar-sin-publicar** para generar un SaaS completo usando solo tu plan de Claude (el código queda para descargar en la ejecución, sección *Artifacts*). Al terminar, cada ejecución muestra un informe con los SaaS lanzados y sus enlaces. El estado y los registros de cada ejecución quedan guardados 90 días como artefacto.

Cada proyecto vive en `projects/<slug>/` con su estado en `.factory/state.json` y el registro completo en `.factory/log.txt`. Si se corta la luz o falla una API, `resume` continúa desde la última etapa guardada, sin repetir trabajo ni gastar tokens de más.

## 3. Cómo funciona por dentro

| Archivo | Rol |
|---|---|
| `src/agents.ts` | Los 7 agentes: ideador, PM, arquitecto, ingeniero, revisor, crecimiento y QA |
| `src/llm.ts` | Bucle agéntico con herramientas + salida JSON estructurada + control de presupuesto |
| `src/tools.ts` | Herramientas del ingeniero (leer/escribir/editar archivos, ejecutar npm/tsc), encerradas en la carpeta del proyecto |
| `src/pipeline.ts` | Línea de montaje con etapas reanudables |
| `src/generic.ts` | `new` e `improve`: línea de montaje para cualquier stack |
| `src/stacks.ts` + `stacks/` | Paquetes de stack combinables y validación de seguridad |
| `src/doctor.ts` | Verifica claves, permisos y límites de cada servicio |
| `src/smoke.ts` | Pruebas sobre el sitio publicado: páginas responden, dashboard protegido, webhook rechaza firmas falsas |
| `src/dashboard.ts` | Panel web local de la fábrica |
| `src/deploy.ts` | Crea repo, proyecto Supabase + migraciones, productos/precios/webhook de Stripe y despliegue en Vercel |
| `template/` | Plantilla base Next.js 15 + Supabase + Stripe + Tailwind v4 de la que parte cada SaaS |

**Calidad:** el ingeniero ejecuta `typecheck` tras cada tarea y el agente QA repite `typecheck + build` hasta `MAX_QA_ROUNDS` veces, corrigiendo la causa raíz. Antes de QA, un revisor (Opus) audita seguridad (RLS, validación de usuario, secretos), funcionalidades del PRD que falten y textos de relleno, y lo corrige. Ningún SaaS se publica si no compila, y ninguno se marca como terminado si falla las pruebas sobre el sitio en vivo.

**Legal:** las páginas de términos y privacidad son plantillas genéricas. Revísalas antes de cobrar en modo live y pon tu correo de soporte en `NEXT_PUBLIC_SUPPORT_EMAIL`.

**Costos:** el límite `MAX_TOKENS_PER_PROJECT` detiene un proyecto si se pasa del presupuesto. Opus planifica (pocas llamadas) y Sonnet programa (la mayoría), que es el equilibrio calidad/precio. Revisa el consumo con `status`.

**Seguridad:** el agente solo puede ejecutar `npm`, `npx`, `node`, `tsc` y comandos de lectura, y solo dentro de la carpeta del proyecto. Stripe arranca en modo test: cambia a `sk_live_` solo cuando hayas probado un SaaS de punta a punta.

## 4. Pruebas

```bash
npm test          # unitarias + escenarios completos con Claude simulado y compiladores reales (≈2 min)
npm run test:unit # solo las rápidas
```

Los escenarios crean proyectos reales (React + FastAPI + PostgreSQL + Docker Compose, Go, una mejora en un repositorio Express) y comprueban seguridad, ramas y que nada generado se versione. Los que necesitan un toolchain que no tienes se saltan solos.

En GitHub, el workflow **CI** lo ejecuta todo en cada cambio y además prueba los paquetes de **Spring Boot** (Java 21 + Maven) y **.NET** (8 y 10), y CitaFácil y MenúFácil completos en Chrome. Los resultados están en la pestaña *Actions*; las capturas de pantalla de los SaaS quedan como artefactos.

## 5. Mejorar la fábrica

La palanca más grande es `template/`: todo lo que añadas ahí (componentes, emails, analítica, panel de admin) lo heredan todos los SaaS futuros. Documenta cada añadido en `template/CONVENTIONS.md` para que los agentes sepan usarlo.

