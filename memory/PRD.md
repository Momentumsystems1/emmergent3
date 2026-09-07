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
