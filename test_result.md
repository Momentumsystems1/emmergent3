#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Iteration 3 (2026-06) — Map redesign + Drive + group invitations
backend:
  - task: "GET /api/mobility/reverse (Azure reverse geocoding)"  # implemented, curl-verified
  - task: "POST /api/groups/{id}/invite-link (multi-use) + accept via POST /api/invitations/by-token/{token}/respond (creates active member, plan cap)"
  - task: "POST /api/groups/{id}/invitations now accepts optional phone"
  - task: "Trips: POST /api/trips, POST /trips/{id}/invite, /join, /leave, PATCH stops, /close, GET /trips/pending, GET /trips/{id} (participants + real ETA)"
frontend:
  - task: "map.tsx: compact pill (greeting→'¿A dónde vamos?'), left MembersRail (tap centers), SharingFab+SharingPanel, tools FAB menu, tap point → reverse + Ir/Quedar/Convoy, trip-invite banner (Unirme)"
  - task: "drive.tsx: active navigation (route, next step, ETA, stops via search/POI/long-press, group panel → trip invite, sharing panel, follow FAB)"
  - task: "navigate.tsx: 'Ir' button → /drive"
  - task: "InviteOptions (group link via WhatsApp / share sheet; contacts picker native-only) on onboarding/group and group/[id]"
  - task: "api.ts single-flight refresh (fixes logout race on reload)"
credentials: see /app/memory/test_credentials.md (ana.demo@sentinelfamily.app / Sentinel2026!)

## Iteration 4 — Azure Maps visible everywhere + traffic incidents + weather
backend (providers.py): GET /api/mobility/tiles/{road|dark|traffic}/{z}/{x}/{y}.png (public proxy), GET /api/mobility/static.png (public, web static map with pins/path),
  GET /api/mobility/incidents?min_lat&min_lng&max_lat&max_lng (auth; Azure Traffic Incident 2025-01-01), GET /api/mobility/weather?lat&lng (auth; current + severe alerts)
frontend: MapCanvas native → Azure base UrlTile + traffic/incident tiles + incident markers; MapCanvas.web → real Azure static map with projection, tap→coordinate, zoom +/-;
  shared types in src/components/mapTypes.ts; map.tsx fab-traffic → traffic-panel (incident list) / incident-card, weather line in selected-point-card;
  drive.tsx tool-traffic → panel-traffic (incidents within 600 m of route + destination weather/alerts), incident markers on map

## Iteration 5 — Emergent-managed Google sign-in
backend: POST /api/auth/session {session_id} → exchanges once with Emergent (X-Session-ID), upserts user by email (password_hash null, auth_provider google), stores user_sessions row, returns app JWT pair (TokenResponse). Bogus id → 401. Login with password on a Google-only account → 401 "Esta cuenta usa Google".
frontend: src/googleAuth.ts (platform redirect url, openAuthSessionAsync on mobile / window.location.href on web, session_id extraction from hash or query, URL cleanup after success), src/auth.tsx (session_id on URL processed before stored session; single-flight Set; url listener on mobile; signInWithGoogle), onboarding/account.tsx button google-signin-button.

## Iteration 6 — Welcome screen, multi-group onboarding, top bar/user card/groups rail, privacy+SOS, photo upload, 3D camera
backend: routers/media.py (POST /api/profile/photo multipart → Emergent Object Storage; DELETE /api/profile/photo; GET /api/media/user/{uid}/photo with Bearer or ?token=, allowed to owner + active co-members), DELETE /api/groups/{id} (owner soft-delete), positions include has_photo, /auth/me has_photo, onboarding initial step now "profile" (consent step skipped in onboarding).
frontend: app/welcome.tsx (index → /welcome when fresh), onboarding/group.tsx rewritten (multi-group cards: rename, delete, members, InviteOptions, add manual; "Continuar al mapa"), onboarding/profile.tsx PhotoPicker, map.tsx top bar (user color, photo, name, search, menu), UserCard (top-right: place, battery, tasks → expanded), GroupsRail (left, pulsing red + badge on attention), fab-privacy (fuchsia) + fab-sos (red gradient → sos-panel → POST /events kind emergency to all groups), MainMenu sheet, MapCanvas 3D camera (pitch 50, buildings, flat me marker).

