# RutaU Backend

Backend MVP de RutaU construido con NestJS, TypeORM y PostgreSQL. Coordina
trayectos universitarios habituales entre conductores y pasajeros sin mapas,
GPS, pagos ni cálculo automático de precios.

## Funcionalidad implementada

- Autenticación Bearer JWT con el actor resuelto desde `sub`.
- Perfil privado propio y perfiles públicos sin correo ni teléfono.
- Catálogos de universidades, dominios institucionales, campus y zonas.
- Trayectos `DRIVER` y `PASSENGER`, capacidad de 1 a 3 y control optimista.
- Coincidencias por zona, campus, día, roles y diferencia máxima de 30 minutos.
- Solicitudes e invitaciones con deduplicación e idempotencia.
- Aceptación transaccional con bloqueo pesimista de cupos por fecha.
- Coordinaciones, cancelación de pasajero y cancelación completa del conductor.
- Expiración programada según `America/Guatemala`.
- Notificaciones internas y registro opcional de dispositivos.
- Swagger/OpenAPI y respuestas de error con códigos estables.
- Migraciones versionadas y datos semilla exclusivamente ficticios.

## Requisitos

- Node.js 24 o una versión compatible con NestJS 12.
- pnpm 10 o superior.
- PostgreSQL 18 o una versión compatible.

## Configuración local

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Copiar `.env.example` como `.env` y completar al menos:

   ```dotenv
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
   JWT_SECRET=un-secreto-largo-y-aleatorio
   JWT_EXPIRES_IN=8h
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   ```

3. Aplicar migraciones y cargar la demostración:

   ```bash
   pnpm migration:run
   pnpm seed
   ```

4. Iniciar el servidor:

   ```bash
   pnpm start:dev
   ```

La API queda en `http://localhost:3000/api/v1`, salud en `/health`, Swagger en
`/docs` y el documento JSON en `/docs-json`.

## JWT temporal para desarrollo

El backend no expone un endpoint inseguro que emita tokens. Después del seed se
puede generar un JWT local para cualquiera de los sujetos ficticios:

```bash
pnpm auth:token demo-student-1
```

Sujetos disponibles: `demo-student-1` a `demo-student-8`. El token se envía así:

```http
Authorization: Bearer <token>
```

`JWT_SECRET` debe reemplazarse por un valor aleatorio fuerte en Render. El
servidor rechaza el secreto local conocido cuando `NODE_ENV=production`.

## Migración posterior a Firebase Auth

Los servicios de negocio dependen únicamente del `authSubject` resuelto por el
guard. Para migrar a Firebase se reemplaza la verificación HS256 por Firebase
Admin, se verifica el ID token enviado por Android y se usa su `uid` como
`authSubject`; trayectos, solicitudes, permisos y coordinaciones no cambian.

No guardar la cuenta de servicio de Firebase en Git. En Render deberá cargarse
como secreto. `google-services.json` corresponde al proyecto Android, no al
backend.

## Scripts

| Comando | Acción |
| --- | --- |
| `pnpm build` | Compila TypeScript. |
| `pnpm lint` | Ejecuta análisis estático. |
| `pnpm test` | Ejecuta pruebas unitarias. |
| `pnpm test:e2e` | Ejecuta pruebas HTTP y de concurrencia contra PostgreSQL. |
| `pnpm migration:run` | Ejecuta migraciones desde TypeScript en desarrollo. |
| `pnpm migration:run:prod` | Ejecuta migraciones ya compiladas. |
| `pnpm migration:revert` | Revierte la última migración. |
| `pnpm seed` | Compila y carga datos ficticios idempotentes. |
| `pnpm openapi:generate` | Genera `openapi.json`. |

Las pruebas E2E crean registros claramente identificados y los eliminan al
finalizar. Para CI se recomienda una base PostgreSQL aislada mediante
`DATABASE_URL`; nunca ejecutar pruebas mutables sobre una base de producción.

## Despliegue en Render

Configuración sugerida:

- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Pre-deploy command: `pnpm migration:run:prod`
- Start command: `pnpm start:prod`
- `DATABASE_URL`: usar la URL interna de Render.
- `NODE_ENV=production`.
- `JWT_SECRET`: secreto fuerte distinto al de desarrollo.
- `CORS_ALLOWED_ORIGINS`: orígenes permitidos separados por coma.

No habilitar `synchronize` en TypeORM. Toda modificación del esquema debe llegar
mediante una migración versionada.

## Reglas relevantes para Android

- Fechas: `YYYY-MM-DD`.
- Horas: `HH:mm`.
- Dinero: centavos enteros de GTQ.
- Paginación: `limit` y cursor opaco.
- Creaciones: header opcional `Idempotency-Key`.
- Android debe decidir por `error.code`, no por el texto del mensaje.
- El contacto privado solo aparece en una coordinación `CONFIRMED` y únicamente
  para sus participantes.
