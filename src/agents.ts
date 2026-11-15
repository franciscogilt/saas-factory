import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { askJSON, Budget, runAgent } from "./llm.js";
import { listTree, projectTools, sh } from "./tools.js";
import type { PRD, Task } from "./state.js";

// ─────────────────────────── 1. IDEADOR ───────────────────────────
export interface Idea { name: string; idea: string; targetCustomer: string; whyNow: string; score: number }

export async function ideate(niche: string, n: number, budget: Budget): Promise<Idea[]> {
  const r = await askJSON<{ ideas: Idea[] }>({
    model: config.models.strategy,
    budget,
    system:
      "Eres un fundador serial de micro-SaaS rentables. Propones productos pequeños, específicos, " +
      "que una sola persona puede construir con Next.js + Supabase + Stripe y cobrar por suscripción desde el día 1. " +
      "Evita ideas genéricas (otro CRM, otro gestor de tareas). Prioriza nichos con dolor claro y disposición a pagar.",
    prompt: `Genera ${n} ideas de SaaS para este nicho/mercado: "${niche}". Puntúa cada una de 1 a 10 (dolor × facilidad × monetización). Ordénalas de mejor a peor.`,
    schema: {
      type: "object",
      properties: {
        ideas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              idea: { type: "string", description: "Descripción de 2-3 frases del producto" },
              targetCustomer: { type: "string" },
              whyNow: { type: "string" },
              score: { type: "number" },
            },
            required: ["name", "idea", "targetCustomer", "whyNow", "score"],
          },
        },
      },
      required: ["ideas"],
    },
  });
  return r.ideas;
}

// ─────────────────────────── 2. PRODUCT MANAGER ───────────────────────────
export async function writePRD(idea: string, budget: Budget): Promise<PRD> {
  return askJSON<PRD>({
    model: config.models.strategy,
    budget,
    system:
      "Eres un product manager experto en micro-SaaS. Conviertes una idea en un MVP enfocado que se pueda " +
      "construir en un día: 3-5 funcionalidades núcleo, nada más. Siempre incluyes un plan gratuito y 1-2 planes de pago mensuales. " +
      "Escribe el copy de la landing en el idioma del cliente objetivo.",
    prompt: `Idea: ${idea}\n\nDefine el PRD del MVP.`,
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string", description: "kebab-case, corto, único" },
        tagline: { type: "string" },
        problem: { type: "string" },
        targetCustomer: { type: "string" },
        valueProposition: { type: "string" },
        coreFeatures: {
          type: "array",
          items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } }, required: ["title", "description"] },
        },
        plans: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "free | pro | business ..." },
              name: { type: "string" },
              priceUsd: { type: "number", description: "0 para el plan gratis" },
              features: { type: "array", items: { type: "string" } },
            },
            required: ["id", "name", "priceUsd", "features"],
          },
        },
        dataModel: { type: "string", description: "Tablas Postgres necesarias con columnas, todas con user_id y RLS" },
        landingCopy: {
          type: "object",
          properties: { headline: { type: "string" }, subheadline: { type: "string" }, cta: { type: "string" } },
          required: ["headline", "subheadline", "cta"],
        },
      },
      required: ["name", "slug", "tagline", "problem", "targetCustomer", "valueProposition", "coreFeatures", "plans", "dataModel", "landingCopy"],
    },
  });
}

// ─────────────────────────── 3. ARQUITECTO ───────────────────────────
export async function planTasks(prd: PRD, root: string, budget: Budget): Promise<Task[]> {
  const conventions = await readFile(join(root, "CONVENTIONS.md"), "utf8");
  const tree = (await listTree(root)).join("\n");
  const r = await askJSON<{ tasks: Task[] }>({
    model: config.models.strategy,
    budget,
    system:
      "Eres un arquitecto de software senior. Divides un MVP en tareas de implementación pequeñas, secuenciales " +
      "y verificables, sobre una plantilla existente. La primera tarea siempre es la migración SQL del modelo de datos. " +
      "La última es pulir la landing y el dashboard. Máximo 10 tareas.",
    prompt: `PRD:\n${JSON.stringify(prd, null, 2)}\n\nConvenciones de la plantilla:\n${conventions}\n\nArchivos existentes:\n${tree}`,
    schema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              details: { type: "string", description: "Qué construir exactamente, criterios de aceptación" },
              files: { type: "array", items: { type: "string" }, description: "Archivos a crear o modificar" },
            },
            required: ["id", "title", "details", "files"],
          },
        },
      },
      required: ["tasks"],
    },
  });
  return r.tasks;
}

