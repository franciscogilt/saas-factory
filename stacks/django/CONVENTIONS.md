# Python + Django

- Proyecto en `config/`, una app por dominio. API con DRF (serializers + viewsets + routers).
- Configuración por entorno con django-environ (`DATABASE_URL`, `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`), en `.env.example`.
- Migraciones siempre generadas (`makemigrations`) y versionadas.
- Permisos explícitos en cada vista; nunca `AllowAny` por defecto salvo en endpoints públicos.
- Pruebas con el `TestCase` de Django / `APITestCase` en `tests.py` o `tests/` de cada app.
