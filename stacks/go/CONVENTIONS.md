# Go

- `cmd/api/main.go` solo arranca; la lógica vive en `internal/`.
- Handlers pequeños que validan la entrada y devuelven JSON con códigos HTTP correctos; errores con `fmt.Errorf("…: %w", err)`.
- Configuración por variables de entorno (`PORT`, `DATABASE_URL`), documentadas en `.env.example`.
- `context.Context` en todas las operaciones de E/S; timeouts en el servidor HTTP.
- Con PostgreSQL: `pgx` y migraciones con `golang-migrate` (archivos SQL en `migrations/`).
- Pruebas con `testing` + `net/http/httptest`, en tablas (`[]struct{…}`), junto al código (`*_test.go`).
