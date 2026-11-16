// Línea de montaje para CUALQUIER stack, en tu máquina:
//   factory new "<idea>" --stack "angular + springboot + postgresql"   → proyecto nuevo
//   factory improve <carpeta> "<tarea>"                                → cambio en un proyecto existente, en una rama aparte
import { cp, mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join, resolve, basename } from "node:path";
import { config } from "./config.js";
import { askJSON, Budget, runAgent } from "./llm.js";
import { listTree, projectTools, sh } from "./tools.js";
import { slugify } from "./state.js";
import {
  allowedOf, composeStack, describeStack, listPacks, matchPacks, stackBrief, validateStack,
  type Kind, type ProjectStack, type StackSpec,
} from "./stacks.js";

export interface Brief { name: string; slug: string; summary: string; features: string[]; acceptance: string[] }
export interface GTask { id: string; title: string; details: string }
type GStage = "brief" | "stack" | "setup" | "plan" | "build" | "review" | "qa" | "commit" | "done";

export interface GState {
  kind: "generic";
  mode: "new" | "improve";
  slug: string;
  root: string;
  goal: string;
  stackText?: string;
  stage: GStage;
  brief?: Brief;
  stack?: ProjectStack;
  tasks?: GTask[];
  doneTasks: string[];
  qaRounds: number;
  tokensUsed: number;
  branch?: string;
  baseBranch?: string;
  baselineFailing?: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GOptions { yes?: boolean; dir?: string; stack?: string; branch?: string }

const STACK_FILE = "factory.stack.json"; // declaración del stack, versionada en el proyecto

// ─────────────────────────── Estado, registro y git ───────────────────────────
const stateFile = (root: string) => join(root, ".factory", "state.json");
export const loadGState = async (root: string): Promise<GState | null> =>
  existsSync(stateFile(root)) ? JSON.parse(await readFile(stateFile(root), "utf8")) : null;
async function save(s: GState) {
  s.updatedAt = new Date().toISOString();
  await mkdir(join(s.root, ".factory"), { recursive: true });
  await writeFile(stateFile(s.root), JSON.stringify(s, null, 2));
}
function logger(root: string, slug: string) {
  return (msg: string) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] [${slug}] ${msg}`;
    console.log(line);
    mkdir(join(root, ".factory"), { recursive: true }).then(() => appendFile(join(root, ".factory", "log.txt"), line + "\n")).catch(() => {});
  };
}
const git = (args: string, cwd: string) => sh(`git ${args}`, cwd, 120_000);
async function gitCommit(root: string, message: string) {
  const who = (await git("config user.email", root)).out.trim();
  const id = who ? "" : `-c user.name="Factory" -c user.email="factory@localhost" `;
  await git("add -A", root);
  const r = await git(`${id}commit -q -m ${JSON.stringify(message)}`, root);
  if (r.code !== 0 && !/nothing to commit/.test(r.out)) throw new Error(`git commit falló: ${r.out.slice(-400)}`);
}
/** Lo que generan los stacks y nunca debe versionarse. */
const GENERATED = [
  ".factory/", "node_modules/", "dist/", "build/", "out/", ".next/", "coverage/", ".angular/",
  ".venv/", "venv/", "__pycache__/", "*.pyc", ".pytest_cache/", ".mypy_cache/", ".ruff_cache/",
  "bin/", "obj/", "target/", ".gradle/", "cdk.out/", ".env", ".env.local", ".DS_Store",
];
/** Proyecto nuevo: completa su .gitignore. Proyecto existente: usa .git/info/exclude para no tocar sus archivos. */
async function ensureIgnores(root: string, mode: "new" | "improve") {
  const f = mode === "new" ? join(root, ".gitignore") : join(root, ".git", "info", "exclude");
  if (mode === "improve" && !existsSync(join(root, ".git"))) return;
  const cur = existsSync(f) ? await readFile(f, "utf8") : "";
  const have = new Set(cur.split("\n").map((l) => l.trim()));
  const missing = GENERATED.filter((g) => !have.has(g) && !have.has(g.replace(/\/$/, "")));
  if (!missing.length) return;
  await mkdir(join(f, ".."), { recursive: true });
  await appendFile(f, `${cur && !cur.endsWith("\n") ? "\n" : ""}\n# Generado por la fábrica: archivos que no se versionan\n${missing.join("\n")}\n`);
}

