# Python + FastAPI

- Routers por recurso en `app/api/`, esquemas Pydantic separados de los modelos SQLAlchemy.
- Configuración con pydantic-settings (`DATABASE_URL`, etc.), documentada en `.env.example`.
- Sesión de base de datos como dependencia (`Depends(get_db)`); nunca global.
- Con PostgreSQL: migraciones con Alembic (`alembic/`); las pruebas usan SQLite en memoria o una base aparte.
- Pruebas con pytest + `TestClient` de FastAPI en `tests/`; cada endpoint con su caso feliz y sus errores (422/404).
- CORS explícito para el frontend (`CORS_ORIGINS`).
