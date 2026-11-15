import { LegalPage, supportEmail } from "@/components/legal";
import { product } from "@/lib/product";

export const metadata = { title: `Términos de servicio — ${product.name}` };

// Plantilla genérica. Revísala con un abogado antes de cobrar en modo live.
export default function Terms() {
  return (
    <LegalPage title="Términos de servicio">
      <p>Al crear una cuenta o usar {product.name} aceptas estos términos.</p>
      <h2>1. El servicio</h2>
      <p>{product.name} se ofrece &quot;tal cual&quot;. Podemos mejorar, cambiar o retirar funcionalidades con aviso razonable.</p>
      <h2>2. Tu cuenta</h2>
      <p>Eres responsable de la actividad de tu cuenta y de mantener seguro el acceso a tu correo.</p>
      <h2>3. Pagos y suscripciones</h2>
      <p>Los planes de pago se cobran por adelantado cada mes a través de Stripe y se renuevan automáticamente. Puedes cancelar en cualquier momento desde Facturación; la cancelación aplica al final del periodo pagado. No hay reembolsos por periodos parciales salvo que la ley lo exija.</p>
      <h2>4. Uso aceptable</h2>
      <p>No puedes usar el servicio para actividades ilegales, enviar spam, intentar acceder a datos de otros usuarios ni sobrecargar la infraestructura.</p>
      <h2>5. Tus datos</h2>
      <p>Tú eres dueño del contenido que creas. Puedes exportarlo o pedir su eliminación. Consulta la Política de privacidad.</p>
      <h2>6. Responsabilidad</h2>
      <p>En la medida permitida por la ley, nuestra responsabilidad total se limita a lo que pagaste en los últimos 12 meses.</p>
      <h2>7. Contacto</h2>
      <p>Escríbenos a {supportEmail()}.</p>
    </LegalPage>
  );
}
