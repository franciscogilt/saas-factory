"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";
import { product } from "@/lib/product";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setState("error"); } else setState("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <Card className="w-full max-w-sm">
        <Link href="/" className="text-lg font-bold">{product.name}</Link>
        {state === "sent" ? (
          <p className="mt-6 text-sm text-zinc-600">Revisa tu correo: te enviamos un enlace para entrar a <b>{email}</b>.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">Correo electrónico</label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </div>
            {state === "error" && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={state === "sending"}>
              {state === "sending" ? "Enviando…" : "Recibir enlace de acceso"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
