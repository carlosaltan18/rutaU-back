# RutaU — Traspaso de integración para Android

## Datos que debe proporcionar el equipo

Antes de compilar, sustituir `RENDER_ORIGIN` por la URL exacta que muestra
Render para el Web Service, sin `/api/v1` al final.

```text
RENDER_ORIGIN=https://<servicio>.onrender.com
API_BASE_URL=${RENDER_ORIGIN}/api/v1/
SWAGGER_URL=${RENDER_ORIGIN}/docs
OPENAPI_URL=${RENDER_ORIGIN}/docs-json
HEALTH_URL=${RENDER_ORIGIN}/health
FIREBASE_PROJECT_ID=ruta-u-ebf74
FIREBASE_DATABASE_URL=https://ruta-u-ebf74-default-rtdb.firebaseio.com/
FIRESTORE_DATABASE_ID=(default)
```

La URL debe configurarse mediante `BuildConfig` o el mecanismo de ambientes
existente. No debe quedar repetida en repositorios o ViewModels.

## Cambios definitivos respecto del backend fake/local

1. La autenticación definitiva es Firebase Auth. No usar JWT emitidos por
   Android ni por el backend.
2. La API de producción usa HTTPS en Render y el prefijo `/api/v1`.
3. Todas las respuestas exitosas están envueltas en `data` y `meta`; las
   respuestas de error usan `error.code` estable.
4. Las listas usan cursor opaco, no número de página.
5. Se agregaron notificaciones internas, registro de tokens FCM y navegación
   desde el payload push.
6. Se agregaron inicio y finalización de ubicación en vivo mediante la API.
7. La ubicación efímera se publica directamente en Realtime Database.
8. Decisión final de privacidad: solo el conductor publica coordenadas. Los
   pasajeros confirmados únicamente pueden leer la última ubicación.
9. Firestore se usa para mensajes emergentes de la aplicación; el documento
   leído se marca localmente mediante DataStore, no se modifica en Firestore.
10. Dinero se transmite como centavos enteros de GTQ; nunca como `Double`.

## Autenticación y creación de sesión

Android obtiene el ID token de Firebase y lo envía en todas las operaciones
protegidas:

```http
Authorization: Bearer <firebase-id-token>
```

Flujo recomendado:

1. Iniciar sesión con Firebase Auth.
2. Obtener `FirebaseUser.getIdToken(false)`.
3. Llamar `POST /auth/session`.
4. Para una cuenta existente, el cuerpo puede ser `{}`.
5. Para una cuenta nueva, enviar `displayName`, `institutionalEmail`,
   `universityId` y `campusId`; `photoUrl` y `phone` son opcionales.
6. Guardar el perfil RutaU devuelto, cuyo `id` no es el UID de Firebase.
7. Un interceptor de OkHttp debe obtener un token vigente para cada solicitud.
8. Ante `401` con `UNAUTHENTICATED`, forzar una sola renovación con
   `getIdToken(true)` y reintentar una vez. No crear bucles de reintento.
9. Después de crear la sesión, registrar el token FCM en el backend.

Los catálogos necesarios para el registro son públicos y pueden consultarse
antes de crear la sesión:

- `GET /universities`
- `GET /universities/{id}/campuses`
- `GET /zones`

## Contrato HTTP común

