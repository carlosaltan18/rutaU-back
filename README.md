# RutaU Backend

API REST de RutaU para coordinar trayectos universitarios entre conductores y pasajeros. Está construida con NestJS, TypeORM y PostgreSQL. Firebase complementa al backend para validar identidad, enviar notificaciones push y controlar el acceso a ubicación en vivo, pero PostgreSQL sigue siendo la fuente principal de los datos del negocio.

La instancia desplegada está disponible en:

| Recurso | Dirección |
| --- | --- |
| API | `https://rutau-back.onrender.com/api/v1/` |
| Salud | `https://rutau-back.onrender.com/health` |
| Swagger | `https://rutau-back.onrender.com/docs` |
| OpenAPI JSON | `https://rutau-back.onrender.com/docs-json` |

Para desarrollo local la API es `http://localhost:3000/api/v1/`, Swagger está en `http://localhost:3000/docs` y salud en `http://localhost:3000/health`.

## Arquitectura

La aplicación sigue una organización modular de NestJS. Cada módulo conserva su controlador HTTP, servicio, DTO y entidades. Los módulos comparten autenticación, Firebase, manejo de errores, paginación, idempotencia y configuración desde `src/common/`.

```text
Cliente Android
     |
HTTP + Firebase ID token
     |
Middleware -> Guard -> ValidationPipe -> Controller -> Service
                                   |              |
                             DTO / OpenAPI      TypeORM
                                                   |
                                              PostgreSQL
                                                   |
                   +-------------------------------+-----------------------+
                   |                               |                       |
             Firebase Auth                    Firebase FCM       Realtime Database
             valida el ID token               avisos push          ubicación activa
```

### Ciclo de una solicitud

1. `requestIdMiddleware` añade un identificador para relacionar logs, respuestas y errores.
2. `httpLoggerMiddleware` registra método, ruta, estado y duración.
3. `AuthGuard` exige `Authorization: Bearer <Firebase ID token>` salvo rutas públicas o el alta inicial de sesión.
4. `ValidationPipe` transforma y rechaza campos no permitidos antes de que lleguen al servicio.
5. El controlador delega al servicio de su módulo.
6. `ResponseEnvelopeInterceptor` envuelve los resultados en `data` y `meta`.
7. `ApiExceptionFilter` convierte errores controlados en un objeto `error` con un `code` estable.

## Estructura del repositorio

```text
src/
├── main.ts                         Crea y levanta NestJS
├── bootstrap.ts                    Prefijo, CORS, Swagger, pipes e interceptores
├── app.module.ts                   Une módulos e instala guardas globales
├── common/                         Infraestructura compartida
│   ├── auth/                       Validación de token y datos de la persona actual
│   ├── config/                     Validación de variables de entorno
│   ├── database/                   TypeORM, entidades comunes, migraciones y seed
│   ├── domain/                     Enumeraciones del negocio
│   ├── errors/                     Códigos y formato de errores HTTP
│   ├── firebase/                   Firebase Admin: Auth, FCM, Firestore y RTDB
│   ├── http/                       Request ID, logs y envoltura de respuesta
│   ├── idempotency/                Reintentos seguros de operaciones de creación
│   ├── openapi/                    Decoradores y generador de OpenAPI
│   ├── pagination/                 Cursor opaco y límite de listas
│   └── time/                       Reglas de hora y zona horaria de negocio
└── modules/                        Casos de uso de RutaU
    ├── auth/                       Crea o recupera una sesión/perfil
    ├── catalog/                    Universidades, campus y zonas
    ├── students/                   Perfil propio y perfil público
    ├── trips/                      Trayectos base, cupos y ocurrencias
    ├── matching/                   Compatibilidades entre trayectos
    ├── requests/                  Solicitudes e invitaciones
    ├── coordinations/              Acuerdos, punto de encuentro e inicio/final de viaje
    ├── live-location/              Sesiones de ubicación activa en RTDB
    ├── notifications/              Avisos internos, dispositivos y FCM
    └── health/                     Ruta pública de salud
```

## Módulos de negocio

