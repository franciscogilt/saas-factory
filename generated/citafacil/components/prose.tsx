/** Renderiza el formato simple de lib/posts.ts sin dependencias: párrafos, "## " subtítulos, "- " listas, **negritas**. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export function Prose({ content }: { content: string }) {
  const blocks = content.trim().split(/\n\s*\n/);
  return (
    <div className="space-y-5 text-lg leading-relaxed text-zinc-700">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} className="pt-4 text-2xl font-bold text-zinc-900">{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- ")))
          return (
            <ul key={i} className="list-disc space-y-2 pl-6">
              {lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}
            </ul>
          );
        return <p key={i}>{inline(b)}</p>;
      })}
    </div>
  );
}
