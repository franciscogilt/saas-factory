import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const M = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? "✓" : "✗"} ${m}`); };
const expectErr = async (p, re, m) => {
  try { await p; ok(false, `${m} (no lanzó error)`); }
  catch (e) { ok(re.test(e.message), `${m} → ${e.message}`); }
};

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
for (const f of readdirSync(M).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(M + f, "utf8"));
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
ok(true, "migraciones aplicadas");

const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users values ('${A}','a@x.com'),('${B}','b@x.com')`);
const as = async (role, uid, sql, params) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec("reset role;"); }
};

const rA = (await as("authenticated", A, `insert into restaurants (user_id, slug, name, whatsapp) values ($1,'pica-pollo-ana','Pica Pollo Ana','809 555 1234') returning id`, [A])).rows[0].id;
const rB = (await as("authenticated", B, `insert into restaurants (user_id, slug, name, whatsapp) values ($1,'cafe-beto','Café Beto','809 555 9999') returning id`, [B])).rows[0].id;
ok(rA && rB, "dos dueños crean sus restaurantes");
await expectErr(as("authenticated", A, `insert into restaurants (user_id, slug, name, whatsapp) values ($1,'otro-mas','Otro','8095551234')`, [A]), /duplicate|unique/, "un dueño solo tiene un restaurante");
await expectErr(as("authenticated", A, `insert into restaurants (user_id, slug, name, whatsapp, pickup_enabled, delivery_enabled) values ($1,'nada-x','X','8095551234',false,false)`, [B]), /row-level security|check/, "no puede crear restaurantes a nombre de otro");
await expectErr(as("authenticated", A, `update restaurants set pickup_enabled=false, delivery_enabled=false where id=$1`, [rA]), /check/, "debe ofrecer al menos recogida o delivery");

const cA = (await as("authenticated", A, `insert into categories (user_id, restaurant_id, name) values ($1,$2,'Platos') returning id`, [A, rA])).rows[0].id;
const cB = (await as("authenticated", B, `insert into categories (user_id, restaurant_id, name) values ($1,$2,'Cafés') returning id`, [B, rB])).rows[0].id;
ok(cA && cB, "cada dueño crea su categoría");
await expectErr(as("authenticated", B, `insert into categories (user_id, restaurant_id, name) values ($1,$2,'Hack')`, [B, rA]), /row-level security/, "B no puede crear categorías en el restaurante de A");
await expectErr(as("authenticated", B, `insert into products (user_id, restaurant_id, category_id, name, price) values ($1,$2,$3,'Hack',1)`, [B, rB, cA]), /row-level security/, "B no puede meter productos en una categoría de A");
await expectErr(as("authenticated", A, `insert into products (user_id, restaurant_id, category_id, name, price) values ($1,$2,$3,'Mezcla',1)`, [A, rA, cB]), /row-level security/, "A no puede usar una categoría de B aunque sea en su restaurante");

const pA = (await as("authenticated", A, `insert into products (user_id, restaurant_id, category_id, name, price) values ($1,$2,$3,'Pica pollo 2 piezas',250) returning id`, [A, rA, cA])).rows[0].id;
ok(!!pA, "A crea un producto");
await expectErr(as("authenticated", A, `insert into products (user_id, restaurant_id, category_id, name, price) values ($1,$2,$3,'Negativo',-5)`, [A, rA, cA]), /check/, "no se permiten precios negativos");

ok((await as("anon", null, `select * from products where restaurant_id=$1`, [rA])).rows.length === 1, "el público ve el menú");
ok((await as("anon", null, `update products set price=1 where id=$1 returning id`, [pA])).rows.length === 0, "el público no puede cambiar precios");
ok((await as("authenticated", B, `update products set price=1 where id=$1 returning id`, [pA])).rows.length === 0, "otro dueño no puede cambiar precios de A");
ok((await as("authenticated", B, `delete from products where id=$1 returning id`, [pA])).rows.length === 0, "otro dueño no puede borrar productos de A");
await expectErr(as("anon", null, `insert into categories (user_id, restaurant_id, name) values ($1,$2,'Spam')`, [A, rA]), /row-level security/, "el público no puede crear categorías");
ok((await as("anon", null, `select * from subscriptions`)).rows.length === 0, "el público no ve suscripciones");

// Límite del plan gratis: 25 productos
await db.query(`insert into products (user_id, restaurant_id, category_id, name, price) select $1,$2,$3,'Producto ' || g, 100 from generate_series(1, 24) g`, [A, rA, cA]);
ok((await db.query(`select count(*)::int n from products where restaurant_id=$1`, [rA])).rows[0].n === 25, "hay 25 productos");
await expectErr(as("authenticated", A, `insert into products (user_id, restaurant_id, category_id, name, price) values ($1,$2,$3,'El 26',100)`, [A, rA, cA]), /hasta 25 productos/, "plan gratis bloquea el producto 26");
ok((await as("anon", null, `select is_pro_restaurant($1) p`, [rA])).rows[0].p === false, "is_pro_restaurant: gratis");
await db.query(`insert into subscriptions (user_id, status, plan_id) values ($1,'active','pro')`, [A]);
ok(!!(await as("authenticated", A, `insert into products (user_id, restaurant_id, category_id, name, price) values ($1,$2,$3,'El 26',100) returning id`, [A, rA, cA])).rows[0].id, "con Pro, productos ilimitados");
ok((await as("anon", null, `select is_pro_restaurant($1) p`, [rA])).rows[0].p === true, "is_pro_restaurant: pro");

// Borrar una categoría borra sus productos
await as("authenticated", A, `delete from categories where id=$1`, [cA]);
ok((await db.query(`select count(*)::int n from products where restaurant_id=$1`, [rA])).rows[0].n === 0, "borrar una categoría borra sus productos");

console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
