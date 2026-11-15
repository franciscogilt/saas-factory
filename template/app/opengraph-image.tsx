import { ImageResponse } from "next/og";
import { product } from "@/lib/product";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = product.name;

// Imagen para compartir en redes, generada automáticamente con el nombre y el titular.
export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg,#eef2ff,#ffffff)" }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: "#4f46e5" }}>{product.name}</div>
        <div style={{ marginTop: 24, fontSize: 72, fontWeight: 800, color: "#18181b", lineHeight: 1.1 }}>{product.headline}</div>
        <div style={{ marginTop: 24, fontSize: 32, color: "#52525b" }}>{product.subheadline}</div>
      </div>
    ),
    size,
  );
}
