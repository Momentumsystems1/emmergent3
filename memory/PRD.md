# SENTINEL FAMILY — PRD / Memoria de proyecto

## Problema original
Aplicación móvil (Expo) de movilidad, coordinación, seguridad y privacidad para grupos/familias según el "MASTER BUILD PROMPT v2.0" y la
Especificación Maestra v1.0 (docs/SENTINEL_FAMILY_Especificacion_Maestra_v1.0.pdf). Reglas absolutas: sin modo demo ni datos inventados;
estados veraces `NO DISPONIBLE EN EL PLAN ACTUAL` (entitlement) y `SERVICIO NO CONFIGURADO` (credencial/infra). Referencias visuales:
remix-3d-mind-map (Orbe), remix-pulse-engine-card (tarjetas), referencia.png (densidad Convoy).

## Decisiones del usuario
- Auth: email + contraseña (JWT). Google/Microsoft/Supabase: claves al final → BLOCKED.
- Azure Maps key entregada (activa). Recursos gratuitos permitidos (Nominatim/OSRM como fallback).
- Planes Free/Basic/Pro configurables con popup de upgrade. Alcance: P0–P8 (+P9 parcial).
- Orbe: fidelidad máxima al mind-map; fallback sin WebGL obligatorio (implementado). Código segmentado por módulos.
- Trabajo en este workspace; el usuario hace "Save to GitHub" a `consolidation/sentinel-recovery` (nunca `main`).

## Arquitectura
Backend FastAPI + MongoDB (`/api`): core.py, routers/{auth, consent, entitlements, groups, people, providers, coordination}.
Frontend Expo Router + TS + Reanimated + Gesture Handler: `src/orb/*`, `src/cards/*`, `src/components/*`, `app/*`. Tema Día/Noche en `src/theme.ts`.
Docs: `/app/docs` (25 md + ADRs + IMPLEMENTATION_STATUS.md + SENTINEL_IMPLEMENTATION_GAPS.pdf, generados por `docs/generate.py`).

## Implementado (2026-06)
- P0 onboarding legal + consentimiento versionado append-only + 14 permisos granulares.
- P1 perfil/avatar. P2 creación orbital de grupo, invitaciones WhatsApp/SMS con estados veraces, ENVIAR A TODOS, colapso a Mini-Orb, aceptación por enlace, roles/entitlements.
- P3 mapa (nativo; web = lienzo veraz), ubicación consentida. P4 Orbe 3D (grafo, física, cámara, fallback). P5 Orbe de persona. P6 Tarjeta de privacidad (PulseCard).
- P7 Quedada con geocoding/ETA reales (Azure). P8 Convoy con cohesión temporal. P9 Anti-congestión con tráfico predictivo (plan Basic/Pro).
- Motor de alertas unificado, planes, estado de integraciones, documentación y PDF de gaps.

## Cuentas de prueba
Ver /app/memory/test_credentials.md.

## Cambio 2026-06 (sesión 3)
- Especificación maestra PDF anulada por el usuario; criterio propio.
- Orbe navegador ELIMINADO (`src/orb/` borrado). Árbol reducido a funciones reales.
- Mapa estilo Life360 + módulo NAVIGATION (Azure: autocomplete, nav-route, along-route, history).
- Sesión 4 (feedback usuario): home = mapa + píldora compacta ("Hola X" → "¿A dónde vamos?" a los 4 s; grupo y perfil dentro).
  Sin barra de estado "Compartiendo", sin hoja inferior "Grupo". Usuario centrado con zoom navegador (delta 0.01), FAB recentrar,
  FAB herramientas (Quedar/Convoy/¿Todo bien?/Anti-congestión/Actividad/Privacidad) que se cierra al tocar el mapa.
  Toque/long-press en el mapa → `GET /mobility/reverse` (Azure) → tarjeta compacta con Ir / Quedar aquí / Convoy.
- Sesión 4c: Azure Maps visible en todo (tiles raster proxied `/mobility/tiles`, tráfico en tiempo real nativo; web = mapa estático Azure real con proyección Mercator, tap→coordenada, zoom). Incidencias (`/mobility/incidents`, Azure Traffic Incident 2025-01-01) en mapa y en ruta; meteorología + avisos oficiales (`/mobility/weather`). Tileset de incidencias es MVT → solo marcadores.
- Sesión 4b: carril izquierdo de avatares (centra el mapa), FAB permanente "Qué comparto y con quién" (SharingFab/Panel → /privacy),
  pantalla `/drive` (navegación activa: ruta, siguiente maniobra, ETA, paradas por búsqueda/POI/long-press, viaje compartido con ETAs reales,
  recálculo al salirse >120 m), botón "Ir" en navigate. Backend `routers/trips.py` (trips, invite, join, pending, close).
  Invitaciones: enlace multiuso de grupo (`POST /groups/{id}/invite-link`, WhatsApp/share sheet) + selector de contactos (expo-contacts, solo nativo)
  con envío secuencial por wa.me/<tel>. WhatsApp/WeChat NO exponen contactos ni miembros de grupo (documentado al usuario).
  Fix: refresh de token single-flight en api.ts (evitaba cierre de sesión al recargar con varias peticiones 401 en paralelo).
