import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkButton, Navbar } from "@/components/ui";
import { Footer } from "@/components/legal";
import { Prose } from "@/components/prose";
import { posts } from "@/lib/posts";
import { product } from "@/lib/product";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};
  return { title: post.title, description: post.description, openGraph: { title: post.title, description: post.description, type: "article" } };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();
  return (
    <>
      <Navbar signedIn={false} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <time className="text-sm text-zinc-500">{new Date(post.date).toLocaleDateString("es", { dateStyle: "long" })}</time>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance">{post.title}</h1>
        <p className="mt-4 text-xl text-zinc-600">{post.description}</p>
        <div className="mt-10"><Prose content={post.content} /></div>
        <aside className="mt-16 rounded-2xl bg-indigo-50 p-8 text-center">
          <p className="text-xl font-semibold">{product.headline}</p>
          <p className="mt-2 text-zinc-600">{product.subheadline}</p>
          <LinkButton href="/login" className="mt-6">{product.cta}</LinkButton>
        </aside>
      </main>
      <Footer />
    </>
  );
}
