#!/usr/bin/env node
// Claude Code simulado. Con FAKE_DIR responde según un escenario:
//   brief.json / components.json / tasks.json  → respuestas estructuradas
//   agent1/, agent2/, …                        → archivos que "escribe" el agente en cada llamada sucesiva
import { appendFileSync, cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
let prompt = "";
for await (const c of process.stdin) prompt += c;
const log = (m) => appendFileSync(process.env.FAKE_LOG ?? "/tmp/fake-claude.log", m + "\n");
const usage = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0 };
const out = (o) => console.log(JSON.stringify({ type: "result", is_error: false, usage, ...o }));
const FAKE = process.env.FAKE_DIR;

function sample(schema, key = "") {
  switch (schema?.type) {
    case "object": return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([k, v]) => [k, sample(v, k)]));
    case "array": return [sample(schema.items, key), sample(schema.items, key)].map((x, i) => (typeof x === "object" && x && "id" in x ? { ...x, id: i ? "pro" : "free", ...(key === "plans" ? { priceUsd: i ? 9 : 0 } : {}) } : x));
    case "number": return 7;
    case "string": return key === "content" ? "Párrafo de prueba.\n\n## Subtítulo\n\nOtro párrafo." : key === "slug" ? "saas-de-prueba" : `Texto de prueba (${key})`;
    default: return null;
  }
}

const schema = get("--json-schema");
if (schema) {
  const props = JSON.parse(schema).properties ?? {};
  const name = props.acceptance ? "brief" : props.components ? "components" : props.tasks ? "tasks" : null;
  log(`json: ${name ?? "?"}`);
  const f = FAKE && name && join(FAKE, `${name}.json`);
  out({ result: "", structured_output: f && existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : sample(JSON.parse(schema)) });
} else if (args.includes("--allowedTools")) {
  const counter = process.env.FAKE_COUNT ?? "/tmp/fake-claude.count";
  const n = (existsSync(counter) ? Number(readFileSync(counter, "utf8")) : 0) + 1;
  writeFileSync(counter, String(n));
  const step = FAKE && join(FAKE, `agent${n}`);
  const allowed = get("--allowedTools"), denied = get("--disallowedTools");
  log(`agent${n}: ${prompt.split("\n").find((l) => /TAREA|Revisa|verificaciones fallan/.test(l))?.slice(0, 70) ?? prompt.slice(0, 60)} | allowed=${allowed} | denied=${denied?.slice(0, 40)}…`);
  if (step && existsSync(step)) { cpSync(step, process.cwd(), { recursive: true }); out({ result: `Hecho (simulado, paso ${n}).` }); }
  else { if (!FAKE) appendFileSync("AGENT_LOG.md", `- ${prompt.split("\n")[0].slice(0, 80)}\n`); out({ result: "Revisado, sin cambios (simulado)." }); }
} else out({ result: "ok" });
