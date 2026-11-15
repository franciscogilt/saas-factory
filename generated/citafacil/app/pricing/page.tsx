import { Button, Card, LinkButton, Navbar } from "@/components/ui";
import { plans } from "@/lib/product";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/legal";

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <Navbar signedIn={!!user} />
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-center text-4xl font-bold tracking-tight">Precios simples</h1>
        <p className="mt-3 text-center text-zinc-600">Empieza gratis. Mejora cuando lo necesites.</p>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <h2 className="font-semibold">{p.name}</h2>
              <p className="mt-2 text-4xl font-bold">${p.priceUsd}<span className="text-base font-normal text-zinc-500">/mes</span></p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-zinc-600">
                {p.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <div className="mt-8">
                {p.priceUsd === 0 ? (
                  <LinkButton href={user ? "/dashboard" : "/login"} variant="secondary" className="w-full">Empezar gratis</LinkButton>
                ) : (
                  <form action="/api/stripe/checkout" method="post">
                    <input type="hidden" name="plan" value={p.id} />
                    <Button className="w-full">Elegir {p.name}</Button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
