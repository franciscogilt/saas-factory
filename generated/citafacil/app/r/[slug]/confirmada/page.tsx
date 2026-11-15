import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { whatsappLink, type Business } from "@/lib/business";
import { fmtDay, fmtTime } from "@/lib/time";

export const metadata = { title: "Reserva confirmada", robots: { index: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string; s?: string; n?: string }> };

export default async function Confirmed({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t, s = "", n = "" } = await searchParams;
  const supabase = await createClient();
  const { data: b } = await supabase.from("businesses").select("*").eq("slug", slug).maybeSingle<Business>();
  if (!b || !t || Number.isNaN(Date.parse(t))) notFound();

  const tz = b.timezone;
  const when = `${fmtDay(t, tz)} a las ${fmtTime(t, tz)}`;
  const start = new Date(t);
  const gcal = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calendar = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `${s} — ${b.name}`.slice(0, 100),
    dates: `${gcal(start)}/${gcal(new Date(start.getTime() + 60 * 60_000))}`,
    details: `Cita reservada en ${b.name}.`,
  })}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-200">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
        <h1 className="mt-4 text-2xl font-bold">¡Listo{n ? `, ${n}` : ""}!</h1>
        <p className="mt-2 text-zinc-600">Tu cita está reservada.</p>
        <div className="mt-6 rounded-xl bg-zinc-50 p-4 text-left">
          <p className="font-semibold">{b.name}</p>
          {s && <p className="text-zinc-700">{s}</p>}
          <p className="text-zinc-700 first-letter:uppercase">{when}</p>
        </div>
        <div className="mt-6 grid gap-2">
          <a href={calendar} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-500">
            Añadir a mi calendario
          </a>
          {b.whatsapp && (
            <a href={whatsappLink(b.whatsapp, `Hola, acabo de reservar ${s} para el ${when}.`)} target="_blank" rel="noopener noreferrer"
               className="rounded-lg py-2.5 font-semibold text-green-700 ring-1 ring-green-200 hover:bg-green-50">
              Avisar al negocio por WhatsApp
            </a>
          )}
          <Link href={`/r/${slug}`} className="py-2 text-sm text-zinc-500 hover:text-zinc-700">Reservar otra cita</Link>
        </div>
      </div>
    </main>
  );
}
