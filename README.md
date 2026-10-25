# RutaU Backend

Backend MVP de RutaU construido con NestJS, TypeORM, PostgreSQL y Firebase.
Coordina trayectos universitarios habituales entre conductores y pasajeros.

## Funcionalidad implementada

- Autenticación con Firebase Auth; el actor se resuelve exclusivamente desde el
  `uid` del ID token verificado.
- Perfil privado propio y perfiles públicos sin correo ni teléfono.
- Catálogos de universidades, dominios institucionales, campus y zonas.
- Trayectos `DRIVER` y `PASSENGER`, capacidad de 1 a 3 y control optimista.
- Coincidencias por zona, campus, día, roles y diferencia máxima de 30 minutos.
- Solicitudes e invitaciones con deduplicación e idempotencia.
- Aceptación transaccional con bloqueo pesimista de cupos por fecha.
- Coordinaciones, cancelación de pasajero y cancelación completa del conductor.
- Expiración programada según `America/Guatemala`.
- Notificaciones internas, registro de dispositivos y entrega push mediante FCM.
- Reglas versionadas para mensajes de Firestore y ubicación efímera en Realtime
  Database.
- Swagger/OpenAPI y respuestas de error con códigos estables.
- Migraciones versionadas y datos semilla exclusivamente ficticios.

## Requisitos

- Node.js 24 o una versión compatible con NestJS 12.
- pnpm 11.
- PostgreSQL 18 o una versión compatible.
- Un proyecto Firebase y una cuenta de servicio para Firebase Admin.

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
   AUTH_PROVIDER=FIREBASE
   FIREBASE_PROJECT_ID=ruta-u-ebf74
   FIREBASE_DATABASE_URL=https://ruta-u-ebf74-default-rtdb.firebaseio.com/
   FIRESTORE_DATABASE_ID=(default)
   GOOGLE_APPLICATION_CREDENTIALS=C:/ruta/absoluta/firebase-service-account.json
   FIREBASE_CHECK_REVOKED_TOKENS=false
   FCM_ENABLED=false
   LIVE_LOCATION_MAX_HOURS=12
   CORS_ALLOWED_ORIGINS=*
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

`CORS_ALLOWED_ORIGINS=*` acepta cualquier origen durante el desarrollo. Antes
de producción debe sustituirse por una lista de orígenes web autorizados.

## Autenticación

Android inicia sesión con Firebase Auth y envía el ID token en cada solicitud:

```http
Authorization: Bearer <firebase-id-token>
```

El backend verifica firma, audiencia, emisor y vencimiento mediante Firebase
Admin. `POST /api/v1/auth/session` vincula el `uid` autenticado con el perfil de
RutaU; nunca se acepta un identificador de actor enviado en el cuerpo.

Existe un modo JWT exclusivamente local para pruebas deterministas. Para usarlo,
se debe configurar `AUTH_PROVIDER=JWT` y `JWT_SECRET`, y luego generar un token
para un sujeto ficticio:

```bash
pnpm auth:token demo-student-1
```

Sujetos de demostración disponibles: `demo-student-1` a `demo-student-8`.

## Firebase

- `firebase/firestore.rules` permite a usuarios autenticados leer
  `appMessages`; las escrituras quedan reservadas al backend.
- `firebase/database.rules.json` limita `liveTrips/{occurrenceId}` a miembros
  confirmados. Solo el UID del conductor puede escribir `location`; los
  pasajeros únicamente pueden leerla mientras la sesión esté activa.
- `POST /api/v1/coordinations/{id}/live-location/start` inicia la sesión y
  `POST /api/v1/coordinations/{id}/live-location/end` completa el viaje. Ambos
  comandos están reservados al conductor.
- La ubicación es efímera: finalizar o cancelar el viaje elimina la ocurrencia
  completa. Cancelar un pasajero revoca inmediatamente su lectura.
- `LIVE_LOCATION_MAX_HOURS` cierra sesiones olvidadas; el valor predeterminado
  es 12 y el máximo permitido es 24 horas.
- El despachador FCM se habilita con `FCM_ENABLED=true`. Los intentos se guardan
  en PostgreSQL para que una caída temporal de FCM no pierda notificaciones.

Las reglas se despliegan desde la raíz del proyecto con Firebase CLI:

```bash
firebase deploy --only firestore:rules,database
```

No guardar la cuenta de servicio ni `FIREBASE_CREDENTIALS_JSON` en Git.
`google-services.json` pertenece a Android y tampoco es una credencial del
backend.

## Scripts

| Comando                   | Acción                                                    |
| ------------------------- | --------------------------------------------------------- |
| `pnpm build`              | Compila TypeScript.                                       |
| `pnpm lint`               | Ejecuta análisis estático.                                |
| `pnpm test`               | Ejecuta pruebas unitarias.                                |
| `pnpm test:e2e`           | Ejecuta pruebas HTTP y de concurrencia contra PostgreSQL. |
| `pnpm migration:run`      | Ejecuta migraciones desde TypeScript en desarrollo.       |
| `pnpm migration:run:prod` | Ejecuta migraciones ya compiladas.                        |
| `pnpm migration:revert`   | Revierte la última migración.                             |
| `pnpm seed`               | Compila y carga datos ficticios idempotentes.             |
| `pnpm openapi:generate`   | Genera `openapi.json`.                                    |

Las pruebas E2E crean registros claramente identificados y los eliminan al
finalizar. Para CI se recomienda una base PostgreSQL aislada mediante
`DATABASE_URL`; nunca ejecutar pruebas mutables sobre una base de producción.

## Despliegue en Render

Configuración sugerida:

- El repositorio incluye `render.yaml` para crear el servicio web mediante un
  Blueprint de Render.
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Start command compatible con el plan gratuito:
  `pnpm migration:run:prod && pnpm start:prod`.
- En planes con pre-deploy, puede separarse `pnpm migration:run:prod` como
  pre-deploy y dejar `pnpm start:prod` como inicio.
- `DATABASE_URL`: usar la URL interna de Render.
- `NODE_ENV=production`.
- `AUTH_PROVIDER=FIREBASE`.
- `FIREBASE_PROJECT_ID=ruta-u-ebf74`.
- `FIREBASE_DATABASE_URL=https://ruta-u-ebf74-default-rtdb.firebaseio.com/`.
- `FIRESTORE_DATABASE_ID=(default)`.
- `FIREBASE_CREDENTIALS_JSON`: JSON completo de la cuenta de servicio cargado
  como secreto de Render. La ruta local de `GOOGLE_APPLICATION_CREDENTIALS` no
  existe en Render.
- `FIREBASE_CHECK_REVOKED_TOKENS=false` inicialmente; puede habilitarse si se
  acepta el costo de una consulta adicional por solicitud.
- `FCM_ENABLED=true` cuando Android ya registre tokens de dispositivo.
- `LIVE_LOCATION_MAX_HOURS=12`.
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
- Android escribe cada actualización del conductor en
  `liveTrips/{occurrenceId}/location` aproximadamente cada 10 segundos. Los
  campos son `latitude`, `longitude`, `accuracy`, `bearing`, `speed` y
  `updatedAt`; los cuatro primeros obligatorios son latitud, longitud, precisión
  y marca de tiempo.
- No se guarda historial de coordenadas. Realtime Database conserva únicamente
  la última ubicación hasta finalizar, cancelar o expirar el viaje.