async function excludeFactoryDir(root: string) {
  const f = join(root, ".git", "info", "exclude");
  if (!existsSync(join(root, ".git"))) return;
  const cur = existsSync(f) ? await readFile(f, "utf8") : "";
  if (!cur.includes(".factory/")) await mkdir(join(root, ".git", "info"), { recursive: true }).then(() => appendFile(f, "\n.factory/\n"));
}

async function confirm(question: string, opts: GOptions) {
  if (opts.yes || !process.stdin.isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${question} (s/N) `)).trim().toLowerCase();
  rl.close();
  return a === "s" || a === "si" || a === "sí" || a === "y" || a === "yes";
}

// ─────────────────────────── Foto del proyecto (para detectar y planificar) ───────────────────────────
const MANIFESTS = [
  STACK_FILE, "CLAUDE.md", "README.md", "package.json", "angular.json", "tsconfig.json", "pyproject.toml", "requirements.txt",
  "manage.py", "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "go.mod", "Cargo.toml", "composer.json",
  "Gemfile", "pubspec.yaml", "docker-compose.yml", "compose.yaml", "Makefile", "cdk.json",
];
export async function snapshot(root: string) {
  const files = await listTree(root);
  const tree = files.slice(0, 400).join("\n") + (files.length > 400 ? `\n… y ${files.length - 400} archivos más` : "");
  const picked = files.filter((f) => MANIFESTS.includes(basename(f)) || /\.(sln|csproj)$/.test(f)).filter((f) => f.split("/").length <= 3).slice(0, 25);
  let body = "";
  for (const f of picked) body += `\n--- ${f} ---\n${(await readFile(join(root, f), "utf8")).slice(0, 3000)}\n`;
  return `ÁRBOL DE ARCHIVOS:\n${tree}\n\nARCHIVOS CLAVE:${body || " (ninguno)"}`;
}

// ─────────────────────────── Agentes ───────────────────────────
const componentSchema = {
  type: "object",
  properties: {
    packId: { type: "string", description: "id de un paquete existente si encaja; vacío si es un componente propio" },
    name: { type: "string" },
    kind: { type: "string", enum: ["backend", "frontend", "fullstack", "database", "infra", "deploy"] },
    folder: { type: "string", description: "carpeta relativa del componente ('.' = raíz)" },
    scaffold: { type: "string", description: "cómo crearlo desde cero (solo proyectos nuevos)" },
    install: { type: "string" },
    check: { type: "string", description: "comando que compila y ejecuta las pruebas; debe terminar con código 0 si todo va bien" },
    dev: { type: "string" },
    allowedCommands: { type: "array", items: { type: "string" }, description: "patrones como 'go *', 'composer *', './gradlew *'" },
    conventions: { type: "string", description: "buenas prácticas del stack en viñetas" },
  },
  required: ["name", "kind"],
};

async function writeBrief(goal: string, budget: Budget): Promise<Brief> {
  return askJSON<Brief>({
    model: config.models.strategy, budget,
    system: "Eres un product manager técnico. Conviertes una idea en un alcance de primera versión pequeño, concreto y verificable. Escribe en español.",
    prompt: `Idea: ${goal}\n\nDefine la primera versión: 3-6 funcionalidades y criterios de aceptación comprobables.`,
    schema: {
      type: "object",
      properties: {
        name: { type: "string" }, slug: { type: "string", description: "kebab-case corto" }, summary: { type: "string" },
        features: { type: "array", items: { type: "string" } }, acceptance: { type: "array", items: { type: "string" } },
      },
      required: ["name", "slug", "summary", "features", "acceptance"],
    },
  });
}

function fromProposal(p: any, packs: StackSpec[]): StackSpec {
  const base = packs.find((x) => x.id === p.packId);
  const spec: StackSpec = base ? structuredClone(base) : { id: slugify(p.name || "componente"), name: p.name, kind: p.kind as Kind, allowedCommands: [] };
  for (const k of ["folder", "scaffold", "install", "check", "dev", "conventions"] as const) if (p[k]) (spec as any)[k] = p[k];
  if (Array.isArray(p.allowedCommands) && p.allowedCommands.length)
    spec.allowedCommands = [...new Set([...(base?.allowedCommands ?? []), ...p.allowedCommands])];
  if (p.kind && !base) spec.kind = p.kind;
  return spec;
}

const packList = (packs: StackSpec[]) =>
  packs.map((p) => `- ${p.id}: ${p.name} (${p.kind}); verificar: ${p.check ?? "—"}; comandos: ${p.allowedCommands.join(", ") || "—"}`).join("\n");

/** Stack de un proyecto nuevo: paquetes que encajan + componentes propios para lo que no tiene paquete. */
async function resolveNewStack(goal: string, brief: Brief, stackText: string | undefined, budget: Budget, log: (m: string) => void) {
  const packs = await listPacks();
  const { matched, unmatched } = stackText ? await matchPacks(stackText) : { matched: [], unmatched: [] };
  if (stackText && unmatched.length === 0 && matched.length) return composeStack(matched);
  log(stackText ? `Arquitecto: resolviendo lo que no tiene paquete (${unmatched.join(", ")})…` : "Arquitecto: eligiendo el stack…");
  const r = await askJSON<{ components: any[] }>({
    model: config.models.strategy, budget,
    system:
      "Eres un arquitecto de software. Defines los componentes técnicos de un proyecto y, para cada uno, comandos REALES y no interactivos " +
      "para instalar, verificar (compilar + pruebas; debe salir con código 0 si todo va bien) y arrancar. Prefiere paquetes existentes cuando encajan. " +
      "Los comandos se ejecutan dentro de la carpeta del componente. Nunca uses sudo, curl, wget, bash -c ni pipes. allowedCommands debe cubrir todos los comandos que uses.",
    prompt:
      `Proyecto: ${brief.name} — ${brief.summary}\nIdea original: ${goal}\n` +
      (stackText ? `Stack pedido por el usuario: ${stackText}\nYa resueltos con paquetes: ${matched.map((m) => m.id).join(", ") || "ninguno"}\nSin paquete (defínelos tú): ${unmatched.join(", ")}\n`
                 : `El usuario no eligió stack: elige el más simple y adecuado, preferentemente con estos paquetes.\n`) +
      `\nPaquetes disponibles:\n${packList(packs)}\n\nDevuelve SOLO los componentes que faltan${stackText ? "" : " (todos)"}. Usa packId cuando uno encaje.`,
    schema: { type: "object", properties: { components: { type: "array", items: componentSchema } }, required: ["components"] },
  });
  return composeStack([...matched, ...r.components.map((c) => fromProposal(c, packs))]);
}

/** Stack de un proyecto existente: lo declara factory.stack.json o lo detecta la IA leyendo el proyecto. */
async function detectStack(root: string, stackText: string | undefined, budget: Budget, log: (m: string) => void): Promise<ProjectStack> {
  if (existsSync(join(root, STACK_FILE))) {
    log(`Stack leído de ${STACK_FILE}`);
    return JSON.parse(await readFile(join(root, STACK_FILE), "utf8"));
  }
  const packs = await listPacks();
  log("Arquitecto: estudiando el proyecto para detectar su stack y sus pruebas…");
  const r = await askJSON<{ components: any[] }>({
    model: config.models.strategy, budget,
    system:
      "Eres un arquitecto de software. Detectas los componentes de un proyecto existente (carpeta de cada uno) y sus comandos REALES " +
      "de instalar, verificar (compilar + pruebas que ya existan; salida 0 si todo va bien) y arrancar, a partir de sus archivos. " +
      "Usa los scripts que el proyecto ya define (package.json, Makefile, pom.xml…). Si no hay pruebas, el check es solo compilar. " +
      "Nunca uses sudo, curl, wget, bash -c ni pipes. allowedCommands debe cubrir todos los comandos.",
    prompt: (stackText ? `Pista del usuario sobre el stack: ${stackText}\n\n` : "") +
      `Paquetes disponibles (usa packId si encaja; puedes cambiar sus comandos si el proyecto usa otros):\n${packList(packs)}\n\n${await snapshot(root)}`,
    schema: { type: "object", properties: { components: { type: "array", items: componentSchema } }, required: ["components"] },
  });
  return composeStack(r.components.map((c) => fromProposal({ folder: ".", ...c }, packs)));
}

async function planTasks(s: GState, budget: Budget): Promise<GTask[]> {
  const r = await askJSON<{ tasks: GTask[] }>({
    model: config.models.strategy, budget,
    system:
      "Eres un arquitecto de software senior. Divides el trabajo en tareas pequeñas, secuenciales y verificables (máximo 8). " +
      (s.mode === "new"
        ? "Si algún componente no tiene plantilla, la primera tarea es crearlo según su 'scaffold' y dejar su verificación en verde. Incluye pruebas automáticas en las tareas."
        : "Es un proyecto existente: respeta su arquitectura y estilo; incluye o actualiza pruebas para lo que cambies. No hagas cambios fuera del alcance de la tarea."),
    prompt:
      `${s.mode === "new" ? `Proyecto nuevo: ${s.brief!.name} — ${s.brief!.summary}\nFuncionalidades:\n- ${s.brief!.features.join("\n- ")}\nCriterios de aceptación:\n- ${s.brief!.acceptance.join("\n- ")}` : `Tarea en un proyecto existente: ${s.goal}`}\n\n` +
      `STACK:\n${stackBrief(s.stack!)}\n` +
      s.stack!.components.filter((c) => c.scaffold && !c.templateDir).map((c) => `Cómo crear ${c.name} (carpeta ${c.folder}): ${c.scaffold}`).join("\n") +
      `\n\n${await snapshot(s.root)}`,
    schema: {
      type: "object",
      properties: { tasks: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, details: { type: "string" } }, required: ["id", "title", "details"] } } },
      required: ["tasks"],
    },
  });
  return r.tasks.map((t, i) => ({ ...t, id: String(i + 1) }));
}

const engineerSystem = (s: GState) => `Eres un ingeniero de software senior que trabaja de forma autónoma en este proyecto.
Reglas:
- Lee el código relevante antes de cambiarlo y respeta el estilo y la arquitectura existentes.
- Código completo y de producción: nada de TODOs, placeholders ni "implementar después".
- Valida la entrada, no expongas secretos (usa variables de entorno y documenta cada una en .env.example), controla permisos en el servidor.
- Añade o actualiza pruebas automáticas para lo que construyas.
- Ejecuta los comandos de uno en uno (sin encadenar con && ni ;). Antes de terminar, ejecuta la verificación de cada componente que hayas tocado y déjala en verde.
- No hagas git push, no cambies de rama y no despliegues nada en la nube.
- Al terminar, responde con un resumen de 2-3 líneas.

STACK Y CONVENCIONES:
${stackBrief(s.stack!)}`;

const runEngineer = (s: GState, prompt: string, budget: Budget, log: (m: string) => void, model = config.models.engineer, system = engineerSystem(s)) =>
  runAgent({ model, system, prompt, tools: projectTools(s.root, allowedOf(s.stack!)), cwd: s.root, allowedCommands: allowedOf(s.stack!), budget, log });

// ─────────────────────────── Verificación ───────────────────────────
async function runChecks(s: GState) {
  const failures: { name: string; folder: string; out: string }[] = [];
  for (const c of s.stack!.components) {
    if (!c.check) continue;
    const cwd = resolve(s.root, c.folder ?? ".");
    if (!existsSync(cwd)) { failures.push({ name: c.name, folder: c.folder!, out: `La carpeta ${c.folder} no existe.` }); continue; }
    const r = await sh(c.check, cwd);
    if (r.code !== 0) failures.push({ name: c.name, folder: c.folder!, out: r.out.slice(-6000) });
  }
  return failures;
}
async function runInstalls(s: GState, log: (m: string) => void) {
  for (const c of s.stack!.components) {
    if (!c.install) continue;
    const cwd = resolve(s.root, c.folder ?? ".");
    if (!existsSync(cwd)) continue;
    log(`QA: instalando ${c.name}…`);
    const r = await sh(c.install, cwd, 30 * 60_000);
    if (r.code !== 0) log(`  ⚠️ la instalación de ${c.name} falló; el ingeniero lo revisará`);
  }
}

// ─────────────────────────── Línea de montaje ───────────────────────────
export async function newProject(goal: string, opts: GOptions) {
  const budget = new Budget(config.maxTokensPerProject);
  let log = logger(opts.dir ? resolve(opts.dir) : config.workspaceDir, "nuevo");
  log("PM: definiendo el alcance…");
  const brief = await writeBrief(goal, budget);
  let slug = slugify(brief.slug || brief.name) || "proyecto";
  let root = opts.dir ? resolve(opts.dir) : join(config.workspaceDir, slug);
  if (!opts.dir) while (existsSync(root)) { slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`; root = join(config.workspaceDir, slug); }
  if (existsSync(root) && readdirSync(root).filter((f) => f !== ".factory").length)
    throw new Error(`La carpeta ${root} no está vacía. Para cambiar un proyecto existente usa \`factory improve\`.`);
  await mkdir(root, { recursive: true });
  log = logger(root, slug);
  const now = new Date().toISOString();
  const s: GState = { kind: "generic", mode: "new", slug, root, goal, stackText: opts.stack, stage: "stack", brief, doneTasks: [], qaRounds: 0, tokensUsed: budget.used, createdAt: now, updatedAt: now };
  await save(s);
  log(`PM: "${brief.name}" — ${brief.summary}`);
  return pipeline(s, opts, budget);
}

