import { Button, Card, LinkButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, getUserPlan } from "@/lib/subscription";

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [plan, sub] = await Promise.all([getUserPlan(), getSubscription(user!.id)]);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Facturación</h1>
      <Card>
        <p className="text-sm text-zinc-500">Plan actual</p>
        <p className="mt-1 text-xl font-semibold">{plan.name}{plan.priceUsd > 0 && ` · $${plan.priceUsd}/mes`}</p>
        {sub?.current_period_end && (
          <p className="mt-1 text-sm text-zinc-500">Renueva el {new Date(sub.current_period_end).toLocaleDateString("es")}</p>
        )}
        <div className="mt-6">
          {sub?.stripe_customer_id ? (
            <form action="/api/stripe/portal" method="post">
              <Button variant="secondary">Gestionar suscripción</Button>
            </form>
          ) : (
            <LinkButton href="/pricing">Mejorar plan</LinkButton>
          )}
        </div>
      </Card>
    </div>
  );
}
