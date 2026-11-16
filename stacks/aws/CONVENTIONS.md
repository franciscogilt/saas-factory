# AWS (infraestructura con CDK)

- Backends en ECS Fargate detrás de un Application Load Balancer, a partir de su Dockerfile.
- Frontends estáticos (React/Angular) en S3 + CloudFront.
- PostgreSQL en RDS en subredes privadas, con credenciales en Secrets Manager (nunca en el código).
- Sin cuenta ni región fijas: se toman de las variables `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION`.
- **Nunca despliegues.** Escribe `infra/DEPLOY.md` con los pasos (`npx cdk bootstrap`, `npx cdk deploy`), una estimación de qué servicios generan coste y cómo borrarlo todo (`npx cdk destroy`).
- La verificación es compilar y `cdk synth` (no necesita credenciales).
