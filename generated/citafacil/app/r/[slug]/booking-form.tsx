"use client";

import { useActionState } from "react";
import { book, type BookState } from "./actions";

export function BookingForm(props: { slug: string; business: string; service: string; starts: string; summary: string }) {
  const [state, action, pending] = useActionState<BookState, FormData>(book, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="business" value={props.business} />
      <input type="hidden" name="service" value={props.service} />
      <input type="hidden" name="starts" value={props.starts} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>No rellenes este campo <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <p className="rounded-lg bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-900">{props.summary}</p>
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">Tu nombre</label>
        <input id="name" name="name" key={`n-${state.name}`} defaultValue={state.name} required minLength={2} maxLength={80} autoComplete="name"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      </div>
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium">Tu WhatsApp</label>
        <input id="phone" name="phone" key={`p-${state.phone}`} defaultValue={state.phone} type="tel" required autoComplete="tel" placeholder="809 555 1234" pattern="\+?[0-9 ()\-]{7,20}"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        <p className="mt-1 text-xs text-zinc-500">Solo lo usará el negocio para confirmarte o recordarte la cita.</p>
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}{" "}
          {/ocupad|reservar esa hora|ya no está disponible/.test(state.error) && (
            <a href={`/r/${props.slug}?service=${props.service}`} className="font-semibold underline">Ver horas libres</a>
          )}
        </p>
      )}
      <button disabled={pending} className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Reservando…" : "Confirmar reserva"}
      </button>
    </form>
  );
}
