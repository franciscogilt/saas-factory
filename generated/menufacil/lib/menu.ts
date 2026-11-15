import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const FREE_PRODUCT_LIMIT = 25; // debe coincidir con enforce_product_limit() en la migración 0002

export type Restaurant = {
  id: string; user_id: string; slug: string; name: string; description: string | null; whatsapp: string;
  currency: string; address: string | null; is_open: boolean; pickup_enabled: boolean; delivery_enabled: boolean;
  delivery_fee: number; min_order: number;
};
export type Category = { id: string; restaurant_id: string; name: string; position: number };
export type Product = {
  id: string; restaurant_id: string; category_id: string; name: string; description: string | null;
  price: number; available: boolean; position: number;
};

/** Usuario + restaurante actuales. Si aún no lo configuró, lo manda a configurarlo. */
export async function requireRestaurant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("restaurants").select("*").eq("user_id", user.id).maybeSingle<Restaurant>();
  if (!data) redirect("/dashboard/settings?welcome=1");
  return { supabase, user, restaurant: data };
}

export const publicUrl = (slug: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/m/${slug}`;

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");

export const toMoneyInput = (v: FormDataEntryValue | null) => Number(String(v ?? "0").replace(",", ".").trim() || "0");
