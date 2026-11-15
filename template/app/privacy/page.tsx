import { LegalPage, supportEmail } from "@/components/legal";
import { product } from "@/lib/product";

export const metadata = { title: `Política de privacidad — ${product.name}` };

// Plantilla genérica. Revísala con un abogado antes de cobrar en modo live.
export default function Privacy() {
  return (
    <LegalPage title="Política de privacidad">
      <p>Esta política explica qué datos recoge {product.name} y cómo los usamos.</p>
      <h2>Qué recogemos</h2>
      <p>Tu correo electrónico para iniciar sesión, el contenido que creas dentro de la aplicación y datos técnicos básicos (como registros de errores). Los pagos los procesa Stripe: nunca vemos ni guardamos los datos de tu tarjeta.</p>
      <h2>Para qué</h2>
      <p>Para darte acceso al servicio, procesar tu suscripción, darte soporte y mejorar el producto. No vendemos tus datos.</p>
      <h2>Con quién se comparten</h2>
      <p>Solo con los proveedores necesarios para operar: Supabase (base de datos y autenticación), Stripe (pagos) y Vercel (alojamiento).</p>
      <h2>Tus derechos</h2>
      <p>Puedes acceder, corregir, exportar o eliminar tus datos en cualquier momento escribiendo a {supportEmail()}.</p>
      <h2>Seguridad</h2>
      <p>Los datos viajan cifrados y cada usuario solo puede acceder a su propia información mediante políticas de seguridad a nivel de fila.</p>
    </LegalPage>
  );
}
