// Simulador mínimo de Supabase (Auth + PostgREST) sobre Postgres embebido (PGlite), con RLS real.
// Sirve para probar de punta a punta un SaaS generado sin cuenta de Supabase.
// Uso: node tools/supabase-mock.mjs <carpeta de migraciones> [puerto=54321]
// Requiere: npm i -D @electric-sql/pglite
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "node:http";
import crypto from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const MIG = process.argv[2];
const PORT = Number(process.argv[3] ?? 54321);
const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(`${MIG}/${f}`, "utf8"));
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
await db.exec(`insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'dueno@barberia.com')`);

const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error("bad ident " + s); return `"${s}"`; };
const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };

function subFromAuth(h) {
  const tok = (h.authorization ?? "").replace(/^Bearer /, "");
  try {
    const p = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString());
    if (p.role === "service_role") return "service_role";
    return p.role === "authenticated" ? p.sub : null;
  } catch { return null; }
}

async function asRole(sub, fn) {
  if (sub === "service_role") return db.transaction((tx) => fn(tx)); // service_role ignora RLS
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${sub ? "authenticated" : "anon"}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub ?? ""]);
    return fn(tx);
  });
}

function where(params, args) {
  const conds = [];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "on_conflict", "columns", "offset"].includes(k)) continue;
    const m = v.match(/^(eq|neq|gt|gte|lt|lte|is)\.(.*)$/s);
    if (!m) continue;
    if (m[1] === "is") { conds.push(`${ident(k)} is ${m[2] === "null" ? "null" : m[2] === "true" ? "true" : "false"}`); continue; }
    args.push(m[2]);
    conds.push(`${ident(k)}::text ${OPS[m[1]]} $${args.length}::text`.replace(/::text (>=|<=|>|<) \$(\d+)::text/, (_, op, n) => `${op} $${n}`));
  }
  return conds.length ? ` where ${conds.join(" and ")}` : "";
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  // Como PostgREST: con Accept vnd.pgrst.object (.single()/.maybeSingle()) devuelve un objeto, no una lista.
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  const send = (status, body, headers = {}) => {
    if (wantsObject && Array.isArray(body) && status < 300) {
      if (body.length !== 1) { status = 406; body = { code: "PGRST116", message: `Se esperaba 1 fila y hay ${body.length}` }; }
      else body = body[0];
    }
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  let body = "";
  for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : undefined;
  const sub = subFromAuth(req.headers);
  try {
    if (url.pathname === "/auth/v1/user") {
      if (!sub) return send(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      return send(200, { id: sub, aud: "authenticated", role: "authenticated", email: "dueno@barberia.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
    }
    if (url.pathname === "/auth/v1/admin/users" && req.method === "POST") {
      if (sub !== "service_role") return send(403, { msg: "service_role requerido" });
      const id = crypto.randomUUID();
      await db.query("insert into auth.users (id, email) values ($1, $2)", [id, json.email]);
      return send(200, { id, email: json.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
    }
    if (url.pathname.startsWith("/auth/v1/")) return send(200, {});

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (rpc) {
      const fn = ident(rpc[1]);
      const keys = Object.keys(json ?? {});
      const meta = await db.query(`select proretset from pg_proc where proname = $1`, [rpc[1]]);
      const call = `public.${fn}(${keys.map((k, i) => `${ident(k)} := $${i + 1}`).join(", ")})`;
      const r = await asRole(sub, (tx) => tx.query(meta.rows[0].proretset ? `select * from ${call}` : `select ${call} as r`, keys.map((k) => json[k])));
      return send(200, meta.rows[0].proretset ? r.rows : r.rows[0].r);
    }

    const tbl = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (!tbl) return send(404, { message: "not found" });
    const t = `public.${ident(tbl[1])}`;
    const prefer = req.headers.prefer ?? "";
    const args = [];
    const w = where(url.searchParams, args);

    if (req.method === "GET" || req.method === "HEAD") {
      const order = url.searchParams.get("order");
      const ord = order ? ` order by ${order.split(",").map((o) => { const [c, d] = o.split("."); return `${ident(c)} ${d === "desc" ? "desc" : "asc"}`; }).join(", ")}` : "";
      const lim = url.searchParams.get("limit") ? ` limit ${Number(url.searchParams.get("limit"))}` : "";
      const r = await asRole(sub, async (tx) => ({
        rows: (await tx.query(`select * from ${t}${w}${ord}${lim}`, args)).rows,
        count: prefer.includes("count=exact") ? (await tx.query(`select count(*)::int n from ${t}${w}`, args)).rows[0].n : null,
      }));
      const h = r.count !== null ? { "Content-Range": `0-${Math.max(r.rows.length - 1, 0)}/${r.count}` } : {};
      return req.method === "HEAD" ? send(200, undefined, h) : send(200, r.rows, h);
    }
    if (req.method === "POST") {
      const rows = Array.isArray(json) ? json : [json];
      const out = [];
      await asRole(sub, async (tx) => {
        for (const row of rows) {
          const cols = Object.keys(row);
          const vals = cols.map((c) => (Array.isArray(row[c]) ? `{${row[c].join(",")}}` : row[c]));
          let sql = `insert into ${t} (${cols.map(ident).join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`;
          const oc = url.searchParams.get("on_conflict");
          if (oc && prefer.includes("merge-duplicates"))
            sql += ` on conflict (${ident(oc)}) do update set ${cols.filter((c) => c !== oc).map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`;
          out.push(...(await tx.query(sql + " returning *", vals)).rows);
        }
      });
      return prefer.includes("return=representation") ? send(201, out) : send(201, undefined);
    }
    if (req.method === "PATCH") {
      const cols = Object.keys(json);
      const set = cols.map((c, i) => `${ident(c)} = $${args.length + i + 1}`).join(", ");
      const w2 = where(url.searchParams, []).replace(/\$(\d+)/g, (_, n) => `$${n}`);
      const r = await asRole(sub, (tx) => tx.query(`update ${t} set ${set}${w2} returning *`, [...args, ...cols.map((c) => json[c])]));
      return prefer.includes("return=representation") ? send(200, r.rows) : send(204, undefined);
    }
    if (req.method === "DELETE") {
      await asRole(sub, (tx) => tx.query(`delete from ${t}${w}`, args));
      return send(204, undefined);
    }
    send(405, { message: "method" });
  } catch (e) {
    send(400, { code: e.code ?? "XX000", message: e.message, details: null, hint: null });
  }
});
server.listen(PORT, () => console.log(`mock supabase on ${PORT}`));
