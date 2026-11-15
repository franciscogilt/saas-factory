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
    <div className="min-h-screen bg-zinc-50 print:bg-white">
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 pt-3 sm:pb-3">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/dashboard" className="font-bold">{product.name}</Link>
            <DashNav className="hidden sm:flex" />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">{plan.name}</span>
            <span className="hidden text-zinc-500 md:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-zinc-500 hover:text-zinc-900">Salir</button>
            </form>
          </div>
        </div>
        <DashNav className="flex px-6 pb-3 pt-2 sm:hidden" />
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10 print:p-0">{children}</main>
    </div>
  );
}

const NAV = [["/dashboard", "Inicio"], ["/dashboard/menu", "Menú"], ["/dashboard/qr", "QR"], ["/dashboard/settings", "Ajustes"], ["/dashboard/billing", "Plan"]];

function DashNav({ className = "" }: { className?: string }) {
  return (
    <nav className={`gap-4 overflow-x-auto text-sm text-zinc-600 ${className}`}>
      {NAV.map(([href, label]) => <Link key={href} href={href} className="shrink-0 hover:text-zinc-900">{label}</Link>)}
    </nav>
  );
}
