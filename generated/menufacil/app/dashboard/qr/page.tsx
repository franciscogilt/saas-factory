import QRCode from "qrcode";
import { publicUrl, requireRestaurant } from "@/lib/menu";
import { PrintButton } from "./print-button";

export const metadata = { title: "Código QR" };

export default async function QrPage() {
  const { restaurant: r } = await requireRestaurant();
  const url = publicUrl(r.slug);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#18181b", light: "#ffffff" } });
  const pngDataUrl = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: "M" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Tu código QR</h1>
          <p className="mt-1 text-sm text-zinc-600">Imprímelo para tus mesas, el mostrador o la puerta. Siempre abre tu menú actualizado.</p>
        </div>
        <div className="flex gap-2">
          <a href={pngDataUrl} download={`qr-${r.slug}.png`} className="rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50">Descargar PNG</a>
          <PrintButton />
        </div>
      </div>

      {/* Cartel imprimible */}
      <div className="mx-auto max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm print:max-w-none print:border-0 print:shadow-none">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Menú digital</p>
        <h2 className="mt-2 text-3xl font-bold text-balance">{r.name}</h2>
        <div className="mx-auto mt-6 w-64 print:w-96" aria-label={`Código QR que abre ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-6 text-lg font-semibold">Escanea, elige y pide por WhatsApp</p>
        <p className="mt-1 break-all text-sm text-zinc-500">{url.replace(/^https?:\/\//, "")}</p>
      </div>
    </div>
  );
}