Respuesta individual exitosa:

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid",
    "nextCursor": null
  }
}
```

Respuesta paginada:

```json
{
  "data": [],
  "meta": {
    "requestId": "uuid",
    "nextCursor": "cursor-opaco-o-null"
  }
}
```

Error:

```json
{
  "error": {
    "code": "NO_SEATS_AVAILABLE",
    "message": "No quedan plazas para esa fecha.",
    "fieldErrors": [],
    "requestId": "uuid"
  }
}
```

La aplicación debe decidir por `error.code`, no comparando textos traducidos.
Los códigos posibles están documentados en `openapi.json` y Swagger.

Reglas de serialización:

- Fecha: `YYYY-MM-DD`.
- Hora: `HH:mm`.
- Instantes: ISO-8601 en UTC.
- `dayOfWeek`: ISO, lunes `1` y domingo `7`.
- Dinero: `offeredContributionMinor` y `agreedContributionMinor` son centavos
  enteros; `1000` representa GTQ 10.00.
- Moneda MVP: `GTQ`.
- Paginación: enviar `limit` y devolver exactamente `meta.nextCursor` en la
  siguiente consulta. El cliente no debe decodificar el cursor.
- En creaciones usar un UUID nuevo como `Idempotency-Key` y reutilizar el
  mismo UUID si se reintenta la misma operación.
- `PATCH /trips/{id}` requiere la última `version` recibida. Si llega
  `TRIP_VERSION_CONFLICT`, volver a cargar antes de editar.

## Endpoints implementados

### Sesión y perfil

- `POST /auth/session`
- `GET /me`
- `PATCH /me`
- `DELETE /me`

### Catálogos

- `GET /universities`
- `GET /universities/{id}/campuses`
- `GET /zones`

### Trayectos y coincidencias

- `POST /trips`
- `GET /trips`
- `GET /trips/{id}`
- `PATCH /trips/{id}`
- `POST /trips/{id}/deactivate`
- `DELETE /trips/{id}`
- `GET /trips/{id}/matches?travelDate=YYYY-MM-DD`
- `GET /trips/{sourceTripId}/matches/{candidateTripId}`

Roles disponibles: `DRIVER` y `PASSENGER`. Un conductor usa capacidad de 1 a
3; un pasajero usa `seatCapacity: null`. Las coincidencias exigen roles
complementarios, misma zona, campus y día, diferencia de hasta 30 minutos,
personas distintas y plazas disponibles.

### Solicitudes e invitaciones

- `POST /ride-requests`
- `GET /ride-requests?box=sent|received`
- `GET /ride-requests/{id}`
- `POST /ride-requests/{id}/accept`
- `POST /ride-requests/{id}/reject`
- `POST /ride-requests/{id}/cancel`
- `GET /ride-requests/{id}/coordination`

Tipos:

- `JOIN_REQUEST`: el pasajero solicita unirse al conductor.
- `DRIVER_INVITATION`: el conductor invita al pasajero.

Estados: `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `EXPIRED`. Una
solicitud pendiente no reserva cupo. Solo el receptor acepta o rechaza; solo el
emisor cancela una solicitud pendiente.

### Coordinaciones

- `GET /coordinations`
- `GET /coordinations/{id}`
- `POST /coordinations/{id}/cancel`
- `POST /coordinations/{id}/live-location/start`
- `POST /coordinations/{id}/live-location/end`

Estados: `CONFIRMED`, `CANCELLED`, `COMPLETED`. El teléfono de la contraparte
solo aparece en `contact` mientras la coordinación está confirmada y solamente
para participantes.

El objeto `liveLocation` de una coordinación contiene:

```json
{
  "occurrenceId": "driverTripUuid_YYYY-MM-DD",
  "status": "NOT_STARTED|ACTIVE|ENDED",
  "startedAt": null,
  "endedAt": null,
  "canStart": true,
  "canEnd": false
}
```

Android debe mostrar los controles a partir de `canStart` y `canEnd`, no solo
del rol guardado localmente.

### Notificaciones y dispositivos

- `GET /notifications`
- `POST /notifications/{id}/read`
- `POST /devices`
- `DELETE /devices/{id}`

Registro FCM:

```http
POST /devices
Idempotency-Key: <uuid>

{
  "token": "<fcm-registration-token>",
  "platform": "ANDROID"
}
```

Guardar el `data.id` devuelto para eliminarlo durante el cierre de sesión.
Repetir el registro en `FirebaseMessagingService.onNewToken`, pero únicamente
después de que exista una sesión RutaU válida.

El payload de FCM incluye estas claves de datos:

```json
{
  "notificationId": "uuid",
  "type": "REQUEST_RECEIVED|REQUEST_ACCEPTED|REQUEST_REJECTED|REQUEST_CANCELLED|REQUEST_EXPIRED|COORDINATION_CANCELLED",
  "resourceId": "uuid",
  "destination": "RIDE_REQUEST_DETAIL|COORDINATION_DETAIL"
}
```

Crear el canal Android `rutau_updates`. Al abrir una notificación, navegar de
acuerdo con `destination`, consultar el recurso por `resourceId` y actualizar
la lista interna. No usar el texto visible como identificador de navegación.

## Realtime Database: ubicación en vivo

Ruta:

```text
liveTrips/{occurrenceId}/location
```

Flujo del conductor:

1. Llamar `POST /coordinations/{id}/live-location/start`.
2. Usar el `occurrenceId` devuelto en `data.liveLocation`.
3. Iniciar el servicio de ubicación de Android con los permisos requeridos.
4. Publicar aproximadamente cada 10 segundos solamente la última ubicación.
5. Al terminar, llamar primero al endpoint `end`; el backend elimina el nodo y
   marca todas las coordinaciones de esa salida como `COMPLETED`.
