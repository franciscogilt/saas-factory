# CitaFácil

> Reservas online para salones y barberías

## Problema
Los salones de belleza y barberías gestionan las citas por WhatsApp y llamadas: pierden tiempo respondiendo mensajes, se les olvidan citas, hay clientes que no llegan y huecos vacíos en la agenda.

## Cliente objetivo
Dueños de salones de belleza, barberías, spas de uñas y estilistas independientes en Latinoamérica (inicialmente República Dominicana), con 1-5 empleados y sin sistema de reservas.

## Propuesta de valor
Un enlace de reservas que el negocio pone en su Instagram y WhatsApp: los clientes eligen servicio, día y hora libres sin escribir; el negocio ve su agenda en un panel y envía recordatorios por WhatsApp con un toque.

## Funcionalidades
- **Enlace de reservas propio**: Una página pública con tus servicios, precios y horarios libres. Tus clientes reservan solos, 24/7, sin escribirte.
- **Agenda del día**: Ve de un vistazo las citas de hoy y los próximos días, márcalas como completadas o cancélalas.
- **Recordatorios por WhatsApp**: Envía a cada cliente un recordatorio ya redactado con un solo toque, desde tu propio WhatsApp.
- **Servicios y horarios**: Define tus servicios con duración y precio, tus días y horas de trabajo. Nunca habrá dos citas a la vez.

## Planes
- **Gratis** ($0/mes): Hasta 30 reservas al mes, Enlace de reservas, Recordatorios por WhatsApp
- **Pro** ($12/mes): Reservas ilimitadas, Sin la marca CitaFácil en tu página, Soporte prioritario por WhatsApp

## Modelo de datos
businesses (user_id único, slug público, nombre, WhatsApp, zona horaria, horario y días de apertura, intervalo de turnos); services (business_id, nombre, duración, precio, activo); appointments (business_id, service_id, nombre y teléfono del cliente, inicio, fin, estado). RLS por user_id; lectura pública de negocios y servicios activos; reservas públicas solo mediante la función book_appointment (valida horario, solapes y límite del plan).