export async function improveProject(dir: string, task: string, opts: GOptions) {
  const root = resolve(dir);
  if (!existsSync(root)) throw new Error(`No existe la carpeta ${root}.`);
  if ((await git("rev-parse --is-inside-work-tree", root)).code !== 0)
    throw new Error(`${root} no es un repositorio git. Ejecuta \`git init\` y haz un primer commit: así tus cambios siempre se pueden deshacer.`);
  await excludeFactoryDir(root);
  const dirty = (await git("status --porcelain", root)).out.trim();
  if (dirty) throw new Error(`Hay cambios sin guardar en ${root}. Haz commit o \`git stash\` antes, para que la fábrica trabaje sobre algo limpio.`);
  const slug = slugify(task).slice(0, 40) || "cambio";
  const budget = new Budget(config.maxTokensPerProject);
  const now = new Date().toISOString();
  const s: GState = {
    kind: "generic", mode: "improve", slug, root, goal: task, stackText: opts.stack, stage: "stack",
    baseBranch: (await git("rev-parse --abbrev-ref HEAD", root)).out.trim(),
    branch: opts.branch ?? `factory/${slug}`,
    doneTasks: [], qaRounds: 0, tokensUsed: 0, createdAt: now, updatedAt: now,
  };
  return pipeline(s, opts, budget);
}

