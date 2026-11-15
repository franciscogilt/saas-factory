import "dotenv/config";
import { resolve } from "node:path";

const env = (k: string, d?: string) => process.env[k] ?? d;

export const config = {
  anthropicKey: env("ANTHROPIC_API_KEY"),
  models: {
    strategy: env("MODEL_STRATEGY", "claude-opus-5-5")!,
    engineer: env("MODEL_ENGINEER", "claude-sonnet-5-5")!,
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
