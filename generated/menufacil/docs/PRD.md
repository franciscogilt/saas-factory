# MenúFácil

> Menú digital con QR y pedidos por WhatsApp

## Problema
Restaurantes pequeños, cafeterías, food trucks y colmados reciben pedidos por WhatsApp de forma desordenada: el cliente pregunta qué hay y cuánto cuesta, se pierden detalles del pedido y el menú impreso queda desactualizado cada vez que cambia un precio.

## Cliente objetivo
Dueños de restaurantes pequeños, cafeterías, food trucks, pica pollos y colmados en Latinoamérica (inicialmente República Dominicana) que ya venden por WhatsApp y no tienen web ni app de pedidos.

## Propuesta de valor
Un menú online siempre actualizado, con su código QR para la mesa o el mostrador. El cliente arma su pedido en el móvil y lo envía por WhatsApp ya ordenado, con cantidades, total y dirección. Sin comisiones por pedido.

## Funcionalidades
- **Menú siempre al día**: Cambia precios, añade platos o marca algo como agotado desde tu móvil. Tus clientes lo ven al instante.
- **Código QR para imprimir**: Descarga tu QR listo para poner en las mesas, el mostrador o la puerta.
- **Pedidos ordenados por WhatsApp**: El cliente elige, y te llega un mensaje con cada producto, cantidad, total, nombre y dirección. Sin errores ni idas y vueltas.
- **Sin comisiones**: Los pedidos llegan directo a tu WhatsApp. No pagas un porcentaje por cada venta.

## Planes
- **Gratis** ($0/mes): Hasta 25 productos, Código QR, Pedidos por WhatsApp
- **Pro** ($9/mes): Productos ilimitados, Sin la marca MenúFácil en tu menú, Soporte prioritario por WhatsApp

## Modelo de datos
restaurants (user_id único, slug público, nombre, WhatsApp, moneda, dirección, abierto/cerrado, delivery y recogida, costo de delivery, pedido mínimo); categories (restaurant_id, nombre, posición); products (category_id, nombre, descripción, precio, disponible, posición). RLS por user_id; lectura pública del menú. Límite de 25 productos en el plan gratis aplicado en la base de datos.
