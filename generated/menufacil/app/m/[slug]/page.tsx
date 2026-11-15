import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Product, Restaurant } from "@/lib/menu";
import { whatsappLink } from "@/lib/order";
import { product as brand } from "@/lib/product";
import { MenuClient } from "./menu-client";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const supabase = await createClient();
  const { data: r } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle<Restaurant>();
  if (!r) return null;
  const [{ data: cats }, { data: prods }, { data: isPro }] = await Promise.all([
    supabase.from("categories").select("*").eq("restaurant_id", r.id).order("position").order("created_at"),
    supabase.from("products").select("*").eq("restaurant_id", r.id).order("position").order("created_at"),
    supabase.rpc("is_pro_restaurant", { p_restaurant: r.id }),
  ]);
  return { r, categories: (cats ?? []) as Category[], products: (prods ?? []) as Product[], isPro: !!isPro };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const { slug } = await params;
  const { data } = await supabase.from("restaurants").select("name, description").eq("slug", slug).maybeSingle();
  if (!data) return { title: "Menú no encontrado" };
  return {
    title: { absolute: `${data.name} · Menú y pedidos por WhatsApp` },
    description: data.description ?? `Mira el menú de ${data.name} y haz tu pedido por WhatsApp.`,
  };
}

export default async function PublicMenu({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { r, categories, products, isPro } = data;
  const sections = categories
    .map((c) => ({ ...c, items: products.filter((p) => p.category_id === c.id) }))
    .filter((c) => c.items.length > 0);

  return (
    <div className="min-h-screen bg-zinc-50 pb-28">
      <header className="bg-white px-4 pb-4 pt-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{r.name}</h1>
        {r.description && <p className="mx-auto mt-2 max-w-md text-zinc-600">{r.description}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-medium">
          <span className={`rounded-full px-2.5 py-1 ${r.is_open ? "bg-green-50 text-green-700" : "bg-zinc-200 text-zinc-600"}`}>
            {r.is_open ? "Abierto ahora" : "Cerrado"}
          </span>
          {r.pickup_enabled && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">Para recoger</span>}
          {r.delivery_enabled && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">Delivery</span>}
        </div>
        {r.address && <p className="mt-2 text-sm text-zinc-500">{r.address}</p>}
      </header>

      {sections.length === 0 ? (
        <main className="mx-auto max-w-xl px-4 py-16 text-center text-zinc-500">
          <p>Este menú aún se está preparando.</p>
          <a href={whatsappLink(r.whatsapp, `Hola ${r.name}, ¿qué tienen disponible hoy?`)} target="_blank" rel="noopener noreferrer"
             className="mt-4 inline-block font-medium text-green-700 hover:underline">Pregúntanos por WhatsApp</a>
        </main>
      ) : (
        <MenuClient
          slug={r.slug}
          restaurant={{
            name: r.name, whatsapp: r.whatsapp, currency: r.currency, is_open: r.is_open,
            pickup_enabled: r.pickup_enabled, delivery_enabled: r.delivery_enabled,
            delivery_fee: Number(r.delivery_fee), min_order: Number(r.min_order),
          }}
          sections={sections.map((s) => ({
            id: s.id, name: s.name,
            items: s.items.map((p) => ({ id: p.id, name: p.name, description: p.description, price: Number(p.price), available: p.available })),
          }))}
        />
      )}

      {!isPro && (
        <p className="mt-6 text-center text-xs text-zinc-400">
          Menú digital con <Link href="/" className="font-medium hover:text-zinc-600">{brand.name}</Link>
        </p>
      )}
    </div>
  );
}
