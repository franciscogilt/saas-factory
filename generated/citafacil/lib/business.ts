import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const FREE_MONTHLY_BOOKINGS = 30; // debe coincidir con book_appointment() en la migración 0002

export type Business = {
  id: string; user_id: string; slug: string; name: string; whatsapp: string | null; timezone: string;
  open_time: string; close_time: string; open_days: number[]; slot_minutes: number;
};
export type Service = { id: string; business_id: string; name: string; duration_minutes: number; price: number; active: boolean };
export type Appointment = {
  id: string; service_name: string; client_name: string; client_phone: string;
  starts_at: string; ends_at: string; status: "confirmed" | "completed" | "cancelled" | "no_show";
};

/** Usuario + negocio actuales. Si aún no configuró su negocio, lo manda a configurarlo. */
export async function requireBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("businesses").select("*").eq("user_id", user.id).maybeSingle<Business>();
  if (!data) redirect("/dashboard/settings?welcome=1");
  return { supabase, user, business: data };
}

export const publicUrl = (slug: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/r/${slug}`;

export const money = (n: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));

/** Enlace de WhatsApp con mensaje prellenado. Números de 10 dígitos de RD (809/829/849) reciben el prefijo 1. */
export function whatsappLink(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) digits = "1" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