- Pendiente fase 2: movilidad grupal (gestor).

## Backlog priorizado
- P0: Retest completo con testing agent en dispositivo (mapa nativo, SMS, haptics). Auth social cuando lleguen claves.
- P1: Renderer WebGL del Orbe (expo-gl + three) sobre RendererProps. Object Storage para foto de avatar. Pago (RevenueCat).
- P2: Cámara compartida (WebRTC/TURN, build nativa). Road Reality (anonimización + STT). Transit/parking providers. V16. Métricas.
- Deuda: props web deprecadas (`shadow*`→`boxShadow`, `pointerEvents` en style) señaladas por el tester; testID `account-mode-login`.
- Sesión 5: Google sign-in gestionado por Emergent (`POST /auth/session` canjea session_id una vez, upsert por email, emite JWT propio;
  `src/googleAuth.ts` + `AuthProvider` procesan `session_id` de la URL antes que la sesión guardada; botón en onboarding/account).
- Sesión 6 (rediseño solicitado, fases ①②): portada `/welcome` (PNG + logo provisionales en assets/images), flujo legal → cuenta → perfil (con foto
  vía Emergent Object Storage, `routers/media.py`) → creación de uno o varios grupos (`onboarding/group.tsx` reescrito, sin Orb; DELETE /groups/{id}) → mapa.
  Mapa: barra superior con color/foto/nombre + lupa + hamburguesa (MainMenu), tarjeta de usuario arriba-derecha (lugar, batería expo-battery, tareas),
  carril izquierdo de GRUPOS con latido rojo (GroupsRail), FAB Privacidad fucsia (SharingPanel) + SOS rojo degradado (evento emergency a todos los grupos),
  cámara 3D nativa (pitch 50, edificios, marcador propio plano anclado). Pendientes fases ③–⑥: menú completo del punto (geocerca, guardar sitio, evento
  programado, ETA del círculo, incidencia), edición/permisos por miembro, métricas/horarios de visibilidad en hamburguesa, overlay de emergencias.

## Sesión 7 (rediseño mapa por fases; clave NAP = 20d7e5ae-a791-4940-86b8-0eaadac7e5f5, Punto de Acceso Nacional transporte público)
Plan acordado con el usuario (paso a paso): F1 perfil+tarjetas miembro · F2 SOS completo · F3 mapa 3D+radio grupo · F4 quedada optimizada · F5 NAP.
Receptores del SOS = contactos de emergencia elegidos por el usuario (selector a implementar en F2).
- **Fase 1 COMPLETADA (2026-06):**
  - Perfil: subida de foto de avatar (expo-image-picker → POST /profile/photo, DELETE para quitar). `app/profile.tsx`.
  - Mapa: eliminados los círculos de herramientas de la derecha. Ahora carril DERECHO de MIEMBROS = un rectángulo negro+blur por miembro
    (`src/components/MemberRail.tsx`): avatar con borde del color del miembro (foto o inicial), nombre, calle+nº (reverse geocode) o estado, y ">".
    Al pulsarlo abre `src/components/MemberToolsSheet.tsx` (Centrar, Ir hacia, ¿Todo bien?, Quedar, Convoy, Ficha; ETA me→miembro).
  - Norma de diseño: `src/components/BlurCard.tsx` (fondo negro translúcido + BlurView, texto blanco, no ocupa todo el mapa). BLUR_TEXT/BLUR_MUTED.
  - Controles del mapa reubicados: SOS abajo-centro (66px), Privacidad+Tráfico+Recentrar abajo-izquierda (44px). Tarjetas inferiores subidas +84 para no tapar SOS.
  - Verificado por screenshot (login ana.demo): rectángulos, ficha de miembro y perfil OK. Backend intacto en F1.
