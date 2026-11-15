import Link from "next/link";
import { Card, LinkButton } from "@/components/ui";
import { CopyLink } from "@/components/copy-link";
import { SubmitButton } from "@/components/flash";
import { FREE_PRODUCT_LIMIT, publicUrl, requireRestaurant } from "@/lib/menu";
import { getUserPlan } from "@/lib/subscription";
import { toggleOpen } from "./settings/actions";

export default async function DashboardPage() {
  const { supabase, restaurant: r } = await requireRestaurant();
  const [cats, prods, soldOut, plan] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id).eq("available", false),
    getUserPlan(),
  ]);
  const nProducts = prods.count ?? 0;
  const isFree = plan.priceUsd === 0;
  const url = publicUrl(r.slug);
  const share = `https://wa.me/?text=${encodeURIComponent(`¡Mira nuestro menú y haz tu pedido por WhatsApp! 👉 ${url}`)}`;

  const steps = [
    { done: true, label: "Datos del negocio", href: "/dashboard/settings" },
    { done: (cats.count ?? 0) > 0 && nProducts > 0, label: "Crear el menú", href: "/dashboard/menu" },
    { done: false, label: "Imprimir el código QR", href: "/dashboard/qr" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{r.name}</h1>

      <Card className={r.is_open ? "border-green-200" : "border-amber-200 bg-amber-50"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{r.is_open ? "🟢 Abierto: recibiendo pedidos" : "🔴 Cerrado: tu menú se ve, pero no se puede pedir"}</p>
            <p className="text-sm text-zinc-600">Cambia el estado cuando abras o cierres.</p>
          </div>
          <form action={toggleOpen}>
            <input type="hidden" name="is_open" value={String(!r.is_open)} />
            <SubmitButton variant={r.is_open ? "secondary" : "primary"}>{r.is_open ? "Cerrar ahora" : "Abrir ahora"}</SubmitButton>
          </form>
        </div>
      </Card>

      {nProducts === 0 && (
        <Card>
          <h2 className="font-semibold">Primeros pasos</h2>
          <ol className="mt-3 space-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-green-600 text-white" : "bg-zinc-200 text-zinc-600"}`}>{s.done ? "✓" : i + 1}</span>
                <Link href={s.href} className={s.done ? "text-zinc-500 line-through" : "font-medium text-indigo-600 hover:underline"}>{s.label}</Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Tu menú online</h2>
        <p className="mt-1 text-sm text-zinc-600">Ponlo en tu Instagram, tu estado de WhatsApp y tu respuesta automática.</p>
        <div className="mt-4"><CopyLink url={url} /></div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <a href={share} target="_blank" rel="noopener noreferrer" className="font-medium text-green-700 hover:underline">Compartir por WhatsApp</a>
          <Link href={`/m/${r.slug}`} target="_blank" className="font-medium text-indigo-600 hover:underline">Ver mi menú</Link>
          <Link href="/dashboard/qr" className="font-medium text-indigo-600 hover:underline">Código QR</Link>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Productos" value={isFree ? `${nProducts} / ${FREE_PRODUCT_LIMIT}` : nProducts}
          note={isFree && nProducts >= FREE_PRODUCT_LIMIT - 5 ? <Link href="/pricing" className="text-indigo-600 hover:underline">Pasa a Pro para añadir más</Link> : undefined} />
        <Stat label="Categorías" value={cats.count ?? 0} />
        <Stat label="Agotados" value={soldOut.count ?? 0} />
      </div>

      {nProducts > 0 && <LinkButton href="/dashboard/menu" variant="secondary">Editar menú</LinkButton>}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <Card>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {note && <p className="mt-2 text-sm">{note}</p>}
    </Card>
  );
}
