import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";

export type Stage = "prd" | "plan" | "scaffold" | "build" | "review" | "qa" | "deploy" | "verify" | "done" | "failed";

export interface Plan { id: string; name: string; priceUsd: number; features: string[] }
export interface PRD {
  name: string;
  slug: string;
  tagline: string;
  problem: string;
  targetCustomer: string;
  valueProposition: string;
  coreFeatures: { title: string; description: string }[];
  plans: Plan[];
  dataModel: string;
  landingCopy: { headline: string; subheadline: string; cta: string };
}
export interface Task { id: string; title: string; details: string; files: string[] }

export interface ProjectState {
  slug: string;
  idea: string;
  stage: Stage;
  tokensUsed: number;
  prd?: PRD;
  tasks?: Task[];
  doneTasks: string[];
  qaRounds: number;
  deploy: {
    repo?: string; repoId?: number;
    supabaseRef?: string; supabaseUrl?: string; anonKey?: string; serviceKey?: string;
    prices?: Record<string, string>;
    vercelProjectId?: string; url?: string; webhookSecret?: string;
  };
  smoke?: { path: string; status: number; ok: boolean }[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const projectDir = (slug: string) => join(config.workspaceDir, slug);
const stateFile = (slug: string) => join(projectDir(slug), ".factory", "state.json");

export async function loadState(slug: string): Promise<ProjectState | null> {
  if (!existsSync(stateFile(slug))) return null;
  return JSON.parse(await readFile(stateFile(slug), "utf8"));
}

export async function saveState(s: ProjectState) {
  s.updatedAt = new Date().toISOString();
  await mkdir(join(projectDir(s.slug), ".factory"), { recursive: true });
  await writeFile(stateFile(s.slug), JSON.stringify(s, null, 2));
}

export function newState(slug: string, idea: string): ProjectState {
  const now = new Date().toISOString();
  return { slug, idea, stage: "prd", tokensUsed: 0, doneTasks: [], qaRounds: 0, deploy: {}, createdAt: now, updatedAt: now };
}

export function logger(slug: string) {
  const file = join(projectDir(slug), ".factory", "log.txt");
  return (msg: string) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] [${slug}] ${msg}`;
    console.log(line);
    if (slug === "nuevo") return; // aún sin carpeta de proyecto
    mkdir(join(projectDir(slug), ".factory"), { recursive: true })
      .then(() => appendFile(file, line + "\n"))
      .catch(() => {});
  };
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
