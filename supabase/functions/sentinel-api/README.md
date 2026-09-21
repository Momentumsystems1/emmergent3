# sentinel-api (Supabase Edge Function)

Backend unificado de MY CLUSTER. Se despliega con:

    supabase functions deploy sentinel-api --project-ref nvannetdrfybowwjqqhf --no-verify-jwt

`--no-verify-jwt` es intencionado: la funcion valida ella misma el JWT por ruta
(needAuth/jwtSub) y el gateway debe dejar pasar los preflight OPTIONS (CORS).

v7 (2026-09-22): fotos de perfil — POST/DELETE /api/profile/photo y
GET /api/media/user/{id}/photo sobre bucket privado `avatars` (RLS Storage:
escritura solo carpeta propia, lectura propia o co-miembros via shares_group_with).
