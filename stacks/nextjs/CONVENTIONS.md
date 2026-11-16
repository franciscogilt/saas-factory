# Next.js

- App Router (`app/`), Server Components por defecto; `"use client"` solo donde hay interactividad.
- TypeScript estricto. Nada de `any` para silenciar errores.
- Mutaciones con Server Actions o Route Handlers que validan la entrada (zod).
- Variables públicas solo con prefijo `NEXT_PUBLIC_`; secretos solo en el servidor. Documenta cada variable en `.env.example`.
- Si hay backend aparte, su URL va en `NEXT_PUBLIC_API_URL`.
- Pruebas con Vitest + Testing Library junto al código (`*.test.tsx`).
