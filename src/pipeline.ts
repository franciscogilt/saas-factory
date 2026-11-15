import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";
import { Budget } from "./llm.js";
import { implementTask, planTasks, qaLoop, reviewCode, writeGrowth, writePRD, type Launch, type Post } from "./agents.js";
import { deployAll } from "./deploy.js";
import { smokeTest } from "./smoke.js";
import { loadState, logger, newState, projectDir, saveState, slugify, type PRD, type ProjectState } from "./state.js";

export interface BuildOptions { deploy: boolean }

/** Línea de montaje completa. Cada etapa guarda estado: si algo falla, `factory resume <slug>` sigue donde quedó. */
export async function buildSaaS(idea: string, opts: BuildOptions, existing?: ProjectState): Promise<ProjectState> {
  let s = existing;
  let log = logger(s?.slug ?? "nuevo");

  const budget = new Budget(config.maxTokensPerProject, (used) => { if (s) s.tokensUsed = used; });
  if (s) budget.used = s.tokensUsed;

  try {
    // 1 ── PRD
    if (!s) {
      log("PM: escribiendo PRD…");
      const tmp = new Budget(config.maxTokensPerProject);
      const prd = await writePRD(idea, tmp);
      let slug = slugify(prd.slug || prd.name);
      while (existsSync(projectDir(slug))) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
      prd.slug = slug;
      s = newState(slug, idea);
      s.prd = prd;
      budget.used = tmp.used;
      s.tokensUsed = tmp.used;
      s.stage = "scaffold";
      log = logger(slug);
      await saveState(s);
      log(`PM: "${prd.name}" — ${prd.tagline}`);
    }
    const root = projectDir(s.slug);

    // 2 ── Plantilla base
    if (s.stage === "scaffold") {
      log("Scaffold: copiando plantilla base…");
      await mkdir(root, { recursive: true });
      await cp(config.templateDir, root, {
        recursive: true,
        filter: (src) => !/node_modules|\.next/.test(src),
      });
      await personalize(root, s.prd!);
      s.stage = "plan";
      await saveState(s);
    }

    // 3 ── Plan de tareas
    if (s.stage === "plan") {
      log("Arquitecto: planificando tareas…");
      s.tasks = await planTasks(s.prd!, root, budget);
      s.tasks.forEach((t, i) => log(`  ${i + 1}. ${t.title}`));
      s.stage = "build";
      await saveState(s);
    }

    // 4 ── Construcción tarea a tarea
    if (s.stage === "build") {
      for (const task of s.tasks!) {
        if (s.doneTasks.includes(task.id)) continue;
        log(`Ingeniero: ▶ ${task.title}`);
        const summary = await implementTask(s.prd!, task, root, budget, log);
        log(`Ingeniero: ✓ ${summary.split("\n")[0]}`);
        s.doneTasks.push(task.id);
        await saveState(s);
      }
      s.stage = "review";
      await saveState(s);
    }

    // 4b ── Revisión de seguridad y completitud
    if (s.stage === "review") {
      log("Revisor: auditando seguridad, RLS y funcionalidades del PRD…");
      const summary = await reviewCode(s.prd!, root, budget, log);
      log(`Revisor: ✓ ${summary.split("\n")[0]}`);
      s.stage = "growth";
      await saveState(s);
    }

    // 4c ── Crecimiento: blog SEO + kit de lanzamiento
    if (s.stage === "growth") {
      log("Crecimiento: escribiendo artículos SEO y kit de lanzamiento…");
      const { posts, launch } = await writeGrowth(s.prd!, budget);
      await writeGrowthFiles(root, posts, launch);
      log(`Crecimiento: ✓ ${posts.length} artículos · kit en docs/LAUNCH.md`);
      s.stage = "qa";
      await saveState(s);
    }

    // 5 ── QA hasta que compile
    if (s.stage === "qa") {
      const ok = await qaLoop(s.prd!, root, budget, log, s.qaRounds, async (r) => { s!.qaRounds = r; await saveState(s!); });
      if (!ok) throw new Error("QA no logró un build verde. Revisa .factory/log.txt y ejecuta `factory resume`.");
      s.stage = opts.deploy ? "deploy" : "done";
      await saveState(s);
    }

    // 6 ── Despliegue
    if (s.stage === "deploy") {
      if (!opts.deploy) { log("Despliegue omitido (--no-deploy). Usa `factory deploy <slug>` cuando quieras."); return s; }
      await deployAll(s, root, log);
      s.stage = "verify";
      await saveState(s);
    }

    // 7 ── Pruebas sobre el sitio publicado
    if (s.stage === "verify") {
      log("Verificación: probando el sitio publicado…");
      const ok = await smokeTest(s, log);
      await fillLaunchUrl(root, s.deploy.url!);
      if (!ok) throw new Error(`Pruebas post-despliegue fallidas en ${s.deploy.url}. Revisa los ✗ y ejecuta \`factory resume ${s.slug}\`.`);
      s.stage = "done";
      await saveState(s);
    }

    log(`✅ LISTO · ${s.prd!.name} · ${s.deploy.url ?? root} · ${(s.tokensUsed / 1e6).toFixed(2)}M tokens`);
    return s;
  } catch (e: any) {
    log(`💥 ${e.message}`);
    if (s) { s.error = e.message; await saveState(s); }
    throw e;
  }
}

