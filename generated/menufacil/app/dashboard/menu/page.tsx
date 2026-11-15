import Link from "next/link";
import { Card, Input } from "@/components/ui";
import { Flash, SubmitButton } from "@/components/flash";
import { FREE_PRODUCT_LIMIT, requireRestaurant, type Category, type Product } from "@/lib/menu";
import { money } from "@/lib/order";
import { getUserPlan } from "@/lib/subscription";
import { addCategory, addProduct, deleteCategory, deleteProduct, move, renameCategory, toggleAvailable, updateProduct } from "./actions";

export const metadata = { title: "Menú" };

type Props = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function MenuPage({ searchParams }: Props) {
  const { ok, error } = await searchParams;
  const { supabase, restaurant: r } = await requireRestaurant();
  const [{ data: cats }, { data: prods }, plan] = await Promise.all([
    supabase.from("categories").select("*").eq("restaurant_id", r.id).order("position").order("created_at"),
    supabase.from("products").select("*").eq("restaurant_id", r.id).order("position").order("created_at"),
    getUserPlan(),
  ]);
  const categories = (cats ?? []) as Category[];
  const products = (prods ?? []) as Product[];
  const isFree = plan.priceUsd === 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menú</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {products.length} producto{products.length === 1 ? "" : "s"}
            {isFree && <> de {FREE_PRODUCT_LIMIT} en el plan Gratis · <Link href="/pricing" className="text-indigo-600 hover:underline">Pasar a Pro</Link></>}
          </p>
        </div>
        <Link href={`/m/${r.slug}`} target="_blank" className="text-sm font-medium text-indigo-600 hover:underline">Ver mi menú →</Link>
      </div>
      <Flash ok={ok} error={error} />

      {categories.map((c, ci) => {
        const items = products.filter((p) => p.category_id === c.id);
        return (
          <section key={c.id} id={`c-${c.id}`} className="scroll-mt-24">
            <Card className="p-0">
              <div className="border-b border-zinc-100 p-4">
                <form action={renameCategory} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="name" defaultValue={c.name} aria-label="Nombre de la categoría" required minLength={2} maxLength={60}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold outline-none hover:border-zinc-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  <SubmitButton variant="ghost">Guardar nombre</SubmitButton>
                </form>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <MoveButtons table="categories" id={c.id} first={ci === 0} last={ci === categories.length - 1} />
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton variant="danger">Eliminar categoría</SubmitButton>
                  </form>
                </div>
              </div>

              <div className="divide-y divide-zinc-100">
                {items.length === 0 && <p className="p-4 text-sm text-zinc-500">Aún no hay productos en esta categoría.</p>}
                {items.map((p, pi) => (
                  <details key={p.id} className={`group p-4 ${p.available ? "" : "bg-zinc-50"}`}>
                    <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${p.available ? "" : "text-zinc-400"}`}>{p.name}{!p.available && " · Agotado"}</p>
                        {p.description && <p className="truncate text-sm text-zinc-500">{p.description}</p>}
                      </div>
                      <span className="whitespace-nowrap font-semibold">{money(p.price, r.currency)}</span>
                      <span className="text-sm font-medium text-indigo-600 group-open:hidden">Editar</span>
                      <span className="hidden text-sm font-medium text-zinc-500 group-open:inline">Cerrar</span>
                    </summary>
                    <form action={updateProduct} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="category_id" value={c.id} />
                      <label className="text-sm"><span className="mb-1 block font-medium">Nombre</span>
                        <Input name="name" defaultValue={p.name} required minLength={2} maxLength={80} /></label>
                      <label className="text-sm"><span className="mb-1 block font-medium">Precio</span>
                        <Input name="price" type="number" min={0} step="0.01" defaultValue={p.price} required /></label>
                      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Descripción</span>
                        <Input name="description" defaultValue={p.description ?? ""} maxLength={200} /></label>
                      <div><SubmitButton className="py-2">Guardar</SubmitButton></div>
                    </form>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <form action={toggleAvailable}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="available" value={String(!p.available)} />
                        <SubmitButton variant="secondary">{p.available ? "Marcar agotado" : "Marcar disponible"}</SubmitButton>
                      </form>
                      <MoveButtons table="products" id={p.id} categoryId={c.id} first={pi === 0} last={pi === items.length - 1} />
                      <form action={deleteProduct} className="ml-auto">
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton variant="danger">Eliminar</SubmitButton>
                      </form>
                    </div>
                  </details>
                ))}
              </div>

              <details className="border-t border-zinc-100 p-4" open={items.length === 0}>
                <summary className="cursor-pointer text-sm font-semibold text-indigo-600">+ Añadir producto a {c.name}</summary>
                <form action={addProduct} className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
                  <input type="hidden" name="category_id" value={c.id} />
                  <label className="text-sm"><span className="mb-1 block font-medium">Nombre</span>
                    <Input name="name" required minLength={2} maxLength={80} placeholder="Pica pollo 2 piezas" /></label>
                  <label className="text-sm"><span className="mb-1 block font-medium">Precio</span>
                    <Input name="price" type="number" min={0} step="0.01" required placeholder="250" /></label>
                  <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Descripción (opcional)</span>
                    <Input name="description" maxLength={200} placeholder="Con tostones o papas fritas" /></label>
                  <div><SubmitButton className="py-2">Añadir producto</SubmitButton></div>
                </form>
              </details>
            </Card>
          </section>
        );
      })}

      <Card>
        <h2 className="font-semibold">{categories.length ? "Nueva categoría" : "Empieza creando una categoría"}</h2>
        <p className="mt-1 text-sm text-zinc-500">Por ejemplo: Platos, Bebidas, Postres, Combos.</p>
        <form action={addCategory} className="mt-3 flex gap-2">
          <Input name="name" required minLength={2} maxLength={60} placeholder="Bebidas" aria-label="Nombre de la categoría" />
          <SubmitButton className="shrink-0 py-2">Crear</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

function MoveButtons({ table, id, categoryId, first, last }: { table: string; id: string; categoryId?: string; first: boolean; last: boolean }) {
  const btn = "rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30";
  return (
    <div className="flex">
      {(["up", "down"] as const).map((dir) => (
        <form key={dir} action={move}>
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="id" value={id} />
          {categoryId && <input type="hidden" name="category_id" value={categoryId} />}
          <input type="hidden" name="dir" value={dir} />
          <button className={btn} disabled={dir === "up" ? first : last} aria-label={dir === "up" ? "Subir" : "Bajar"}>{dir === "up" ? "↑" : "↓"}</button>
        </form>
      ))}
    </div>
  );
}
