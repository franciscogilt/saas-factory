# SaaS generados

SaaS ya construidos y probados, listos para publicar con la fábrica.

| SaaS | Qué es | Estado |
|---|---|---|
| [CitaFácil](citafacil/) | Reservas online para salones y barberías, con recordatorios por WhatsApp | ✅ Probado · listo para publicar |
| [MenúFácil](menufacil/) | Menú digital con QR y pedidos por WhatsApp para restaurantes y cafeterías | ✅ Probado · listo para publicar |

## Publicar uno

Con las claves en tu `.env` (comprueba con `npm run factory -- doctor`):

```bash
cp -r generated/citafacil projects/      # o menufacil
npm run factory -- deploy citafacil
```

Para MenúFácil, después crea el menú de demostración con `npm run seed:demo` (ver [su README](menufacil/README.md)).

La fábrica crea el repositorio, el proyecto de Supabase (con las migraciones), el producto y el precio en Stripe y el sitio en Vercel. Después ejecuta las pruebas sobre el sitio publicado.

## Probarlo en tu computadora sin cuentas

```bash
cd generated/citafacil
npm install
npm run test:sql                          # 31 pruebas de seguridad y reservas sobre Postgres real
npm run mock:supabase                     # en otra terminal: Supabase simulado en :54321
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
  NEXT_PUBLIC_APP_URL=http://localhost:3200 npm run build && npx next start -p 3200
npm run test:e2e                          # 25 pruebas de punta a punta en Chrome (deja capturas en ./screenshots)
```
