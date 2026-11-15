import { Card, Input } from "@/components/ui";
import { Flash, SubmitButton, selectCls } from "@/components/flash";
import { createClient } from "@/lib/supabase/server";
import type { Restaurant } from "@/lib/menu";
import { CURRENCIES } from "@/lib/order";
import { saveRestaurant } from "./actions";

export const metadata = { title: "Ajustes" };

type Props = { searchParams: Promise<{ ok?: string; error?: string; welcome?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: r } = await supabase.from("restaurants").select("*").eq("user_id", user!.id).maybeSingle<Restaurant>();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{r ? "Ajustes" : "Crea tu menú digital"}</h1>
        {!r && <p className="mt-1 text-zinc-600">Primero, los datos de tu negocio. Luego añadirás tus productos.</p>}
      </div>
      <Flash ok={ok} error={error} />
      <Card>
        <form action={saveRestaurant} className="space-y-5">
          <Field label="Nombre del negocio" htmlFor="name">
            <Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={r?.name} placeholder="Pica Pollo Doña Ana" />
          </Field>
          <Field label="Enlace de tu menú" htmlFor="slug" hint="Solo letras, números y guiones. Si lo cambias, tendrás que reimprimir tu QR.">
            <div className="flex items-center rounded-lg border border-zinc-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <span className="pl-3 text-sm text-zinc-500">/m/</span>
              <input id="slug" name="slug" defaultValue={r?.slug} placeholder="pica-pollo-dona-ana" pattern="[a-z0-9-]{3,40}" className="w-full rounded-lg px-1 py-2 text-sm outline-none" />
            </div>
          </Field>
          <Field label="WhatsApp para recibir pedidos" htmlFor="whatsapp">
            <Input id="whatsapp" name="whatsapp" type="tel" required defaultValue={r?.whatsapp} placeholder="809 555 1234" />
          </Field>
          <Field label="Descripción corta (opcional)" htmlFor="description">
            <Input id="description" name="description" maxLength={200} defaultValue={r?.description ?? ""} placeholder="Pica pollo, chicharrón y tostones desde 1998" />
          </Field>
          <Field label="Dirección (opcional)" htmlFor="address">
            <Input id="address" name="address" maxLength={200} defaultValue={r?.address ?? ""} placeholder="Av. Duarte 45, Santo Domingo" />
          </Field>
          <Field label="Moneda" htmlFor="currency">
            <select id="currency" name="currency" defaultValue={r?.currency ?? "DOP"} className={selectCls}>
              {Object.entries(CURRENCIES).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
            </select>
          </Field>
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium">¿Cómo entregas los pedidos?</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pickup_enabled" defaultChecked={r?.pickup_enabled ?? true} className="h-4 w-4 accent-indigo-600" /> El cliente pasa a recoger
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="delivery_enabled" defaultChecked={r?.delivery_enabled ?? false} className="h-4 w-4 accent-indigo-600" /> Delivery
            </label>
          </fieldset>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Costo del delivery" htmlFor="delivery_fee">
              <Input id="delivery_fee" name="delivery_fee" type="number" min={0} step="0.01" defaultValue={r?.delivery_fee ?? 0} />
            </Field>
            <Field label="Pedido mínimo" htmlFor="min_order">
              <Input id="min_order" name="min_order" type="number" min={0} step="0.01" defaultValue={r?.min_order ?? 0} />
            </Field>
          </div>
          <SubmitButton className="px-5 py-2.5">{r ? "Guardar cambios" : "Crear mi negocio"}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