// ─────────────────────────── 4. INGENIERO ───────────────────────────
const ENGINEER_SYSTEM = (conventions: string) => `Eres un ingeniero full-stack senior que trabaja de forma autónoma.
Stack: Next.js (App Router, TypeScript, Server Components), Tailwind CSS v4, Supabase (@supabase/ssr, Postgres con RLS), Stripe.
Reglas:
- Lee los archivos relevantes antes de modificarlos. Respeta las convenciones de la plantilla.
- Código completo y de producción: nada de TODOs, placeholders ni "implementar después".
- Toda tabla nueva va en una migración nueva en supabase/migrations con RLS por user_id.
- Las mutaciones se hacen con Server Actions o Route Handlers validando el usuario en el servidor.
- Antes de terminar ejecuta "npm run typecheck" y arregla cualquier error.
- Cuando termines responde con un resumen de 2-3 líneas.

CONVENCIONES DE LA PLANTILLA:
${conventions}`;

export async function implementTask(prd: PRD, task: Task, root: string, budget: Budget, log: (m: string) => void) {
  const conventions = await readFile(join(root, "CONVENTIONS.md"), "utf8");
  return runAgent({
    model: config.models.engineer,
    system: ENGINEER_SYSTEM(conventions),
    tools: projectTools(root),
    cwd: root,
    budget,
    log,
    prompt:
      `Producto: ${prd.name} — ${prd.tagline}\nPRD completo en docs/PRD.md.\n\n` +
      `TAREA ${task.id}: ${task.title}\n${task.details}\nArchivos previstos: ${task.files.join(", ")}`,
  });
}

// ─────────────────────────── 4b. REVISOR ───────────────────────────
export async function reviewCode(prd: PRD, root: string, budget: Budget, log: (m: string) => void) {
  const conventions = await readFile(join(root, "CONVENTIONS.md"), "utf8");
  return runAgent({
    model: config.models.strategy,
    system:
      ENGINEER_SYSTEM(conventions) +
      `\n\nAHORA ACTÚAS COMO REVISOR DE CÓDIGO SENIOR. Lee todo el código de app/, lib/, components/ y supabase/migrations/ ` +
      `y CORRIGE directamente (no solo reportes) lo que encuentres de esta lista:\n` +
      `1. Seguridad: tablas sin RLS o con políticas incompletas; consultas sin filtrar por usuario; uso del cliente admin fuera de webhooks; secretos expuestos al cliente (variables sin NEXT_PUBLIC_ usadas en "use client").\n` +
      `2. Server Actions o Route Handlers que no validan supabase.auth.getUser().\n` +
      `3. Funcionalidades del PRD que faltan o están a medias, botones que no hacen nada, enlaces rotos entre páginas.\n` +
      `4. Límites del plan gratis no aplicados en el servidor (usa getUserPlan()).\n` +
      `5. Estados vacíos, de carga y de error ausentes en el dashboard.\n` +
      `6. Textos de relleno (lorem ipsum, "TODO", "Mi SaaS").\n` +
      `No reescribas lo que funciona. Termina con "npm run typecheck" en verde y un resumen de los cambios.`,
    tools: projectTools(root),
    cwd: root,
    budget,
    log,
    prompt: `Revisa el SaaS "${prd.name}". El PRD está en docs/PRD.md. Funcionalidades esperadas:\n` +
      prd.coreFeatures.map((f) => `- ${f.title}: ${f.description}`).join("\n"),
  });
}

// ─────────────────────────── 4c. CRECIMIENTO ───────────────────────────
export interface Post { slug: string; title: string; description: string; content: string }
export interface Launch { productHunt: string; twitterThread: string[]; linkedin: string; reddit: { subreddit: string; title: string; body: string }[]; coldEmail: string; keywords: string[] }

