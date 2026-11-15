"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BookState = { error?: string; name?: string; phone?: string };

export async function book(_: BookState, form: FormData): Promise<BookState> {
  const slug = String(form.get("slug") ?? "");
  const business = String(form.get("business") ?? "");
  const service = String(form.get("service") ?? "");
  const starts = String(form.get("starts") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  // Campo trampa: invisible para personas, los bots lo rellenan.
  if (String(form.get("website") ?? "")) return { error: "No pudimos completar la reserva." };
  if (Number.isNaN(Date.parse(starts))) return { error: "Elige una hora.", name, phone };

  const supabase = await createClient();
  const { error } = await supabase.rpc("book_appointment", {
    p_business: business, p_service: service, p_starts: starts, p_name: name, p_phone: phone,
  });
  // Los errores P0001 son mensajes pensados para el cliente; el resto se ocultan.
  // Devolvemos nombre y teléfono para que el cliente no tenga que escribirlos de nuevo.
  if (error) return { error: error.code === "P0001" ? error.message : "No pudimos completar la reserva. Inténtalo de nuevo.", name, phone };

  const { data: svc } = await supabase.from("services").select("name").eq("id", service).maybeSingle();
  redirect(`/r/${slug}/confirmada?${new URLSearchParams({ t: starts, s: svc?.name ?? "", n: name.split(" ")[0] })}`);
}
