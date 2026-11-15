import { Octokit } from "@octokit/rest";
import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config, require_ } from "./config.js";
import { sh } from "./tools.js";
import { saveState, type ProjectState } from "./state.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function http(base: string, token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

// ─────────────────────────── GitHub ───────────────────────────
async function github(s: ProjectState, root: string, log: (m: string) => void) {
  const gh = new Octokit({ auth: config.github.token });
  const name = s.slug;
  if (!s.deploy.repo) {
    log("GitHub: creando repositorio…");
    const me = await gh.users.getAuthenticated();
    const isUser = me.data.login.toLowerCase() === config.github.owner!.toLowerCase();
    const r = isUser
      ? await gh.repos.createForAuthenticatedUser({ name, private: config.github.private, auto_init: false })
      : await gh.repos.createInOrg({ org: config.github.owner!, name, private: config.github.private });
    s.deploy.repo = r.data.full_name;
    s.deploy.repoId = r.data.id;
    await saveState(s);
  }
  log(`GitHub: subiendo código a ${s.deploy.repo}…`);
  const remote = `https://x-access-token:${config.github.token}@github.com/${s.deploy.repo}.git`;
  const cmds = [
    "git init -q -b main 2>/dev/null || true",
    'git config user.email "factory@saas.local"',
    'git config user.name "SaaS Factory"',
    "git add -A",
    'git commit -qm "build: generado por SaaS Factory" || true',
    `git push -q -f ${remote} main`,
  ];
  for (const c of cmds) {
    const r = await sh(c, root);
    if (r.code !== 0) throw new Error(`git falló (${c.split(" ").slice(0, 2).join(" ")}): ${r.out.replaceAll(config.github.token!, "***")}`);
  }
}

// ─────────────────────────── Supabase ───────────────────────────
const SB = "https://api.supabase.com/v1";
async function supabase(s: ProjectState, root: string, log: (m: string) => void) {
  const t = config.supabase.token!;
  if (!s.deploy.supabaseRef) {
    log("Supabase: creando proyecto (tarda 1-3 min)…");
    const p = await http(SB, t, "POST", "/projects", {
      name: s.slug,
      organization_id: config.supabase.orgId,
      region: config.supabase.region,
      db_pass: randomBytes(18).toString("base64url"),
    });
    s.deploy.supabaseRef = p.id ?? p.ref;
    await saveState(s);
  }
  const ref = s.deploy.supabaseRef!;
  for (let i = 0; i < 60; i++) {
    const p = await http(SB, t, "GET", `/projects/${ref}`);
    if (p.status === "ACTIVE_HEALTHY") break;
    await sleep(10_000);
  }
  const keys: { name: string; api_key: string }[] = await http(SB, t, "GET", `/projects/${ref}/api-keys`);
  s.deploy.supabaseUrl = `https://${ref}.supabase.co`;
  s.deploy.anonKey = keys.find((k) => k.name === "anon")?.api_key;
  s.deploy.serviceKey = keys.find((k) => k.name === "service_role")?.api_key;

  log("Supabase: aplicando migraciones…");
  const dir = join(root, "supabase", "migrations");
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    await http(SB, t, "POST", `/projects/${ref}/database/query`, { query: await readFile(join(dir, f), "utf8") });
    log(`  ✓ ${f}`);
  }
  await saveState(s);
}

async function supabaseAuthUrls(s: ProjectState) {
  await http(SB, config.supabase.token!, "PATCH", `/projects/${s.deploy.supabaseRef}/config/auth`, {
    site_url: s.deploy.url,
    uri_allow_list: `${s.deploy.url}/**,http://localhost:3000/**`,
  });
}

// ─────────────────────────── Stripe ───────────────────────────
async function stripePrices(s: ProjectState, log: (m: string) => void) {
  if (s.deploy.prices) return;
  const stripe = new Stripe(config.stripe.key!);
  const prices: Record<string, string> = {};
  for (const plan of s.prd!.plans.filter((p) => p.priceUsd > 0)) {
    const product = await stripe.products.create({ name: `${s.prd!.name} — ${plan.name}`, metadata: { factory_slug: s.slug } });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.priceUsd * 100),
      currency: "usd",
      recurring: { interval: "month" },
    });
    prices[plan.id] = price.id;
    log(`Stripe: plan ${plan.name} $${plan.priceUsd}/mes → ${price.id}`);
  }
  s.deploy.prices = prices;
  await saveState(s);
}

