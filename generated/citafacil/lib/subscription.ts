import "server-only";
import { createClient } from "@/lib/supabase/server";
import { plans, type Plan } from "@/lib/product";

export type Subscription = {
  status: string;
  plan_id: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
};

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, plan_id, stripe_customer_id, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/** Plan activo del usuario actual (o el gratis). */
export async function getUserPlan(): Promise<Plan> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const free = plans.find((p) => p.priceUsd === 0) ?? plans[0];
  if (!user) return free;
  const sub = await getSubscription(user.id);
  if (!sub || !["active", "trialing"].includes(sub.status)) return free;
  return plans.find((p) => p.id === sub.plan_id) ?? free;
}
