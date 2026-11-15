import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature")!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    return NextResponse.json({ error: `Firma inválida: ${(e as Error).message}` }, { status: 400 });
  }

  const db = createAdminClient();

  async function sync(subId: string) {
    const sub = await stripe.subscriptions.retrieve(subId);
    const userId = sub.metadata.user_id;
    if (!userId) return;
    const periodEnd = sub.items.data[0]?.current_period_end;
    await db.from("subscriptions").upsert({
      user_id: userId,
      status: sub.status,
      plan_id: sub.metadata.plan_id ?? "free",
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.subscription) await sync(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await sync(event.data.object.id);
      break;
  }
  return NextResponse.json({ received: true });
}
