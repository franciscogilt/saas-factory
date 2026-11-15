import "dotenv/config";
import { resolve } from "node:path";

const env = (k: string, d?: string) => process.env[k] ?? d;

/**
 * Motor de IA:
 *  - "claude-code" (por defecto): usa tu sesión de Claude Code (Pro/Max/Team) con `claude -p`. Sin clave de API.
 *    En tu computadora basta con haber hecho `claude` → login. En GitHub Actions usa CLAUDE_CODE_OAUTH_TOKEN
 *    (generado con `claude setup-token`).
 *  - "api": usa ANTHROPIC_API_KEY y se cobra por tokens en la Claude Console.
 */
// Siempre tu sesión de Claude Code, salvo que pidas ENGINE=api expresamente.
const engine = (env("ENGINE") === "api" ? "api" : "claude-code") as "claude-code" | "api";

export const config = {
  engine,
  anthropicKey: env("ANTHROPIC_API_KEY"),
  claudeBin: env("CLAUDE_BIN", "claude")!,
  // Con claude-code, si no defines modelos se usa el predeterminado de tu plan.
  models: {
    strategy: env("MODEL_STRATEGY", engine === "api" ? "claude-opus-5-5" : "")!,
    engineer: env("MODEL_ENGINEER", engine === "api" ? "claude-sonnet-5-5" : "")!,
  },
  maxTokensPerProject: Number(env("MAX_TOKENS_PER_PROJECT", "8000000")),
  maxQaRounds: Number(env("MAX_QA_ROUNDS", "8")),
  concurrency: Number(env("CONCURRENCY", "2")),
  workspaceDir: resolve(env("WORKSPACE_DIR", "./projects")!),
  templateDir: resolve(new URL("../template", import.meta.url).pathname),
  github: {
    token: env("GITHUB_TOKEN"),
    owner: env("GITHUB_OWNER"),
    private: env("GITHUB_PRIVATE", "true") === "true",
  },
  vercel: { token: env("VERCEL_TOKEN"), teamId: env("VERCEL_TEAM_ID") || undefined },
  supabase: {
    token: env("SUPABASE_ACCESS_TOKEN"),
    orgId: env("SUPABASE_ORG_ID"),
    region: env("SUPABASE_REGION", "us-east-1")!,
  },
  stripe: { key: env("STRIPE_SECRET_KEY") },
};

export function require_(keys: [string, string | undefined][]) {
  const missing = keys.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Faltan variables en .env: ${missing.join(", ")}`);
}
