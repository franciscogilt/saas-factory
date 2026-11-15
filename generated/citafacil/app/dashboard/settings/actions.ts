"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/business";
import { TIMEZONES } from "@/lib/time";

const back = (q: Record<string, string>) => redirect(`/dashboard/settings?${new URLSearchParams(q)}`);

export async function saveBusiness(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(form.get("name") ?? "").trim();
  const slug = slugify(String(form.get("slug") ?? "") || name);
  const whatsapp = String(form.get("whatsapp") ?? "").trim() || null;
  const timezone = String(form.get("timezone") ?? "");
  const open_time = String(form.get("open_time") ?? "");
  const close_time = String(form.get("close_time") ?? "");
  const slot_minutes = Number(form.get("slot_minutes"));
  const open_days = form.getAll("open_days").map(Number).filter((d) => d >= 1 && d <= 7).sort();

  if (name.length < 2) return back({ error: "Escribe el nombre de tu negocio." });
  if (slug.length < 3) return back({ error: "El enlace debe tener al menos 3 letras o números." });
  if (whatsapp && !/^\+?[0-9 ()-]{7,20}$/.test(whatsapp)) return back({ error: "El WhatsApp no parece un número válido." });
  if (!TIMEZONES.some((t) => t.id === timezone)) return back({ error: "Elige una zona horaria." });
  if (!/^\d{2}:\d{2}$/.test(open_time) || !/^\d{2}:\d{2}$/.test(close_time) || close_time <= open_time)
    return back({ error: "La hora de cierre debe ser posterior a la de apertura." });
  if (!open_days.length) return back({ error: "Elige al menos un día de trabajo." });
  if (![15, 20, 30, 45, 60].includes(slot_minutes)) return back({ error: "Intervalo de turnos no válido." });

  const { error } = await supabase.from("businesses").upsert(
    { user_id: user.id, name, slug, whatsapp, timezone, open_time, close_time, open_days, slot_minutes },
    { onConflict: "user_id" },
  );
  if (error) {
    if (error.code === "23505") return back({ error: `El enlace "${slug}" ya lo usa otro negocio. Prueba con otro.` });
    return back({ error: "No se pudo guardar. Inténtalo de nuevo." });
  }
  revalidatePath("/dashboard", "layout");

  const { count } = await supabase.from("services").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (!count) redirect("/dashboard/services?ok=" + encodeURIComponent("¡Negocio guardado! Ahora añade tus servicios."));
  return back({ ok: "Cambios guardados." });
}
