# Node.js + NestJS

- Un módulo por dominio (`src/<dominio>/`: module, controller, service, DTOs).
- Validación global con `ValidationPipe` (`whitelist: true`) y DTOs con class-validator.
- Configuración con `@nestjs/config` (`DATABASE_URL`, `PORT`, `CORS_ORIGINS`), en `.env.example`.
- Con PostgreSQL: TypeORM o Prisma con migraciones versionadas; nunca `synchronize: true` fuera de desarrollo.
- Pruebas unitarias de servicios y e2e de controladores con las herramientas que trae el proyecto (`npm test`).
- Si `npm install` falla con el error interno `edgesOut`, actualiza npm (`npm i -g npm@latest`) y vuelve a instalar.
