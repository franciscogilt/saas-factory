# .NET con C# (ASP.NET Core)

- Minimal APIs o controladores agrupados por funcionalidad; DTOs separados de las entidades.
- EF Core con migraciones (`dotnet ef migrations add`); cadena de conexión en `ConnectionStrings:Default` (user-secrets o variables de entorno, nunca en el repositorio).
- Validación de entrada (FluentValidation o DataAnnotations) y `ProblemDetails` para errores.
- Inyección de dependencias del contenedor de ASP.NET; nada de `new` para servicios.
- Pruebas con xUnit + `WebApplicationFactory` para los endpoints.
