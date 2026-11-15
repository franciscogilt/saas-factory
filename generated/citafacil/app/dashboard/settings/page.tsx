import { Card, Input } from "@/components/ui";
import { Flash, SubmitButton, selectCls } from "@/components/flash";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/business";
import { DAY_NAMES, TIMEZONES, hhmm } from "@/lib/time";
import { saveBusiness } from "./actions";

export const metadata = { title: "Configuración" };

type Props = { searchParams: Promise<{ ok?: string; error?: string; welcome?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const { ok, error, welcome } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: b } = await supabase.from("businesses").select("*").eq("user_id", user!.id).maybeSingle<Business>();
  const days = b?.open_days ?? [1, 2, 3, 4, 5, 6];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{b ? "Configuración" : "Configura tu negocio"}</h1>
        {(welcome || !b) && <p className="mt-1 text-zinc-600">Dos minutos y tendrás tu enlace de reservas listo para compartir.</p>}
      </div>
      <Flash ok={ok} error={error} />
      <Card>
        <form action={saveBusiness} className="space-y-5">
          <Field label="Nombre del negocio" htmlFor="name">
            <Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={b?.name} placeholder="Barbería El Estilo" />
          </Field>
          <Field label="Tu enlace de reservas" htmlFor="slug" hint="Solo letras, números y guiones. Si lo cambias, el enlace anterior dejará de funcionar.">
            <div className="flex items-center rounded-lg border border-zinc-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              <span className="pl-3 text-sm text-zinc-500">/r/</span>
              <input id="slug" name="slug" defaultValue={b?.slug} placeholder="barberia-el-estilo" className="w-full rounded-lg px-1 py-2 text-sm outline-none" pattern="[a-z0-9-]{3,40}" />
            </div>
          </Field>
          <Field label="WhatsApp del negocio" htmlFor="whatsapp" hint="Tus clientes podrán escribirte desde la página de reservas.">
            <Input id="whatsapp" name="whatsapp" type="tel" defaultValue={b?.whatsapp ?? ""} placeholder="809 555 1234" />
          </Field>
          <Field label="Zona horaria" htmlFor="timezone">
            <select id="timezone" name="timezone" defaultValue={b?.timezone ?? "America/Santo_Domingo"} className={selectCls}>
              {TIMEZONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Abre a las" htmlFor="open_time">
              <Input id="open_time" name="open_time" type="time" required defaultValue={b ? hhmm(b.open_time) : "09:00"} />
            </Field>
            <Field label="Cierra a las" htmlFor="close_time">
              <Input id="close_time" name="close_time" type="time" required defaultValue={b ? hhmm(b.close_time) : "18:00"} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Días de trabajo</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <label key={d} className="cursor-pointer">
                  <input type="checkbox" name="open_days" value={d} defaultChecked={days.includes(d)} className="peer sr-only" />
                  <span className="inline-block rounded-lg px-3 py-1.5 text-sm ring-1 ring-zinc-300 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:ring-indigo-600 peer-focus-visible:ring-2">
                    {DAY_NAMES[d].slice(0, 3)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Mostrar turnos cada" htmlFor="slot_minutes">
            <select id="slot_minutes" name="slot_minutes" defaultValue={String(b?.slot_minutes ?? 30)} className={selectCls}>
              {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
            </select>
          </Field>
          <SubmitButton className="px-5 py-2.5">{b ? "Guardar cambios" : "Crear mi negocio"}</SubmitButton>
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