export async function resumeGeneric(root: string, opts: GOptions) {
  const s = await loadGState(resolve(root));
  if (!s) throw new Error(`No hay trabajo de la fábrica en ${root}.`);
  delete s.error;
  const budget = new Budget(config.maxTokensPerProject);
  budget.used = s.tokensUsed;
  return pipeline(s, { ...opts, yes: true }, budget);
}

async function pipeline(s: GState, opts: GOptions, budget: Budget) {
  const log = logger(s.root, s.slug);
  const track = () => { s.tokensUsed = budget.used; return save(s); };
  try {
    // 1 ── Stack
    if (s.stage === "stack") {
      s.stack = s.mode === "new"
        ? await resolveNewStack(s.goal, s.brief!, s.stackText, budget, log)
        : await detectStack(s.root, s.stackText, budget, log);
      validateStack(s.stack);
      console.log(`\n${describeStack(s.stack)}\n`);
      if (s.mode === "improve") console.log(`  Trabajaré en la rama ${s.branch} (tu rama ${s.baseBranch} no se toca).\n`);
      if (!(await confirm("¿Continuar con este stack y estos comandos?", opts))) {
        log("Cancelado por el usuario. Puedes ajustar el stack con --stack o crear un factory.stack.json.");
        s.error = "cancelado"; await track(); return s;
      }
      s.stage = "setup"; await track();
    }

    // 2 ── Preparación
    if (s.stage === "setup") {
      if (s.mode === "new") {
        for (const c of s.stack!.components.filter((c) => c.templateDir)) {
          log(`Plantilla: copiando ${c.name} en ${c.folder}…`);
          await cp(c.templateDir!, resolve(s.root, c.folder ?? "."), { recursive: true, filter: (src) => !/node_modules|\.next|\.venv|__pycache__/.test(src) });
        }
        const declared: ProjectStack = { components: s.stack!.components.map(({ templateDir, scaffold, ...c }) => c) };
        await writeFile(join(s.root, STACK_FILE), JSON.stringify(declared, null, 2) + "\n");
        if (!existsSync(join(s.root, "CLAUDE.md"))) await writeFile(join(s.root, "CLAUDE.md"), claudeMd(s));
        if ((await git("rev-parse --is-inside-work-tree", s.root)).code !== 0) await git("init -q -b main", s.root);
        await excludeFactoryDir(s.root);
      } else {
        const r = await git(`checkout -q -b ${s.branch}`, s.root);
        if (r.code !== 0) throw new Error(`No se pudo crear la rama ${s.branch}: ${r.out.trim()}`);
        log(`Git: trabajando en la rama ${s.branch}`);
        await ensureIgnores(s.root, "improve");
        await runInstalls(s, log);
        s.baselineFailing = (await runChecks(s)).map((f) => f.name);
        if (s.baselineFailing.length) log(`⚠️ Antes de tocar nada, ya fallaba la verificación de: ${s.baselineFailing.join(", ")}`);
      }
      s.stage = "plan"; await track();
    }

    // 3 ── Plan
    if (s.stage === "plan") {
      log("Arquitecto: planificando…");
      s.tasks = await planTasks(s, budget);
      s.tasks.forEach((t) => log(`  ${t.id}. ${t.title}`));
      s.stage = "build"; await track();
    }

    // 4 ── Construcción
    if (s.stage === "build") {
      for (const t of s.tasks!) {
        if (s.doneTasks.includes(t.id)) continue;
        log(`Ingeniero: ▶ ${t.title}`);
        const ctx = s.mode === "new" ? `Proyecto: ${s.brief!.name} — ${s.brief!.summary}` : `Objetivo general: ${s.goal}`;
        const done = await runEngineer(s, `${ctx}\n\nTAREA ${t.id}/${s.tasks!.length}: ${t.title}\n${t.details}`, budget, log);
        log(`Ingeniero: ✓ ${done.split("\n")[0]}`);
        s.doneTasks.push(t.id); await track();
      }
      s.stage = "review"; await track();
    }

    // 5 ── Revisión
    if (s.stage === "review") {
      log("Revisor: auditando seguridad, pruebas y que el trabajo esté completo…");
      const sum = await runEngineer(s,
        `Revisa el trabajo hecho para: ${s.mode === "new" ? `${s.brief!.name}. Criterios de aceptación:\n- ${s.brief!.acceptance.join("\n- ")}` : s.goal}\n` +
        (s.mode === "improve" ? `Mira los cambios con \`git diff ${s.baseBranch}\` y \`git status\`.\n` : ""),
        budget, log, config.models.strategy,
        engineerSystem(s) + `\n\nAHORA ERES REVISOR DE CÓDIGO SENIOR. CORRIGE directamente (no solo reportes):
1. Seguridad: inyección (SQL, comandos), autorización ausente, secretos en el código, CORS abierto sin motivo, entrada sin validar.
2. Funcionalidad pedida que falta o está a medias; errores sin manejar.
3. Falta de pruebas para lo nuevo.
4. Archivos de relleno, código muerto, TODOs.
5. Convenciones del stack incumplidas.
No reescribas lo que funciona.`);
      log(`Revisor: ✓ ${sum.split("\n")[0]}`);
      s.stage = "qa"; await track();
    }

    // 6 ── QA hasta verde
    if (s.stage === "qa") {
      if (s.mode === "new" || s.qaRounds === 0) await runInstalls(s, log);
      for (; s.qaRounds < config.maxQaRounds; s.qaRounds++) {
        await track();
        const failures = await runChecks(s);
        if (!failures.length) { log(`QA ✅ todas las verificaciones en verde`); break; }
        log(`QA ❌ ronda ${s.qaRounds + 1}/${config.maxQaRounds}: falla ${failures.map((f) => f.name).join(", ")}`);
        await runEngineer(s,
          `Las verificaciones fallan. Arregla la causa raíz (no desactives pruebas ni silencies errores) y vuelve a ejecutarlas.\n\n` +
          failures.map((f) => `### ${f.name} (carpeta ${f.folder})\n${f.out}`).join("\n\n"), budget, log);
      }
      if ((await runChecks(s)).length) throw new Error("QA no logró dejar todo en verde. Revisa .factory/log.txt y ejecuta `factory resume` para seguir.");
      s.stage = "commit"; await track();
    }

    // 7 ── Commit
    if (s.stage === "commit") {
      await ensureIgnores(s.root, s.mode);
      await gitCommit(s.root, s.mode === "new" ? `${s.brief!.name}: primera versión (Factory)` : `${s.goal} (Factory)`);
      s.stage = "done"; await track();
    }

    console.log(`\n✅ LISTO · ${(s.tokensUsed / 1e6).toFixed(2)}M tokens`);
    if (s.mode === "new") {
      console.log(`Proyecto en ${s.root}`);
      for (const c of s.stack!.components.filter((c) => c.dev)) console.log(`  ${c.name}: cd ${join(s.root, c.folder ?? ".")} && ${c.dev}`);
    } else {
      const stat = (await git(`diff --stat ${s.baseBranch}...${s.branch}`, s.root)).out.trim().split("\n").pop();
      console.log(`Cambios en la rama ${s.branch} (${stat}).`);
      console.log(`  Revisa:  git diff ${s.baseBranch}...${s.branch}`);
      console.log(`  Acepta:  git checkout ${s.baseBranch} && git merge ${s.branch}`);
      console.log(`  Descarta: git checkout ${s.baseBranch} && git branch -D ${s.branch}`);
    }
    return s;
  } catch (e: any) {
    log(`💥 ${e.message}`);
    s.error = e.message; await track();
    throw e;
  }
}

function claudeMd(s: GState) {
  return `# ${s.brief!.name}

${s.brief!.summary}

## Funcionalidades
${s.brief!.features.map((f) => `- ${f}`).join("\n")}

## Stack y comandos
${s.stack!.components.map((c) => `- **${c.name}** (\`${c.folder}\`)${c.install ? ` · instalar: \`${c.install}\`` : ""}${c.check ? ` · verificar: \`${c.check}\`` : ""}${c.dev ? ` · arrancar: \`${c.dev}\`` : ""}`).join("\n")}

Antes de dar un cambio por terminado, ejecuta la verificación de cada componente que hayas tocado.
El stack está declarado en \`${STACK_FILE}\` (lo usa \`factory improve\`).

## Convenciones
${stackBrief(s.stack!)}
`;
}
