import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/subscription";
import { product } from "@/lib/product";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const plan = await getUserPlan();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-bold">{product.name}</Link>
            <nav className="flex gap-4 text-sm text-zinc-600">
              <Link href="/dashboard" className="hover:text-zinc-900">Inicio</Link>
              <Link href="/dashboard/billing" className="hover:text-zinc-900">Facturación</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">{plan.name}</span>
            <span className="hidden text-zinc-500 sm:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-zinc-500 hover:text-zinc-900">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
