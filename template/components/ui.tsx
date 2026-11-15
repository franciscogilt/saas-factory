import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { product } from "@/lib/product";

const btn = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500",
  secondary: "bg-white text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50",
  ghost: "text-zinc-700 hover:bg-zinc-100",
};

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof btn }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${btn[variant]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return (
    <Link
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${btn[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${props.className ?? ""}`}
    />
  );
}

export function Navbar({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-zinc-100">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">{product.name}</Link>
        <div className="flex items-center gap-2">
          <LinkButton href="/pricing" variant="ghost">Precios</LinkButton>
          {signedIn ? (
            <LinkButton href="/dashboard">Panel</LinkButton>
          ) : (
            <LinkButton href="/login">{product.cta}</LinkButton>
          )}
        </div>
      </nav>
    </header>
  );
}
