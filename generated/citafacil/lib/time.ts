// Utilidades de fecha sin dependencias. Las horas se guardan en UTC y se muestran en la zona del negocio.

export const TIMEZONES = [
  { id: "America/Santo_Domingo", label: "República Dominicana / Puerto Rico" },
  { id: "America/Mexico_City", label: "México (Centro)" },
  { id: "America/Bogota", label: "Colombia / Perú / Ecuador / Panamá" },
  { id: "America/Caracas", label: "Venezuela" },
  { id: "America/Santiago", label: "Chile" },
  { id: "America/Argentina/Buenos_Aires", label: "Argentina / Uruguay" },
  { id: "America/Guatemala", label: "Centroamérica" },
  { id: "America/New_York", label: "EE. UU. (Este)" },
  { id: "Europe/Madrid", label: "España" },
];

export const DAY_NAMES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function offsetMs(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - date.getTime();
}

/** "2026-11-16" + "09:00" en una zona horaria → instante UTC. */
export function zonedToUtc(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = offsetMs(new Date(guess), tz);
  const off2 = offsetMs(new Date(guess - off), tz); // corrige cambios de horario
  return new Date(guess - off2);
}

/** Fecha local (YYYY-MM-DD) de un instante en una zona horaria. */
export function dayIn(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo */
export function isoDow(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const hhmm = (t: string) => t.slice(0, 5);

export function fmtTime(date: Date | string, tz: string) {
  return new Intl.DateTimeFormat("es", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(date));
}

export function fmtDay(date: Date | string, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  const d = typeof date === "string" && isDay(date) ? zonedToUtc(date, "12:00", tz) : new Date(date);
  return new Intl.DateTimeFormat("es", { timeZone: tz, ...opts }).format(d);
}

export type Busy = { starts_at: string; ends_at: string };

/** Turnos libres de un día para un servicio, respetando horario, citas existentes y un margen mínimo. */
export function freeSlots(opts: {
  day: string; tz: string; open: string; close: string; slotMinutes: number; duration: number; busy: Busy[]; now?: Date;
}): string[] {
  const { day, tz, slotMinutes, duration, busy } = opts;
  const now = (opts.now ?? new Date()).getTime() + 15 * 60_000;
  const start = zonedToUtc(day, hhmm(opts.open), tz).getTime();
  const end = zonedToUtc(day, hhmm(opts.close), tz).getTime();
  const taken = busy.map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()]);
  const out: string[] = [];
  for (let t = start; t + duration * 60_000 <= end; t += slotMinutes * 60_000) {
    const tEnd = t + duration * 60_000;
    if (t < now) continue;
    if (taken.some(([s, e]) => t < e && tEnd > s)) continue;
    out.push(new Date(t).toISOString());
  }
  return out;
}
