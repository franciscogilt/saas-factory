"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/business";

const STATUSES = ["confirmed", "completed", "cancelled", "no_show"] as const;

export async function setStatus(form: FormData) {
  const status = String(form.get("status"));
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;
  const { supabase, user } = await requireBusiness();
  await supabase.from("appointments").update({ status }).eq("id", String(form.get("id"))).eq("user_id", user.id);
  revalidatePath("/dashboard", "layout");
}
