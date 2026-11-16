# Docker Compose

- Un `Dockerfile` por app (multi-stage, imagen final pequeña, usuario no root) en su carpeta.
- `docker-compose.yml` en la raíz con un servicio por app y, si hay PostgreSQL, el servicio `db`.
- Healthchecks y `depends_on: { db: { condition: service_healthy } }`.
- Variables desde `.env` (con `.env.example` versionado); puertos documentados en el README.
- `.dockerignore` en cada app (node_modules, .venv, bin/obj, target, .git).
- La verificación es `docker compose config -q` (valida el archivo sin arrancar nada).
