# Node.js + Express

- `src/app.ts` exporta la app (para probarla con supertest) y `src/server.ts` solo escucha el puerto.
- Rutas por recurso en `src/routes/`, validación de entrada con zod, middleware de errores central.
- Configuración desde variables de entorno (`PORT`, `DATABASE_URL`, `CORS_ORIGINS`), en `.env.example`.
- TypeScript estricto; nada de `any` para silenciar errores.
- Pruebas con Vitest + supertest en `src/**/*.test.ts`.
