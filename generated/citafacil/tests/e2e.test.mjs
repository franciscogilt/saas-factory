import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = process.env.SHOTS_DIR ?? "./screenshots";
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? "✓" : "✗"} ${m}`); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-1111-1111-1111-111111111111";
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", aud: "authenticated", exp, email: "dueno@barberia.com" })}.sig`;
const session = { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: exp,
  user: { id: UID, aud: "authenticated", role: "authenticated", email: "dueno@barberia.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-DO", timezoneId: "America/Santo_Domingo" };

// ── Visitante: landing
const visitor = await browser.newContext(mobile);
let p = await visitor.newPage();
await p.goto(BASE + "/");
ok((await p.textContent("h1")).includes("reservan solos"), "landing muestra el titular del PRD");
await p.screenshot({ path: `${OUT}/1-landing.png`, fullPage: true });

// ── Dueño: onboarding
const owner = await browser.newContext({ ...mobile });
await owner.addCookies([{ name: "sb-localhost-auth-token", value: "base64-" + b64(session), domain: "localhost", path: "/" }]);
const o = await owner.newPage();
const errors = [];
o.on("pageerror", (e) => errors.push(e.message));
await o.goto(BASE + "/dashboard");
ok(o.url().includes("/dashboard/settings"), "dueño nuevo es enviado a configurar su negocio");
await o.fill("#name", "Barbería El Estilo");
await o.fill("#slug", "barberia-el-estilo");
await o.fill("#whatsapp", "809 555 1234");
await o.screenshot({ path: `${OUT}/2-configurar.png`, fullPage: true });
await o.click("button[type=submit]");
await o.waitForURL(/\/dashboard\/services/);
ok((await o.textContent("body")).includes("Ahora añade tus servicios"), "tras guardar, pasa a añadir servicios");

for (const [name, mins, price] of [["Corte de cabello", "30", "8"], ["Corte + barba", "45", "12"], ["Diseño de cejas", "15", "4"]]) {
  await o.fill('form:first-of-type input[name=name]', name);
  await o.fill('form:first-of-type input[name=duration_minutes]', mins);
  await o.fill('form:first-of-type input[name=price]', price);
  await o.click('form:first-of-type button[type=submit]');
  await o.waitForSelector(`text="${name}" añadido.`);
}
const svcBody = await o.textContent("body");
ok(["Corte de cabello", "Corte + barba", "Diseño de cejas"].every((n) => svcBody.includes(n)) && svcBody.includes("45 min"), "se añaden 3 servicios");
await o.click("summary:has-text('Corte de cabello')");
await o.fill("details[open] input[name=price]", "9");
await o.click("details[open] button:has-text('Guardar')");
await o.waitForSelector("text=Servicio actualizado.");
ok((await o.textContent("body")).includes("US$9.00"), "editar el precio de un servicio");
await o.screenshot({ path: `${OUT}/3-servicios.png`, fullPage: true });

// Validación: servicio sin nombre válido (se salta la validación del navegador)
await o.evaluate(() => document.querySelectorAll("input").forEach((i) => i.removeAttribute("minlength")));
await o.fill('form:first-of-type input[name=name]', "x");
await o.click('form:first-of-type button[type=submit]');
await o.waitForURL(/error=/);
ok(await o.waitForSelector("text=Escribe el nombre del servicio", { timeout: 5000 }).then(() => true, () => false), "valida en el servidor el nombre del servicio");
await o.screenshot({ path: `${OUT}/3b-validacion.png` });

await o.goto(BASE + "/dashboard");
ok((await o.textContent("body")).includes("/r/barberia-el-estilo"), "panel muestra el enlace de reservas");
ok((await o.textContent("body")).includes("0 / 30"), "panel muestra el uso del plan gratis");

// ── Cliente: reserva desde el móvil
const client = await browser.newContext(mobile);
p = await client.newPage();
await p.goto(BASE + "/r/barberia-el-estilo");
ok((await p.textContent("h1")) === "Barbería El Estilo", "página pública del negocio");
await p.screenshot({ path: `${OUT}/4-reserva-servicio.png`, fullPage: true });
await p.click("text=Corte + barba");
await p.waitForURL(/service=/);
const days = p.locator('a[href*="day="]');
ok((await days.count()) > 10, `muestra ${await days.count()} días disponibles (sin domingos)`);
ok(!(await p.textContent("body")).match(/\bdom\b/i), "no ofrece domingos (cerrado)");
await days.first().click();
await p.waitForURL(/day=/);
const slots = p.locator('a[href*="time="]');
const nSlots = await slots.count();
ok(nSlots > 5, `muestra ${nSlots} horas libres`);
await p.screenshot({ path: `${OUT}/5-reserva-hora.png`, fullPage: true });
const firstSlotHref = await slots.first().getAttribute("href");
const firstSlotText = (await slots.first().textContent()).trim();
await slots.first().click();
await p.waitForURL(/time=/);
await p.fill("#name", "María Pérez");
await p.fill("#phone", "829 555 7788");
await p.screenshot({ path: `${OUT}/6-reserva-datos.png`, fullPage: true });
await p.click("text=Confirmar reserva");
await p.waitForURL(/confirmada/);
const conf = await p.textContent("body");
ok(conf.includes("¡Listo, María!") && conf.includes("Corte + barba"), "confirmación de la reserva");
ok(conf.includes(firstSlotText), `la confirmación muestra la hora elegida (${firstSlotText})`);
await p.screenshot({ path: `${OUT}/7-confirmada.png`, fullPage: true });

// La hora reservada desaparece y no se puede volver a reservar
await p.goto(BASE + firstSlotHref.replace(/&time=[^&]+/, ""));
ok((await p.locator('a[href*="time="]').count()) === nSlots - 2 || (await p.locator('a[href*="time="]').count()) < nSlots, "la hora reservada ya no aparece");
await p.goto(BASE + firstSlotHref);
ok((await p.locator("#name").count()) === 0, "abrir el enlace antiguo de esa hora no muestra el formulario");

// Otro cliente llega tarde con el formulario abierto: el servidor rechaza el doble agendamiento
const late = await (await browser.newContext(mobile)).newPage();
const secondHref = await (async () => { await late.goto(BASE + firstSlotHref.replace(/&time=[^&]+/, "")); return late.locator('a[href*="time="]').first().getAttribute("href"); })();
const late2 = await (await browser.newContext(mobile)).newPage();
await late.goto(BASE + secondHref); await late2.goto(BASE + secondHref);
await late.fill("#name", "Juan"); await late.fill("#phone", "8095550001"); await late.click("text=Confirmar reserva"); await late.waitForURL(/confirmada/);
await late2.fill("#name", "Pedro"); await late2.fill("#phone", "8095550002"); await late2.click("text=Confirmar reserva");
await late2.waitForSelector("p[role=alert]");
ok((await late2.textContent("p[role=alert]")).includes("acaba de reservar"), "dos clientes a la vez: el segundo recibe un aviso claro");
ok((await late2.inputValue("#name")) === "Pedro" && (await late2.inputValue("#phone")) === "8095550002", "tras el aviso, conserva el nombre y teléfono escritos");
await late2.screenshot({ path: `${OUT}/8-hora-ocupada.png`, fullPage: true });

// ── Dueño: ve las citas y envía recordatorio
await o.goto(BASE + "/dashboard/appointments");
const ap = await o.textContent("body");
ok(ap.includes("María Pérez") && ap.includes("Juan") && !ap.includes("Pedro"), "el dueño ve las 2 citas reales");
const wa = await o.locator('a:has-text("Recordar por WhatsApp")').first().getAttribute("href");
ok(wa.startsWith("https://wa.me/1829") && decodeURIComponent(wa).includes("Corte + barba"), "recordatorio de WhatsApp con número RD y mensaje prellenado");
await o.screenshot({ path: `${OUT}/9-citas.png`, fullPage: true });
await o.locator('button:has-text("Cancelar")').first().click();
await o.waitForLoadState("networkidle");
ok((await o.textContent("body")).includes("Cancelada"), "el dueño cancela una cita");

// Privacidad: un visitante no puede leer citas por la API
const leak = await fetch("http://localhost:54321/rest/v1/appointments?select=*").then((r) => r.json());
ok(Array.isArray(leak) && leak.length === 0, "la API no expone citas a visitantes");

const desk = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "es-DO", timezoneId: "America/Santo_Domingo" });
await desk.addCookies([{ name: "sb-localhost-auth-token", value: "base64-" + b64(session), domain: "localhost", path: "/" }]);
const d = await desk.newPage();
await d.goto(BASE + "/dashboard");
await d.screenshot({ path: `${OUT}/10-panel-escritorio.png`, fullPage: true });

const blog = await (await browser.newContext(mobile)).newPage();
await blog.goto(BASE + "/blog/mensajes-de-recordatorio-de-cita-para-whatsapp");
ok((await blog.textContent("h1")).includes("plantillas de recordatorio"), "artículo del blog publicado");
ok((await blog.locator("h2").count()) >= 5, "el artículo tiene subtítulos (formato SEO)");
await blog.screenshot({ path: `${OUT}/11-blog.png`, fullPage: false });
ok(errors.length === 0, `sin errores de JavaScript en el navegador ${errors.join("; ")}`);
console.log(`\n${pass} correctas, ${fail} fallidas`);
await browser.close();
process.exit(fail ? 1 : 0);
