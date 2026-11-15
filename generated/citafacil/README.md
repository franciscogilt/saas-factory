# CitaFácil

> Reservas online para salones y barberías

Cada negocio obtiene un enlace (`/r/su-nombre`) para su Instagram y WhatsApp. Los clientes eligen servicio, día y hora libre sin crear cuenta. El dueño gestiona su agenda desde el móvil y envía recordatorios por WhatsApp con el mensaje ya escrito.

- **Plan Gratis:** 30 reservas al mes · **Pro:** US$12/mes, ilimitado y sin marca CitaFácil
- PRD completo: [docs/PRD.md](docs/PRD.md) · Kit de lanzamiento: [docs/LAUNCH.md](docs/LAUNCH.md)

## Seguridad

- Los clientes reservan solo mediante `book_appointment()` (Postgres), que valida servicio, horario, zona horaria, solapes (con bloqueo para reservas simultáneas), antispam (3 citas futuras por teléfono) y el límite del plan gratis.
- Nadie fuera del dueño puede leer nombres ni teléfonos de clientes; la página pública solo ve horas ocupadas (`get_busy_slots`).
- Campo trampa contra bots en el formulario de reserva.

## Pruebas

| Suite | Qué cubre | Resultado |
|---|---|---|
| `npm run test:sql` | RLS, reservas, solapes, horarios, zonas horarias, antispam, límites de plan | 31/31 |
| `npm run test:e2e` | Alta del negocio, servicios, reserva desde el móvil, doble reserva simultánea, agenda, recordatorio, blog | 25/25 |
| Smoke (fábrica) | Páginas públicas, dashboard protegido, webhook protegido | 9/9 |
