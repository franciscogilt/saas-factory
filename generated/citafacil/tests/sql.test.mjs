import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

import { fileURLToPath } from "node:url";
const M = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? "✓" : "✗"} ${m}`); };
const expectErr = async (p, re, m) => {
  try { await p; ok(false, `${m} (no lanzó error)`); }
  catch (e) { ok(re.test(e.message), `${m} → ${e.message}`); }
};

// Simulación mínima de Supabase
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(readFileSync(M + "0001_init.sql", "utf8"));
await db.exec(readFileSync(M + "0002_bookings.sql", "utf8"));
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
ok(true, "migraciones 0001 + 0002 aplicadas");

const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users values ('${A}','a@x.com'),('${B}','b@x.com')`);
ok((await db.query("select count(*)::int n from profiles")).rows[0].n === 2, "trigger crea perfiles");

const as = async (role, uid, sql, params) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role;"); }
};

// Dueño A crea su negocio y servicio (todos los días, 08:00-20:00, en UTC para simplificar)
const biz = (await as("authenticated", A,
  `insert into businesses (user_id, slug, name, whatsapp, timezone, open_time, close_time, open_days)
   values ($1,'salon-ana','Salón Ana','+1 809 555 1234','UTC','08:00','20:00','{1,2,3,4,5,6,7}') returning id`, [A])).rows[0].id;
ok(!!biz, "dueño crea su negocio");
const svc = (await as("authenticated", A,
  `insert into services (user_id, business_id, name, duration_minutes, price) values ($1,$2,'Corte',30,500) returning id`, [A, biz])).rows[0].id;
ok(!!svc, "dueño crea un servicio");

await expectErr(as("authenticated", B, `insert into services (user_id, business_id, name, duration_minutes) values ($1,$2,'Hack',30)`, [B, biz]),
  /row-level security/, "B no puede crear servicios en el negocio de A");
await expectErr(as("authenticated", B, `insert into businesses (user_id, slug, name) values ($1,'x-hack','Hack')`, [A]),
  /row-level security/, "B no puede crear un negocio a nombre de A");

// Hora válida: mañana 10:00 UTC
const t = new Date(); t.setUTCDate(t.getUTCDate() + 1); t.setUTCHours(10, 0, 0, 0);
const iso = t.toISOString();
const book = (starts, name = "María", phone = "809-555-0000") =>
  as("anon", null, `select book_appointment($1,$2,$3,$4,$5) id`, [biz, svc, starts, name, phone]);

const id = (await book(iso)).rows[0].id;
ok(!!id, "cliente anónimo reserva una cita válida");
await expectErr(book(iso), /reservar esa hora/, "no se puede reservar la misma hora dos veces");
await expectErr(book(new Date(t.getTime() + 15 * 60e3).toISOString()), /reservar esa hora/, "no se puede solapar parcialmente");
const t2 = new Date(t); t2.setUTCHours(10, 30);
ok(!!(await book(t2.toISOString())).rows[0].id, "la hora contigua (10:30) sí se puede reservar");
const t3 = new Date(t); t3.setUTCHours(19, 45);
await expectErr(book(t3.toISOString()), /fuera del horario/, "no se puede reservar si termina después del cierre");
const t4 = new Date(t); t4.setUTCHours(7, 0);
await expectErr(book(t4.toISOString()), /fuera del horario/, "no se puede reservar antes de abrir");
await expectErr(book(new Date(Date.now() - 3600e3).toISOString()), /ya no está disponible/, "no se puede reservar en el pasado");
await expectErr(book(new Date(t.getTime() + 2 * 3600e3).toISOString(), "M", "809"), /nombre/, "valida el nombre");
await expectErr(book(new Date(t.getTime() + 2 * 3600e3).toISOString(), "María", "abc"), /teléfono/, "valida el teléfono");

// Privacidad
await expectErr(as("anon", null, `insert into appointments (user_id,business_id,service_name,client_name,client_phone,starts_at,ends_at) values ($1,$2,'x','Hack','8095550000',now(),now()+interval '1h')`, [A, biz]),
  /row-level security/, "anónimo no puede insertar citas directamente");
