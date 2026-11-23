// Utilidades compartidas por las pruebas de la fábrica.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "..");
export const FIX = join(ROOT, "test", "fixtures");
export const has = (cmd: string) => spawnSync("sh", ["-c", `command -v ${cmd}`]).status === 0;
export const hasCompose = () => has("docker") && spawnSync("docker", ["compose", "version"]).status === 0;
export const sh = (cmd: string, cwd: string) => spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" });

export function factory(args: string[], opts: { fake?: string; workspace?: string; env?: Record<string, string> } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), "fx-"));
  const env: NodeJS.ProcessEnv = {
    ...process.env, ENGINE: "claude-code", CLAUDE_BIN: join(ROOT, "test", "fake-claude.mjs"),
    WORKSPACE_DIR: opts.workspace ?? join(tmp, "ws"), FAKE_COUNT: join(tmp, "count"), FAKE_LOG: join(tmp, "calls.log"),
    ...(opts.fake ? { FAKE_DIR: join(FIX, opts.fake) } : {}), ...opts.env,
  };
  if (!opts.env?.ANTHROPIC_API_KEY) delete env.ANTHROPIC_API_KEY;
  if (!opts.fake) delete env.FAKE_DIR;
  return new Promise<{ code: number; out: string; log: string; ws: string }>((res) => {
    const p = spawn(process.execPath, ["--import", "tsx", join(ROOT, "src", "cli.ts"), ...args], { cwd: ROOT, env });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => res({ code: code ?? 1, out, ws: env.WORKSPACE_DIR!, log: existsSync(env.FAKE_LOG!) ? readFileSync(env.FAKE_LOG!, "utf8") : "" }));
  });
}

export function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "repo-"));
  cpSync(join(FIX, "improve", "repo"), dir, { recursive: true });
  renameSync(join(dir, "gitignore.txt"), join(dir, ".gitignore"));
  sh("git init -q -b main && git add -A && git -c user.name=Test -c user.email=t@t commit -qm inicial", dir);
  return dir;
}

export const MIN = 60_000;