| Módulo | Responsabilidad |
| --- | --- |
| `auth` | Vincula un Firebase UID con un estudiante mediante `POST /auth/session`. Para una cuenta nueva valida correo, universidad y campus. Para una cuenta existente devuelve el perfil actual. |
| `catalog` | Sirve catálogos de universidades, campus por universidad y zonas. Android usa estos datos para presentar nombres en vez de UUID. |
| `students` | Expone `GET/PATCH/DELETE /me` y presenta perfiles públicos sin datos de contacto privados. |
| `trips` | Crea, lista, consulta, edita, desactiva y elimina trayectos. Un rol es parte del trayecto: `DRIVER` publica de 1 a 3 plazas y `PASSENGER` no publica plazas. |
| `matching` | Compara zona de origen, campus destino, día, diferencia de hora de hasta 30 minutos, roles complementarios y cupos. Excluye pares que ya tienen una solicitud pendiente o coordinación confirmada. |
| `requests` | Gestiona `JOIN_REQUEST` (pasajero a conductor) y `DRIVER_INVITATION` (conductor a pasajero), además de aceptación, rechazo y cancelación. La aceptación reserva cupo en una transacción. |
| `coordinations` | Entrega coordinaciones, cancela viaje o participación, administra punto de encuentro y confirma/inicia/finaliza el viaje según el rol. |
| `live-location` | Crea miembros autorizados en Realtime Database al iniciar un viaje y borra la ocurrencia cuando termina o se cancela. |
| `notifications` | Guarda notificaciones internas en PostgreSQL, registra tokens FCM por dispositivo y las despacha mediante Firebase Cloud Messaging. |

Las políticas puras que aplican reglas importantes están separadas en archivos como `trip-capacity.policy.ts`, `compatibility.policy.ts` y `request-state.policy.ts`, lo que permite probarlas sin levantar HTTP.

## Datos y migraciones

PostgreSQL es la base de datos del negocio. Allí viven estudiantes, catálogos, trayectos, ocurrencias, solicitudes, coordinaciones, notificaciones, tokens de dispositivo y claves de idempotencia.

TypeORM usa `synchronize: false`. Esto es intencional: ningún entorno crea o cambia tablas automáticamente al arrancar. Cada cambio del esquema debe llegar en una migración versionada dentro de `src/common/database/migrations/`.

Migraciones actuales:

| Migración | Cambio |
| --- | --- |
| `1760328000000-initial-schema.ts` | Esquema inicial del negocio. |
| `1792890000000-add-push-delivery.ts` | Estado e intentos de entrega FCM. |
| `1792891000000-add-live-trip-lifecycle.ts` | Ciclo de vida y datos de ubicación activa. |
| `1792892000000-add-coordination-meeting-point.ts` | Punto de encuentro de una coordinación. |

El seed de `src/common/database/seed.ts` genera solo catálogos y datos ficticios idempotentes. No se debe usar una base de producción para pruebas E2E ni para experimentos con seeds.

### Cambiar de base de datos

Al apuntar `DATABASE_URL` a una base nueva, la estructura no aparece por ejecutar NestJS. Hay que aplicar las migraciones:

```bash
pnpm migration:run
pnpm seed
```

Las migraciones dejan una base nueva con el mismo esquema; el seed agrega los catálogos de demostración.

## Autenticación y autorización

La autenticación de producción es exclusivamente Firebase Auth:

```http
Authorization: Bearer <firebase-id-token>
```

`FirebaseTokenVerifier` verifica el token con Firebase Admin y `AuthGuard` busca al estudiante usando el `uid` de Firebase. El cliente no debe mandar un `studentId`, `userId` ni un rol global para identificar a la persona.

Después del login en Firebase, Android llama:

```http
POST /api/v1/auth/session
```

Para usuarios existentes el cuerpo puede ser `{}`. Para usuarios nuevos puede incluir `displayName`, `institutionalEmail`, `universityId`, `campusId` y `photoUrl`. Si faltan universidad/campus, el servidor intenta usar el primer campus activo; Android normalmente debe enviar la selección explícita.

El soporte JWT existe únicamente para pruebas locales deterministas (`AUTH_PROVIDER=JWT`). No debe usarse como autenticación de la app desplegada.

## Contrato HTTP

### Respuestas y errores

Toda respuesta correcta usa esta envoltura:

```json
{
  "data": {},
  "meta": {
    "requestId": "8f3a...",
    "nextCursor": null
  }
}
```

