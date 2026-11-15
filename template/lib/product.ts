// La fábrica sobrescribe este archivo con los datos del PRD de cada SaaS.
export const product = {
  name: "Mi SaaS",
  tagline: "La forma más simple de resolver tu problema",
  headline: "Resuelve tu problema en minutos",
  subheadline: "Una herramienta enfocada, sin complicaciones.",
  cta: "Empieza gratis",
  features: [
    { title: "Rápido", description: "Configúralo en minutos." },
    { title: "Simple", description: "Sin curva de aprendizaje." },
    { title: "Seguro", description: "Tus datos protegidos." },
  ],
} as const;

export type Plan = { id: string; name: string; priceUsd: number; features: string[]; priceId?: string };

export const plans: Plan[] = [
  { id: "free", name: "Gratis", priceUsd: 0, features: ["Funciones básicas"], priceId: undefined },
  { id: "pro", name: "Pro", priceUsd: 19, features: ["Todo ilimitado", "Soporte prioritario"], priceId: process.env.STRIPE_PRICE_PRO },
];
