// Crea (o rehace) el menú de demostración que se enseña en las visitas de venta: /m/demo-pica-pollo
// Uso, una vez publicado MenúFácil:
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed:demo
// Es un negocio ficticio: los precios son de ejemplo, no de un local real.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (están en Supabase → Project Settings → API).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const SLUG = "demo-pica-pollo";
const EMAIL = process.env.DEMO_EMAIL ?? "demo@menufacil.app";

const MENU = [
  ["Pica pollo y frituras", [
    ["Pica pollo 2 piezas", 250, "Con tostones o papas fritas"],
    ["Pica pollo 3 piezas", 350, "Con tostones o papas fritas"],
    ["Chicharrón de cerdo", 350, "Con tostones y salsa de ajo"],
    ["Longaniza frita", 300, "Con tostones"],
    ["Combo familiar", 1100, "8 piezas de pollo, tostones grandes y 4 refrescos"],
  ]],
  ["Acompañantes", [
    ["Tostones", 100, null],
    ["Papas fritas", 100, null],
    ["Yuca frita", 100, null],
    ["Ensalada verde", 80, null],
  ]],
  ["Bebidas", [
    ["Refresco", 75, "Lata"],
    ["Jugo natural de chinola", 100, null],
    ["Morir soñando", 125, null],
    ["Agua", 40, null],
  ]],
];

// 1. Usuario dueño de la demo (o el que ya existe)
let userId;
const { data: existing } = await db.from("restaurants").select("id, user_id").eq("slug", SLUG).maybeSingle();
if (existing) {
  userId = existing.user_id;
} else {
  const { data, error } = await db.auth.admin.createUser({ email: EMAIL, email_confirm: true });
  if (error) { console.error("No se pudo crear el usuario de la demo:", error.message); process.exit(1); }
  userId = data.user.id;
}

// 2. Restaurante (se rehace el menú en cada ejecución)
const { data: r, error: rErr } = await db.from("restaurants").upsert({
  user_id: userId, slug: SLUG, name: "Pica Pollo Doña Ana",
  description: "Menú de demostración de MenúFácil · Pica pollo, chicharrón y tostones",
  whatsapp: process.env.DEMO_WHATSAPP ?? "809 000 0000",
  currency: "DOP", address: "Santo Domingo (negocio de ejemplo)",
  is_open: true, pickup_enabled: true, delivery_enabled: true, delivery_fee: 100, min_order: 200,
}, { onConflict: "user_id" }).select().single();
if (rErr) { console.error("No se pudo guardar el restaurante:", rErr.message); process.exit(1); }
await db.from("categories").delete().eq("restaurant_id", r.id); // borra también sus productos

let n = 0;
for (const [ci, [cat, items]] of MENU.entries()) {
  const { data: c, error } = await db.from("categories").insert({ user_id: userId, restaurant_id: r.id, name: cat, position: ci }).select().single();
  if (error) { console.error(`Categoría "${cat}":`, error.message); process.exit(1); }
  const rows = items.map(([name, price, description], pi) => ({ user_id: userId, restaurant_id: r.id, category_id: c.id, name, price, description, position: pi }));
  const { error: pErr } = await db.from("products").insert(rows);
  if (pErr) { console.error(`Productos de "${cat}":`, pErr.message); process.exit(1); }
  n += rows.length;
}
console.log(`✅ Menú de demostración listo: ${n} productos en ${MENU.length} categorías → /m/${SLUG}`);
console.log(`   Pon DEMO_WHATSAPP=<tu número> para que los pedidos de prueba te lleguen a ti.`);