export async function writeGrowth(prd: PRD, budget: Budget): Promise<{ posts: Post[]; launch: Launch }> {
  const system =
    "Eres un growth marketer experto en SEO y lanzamientos de micro-SaaS sin presupuesto. Escribes en el idioma del cliente objetivo, " +
    "con tono humano y útil, sin exageraciones ni promesas falsas, sin inventar estadísticas, testimonios ni clientes. " +
    "NUNCA escribas experiencias personales del fundador en primera persona (\"hablé con 10 clientes\", \"mi familia tiene…\"): " +
    "en su lugar deja un hueco entre corchetes, p. ej. [Cuenta aquí tu experiencia real], para que el fundador lo complete. " +
    "El contenido debe aportar valor por sí mismo y mencionar el producto solo donde encaja de forma natural.";
  const ctx = `Producto: ${prd.name} — ${prd.tagline}\nCliente: ${prd.targetCustomer}\nProblema: ${prd.problem}\nPropuesta: ${prd.valueProposition}\n` +
    `Funciones: ${prd.coreFeatures.map((f) => f.title).join(", ")}\nPrecios: ${prd.plans.map((p) => `${p.name} $${p.priceUsd}`).join(", ")}`;

  const { posts } = await askJSON<{ posts: Post[] }>({
    model: config.models.strategy,
    budget,
    system,
    prompt: `${ctx}\n\nEscribe 3 artículos de blog SEO (900-1300 palabras cada uno) que respondan búsquedas reales de este cliente con intención de compra ` +
      `(guías "cómo…", comparativas, plantillas, errores comunes). Formato del contenido: párrafos separados por línea en blanco, "## " para subtítulos, "- " para listas, **negritas**. Sin el título dentro del contenido.`,
    schema: {
      type: "object",
      properties: {
        posts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slug: { type: "string", description: "kebab-case con la palabra clave" },
              title: { type: "string", description: "≤ 65 caracteres, con la palabra clave" },
              description: { type: "string", description: "meta descripción ≤ 155 caracteres" },
              content: { type: "string" },
            },
            required: ["slug", "title", "description", "content"],
          },
        },
      },
      required: ["posts"],
    },
  });

  const launch = await askJSON<Launch>({
    model: config.models.strategy,
    budget,
    system,
    prompt: `${ctx}\n\nPrepara el kit de lanzamiento. Usa {{URL}} donde vaya el enlace.`,
    schema: {
      type: "object",
      properties: {
        productHunt: { type: "string", description: "Tagline (≤60 car.) + descripción + primer comentario del maker" },
        twitterThread: { type: "array", items: { type: "string" }, description: "Hilo de 5-7 tweets ≤ 280 car." },
        linkedin: { type: "string" },
        reddit: {
          type: "array",
          items: {
            type: "object",
            properties: { subreddit: { type: "string" }, title: { type: "string" }, body: { type: "string", description: "Aporta valor primero; respeta las reglas anti-spam" } },
            required: ["subreddit", "title", "body"],
          },
        },
        coldEmail: { type: "string", description: "Email corto y personalizable para contactar a 1 cliente potencial" },
        keywords: { type: "array", items: { type: "string" }, description: "10 palabras clave long-tail para siguientes artículos" },
      },
      required: ["productHunt", "twitterThread", "linkedin", "reddit", "coldEmail", "keywords"],
    },
  });
  return { posts, launch };
}

// ─────────────────────────── 5. QA ───────────────────────────
export async function qaLoop(prd: PRD, root: string, budget: Budget, log: (m: string) => void, startRound = 0, onRound?: (r: number) => Promise<void>) {
  log("QA: instalando dependencias…");
  const inst = await sh("npm install --no-audit --no-fund", root);
  if (inst.code !== 0) log("npm install falló, el agente lo intentará arreglar");

  const conventions = await readFile(join(root, "CONVENTIONS.md"), "utf8");
  for (let round = startRound; round < config.maxQaRounds; round++) {
    await onRound?.(round);
    const check = await sh("npm run typecheck && npm run build", root);
    if (check.code === 0) {
      log(`QA ✅ build verde (ronda ${round})`);
      return true;
    }
    log(`QA ❌ ronda ${round + 1}/${config.maxQaRounds}: el ingeniero corrige errores…`);
    await runAgent({
      model: config.models.engineer,
      system: ENGINEER_SYSTEM(conventions),
      tools: projectTools(root),
    cwd: root,
      budget,
      log,
      prompt:
        `El proyecto ${prd.name} no compila. Arregla la causa raíz de estos errores (no los silencies con any, ` +
        `@ts-ignore ni desactivando checks). Al final ejecuta "npm run typecheck && npm run build".\n\n` +
        check.out.slice(-12_000),
    });
  }
  return false;
}
