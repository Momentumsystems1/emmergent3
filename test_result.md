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
