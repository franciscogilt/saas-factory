// Generado por SaaS Factory a partir del PRD. Los agentes pueden ampliarlo.
export const product = {
  "name": "CitaFácil",
  "tagline": "Reservas online para salones y barberías",
  "headline": "Tus clientes reservan solos. Tú solo atiendes.",
  "subheadline": "Comparte un enlace en tu Instagram y WhatsApp: tus clientes eligen servicio y hora libre, y tú recibes la cita en tu agenda. Gratis para empezar.",
  "cta": "Crear mi enlace gratis",
  "features": [
    {
      "title": "Enlace de reservas propio",
      "description": "Una página pública con tus servicios, precios y horarios libres. Tus clientes reservan solos, 24/7, sin escribirte."
    },
    {
      "title": "Agenda del día",
      "description": "Ve de un vistazo las citas de hoy y los próximos días, márcalas como completadas o cancélalas."
    },
    {
      "title": "Recordatorios por WhatsApp",
      "description": "Envía a cada cliente un recordatorio ya redactado con un solo toque, desde tu propio WhatsApp."
    },
    {
      "title": "Servicios y horarios",
      "description": "Define tus servicios con duración y precio, tus días y horas de trabajo. Nunca habrá dos citas a la vez."
    }
  ]
} as const;

export type Plan = { id: string; name: string; priceUsd: number; features: string[]; priceId?: string };

export const plans: Plan[] = [
  { id: "free", name: "Gratis", priceUsd: 0, features: ["Hasta 30 reservas al mes","Enlace de reservas","Recordatorios por WhatsApp"], priceId: undefined },
  { id: "pro", name: "Pro", priceUsd: 12, features: ["Reservas ilimitadas","Sin la marca CitaFácil en tu página","Soporte prioritario por WhatsApp"], priceId: process.env.STRIPE_PRICE_PRO },
];
