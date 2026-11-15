import { Card, Input } from "@/components/ui";
import { Flash, SubmitButton } from "@/components/flash";
import { money, requireBusiness, type Service } from "@/lib/business";
import { addService, deleteService, toggleService, updateService } from "./actions";

export const metadata = { title: "Servicios" };

const SUGGESTIONS = ["Corte de cabello · 30 min", "Lavado y secado · 45 min", "Manicura · 45 min", "Barba · 20 min", "Tinte · 120 min"];

type Props = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function ServicesPage({ searchParams }: Props) {
  const { ok, error } = await searchParams;
  const { supabase, business } = await requireBusiness();
  const { data } = await supabase.from("services").select("*").eq("business_id", business.id).order("created_at");
  const services = (data ?? []) as Service[];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Servicios</h1>
        <p className="mt-1 text-zinc-600">Lo que tus clientes pueden reservar. La duración define cuánto tiempo se bloquea en tu agenda.</p>
      </div>
      <Flash ok={ok} error={error} />

      <Card>
        <h2 className="font-semibold">Añadir servicio</h2>
        <form action={addService} className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_120px_auto] sm:items-end">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <Input name="name" required minLength={2} maxLength={80} placeholder="Corte de cabello" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Minutos</span>
            <Input name="duration_minutes" type="number" min={5} max={480} step={5} defaultValue={30} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Precio (US$)</span>
            <Input name="price" type="number" min={0} step="0.01" defaultValue={0} />
          </label>
          <SubmitButton className="py-2">Añadir</SubmitButton>
        </form>
        {services.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500">Ideas: {SUGGESTIONS.join(" · ")}</p>
        )}
      </Card>

      {services.length > 0 && (
        <Card className="divide-y divide-zinc-100 p-0">
          {services.map((s) => (
            <details key={s.id} className={`group p-4 ${s.active ? "" : "bg-zinc-50"}`}>
              <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${s.active ? "" : "text-zinc-400"}`}>{s.name}</p>
                  <p className="text-sm text-zinc-500">{s.duration_minutes} min · {money(s.price)}{!s.active && " · Oculto"}</p>
                </div>
                <span className="text-sm font-medium text-indigo-600 group-open:hidden">Editar</span>
                <span className="hidden text-sm font-medium text-zinc-500 group-open:inline">Cerrar</span>
              </summary>
              <form action={updateService} className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_110px_auto] sm:items-end">
                <input type="hidden" name="id" value={s.id} />
                <label className="text-sm"><span className="mb-1 block font-medium">Nombre</span>
                  <Input name="name" defaultValue={s.name} required minLength={2} maxLength={80} /></label>
                <label className="text-sm"><span className="mb-1 block font-medium">Minutos</span>
                  <Input name="duration_minutes" type="number" min={5} max={480} step={5} defaultValue={s.duration_minutes} /></label>
                <label className="text-sm"><span className="mb-1 block font-medium">Precio</span>
                  <Input name="price" type="number" min={0} step="0.01" defaultValue={s.price} /></label>
                <SubmitButton className="py-2">Guardar</SubmitButton>
              </form>
              <div className="mt-3 flex gap-2">
                <form action={toggleService}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={String(!s.active)} />
                  <SubmitButton variant="secondary">{s.active ? "Ocultar de mi página" : "Mostrar en mi página"}</SubmitButton>
                </form>
                <form action={deleteService}>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton variant="danger">Eliminar</SubmitButton>
                </form>
              </div>
            </details>
          ))}
        </Card>
      )}
    </div>
  );
}
