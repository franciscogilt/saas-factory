import Link from "next/link";
import { Card } from "@/components/ui";
import { AppointmentRow } from "@/components/appointment-row";
import { requireBusiness, type Appointment } from "@/lib/business";
import { dayIn, fmtDay } from "@/lib/time";

export const metadata = { title: "Citas" };

type Props = { searchParams: Promise<{ view?: string }> };

export default async function AppointmentsPage({ searchParams }: Props) {
  const view = (await searchParams).view === "past" ? "past" : "upcoming";
  const { supabase, business } = await requireBusiness();
  const now = new Date().toISOString();

  const q = supabase.from("appointments").select("*").eq("business_id", business.id);
  const { data } = view === "upcoming"
    ? await q.gte("ends_at", now).order("starts_at").limit(200)
    : await q.lt("ends_at", now).order("starts_at", { ascending: false }).limit(100);
  const appts = (data ?? []) as Appointment[];

  // Agrupar por día local del negocio
  const groups = new Map<string, Appointment[]>();
  for (const a of appts) {
    const d = dayIn(new Date(a.starts_at), business.timezone);
    groups.set(d, [...(groups.get(d) ?? []), a]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Citas</h1>
        <nav className="flex rounded-lg bg-zinc-100 p-1 text-sm">
          {[["upcoming", "Próximas"], ["past", "Anteriores"]].map(([v, l]) => (
            <Link key={v} href={`/dashboard/appointments?view=${v}`}
              className={`rounded-md px-3 py-1.5 font-medium ${view === v ? "bg-white shadow-sm" : "text-zinc-600"}`}>{l}</Link>
          ))}
        </nav>
      </div>

      {appts.length === 0 && (
        <Card className="text-center text-zinc-500">
          {view === "upcoming" ? "No tienes citas próximas. Comparte tu enlace de reservas para recibir las primeras." : "Aún no hay citas anteriores."}
        </Card>
      )}

      {[...groups].map(([day, list]) => (
        <section key={day}>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500 first-letter:uppercase">{fmtDay(day, business.timezone)}</h2>
          <Card className="divide-y divide-zinc-100 p-0">
            {list.map((a) => <AppointmentRow key={a.id} a={a} business={business} />)}
          </Card>
        </section>
      ))}
    </div>
  );
}
