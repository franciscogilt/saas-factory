// Lógica pura del pedido (sin dependencias de servidor): se usa en el navegador y en las pruebas.

export const CURRENCIES = {
  DOP: { label: "Peso dominicano (RD$)", locale: "es-DO" },
  USD: { label: "Dólar (US$)", locale: "es-DO" },
  MXN: { label: "Peso mexicano (MX$)", locale: "es-MX" },
  COP: { label: "Peso colombiano (COP)", locale: "es-CO" },
  EUR: { label: "Euro (€)", locale: "es-ES" },
} as const;
export type Currency = keyof typeof CURRENCIES;

export function money(n: number, currency: string) {
  const c = (currency in CURRENCIES ? currency : "USD") as Currency;
  const v = Number(n);
  // Sin decimales cuando el precio es redondo: "RD$250" en vez de "RD$250.00".
  const digits = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat(CURRENCIES[c].locale, { style: "currency", currency: c, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

/** Enlace de WhatsApp. Números de 10 dígitos de RD (809/829/849) reciben el prefijo 1. */
export function whatsappLink(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) digits = "1" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export type CartLine = { id: string; name: string; price: number; qty: number };
export type OrderInput = {
  restaurant: { name: string; currency: string; delivery_fee: number };
  lines: CartLine[];
  mode: "pickup" | "delivery";
  customer: string;
  address?: string;
  note?: string;
};

export function totals(lines: CartLine[], mode: "pickup" | "delivery", deliveryFee: number) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
  const delivery = mode === "delivery" ? Number(deliveryFee) : 0;
  return { subtotal, delivery, total: Math.round((subtotal + delivery) * 100) / 100 };
}

/** Mensaje de pedido claro y fácil de leer para el restaurante. */
export function orderMessage(o: OrderInput) {
  const m = (n: number) => money(n, o.restaurant.currency);
  const t = totals(o.lines, o.mode, o.restaurant.delivery_fee);
  const lines = o.lines.filter((l) => l.qty > 0).map((l) => `• ${l.qty} × ${l.name} — ${m(l.price * l.qty)}`);
  const out = [
    `🛒 *Nuevo pedido para ${o.restaurant.name}*`,
    "",
    ...lines,
    "",
    `Subtotal: ${m(t.subtotal)}`,
    ...(o.mode === "delivery" ? [`Delivery: ${m(t.delivery)}`] : []),
    `*Total: ${m(t.total)}*`,
    "",
    `👤 ${o.customer.trim()}`,
    o.mode === "delivery" ? `🛵 Delivery a: ${o.address?.trim()}` : "🏪 Paso a recoger",
    ...(o.note?.trim() ? [`📝 ${o.note.trim()}`] : []),
  ];
  return out.join("\n");
}
