// Paquetes cuyo toolchain no siempre está disponible: se activan con PACKS=springboot,dotnet (lo hace el CI).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
