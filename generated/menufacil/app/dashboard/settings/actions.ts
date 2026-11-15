"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify, toMoneyInput } from "@/lib/menu";
import { CURRENCIES } from "@/lib/order";

const back = (q: Record<string, string>) => redirect(`/dashboard/settings?${new URLSearchParams(q)}`);

export async function saveRestaurant(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(form.get("name") ?? "").trim();
  const slug = slugify(String(form.get("slug") ?? "") || name);
  const whatsapp = String(form.get("whatsapp") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const address = String(form.get("address") ?? "").trim() || null;
  const currency = String(form.get("currency") ?? "");
  const pickup_enabled = form.get("pickup_enabled") === "on";
  const delivery_enabled = form.get("delivery_enabled") === "on";
  const delivery_fee = toMoneyInput(form.get("delivery_fee"));
  const min_order = toMoneyInput(form.get("min_order"));

  if (name.length < 2) return back({ error: "Escribe el nombre de tu negocio." });
  if (slug.length < 3) return back({ error: "El enlace debe tener al menos 3 letras o números." });
  if (!/^\+?[0-9 ()-]{7,20}$/.test(whatsapp)) return back({ error: "Escribe el WhatsApp donde quieres recibir los pedidos." });
  if (!(currency in CURRENCIES)) return back({ error: "Elige una moneda." });
  if (!pickup_enabled && !delivery_enabled) return back({ error: "Activa al menos una opción: recoger o delivery." });
  if (!Number.isFinite(delivery_fee) || delivery_fee < 0 || !Number.isFinite(min_order) || min_order < 0)
    return back({ error: "Revisa el costo de delivery y el pedido mínimo." });
  if ((description?.length ?? 0) > 200 || (address?.length ?? 0) > 200) return back({ error: "La descripción y la dirección admiten hasta 200 caracteres." });

  const { error } = await supabase.from("restaurants").upsert(
    { user_id: user.id, name, slug, whatsapp, description, address, currency, pickup_enabled, delivery_enabled, delivery_fee, min_order },
    { onConflict: "user_id" },
  );
  if (error) {
    if (error.code === "23505") return back({ error: `El enlace "${slug}" ya lo usa otro negocio. Prueba con otro.` });
    return back({ error: "No se pudo guardar. Inténtalo de nuevo." });
  }
  revalidatePath("/", "layout");

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (!count) redirect("/dashboard/menu?ok=" + encodeURIComponent("¡Listo! Ahora crea tu menú."));
  return back({ ok: "Cambios guardados." });
}

export async function toggleOpen(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("restaurants").update({ is_open: form.get("is_open") === "true" }).eq("user_id", user.id);
  revalidatePath("/", "layout");
}
