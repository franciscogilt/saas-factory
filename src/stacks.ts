// Stacks combinables: cada tecnología es un paquete en stacks/<id>/ (stack.json + CONVENTIONS.md).
// Un proyecto combina varios: --stack "angular + springboot + postgresql + docker-compose".
// Puedes añadir paquetes propios en stacks/ o en la carpeta FACTORY_STACKS_DIR.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { checkCommand, FORBIDDEN_COMMANDS } from "./tools.js";

export type Kind = "backend" | "frontend" | "fullstack" | "mobile" | "database" | "infra" | "deploy";

export interface StackSpec {
  id: string;
  name: string;
  kind: Kind;
  description?: string;
  aliases?: string[];
  /** Carpeta del componente dentro del proyecto ("." = raíz). La decide composeStack. */
  folder?: string;
  /** Plantilla inicial (opcional). */
  templateDir?: string;
  /** Cómo crearlo desde cero (instrucciones para el ingeniero). */
  scaffold?: string;
  /** Comandos exactos y no interactivos para crearlo, ejecutados dentro de su carpeta (los prueba el CI). */
  scaffoldCommands?: string[];
  install?: string;
  /** Debe pasar para dar el trabajo por bueno (compilar + pruebas). Se ejecuta dentro de `folder`. */
  check?: string;
  dev?: string;
  allowedCommands: string[];
  conventions?: string;
}

export interface ProjectStack { components: StackSpec[] }

const packDirs = () => [
  resolve(new URL("../stacks", import.meta.url).pathname),
  ...(process.env.FACTORY_STACKS_DIR ? [resolve(process.env.FACTORY_STACKS_DIR)] : []),
];

export async function listPacks(): Promise<StackSpec[]> {
  const out: StackSpec[] = [];
  for (const base of packDirs()) {
    if (!existsSync(base)) continue;
    for (const d of await readdir(base, { withFileTypes: true })) {
      const file = join(base, d.name, "stack.json");
      if (!d.isDirectory() || !existsSync(file)) continue;
      const raw = JSON.parse(await readFile(file, "utf8"));
      const spec: StackSpec = { id: d.name, allowedCommands: [], ...raw };
      if (raw.template) spec.templateDir = resolve(base, d.name, raw.template);
      const conv = resolve(base, d.name, raw.conventionsFile ?? "CONVENTIONS.md");
      if (existsSync(conv)) spec.conventions = await readFile(conv, "utf8");
      out.push(spec);
    }
  }
  return out.sort((a, b) => order(a.kind) - order(b.kind) || a.id.localeCompare(b.id));
}

const order = (k: Kind) => ["fullstack", "frontend", "mobile", "backend", "database", "infra", "deploy"].indexOf(k);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9#.]+/g, " ").trim();

/** Separa "angular + springboot, postgresql" en piezas y las busca en los paquetes. */
export async function matchPacks(text: string) {
  const packs = await listPacks();
  const tokens = text.split(/[+,/]| y | con | with /i).map((t) => t.trim()).filter(Boolean);
  const matched: StackSpec[] = [];
  const unmatched: string[] = [];
  for (const t of tokens) {
    const n = norm(t);
    const p = packs.find((p) => norm(p.id) === n || norm(p.name) === n || (p.aliases ?? []).some((a) => norm(a) === n));
    if (p) { if (!matched.some((m) => m.id === p.id)) matched.push(structuredClone(p)); }
    else unmatched.push(t);
  }
  return { matched, unmatched };
}

/** Asigna carpetas: una sola app va en la raíz; frontend + backend van en frontend/ y backend/. */
export function composeStack(components: StackSpec[]): ProjectStack {
  const apps = components.filter((c) => ["backend", "frontend", "fullstack", "mobile"].includes(c.kind));
  const used = new Set<string>();
  for (const c of components) {
    if (c.folder && c.folder !== "auto") continue;
    let f =
      c.kind === "deploy" ? "infra" :
      c.kind === "database" || c.kind === "infra" ? "." :
      apps.length <= 1 ? "." :
      c.kind === "frontend" ? "frontend" : c.kind === "backend" ? "backend" : c.kind === "mobile" ? "mobile" : c.id;
    if (f !== "." && used.has(f)) f = `${f}-${c.id}`;
    used.add(f);
    c.folder = f;
  }
  return { components };
}

export const allowedOf = (s: ProjectStack) => [...new Set(s.components.flatMap((c) => c.allowedCommands))];

const SHELLS = ["bash", "sh", "zsh", "fish", "eval", "exec", "powershell", "pwsh", "cmd", "sudo", "su"];

/**
 * Valida un stack antes de ejecutar nada en tu máquina (sobre todo si lo propuso la IA):
 * no puede permitir shells ni comandos prohibidos, y install/check/dev solo usan comandos permitidos.
 */
export function validateStack(stack: ProjectStack) {
  for (const c of stack.components) {
    if (c.folder && (c.folder.includes("..") || c.folder.startsWith("/")))
      throw new Error(`Carpeta no válida para ${c.name}: ${c.folder}`);
    for (const a of c.allowedCommands) {
      const head = a.replace(/\s*\*$/, "").trim();
      const first = head.split(/\s+/)[0];
      if (!head || SHELLS.includes(first) || FORBIDDEN_COMMANDS.some((f) => head.startsWith(f.replace(/\s*\*$/, "").trim())))
        throw new Error(`${c.name} pide permitir "${a}", que está prohibido por seguridad.`);
    }
    for (const [label, cmd] of [["instalar", c.install], ["verificar", c.check], ["arrancar", c.dev]] as const) {
      if (!cmd) continue;
      for (const part of cmd.split(/&&|\|\||;/).map((p) => p.trim()).filter(Boolean)) {
        try { checkCommand(part, c.allowedCommands); }
        catch (e: any) { throw new Error(`${c.name}: el comando para ${label} ("${part}") no es válido. ${e.message}`); }
      }
    }
  }
}

export function describeStack(stack: ProjectStack) {
  return stack.components.map((c) => [
    `• ${c.name} (${c.kind}) → ${c.folder === "." ? "raíz del proyecto" : c.folder + "/"}`,
    c.install && `    instalar:  ${c.install}`,
    c.check && `    verificar: ${c.check}`,
    c.dev && `    arrancar:  ${c.dev}`,
  ].filter(Boolean).join("\n")).join("\n") +
    `\n  Comandos que podrá ejecutar el agente: ${allowedOf(stack).map((c) => c.replace(/\s*\*$/, "")).join(", ")}`;
}

/** Texto de convenciones para los agentes. */
export function stackBrief(stack: ProjectStack) {
  return stack.components.map((c) =>
    `### ${c.name} — carpeta \`${c.folder}\`\n` +
    (c.check ? `Verificación (debe pasar): \`${c.check}\` (dentro de ${c.folder})\n` : "") +
    (c.conventions ? `\n${c.conventions.trim()}\n` : ""),
  ).join("\n");
}
