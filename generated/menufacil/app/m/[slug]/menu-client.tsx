"use client";

import { useEffect, useMemo, useState } from "react";
import { money, orderMessage, totals, whatsappLink, type CartLine } from "@/lib/order";

type Item = { id: string; name: string; description: string | null; price: number; available: boolean };
type Section = { id: string; name: string; items: Item[] };
type R = {
  name: string; whatsapp: string; currency: string; is_open: boolean;
  pickup_enabled: boolean; delivery_enabled: boolean; delivery_fee: number; min_order: number;
};

const storeKey = (slug: string) => `menufacil:cart:${slug}`;

export function MenuClient({ slug, restaurant: r, sections }: { slug: string; restaurant: R; sections: Section[] }) {
  const byId = useMemo(() => new Map(sections.flatMap((s) => s.items).map((i) => [i.id, i])), [sections]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pickup" | "delivery">(r.pickup_enabled ? "pickup" : "delivery");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  // Recupera el carrito guardado (si el navegador lo permite) y descarta productos que ya no existen o se agotaron.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey(slug)) ?? "{}") as Record<string, number>;
      setQty(Object.fromEntries(Object.entries(saved).filter(([id, n]) => byId.get(id)?.available && n > 0)));
      const c = JSON.parse(localStorage.getItem("menufacil:customer") ?? "{}");
      if (c.customer) setCustomer(c.customer);
      if (c.address) setAddress(c.address);
    } catch { /* almacenamiento no disponible: el carrito vive solo en memoria */ }
  }, [slug, byId]);
  useEffect(() => {
    try { localStorage.setItem(storeKey(slug), JSON.stringify(qty)); } catch { /* idem */ }
  }, [qty, slug]);

  const lines: CartLine[] = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, name: byId.get(id)!.name, price: byId.get(id)!.price, qty: n }))
    .filter((l) => byId.get(l.id)?.available);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const t = totals(lines, mode, r.delivery_fee);
  const m = (n: number) => money(n, r.currency);

  const add = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(99, (q[id] ?? 0) + d)) }));

  const problem =
    !r.is_open ? "El negocio está cerrado ahora mismo." :
    count === 0 ? "Tu pedido está vacío." :
    t.subtotal < r.min_order ? `El pedido mínimo es ${m(r.min_order)}.` :
    customer.trim().length < 2 ? "Escribe tu nombre." :
    mode === "delivery" && address.trim().length < 5 ? "Escribe la dirección de entrega." :
    null;
  const message = orderMessage({ restaurant: r, lines, mode, customer, address, note });
  const link = whatsappLink(r.whatsapp, message);

  const remember = () => {
    try { localStorage.setItem("menufacil:customer", JSON.stringify({ customer, address })); } catch { /* idem */ }
  };

  return (
    <>
      {!r.is_open && (
        <p className="mx-auto mt-4 max-w-xl rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          Ahora estamos cerrados. Puedes ver el menú, pero no hacer pedidos.
        </p>
      )}

      {sections.length > 1 && (
        <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur" aria-label="Categorías">
          {sections.map((s) => (
            <a key={s.id} href={`#cat-${s.id}`} className="shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200">{s.name}</a>
          ))}
        </nav>
      )}

      <main className="mx-auto max-w-xl px-4">
        {sections.map((s) => (
          <section key={s.id} id={`cat-${s.id}`} className="scroll-mt-16 pt-6">
            <h2 className="mb-3 text-xl font-bold">{s.name}</h2>
            <div className="space-y-2">
              {s.items.map((i) => {
                const n = qty[i.id] ?? 0;
                return (
                  <div key={i.id} className={`flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200 ${i.available ? "" : "opacity-60"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{i.name}</p>
                      {i.description && <p className="text-sm text-zinc-500">{i.description}</p>}
                      <p className="mt-1 font-semibold">{m(i.price)}</p>
                    </div>
                    {!i.available ? (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">Agotado</span>
                    ) : n === 0 ? (
                      <button type="button" disabled={!r.is_open} onClick={() => add(i.id, 1)} aria-label={`Añadir ${i.name}`}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-zinc-300">
                        Añadir
                      </button>
                    ) : (
                      <Stepper n={n} name={i.name} onChange={(d) => add(i.id, d)} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {count > 0 && !open && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-4">
          <button type="button" onClick={() => setOpen(true)}
            className="mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-indigo-600 px-5 py-4 font-semibold text-white shadow-lg hover:bg-indigo-500">
            <span>Ver pedido ({count})</span><span>{m(t.subtotal)}</span>
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Tu pedido"
             onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Tu pedido</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100">Seguir viendo</button>
            </div>

            <ul className="mt-4 divide-y divide-zinc-100">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-sm text-zinc-500">{m(l.price * l.qty)}</p>
                  </div>
                  <Stepper n={l.qty} name={l.name} onChange={(d) => add(l.id, d)} />
                </li>
              ))}
            </ul>

            {r.pickup_enabled && r.delivery_enabled && (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1" role="radiogroup" aria-label="Entrega">
                {(["pickup", "delivery"] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
                    className={`rounded-lg py-2 text-sm font-semibold ${mode === v ? "bg-white shadow-sm" : "text-zinc-600"}`}>
                    {v === "pickup" ? "Paso a recoger" : `Delivery${r.delivery_fee > 0 ? ` (+${m(r.delivery_fee)})` : ""}`}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <Field id="customer" label="Tu nombre">
                <input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} autoComplete="name" maxLength={60} className={inputCls} />
              </Field>
              {mode === "delivery" && (
                <Field id="address" label="Dirección de entrega">
                  <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={200} autoComplete="street-address"
                    placeholder="Calle, número, sector y alguna referencia" className={inputCls} />
                </Field>
              )}
              <Field id="note" label="Nota (opcional)">
                <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Sin cebolla, pago en efectivo…" className={inputCls} />
              </Field>
            </div>

            <dl className="mt-4 space-y-1 border-t border-zinc-100 pt-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{m(t.subtotal)}</dd></div>
              {mode === "delivery" && <div className="flex justify-between"><dt>Delivery</dt><dd>{m(t.delivery)}</dd></div>}
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{m(t.total)}</dd></div>
            </dl>

            {problem && <p className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600" role="status">{problem}</p>}
            {problem ? (
              <button type="button" disabled className="mt-4 w-full rounded-xl bg-zinc-300 py-3.5 font-semibold text-white">Enviar pedido por WhatsApp</button>
            ) : (
              <a href={link} target="_blank" rel="noopener noreferrer" onClick={remember}
                 className="mt-4 block w-full rounded-xl bg-green-600 py-3.5 text-center font-semibold text-white hover:bg-green-500">
                Enviar pedido por WhatsApp
              </a>
            )}
            <p className="mt-2 text-center text-xs text-zinc-500">Se abrirá WhatsApp con tu pedido listo. Solo tienes que enviarlo.</p>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Stepper({ n, name, onChange }: { n: number; name: string; onChange: (d: number) => void }) {
  const b = "flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-indigo-700 hover:bg-indigo-100";
  return (
    <div className="flex items-center rounded-lg bg-indigo-50">
      <button type="button" className={b} onClick={() => onChange(-1)} aria-label={`Quitar uno de ${name}`}>−</button>
      <span className="w-7 text-center font-semibold" aria-live="polite">{n}</span>
      <button type="button" className={b} onClick={() => onChange(1)} aria-label={`Añadir otro ${name}`}>+</button>
    </div>
  );
}
