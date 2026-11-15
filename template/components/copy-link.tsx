"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Tu enlace de reservas"
        className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm" />
      <button type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* el usuario puede copiar a mano */ }
        }}
        className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
        {copied ? "¡Copiado!" : "Copiar enlace"}
      </button>
    </div>
  );
}