ok((await as("anon", null, `select * from appointments`)).rows.length === 0, "anónimo no puede ver las citas (nombres/teléfonos)");
ok((await as("authenticated", B, `select * from appointments`)).rows.length === 0, "otro dueño no ve las citas de A");
ok((await as("authenticated", A, `select * from appointments`)).rows.length === 2, "el dueño ve sus 2 citas");
const busy = await as("anon", null, `select * from get_busy_slots($1, now(), now() + interval '3 days')`, [biz]);
ok(busy.rows.length === 2 && !("client_name" in busy.rows[0]), "horarios ocupados públicos sin datos del cliente");
ok((await as("authenticated", B, `update appointments set status='cancelled' returning id`)).rows.length === 0, "otro dueño no puede cancelar citas de A");

// Cancelar libera el horario
await as("authenticated", A, `update appointments set status='cancelled' where id=$1`, [id]);
ok(!!(await book(iso, "Pedro")).rows[0].id, "al cancelar, la hora vuelve a estar libre");

// Servicio inactivo
await as("authenticated", A, `update services set active=false where id=$1`, [svc]);
ok((await as("anon", null, `select * from services`)).rows.length === 0, "servicios inactivos no se ven en público");
await expectErr(book(new Date(t.getTime() + 4 * 3600e3).toISOString()), /servicio/, "no se reserva un servicio inactivo");
await as("authenticated", A, `update services set active=true where id=$1`, [svc]);

// Antispam: máximo 3 citas futuras por teléfono
const spamT = (h) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() + 2); x.setUTCHours(h, 0, 0, 0); return x.toISOString(); };
for (const h of [9, 10, 11]) await book(spamT(h), "Spam", "+1 (809) 111-2222");
await expectErr(book(spamT(12), "Spam", "8091112222"), /3 citas pendientes/, "antispam: un mismo teléfono no acapara la agenda (aunque cambie el formato)");
await db.query(`delete from appointments where client_name = 'Spam'`);

// Límite del plan gratis: 30/mes
await db.query(`insert into appointments (user_id,business_id,service_id,service_name,client_name,client_phone,starts_at,ends_at)
  select $1,$2,$3,'Corte','Relleno','809' || lpad(g::text, 7, '0'), now() + (g || ' days')::interval + interval '1 year', now() + (g || ' days')::interval + interval '1 year 30 min'
  from generate_series(1, 28) g`, [A, biz, svc]); // ya hay 2 activas (1 cancelada no cuenta) → total 30
const free = new Date(t); free.setUTCHours(15, 0);
await expectErr(book(free.toISOString()), /no acepta más reservas/, "plan gratis bloquea la reserva nº 31 del mes");
await db.query(`insert into subscriptions (user_id, status, plan_id) values ($1,'active','pro')`, [A]);
ok(!!(await book(free.toISOString(), "Rosa", "8296660000")).rows[0].id, "con plan Pro activo, reservas ilimitadas");
ok((await as("anon", null, `select is_pro_business($1) p`, [biz])).rows[0].p === true, "is_pro_business detecta el plan Pro");
ok((await as("anon", null, `select * from subscriptions`)).rows.length === 0, "anónimo no ve datos de suscripción");

// Zona horaria real: Santo Domingo (UTC-4). 09:00 local = 13:00 UTC
await as("authenticated", A, `update businesses set timezone='America/Santo_Domingo', open_time='09:00', close_time='18:00' where id=$1`, [biz]);
const sd = new Date(t); sd.setUTCDate(sd.getUTCDate() + 1); sd.setUTCHours(12, 30);
await expectErr(book(sd.toISOString()), /fuera del horario/, "8:30 en Santo Domingo está fuera del horario");
sd.setUTCHours(13, 0);
ok(!!(await book(sd.toISOString(), "Laura", "8297770000")).rows[0].id, "9:00 en Santo Domingo se acepta (zona horaria correcta)");

console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
