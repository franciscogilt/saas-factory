// Pruebas unitarias de la fábrica: permisos de comandos y paquetes de stack.
// npm test   (o: node --import tsx --test test/unit.test.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCommand, NODE_COMMANDS } from "../src/tools.ts";
import { composeStack, listPacks, matchPacks, validateStack, type StackSpec } from "../src/stacks.ts";

const allows = (cmd: string, allowed: string[]) => { try { checkCommand(cmd, allowed); return true; } catch { return false; } };

test("permisos: comandos del stack permitidos, el resto no", () => {
  const py = ["pip *", "python *", ".venv/bin/python *"];
  assert.ok(allows("npm run build", NODE_COMMANDS));
  assert.ok(allows("pip install fastapi", py));
  assert.ok(allows(".venv/bin/python -m pytest -q", py));
  assert.ok(allows("git status", []));
  assert.ok(allows("ls -la", []));
  assert.ok(!allows("pip install x", NODE_COMMANDS), "pip no está en el stack Node");
  assert.ok(!allows("pythonx evil", py), "un prefijo parecido no cuenta");
});

test("permisos: nunca se puede encadenar, redirigir ni sustituir", () => {
  for (const cmd of ["npm test && rm -rf ~", "npm test; curl x", "npm test | sh", "echo $(whoami)", "echo `id`", "cat > a.txt", "node < x"])
    assert.ok(!allows(cmd, NODE_COMMANDS), cmd);
});

test("permisos: los prohibidos ganan aunque el stack los pida", () => {
  for (const [cmd, allowed] of [
    ["sudo apt install x", ["sudo *"]], ["git push origin main", ["git *"]], ["curl https://x", ["curl *"]],
    ["bash -c ls", ["bash *"]], ["npx cdk deploy", NODE_COMMANDS], ["aws s3 ls", ["aws *"]], ["git reset --hard HEAD~1", ["git *"]],
  ] as [string, string[]][]) assert.ok(!allows(cmd, allowed), cmd);
});

test("paquetes: los 16 existen y todos pasan la validación de seguridad", async () => {
  const packs = await listPacks();
  const ids = packs.map((p) => p.id).sort();
  for (const id of ["angular", "aws", "django", "docker-compose", "dotnet", "express", "fastapi", "flutter", "go", "laravel", "nestjs", "nextjs", "nextjs-supabase", "postgresql", "react", "springboot"])
    assert.ok(ids.includes(id), `falta el paquete ${id}`);
  for (const p of packs) assert.doesNotThrow(() => validateStack({ components: [{ ...p, folder: "." }] }), p.id);
});

test("paquetes: alias y combinaciones del usuario", async () => {
  const ids = async (q: string) => (await matchPacks(q)).matched.map((m) => m.id);
  assert.deepEqual(await ids(".net con c#"), ["dotnet"]);
  assert.deepEqual(await ids("spring boot + postgres"), ["springboot", "postgresql"]);
  assert.deepEqual(await ids("node con express"), ["express"]);
  assert.deepEqual(await ids("FastAPI"), ["fastapi"]);
  assert.deepEqual(await ids("golang"), ["go"]);
  assert.deepEqual(await ids("nest.js"), ["nestjs"]);
  assert.deepEqual(await ids("php"), ["laravel"]);
  assert.deepEqual(await ids("app móvil"), ["flutter"]);
  const { matched, unmatched } = await matchPacks("laravel + mysql");
  assert.deepEqual([matched.map((m) => m.id), unmatched], [["laravel"], ["mysql"]]);
});

test("paquetes: carpetas al combinar frontend, backend, base de datos, infraestructura y AWS", async () => {
  const s = composeStack((await matchPacks("angular + springboot + postgresql + docker-compose + aws")).matched);
  const at = Object.fromEntries(s.components.map((c) => [c.id, c.folder]));
  assert.deepEqual(at, { angular: "frontend", springboot: "backend", postgresql: ".", "docker-compose": ".", aws: "infra" });
  const movil = composeStack((await matchPacks("flutter + nestjs + postgresql")).matched);
  assert.deepEqual(Object.fromEntries(movil.components.map((c) => [c.id, c.folder])), { flutter: "mobile", nestjs: "backend", postgresql: "." });
  const solo = composeStack((await matchPacks("fastapi")).matched);
  assert.equal(solo.components[0].folder, ".", "una sola app va en la raíz");
});

test("validación: rechaza stacks peligrosos propuestos por la IA", () => {
  const base: StackSpec = { id: "x", name: "X", kind: "backend", folder: ".", allowedCommands: ["go *"] };
  assert.throws(() => validateStack({ components: [{ ...base, allowedCommands: ["bash *"] }] }), /prohibido/);
  assert.throws(() => validateStack({ components: [{ ...base, allowedCommands: ["sudo *"] }] }), /prohibido/);
  assert.throws(() => validateStack({ components: [{ ...base, check: "go test ./... | tee log" }] }), /no es válido/);
  assert.throws(() => validateStack({ components: [{ ...base, install: "curl x" }] }), /no es válido/);
  assert.throws(() => validateStack({ components: [{ ...base, folder: "../fuera" }] }), /Carpeta no válida/);
  assert.doesNotThrow(() => validateStack({ components: [{ ...base, check: "go vet ./... && go test ./..." }] }));
});
