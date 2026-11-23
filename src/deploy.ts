import { Octokit } from "@octokit/rest";
import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
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
    const existing = await gh.repos.get({ owner: config.github.owner!, repo: name }).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (existing) {
      // Un intento anterior ya lo creó: se reutiliza, pero nunca se sobrescribe un repositorio ajeno.
      if (!(await isFactoryRepo(gh, config.github.owner!, name)))
        throw new Error(`Ya existe el repositorio ${existing.data.full_name} y no lo creó la fábrica: no lo sobrescribo. Bórralo o cambia el slug.`);
      log(`GitHub: reutilizando ${existing.data.full_name}`);
      s.deploy.repo = existing.data.full_name;
      s.deploy.repoId = existing.data.id;
      await saveState(s);
    }
  }
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

async function isFactoryRepo(gh: Octokit, owner: string, repo: string) {
  try {
    const c = await gh.repos.listCommits({ owner, repo, per_page: 1 });
    const last = c.data[0]?.commit;
    return !last || last.author?.name === "SaaS Factory";
  } catch (e: any) {
    if (e.status === 409) return true; // repositorio vacío
    throw e;
  }
}

// ─────────────────────────── Supabase ───────────────────────────
const SB = "https://api.supabase.com/v1";
async function supabase(s: ProjectState, root: string, log: (m: string) => void) {
  const t = config.supabase.token!;
  if (!s.deploy.supabaseRef) {
    const list: { id?: string; ref?: string; name: string; organization_id?: string; organization_slug?: string }[] = await http(SB, t, "GET", "/projects");
    const found = list.find((p) => p.name === s.slug && [p.organization_id, p.organization_slug].includes(config.supabase.orgId));
    if (found) {
      log(`Supabase: reutilizando el proyecto ${s.slug}`);
      s.deploy.supabaseRef = found.id ?? found.ref;
      await saveState(s);
    }
  }
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
  if ((await http(SB, t, "GET", `/projects/${ref}`)).status === "INACTIVE") {
    // El plan gratis pausa los proyectos tras una semana sin uso.
    log("Supabase: el proyecto estaba en pausa; reactivándolo (tarda unos minutos)…");
    await http(SB, t, "POST", `/projects/${ref}/restore`);
  }
  let healthy = false;
  for (let i = 0; i < 90 && !healthy; i++) {
    healthy = (await http(SB, t, "GET", `/projects/${ref}`)).status === "ACTIVE_HEALTHY";
    if (!healthy) await sleep(10_000);
  }
  if (!healthy) throw new Error("Supabase: el proyecto no quedó activo a tiempo. Vuelve a lanzar la publicación en unos minutos.");
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
  const mine: Stripe.Product[] = [];
  for await (const p of stripe.products.list({ active: true, limit: 100 })) if (p.metadata?.factory_slug === s.slug) mine.push(p);
  for (const plan of s.prd!.plans.filter((p) => p.priceUsd > 0)) {
    const name = `${s.prd!.name} — ${plan.name}`;
    const amount = Math.round(plan.priceUsd * 100);
    const old = mine.find((p) => p.name === name);
    if (old) {
      // Un intento anterior ya lo creó: se reutiliza el precio si coincide.
      const same = (await stripe.prices.list({ product: old.id, active: true, limit: 100 })).data
        .find((p) => p.unit_amount === amount && p.currency === "usd" && p.recurring?.interval === "month");
      if (same) {
        prices[plan.id] = same.id;
        log(`Stripe: plan ${plan.name} ya existía → ${same.id}`);
        continue;
      }
    }
    const product = old ?? (await stripe.products.create({ name, metadata: { factory_slug: s.slug } }));
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
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
  const stripe = new Stripe(config.stripe.key!);
  // El secreto solo se puede leer al crearlo y no se guarda en disco: se sustituye el webhook anterior.
  for await (const old of stripe.webhookEndpoints.list({ limit: 100 }))
    if (old.metadata?.factory_slug === s.slug) await stripe.webhookEndpoints.del(old.id);
  const wh = await stripe.webhookEndpoints.create({
    url: `${s.deploy.url}/api/stripe/webhook`,
    enabled_events: ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"],
    metadata: { factory_slug: s.slug },
  });
  s.deploy.webhookSecret = wh.secret!;
  log("Stripe: webhook creado");
  return wh.url;
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
    const p = await vercel("GET", `/v9/projects/${s.slug}`).catch((e) => (/→ 404/.test(e.message) ? null : Promise.reject(e)));
    if (p) {
      const linked = p.link?.type === "github" ? `${p.link.org}/${p.link.repo}` : "";
      if (linked.toLowerCase() !== s.deploy.repo!.toLowerCase())
        throw new Error(`Ya tienes un proyecto de Vercel llamado ${s.slug} conectado a otro repositorio (${linked || "ninguno"}). Bórralo en Vercel o cambia el slug.`);
      log(`Vercel: reutilizando el proyecto ${s.slug}`);
      s.deploy.vercelProjectId = p.id;
      s.deploy.url ??= `https://${s.slug}.vercel.app`;
      await saveState(s);
    }
  }
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
// Se puede repetir sin miedo: cada paso reutiliza lo que un intento anterior ya creó.
// Stripe es opcional: sin STRIPE_SECRET_KEY se publica sin cobros (los planes de pago dicen «Próximamente»).
export async function deployAll(s: ProjectState, root: string, log: (m: string) => void, opts: { seed?: boolean } = {}) {
  require_([
    ["GITHUB_TOKEN", config.github.token], ["GITHUB_OWNER", config.github.owner],
    ["VERCEL_TOKEN", config.vercel.token],
    ["SUPABASE_ACCESS_TOKEN", config.supabase.token], ["SUPABASE_ORG_ID", config.supabase.orgId],
  ]);
  const payments = !!config.stripe.key;
  if (!payments) {
    log("Stripe: sin configurar → se publica sin cobros (los planes de pago dirán «Próximamente»).");
    s.deploy.prices = undefined;
  }
  await github(s, root, log);
  await supabase(s, root, log);
  let hook: string | undefined;
  if (payments) {
    await stripePrices(s, log);
    if (s.deploy.url) hook = await stripeWebhook(s, log); // URL conocida de un intento anterior
  }
  await vercelDeploy(s, log);
  await supabaseAuthUrls(s);
  if (payments && hook !== `${s.deploy.url}/api/stripe/webhook`) {
    await stripeWebhook(s, log);       // el webhook necesita la URL final
    await vercelDeploy(s, log);        // redeploy con STRIPE_WEBHOOK_SECRET
  }
  if (opts.seed) await seedDemo(s, root, log);
}

async function seedDemo(s: ProjectState, root: string, log: (m: string) => void) {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (!pkg.scripts?.["seed:demo"]) return log("Demo: este SaaS no tiene datos de demostración (seed:demo).");
  log("Demo: creando los datos de demostración…");
  const env = { NEXT_PUBLIC_SUPABASE_URL: s.deploy.supabaseUrl!, SUPABASE_SERVICE_ROLE_KEY: s.deploy.serviceKey! };
  for (const c of [existsSync(join(root, "node_modules")) ? "true" : "npm install --no-audit --no-fund", "npm run -s seed:demo"]) {
    const r = await sh(c, root, 15 * 60_000, env);
    if (r.code !== 0) throw new Error(`Demo: falló «${c}»: ${r.out.replaceAll(env.SUPABASE_SERVICE_ROLE_KEY, "***").slice(-1500)}`);
    if (c.includes("seed")) log(r.out.trim());
  }
}
