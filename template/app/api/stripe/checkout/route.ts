import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl, getStripe } from "@/lib/stripe";
import { plans } from "@/lib/product";
import { getSubscription } from "@/lib/subscription";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });

  const form = await request.formData();
  const plan = plans.find((p) => p.id === form.get("plan"));
  if (!plan?.priceId) return NextResponse.json({ error: "Plan no válido" }, { status: 400 });

  const sub = await getSubscription(user.id);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    client_reference_id: user.id,
    customer: sub?.stripe_customer_id ?? undefined,
    customer_email: sub?.stripe_customer_id ? undefined : user.email,
    subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
    metadata: { user_id: user.id, plan_id: plan.id },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/dashboard/billing?success=1`,
    cancel_url: `${appUrl()}/pricing`,
  });
  return NextResponse.redirect(session.url!, { status: 303 });
}
