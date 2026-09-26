# sentinel-api (Supabase Edge Function)

Backend unificado de MY CLUSTER. Se despliega con:

    supabase functions deploy sentinel-api --project-ref nvannetdrfybowwjqqhf --no-verify-jwt

`--no-verify-jwt` es intencionado: la funcion valida ella misma el JWT por ruta
(needAuth/jwtSub) y el gateway debe dejar pasar los preflight OPTIONS (CORS).

v7 (2026-09-22): fotos de perfil — POST/DELETE /api/profile/photo y
GET /api/media/user/{id}/photo sobre bucket privado `avatars` (RLS Storage:
escritura solo carpeta propia, lectura propia o co-miembros via shares_group_with).

v8 (2026-09-25): FMS Integration (sandbox) — capa de eventos normalizados para
clientes privados. Tablas fms_clients/fms_devices/fms_events/fms_webhooks/fms_deliveries
(RLS activa sin policies: solo esta funcion las toca). Rutas:
GET /api/fms/schema (esquema del evento), POST /api/fms/ingest (auth X-Device-Key),
GET /api/fms/events (auth X-API-Key, filtros limit/since),
GET/POST/DELETE /api/fms/webhooks (secret mostrado una sola vez; entrega firmada
X-FMS-Signature HMAC-SHA256, registro en fms_deliveries). Las claves se guardan
como SHA-256; nunca en claro. QA 25.09: auth negativa 401, validacion 400,
entrega push real 200 verificada, regresion login app OK.