6. Detener siempre el servicio local aunque el nodo ya no exista.

Valor escrito por el conductor:

```json
{
  "latitude": 14.6349,
  "longitude": -90.5069,
  "accuracy": 8.5,
  "bearing": 120.0,
  "speed": 9.2,
  "updatedAt": 1792960000000
}
```

`latitude`, `longitude`, `accuracy` y `updatedAt` son obligatorios. `bearing` y
`speed` son opcionales. Para `updatedAt`, usar el timestamp de servidor de
Realtime Database. No crear una lista ni conservar historial.

Flujo del pasajero:

1. Solo una coordinación confirmada y activa concede lectura.
2. Suscribirse a `liveTrips/{occurrenceId}/location` cuando el estado sea
   `ACTIVE`.
3. Mostrar la última coordenada y su antigüedad.
4. Desuscribirse al cancelar, finalizar, cerrar sesión o recibir eliminación
   del nodo.
5. El pasajero no escribe su propia ubicación. Las reglas la rechazan.

## Firestore y DataStore

Android lee directamente:

```text
appMessages/{messageId}
```

Las reglas permiten lectura a usuarios autenticados y prohíben todas las
escrituras desde clientes. Como mínimo, consumir los campos `title` y `body`.
Usar el ID del documento como identificador estable y guardar en DataStore los
IDs descartados/mostrados según la UX acordada. No guardar estos mensajes en
PostgreSQL ni intentar marcarlos en Firestore desde Android.

## Firebase App Check, Crashlytics y App Distribution

- Integrar App Check con proveedor de depuración para builds debug y Play
  Integrity para builds distribuidos.
- No solicitar todavía que se active la exigencia en Firebase hasta confirmar
  métricas con tokens válidos en Auth, Firestore y Realtime Database.
- Crashlytics debe registrar fallos y errores no fatales, pero nunca ID tokens,
  teléfonos, correos, coordenadas ni cuerpos HTTP privados.
- App Distribution solo distribuye builds; la lista de testers no forma parte
  del backend.
- La huella debug ya fue obtenida. Antes de publicar release se debe crear la
  firma release y registrar sus SHA-1 y SHA-256 en Firebase.

## Lista de terminado para Android

- Reemplazar repositorios fake por clientes HTTP reales.
- Configurar `API_BASE_URL` con la URL exacta de Render.
- Implementar interceptor Firebase, renovación única en `401` y envelopes.
- Completar creación/recuperación de sesión RutaU.
- Implementar paginación por cursor en todas las listas.
- Enviar `Idempotency-Key` en creaciones y conservarlo durante reintentos.
- Implementar catálogo, perfil, trayectos, coincidencias, solicitudes y
  coordinaciones contra la API.
- Manejar estados y todos los `error.code` documentados.
- Registrar, renovar y eliminar tokens FCM; implementar deep links internos.
- Implementar conductor publicador y pasajero lector de Realtime Database.
- Leer `appMessages` y persistir descartes en DataStore.
- Integrar Crashlytics, App Distribution y App Check sin activar enforcement.
- Probar cuenta nueva y existente, expiración de token, pérdida de red,
  solicitud duplicada, última plaza, cancelaciones y cierre de viaje.
- Probar build release firmado antes de habilitar Play Integrity obligatorio.

## Consideración del plan gratuito de Render

El Web Service gratuito puede suspenderse después de un periodo sin tráfico.
Al reactivarse, la primera solicitud puede tardar y los procesos FCM/expiración
no corren mientras el servicio está suspendido. Esto es aceptable para pruebas,
pero antes de una prueba con usuarios que requiera notificaciones puntuales se
debe usar un servicio siempre activo.

## Archivos de contrato que acompañan este documento

- `openapi.json`: endpoints, parámetros, cuerpos y errores.
- `README.md`: reglas funcionales y operación del backend.
- `firebase/database.rules.json`: autorización de ubicación en vivo.
- `firebase/firestore.rules`: autorización de mensajes emergentes.
- `firebase/firestore.indexes.json`: índices versionados de Firestore.

No compartir `.env`, `FIREBASE_CREDENTIALS_JSON`, la cuenta de servicio,
contraseñas PostgreSQL ni URLs de base de datos. El archivo
`google-services.json` debe descargarse desde Firebase directamente para la app
Android y no se obtiene de este repositorio backend.