Los errores usan esta forma:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos.",
    "fieldErrors": [],
    "requestId": "8f3a..."
  }
}
```

Los clientes deben decidir qué hacer con `error.code`, nunca comparar el texto del mensaje. El `requestId` sirve para buscar la petición correspondiente en logs.

### Reglas que debe respetar Android

- Las listas usan `limit` y `meta.nextCursor`; el cursor es opaco y no es un número de página.
- El dinero se envía y guarda como centavos enteros de GTQ. Por ejemplo, Q 10.00 se representa como `1000`.
- `Idempotency-Key` protege reintentos de crear trayectos, solicitudes y registros de dispositivos. La misma operación reintentada debe conservar la misma clave.
- Las fechas usan `YYYY-MM-DD` y las horas `HH:mm`.
- El contacto solo se entrega después de una coordinación confirmada y únicamente a sus participantes.
- El contrato exacto de DTOs y estados está publicado en Swagger y [`openapi.json`](openapi.json). Si se necesita un campo nuevo, primero se cambia el contrato y el backend; Android no debe inventarlo.

### Grupos de endpoints

| Recurso | Rutas principales |
| --- | --- |
| Sesión | `POST /auth/session` |
| Perfil | `GET`, `PATCH`, `DELETE /me` |
| Catálogos | `GET /universities`, `GET /universities/{id}/campuses`, `GET /zones` |
| Trayectos | `GET`, `POST /trips`, `GET/PATCH/DELETE /trips/{id}`, `POST /trips/{id}/deactivate` |
| Coincidencias | `GET /trips/{id}/matches`, detalles de una coincidencia por trayecto fuente y candidato |
| Solicitudes | `GET`, `POST /ride-requests`; detalle, aceptar, rechazar o cancelar por ID |
| Coordinaciones | listar/detalle, cancelar, punto de encuentro, confirmación e inicio/final de ubicación viva |
| Avisos y dispositivos | `GET /notifications`, `POST /notifications/{id}/read`, `POST /devices`, `DELETE /devices/{id}` |

## Firebase en el backend

`FirebaseAdminService` inicializa Firebase Admin una sola vez y ofrece Auth, Cloud Messaging, Firestore y Realtime Database a los módulos que los necesiten. La cuenta de servicio se entrega mediante `FIREBASE_CREDENTIALS_JSON` o `GOOGLE_APPLICATION_CREDENTIALS`; nunca se sube al repositorio.

### Cloud Messaging

Los eventos personales se guardan primero como notificaciones internas en PostgreSQL. `PushNotificationDispatcher` se ejecuta cada 10 segundos, reclama lotes de manera segura, llama a FCM y registra intentos, fallos temporales y tokens inválidos.

Los tipos actuales son:

- `REQUEST_RECEIVED`
- `REQUEST_ACCEPTED`
- `REQUEST_REJECTED`
- `REQUEST_CANCELLED`
- `REQUEST_EXPIRED`
- `COORDINATION_CANCELLED`

Cada push incluye `notificationId`, `type`, `resourceId` y `destination`. Android navega con `RIDE_REQUEST_DETAIL` o `COORDINATION_DETAIL`, y vuelve a consultar la API antes de mostrar información del recurso.

### Firestore: anuncios generales

Firestore no almacena información del negocio. La colección `appMessages` se reserva para anuncios generales dentro de Android: bienvenida, mantenimiento, novedades o recordatorio de completar perfil. El cliente Android tiene permiso de lectura autenticada y no puede escribir.

Las reglas están en [`firebase/firestore.rules`](firebase/firestore.rules). El backend o un administrador con Firebase Admin puede crear o actualizar esos anuncios; no hace falta enviar un FCM por cada anuncio general.

### Realtime Database: ubicación activa

Cuando el conductor inicia una coordinación, el backend crea una ocurrencia con miembros autorizados:

```text
liveTrips/{occurrenceId}
├── meta/       estado, conductor, fecha y vencimiento
├── members/    UIDs autorizados
└── location/   última coordenada del conductor
```

Solo el conductor confirmado escribe `location`; pasajeros confirmados pueden leer mientras la sesión esté `ACTIVE`. Las reglas están en [`firebase/database.rules.json`](firebase/database.rules.json). No se guarda historial: al finalizar o cancelar, `LiveLocationService` elimina toda la ocurrencia.

Las reglas se despliegan desde la raíz con:

```bash
firebase deploy --only firestore:rules,database
```

## Variables de entorno

Copie `.env.example` a `.env`. Los valores sensibles solo existen en el entorno local, Render o el gestor de secretos; no se suben a Git.

| Variable | Uso |
| --- | --- |
| `NODE_ENV` | `development`, `test` o `production`. |
| `PORT` | Puerto HTTP; por defecto `3000`. |
| `DATABASE_URL` | Conexión PostgreSQL requerida. |
| `AUTH_PROVIDER` | `FIREBASE` en la app real; `JWT` solamente para pruebas locales. |
| `FIREBASE_PROJECT_ID` | Proyecto Firebase que valida tokens y envía push. |
| `FIREBASE_DATABASE_URL` | Dirección de Realtime Database. |
| `FIRESTORE_DATABASE_ID` | Normalmente `(default)`. |
| `FIREBASE_CREDENTIALS_JSON` | Cuenta de servicio como secreto JSON para servidores. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta a cuenta de servicio para desarrollo local, alternativa al JSON. |
| `FIREBASE_CHECK_REVOKED_TOKENS` | Si es `true`, Firebase revisa tokens revocados además de validarlos. |
| `FCM_ENABLED` | Habilita el despachador de notificaciones push. |
| `LIVE_LOCATION_MAX_HOURS` | Límite de una sesión de ubicación, entre 1 y 24 horas. |
| `CORS_ALLOWED_ORIGINS` | Orígenes web permitidos separados por coma. |
| `RATE_LIMIT_SEARCH_PER_MINUTE` / `RATE_LIMIT_REQUEST_PER_HOUR` | Parámetros disponibles para ajustar límites del negocio. |

`DATABASE_USER`, `DATABASE_PASSWORD`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`, `JWT_SECRET` y `JWT_EXPIRES_IN` permanecen en `.env.example` para configuraciones locales compatibles. En la ruta Firebase desplegada, la credencial de Firebase y `DATABASE_URL` son los valores críticos.

