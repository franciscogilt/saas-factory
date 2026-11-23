// Paquetes cuyo toolchain no siempre está disponible: se activan con PACKS=springboot,dotnet (lo hace el CI).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { listPacks } from "../src/stacks.ts";
import { join } from "node:path";
import { factory, FIX, MIN } from "./helpers.ts";

const PACKS = (process.env.PACKS ?? "").split(",").map((p) => p.trim()).filter(Boolean);

test("paquete springboot: Maven y pruebas reales", { timeout: 20 * MIN, skip: !PACKS.includes("springboot") && "PACKS no incluye springboot" }, async () => {
  const r = await factory(["new", "API de saludos", "--stack", "spring boot", "--yes"], { fake: "springboot" });
  assert.equal(r.code, 0, r.out.slice(-3000));
  assert.match(r.out, /QA ✅/);
  assert.match(r.out, /mvn -q verify/);
});

test("paquete dotnet: build y pruebas reales", { timeout: 20 * MIN, skip: !PACKS.includes("dotnet") && "PACKS no incluye dotnet" }, async () => {
  assert.ok(existsSync(join(FIX, "dotnet", "agent1")), "el CI debe crear test/fixtures/dotnet/agent1 con los comandos del paquete");
  const r = await factory(["new", "API de inventario", "--stack", ".net con c#", "--yes"], { fake: "dotnet" });
  assert.equal(r.code, 0, r.out.slice(-3000));
  assert.match(r.out, /QA ✅/);
});

// Paquetes con comandos de creación exactos: se crean de verdad, se instalan y se verifican.
// Así se comprueba que lo que el paquete le dice al agente funciona tal cual.
const EXTRA_FILES: Record<string, Record<string, string>> = {
  // `go mod init` no crea código: añadimos lo mínimo para que haya algo que compilar y probar.
  go: {
    "cmd/api/main.go": "package main\n\nimport \"fmt\"\n\nfunc Greet(n string) string { return \"Hola, \" + n }\n\nfunc main() { fmt.Println(Greet(\"mundo\")) }\n",
    "cmd/api/main_test.go": "package main\n\nimport \"testing\"\n\nfunc TestGreet(t *testing.T) {\n\tif Greet(\"Ana\") != \"Hola, Ana\" {\n\t\tt.Fatal(\"saludo incorrecto\")\n\t}\n}\n",
  },
};

for (const pack of (await listPacks()).filter((p) => p.scaffoldCommands?.length)) {
  test(`paquete ${pack.id}: comandos de creación, instalación y verificación reales`, { timeout: 20 * MIN, skip: !PACKS.includes(pack.id) && `PACKS no incluye ${pack.id}` }, () => {
    const dir = mkdtempSync(join(tmpdir(), `pack-${pack.id}-`));
    const run = (cmd: string, what: string) => {
      const r = spawnSync("sh", ["-c", cmd], { cwd: dir, encoding: "utf8", env: { ...process.env, CI: "1" }, timeout: 15 * MIN });
      assert.equal(r.status, 0, `${what} falló (\`${cmd}\`):\n${(r.stdout + r.stderr).slice(-3000)}`);
    };
    for (const c of pack.scaffoldCommands!) run(c, "crear");
    for (const [f, body] of Object.entries(EXTRA_FILES[pack.id] ?? {})) {
      mkdirSync(join(dir, f, ".."), { recursive: true });
      writeFileSync(join(dir, f), body);
    }
    if (pack.install) run(pack.install, "instalar");
    run(pack.check!, "verificar");
  });
}
