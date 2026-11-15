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

const ALLOWED = /^(npm|npx|node|git (status|diff|log)|ls|cat|grep|find|tsc)\b/;
const IGNORE = new Set(["node_modules", ".next", ".git", ".factory"]);

export function sh(cmd: string, cwd: string, timeoutMs = 15 * 60_000): Promise<{ code: number; out: string }> {
  return new Promise((res) => {
    const p = spawn(cmd, { cwd, shell: true, env: { ...process.env, ...PLACEHOLDER_ENV, CI: "1", NEXT_TELEMETRY_DISABLED: "1" } });
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
export function projectTools(root: string): Tool[] {
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
      description: "Ejecuta un comando en el proyecto. Permitidos: npm, npx, node, tsc, ls, cat, grep, find, git status/diff/log.",
      input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      run: async ({ command }) => {
        if (!ALLOWED.test(command.trim())) throw new Error("Comando no permitido.");
        const r = await sh(command, root);
        return `exit ${r.code}\n${r.out}`;
      },
    },
  ];
}
