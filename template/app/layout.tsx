import type { Metadata } from "next";
import "./globals.css";
import { product } from "@/lib/product";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: `${product.name} — ${product.tagline}`, template: `%s · ${product.name}` },
  description: product.subheadline,
  openGraph: { title: product.headline, description: product.subheadline, siteName: product.name, type: "website" },
  twitter: { card: "summary_large_image", title: product.headline, description: product.subheadline },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
