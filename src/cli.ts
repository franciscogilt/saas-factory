import { Command } from "commander";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";
import { Budget } from "./llm.js";
import { ideate, type Idea } from "./agents.js";
import { buildSaaS, resume } from "./pipeline.js";
import { loadState } from "./state.js";
import { deployAll } from "./deploy.js";
import { logger, projectDir, saveState } from "./state.js";
import { smokeTest } from "./smoke.js";
import { startDashboard } from "./dashboard.js";
import { doctor } from "./doctor.js";

const program = new Command()
  .name("factory")
  .description("🏭 Fábrica de software autónoma: de idea a SaaS desplegado.");

program
  .command("ideate")
  .description("Genera ideas de SaaS para un nicho y las guarda en un archivo JSON")
  .argument("<nicho>", 'ej: "clínicas dentales en Latinoamérica"')
  .option("-n, --count <n>", "cuántas ideas", "10")
  .option("-o, --out <file>", "archivo de salida", "ideas.json")
  .action(async (niche, o) => {
    const ideas = await ideate(niche, Number(o.count), new Budget(config.maxTokensPerProject));
    await writeFile(o.out, JSON.stringify(ideas, null, 2));
    ideas.forEach((i, k) => console.log(`${k + 1}. [${i.score}/10] ${i.name} — ${i.idea}`));
    console.log(`\nGuardadas en ${o.out}. Construye con: factory batch ${o.out} --top 3`);
  });

program
  .command("build")
  .description("Construye (y despliega) un SaaS a partir de una idea")
  .argument("<idea>", "descripción de la idea")
  .option("--no-deploy", "solo generar y compilar, sin publicar")
  .action(async (idea, o) => { await buildSaaS(idea, { deploy: o.deploy }); });

program
  .command("batch")
  .description("Construye muchos SaaS desde un archivo de ideas (JSON de `ideate` o .txt con una idea por línea)")
  .argument("<file>")
  .option("--top <n>", "solo las N mejores ideas")
  .option("--no-deploy", "solo generar y compilar")
  .action(async (file, o) => {
    const raw = await readFile(file, "utf8");
    let ideas: string[] = file.endsWith(".json")
      ? (JSON.parse(raw) as Idea[]).sort((a, b) => b.score - a.score).map((i) => `${i.name}: ${i.idea}. Cliente: ${i.targetCustomer}`)
      : raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (o.top) ideas = ideas.slice(0, Number(o.top));
    await runPool(ideas, o.deploy);
  });

program
  .command("auto")
  .description("Modo 100% autónomo: idea → construcción → despliegue de N SaaS para un nicho")
  .argument("<nicho>")
  .option("-n, --count <n>", "cuántos SaaS lanzar", "3")
  .option("--no-deploy")
  .action(async (niche, o) => {
    const n = Number(o.count);
    const ideas = await ideate(niche, n * 3, new Budget(config.maxTokensPerProject));
    const best = ideas.sort((a, b) => b.score - a.score).slice(0, n);
    console.log("🏭 Ideas elegidas:\n" + best.map((i) => `  • ${i.name} (${i.score}/10)`).join("\n"));
    await runPool(best.map((i) => `${i.name}: ${i.idea}. Cliente: ${i.targetCustomer}`), o.deploy);
  });

program
  .command("resume")
  .description("Retoma un SaaS desde la etapa donde se detuvo")
  .argument("<slug>")
  .option("--no-deploy")
  .action(async (slug, o) => { await resume(slug, { deploy: o.deploy }); });

program
  .command("deploy")
  .description("Despliega un SaaS ya construido")
  .argument("<slug>")
  .action(async (slug) => {
    const s = await loadState(slug);
    if (!s) throw new Error("No existe ese proyecto");
    const log = logger(slug);
    await deployAll(s, projectDir(slug), log);
    s.stage = (await smokeTest(s, log)) ? "done" : "verify";
    await saveState(s);
  });

program
  .command("status")
  .description("Estado de todos los SaaS de la fábrica")
  .action(async () => {
    if (!existsSync(config.workspaceDir)) return console.log("Aún no hay proyectos.");
    const rows = [];
    for (const d of await readdir(config.workspaceDir)) {
      const s = await loadState(d);
      if (s) rows.push({
        slug: s.slug,
        etapa: s.error ? `❌ ${s.stage}` : s.stage,
        tareas: `${s.doneTasks.length}/${s.tasks?.length ?? "?"}`,
        tokens: `${(s.tokensUsed / 1e6).toFixed(2)}M`,
        url: s.deploy.url ?? "",
      });
    }
    console.table(rows);
  });

program
  .command("report")
  .description("Informe en Markdown de todos los SaaS (lo usa GitHub Actions)")
  .action(async () => {
    if (!existsSync(config.workspaceDir)) return console.log("Sin proyectos en esta ejecución.");
    const lines = ["## 🏭 SaaS Factory — informe", "", "| SaaS | Estado | Enlace | Tokens |", "|---|---|---|---|"];
    let live = 0;
    for (const d of await readdir(config.workspaceDir)) {
      const s = await loadState(d);
      if (!s) continue;
      if (s.stage === "done") live++;
      const st = s.error ? `❌ ${s.stage}: ${s.error.slice(0, 80)}` : s.stage === "done" ? "✅ en vivo" : `⏳ ${s.stage}`;
      lines.push(`| **${s.prd?.name ?? s.slug}**<br>${s.prd?.tagline ?? ""} | ${st} | ${s.deploy.url ?? "—"} | ${(s.tokensUsed / 1e6).toFixed(2)}M |`);
    }
    lines.push("", `**${live}** SaaS nuevos en vivo. Los kits de lanzamiento (docs/LAUNCH.md) están en cada repositorio.`);
    console.log(lines.join("\n"));
  });

program
  .command("doctor")
  .description("Comprueba que todas las claves están bien configuradas")
  .option("--ai-only", "solo la clave de Claude (para el modo de prueba sin publicar)")
  .action(async (o) => { if (!(await doctor(o.aiOnly))) process.exit(1); });

program
  .command("dashboard")
  .description("Abre un panel web en tiempo real con todos los SaaS de la fábrica")
  .option("-p, --port <n>", "puerto", "4000")
  .action((o) => startDashboard(Number(o.port)));

async function runPool(ideas: string[], deploy: boolean) {
  const results: { idea: string; ok: boolean; info: string }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < ideas.length) {
      const idea = ideas[i++];
      try {
        const s = await buildSaaS(idea, { deploy });
        results.push({ idea, ok: true, info: s.deploy.url ?? join(config.workspaceDir, s.slug) });
      } catch (e: any) {
        results.push({ idea, ok: false, info: e.message }); // un fallo no detiene la fábrica
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(config.concurrency, ideas.length) }, worker));
  console.log("\n🏭 RESUMEN");
  for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.idea.split(":")[0]} → ${r.info}`);
}

program.parseAsync().catch((e) => { console.error("💥", e.message); process.exit(1); });
