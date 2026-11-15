import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { money, whatsappLink, type Business, type Service } from "@/lib/business";
import { addDays, dayIn, fmtDay, fmtTime, freeSlots, isDay, isoDow, zonedToUtc, type Busy } from "@/lib/time";
import { product } from "@/lib/product";
import { BookingForm } from "./booking-form";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; day?: string; time?: string }>;
};

const DAYS_AHEAD = 21;

async function load(slug: string) {
  const supabase = await createClient();
  const { data: business } = await supabase.from("businesses").select("*").eq("slug", slug).maybeSingle<Business>();
  if (!business) return null;
  const { data: services } = await supabase.from("services").select("*").eq("business_id", business.id).eq("active", true).order("created_at");
  return { supabase, business, services: (services ?? []) as Service[] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const { slug } = await params;
  const { data } = await supabase.from("businesses").select("name").eq("slug", slug).maybeSingle();
  if (!data) return { title: "Negocio no encontrado" };
  return { title: { absolute: `Reserva en ${data.name}` }, description: `Reserva tu cita en ${data.name} en segundos, sin llamadas ni mensajes.` };
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await load(slug);
  if (!ctx) notFound();
  const { supabase, business: b, services } = ctx;
  const tz = b.timezone;

  const service = services.find((s) => s.id === sp.service);
  const today = dayIn(new Date(), tz);
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)).filter((d) => b.open_days.includes(isoDow(d)));
  const day = service && isDay(sp.day) && days.includes(sp.day) ? sp.day : undefined;

  let slots: string[] = [];
  if (service && day) {
    const { data } = await supabase.rpc("get_busy_slots", {
      p_business: b.id,
      p_from: zonedToUtc(day, "00:00", tz).toISOString(),
      p_to: zonedToUtc(addDays(day, 1), "00:00", tz).toISOString(),
    });
    slots = freeSlots({ day, tz, open: b.open_time, close: b.close_time, slotMinutes: b.slot_minutes, duration: service.duration_minutes, busy: (data ?? []) as Busy[] });
  }
  const time = day && sp.time && slots.includes(sp.time) ? sp.time : undefined;
  const { data: isPro } = await supabase.rpc("is_pro_business", { p_business: b.id });

  const href = (q: Record<string, string | undefined>) =>
    `/r/${slug}?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-xl px-4 py-10">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{b.name}</h1>
          <p className="mt-2 text-zinc-600">Reserva tu cita en menos de un minuto.</p>
          {b.whatsapp && (
            <a href={whatsappLink(b.whatsapp, `Hola ${b.name}, tengo una pregunta:`)} target="_blank" rel="noopener noreferrer"
               className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline">¿Dudas? Escríbenos por WhatsApp</a>
          )}
        </header>

        {/* 1. Servicio */}
        <Step n={1} title="Elige el servicio" done={!!service} summary={service && `${service.name} · ${service.duration_minutes} min`} editHref={href({})}>
          {services.length === 0 ? (
            <p className="text-sm text-zinc-500">Este negocio aún no ha publicado sus servicios.</p>
          ) : (
            <div className="grid gap-2">
              {services.map((s) => (
                <Link key={s.id} href={href({ service: s.id })}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-indigo-400">
                  <span><span className="font-medium">{s.name}</span><span className="block text-sm text-zinc-500">{s.duration_minutes} min</span></span>
                  {Number(s.price) > 0 && <span className="font-semibold">{money(s.price)}</span>}
                </Link>
              ))}
            </div>
          )}
        </Step>

        {/* 2. Día */}
        {service && (
          <Step n={2} title="Elige el día" done={!!day} summary={day && fmtDay(day, tz)} editHref={href({ service: service.id })}>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {days.map((d) => (
                <Link key={d} href={href({ service: service.id, day: d })}
                  className="rounded-xl border border-zinc-200 bg-white px-2 py-2 text-center hover:border-indigo-400">
                  <span className="block text-xs text-zinc-500 first-letter:uppercase">{d === today ? "Hoy" : fmtDay(d, tz, { weekday: "short" })}</span>
                  <span className="block text-lg font-semibold">{fmtDay(d, tz, { day: "numeric" })}</span>
                  <span className="block text-xs text-zinc-500">{fmtDay(d, tz, { month: "short" })}</span>
                </Link>
              ))}
            </div>
          </Step>
        )}

        {/* 3. Hora */}
        {service && day && (
          <Step n={3} title="Elige la hora" done={!!time} summary={time && fmtTime(time, tz)} editHref={href({ service: service.id, day })}>
            {slots.length === 0 ? (
              <p className="text-sm text-zinc-500">No quedan horas libres este día. Prueba con otro.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((t) => (
                  <Link key={t} href={href({ service: service.id, day, time: t })}
                    className="rounded-lg border border-zinc-200 bg-white py-2 text-center font-medium hover:border-indigo-400">
                    {fmtTime(t, tz)}
                  </Link>
                ))}
              </div>
            )}
          </Step>
        )}

        {/* 4. Datos */}
        {service && day && time && (
          <Step n={4} title="Tus datos">
            <BookingForm slug={slug} business={b.id} service={service.id} starts={time}
              summary={`${service.name} · ${fmtDay(day, tz)} a las ${fmtTime(time, tz)}`} />
          </Step>
        )}

        {!isPro && (
          <p className="mt-10 text-center text-xs text-zinc-400">
            Reservas con <Link href="/" className="font-medium hover:text-zinc-600">{product.name}</Link>
          </p>
        )}
      </main>
    </div>
  );
}

function Step({ n, title, done, summary, editHref, children }: {
  n: number; title: string; done?: boolean; summary?: string; editHref?: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-green-600 text-white" : "bg-indigo-600 text-white"}`}>
          {done ? "✓" : n}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {done && summary ? (
        <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-zinc-200">
          <span className="first-letter:uppercase">{summary}</span>
          {editHref && <Link href={editHref} className="text-sm font-medium text-indigo-600 hover:underline">Cambiar</Link>}
        </div>
      ) : children}
    </section>
  );
}
