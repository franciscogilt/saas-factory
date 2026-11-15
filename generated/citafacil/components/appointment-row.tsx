import { SubmitButton } from "@/components/flash";
import { whatsappLink, type Appointment, type Business } from "@/lib/business";
import { fmtDay, fmtTime } from "@/lib/time";
import { setStatus } from "@/app/dashboard/appointments/actions";

const BADGE: Record<Appointment["status"], [string, string]> = {
  confirmed: ["Confirmada", "bg-indigo-50 text-indigo-700"],
  completed: ["Completada", "bg-green-50 text-green-700"],
  cancelled: ["Cancelada", "bg-zinc-100 text-zinc-500"],
  no_show: ["No vino", "bg-amber-50 text-amber-700"],
};

export function AppointmentRow({ a, business, showDay = false }: { a: Appointment; business: Business; showDay?: boolean }) {
  const tz = business.timezone;
  const [label, cls] = BADGE[a.status];
  const reminder =
    `Hola ${a.client_name.split(" ")[0]} 👋 Te recordamos tu cita de ${a.service_name} en ${business.name} ` +
    `el ${fmtDay(a.starts_at, tz)} a las ${fmtTime(a.starts_at, tz)}. Si no puedes venir, avísanos por aquí. ¡Te esperamos!`;
  const future = new Date(a.starts_at) > new Date();

  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <div className="w-24 shrink-0">
          <p className="whitespace-nowrap font-semibold">{fmtTime(a.starts_at, tz)}</p>
          {showDay && <p className="text-xs text-zinc-500">{fmtDay(a.starts_at, tz, { weekday: "short", day: "numeric", month: "short" })}</p>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-medium ${a.status === "cancelled" ? "text-zinc-400 line-through" : ""}`}>{a.client_name}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
          </div>
          <p className="text-sm text-zinc-500">{a.service_name}</p>
          <a href={`tel:${a.client_phone.replace(/[^\d+]/g, "")}`} className="text-sm text-zinc-500 hover:text-zinc-800">{a.client_phone}</a>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1 sm:pl-28">
        {a.status === "confirmed" && future && (
          <a href={whatsappLink(a.client_phone, reminder)} target="_blank" rel="noopener noreferrer"
             className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-500">
            Recordar por WhatsApp
          </a>
        )}
        {a.status === "confirmed" && (
          <>
            <StatusButton id={a.id} status="completed" label="Completada" />
            {!future && <StatusButton id={a.id} status="no_show" label="No vino" />}
            <StatusButton id={a.id} status="cancelled" label="Cancelar" danger />
          </>
        )}
        {a.status !== "confirmed" && <StatusButton id={a.id} status="confirmed" label="Reabrir" />}
      </div>
    </div>
  );
}

function StatusButton({ id, status, label, danger }: { id: string; status: string; label: string; danger?: boolean }) {
  return (
    <form action={setStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={danger ? "danger" : "ghost"}>{label}</SubmitButton>
    </form>
  );
}
