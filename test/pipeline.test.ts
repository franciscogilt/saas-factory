// Escenarios completos de la línea de montaje con un Claude Code simulado (test/fake-claude.mjs)
// y compiladores/pruebas REALES de cada stack. Los escenarios cuyo toolchain falta se saltan.
// npm test   (o: node --import tsx --test test/pipeline.test.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { factory, has, hasCompose, makeRepo, MIN, sh } from "./helpers.ts";

test("new: React + FastAPI + PostgreSQL (+ Docker Compose) con verificaciones reales", { timeout: 15 * MIN, skip: !has("python3") && "falta python3" }, async () => {
  const stack = `react + fastapi + postgresql${hasCompose() ? " + docker-compose" : ""}`;
  const r = await factory(["new", "Lista de tareas para equipos", "--stack", stack, "--yes"], { fake: "full" });
  assert.equal(r.code, 0, r.out.slice(-2000));
  assert.match(r.out, /QA ✅/);
  const dir = join(r.ws, "tareas-equipo");
  const files = sh("git ls-files", dir).stdout.split("\n");
  for (const f of ["backend/app/main.py", "backend/tests/test_tasks.py", "frontend/package.json", "CLAUDE.md", "factory.stack.json", ".gitignore"])
    assert.ok(files.includes(f), `falta en git: ${f}`);
  assert.ok(!files.some((f) => /__pycache__|\.venv|node_modules|^frontend\/dist|\.factory/.test(f)), "se versionaron archivos generados");
  assert.equal(sh("git status --porcelain", dir).stdout.trim(), "", "el repositorio debe quedar limpio");
  const stackFile = JSON.parse(readFileSync(join(dir, "factory.stack.json"), "utf8"));
  assert.deepEqual(stackFile.components.map((c: any) => c.folder).slice(0, 2), ["frontend", "backend"]);
});

test("new: stack sin paquete (Go); QA detecta la prueba que falla y la hace corregir", { timeout: 10 * MIN, skip: !has("go") && "falta go" }, async () => {
  const r = await factory(["new", "Conversor de temperaturas", "--stack", "Go con la librería estándar", "--yes"], { fake: "go", env: { ANTHROPIC_API_KEY: "sk-olvidada" } });
  assert.equal(r.code, 0, r.out.slice(-2000));
  assert.match(r.out, /QA ❌ ronda 1/);
  assert.match(r.out, /QA ✅/);
  assert.equal(sh("go test ./...", join(r.ws, "conversor")).status, 0, "go test real debe pasar");
  assert.ok(!r.log.includes("apikey=SET"), "nunca debe pasar ANTHROPIC_API_KEY a Claude Code");
  assert.match(r.log, /Bash\(go \*\)/, "el agente recibe los comandos del stack");
  assert.match(r.log, /denied=Bash\(sudo \*\)/, "y los prohibidos bloqueados");
});

test("improve: trabaja en una rama, no toca main y deja el cambio probado", { timeout: 10 * MIN, skip: !has("npm") && "falta npm" }, async () => {
  const repo = makeRepo();
  const r = await factory(["improve", repo, "Añade un endpoint de salud GET /health", "--yes"], { fake: "improve" });
  assert.equal(r.code, 0, r.out.slice(-2000));
  const branch = "factory/anade-un-endpoint-de-salud-get-health";
  assert.equal(sh("git rev-parse --abbrev-ref HEAD", repo).stdout.trim(), branch);
  assert.equal(sh("git rev-list --count main", repo).stdout.trim(), "1", "main no debe cambiar");
  assert.equal(sh(`git rev-list --count ${branch}`, repo).stdout.trim(), "2");
  assert.ok(sh(`git show --stat ${branch}`, repo).stdout.includes("src/health.test.ts"));
  assert.equal(sh("git status --porcelain", repo).stdout.trim(), "", "debe quedar limpio");
  assert.ok(!readFileSync(join(repo, ".gitignore"), "utf8").includes("Generado por la fábrica"), "no toca el .gitignore del usuario");
  assert.match(r.out, /git merge/, "explica cómo aceptar el cambio");
});

test("seguridad: rechaza stacks peligrosos, repos sucios, carpetas sin git y carpetas ocupadas", { timeout: 5 * MIN }, async () => {
  const repo = makeRepo();
  const evil = await factory(["improve", repo, "otra tarea", "--yes"], { fake: "evil" });
  assert.notEqual(evil.code, 0);
  assert.match(evil.out, /prohibido por seguridad/);
  assert.equal(sh("git branch --list 'factory/*'", repo).stdout.trim(), "", "no debe crear ramas antes de validar");

  writeFileSync(join(repo, "src", "app.ts"), "// cambio sin guardar\n", { flag: "a" });
  const dirty = await factory(["improve", repo, "tarea", "--yes"]);
  assert.match(dirty.out, /cambios sin guardar/);

  const noGit = mkdtempSync(join(tmpdir(), "nogit-"));
  assert.match((await factory(["improve", noGit, "tarea", "--yes"])).out, /no es un repositorio git/);

  const busy = mkdtempSync(join(tmpdir(), "busy-"));
  writeFileSync(join(busy, "a.txt"), "x");
  assert.match((await factory(["new", "x", "--dir", busy, "--stack", "go", "--yes"], { fake: "go" })).out, /no está vacía/);
});

test("SaaS: el modo original (build) sigue funcionando", { timeout: 15 * MIN, skip: process.env.SKIP_SAAS === "1" && "SKIP_SAAS=1" }, async () => {
  const ws = mkdtempSync(join(tmpdir(), "saas-"));
  mkdirSync(ws, { recursive: true });
  const r = await factory(["build", "Agenda para entrenadores", "--no-deploy"], { workspace: ws });
  assert.equal(r.code, 0, r.out.slice(-2000));
  assert.match(r.out, /QA ✅ build verde/);
  assert.match(r.out, /Crecimiento: ✓/);
});
