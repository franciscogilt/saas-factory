import { config } from "./config.js";

type Check = { name: string; ok: boolean; detail: string };

async function get(url: string, headers: Record<string, string>) {
  const r = await fetch(url, { headers });
  return { ok: r.ok, status: r.status, headers: r.headers, body: r.ok ? await r.json().catch(() => ({})) : await r.text() };
}

/** Comprueba que cada clave existe, es válida y tiene los permisos necesarios. */
export async function doctor(aiOnly = false): Promise<boolean> {
  const checks: Check[] = [];
  const run = async (name: string, value: string | undefined, how: string, fn: () => Promise<string>) => {
    if (!value) return checks.push({ name, ok: false, detail: `Falta. ${how}` });
    try {
      checks.push({ name, ok: true, detail: await fn() });
    } catch (e: any) {
      checks.push({ name, ok: false, detail: `${e.message}. ${how}` });
    }
  };

  await run("Claude (ANTHROPIC_API_KEY)", config.anthropicKey, "Créala en console.anthropic.com → API Keys", async () => {
    const r = await get("https://api.anthropic.com/v1/models?limit=1000", { "x-api-key": config.anthropicKey!, "anthropic-version": "2023-06-01" });
    if (!r.ok) throw new Error(`Clave rechazada (${r.status})`);
    const ids: string[] = (r.body.data ?? []).map((m: any) => m.id);
    for (const m of [config.models.strategy, config.models.engineer])
      if (ids.length && !ids.includes(m)) throw new Error(`El modelo ${m} no está disponible en tu cuenta`);
    return "válida";
  });

  if (aiOnly) return report(checks);

  await run("GitHub (GITHUB_TOKEN / GITHUB_OWNER)", config.github.token && config.github.owner, "Token clásico en github.com/settings/tokens con permisos repo y workflow", async () => {
    const r = await get("https://api.github.com/user", { Authorization: `Bearer ${config.github.token}` });
    if (!r.ok) throw new Error(`Token rechazado (${r.status})`);
    const scopes = r.headers.get("x-oauth-scopes") ?? "";
    if (scopes && !scopes.split(/,\s*/).includes("repo")) throw new Error(`Al token le falta el permiso "repo" (tiene: ${scopes})`);
    return `usuario ${r.body.login}`;
  });

  await run("Vercel (VERCEL_TOKEN)", config.vercel.token, "Créalo en vercel.com/account/tokens", async () => {
    const r = await get(`https://api.vercel.com/v2/user`, { Authorization: `Bearer ${config.vercel.token}` });
    if (!r.ok) throw new Error(`Token rechazado (${r.status})`);
    return `usuario ${r.body.user?.username ?? "ok"} · recuerda instalar la app de Vercel en GitHub`;
  });

  await run("Supabase (SUPABASE_ACCESS_TOKEN / SUPABASE_ORG_ID)", config.supabase.token && config.supabase.orgId, "Token en supabase.com/dashboard/account/tokens; el ID de organización está en la configuración de tu organización", async () => {
    const r = await get("https://api.supabase.com/v1/organizations", { Authorization: `Bearer ${config.supabase.token}` });
    if (!r.ok) throw new Error(`Token rechazado (${r.status})`);
    const orgs: { id: string; slug?: string; name: string }[] = r.body;
    const org = orgs.find((o) => o.id === config.supabase.orgId || o.slug === config.supabase.orgId);
    if (!org) throw new Error(`SUPABASE_ORG_ID no coincide. Tus organizaciones: ${orgs.map((o) => `${o.name}=${o.slug ?? o.id}`).join(", ")}`);
    const projects = await get("https://api.supabase.com/v1/projects", { Authorization: `Bearer ${config.supabase.token}` });
    const n = Array.isArray(projects.body) ? projects.body.length : 0;
    return `organización "${org.name}" · ${n} proyecto(s) existentes${n >= 2 ? " · ⚠️ el plan gratis solo permite 2 activos" : ""}`;
  });

  await run("Stripe (STRIPE_SECRET_KEY)", config.stripe.key, "Cópiala en dashboard.stripe.com/test/apikeys", async () => {
    const r = await get("https://api.stripe.com/v1/balance", { Authorization: `Bearer ${config.stripe.key}` });
    if (!r.ok) throw new Error(`Clave rechazada (${r.status})`);
    return config.stripe.key!.startsWith("sk_live") ? "⚠️ MODO LIVE: cobrará dinero real" : "modo test";
  });

  return report(checks);
}

function report(checks: Check[]) {
  console.log("\n🩺 Revisión de la fábrica\n");
  for (const c of checks) console.log(`${c.ok ? "✅" : "❌"} ${c.name}\n   ${c.detail}`);
  const ok = checks.every((c) => c.ok);
  console.log(ok ? "\n🏭 Todo listo. La fábrica puede arrancar.\n" : "\nArregla los ❌ y vuelve a intentarlo.\n");
  return ok;
}
