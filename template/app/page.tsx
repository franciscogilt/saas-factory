import { Card, LinkButton, Navbar } from "@/components/ui";
import { product } from "@/lib/product";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/legal";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <Navbar signedIn={!!user} />
      <main>
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <p className="mb-4 text-sm font-semibold text-indigo-600">{product.tagline}</p>
          <h1 className="text-5xl font-bold tracking-tight text-balance sm:text-6xl">{product.headline}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 text-pretty">{product.subheadline}</p>
          <div className="mt-10 flex justify-center gap-3">
            <LinkButton href={user ? "/dashboard" : "/login"} className="px-6 py-3 text-base">{product.cta}</LinkButton>
            <LinkButton href="/pricing" variant="secondary" className="px-6 py-3 text-base">Ver precios</LinkButton>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {product.features.map((f) => (
            <Card key={f.title}>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{f.description}</p>
            </Card>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
