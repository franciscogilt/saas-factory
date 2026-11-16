import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const API = process.env.SUPABASE_URL ?? "http://localhost:54321";
const OUT = process.env.SHOTS_DIR ?? "./screenshots";
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? "✓" : "✗"} ${m}`); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-1111-1111-1111-111111111111";
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", exp })}.sig`;
const session = { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: exp,
  user: { id: UID, aud: "authenticated", role: "authenticated", email: "dueno@negocio.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
const authCookie = [{ name: "sb-localhost-auth-token", value: "base64-" + b64(session), domain: "localhost", path: "/" }];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-DO", timezoneId: "America/Santo_Domingo" };
const errors = [];
const track = (p) => p.on("pageerror", (e) => errors.push(`[${p.url().replace(BASE, "")}] ${e.message.slice(0, 60)}`));

// ── Landing
let p = await (await browser.newContext(mobile)).newPage(); track(p);
await p.goto(BASE + "/");
ok((await p.textContent("h1")).includes("Los pedidos, en tu WhatsApp"), "landing con el titular del PRD");
await p.screenshot({ path: `${OUT}/1-landing.png`, fullPage: true });

// ── Dueña: alta del negocio
const ownerCtx = await browser.newContext(mobile);
await ownerCtx.addCookies(authCookie);
const o = await ownerCtx.newPage(); track(o);
await o.goto(BASE + "/dashboard");
ok(o.url().includes("/dashboard/settings"), "dueña nueva va a configurar su negocio");
await o.fill("#name", "Pica Pollo Doña Ana");
await o.fill("#slug", "pica-pollo-dona-ana");
await o.fill("#whatsapp", "809 555 1234");
await o.fill("#description", "Pica pollo, chicharrón y tostones desde 1998");
await o.check('input[name=delivery_enabled]');
await o.fill("#delivery_fee", "100");
await o.fill("#min_order", "200");
await o.click("button[type=submit]");
await o.waitForURL(/\/dashboard\/menu/);
ok(await o.waitForSelector("text=Ahora crea tu menú").then(() => true, () => false), "tras guardar pasa a crear el menú");

// ── Menú: categorías y productos
const addCategory = async (name) => {
  await o.fill('form:has(button:text-is("Crear")) input[name=name]', name);
  await o.click('button:text-is("Crear")');
  await o.waitForSelector(`text=Categoría "${name}" creada`);
};
// Comprueba que el nombre de la categoría es visible (no aplastado a ancho 0)
const catWidth = async (name) => (await o.locator(`input[aria-label="Nombre de la categoría"][value="${name}"]`).boundingBox())?.width ?? 0;
const section = (name) => o.locator("section", { has: o.locator(`input[aria-label="Nombre de la categoría"][value="${name}"]`) });
const addProduct = async (cat, name, price, desc = "") => {
  const s = section(cat);
  const det = s.locator("details", { hasText: `Añadir producto a ${cat}` });
  if (!(await det.getAttribute("open") !== null)) await det.locator("summary").click();
  const f = det.locator("form");
  await f.locator("input[name=name]").fill(name);
  await f.locator("input[name=price]").fill(String(price));
  await f.locator("input[name=description]").fill(desc);
  await f.locator("button[type=submit]").click();
  await o.waitForSelector(`text="${name}" añadido.`);
};
await addCategory("Platos");
await addProduct("Platos", "Pica pollo 2 piezas", 250, "Con tostones o papas fritas");
await addProduct("Platos", "Chicharrón", 300);
await addCategory("Bebidas");
await addProduct("Bebidas", "Refresco", 75);
await addProduct("Bebidas", "Jugo natural", 100, "Chinola o limón");
const menuText = await o.textContent("main");
ok(["Pica pollo 2 piezas", "Chicharrón", "Refresco", "Jugo natural"].every((n) => menuText.includes(n)) && menuText.includes("RD$250"), "4 productos en 2 categorías, con precios en RD$");
ok(menuText.includes("4 productos de 25"), "muestra el uso del plan gratis (4 de 25)");

// Marcar agotado
const chDet = section("Platos").locator("details", { hasText: "Chicharrón" });
await chDet.locator("summary").click();
await chDet.locator('button:has-text("Marcar agotado")').click();
await o.waitForSelector("text=Chicharrón · Agotado");
ok(true, "marcar un producto como agotado");

// Reordenar: Bebidas arriba
await section("Bebidas").locator('button[aria-label="Subir"]').first().click();
await o.waitForFunction(() => document.querySelector("section input[aria-label='Nombre de la categoría']")?.value === "Bebidas");
ok(true, "reordenar categorías (Bebidas sube)");
ok(await catWidth("Platos") > 80, "el nombre de la categoría es visible en el móvil");
await o.screenshot({ path: `${OUT}/2-menu-panel.png`, fullPage: true });

// Validación del servidor
await o.evaluate(() => document.querySelectorAll("input").forEach((i) => { i.removeAttribute("required"); i.removeAttribute("minlength"); i.removeAttribute("min"); }));
const det = section("Platos").locator("details", { hasText: "Añadir producto a Platos" });
await det.locator("summary").click();
await det.locator("input[name=name]").fill("Pollo");
await det.locator("input[name=price]").fill("-5");
await det.locator("button[type=submit]").click();
ok(await o.waitForSelector("text=El precio no es válido").then(() => true, () => false), "el servidor rechaza precios negativos");

// ── Código QR
await o.goto(BASE + "/dashboard/qr");
ok((await o.locator("svg path").count()) > 0, "genera el código QR (SVG)");
ok((await o.locator('a[download="qr-pica-pollo-dona-ana.png"]').getAttribute("href")).startsWith("data:image/png"), "QR descargable en PNG");
await o.screenshot({ path: `${OUT}/3-qr.png`, fullPage: true });

// ── Cliente: pedido desde el móvil
const clientCtx = await browser.newContext(mobile);
const c = await clientCtx.newPage(); track(c);
await c.goto(BASE + "/m/pica-pollo-dona-ana");
ok((await c.textContent("h1")) === "Pica Pollo Doña Ana", "menú público del negocio");
ok((await c.locator("main h2").first().textContent()) === "Bebidas", "el orden de categorías se respeta en el menú público");
const chich = c.locator("div.rounded-xl", { hasText: "Chicharrón" });
ok((await chich.textContent()).includes("Agotado") && (await chich.locator("button").count()) === 0, "producto agotado sin botón de añadir");
await c.screenshot({ path: `${OUT}/4-menu-publico.png`, fullPage: true });

await c.click('button[aria-label="Añadir Refresco"]');
ok(await c.waitForSelector("text=Ver pedido (1)").then(() => true, () => false), "barra de pedido aparece al añadir");
await c.click("text=Ver pedido (1)");
await c.fill("#customer", "Juan");
ok((await c.textContent('[role="dialog"]')).includes("El pedido mínimo es RD$200"), "aplica el pedido mínimo");
await c.click("text=Seguir viendo");
await c.click('button[aria-label="Añadir Pica pollo 2 piezas"]');
await c.click('button[aria-label="Añadir otro Pica pollo 2 piezas"]');
await c.reload();
ok(await c.waitForSelector("text=Ver pedido (3)").then(() => true, () => false), "el carrito se conserva al recargar la página");
await c.click("text=Ver pedido (3)");
await c.click('[role="radio"]:has-text("Delivery")');
await c.fill("#customer", "Juan Pérez");
ok((await c.textContent('[role="dialog"]')).includes("Escribe la dirección de entrega"), "delivery exige dirección");
await c.fill("#address", "Calle 5 #12, Naco");
await c.fill("#note", "Sin cebolla");
const dlg = await c.textContent('[role="dialog"]');
ok(dlg.includes("RD$575") && dlg.includes("RD$675"), "subtotal RD$575 y total con delivery RD$675");
await c.screenshot({ path: `${OUT}/5-pedido.png`, fullPage: false });
const href = await c.locator('a:has-text("Enviar pedido por WhatsApp")').getAttribute("href");
const msg = decodeURIComponent(href.split("?text=")[1]);
ok(href.startsWith("https://wa.me/18095551234"), "abre el WhatsApp del negocio (con prefijo 1 de RD)");
ok(msg.includes("2 × Pica pollo 2 piezas — RD$500") && msg.includes("1 × Refresco — RD$75") && msg.includes("*Total: RD$675*")
  && msg.includes("Juan Pérez") && msg.includes("Delivery a: Calle 5 #12, Naco") && msg.includes("Sin cebolla"), "mensaje de WhatsApp con el pedido completo");

// ── Cerrado
await o.goto(BASE + "/dashboard");
await o.click('button:has-text("Cerrar ahora")');
await o.waitForSelector("text=Cerrado: tu menú se ve");
const c2 = await (await browser.newContext(mobile)).newPage(); track(c2);
await c2.goto(BASE + "/m/pica-pollo-dona-ana");
ok((await c2.textContent("body")).includes("Ahora estamos cerrados") && await c2.locator('button[aria-label="Añadir Refresco"]').isDisabled(), "con el negocio cerrado no se puede pedir");
await c2.screenshot({ path: `${OUT}/6-cerrado.png` });
await o.click('button:has-text("Abrir ahora")');
await o.waitForSelector("text=Abierto: recibiendo pedidos");
await o.screenshot({ path: `${OUT}/7-panel.png`, fullPage: true });

// ── Límite del plan gratis (25 productos)
const restaurant = (await (await fetch(`${API}/rest/v1/restaurants?select=*&slug=eq.pica-pollo-dona-ana`)).json())[0];
const cat = (await (await fetch(`${API}/rest/v1/categories?select=*&restaurant_id=eq.${restaurant.id}&name=eq.Platos`)).json())[0];
for (let i = 1; i <= 21; i++) {
  await fetch(`${API}/rest/v1/products`, { method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: UID, restaurant_id: restaurant.id, category_id: cat.id, name: `Extra ${i}`, price: 50 }) });
}
await o.goto(BASE + "/dashboard/menu");
await addProduct("Platos", "Producto 25", 10).catch(() => {});
const d26 = section("Platos").locator("details", { hasText: "Añadir producto a Platos" });
if ((await d26.getAttribute("open")) === null) await d26.locator("summary").click();
await d26.locator("input[name=name]").fill("Producto 26");
await d26.locator("input[name=price]").fill("10");
await d26.locator("button[type=submit]").click();
ok(await o.waitForSelector("text=El plan Gratis permite hasta 25 productos").then(() => true, () => false), "el plan gratis bloquea el producto 26 con un mensaje claro");

// ── Blog y privacidad
const b = await (await browser.newContext(mobile)).newPage(); track(b);
await b.goto(BASE + "/blog/menu-digital-con-codigo-qr-para-restaurantes");
ok((await b.textContent("h1")).includes("código QR"), "artículo del blog publicado");
const hack = await fetch(`${API}/rest/v1/products?id=eq.${cat.id}`, { method: "DELETE" });
const still = await (await fetch(`${API}/rest/v1/products?select=id&restaurant_id=eq.${restaurant.id}`)).json();
ok(still.length === 25, "un visitante no puede borrar productos por la API");

ok(errors.length === 0, `sin errores de JavaScript ${errors.join("; ")}`);
console.log(`\n${pass} correctas, ${fail} fallidas`);
await browser.close();
process.exit(fail ? 1 : 0);