async function stripeWebhook(s: ProjectState, log: (m: string) => void) {
  if (s.deploy.webhookSecret) return;
  const stripe = new Stripe(config.stripe.key!);
  const wh = await stripe.webhookEndpoints.create({
    url: `${s.deploy.url}/api/stripe/webhook`,
    enabled_events: ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"],
    metadata: { factory_slug: s.slug },
  });
  s.deploy.webhookSecret = wh.secret!;
  log("Stripe: webhook creado");
  await saveState(s);
}

// ─────────────────────────── Vercel ───────────────────────────
const VC = "https://api.vercel.com";
const team = () => (config.vercel.teamId ? `?teamId=${config.vercel.teamId}` : "");
const vercel = (method: string, path: string, body?: unknown) =>
  http(VC, config.vercel.token!, method, path + (path.includes("?") ? team().replace("?", "&") : team()), body);

function envVars(s: ProjectState) {
  const d = s.deploy;
  const vars: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: d.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: d.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: d.serviceKey,
    STRIPE_SECRET_KEY: config.stripe.key,
    STRIPE_WEBHOOK_SECRET: d.webhookSecret,
    NEXT_PUBLIC_APP_URL: d.url,
  };
  for (const [plan, price] of Object.entries(d.prices ?? {})) vars[`STRIPE_PRICE_${plan.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`] = price;
  return Object.entries(vars)
    .filter(([, v]) => v)
    .map(([key, value]) => ({ key, value, type: "encrypted", target: ["production", "preview", "development"] }));
}

async function vercelDeploy(s: ProjectState, log: (m: string) => void) {
  if (!s.deploy.vercelProjectId) {
    log("Vercel: creando proyecto…");
    const p = await vercel("POST", "/v10/projects", {
      name: s.slug,
      framework: "nextjs",
      gitRepository: { type: "github", repo: s.deploy.repo },
    });
    s.deploy.vercelProjectId = p.id;
    s.deploy.url = `https://${s.slug}.vercel.app`;
    await saveState(s);
  }
  await vercel("POST", `/v10/projects/${s.deploy.vercelProjectId}/env?upsert=true`, envVars(s));

  log("Vercel: desplegando…");
  const dep = await vercel("POST", "/v13/deployments", {
    name: s.slug,
    project: s.deploy.vercelProjectId,
    target: "production",
    gitSource: { type: "github", repoId: s.deploy.repoId, ref: "main" },
  });
  for (let i = 0; i < 90; i++) {
    const d = await vercel("GET", `/v13/deployments/${dep.id}`);
    if (d.readyState === "READY") break;
    if (d.readyState === "ERROR" || d.readyState === "CANCELED") throw new Error(`Despliegue Vercel falló: https://${d.url}`);
    await sleep(10_000);
  }
  const proj = await vercel("GET", `/v9/projects/${s.deploy.vercelProjectId}`);
  const alias = proj?.targets?.production?.alias?.[0];
  if (alias) s.deploy.url = `https://${alias}`;
  await saveState(s);
  log(`Vercel: 🚀 en vivo en ${s.deploy.url}`);
}

// ─────────────────────────── Orquestación del despliegue ───────────────────────────
export async function deployAll(s: ProjectState, root: string, log: (m: string) => void) {
  require_([
    ["GITHUB_TOKEN", config.github.token], ["GITHUB_OWNER", config.github.owner],
    ["VERCEL_TOKEN", config.vercel.token],
    ["SUPABASE_ACCESS_TOKEN", config.supabase.token], ["SUPABASE_ORG_ID", config.supabase.orgId],
    ["STRIPE_SECRET_KEY", config.stripe.key],
  ]);
  await github(s, root, log);
  await supabase(s, root, log);
  await stripePrices(s, log);
  await vercelDeploy(s, log);          // 1er despliegue: obtenemos la URL pública
  await supabaseAuthUrls(s);
  if (!s.deploy.webhookSecret) {
    await stripeWebhook(s, log);       // el webhook necesita la URL final
    await vercelDeploy(s, log);        // redeploy con STRIPE_WEBHOOK_SECRET
  }
}
