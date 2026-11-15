import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-3xl font-bold">Página no encontrada</h1>
      <p className="mt-3 text-zinc-600">La página que buscas no existe o fue movida.</p>
      <LinkButton href="/" className="mt-8">Volver al inicio</LinkButton>
    </main>
  );
}
