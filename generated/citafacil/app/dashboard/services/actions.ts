"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/business";

const back = (q: Record<string, string>) => redirect(`/dashboard/services?${new URLSearchParams(q)}`);

function parse(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const duration = Number(form.get("duration_minutes"));
  const price = Number(String(form.get("price") ?? "0").replace(",", "."));
  if (name.length < 2 || name.length > 80) return { error: "Escribe el nombre del servicio." } as const;
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) return { error: "La duración debe estar entre 5 y 480 minutos." } as const;
  if (!Number.isFinite(price) || price < 0) return { error: "El precio no es válido." } as const;
  return { name, duration_minutes: duration, price: Math.round(price * 100) / 100 } as const;
}

export async function addService(form: FormData) {
  const { supabase, user, business } = await requireBusiness();
  const v = parse(form);
  if ("error" in v) return back({ error: v.error! });
  const { error } = await supabase.from("services").insert({ ...v, user_id: user.id, business_id: business.id });
  if (error) return back({ error: "No se pudo añadir el servicio." });
  revalidatePath("/dashboard/services");
  back({ ok: `"${v.name}" añadido.` });
}

export async function updateService(form: FormData) {
  const { supabase, user } = await requireBusiness();
  const v = parse(form);
  if ("error" in v) return back({ error: v.error! });
  const { error } = await supabase.from("services").update(v).eq("id", String(form.get("id"))).eq("user_id", user.id);
  if (error) return back({ error: "No se pudo guardar el servicio." });
  revalidatePath("/dashboard/services");
  back({ ok: "Servicio actualizado." });
}

export async function toggleService(form: FormData) {
  const { supabase, user } = await requireBusiness();
  await supabase.from("services").update({ active: form.get("active") === "true" }).eq("id", String(form.get("id"))).eq("user_id", user.id);
  revalidatePath("/dashboard/services");
}

export async function deleteService(form: FormData) {
  const { supabase, user } = await requireBusiness();
  // Las citas existentes conservan el nombre del servicio (service_name), así que borrar es seguro.
  await supabase.from("services").delete().eq("id", String(form.get("id"))).eq("user_id", user.id);
  revalidatePath("/dashboard/services");
  back({ ok: "Servicio eliminado." });
}
