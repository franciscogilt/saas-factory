// Motor "claude-code": ejecuta los agentes con la CLI de Claude Code (`claude -p`) usando tu sesión iniciada
// (suscripción Pro/Max/Team). No necesita ANTHROPIC_API_KEY.
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "./config.js";
import { PLACEHOLDER_ENV } from "./tools.js";
import type { Budget } from "./llm.js";

type CCResult = {
  type: string;
  is_error: boolean;
  result: string;
  structured_output?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number };
  terminal_reason?: string;
};

/** Herramientas que el ingeniero puede usar sin pedir permiso: archivos del proyecto y comandos de Node. */
const ENGINEER_TOOLS = [
  "Read", "Edit", "Write", "Glob", "Grep",
  "Bash(npm *)", "Bash(npx *)", "Bash(node *)", "Bash(tsc *)",
  "Bash(ls *)", "Bash(cat *)", "Bash(grep *)", "Bash(find *)", "Bash(git status*)", "Bash(git diff*)",
];

const TIMEOUT_MS = 60 * 60_000;

function run(args: string[], prompt: string, cwd: string): Promise<CCResult> {
  return new Promise((resolve, reject) => {
    // Sin ANTHROPIC_API_KEY: si estuviera, Claude Code la usaría y cobraría por API en vez de usar tu plan.
    const { ANTHROPIC_API_KEY: _drop, ...env } = process.env;
    const p = spawn(config.claudeBin, ["-p", "--output-format", "json", ...args], {
      cwd,
      env: { ...env, ...PLACEHOLDER_ENV, CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => p.kill("SIGKILL"), TIMEOUT_MS);
    p.on("error", (e: NodeJS.ErrnoException) =>
      reject(new Error(e.code === "ENOENT"
        ? "No encuentro Claude Code. Instálalo con `npm i -g @anthropic-ai/claude-code` y entra con `claude` (login con tu plan)."
        : e.message)));
    p.on("close", (code) => {
      clearTimeout(timer);
      const line = out.trim().split("\n").reverse().find((l) => l.startsWith("{"));
      if (!line) return reject(new Error(`Claude Code terminó sin respuesta (código ${code}). ${err.slice(-500)}`));
      try { resolve(JSON.parse(line) as CCResult); } catch { reject(new Error(`Respuesta no válida de Claude Code: ${line.slice(0, 300)}`)); }
    });
    p.stdin.end(prompt);
  });
}

function check(r: CCResult, budget: Budget) {
  const u = r.usage ?? {};
  budget.add({ input_tokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), output_tokens: u.output_tokens ?? 0 });
  if (!r.is_error) return;
  const msg = r.result ?? "error desconocido";
  if (/limit|límite|quota|usage/i.test(msg))
    throw new Error(`Llegaste al límite de uso de tu plan de Claude (${msg}). Cuando se reinicie, ejecuta \`factory resume <slug>\`: retoma donde quedó.`);
  if (/auth|log ?in|credential/i.test(msg))
    throw new Error(`Claude Code no tiene sesión iniciada (${msg}). Ejecuta \`claude\` y entra con tu plan; en GitHub Actions configura CLAUDE_CODE_OAUTH_TOKEN.`);
  throw new Error(`Claude Code: ${msg}`);
}

const modelArgs = (m: string) => (m ? ["--model", m] : []);

/** Agente con herramientas trabajando dentro de la carpeta del proyecto. */
export async function ccAgent(o: { model: string; system: string; prompt: string; cwd: string; budget: Budget; log?: (m: string) => void }) {
  o.log?.("  ↳ Claude Code trabajando en el proyecto…");
  const r = await run(
    ["--append-system-prompt", o.system, "--permission-mode", "acceptEdits", "--allowedTools", ENGINEER_TOOLS.join(","), ...modelArgs(o.model)],
    o.prompt, o.cwd,
  );
  check(r, o.budget);
  return r.result.trim();
}

/** Respuesta JSON validada contra un esquema, sin herramientas. */
export async function ccJSON<T>(o: { model: string; system: string; prompt: string; schema: Record<string, unknown>; budget: Budget }): Promise<T> {
  const cwd = await mkdtemp(join(tmpdir(), "factory-"));
  const r = await run(
    ["--append-system-prompt", o.system, "--json-schema", JSON.stringify(o.schema), "--tools", "", ...modelArgs(o.model)],
    o.prompt, cwd,
  );
  check(r, o.budget);
  if (r.structured_output && typeof r.structured_output === "object") return r.structured_output as T;
  // Plan B: extraer el JSON del texto
  const text = r.result.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Claude Code no devolvió JSON.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/** Comprueba que la CLI existe y que la sesión funciona. */
export async function ccPing(budget: Budget): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "factory-"));
  const r = await run(["--tools", ""], "Responde exactamente con la palabra: ok", cwd);
  check(r, budget);
  return r.result.trim();
}