export async function resume(slug: string, opts: BuildOptions) {
  const s = await loadState(slug);
  if (!s) throw new Error(`No existe el proyecto ${slug}`);
  delete s.error;
  if (s.stage === "failed") s.stage = "qa";
  if (s.stage === "done" && opts.deploy && !s.deploy.url) s.stage = "deploy";
  return buildSaaS(s.idea, opts, s);
}

/** Genera archivos deterministas a partir del PRD antes de que trabajen los agentes. */
export async function personalize(root: string, prd: PRD) {
  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.name = prd.slug;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2));

  const product = {
    name: prd.name,
    tagline: prd.tagline,
    headline: prd.landingCopy.headline,
    subheadline: prd.landingCopy.subheadline,
    cta: prd.landingCopy.cta,
    features: prd.coreFeatures,
  };
  const plans = prd.plans
    .map((p) =>
      `  { id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, priceUsd: ${p.priceUsd}, features: ${JSON.stringify(p.features)}, ` +
      `priceId: ${p.priceUsd > 0 ? `process.env.STRIPE_PRICE_${p.id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}` : "undefined"} },`)
    .join("\n");
  await writeFile(
    join(root, "lib", "product.ts"),
    `// Generado por SaaS Factory a partir del PRD. Los agentes pueden ampliarlo.\n` +
      `export const product = ${JSON.stringify(product, null, 2)} as const;\n\n` +
      `export type Plan = { id: string; name: string; priceUsd: number; features: string[]; priceId?: string };\n\n` +
      `export const plans: Plan[] = [\n${plans}\n];\n`,
  );

  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(
    join(root, "docs", "PRD.md"),
    `# ${prd.name}\n\n> ${prd.tagline}\n\n## Problema\n${prd.problem}\n\n## Cliente objetivo\n${prd.targetCustomer}\n\n` +
      `## Propuesta de valor\n${prd.valueProposition}\n\n## Funcionalidades\n` +
      prd.coreFeatures.map((f) => `- **${f.title}**: ${f.description}`).join("\n") +
      `\n\n## Planes\n` + prd.plans.map((p) => `- **${p.name}** ($${p.priceUsd}/mes): ${p.features.join(", ")}`).join("\n") +
      `\n\n## Modelo de datos\n${prd.dataModel}\n`,
  );
}

/** Escribe los artículos como datos tipados (nunca código generado libremente) y el kit de lanzamiento en Markdown. */
export async function writeGrowthFiles(root: string, posts: Post[], launch: Launch) {
  const day = 86_400_000;
  const data = posts.map((p, i) => ({
    slug: slugify(p.slug, 80) || `articulo-${i + 1}`,
    title: p.title,
    description: p.description,
    date: new Date(Date.now() - i * 7 * day).toISOString().slice(0, 10),
    content: p.content,
  }));
  await writeFile(
    join(root, "lib", "posts.ts"),
    `// Generado por el agente de crecimiento de SaaS Factory.\n` +
      `export type Post = { slug: string; title: string; description: string; date: string; content: string };\n\n` +
      `export const posts: Post[] = ${JSON.stringify(data, null, 2)};\n`,
  );
  const md = [
    `# Kit de lanzamiento\n`,
    `> Revisa y personaliza cada texto antes de publicarlo. Publica tú mismo: las comunidades castigan las cuentas automatizadas.\n`,
    `## Product Hunt\n\n${launch.productHunt}\n`,
    `## Hilo para X / Twitter\n\n${launch.twitterThread.map((t, i) => `**${i + 1}/** ${t}`).join("\n\n")}\n`,
    `## LinkedIn\n\n${launch.linkedin}\n`,
    `## Reddit\n\n${launch.reddit.map((r) => `### r/${r.subreddit.replace(/^r\//, "")}\n\n**${r.title}**\n\n${r.body}`).join("\n\n")}\n`,
    `## Email a clientes potenciales\n\n${launch.coldEmail}\n`,
    `## Próximos artículos (palabras clave)\n\n${launch.keywords.map((k) => `- ${k}`).join("\n")}\n`,
  ].join("\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs", "LAUNCH.md"), md);
}

async function fillLaunchUrl(root: string, url: string) {
  const f = join(root, "docs", "LAUNCH.md");
  if (existsSync(f)) await writeFile(f, (await readFile(f, "utf8")).replaceAll("{{URL}}", url));
}
