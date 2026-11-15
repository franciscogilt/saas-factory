import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl, getStripe } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });

  const sub = await getSubscription(user.id);
  if (!sub?.stripe_customer_id) return NextResponse.redirect(new URL("/pricing", request.url), { status: 303 });

  const portal = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl()}/dashboard/billing`,
  });
  return NextResponse.redirect(portal.url, { status: 303 });
}