- **Lote UI (2026-06, sobre correcciones del usuario) COMPLETADO + testeado (iteración 11, 13/13 backend + frontend OK):**
  - Paleta "Guardián" en theme.ts (índigo #4F46E5/#818CF8 + ámbar; SOS rosa #F43F5E; privacy violeta) reemplaza el cian.
  - Avatar en TODAS partes: marcadores de mapa (nativo y web) muestran la foto del avatar con borde de color; "yo" anclado en 3D (flat) con halos y zoom cercano.
  - Botón CENTRAR grande a la izquierda-centro (s.centerBtn, 60px). Privacidad/Tráfico/Capas abajo-izquierda; SOS abajo-centro.
  - Paneles flotantes que se OCULTAN al arrastrar el mapa (onUserPan→hidden, reanimated translate+fade) y vuelven al tocar un punto o pulsar Centrar. SOLO NATIVO.
  - Selector de CAPAS (fab-layers → layers-panel; farmacias/restaurantes/parques/hospitales/comisarías/gasolineras/supermercados/cafeterías) → backend GET /api/mobility/poi (Azure Search Nearby, POI_CATS). Pins con icono/color por categoría (poiPins + POI_META).
  - Fix overlap banner↔MemberRail (railTop dinámico).
  - Pendiente (web-only, ignorable): warnings shadow*/pointerEvents. Google 3D Navigation SDK NO disponible en Expo Go (se mantiene la cámara 3D nativa).
- **Lote "Google Maps" (2026-06) COMPLETADO + testeado (iteración 12):**
  - Grupos movidos ARRIBA como chips alargados (GroupsBar): nombre · X miembros · Y en línea · Z avisos (punto rojo pulsante). Reemplaza el carril izquierdo. backend stats.connected añadido.
  - Botón de ubicación tipo Google (fab-recenter) con 3 estados: off (locate-outline → recentrar), follow (locate relleno → tocar entra en heading), heading (compass → mapa gira con la brújula del móvil). Brújula fab-compass cuando el mapa está rotado → norte. NATIVO para heading/brújula (expo-location watchHeadingAsync + animateCamera). UserCard/MemberRail bajados; arreglado solape con banner (rightTop slack 172).
- **Ajuste "me veo 3 veces" + controles de localización (2026-06) COMPLETADO + testeado (iteración 13, 26/26):**
  - El usuario decidió mantener cabecera y tarjeta derecha; la CABECERA ya NO muestra el nombre del grupo (es admin) → muestra ubicación + batería + campana de notificaciones (testID bar-status). El nombre del grupo solo en los chips (groups-bar).
  - fab-refresh (pill "{n}s") → refresh-panel (chips 5/10/30/60/120/300 s) = intervalo de envío de posición (ahorro batería). Persistido storage sentinel.loc.refreshSec.
  - fab-availability → availability-panel: toggle-pause (desactivar ahora) + toggle-schedule (solo localizable en horario, HourStepper sched-from/to). locPausedEff corta el envío en useLocationSharing({refreshSec, paused}). Persistido.
  - MapCanvas zoom inicial más cercano (~6 manzanas): zoomDelta 0.005 / no-center 0.02, pitch 55; avatar propio anclado en 3D (NATIVO).
- **BUG geolocalización + pulido "App Store" (2026-06) COMPLETADO + testeado (iteraciones 14 y 15):**
  - BUG: el aviso "activa la geolocalización" persistía aunque el miembro la tenía concedida. Causa: useLocationSharing solo comprobaba el permiso al montar y check() sin try/catch. Fix: re-check con AppState 'active', try/catch, request() detecta si ya está concedido, banner se oculta con perm "granted". GPS a Accuracy.High. (Verificado iteración 14, 3 escenarios.)
  - Herramientas consolidadas en UN botón redondo (fab-tools → tools-menu: privacidad/tráfico/capas/refresco/disponibilidad). Quitada la brújula (fab-compass) y el modo heading.
  - group-chip → fitGroup() encuadra a todo el grupo (MapCanvas prop `fit`/fitToCoordinates) + badge group-radius con radio en km.
  - Tarjetas del mapa semitransparentes (s.selCard=c.glass). Funciones no listas → "Próximamente" (ui.tsx UnavailableHost). Aviso honesto "solo con la app abierta" ya presente en el banner. (Verificado iteración 15, 7/7.)
- **PRÓXIMO (acordado): Fase 2 SOS completo** — mantener pulsado 3s con anillo de progreso; pantalla roja emisor+receptores; datos (inicio/ubicación/timestamp/clima/sensores expo-sensors/batería) con actualización cada 20s en secuencia (SOS enviado→1→2→3…); código de 2 dígitos (defecto 78) solo el emisor desactiva; selector de contactos de emergencia (receptores elegidos); icono rojo central con foto del emisor + parpadeo + sonido en receptores; hospitales/comisarías + botón de emergencias en el mapa de ambos. Fase 4 quedada optimizada + punto intermedio. Fase 5 NAP (clave 20d7e5ae-...).
- **Arreglo de DESPLIEGUE a producción (2026-06) COMPLETADO:**
  - El deploy fallaba: el healthcheck del contenedor pedía `GET /health` (raíz) y la API solo tenía `/api/`. Añadidos `GET /health` y `GET /` a nivel raíz en `/app/backend/server.py` (verificado 200).
  - Creación de índices + `seed_plans()` envueltos en try/except para que la API arranque aunque Atlas rechace cambios de índices.
  - Eliminado el índice TTL destructivo `positions.at expireAfterSeconds=30d` (borraba histórico de posiciones automáticamente) → sustituido por índice compuesto `[user_id, at]`. TTL solo en sesiones.
  - `/app/.gitignore`: quitadas las reglas `.env`, `.env.*`, `*.env` (bloqueaban los env necesarios en el deploy).
  - Requisito App Store: borrado de cuenta en la app → `DELETE /api/auth/account` (soft-delete: deleted_at, email/nombre anonimizados, sesiones revocadas, positions_latest y membresías eliminadas) + tarjeta "Eliminar cuenta" en `profile.tsx` (testID profile-delete-account).
  - Pendiente no bloqueante: textos legales marcados "PENDIENTE DE REVISIÓN LEGAL" (consent.py) antes de enviar a las tiendas.
