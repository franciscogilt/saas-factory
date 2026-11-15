// Generado por SaaS Factory a partir del PRD. Los agentes pueden ampliarlo.
export const product = {
  "name": "MenúFácil",
  "tagline": "Menú digital con QR y pedidos por WhatsApp",
  "headline": "Tu menú en el móvil de tus clientes. Los pedidos, en tu WhatsApp.",
  "subheadline": "Crea tu menú digital con código QR en 5 minutos. Tus clientes eligen y te envían el pedido completo por WhatsApp, sin comisiones.",
  "cta": "Crear mi menú gratis",
  "features": [
    {
      "title": "Menú siempre al día",
      "description": "Cambia precios, añade platos o marca algo como agotado desde tu móvil. Tus clientes lo ven al instante."
    },
    {
      "title": "Código QR para imprimir",
      "description": "Descarga tu QR listo para poner en las mesas, el mostrador o la puerta."
    },
    {
      "title": "Pedidos ordenados por WhatsApp",
      "description": "El cliente elige, y te llega un mensaje con cada producto, cantidad, total, nombre y dirección. Sin errores ni idas y vueltas."
    },
    {
      "title": "Sin comisiones",
      "description": "Los pedidos llegan directo a tu WhatsApp. No pagas un porcentaje por cada venta."
    }
  ]
} as const;

export type Plan = { id: string; name: string; priceUsd: number; features: string[]; priceId?: string };

export const plans: Plan[] = [
  { id: "free", name: "Gratis", priceUsd: 0, features: ["Hasta 25 productos","Código QR","Pedidos por WhatsApp"], priceId: undefined },
  { id: "pro", name: "Pro", priceUsd: 9, features: ["Productos ilimitados","Sin la marca MenúFácil en tu menú","Soporte prioritario por WhatsApp"], priceId: process.env.STRIPE_PRICE_PRO },
];
