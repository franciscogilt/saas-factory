# MenúFácil

> Menú digital con QR y pedidos por WhatsApp

Cada negocio obtiene un menú online (`/m/su-nombre`) y un cartel con código QR para imprimir. El cliente elige en su móvil y envía el pedido por WhatsApp ya ordenado: productos, cantidades, total, nombre, recogida o delivery con dirección y notas. Sin comisiones por pedido.

- **Plan Gratis:** hasta 25 productos · **Pro:** US$9/mes, ilimitado y sin marca MenúFácil
- PRD completo: [docs/PRD.md](docs/PRD.md) · Kit de lanzamiento: [docs/LAUNCH.md](docs/LAUNCH.md)

## Menú de demostración (para vender)

Después de publicar, crea el negocio de ejemplo que se enseña en las visitas (`/m/demo-pica-pollo`, 13 productos en 3 categorías):

```bash
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… DEMO_WHATSAPP="809 …" npm run seed:demo
```

Con `DEMO_WHATSAPP` = tu número, los pedidos de prueba de la demo te llegan a ti. Puedes ejecutarlo de nuevo cuando quieras: rehace el menú sin duplicarlo.

## Funciones

- Categorías y productos con precio, descripción, orden y "agotado" en tiempo real
- Abierto o cerrado con un toque (cerrado: el menú se ve, pero no se puede pedir)
- Recogida y/o delivery con costo de envío y pedido mínimo
- Carrito que se conserva al recargar; nombre y dirección recordados para el siguiente pedido
- Monedas: RD$, US$, MX$, COP, €

## Seguridad

- El cliente no escribe nada en la base de datos: el pedido viaja por WhatsApp, así que no hay formularios públicos que atacar.
- RLS: cada dueño solo gestiona su restaurante; ni siquiera puede meter productos en categorías ajenas.
- El límite de 25 productos del plan gratis se aplica en Postgres (trigger), no solo en la interfaz.

## Pruebas

| Suite | Qué cubre | Resultado |
|---|---|---|
| `npm run test:sql` | RLS entre dueños y público, límites del plan, borrados en cascada | 23/23 |
| `npm run test:order` | Totales, delivery, redondeo y mensaje de WhatsApp | 7/7 |
| `npm run test:e2e` | Alta, menú, agotados, orden, QR, pedido completo en móvil, mínimo, cerrado, límite del plan, blog | 26/26 |
| Smoke (fábrica) | Páginas públicas, dashboard protegido, webhook protegido | 9/9 |
