import { Card } from "@/components/ui";
import { product } from "@/lib/product";

// Los agentes de la fábrica reemplazan esta página con la funcionalidad principal del SaaS.
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bienvenido a {product.name}</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {product.features.map((f) => (
          <Card key={f.title}>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">{f.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
