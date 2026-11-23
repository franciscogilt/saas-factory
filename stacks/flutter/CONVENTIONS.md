# Flutter

- Estructura por funcionalidad (`lib/features/<x>/`: data, domain, presentation).
- Estado con Riverpod (o el que ya use el proyecto); widgets pequeños y `const` donde se pueda.
- Llamadas HTTP con un cliente único (`dio` o `http`); la URL del backend por `--dart-define=API_URL=…`, nunca fija en el código.
- Sin secretos en la app: todo lo sensible vive en el backend.
- Accesible: `Semantics` en iconos sin texto, tamaños táctiles de 48 px como mínimo.
- Pruebas de widgets con `flutter_test` en `test/`; `flutter analyze` sin avisos.