## Ejecutar localmente

### Requisitos

- Node.js 24.x.
- pnpm 11.x.
- PostgreSQL disponible mediante `DATABASE_URL`.
- Proyecto Firebase con una cuenta de servicio para validar Firebase Auth, administrar RTDB y enviar FCM.

### Inicio

```bash
pnpm install
```

Copie `.env.example` a `.env`, configure PostgreSQL y Firebase, luego ejecute:

```bash
pnpm migration:run
pnpm seed
pnpm start:dev
```

El seed es opcional si la base ya tiene los catálogos necesarios. `pnpm start:dev` reinicia NestJS al cambiar archivos TypeScript.

## Scripts

| Comando | Acción |
| --- | --- |
| `pnpm build` | Compila TypeScript a `dist/`. |
| `pnpm start:dev` | Inicia NestJS en modo desarrollo con recarga. |
| `pnpm start:prod` | Ejecuta `dist/main.js`. |
| `pnpm lint` | Ejecuta Oxlint sobre `src/` y `test/`. |
| `pnpm test` | Ejecuta pruebas unitarias con Vitest. |
| `pnpm test:e2e` | Ejecuta pruebas HTTP y de concurrencia contra PostgreSQL. |
| `pnpm migration:run` | Aplica migraciones TypeScript en desarrollo. |
| `pnpm migration:run:prod` | Aplica migraciones compiladas. |
| `pnpm migration:revert` | Revierte la última migración. |
| `pnpm seed` | Compila y carga datos ficticios idempotentes. |
| `pnpm openapi:generate` | Genera `openapi.json` desde la app compilada. |
| `pnpm auth:token <subject>` | Genera un token local solamente si `AUTH_PROVIDER=JWT`. |

Antes de integrar un cambio importante se recomienda ejecutar:

```bash
pnpm lint
pnpm test
pnpm build
```

## Despliegue en Render

[`render.yaml`](render.yaml) define el servicio web. Su flujo es:

```text
pnpm install --frozen-lockfile && pnpm build
pnpm migration:run:prod && pnpm start:prod
```

Render debe tener como secretos `DATABASE_URL` y `FIREBASE_CREDENTIALS_JSON`. La configuración actual usa Firebase, activa FCM y mantiene `FIREBASE_CHECK_REVOKED_TOKENS=false` para evitar una consulta adicional por cada solicitud. Antes de producción se deben revisar CORS, límites, monitoreo y el costo/beneficio de verificar tokens revocados.

## Responsabilidades entre Android, backend y Firebase

| Sistema | Responsabilidad |
| --- | --- |
| Android | Autentica con Firebase, manda ID token, muestra UI, registra FCM y publica ubicación solo cuando el conductor inicia un viaje. |
| NestJS | Valida ID tokens, aplica reglas de negocio, persiste información y coordina el acceso a Firebase. |
| PostgreSQL | Fuente definitiva de perfiles, trayectos, solicitudes, cupos, coordinaciones y notificaciones internas. |
| Firebase Auth | Identidad de la persona mediante UID e ID token. |
| Firestore | Anuncios generales de solo lectura dentro de Android. |
| FCM | Avisos personales enviados por NestJS a dispositivos registrados. |
| Realtime Database | Última ubicación temporal de una coordinación activa. |

No cambie modelos de negocio, reglas Firebase, DTOs de Android ni `openapi.json` de manera aislada: un cambio de contrato debe incluir la migración, el servicio/controlador, las pruebas y la actualización del cliente Android.
