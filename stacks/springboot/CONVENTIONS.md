# Java + Spring Boot

- Paquetes por funcionalidad (`controller`, `service`, `repository`, `dto` dentro de cada una).
- Controladores REST con validación (`@Valid`) y un `@RestControllerAdvice` para errores.
- Spring Data JPA; migraciones con Flyway en `src/main/resources/db/migration`.
- Configuración en `application.yml` con variables de entorno (`SPRING_DATASOURCE_URL`, etc.); nunca credenciales en el repositorio.
- Pruebas: `@WebMvcTest` para controladores y `@SpringBootTest` con H2 (o Testcontainers) para integración.
