/** Mensaje de éxito o error pasado por la URL (?ok= / ?error=) tras una Server Action. */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (ok) return <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{ok}</p>;
  return null;
}

export function SubmitButton({ children, variant = "primary", className = "" }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; className?: string }) {
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500",
    secondary: "bg-white text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50",
    danger: "text-red-600 hover:bg-red-50",
    ghost: "text-zinc-600 hover:bg-zinc-100",
  };
  return (
    <button type="submit" className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold transition ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export const selectCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
