import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { Tool } from "./llm.js";

/** Variables falsas para que `next build` funcione sin servicios reales. */
export const PLACEHOLDER_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder",
  STRIPE_SECRET_KEY: "sk_test_placeholder",
  STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

/** Comandos que el agente puede ejecutar siempre (lectura y estado de git). */
export const BASE_COMMANDS = ["ls *", "cat *", "grep *", "find *", "git status*", "git diff*", "git log*"];
/** Comandos del stack Node, el que usa la plantilla SaaS. */
export const NODE_COMMANDS = ["npm *", "npx *", "node *", "tsc *"];
/** Nunca permitidos, declare lo que declare un stack. */
export const FORBIDDEN_COMMANDS = [
  "sudo *", "su *", "git push*", "git reset --hard*", "git clean*", "git checkout main*", "git checkout master*",
  "rm -rf /*", "rm -rf ~*", "curl *", "wget *", "ssh *", "scp *", "bash *", "sh *", "zsh *", "eval *",
  "cdk deploy*", "npx cdk deploy*", "aws *", "terraform apply*", "docker push*",
];

// Carpetas pesadas o generadas que no se listan ni se envían al modelo, en cualquier stack.
export const IGNORE = new Set([
  "node_modules", ".next", ".git", ".factory", "dist", "build", "out", "coverage",
  ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
  "vendor", "target", ".gradle", ".dart_tool", "Pods", ".idea", ".vscode",
]);

/** "pip *" → "pip"; "git status*" → "git status". */
const prefixOf = (pattern: string) => pattern.replace(/\s*\*$/, "").trim();
const matches = (cmd: string, pattern: string) => {
  const p = prefixOf(pattern);
  return cmd === p || cmd.startsWith(p + " ") || (pattern.endsWith("*") && !pattern.endsWith(" *") && cmd.startsWith(p));
};

/** Un comando del agente: uno solo, sin encadenar ni redirigir, y dentro de lo permitido. */
export function checkCommand(command: string, allowed: string[]) {
  const cmd = command.trim();
  if (/[;&|`<>]|\$\(/.test(cmd)) throw new Error("Ejecuta un solo comando, sin ; && | ` $() ni redirecciones.");
  if (FORBIDDEN_COMMANDS.some((p) => matches(cmd, p))) throw new Error("Comando prohibido por seguridad.");
  if (![...BASE_COMMANDS, ...allowed].some((p) => matches(cmd, p)))
    throw new Error(`Comando no permitido. Permitidos: ${[...BASE_COMMANDS, ...allowed].map(prefixOf).join(", ")}.`);
}

export function sh(cmd: string, cwd: string, timeoutMs = 15 * 60_000, extraEnv: Record<string, string> = {}): Promise<{ code: number; out: string }> {
  return new Promise((res) => {
    const p = spawn(cmd, { cwd, shell: true, env: { ...process.env, ...PLACEHOLDER_ENV, CI: "1", NEXT_TELEMETRY_DISABLED: "1", ...extraEnv } });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => { p.kill("SIGKILL"); out += "\n[timeout]"; }, timeoutMs);
    p.on("close", (code) => { clearTimeout(t); res({ code: code ?? 1, out }); });
  });
}

export async function listTree(root: string, dir = root, acc: string[] = []): Promise<string[]> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await listTree(root, p, acc);
    else acc.push(relative(root, p));
  }
  return acc;
}

/** Herramientas del programador, encerradas en la carpeta del proyecto. */
export function projectTools(root: string, allowed: string[] = NODE_COMMANDS): Tool[] {
  const safe = (p: string) => {
    const full = resolve(root, p);
    if (!full.startsWith(resolve(root))) throw new Error("Ruta fuera del proyecto");
    return full;
  };
  return [
    {
      name: "list_files",
      description: "Lista todos los archivos del proyecto (sin node_modules).",
      input_schema: { type: "object", properties: {} },
      run: async () => (await listTree(root)).join("\n"),
    },
    {
      name: "read_file",
      description: "Lee un archivo del proyecto.",
      input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      run: async ({ path }) => readFile(safe(path), "utf8"),
    },
    {
      name: "write_file",
      description: "Crea o sobrescribe un archivo completo.",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
      run: async ({ path, content }) => {
        const f = safe(path);
        await mkdir(dirname(f), { recursive: true });
        await writeFile(f, content);
        return `Escrito ${path} (${content.length} chars)`;
      },
    },
    {
      name: "edit_file",
      description: "Reemplaza un fragmento exacto y único de un archivo.",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" }, old: { type: "string" }, new: { type: "string" } },
        required: ["path", "old", "new"],
      },
      run: async ({ path, old, new: nu }) => {
        const f = safe(path);
        const src = await readFile(f, "utf8");
        const n = src.split(old).length - 1;
        if (n !== 1) throw new Error(`El fragmento aparece ${n} veces; debe ser único.`);
        await writeFile(f, src.replace(old, nu));
        return `Editado ${path}`;
      },
    },
    {
      name: "delete_file",
      description: "Borra un archivo del proyecto.",
      input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      run: async ({ path }) => { await rm(safe(path)); return `Borrado ${path}`; },
    },
    {
      name: "run_command",
      description: `Ejecuta UN comando en el proyecto (sin encadenar). Permitidos: ${[...BASE_COMMANDS, ...allowed].map(prefixOf).join(", ")}.`,
      input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      run: async ({ command }) => {
        checkCommand(command, allowed);
        const r = await sh(command, root);
        return `exit ${r.code}\n${r.out}`;
      },
    },
  ];
}
