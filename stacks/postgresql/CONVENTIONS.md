# PostgreSQL

- La conexión siempre por `DATABASE_URL` (documentada en `.env.example`); nunca credenciales en el código.
- Esquema mediante migraciones versionadas de la herramienta del backend (Alembic, migraciones de Django, EF Core, Flyway, node-pg-migrate).
- Claves primarias UUID o identity, `created_at timestamptz default now()`, índices en las claves foráneas.
- Las pruebas no dependen de un Postgres real: usan SQLite/H2 en memoria o Testcontainers.
- Si el proyecto usa Docker Compose: servicio `db` con `postgres:16-alpine`, volumen persistente y healthcheck (`pg_isready`).
