import Link from "next/link";
import { Card, LinkButton } from "@/components/ui";
import { AppointmentRow } from "@/components/appointment-row";
import { CopyLink } from "@/components/copy-link";
import { FREE_MONTHLY_BOOKINGS, publicUrl, requireBusiness, type Appointment } from "@/lib/business";
import { getUserPlan } from "@/lib/subscription";
import { addDays, dayIn, zonedToUtc } from "@/lib/time";

export default async function DashboardPage() {
  const { supabase, business } = await requireBusiness();
  const tz = business.timezone;
  const today = dayIn(new Date(), tz);
  const dayStart = zonedToUtc(today, "00:00", tz).toISOString();
  const dayEnd = zonedToUtc(addDays(today, 1), "00:00", tz).toISOString();
  const weekEnd = zonedToUtc(addDays(today, 8), "00:00", tz).toISOString();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const [todayRes, weekRes, monthRes, servicesRes, plan] = await Promise.all([
    supabase.from("appointments").select("*").eq("business_id", business.id).gte("starts_at", dayStart).lt("starts_at", dayEnd).order("starts_at"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "confirmed").gte("starts_at", dayEnd).lt("starts_at", weekEnd),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", business.id).neq("status", "cancelled").gte("created_at", monthStart),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true),
    getUserPlan(),
  ]);
  const todays = (todayRes.data ?? []) as Appointment[];
  const isFree = plan.priceUsd === 0;
  const monthCount = monthRes.count ?? 0;
  const url = publicUrl(business.slug);
  const share = `https://wa.me/?text=${encodeURIComponent(`¡Ya puedes reservar tu cita en ${business.name} desde aquí! 👉 ${url}`)}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hola, {business.name} 👋</h1>

      {!servicesRes.count && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="font-medium">Añade al menos un servicio para que tus clientes puedan reservar.</p>
          <LinkButton href="/dashboard/services" className="mt-3">Añadir servicios</LinkButton>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Tu enlace de reservas</h2>
        <p className="mt-1 text-sm text-zinc-600">Ponlo en la bio de Instagram, en tu estado de WhatsApp y en tus respuestas automáticas.</p>
        <div className="mt-4"><CopyLink url={url} /></div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <a href={share} target="_blank" rel="noopener noreferrer" className="font-medium text-green-700 hover:underline">Compartir por WhatsApp</a>
          <Link href={`/r/${business.slug}`} target="_blank" className="font-medium text-indigo-600 hover:underline">Ver mi página</Link>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Citas hoy" value={todays.filter((a) => a.status !== "cancelled").length} />
        <Stat label="Próximos 7 días" value={weekRes.count ?? 0} />
        <Stat label="Reservas este mes" value={isFree ? `${monthCount} / ${FREE_MONTHLY_BOOKINGS}` : monthCount}
          note={isFree && monthCount >= FREE_MONTHLY_BOOKINGS * 0.8 ? <Link href="/pricing" className="text-indigo-600 hover:underline">Pasa a Pro para no perder reservas</Link> : undefined} />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Agenda de hoy</h2>
          <Link href="/dashboard/appointments" className="text-sm text-indigo-600 hover:underline">Ver todas</Link>
        </div>
        {todays.length ? (
          <Card className="divide-y divide-zinc-100 p-0">
            {todays.map((a) => <AppointmentRow key={a.id} a={a} business={business} />)}
          </Card>
        ) : (
          <Card className="text-center text-zinc-500">No tienes citas hoy.</Card>
        )}
      </section>
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
