import Link from "next/link";
import type { ReactNode } from "react";
import { product } from "@/lib/product";

export const supportEmail = () => process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "soporte@example.com";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-indigo-600">← {product.name}</Link>
      <h1 className="mt-6 text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Última actualización: {new Date().getFullYear()}</p>
      <div className="mt-8 space-y-4 text-zinc-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900">
        {children}
      </div>
    </main>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-zinc-100 py-8 text-sm text-zinc-500">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
        <span>© {new Date().getFullYear()} {product.name}</span>
        <nav className="flex gap-5">
          <Link href="/pricing" className="hover:text-zinc-900">Precios</Link>
          <Link href="/terms" className="hover:text-zinc-900">Términos</Link>
          <Link href="/privacy" className="hover:text-zinc-900">Privacidad</Link>
        </nav>
      </div>
    </footer>
  );
}
