import type { ProjectState } from "./state.js";

/** Pruebas de humo sobre el SaaS publicado: confirma que las páginas clave responden y que lo críticamente protegido lo está. */
const CHECKS: { path: string; method?: string; expect: (status: number, body: string) => boolean; label: string }[] = [
  { path: "/", label: "landing", expect: (s) => s === 200 },
  { path: "/pricing", label: "precios", expect: (s) => s === 200 },
  { path: "/login", label: "login", expect: (s) => s === 200 },
  { path: "/blog", label: "blog", expect: (s) => s === 200 },
  { path: "/terms", label: "términos", expect: (s) => s === 200 },
  { path: "/privacy", label: "privacidad", expect: (s) => s === 200 },
  { path: "/sitemap.xml", label: "sitemap", expect: (s) => s === 200 },
  // Sin sesión, el dashboard debe redirigir al login
  { path: "/dashboard", label: "dashboard protegido", expect: (s) => s >= 300 && s < 400 },
  // Sin firma válida, el webhook debe rechazar
  { path: "/api/stripe/webhook", method: "POST", label: "webhook protegido", expect: (s) => s === 400 },
];

export async function smokeTest(s: ProjectState, log: (m: string) => void, retries = 3) {
  const base = s.deploy.url!;
  let results: NonNullable<ProjectState["smoke"]> = [];
  for (let attempt = 1; attempt <= retries; attempt++) {
    results = [];
    for (const c of CHECKS) {
      let status = 0, body = "";
      try {
        const r = await fetch(base + c.path, { method: c.method ?? "GET", redirect: "manual", body: c.method === "POST" ? "{}" : undefined });
        status = r.status;
        body = await r.text();
      } catch { /* red caída: status 0 */ }
      results.push({ path: c.path, status, ok: c.expect(status, body) });
    }
    if (results.every((r) => r.ok)) break;
    if (attempt < retries) await new Promise((r) => setTimeout(r, 15_000)); // la CDN puede tardar en propagar
  }
  for (const r of results) log(`  ${r.ok ? "✓" : "✗"} ${r.path} → ${r.status}`);
  s.smoke = results;
  return results.every((r) => r.ok);
}
