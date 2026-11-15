import Link from "next/link";
import { Navbar } from "@/components/ui";
import { Footer } from "@/components/legal";
import { posts } from "@/lib/posts";
import { product } from "@/lib/product";

export const metadata = { title: "Blog", description: `Guías y consejos de ${product.name}` };

export default function BlogIndex() {
  return (
    <>
      <Navbar signedIn={false} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
        <p className="mt-3 text-zinc-600">Guías prácticas de {product.name}.</p>
        <div className="mt-12 space-y-10">
          {posts.length === 0 && <p className="text-zinc-500">Pronto publicaremos nuevos artículos.</p>}
          {posts.map((p) => (
            <article key={p.slug}>
              <time className="text-sm text-zinc-500">{new Date(p.date).toLocaleDateString("es", { dateStyle: "long" })}</time>
              <h2 className="mt-1 text-2xl font-semibold">
                <Link href={`/blog/${p.slug}`} className="hover:text-indigo-600">{p.title}</Link>
              </h2>
              <p className="mt-2 text-zinc-600">{p.description}</p>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