## Iteration 7 (2026-06) — Rediseño mapa: tarjetas de miembro, paleta Guardián, avatar en todas partes, capas POI
backend (providers.py): NUEVO GET /api/mobility/poi?lat&lng&category&radius → Azure "Search Nearby" por categoría
  (pharmacy/restaurant/park/hospital/police/fuel/cafe/market/parking/atm/school/gym). Curl-verificado (30 farmacias en Madrid). Auth requerido.
frontend:
  - theme.ts: PALETA "Guardián" (índigo #4F46E5 / #818CF8 + ámbar; SOS rosa #F43F5E; privacy violeta) — sustituye el cian.
  - profile.tsx: subir/quitar foto de avatar (expo-image-picker → POST/DELETE /profile/photo). testIDs: profile-avatar-pick, profile-photo-change, profile-photo-remove.
  - MemberRail.tsx (carril DERECHO): un rectángulo negro+blur por miembro (avatar con borde de color, nombre, calle+nº o estado, chevron). testID member-rect-{id}. Abre MemberToolsSheet.
  - MemberToolsSheet.tsx: Centrar/Ir hacia/¿Todo bien?/Quedar/Convoy/Ficha + ETA. testID member-tools-sheet.
  - BlurCard.tsx: tarjeta negra translúcida + blur (norma de diseño).
  - map.tsx: quitados los FAB de herramientas de la derecha. Botón CENTRAR grande a la izquierda-centro (testID fab-recenter). SOS abajo-centro. Privacidad/Tráfico/Capas abajo-izquierda.
    Paneles flotantes que se OCULTAN al arrastrar el mapa (onUserPan→hidden, reanimated) y vuelven al tocar un punto o Centrar (NATIVO). Selector de CAPAS (testID fab-layers, layers-panel, layer-{cat}) → pins POI (poiPins).
  - MapCanvas.tsx + .web.tsx: marcadores de persona ahora muestran la FOTO del avatar (UserPhoto) con borde de color; "yo" anclado en 3D (flat) con halos.
credentials: /app/memory/test_credentials.md (ana.demo@sentinelfamily.app / Sentinel2026!)

## Iteration 8 (2026-06) — Mapa estilo Google Maps: chips de grupo arriba + botón de ubicación con estados + brújula
backend (groups.py): group_view stats ahora incluye "connected" (miembros con location_state=="shared").
frontend:
  - GroupsBar.tsx: chips horizontales arriba (nombre · X miembros · Y en línea · Z avisos, punto rojo pulsante si hay avisos). testID groups-bar, group-chip-{id}. Sustituye al carril izquierdo GroupsRail en el mapa.
  - map.tsx: botón de ubicación (testID fab-recenter) tipo Google con 3 estados: off=locate-outline (recentrar), follow=locate relleno (tocar→heading), heading=compass (mapa gira con la brújula del teléfono). onUserPan→followMode "off". Botón brújula (testID fab-compass) aparece cuando el mapa está rotado (mapHeading≠0)→orienta al norte. UserCard y MemberRail bajados para dejar sitio a los chips.
  - MapCanvas.tsx (NATIVO): props followMode/deviceHeading/onHeadingChange; anima cámara a heading del dispositivo (expo-location watchHeadingAsync) en modo heading; reporta rotación con getCamera en onRegionChangeComplete. (Brújula/heading SOLO nativo, no verificable en web.)

## Iteration 9 (2026-06) — Cabecera de estado + controles de localización (respuesta a "me veo 3 veces")
Decisión del usuario: mantener cabecera y tarjeta derecha, pero la cabecera deja de mostrar el NOMBRE DEL GRUPO y muestra su ESTADO.
frontend (map.tsx, useLocationSharing.ts, MapCanvas.tsx):
  - Cabecera (testID top-bar): sub-línea ahora = testID "bar-status" con ubicación (reverse de myPos) + batería (useBattery) + campana de notificaciones (nº de tareas si >0). Ya NO muestra el nombre del grupo. Quitado estado "greet".
  - Botón intervalo de refresco (testID fab-refresh, muestra "{n}s") → panel (testID refresh-panel) con chips refresh-5/10/30/60/120/300 (segundos entre envíos de posición, ahorro de batería). Persistido en storage sentinel.loc.refreshSec.
  - Botón disponibilidad (testID fab-availability) → panel (testID availability-panel): toggle-pause (Desactivar localización ahora) y toggle-schedule (Solo localizable en horario) con HourStepper sched-from/sched-to (00-23). Persistido. locPausedEff = locPaused || (schedOn && fuera de horario) → se pasa a useLocationSharing({refreshSec, paused}) que corta el envío de posición.
  - useLocationSharing ahora acepta {refreshSec, paused}; timeInterval/throttle = refreshSec*1000; no envía si paused.
  - MapCanvas: zoom inicial más cercano (~6 manzanas): zoomDelta por defecto 0.005, no-center 0.02, pitch 55, avatar propio anclado en 3D (NATIVO).

## Iteration 10 (2026-06) — BUG: aviso de "activa la geolocalización" persiste aunque el miembro la tiene concedida
Causa raíz: useLocationSharing solo comprobaba el permiso una vez al montar y check() no tenía try/catch → si el miembro concedía el permiso (o volvía de Ajustes) la app no re-comprobaba y el aviso se quedaba.
Fix (src/hooks/useLocationSharing.ts):
  - check() con try/catch (un fallo ya no deja perm "unknown" atascado).
  - request() comprueba primero si ya está concedido (evita re-preguntar y marca granted al instante).
  - Re-comprobación con AppState 'active' (al volver la app a primer plano tras conceder en Ajustes).
  - Precisión subida a Location.Accuracy.High (~5-20 m) en watchPositionAsync y getCurrentPositionAsync.
map.tsx: el banner se oculta en cuanto loc.perm === "granted" (efecto actualizado).

## Iteration 11 (2026-06) — Pulido "App Store": un solo botón de herramientas, quitar brújula, encuadrar grupo + radio, tarjetas semitransparentes, "Próximamente"
frontend (map.tsx, MapCanvas.tsx, ui.tsx):
  - Herramientas consolidadas en UN botón redondo (testID fab-tools) → menú glass (testID tools-menu) con tool-privacy/tool-traffic/tool-layers/tool-refresh/tool-availability. Se eliminaron los FABs sueltos.
  - Quitada la brújula (fab-compass) y el modo heading (la brújula "no funciona"): botón de ubicación (fab-recenter) solo off/follow.
  - "Pulsar el círculo" (group-chip) → fitGroup(): MapCanvas prop `fit` (fitToCoordinates) encuadra a todos los miembros localizados + badge testID group-radius con el radio en km (NATIVO el encuadre; badge visible en web).
  - Tarjetas del mapa más semitransparentes (s.selCard usa c.glass).
  - UnavailableHost (ui.tsx): features no configuradas (V16, cámara, transporte público) ahora se muestran como "Próximamente" (no "SERVICIO NO CONFIGURADO") para la demo con inversores.
  - GPS a Accuracy.High (iteración 10).

## Iteration 16 (2026-06) — Navegador con voz + Mensajes cortos (petición usuario, fork)
backend:
  - routers/tts.py: POST /api/tts {text} → genera voz (OpenAI tts-1 vía EMERGENT_LLM_KEY, emergentintegrations), cachea en db.tts_cache, devuelve {key}. GET /api/tts/{key}.mp3 sirve el audio (audio/mpeg). Sanitiza texto.
  - routers/messages.py: POST /api/groups/{gid}/messages {recipient_ids[], text} (recipient_ids vacío = todos los miembros activos). GET /api/groups/{gid}/messages (hilo donde soy emisor o destinatario). GET /api/messages/inbox. GET /api/messages/unread {count}. POST /api/messages/{id}/read. POST /api/groups/{gid}/messages/read_all.
  - server.py: registrados routers tts y messages.
frontend:
  - app/chat/[group].tsx (NUEVO): chat por grupo; selector de destinatarios (Todos o miembros concretos), presets rápidos, texto libre; burbujas; marca leído al abrir. Param `to` preselecciona un miembro.
  - app/drive.tsx: navegador funcional: cámara sigue y GIRA en la dirección de marcha (heading de GPS o rumbo calculado) vía MapCanvas cameraHeading; voz de maniobras (utils/voice.ts, expo-audio) al iniciar ruta, al acercarse a cada maniobra (<300 m), recalcular y llegada; FAB drive-voice para silenciar. Avatar (foto) del usuario en su marcador (has_photo). (Voz/heading = solo build nativa.)
  - src/components/MapCanvas.tsx + mapTypes.ts: nueva prop cameraHeading (rumbo de cámara al centrar). map.tsx sin cambios de comportamiento (cameraHeading=0).
  - app/map.tsx: botón chatbubbles en cabecera (testID messages-button) con badge de no leídos (/messages/unread) → abre chat del grupo.
  - MemberToolsSheet.tsx: acción "Mensaje" (member-tool-message) → chat con destinatario preseleccionado. MainMenu.tsx: item "Mensajes" (menu-messages).
Credenciales: ana.demo@sentinelfamily.app / Sentinel2026! (grupo "Grupo 1"). Nota: para probar envío de mensajes hace falta un grupo con ≥2 miembros ACTIVOS.

## Iteration 18 (2026-06) — Nacimiento del círculo (animación orbital con plazas reservadas) + invitados por código
backend (routers/groups.py):
  - `GroupCreate.planned_size` (plazas reservadas, incluye al admin; se capa por `maxPermanentMembers` del plan). `GroupUpdate` ahora acepta name y/o planned_size (PATCH parcial).
  - `group_view().stats.reserved` = planned_size - miembros visibles (plazas libres que se dibujan en la órbita).
  - Invitaciones: enlace construido con `public_base(request)` (host real) + `code` de 6 caracteres; `GET /api/invitations/by-code/{code}`.
frontend:
  - src/components/OrbitalField.tsx (REESCRITO): props `slots` (plazas libres, avatar discontinuo con "libre") y fase `assembling`. Coreografía: onda sónica translúcida con borde neón por cada anclaje, giro completo de 360º del campo, cola de puntos a las 12:00 que se vacía, cada plaza entra con muelle a su posición equidistante. Respeta "Reducir movimiento" (useReducedMotion → estado final directo). Timings exportados: QUEUE_LEAD, ANCHOR_STEP, ANCHOR_TRAVEL, anchorAt(i), assembleDuration(n).
  - app/group/create.tsx (NUEVO): paso 1 nombre + stepper de plazas (2-12) → "Configurar" (crea el grupo con planned_size) → animación con contador central que sube por anclaje (háptica por plaza) → el contador se encoge y deja "nombre + N plazas" con la fecha bajo la órbita → opciones de compartir (enlace + código). "Toca para saltar" corta la animación.
  - app/onboarding/group.tsx: la tarjeta de nuevo grupo ahora es un botón "Crear círculo" → /group/create (se eliminó el alta rápida y la fase "forming"); las tarjetas pintan `slots={g.stats.reserved}`.
  - app/group/[id].tsx: la órbita pinta las plazas reservadas.
  - app/join.tsx (NUEVO): "Me han invitado · tengo un código" (welcome-join-code, account-join-code) → /invite/<token>.
Credenciales: ana.demo@sentinelfamily.app / Sentinel2026! (plan free: maxGroups=1, ya tiene "Grupo 1" → para crear círculos nuevos hace falta cuenta nueva; el registro por API funciona: POST /api/auth/register).
