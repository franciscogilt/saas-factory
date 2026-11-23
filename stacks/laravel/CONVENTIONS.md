# PHP + Laravel

- Rutas de API en `routes/api.php` (instala con `php artisan install:api` si hace falta) y web en `routes/web.php`.
- Validación con Form Requests; respuestas con API Resources.
- Eloquent con migraciones (`php artisan make:migration`), factories y seeders.
- Autorización con Policies; nunca confíes en datos del cliente para permisos.
- Configuración en `.env` (nunca versionado) y `.env.example` actualizado; con PostgreSQL, `DB_CONNECTION=pgsql`.
- Pruebas con PHPUnit/Pest (`tests/Feature` para endpoints) usando `RefreshDatabase` y SQLite en memoria.
