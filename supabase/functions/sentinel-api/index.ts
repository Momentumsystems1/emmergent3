// sentinel-api v7 — backend unificado de Sentinel Family (Supabase Edge Function, Deno)
// v6 (dev, prueba): auth enriquecido (user con onboarding), refresh, CRUD grupos/miembros,
// invitaciones completas, eventos, ubicación, quedadas (meetings) con ETA Mapbox,
// mobility (geocode/autocomplete/history/nav-route/static.png) sobre Mapbox, planes desde tabla.
const SUPA = Deno.env.get("SUPABASE_URL");
const ANON = Deno.env.get("SUPABASE_ANON_KEY");
const SVC = Deno.env.get("SENTINEL_SERVICE_KEY");
const MAPBOX = Deno.env.get("MAPBOX_TOKEN");

// ---- Documentos legales servidos por la API (versionados aqui; sin tabla dedicada) ----
const LEGAL_DOCS: Record<string, { title: string; version: string; status: string; body: string[] }> = {
  terms: {
    title: "Condiciones de uso",
    version: "1.0",
    status: "Vigente",
    body: [
      "MY CLUSTER es un servicio de ubicación y protección familiar en tiempo real que permite compartir tu posición con las personas que tú eliges, dentro de círculos privados creados y administrados por los propios usuarios.",
      "Al crear una cuenta aceptas estas condiciones. Debes ser mayor de edad y proporcionar datos veraces. Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.",
      "El servicio se ofrece para uso personal y familiar. No está permitido usar MY CLUSTER para vigilar a personas sin su consentimiento, para finalidades ilícitas o para cualquier uso que vulnere la privacidad de terceros.",
      "Cada círculo es un espacio privado: solo sus miembros pueden ver la ubicación y la actividad compartida dentro de ese círculo. El creador del círculo decide quién entra y con qué permisos, y puede retirar miembros en cualquier momento.",
      "La precisión de la ubicación depende del dispositivo, la cobertura y los sensores disponibles. MY CLUSTER muestra la mejor estimación disponible, pero no garantiza precisión absoluta en tiempo real.",
      "MY CLUSTER no sustituye a los servicios de emergencia oficiales. El botón SOS y las alertas avisan a tus contactos elegidos; en una emergencia real contacta siempre con los servicios públicos de tu país.",
      "Podemos mejorar, modificar o interrumpir funciones del servicio con el fin de mantenerlo seguro y actualizado. Los cambios relevantes en estas condiciones se comunicarán dentro de la app.",
      "Momentum Systems no será responsable de daños indirectos, decisiones tomadas en base a la ubicación mostrada ni de usos del servicio contrarios a estas condiciones.",
      "Estas condiciones se rigen por la legislación española. Para cualquier consulta puedes escribirnos desde la sección de ayuda de la app."
    ]
  },
  privacy: {
    title: "Política de privacidad",
    version: "1.0",
    status: "Vigente",
    body: [
      "Responsable del tratamiento: Momentum Systems. Esta política explica qué datos recoge MY CLUSTER, con qué finalidad y qué derechos tienes.",
      "Datos que tratamos: identificación básica (nombre, correo), foto de perfil si la subes, tu ubicación cuando decides compartirla, los círculos a los que perteneces, tus contactos de emergencia y el historial de consentimientos que has aceptado.",
      "Tu ubicación exacta solo se recoge cuando das permiso y decides compartirla. Puedes pausar la visibilidad en cualquier momento, de forma general o por círculo, y programar horarios en los que tu posición no es visible.",
      "Los datos de ubicación se muestran únicamente a los miembros de tus círculos. Nunca vendemos datos personales ni compartimos tu ubicación con terceros con fines publicitarios.",
      "Base jurídica: ejecución del contrato (prestar el servicio que pides), consentimiento (ubicación, contactos de emergencia, notificaciones) e interés legítimo (seguridad y mejora del servicio).",
      "Conservamos los datos mientras mantengas tu cuenta. Al eliminarla, tus datos personales y tu historial de ubicación se borran de nuestros sistemas activos en el plazo legalmente establecido.",
      "Seguridad: las comunicaciones van cifradas, las operaciones privilegiadas pasan por funciones aisladas del servidor y el acceso a tu foto y a los datos de cada círculo está controlado por políticas de permisos verificadas en cada consulta.",
      "Derechos: puedes acceder, rectificar, suprimir, oponerte y portar tus datos, y retirar tus consentimientos cuando quieras, desde la app o escribiéndonos. También puedes reclamar ante la autoridad de control (AEPD en España).",
      "MY CLUSTER no está dirigido a menores de 14 años. Si detectas que un menor ha creado una cuenta, escríbenos para eliminarla."
    ]
  },
  security: {
    title: "Seguridad",
    version: "1.0",
    status: "Vigente",
    body: [
      "La seguridad de tu familia empieza por la seguridad de tus datos. Este documento resume cómo protegemos MY CLUSTER.",
      "Cifrado en tránsito: todas las comunicaciones entre la app y nuestros servidores usan HTTPS con cifrado TLS.",
      "Aislamiento de privilegios: las operaciones sensibles (fotos, invitaciones, cambios de permisos) se ejecutan en funciones de servidor aisladas que verifican tu identidad en cada llamada. Las claves de administración nunca se incluyen en la app.",
      "Control de acceso por círculos: cada foto, ubicación y dato de grupo se comprueba contra tu pertenencia real al círculo antes de servirse. Nadie fuera de tus círculos puede ver tus datos compartidos.",
      "Consentimiento trazable: cada permiso que aceptas queda registrado con fecha y versión, y puedes revocarlo en cualquier momento desde tu perfil.",
      "Mínimo exposición: solo pedimos los permisos que necesita cada función (ubicación, cámara para la foto de perfil) y explicamos para qué se usan antes de pedirlos.",
      "Buenas prácticas para ti: usa una contraseña única, no compartas tu sesión y revisa periódicamente quién pertenece a tus círculos.",
      "Si descubres una vulnerabilidad, repórtala de forma responsable a través de la sección de ayuda. La investigaremos y responderemos."
    ]
  },
  location: {
    title: "Compartir tu ubicación",
    version: "1.0",
    status: "Vigente",
    body: [
      "MY CLUSTER es un servicio de ubicación familiar en tiempo real organizado en círculos privados. Compartir tu ubicación significa que la app envía tu posición a nuestros servidores y la muestra en el mapa a los miembros de los círculos donde tú has decidido ser visible. Ninguna ubicación se comparte sin que actives el permiso correspondiente.",
      "Qué datos se comparten exactamente: tu posición en el mapa (latitud, longitud y precisión del GPS), tu nombre y foto de perfil, la calle aproximada donde estás, el estado de movimiento (parado / en movimiento / en ruta, con velocidad aproximada) y la batería de tu dispositivo. No se comparte el contenido de tus comunicaciones, tu lista de contactos del teléfono ni ningún dato ajeno a estas categorías.",
      "Quién puede verlo: únicamente las personas que pertenecen a tus círculos, y solo mientras mantengas la visibilidad activa en ese círculo. Tu posición nunca es pública: ninguna persona fuera de tus círculos, ningún buscador y ningún tercero con fines publicitarios puede acceder a ella. Momentum Systems no vende ni cede datos de ubicación.",
      "Cuándo se comparte: solo cuando has concedido el permiso de ubicación del sistema y además tienes la visibilidad activada. Puedes pausar tu visibilidad en cualquier momento, de forma general o por círculo, y la pausa es efectiva de inmediato: el resto deja de verte en el mapa. Tú decides si compartes tu ubicación exacta o solo una zona aproximada.",
      "Control granular por categoría: en el alta y desde tu perfil puedes activar o desactivar por separado la ubicación actual, la zona aproximada, las rutas e historial, la hora estimada de llegada, el estado de movimiento, el modo de transporte, las alertas de seguridad, el estado del dispositivo, la baliza V16 y las métricas de uso. Desactivar una categoría no afecta a las demás.",
      "Cuánto tiempo se conserva: tu posición en vivo se sustituye por la más reciente. El historial de trayectos se usa únicamente para las funciones que lo necesitan (cercas, convoy, rutas) y se conserva el tiempo mínimo necesario para prestarlas. Al eliminar tu cuenta, tu historial de ubicación y tus datos personales se borran de nuestros sistemas activos conforme a la política de privacidad.",
      "La excepción de seguridad: si pulsas SOS, tu posición en ese momento se envía como alerta a tus círculos y contactos de emergencia, incluso si tu visibilidad estaba en pausa. Es la única situación en la que una alerta comparte tu ubicación sin visibilidad activa. MY CLUSTER no sustituye a los servicios oficiales de emergencia (112).",
      "Cómo dejar de compartir: tres formas, todas inmediatas. Pausar la visibilidad desde la app (general o por círculo); retirar el permiso de ubicación en los ajustes de tu dispositivo; o eliminar tu cuenta, que además borra tus datos e historial. Si abandonas un círculo, sus miembros dejan de verte al instante.",
      "Base jurídica y tus derechos: la ubicación se trata sobre la base de tu consentimiento (art. 6.1.a RGPD), que puedes retirar en cualquier momento con los mismos medios con que lo diste, sin que ello afecte a la licitud del tratamiento anterior. Conservamos un registro de tus consentimientos con fecha y versión. Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad desde la app o escribiéndonos, y reclamar ante la AEPD (www.aepd.es).",
      "Menores: MY CLUSTER no está dirigido a menores de 14 años. Las cuentas de menores deben ser creadas y supervisadas por su madre, padre o tutor, que es quien gestiona los permisos de ubicación del menor.",
      "Seguridad del dato: tu posición viaja cifrada (TLS), se almacena con control de acceso verificado en cada consulta (las políticas comprueban tu pertenencia real a cada círculo antes de servir cualquier dato) y las claves de administración nunca están en la app. Nadie puede ver la ubicación de un círculo al que no pertenece, ni siquiera conociendo el enlace.",
      "Cambios y contacto: si esta información cambia de forma relevante lo avisaremos dentro de la app y te pediremos de nuevo el consentimiento si fuera necesario. Para cualquier duda sobre tu ubicación y privacidad, sección de ayuda de la app."
    ]
  },
  how: {
    title: "Cómo funciona",
    version: "1.0",
    status: "Vigente",
    body: [
      "MY CLUSTER organiza a tu gente en círculos: familia, amigos, equipo. Cada círculo tiene sus miembros y sus permisos, y todo lo que compartes dentro de un círculo solo lo ven sus miembros.",
      "Para empezar crea un círculo, ponle nombre e invita a quien quieras. La persona invitada recibe un enlace; al aceptarlo entra en el círculo y decide qué comparte contigo.",
      "Ubicación en vivo: con tu permiso, la app comparte tu posición con los círculos que elijas. Puedes pausarla cuando quieras o programar horarios de visibilidad.",
      "Cercas: marca lugares (casa, trabajo, colegio) y recibe avisos cuando alguien llega o sale. La escolta te acompaña en trayectos y avisa si te desvías o no llegas a la hora prevista.",
      "Quedadas y convoy: organiza puntos de encuentro, comparte la ruta del viaje y llega a la vez con quien viaja contigo.",
      "Sensores: el botón SOS y las alertas de seguridad avisan a tus contactos de emergencia en situaciones críticas. Los permisos se piden justo cuando los necesitas y puedes revocarlos siempre.",
      "Todo el control está en tu perfil: visibilidad, círculos, contacto de emergencia, documentos aceptados y cierre de sesión."
    ]
  }
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-device-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
};
const CATALOG = [
  {
    key: "exact_location",
    label: "Ubicación actual",
    why: "Avisos de llegada, salida y emergencias"
  },
  {
    key: "approx_location",
    label: "Zona aproximada",
    why: "Mostrar el área general sin la posición exacta"
  },
  {
    key: "routes",
    label: "Rutas e historial",
    why: "Revisar trayectos y detectar desvíos"
  },
  {
    key: "eta",
    label: "Hora estimada de llegada",
    why: "Avisar cuándo llega cada miembro"
  },
  {
    key: "motion_state",
    label: "Estado de movimiento",
    why: "Saber si va a pie, en coche o parado"
  },
  {
    key: "mobility_mode",
    label: "Modo de transporte",
    why: "Estadísticas y avisos según cómo se desplaza"
  },
  {
    key: "safety_alerts",
    label: "Alertas de seguridad",
    why: "Botón SOS y avisos de zonas seguras"
  },
  {
    key: "camera",
    label: "Cámara",
    why: "Foto de perfil y evidencias de emergencia"
  },
  {
    key: "microphone",
    label: "Micrófono",
    why: "Audio en emergencias activadas por el usuario"
  },
  {
    key: "device_info",
    label: "Estado del dispositivo",
    why: "Avisos de batería baja y conectividad"
  },
  {
    key: "v16",
    label: "Baliza V16",
    why: "Vincular la baliza del coche a tu seguridad vial"
  },
  {
    key: "metricas",
    label: "Métricas de uso",
    why: "Mejorar la app con datos anónimos de uso"
  }
];
function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      ...extra
    }
  });
}
const err = (code, title, status, reason)=>json({
    detail: {
      code,
      title,
      ...reason ? {
        reason
      } : {}
    }
  }, status);
function jwtPayload(req) {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    return JSON.parse(atob(m[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch  {
    return null;
  }
}
function jwtSub(req) {
  return jwtPayload(req)?.sub ?? null;
}
// REST con el JWT del usuario (RLS activa). Devuelve Response ya parseable.
async function rest(req, path, init = {}, prefer = "return=representation") {
  const headers = {
    apikey: ANON,
    "Content-Type": "application/json",
    Prefer: prefer
  };
  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers
  });
  const txt = await r.text();
  // 204/205/304 son estados sin cuerpo: construir la Response con texto lanzaria
  // "Response with null body status cannot have body" y romperia todo DELETE con return=minimal.
  const nullBody = r.status === 204 || r.status === 205 || r.status === 304;
  return new Response(nullBody ? null : txt || "null", {
    status: r.status,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
}
async function restJ(req, path, init = {}, prefer = "return=representation") {
  const r = await rest(req, path, init, prefer);
  const body = await r.json().catch(()=>null);
  return {
    status: r.status,
    body
  };
}
// REST privilegiado con la service key del servidor (secreto de la funcion, nunca expuesta al cliente).
// Solo para cascadas de administracion que la RLS del usuario no puede cubrir (p. ej. borrar un círculo
// con datos de otros miembros: trail de ubicaciones, convoys, quedadas).
async function restS(path, init = {}, prefer = "return=minimal") {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json",
      Prefer: prefer
    }
  });
  const txt = await r.text();
  let body = null;
  try {
    body = txt ? JSON.parse(txt) : null;
  } catch  {
    body = null;
  }
  return {
    status: r.status,
    body
  };
}
async function authApi(path, init = {}, fwdAuth = null) {
  const headers = {
    apikey: ANON,
    "Content-Type": "application/json"
  };
  if (fwdAuth) headers["Authorization"] = fwdAuth;
  const r = await fetch(`${SUPA}/auth/v1/${path}`, {
    ...init,
    headers
  });
  const txt = await r.text();
  return new Response(txt || "{}", {
    status: r.status,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
}
async function rpc(req, fn, args = {}) {
  const auth = req.headers.get("authorization");
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      "Content-Type": "application/json",
      ...auth ? {
        Authorization: auth
      } : {}
    },
    body: JSON.stringify(args)
  });
  return {
    status: r.status,
    body: await r.json().catch(()=>null)
  };
}
// Usuario enriquecido: shape exacto que espera el frontend (onboarding derivado de datos reales)
async function buildUser(req, u) {
  let profile = null, memberships = [];
  try {
    const pr = await restJ(req, `profiles?id=eq.${u.id}&select=*`);
    profile = Array.isArray(pr.body) ? pr.body[0] ?? null : null;
  } catch  {}
  try {
    const mr = await restJ(req, `group_members?user_id=eq.${u.id}&status=eq.active&select=group_id,role`);
    memberships = Array.isArray(mr.body) ? mr.body : [];
  } catch  {}
  const hasProfile = !!profile?.display_name;
  const hasGroup = memberships.length > 0;
  const step = !hasProfile ? "profile" : !hasGroup ? "group" : "done";
  return {
    id: u.id,
    email: u.email,
    language: profile?.locale ?? "es",
    plan: u.app_metadata?.plan ?? u.user_metadata?.plan ?? "free",
    account_role: u.app_metadata?.role ?? "user",
    profile: profile?.display_name ? {
      name: profile.display_name,
      surname: null
    } : null,
    avatar: {
      color: profile?.avatar_color ?? "#E11D48",
      symbol: profile?.avatar_symbol ?? "person",
      outline: ""
    },
    onboarding: {
      completed: step === "done",
      step
    },
    has_photo: !!profile?.photo_url
  };
}
async function tokenSession(req, gotrueBody) {
  // gotrueBody: respuesta de token/signup con access_token
  const auth = `Bearer ${gotrueBody.access_token}`;
  const ur = await authApi("user", {}, auth);
  const u = await ur.json().catch(()=>null);
  if (!u?.id) return null;
  const req2 = new Request(req.url, {
    headers: {
      authorization: auth
    }
  });
  const user = await buildUser(req2, u);
  return {
    access_token: gotrueBody.access_token,
    refresh_token: gotrueBody.refresh_token,
    expires_in: gotrueBody.expires_in,
    user
  };
}
// ---------- Mapbox ----------
const MB_STYLE = (dark)=>dark ? "dark-v11" : "streets-v12";
function hav(aLat, aLng, bLat, bLng) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
async function mbGeocode(q, lat, lng, limit = 5) {
  const u = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`);
  u.searchParams.set("access_token", MAPBOX);
  u.searchParams.set("language", "es");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("country", "ES");
  u.searchParams.set("types", "address,place,locality,poi");
  if (lat != null && lng != null) u.searchParams.set("proximity", `${lng},${lat}`);
  const r = await fetch(u);
  if (!r.ok) return null;
  const d = await r.json();
  return (d.features ?? []).map((f)=>{
    const ctx = Object.fromEntries((f.context ?? []).map((c)=>[
        c.id.split(".")[0],
        c.text
      ]));
    const isAddr = (f.place_type ?? []).includes("address");
    const street = isAddr ? f.text : null;
    const name = isAddr && f.address ? `${f.text} ${f.address}, ${ctx.place ?? ""}`.trim() : f.place_name;
    const out = {
      name,
      lat: f.center[1],
      lng: f.center[0],
      has_number: isAddr && !!f.address,
      street: street ?? undefined,
      municipality: ctx.place ?? ctx.locality ?? undefined
    };
    if (lat != null && lng != null) out.distance_m = Math.round(hav(lat, lng, out.lat, out.lng));
    return out;
  });
}
async function mbReverse(lat, lng) {
  const u = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
  u.searchParams.set("access_token", MAPBOX);
  u.searchParams.set("language", "es");
  u.searchParams.set("limit", "1");
  u.searchParams.set("types", "address");
  const r = await fetch(u);
  if (!r.ok) return null;
  const d = await r.json();
  const f = (d.features ?? [])[0];
  if (!f) return null;
  const ctx = Object.fromEntries((f.context ?? []).map((c)=>[
      c.id.split(".")[0],
      c.text
    ]));
  const short = [
    f.text ?? "",
    f.address ?? ""
  ].filter(Boolean).join(" ");
  return {
    short: short || f.place_name,
    full: f.place_name,
    neighborhood: ctx.neighborhood ?? ctx.locality ?? undefined,
    municipality: ctx.place ?? ctx.municipality ?? undefined
  };
}
function polyEncode(coords) {
  let out = "", plat = 0, plng = 0;
  const enc = (v)=>{
    v = v < 0 ? ~(v << 1) : v << 1;
    while(v >= 0x20){
      out += String.fromCharCode((0x20 | v & 0x1f) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [la, ln] of coords){
    const la5 = Math.round(la * 1e5), ln5 = Math.round(ln * 1e5);
    enc(la5 - plat);
    enc(ln5 - plng);
    plat = la5;
    plng = ln5;
  }
  return out;
}
async function mbRouteTry(points, prof) {
  const coords = points.map(([la, ln])=>`${ln},${la}`).join(";");
  const u = new URL(`https://api.mapbox.com/directions/v5/mapbox/${prof}/${coords}`);
  u.searchParams.set("access_token", MAPBOX);
  u.searchParams.set("geometries", "geojson");
  u.searchParams.set("overview", "full");
  u.searchParams.set("steps", "true");
  u.searchParams.set("language", "es");
  const r = await fetch(u);
  if (!r.ok) return null;
  const d = await r.json();
  return d.routes?.[0] ?? null;
}
async function mbRoute(points, mode) {
  const primary = {
    car: "driving-traffic",
    motorcycle: "driving",
    bicycle: "cycling",
    pedestrian: "walking"
  }[mode] ?? "driving";
  // si el punto cae en zona no transitable (parque, peatonal), el perfil de coche no encuentra ruta: caer a pie
  const chain = primary === "driving-traffic" ? [
    "driving-traffic",
    "driving",
    "walking"
  ] : primary === "driving" ? [
    "driving",
    "walking"
  ] : [
    primary,
    "walking"
  ];
  let route = null, used = primary;
  for (const prof of chain){
    route = await mbRouteTry(points, prof).catch(()=>null);
    if (route) {
      used = prof;
      break;
    }
  }
  if (!route) return null;
  return {
    geometry: route.geometry.coordinates.map(([ln, la])=>[
        la,
        ln
      ]),
    distance_m: Math.round(route.distance),
    duration_s: Math.round(route.duration),
    duration_traffic_s: Math.round(route.duration_typical ?? route.duration),
    steps: (route.legs ?? []).flatMap((l)=>(l.steps ?? []).map((s)=>({
          distance_m: Math.round(s.distance),
          text: s.maneuver?.instruction ?? ""
        }))),
    provider: "mapbox",
    profile_used: used
  };
}
async function mbStatic(lat, lng, zoom, w, h, dark, pins, path) {
  // pins: [{lat,lng,hex}], path: [[lat,lng],...]
  const overlays = [];
  if (path && path.length > 1) overlays.push(`path-4+E11D48-0.8(${encodeURIComponent(polyEncode(path))})`);
  for (const p of (pins ?? []).slice(0, 12))overlays.push(`pin-s+${p.hex ?? "E11D48"}(${p.lng},${p.lat})`);
  const ov = overlays.length ? overlays.join(",") + "/" : "";
  const scale = w <= 640 && h <= 640 ? "@2x" : "";
  const u = `https://api.mapbox.com/styles/v1/mapbox/${MB_STYLE(dark)}/static/${ov}${lng},${lat},${zoom}/${Math.round(w)}x${Math.round(h)}${scale}?access_token=${MAPBOX}&logo=false&attribution=false`;
  const r = await fetch(u);
  if (!r.ok) return new Response("map error", {
    status: 502,
    headers: CORS
  });
  const buf = await r.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=30"
    }
  });
}
// ---- FMS Integration (v8): sandbox de eventos normalizados para clientes privados ----
// Auth por claves de API (clientes) y device keys (nodos fisicos). Las claves viajan solo
// en cabeceras; aqui se guarda y se compara su SHA-256. Las tablas fms_* tienen RLS sin
// policies: solo esta funcion (service key) las toca.
async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [
    ...new Uint8Array(d)
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
async function hmacSha256Hex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [
    ...new Uint8Array(sig)
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
async function fmsClient(req) {
  const key = req.headers.get("x-api-key");
  if (!key) return {
    error: err("UNAUTHORIZED", "Falta la cabecera X-API-Key", 401)
  };
  const h = await sha256Hex(key);
  const r = await restS(`fms_clients?api_key_hash=eq.${h}&status=eq.active&select=id,name,status`, {}, "return=representation");
  const row = Array.isArray(r.body) ? r.body[0] : null;
  if (!row) return {
    error: err("UNAUTHORIZED", "API key no valida o suspendida", 401)
  };
  return {
    client: row
  };
}
async function fmsDevice(req) {
  const key = req.headers.get("x-device-key");
  if (!key) return {
    error: err("UNAUTHORIZED", "Falta la cabecera X-Device-Key", 401)
  };
  const h = await sha256Hex(key);
  const r = await restS(`fms_devices?device_key_hash=eq.${h}&select=id,label,imei,client_id`, {}, "return=representation");
  const row = Array.isArray(r.body) ? r.body[0] : null;
  if (!row) return {
    error: err("UNAUTHORIZED", "Device key no valida", 401)
  };
  return {
    device: row
  };
}
function fmsNormalize(ev, device) {
  return {
    id: ev.id,
    device_id: ev.device_id,
    device_label: device?.label ?? null,
    imei: device?.imei ?? null,
    event_type: ev.event_type,
    latitude: ev.latitude,
    longitude: ev.longitude,
    occurred_at: ev.occurred_at,
    received_at: ev.received_at,
    status: ev.status,
    priority: ev.priority,
    payload: ev.payload ?? {}
  };
}
const FMS_EVENT_TYPES = new Set([
  "v16_activated",
  "v16_deactivated",
  "v16_test",
  "sos",
  "generic"
]);
async function fmsDeliver(ev) {
  const hooks = await restS("fms_webhooks?active=eq.true&select=id,url,secret", {}, "return=representation");
  const list = Array.isArray(hooks.body) ? hooks.body : [];
  const body = JSON.stringify(ev);
  const results = [];
  for (const w of list){
    const sig = await hmacSha256Hex(w.secret, body);
    let status = null, ok = false, errorText = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 5000);
      const r = await fetch(w.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FMS-Event-Id": String(ev.id),
          "X-FMS-Signature": `sha256=${sig}`
        },
        body,
        signal: ctrl.signal
      });
      clearTimeout(t);
      status = r.status;
      ok = r.ok;
    } catch (e) {
      errorText = String(e).slice(0, 300);
    }
    await restS("fms_deliveries", {
      method: "POST",
      body: JSON.stringify({
        webhook_id: w.id,
        event_id: ev.id,
        status_code: status,
        ok,
        error: errorText
      })
    });
    results.push({
      webhook_id: w.id,
      ok,
      status_code: status
    });
  }
  return results;
}
const UUID_RE = "([0-9a-fA-F-]{36})";
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: CORS
  });
  const url = new URL(req.url);
  const p = url.pathname.replace(/^\/sentinel-api/, "").replace(/^\/+/, "/").replace(/\/+$/, "") || "/";
  const sub = jwtSub(req);
  const needAuth = ()=>sub ? null : err("UNAUTHORIZED", "No autenticado", 401);
  try {
    // ---- Salud / estado ----
    if (p === "/api/health") return json({
      ok: true,
      service: "sentinel-api",
      version: "0.8.0"
    });
    if (p === "/api/system/status") return json({
      ok: true,
      service: "sentinel-api",
      version: "0.8.0",
      providers: {
        geocoding: MAPBOX ? {
          provider: "Mapbox",
          note: null
        } : {
          provider: null,
          note: "SERVICIO NO CONFIGURADO"
        },
        maps_web: MAPBOX ? {
          provider: "Mapbox Static",
          note: null
        } : {
          provider: null,
          note: "SERVICIO NO CONFIGURADO"
        },
        routing: MAPBOX ? {
          provider: "Mapbox Directions",
          note: null
        } : {
          provider: null,
          note: "SERVICIO NO CONFIGURADO"
        },
        traffic_incidents: {
          provider: null,
          note: "SERVICIO NO CONFIGURADO"
        }
      }
    });
    // ---- Auth ----
    if (p === "/api/auth/login" && req.method === "POST") {
      const b = await req.json().catch(()=>({}));
      if (!b.email || !b.password) return err("BAD_REQUEST", "Faltan email o contraseña", 400);
      const r = await authApi("token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({
          email: b.email,
          password: b.password
        })
      });
      const raw = await r.json().catch(()=>null);
      if (r.status !== 200 || !raw?.access_token) return err("UNAUTHORIZED", raw?.error_description ?? raw?.msg ?? "Credenciales no válidas", r.status === 200 ? 401 : r.status);
      const s = await tokenSession(req, raw);
      return s ? json(s) : err("UNAUTHORIZED", "No se pudo cargar la sesión", 401);
    }
    if (p === "/api/auth/register" && req.method === "POST") {
      const b = await req.json().catch(()=>({}));
      if (!b.email || !b.password) return err("BAD_REQUEST", "Faltan email o contraseña", 400);
      const r = await authApi("signup", {
        method: "POST",
        body: JSON.stringify({
          email: b.email,
          password: b.password,
          data: {
            meta: b.client ?? null
          }
        })
      });
      const raw = await r.json().catch(()=>null);
      if (r.status >= 400) return err("BAD_REQUEST", raw?.error_description ?? raw?.msg ?? "No se pudo registrar", r.status);
      if (!raw?.access_token) return err("EMAIL_CONFIRMATION", "Registro creado; confirma el email para entrar", 409);
      const s = await tokenSession(req, raw);
      return s ? json(s) : err("INTERNAL", "No se pudo cargar la sesión", 500);
    }
    if (p === "/api/auth/refresh" && req.method === "POST") {
      const b = await req.json().catch(()=>({}));
      if (!b.refresh_token) return err("BAD_REQUEST", "Falta refresh_token", 400);
      const r = await authApi("token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({
          refresh_token: b.refresh_token
        })
      });
      const raw = await r.json().catch(()=>null);
      if (r.status !== 200 || !raw?.access_token) return err("UNAUTHORIZED", "Sesión caducada", 401);
      const s = await tokenSession(req, raw);
      return s ? json(s) : json({
        access_token: raw.access_token,
        refresh_token: raw.refresh_token
      });
    }
    if (p === "/api/auth/session" && req.method === "POST") {
      return err("SERVICE_NOT_CONFIGURED", "Inicio con Google no configurado en este entorno", 503, "auth/session requiere OAuth externo");
    }
    if (p === "/api/auth/logout" && req.method === "POST") {
      const auth = req.headers.get("authorization");
      if (auth) await authApi("logout", {
        method: "POST",
        body: "{}"
      }, auth).catch(()=>null);
      return json({
        ok: true
      });
    }
    if (p === "/api/auth/me" && req.method === "GET") {
      const auth = req.headers.get("authorization");
      if (!auth) return err("UNAUTHORIZED", "No autenticado", 401);
      const r = await authApi("user", {}, auth);
      if (r.status !== 200) return err("UNAUTHORIZED", "Sesión no válida", 401);
      const u = await r.json();
      return json(await buildUser(req, u));
    }
    if (p === "/api/auth/sessions" && req.method === "GET") return json([]);
    // ---- Perfil ----
    if (p === "/api/profile" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      return rest(req, `profiles?id=eq.${sub}&select=*`);
    }
    if (p === "/api/profile" && req.method === "PUT") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      const row = {
        id: sub
      };
      // la app envía name/surname/language; la tabla usa display_name/locale
      if (b.name !== undefined) row.display_name = String(b.name).trim().slice(0, 80);
      if (b.display_name !== undefined) row.display_name = String(b.display_name).trim().slice(0, 80);
      if (b.language !== undefined) row.locale = b.language;
      for (const k of [
        "avatar_color",
        "avatar_symbol",
        "phone",
        "locale",
        "photo_url",
        "blood_type",
        "allergies",
        "emergency_contact_name",
        "emergency_contact_phone",
        "insurance_policy",
        "car_insurance_policy",
        "insurer_emergency_phone"
      ]){
        if (b[k] !== undefined) row[k] = b[k];
      }
      return rest(req, "profiles?on_conflict=id", {
        method: "POST",
        body: JSON.stringify(row)
      }, "resolution=merge-duplicates,return=representation");
    }
    if (p === "/api/profile/avatar" && req.method === "PUT") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      const row = {
        id: sub
      };
      if (b.photo_url !== undefined) row.photo_url = b.photo_url;
      if (b.color !== undefined) row.avatar_color = b.color;
      if (b.symbol !== undefined) row.avatar_symbol = b.symbol;
      if (b.avatar_color !== undefined) row.avatar_color = b.avatar_color;
      if (b.avatar_symbol !== undefined) row.avatar_symbol = b.avatar_symbol;
      return rest(req, "profiles?on_conflict=id", {
        method: "POST",
        body: JSON.stringify(row)
      }, "resolution=merge-duplicates,return=representation");
    }
    if (p === "/api/profile/onboarding-step" && req.method === "PUT") return json({
      ok: true
    });
    // ---- Permisos / consentimientos ----
    if (p === "/api/permissions/catalog" && req.method === "GET") return json(CATALOG);
    if (p === "/api/permissions" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      return rest(req, `permission_events?user_id=eq.${sub}&order=created_at.desc&limit=50&select=*`);
    }
    if (p === "/api/permissions/history" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      return rest(req, `permission_events?user_id=eq.${sub}&order=created_at.desc&limit=100&select=*`);
    }
    if (p === "/api/permissions" && req.method === "POST") {
      const b = await req.json().catch(()=>({}));
      if (!sub) return json({
        ok: true,
        stored: false
      }, 202);
      const ins = await rest(req, "permission_events", {
        method: "POST",
        body: JSON.stringify({
          user_id: sub,
          permission: b.key,
          granted: !!b.granted
        })
      });
      return json({
        ok: true,
        stored: ins.status < 400
      }, ins.status < 400 ? 200 : 202);
    }
    if (p === "/api/consents" && req.method === "POST") {
      const b = await req.json().catch(()=>({}));
      if (!sub) return json({
        ok: true,
        stored: false
      }, 202);
      const ins = await rest(req, "consents", {
        method: "POST",
        body: JSON.stringify({
          user_id: sub,
          doc_type: b.doc_type ?? b.doc ?? b.document ?? "terms",
          version: b.version ?? "1.0",
          locale: b.locale ?? "es",
          platform: b.platform ?? null,
          app_version: b.app_version ?? null,
          client_ts: b.client_ts ?? b.accepted_at_client ?? new Date().toISOString()
        })
      });
      return json({
        ok: true,
        stored: ins.status < 400
      }, ins.status < 400 ? 200 : 202);
    }
    // ---- Planes ----
    if (p === "/api/plans" && req.method === "GET") {
      const r = await restJ(req, "plans?select=*&order=code.asc");
      const rows = Array.isArray(r.body) ? r.body : [];
      return json(rows.map((x)=>({
          code: x.code,
          name: x.name,
          price_label: x.limits?.price_label ?? "",
          entitlements: x.limits?.entitlements ?? {}
        })));
    }
    if (p === "/api/entitlements" && req.method === "GET") {
      const payload = jwtPayload(req);
      const plan = payload?.app_metadata?.plan ?? payload?.user_metadata?.plan ?? "free";
      let canCreate = true;
      if (sub) {
        const pr = await restJ(req, `profiles?id=eq.${sub}&select=can_create_groups`);
        if (Array.isArray(pr.body) && pr.body[0]?.can_create_groups === false) canCreate = false;
      }
      const base = {
        free: {
          canCreateGroups: true,
          maxGroups: 1,
          maxPermanentMembers: 5,
          maxTemporaryGuests: 2,
          cameraShareDuration: 60,
          advancedMobility: false,
          roadReality: false,
          familyMetrics: false,
          convoy: true,
          meetings: true,
          antiCongestion: false
        },
        basic: {
          canCreateGroups: true,
          maxGroups: 3,
          maxPermanentMembers: 10,
          maxTemporaryGuests: 5,
          cameraShareDuration: 60,
          advancedMobility: true,
          roadReality: false,
          familyMetrics: true,
          convoy: true,
          meetings: true,
          antiCongestion: true
        },
        pro: {
          canCreateGroups: true,
          maxGroups: 10,
          maxPermanentMembers: 30,
          maxTemporaryGuests: 20,
          cameraShareDuration: 120,
          advancedMobility: true,
          roadReality: true,
          familyMetrics: true,
          convoy: true,
          meetings: true,
          antiCongestion: true
        }
      };
      const ent = {
        ...base[plan] ?? base.free
      };
      ent.canCreateGroups = !!ent.canCreateGroups && canCreate;
      return json({
        plan,
        plan_name: plan === "pro" ? "Pro" : plan === "basic" ? "Basic" : "Free",
        entitlements: ent
      });
    }
    // ---- Grupos ----
    if (p === "/api/groups" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      const r = await restJ(req, "groups?select=*,memberships:group_members(user_id,role,status),invites:invitations(status)");
      if (r.status >= 400) return json([], r.status);
      const rows = Array.isArray(r.body) ? r.body : [];
      return json(rows.map((g)=>{
        const mine = (g.memberships ?? []).find((m)=>m.user_id === sub);
        const pending = (g.invites ?? []).filter((i)=>[
            "pending",
            "prepared",
            "dispatched"
          ].includes(i.status)).length;
        const { memberships, invites, ...rest0 } = g;
        return {
          ...rest0,
          my_role: mine?.role ?? null,
          stats: {
            pending
          }
        };
      }));
    }
    if (p === "/api/groups" && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      if (!b.name?.trim()) return err("BAD_REQUEST", "Falta el nombre del grupo", 400);
      const g = await restJ(req, "groups", {
        method: "POST",
        body: JSON.stringify({
          name: b.name.trim(),
          owner_id: sub
        })
      });
      if (g.status >= 400) return err("FORBIDDEN", "No se pudo crear el grupo", g.status, JSON.stringify(g.body).slice(0, 200));
      const row = Array.isArray(g.body) ? g.body[0] : g.body;
      await restJ(req, "group_members", {
        method: "POST",
        body: JSON.stringify({
          group_id: row.id,
          user_id: sub,
          role: "owner",
          status: "active"
        })
      });
      return json({
        ...row,
        my_role: "owner",
        stats: {
          pending: 0
        }
      }, 201);
    }
    const groupMatch = p.match(new RegExp(`^/api/groups/${UUID_RE}$`));
    if (groupMatch && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      const gid = groupMatch[1];
      const r = await restJ(req, `groups?id=eq.${gid}&select=*,members:group_members(user_id,role,status,joined_at,membership,expires_at,profile:profiles(display_name,avatar_color,avatar_symbol,photo_url)),zones:zones(id,name,kind,address_hint,lat,lng,radius_m,is_active),invites:invitations(token,invitee_name,status,membership,expires_at,created_at)`);
      if (r.status >= 400) return err("FORBIDDEN", "Sin acceso al grupo", r.status);
      const g = Array.isArray(r.body) ? r.body[0] : r.body;
      if (!g) return err("NOT_FOUND", "Grupo no encontrado", 404);
      const members = (g.members ?? []).map((m)=>({
          id: m.user_id,
          user_id: m.user_id,
          role: m.role,
          status: m.status,
          joined_at: m.joined_at,
          membership: m.membership ?? (m.role === "guest" ? "temporary" : "fixed"),
          expires_at: m.expires_at ?? null,
          display_name: m.profile?.display_name ?? "Miembro",
          name: m.profile?.display_name ?? "Miembro",
          color: m.profile?.avatar_color ?? "#64748B",
          avatar_symbol: m.profile?.avatar_symbol ?? null,
          photo_url: m.profile?.photo_url ?? null
        }));
      const mine = (g.members ?? []).find((m)=>m.user_id === sub);
      return json({
        ...g,
        members,
        my_role: mine?.role ?? null,
        invitations: g.invites ?? [],
        zones: g.zones ?? []
      });
    }
    if (groupMatch && req.method === "PATCH") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      if (!b.name?.trim()) return err("BAD_REQUEST", "Falta el nombre", 400);
      const r = await restJ(req, `groups?id=eq.${groupMatch[1]}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: b.name.trim()
        })
      });
      if (r.status >= 400) return err("FORBIDDEN", "No se pudo renombrar", r.status);
      return json(Array.isArray(r.body) ? r.body[0] ?? {
        ok: true
      } : r.body);
    }
    if (groupMatch && req.method === "DELETE") {
      const na = needAuth();
      if (na) return na;
      const gid = groupMatch[1];
      // El borrado de un círculo es una cascada privilegiada: incluye datos de otros miembros
      // (trail de ubicaciones, convoys, quedadas) que la RLS del usuario no puede tocar.
      // Va con la service key del servidor (secreto de esta funcion) y en orden de dependencias.
      if (!SVC) return err("SERVICE_NOT_CONFIGURED", "Borrado de círculo no configurado en este entorno", 503);
      // Autorizacion previa con el JWT del usuario (la cascada con service key salta la RLS:
      // solo owner del círculo o admin activo pueden dispararla).
      const gq = await restJ(req, `groups?id=eq.${gid}&select=owner_id`);
      const isOwner = Array.isArray(gq.body) && gq.body[0]?.owner_id === sub;
      const mine = await restJ(req, `group_members?group_id=eq.${gid}&user_id=eq.${sub}&status=eq.active&select=role`);
      const role = Array.isArray(mine.body) ? mine.body[0]?.role : null;
      if (!isOwner && !(role && [
        "owner",
        "admin"
      ].includes(role))) return err("FORBIDDEN", "Solo el dueño o un administrador puede borrar el círculo", 403);
      const pick = (r, k)=>Array.isArray(r.body) ? r.body.map((x)=>x[k]).filter(Boolean) : [];
      const fail = (step, r)=>err("FORBIDDEN", "No se pudo borrar el grupo", r.status, `${step}: ${JSON.stringify(r.body).slice(0, 220)}`);
      const mt = await restS(`meetings?group_id=eq.${gid}&select=id`);
      if (mt.status >= 400) return fail("meetings-read", mt);
      const cv = await restS(`convoys?group_id=eq.${gid}&select=id`);
      if (cv.status >= 400) return fail("convoys-read", cv);
      const meetingIds = pick(mt, "id"), convoyIds = pick(cv, "id");
      if (meetingIds.length) {
        const r = await restS(`meeting_participants?meeting_id=in.(${meetingIds.join(",")})`, { method: "DELETE" });
        if (r.status >= 400) return fail("meeting_participants", r);
      }
      if (convoyIds.length) {
        const r = await restS(`convoy_members?convoy_id=in.(${convoyIds.join(",")})`, { method: "DELETE" });
        if (r.status >= 400) return fail("convoy_members", r);
      }
      for (const step of [
        `meetings?group_id=eq.${gid}`,
        `convoys?group_id=eq.${gid}`,
        `zone_events?group_id=eq.${gid}`,
        `alert_events?group_id=eq.${gid}`,
        `location_trail?group_id=eq.${gid}`,
        `locations?group_id=eq.${gid}`,
        `zones?group_id=eq.${gid}`,
        `circle_requests?group_id=eq.${gid}`,
        `invitations?group_id=eq.${gid}`,
        `group_members?group_id=eq.${gid}`,
        `groups?id=eq.${gid}`
      ]){
        const r = await restS(step, { method: "DELETE" });
        if (r.status >= 400) return fail(step.split("?")[0], r);
      }
      return json({
        ok: true
      });
    }
    const formedMatch = p.match(new RegExp(`^/api/groups/${UUID_RE}/formed$`));
    if (formedMatch && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      return json({
        ok: true
      });
    }
    const posMatch = p.match(new RegExp(`^/api/groups/${UUID_RE}/positions$`));
    if (posMatch && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      const gid = posMatch[1];
      const r = await restJ(req, `locations?group_id=eq.${gid}&select=user_id,lat,lng,accuracy,battery,updated_at,profile:profiles(display_name,avatar_color,photo_url)`);
      const rows = r.status >= 400 ? [] : Array.isArray(r.body) ? r.body : [];
      return json(rows.map((l)=>({
          member_id: l.user_id,
          user_id: l.user_id,
          name: l.profile?.display_name ?? "Miembro",
          color: l.profile?.avatar_color ?? "#64748B",
          photo_url: l.profile?.photo_url ?? null,
          state: l.lat != null && l.lng != null ? "shared" : "hidden",
          lat: l.lat,
          lng: l.lng,
          precision: l.accuracy != null ? String(Math.round(l.accuracy)) : undefined,
          at: l.updated_at ?? undefined,
          is_me: l.user_id === sub,
          status: null
        })));
    }
    const membersMatch = p.match(new RegExp(`^/api/groups/${UUID_RE}/members/${UUID_RE}$`));
    if (membersMatch && req.method === "DELETE") {
      const na = needAuth();
      if (na) return na;
      const r = await rest(req, `group_members?group_id=eq.${membersMatch[1]}&user_id=eq.${membersMatch[2]}`, {
        method: "DELETE"
      }, "return=minimal");
      if (r.status >= 400) return err("FORBIDDEN", "No se pudo quitar al miembro", r.status);
      return json({
        ok: true
      });
    }
    const roleMatch = p.match(new RegExp(`^/api/groups/${UUID_RE}/members/${UUID_RE}/role$`));
    if (roleMatch && req.method === "PATCH") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      if (![
        "owner",
        "admin",
        "member",
        "guest"
      ].includes(b.role)) return err("BAD_REQUEST", "Rol no válido", 400);
      const r = await restJ(req, `group_members?group_id=eq.${roleMatch[1]}&user_id=eq.${roleMatch[2]}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: b.role
        })
      });
      if (r.status >= 400) return err("FORBIDDEN", "No se pudo cambiar el rol", r.status);
      return json({
        ok: true
      });
    }
    // ---- Invitaciones ----
    const invCreate = p.match(new RegExp(`^/api/groups/${UUID_RE}/invitations$`));
    if (invCreate && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      if (!b.name?.trim()) return err("BAD_REQUEST", "Falta el nombre del invitado", 400);
      const gid = invCreate[1];
      const membership = b.membership === "temporary" ? "temporary" : "fixed";
      const expires = membership === "temporary" ? new Date(Date.now() + (Number(b.duration_hours) || 24) * 3600e3).toISOString() : null;
      const row = {
        group_id: gid,
        invited_by: sub,
        invitee_name: b.name.trim(),
        contact: b.phone ?? b.name.trim(),
        membership,
        role: membership === "temporary" ? "guest" : "member",
        expires_at: expires,
        status: "prepared"
      };
      const ins = await restJ(req, "invitations", {
        method: "POST",
        body: JSON.stringify(row)
      });
      if (ins.status >= 400) return err("FORBIDDEN", "No se pudo crear la invitación", ins.status, JSON.stringify(ins.body).slice(0, 200));
      const inv = Array.isArray(ins.body) ? ins.body[0] : ins.body;
      const g = await restJ(req, `groups?id=eq.${gid}&select=name`);
      const gname = Array.isArray(g.body) ? g.body[0]?.name : null;
      const origin = req.headers.get("origin");
      const link = origin ? `${origin}/invite/${inv.token}` : `sentinel://invite/${inv.token}`;
      return json({
        invitation: {
          id: inv.token,
          name: inv.invitee_name,
          channel: b.channel === "sms" ? "sms" : "whatsapp",
          status: inv.status,
          phone: b.phone ?? null,
          multi: false,
          link,
          group_name: gname ?? "tu grupo",
          membership,
          created_at: inv.created_at,
          dispatched_at: null
        }
      }, 201);
    }
    const invDisp = p.match(new RegExp(`^/api/invitations/${UUID_RE}/dispatched$`));
    if (invDisp && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      await restJ(req, `invitations?token=eq.${invDisp[1]}&status=eq.prepared`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "dispatched"
        })
      });
      return json({
        ok: true
      });
    }
    const invTok = p.match(new RegExp(`^/api/invitations/by-token/${UUID_RE}$`));
    if (invTok && req.method === "GET") {
      const r = await rpc(req, "get_invitation_preview", {
        p_token: invTok[1]
      });
      const d = r.body;
      if (!d || d.error) return err("NOT_FOUND", "Invitación no encontrada o enlace no válido", 404);
      return json({
        group_name: d.group_name,
        name: d.invitee_name ?? "invitado",
        inviter_name: d.inviter_name ?? null,
        multi: false,
        membership: d.membership ?? "fixed",
        expires_at: d.expires_at ?? null,
        status: "prepared"
      });
    }
    const invResp = p.match(new RegExp(`^/api/invitations/by-token/${UUID_RE}/respond$`));
    if (invResp && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      const r = await rpc(req, b.accept ? "accept_invitation" : "decline_invitation", {
        p_token: invResp[1]
      });
      const d = r.body;
      if (!d || d.error) return err("BAD_REQUEST", `No se pudo responder: ${d?.error ?? "error"}`, 400);
      return json({
        status: b.accept ? "accepted" : "declined",
        ...d
      });
    }
    // ---- Ubicación ----
    if (p === "/api/location" && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      if (typeof b.lat !== "number" || typeof b.lng !== "number") return err("BAD_REQUEST", "Faltan lat/lng", 400);
      const mem = await restJ(req, `group_members?user_id=eq.${sub}&status=eq.active&select=group_id`);
      const groups = Array.isArray(mem.body) ? mem.body : [];
      const at = new Date().toISOString();
      for (const m of groups){
        await restJ(req, "locations?on_conflict=user_id,group_id", {
          method: "POST",
          body: JSON.stringify({
            user_id: sub,
            group_id: m.group_id,
            lat: b.lat,
            lng: b.lng,
            accuracy: typeof b.accuracy === "number" ? b.accuracy : null,
            battery: typeof b.battery === "number" ? Math.round(b.battery) : null,
            updated_at: at
          })
        }, "resolution=merge-duplicates,return=minimal");
      }
      return json({
        at,
        groups_updated: groups.length
      });
    }
    // ---- Eventos (alert_events) ----
    if (p === "/api/events" && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      if (!b.group_id || !b.kind) return err("BAD_REQUEST", "Faltan group_id o kind", 400);
      const status = b.severity === "critical" || b.kind === "emergency" ? "emergency" : "open";
      const ins = await restJ(req, "alert_events", {
        method: "POST",
        body: JSON.stringify({
          user_id: sub,
          group_id: b.group_id,
          kind: b.kind,
          status,
          target_user_id: b.target_user_id ?? null,
          lat: typeof b.lat === "number" ? b.lat : null,
          lng: typeof b.lng === "number" ? b.lng : null
        })
      });
      if (ins.status >= 400) return err("FORBIDDEN", "No se pudo registrar el evento", ins.status, JSON.stringify(ins.body).slice(0, 200));
      return json(Array.isArray(ins.body) ? ins.body[0] : ins.body, 201);
    }
    const evList = p.match(new RegExp(`^/api/groups/${UUID_RE}/events$`));
    if (evList && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      const r = await restJ(req, `alert_events?group_id=eq.${evList[1]}&order=created_at.desc&limit=50&select=*,author:profiles!alert_events_user_id_fkey(display_name,avatar_color)`);
      const rows = Array.isArray(r.body) ? r.body : [];
      return json(rows.map((e)=>({
          id: String(e.id),
          kind: e.kind,
          status: e.status,
          lat: e.lat,
          lng: e.lng,
          user_id: e.user_id,
          target_user_id: e.target_user_id,
          created_at: e.created_at,
          author_name: e.author?.display_name ?? "Miembro",
          color: e.author?.avatar_color ?? "#64748B"
        })));
    }
    const evAction = p.match(new RegExp(`^/api/events/(\\d+)/action$`));
    if (evAction && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      const status = b.action === "resolve" ? "resolved" : b.action === "escalate" ? "escalated" : "open";
      const r = await restJ(req, `alert_events?id=eq.${evAction[1]}`, {
        method: "PATCH",
        body: JSON.stringify({
          status
        })
      });
      if (r.status >= 400) return err("FORBIDDEN", "No se pudo actualizar el evento", r.status);
      return json({
        ok: true,
        status
      });
    }
    // ---- Quedadas ----
    if (p === "/api/meetings" && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      if (!b.group_id || !b.name?.trim()) return err("BAD_REQUEST", "Faltan group_id o name", 400);
      let lat = typeof b.lat === "number" ? b.lat : null;
      let lng = typeof b.lng === "number" ? b.lng : null;
      let place = b.place_name ?? null;
      if ((lat == null || lng == null) && (b.place_query || b.natural_command) && MAPBOX) {
        const found = await mbGeocode(b.place_query ?? b.natural_command, null, null, 1).catch(()=>null);
        if (found?.[0]) {
          lat = found[0].lat;
          lng = found[0].lng;
          place = place ?? found[0].name;
        }
      }
      const ins = await restJ(req, "meetings", {
        method: "POST",
        body: JSON.stringify({
          group_id: b.group_id,
          name: b.name.trim(),
          place_name: place,
          lat,
          lng,
          created_by: sub
        })
      });
      if (ins.status >= 400) return err("FORBIDDEN", "No se pudo crear la quedada", ins.status, JSON.stringify(ins.body).slice(0, 200));
      const m = Array.isArray(ins.body) ? ins.body[0] : ins.body;
      const mem = await restJ(req, `group_members?group_id=eq.${b.group_id}&status=eq.active&select=user_id`);
      const rows = (Array.isArray(mem.body) ? mem.body : []).map((x)=>({
          meeting_id: m.id,
          user_id: x.user_id,
          state: x.user_id === sub ? "aceptado" : "invitado"
        }));
      if (rows.length) await restJ(req, "meeting_participants", {
        method: "POST",
        body: JSON.stringify(rows)
      }, "return=minimal");
      return json({
        id: m.id,
        name: m.name,
        status: m.status
      }, 201);
    }
    const meetList = p.match(new RegExp(`^/api/groups/${UUID_RE}/meetings$`));
    if (meetList && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      const r = await restJ(req, `meetings?group_id=eq.${meetList[1]}&order=created_at.desc&limit=20&select=*`);
      return json(Array.isArray(r.body) ? r.body : []);
    }
    const meetGet = p.match(new RegExp(`^/api/meetings/${UUID_RE}$`));
    if (meetGet && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      const mid = meetGet[1];
      const r = await restJ(req, `meetings?id=eq.${mid}&select=*,participants:meeting_participants(user_id,state,updated_at)`);
      if (r.status >= 400) return err("FORBIDDEN", "Sin acceso a la quedada", r.status);
      const m = Array.isArray(r.body) ? r.body[0] : r.body;
      if (!m || !m.id) return err("NOT_FOUND", "Quedada no encontrada", 404);
      const uids = (m.participants ?? []).map((x)=>x.user_id);
      const profs = uids.length ? await restJ(req, `profiles?id=in.(${uids.join(",")})&select=id,display_name,avatar_color`) : {
        body: []
      };
      const profBy = Object.fromEntries((Array.isArray(profs.body) ? profs.body : []).map((x)=>[
          x.id,
          x
        ]));
      for (const pt of m.participants ?? [])pt.profile = profBy[pt.user_id] ?? null;
      const locs = await restJ(req, `locations?group_id=eq.${m.group_id}&select=user_id,lat,lng,updated_at`);
      const locBy = Object.fromEntries((Array.isArray(locs.body) ? locs.body : []).map((l)=>[
          l.user_id,
          l
        ]));
      const participants = [];
      for (const pt of m.participants ?? []){
        let eta = {
          state: "unavailable",
          label: "Sin ubicación compartida"
        };
        const l = locBy[pt.user_id];
        if (l && m.lat != null && m.lng != null && MAPBOX) {
          const route = await mbRoute([
            [
              l.lat,
              l.lng
            ],
            [
              m.lat,
              m.lng
            ]
          ], "car").catch(()=>null);
          if (route) eta = {
            state: "ok",
            eta_s: route.duration_s,
            distance_m: route.distance_m,
            traffic: route.duration_traffic_s > route.duration_s * 1.05,
            provider: "mapbox"
          };
        } else if (l && !MAPBOX) eta = {
          state: "unavailable",
          label: "Routing no configurado"
        };
        participants.push({
          user_id: pt.user_id,
          name: pt.profile?.display_name ?? "Miembro",
          color: pt.profile?.avatar_color ?? "#64748B",
          state: pt.state,
          eta
        });
      }
      return json({
        id: m.id,
        name: m.name,
        status: m.status,
        group_id: m.group_id,
        is_organizer: m.created_by === sub,
        deep_link: `sentinel://meeting/${m.id}`,
        destination: m.lat != null ? {
          name: m.place_name ?? "Destino",
          lat: m.lat,
          lng: m.lng
        } : null,
        participants,
        created_at: m.created_at
      });
    }
    const meetResp = p.match(new RegExp(`^/api/meetings/${UUID_RE}/respond$`));
    if (meetResp && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      const okStates = [
        "invitado",
        "pendiente",
        "aceptado",
        "propone_otra_hora",
        "propone_otro_lugar",
        "no_puede_acudir",
        "preparando_salida",
        "en_camino",
        "retrasado",
        "cerca",
        "llegado"
      ];
      if (!okStates.includes(b.state)) return err("BAD_REQUEST", "Estado no válido", 400);
      const r = await restJ(req, `meeting_participants?meeting_id=eq.${meetResp[1]}&user_id=eq.${sub}`, {
        method: "PATCH",
        body: JSON.stringify({
          state: b.state,
          updated_at: new Date().toISOString()
        })
      });
      if (r.status >= 400) return err("FORBIDDEN", "No se pudo actualizar tu estado", r.status);
      return json({
        ok: true,
        state: b.state
      });
    }
    const meetClose = p.match(new RegExp(`^/api/meetings/${UUID_RE}/close$`));
    if (meetClose && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const r = await restJ(req, `meetings?id=eq.${meetClose[1]}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "closed"
        })
      });
      if (r.status >= 400) return err("FORBIDDEN", "No se pudo cerrar la quedada", r.status);
      return json({
        ok: true,
        status: "closed"
      });
    }
    // ---- Convoys / trips: honestamente vacíos (funcionalidad no construida) ----
    const convList = p.match(new RegExp(`^/api/groups/${UUID_RE}/convoys$`));
    if (convList && req.method === "GET") return json([]);
    if (p === "/api/trips/pending" && req.method === "GET") return json([]);
    // ---- Mobility (Mapbox) ----
    if (p === "/api/mobility/geocode" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      if (!MAPBOX) return err("SERVICE_NOT_CONFIGURED", "Geocodificación no configurada", 503);
      const q = url.searchParams.get("q") ?? "";
      if (q.trim().length < 2) return json([]);
      const out = await mbGeocode(q.trim(), null, null, 5).catch(()=>null);
      if (!out) return err("UPSTREAM", "El servicio de geocodificación no respondió", 502);
      return json(out);
    }
    if (p === "/api/mobility/autocomplete" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      if (!MAPBOX) return err("SERVICE_NOT_CONFIGURED", "Autocompletado no configurado", 503);
      const q = url.searchParams.get("q") ?? "";
      if (q.trim().length < 2) return json([]);
      const la = url.searchParams.get("lat"), ln = url.searchParams.get("lng");
      const out = await mbGeocode(q.trim(), la ? Number(la) : null, ln ? Number(ln) : null, 6).catch(()=>null);
      if (!out) return err("UPSTREAM", "El servicio de búsqueda no respondió", 502);
      return json(out);
    }
    if (p === "/api/mobility/reverse" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      if (!MAPBOX) return err("SERVICE_NOT_CONFIGURED", "Geocodificación inversa no configurada", 503);
      const la = Number(url.searchParams.get("lat")), ln = Number(url.searchParams.get("lng"));
      if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return err("BAD_REQUEST", "Coordenadas no válidas", 400);
      const out = await mbReverse(la, ln).catch(()=>null);
      if (!out) return err("UPSTREAM", "El servicio de geocodificación inversa no respondió", 502);
      return json(out);
    }
    if (p === "/api/mobility/history" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      const r = await restJ(req, `nav_history?user_id=eq.${sub}&order=created_at.desc&limit=20&select=name,lat,lng,created_at`);
      let rows = Array.isArray(r.body) ? r.body : [];
      const la = url.searchParams.get("lat"), ln = url.searchParams.get("lng");
      if (la && ln) {
        const a = Number(la), b2 = Number(ln);
        rows = rows.map((x)=>({
            ...x,
            distance_m: Math.round(hav(a, b2, x.lat, x.lng))
          })).sort((x, y)=>x.distance_m - y.distance_m);
      }
      return json(rows.slice(0, 10));
    }
    if (p === "/api/mobility/history" && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const b = await req.json().catch(()=>({}));
      if (!b.name || typeof b.lat !== "number" || typeof b.lng !== "number") return err("BAD_REQUEST", "Faltan datos del destino", 400);
      await restJ(req, "nav_history", {
        method: "POST",
        body: JSON.stringify({
          user_id: sub,
          name: String(b.name).slice(0, 200),
          lat: b.lat,
          lng: b.lng
        })
      }, "return=minimal");
      return json({
        ok: true
      }, 201);
    }
    if (p === "/api/mobility/nav-route" && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      if (!MAPBOX) return err("SERVICE_NOT_CONFIGURED", "Navegación no configurada", 503);
      const b = await req.json().catch(()=>({}));
      const pts = Array.isArray(b.points) ? b.points.filter((x)=>Array.isArray(x) && x.length >= 2) : [];
      if (pts.length < 2) return err("BAD_REQUEST", "Se necesitan origen y destino", 400);
      const route = await mbRoute(pts.slice(0, 25), b.mode ?? "car").catch(()=>null);
      if (!route) return err("UPSTREAM", "No se pudo calcular la ruta", 502);
      return json(route);
    }
    if (p === "/api/mobility/reverse" && req.method === "GET") {
      const na = needAuth();
      if (na) return na;
      if (!MAPBOX) return err("SERVICE_NOT_CONFIGURED", "Geocodificación inversa no configurada", 503);
      const la = Number(url.searchParams.get("lat")), ln = Number(url.searchParams.get("lng"));
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return err("BAD_REQUEST", "Faltan lat/lng", 400);
      const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${ln},${la}.json?access_token=${MAPBOX}&language=es&limit=1`);
      if (!r.ok) return err("UPSTREAM", "El servicio de geocodificación no respondió", 502);
      const d = await r.json();
      const f = d.features?.[0];
      return json({
        name: f?.place_name ?? `${la.toFixed(5)}, ${ln.toFixed(5)}`,
        lat: la,
        lng: ln
      });
    }
    if (p === "/api/mobility/static.png" && req.method === "GET") {
      // público: las imágenes <Image> no envían Authorization. Solo expone teselas de mapa; el token queda en servidor.
      if (!MAPBOX) return new Response("map service not configured", {
        status: 503,
        headers: CORS
      });
      const n = (k, d)=>{
        const v = Number(url.searchParams.get(k));
        return Number.isFinite(v) ? v : d;
      };
      const lat = n("lat", 40.4168), lng = n("lng", -3.7038), zoom = Math.max(3, Math.min(19, n("zoom", 12)));
      const w = Math.max(200, Math.min(1280, n("w", 600))), h = Math.max(200, Math.min(1280, n("h", 400)));
      const dark = url.searchParams.get("dark") === "true";
      const pins = (url.searchParams.get("pins") ?? "").split(";").filter(Boolean).map((s)=>{
        const [a, o, c] = s.split(",");
        return {
          lat: Number(a),
          lng: Number(o),
          hex: /^[0-9a-fA-F]{6}$/.test(c ?? "") ? c : "E11D48"
        };
      }).filter((x)=>Number.isFinite(x.lat) && Number.isFinite(x.lng));
      const path = (url.searchParams.get("path") ?? "").split(";").filter(Boolean).map((s)=>s.split(",").map(Number)).filter((x)=>x.length === 2 && x.every(Number.isFinite));
      return await mbStatic(lat, lng, zoom, w, h, dark, pins, path.length > 1 ? path : null);
    }
    // ---- Fotos de perfil (bucket privado "avatars" + RLS de Storage) ----
    // El objeto vive en avatars/{user_id}/{uuid}.{ext}; la RLS de storage.objects
    // limita escritura a la carpeta propia y lectura a uno mismo o co-miembros de grupo
    // (shares_group_with). profiles.photo_url guarda la ruta del objeto.
    if (p === "/api/profile/photo" && req.method === "POST") {
      const na = needAuth();
      if (na) return na;
      const form = await req.formData().catch(()=>null);
      const file = form?.get("file");
      if (!file || typeof file === "string") return err("BAD_REQUEST", "Falta el archivo", 400);
      const ct = (file.type || "").toLowerCase();
      const ext = ({
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
      })[ct];
      if (!ext) return err("UNSUPPORTED", "Formato no soportado (JPEG, PNG o WebP)", 415);
      const data = new Uint8Array(await file.arrayBuffer());
      if (data.length > 6291456) return err("TOO_BIG", "La foto supera 6 MB", 413);
      const objPath = `${sub}/${crypto.randomUUID()}.${ext}`;
      const auth = req.headers.get("authorization");
      const up = await fetch(`${SUPA}/storage/v1/object/avatars/${objPath}`, {
        method: "POST",
        headers: {
          apikey: ANON,
          Authorization: auth,
          "Content-Type": ct
        },
        body: data
      });
      if (!up.ok) {
        const t = await up.text().catch(()=>"");
        return err("STORAGE", "No se pudo guardar la foto", 502, t.slice(0, 200));
      }
      const prev = await restJ(req, `profiles?id=eq.${sub}&select=photo_url`);
      const old = prev.body?.[0]?.photo_url;
      await restJ(req, `profiles?id=eq.${sub}`, {
        method: "PATCH",
        body: JSON.stringify({
          photo_url: objPath
        })
      });
      if (old && old !== objPath) await fetch(`${SUPA}/storage/v1/object/avatars/${old}`, {
        method: "DELETE",
        headers: {
          apikey: ANON,
          Authorization: auth
        }
      }).catch(()=>{});
      return json({
        ok: true,
        has_photo: true
      });
    }
    if (p === "/api/profile/photo" && req.method === "DELETE") {
      const na = needAuth();
      if (na) return na;
      const auth = req.headers.get("authorization");
      const cur = await restJ(req, `profiles?id=eq.${sub}&select=photo_url`);
      const old = cur.body?.[0]?.photo_url;
      if (old) await fetch(`${SUPA}/storage/v1/object/avatars/${old}`, {
        method: "DELETE",
        headers: {
          apikey: ANON,
          Authorization: auth
        }
      }).catch(()=>{});
      await restJ(req, `profiles?id=eq.${sub}`, {
        method: "PATCH",
        body: JSON.stringify({
          photo_url: null
        })
      });
      return json({
        ok: true,
        has_photo: false
      });
    }
    const mPhoto = p.match(/^\/api\/media\/user\/([0-9a-fA-F-]{36})\/photo$/);
    if (mPhoto && req.method === "GET") {
      // viewer: Authorization header o ?token= (las <img> de web no envían cabeceras)
      const qt = url.searchParams.get("token");
      const authz = req.headers.get("authorization") ?? (qt ? `Bearer ${qt}` : null);
      if (!authz) return err("UNAUTHORIZED", "No autenticado", 401);
      let viewer = null;
      try {
        viewer = JSON.parse(atob(authz.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))?.sub ?? null;
      } catch  {
        viewer = null;
      }
      if (!viewer) return err("UNAUTHORIZED", "Sesión no válida", 401);
      const target = mPhoto[1];
      if (viewer !== target) {
        const hdrs = {
          apikey: ANON,
          Authorization: authz,
          "Content-Type": "application/json"
        };
        const mine = await fetch(`${SUPA}/rest/v1/group_members?user_id=eq.${viewer}&status=eq.active&select=group_id`, {
          headers: hdrs
        }).then((r)=>r.json()).catch(()=>[]);
        const gids = (Array.isArray(mine) ? mine : []).map((m)=>m.group_id);
        let shared = false;
        if (gids.length) {
          const other = await fetch(`${SUPA}/rest/v1/group_members?user_id=eq.${target}&status=eq.active&group_id=in.(${gids.join(",")})&select=group_id&limit=1`, {
            headers: hdrs
          }).then((r)=>r.json()).catch(()=>[]);
          shared = Array.isArray(other) && other.length > 0;
        }
        if (!shared) return err("FORBIDDEN", "No compartes grupo con esta persona", 403);
      }
      const pr = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${target}&select=photo_url`, {
        headers: {
          apikey: ANON,
          Authorization: authz
        }
      }).then((r)=>r.json()).catch(()=>[]);
      const photoUrl = Array.isArray(pr) ? pr[0]?.photo_url : null;
      if (!photoUrl) return err("NOT_FOUND", "Sin foto", 404);
      const obj = await fetch(`${SUPA}/storage/v1/object/authenticated/avatars/${photoUrl}`, {
        headers: {
          apikey: ANON,
          Authorization: authz
        }
      });
      if (!obj.ok) return err("NOT_FOUND", "Foto no disponible", 404);
      return new Response(obj.body, {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type": obj.headers.get("Content-Type") ?? "image/jpeg",
          "Cache-Control": "private, max-age=300"
        }
      });
    }
    // ---- FMS Integration: rutas del sandbox ----
    if (p === "/api/fms/schema" && req.method === "GET") {
      return json({
        service: "fms-integration",
        note: "Esquema del evento normalizado. Autenticacion: clientes con X-API-Key, nodos fisicos con X-Device-Key.",
        event: {
          id: "bigint, asignado por la plataforma",
          device_id: "uuid del nodo registrado",
          device_label: "texto, ej. Instaflash G001",
          imei: "texto opcional",
          event_type: [
            ...FMS_EVENT_TYPES
          ],
          latitude: "number, -90..90",
          longitude: "number, -180..180",
          occurred_at: "ISO 8601 UTC del activado en el dispositivo",
          received_at: "ISO 8601 UTC de recepcion en plataforma",
          status: "open | acknowledged | resolved",
          priority: "low | normal | high | critical",
          payload: "objeto libre (opcional)"
        }
      });
    }
    if (p === "/api/fms/ingest" && req.method === "POST") {
      const fd = await fmsDevice(req);
      if (fd.error) return fd.error;
      const b = await req.json().catch(()=>({}));
      if (!FMS_EVENT_TYPES.has(b.event_type)) return err("BAD_REQUEST", "event_type no valido", 400);
      if (typeof b.latitude !== "number" || typeof b.longitude !== "number") return err("BAD_REQUEST", "Faltan latitude/longitude", 400);
      if (b.latitude < -90 || b.latitude > 90 || b.longitude < -180 || b.longitude > 180) return err("BAD_REQUEST", "Coordenadas fuera de rango", 400);
      const occurredAt = b.occurred_at && !Number.isNaN(Date.parse(b.occurred_at)) ? new Date(b.occurred_at).toISOString() : new Date().toISOString();
      const priority = [
        "low",
        "normal",
        "high",
        "critical"
      ].includes(b.priority) ? b.priority : "normal";
      const ins = await restS("fms_events", {
        method: "POST",
        body: JSON.stringify({
          device_id: fd.device.id,
          event_type: b.event_type,
          latitude: b.latitude,
          longitude: b.longitude,
          occurred_at: occurredAt,
          status: "open",
          priority,
          payload: b.payload && typeof b.payload === "object" && !Array.isArray(b.payload) ? b.payload : {}
        })
      }, "return=representation");
      const ev = Array.isArray(ins.body) ? ins.body[0] : null;
      if (!ev) return err("INTERNAL", "No se pudo registrar el evento", 500);
      const normalized = fmsNormalize(ev, fd.device);
      const deliveries = await fmsDeliver(normalized);
      return json({
        received: true,
        event: normalized,
        deliveries
      }, 201);
    }
    if (p === "/api/fms/events" && req.method === "GET") {
      const fc = await fmsClient(req);
      if (fc.error) return fc.error;
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
      const since = url.searchParams.get("since");
      let q = `fms_events?select=*&order=received_at.desc&limit=${limit}`;
      if (since && !Number.isNaN(Date.parse(since))) q += `&received_at=gte.${encodeURIComponent(new Date(since).toISOString())}`;
      const r = await restS(q, {}, "return=representation");
      const rows = Array.isArray(r.body) ? r.body : [];
      const devIds = [
        ...new Set(rows.map((e)=>e.device_id))
      ];
      const devs = devIds.length ? await restS(`fms_devices?id=in.(${devIds.join(",")})&select=id,label,imei`, {}, "return=representation") : {
        body: []
      };
      const dmap = new Map((Array.isArray(devs.body) ? devs.body : []).map((d)=>[
        d.id,
        d
      ]));
      return json({
        client: fc.client.name,
        count: rows.length,
        events: rows.map((e)=>fmsNormalize(e, dmap.get(e.device_id)))
      });
    }
    if (p === "/api/fms/webhooks" && req.method === "GET") {
      const fc = await fmsClient(req);
      if (fc.error) return fc.error;
      const r = await restS(`fms_webhooks?client_id=eq.${fc.client.id}&select=id,url,active,created_at&order=created_at.desc`, {}, "return=representation");
      return json({
        webhooks: Array.isArray(r.body) ? r.body : []
      });
    }
    if (p === "/api/fms/webhooks" && req.method === "POST") {
      const fc = await fmsClient(req);
      if (fc.error) return fc.error;
      const b = await req.json().catch(()=>({}));
      const u = String(b.url ?? "").trim();
      if (!u.startsWith("https://")) return err("BAD_REQUEST", "La URL del webhook debe ser https://", 400);
      const secret = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      const ins = await restS("fms_webhooks", {
        method: "POST",
        body: JSON.stringify({
          client_id: fc.client.id,
          url: u,
          secret
        })
      }, "return=representation");
      const w = Array.isArray(ins.body) ? ins.body[0] : null;
      if (!w) return err("INTERNAL", "No se pudo crear el webhook", 500);
      return json({
        id: w.id,
        url: w.url,
        secret,
        note: "Guarda este secret ahora: no se volvera a mostrar. Firma: X-FMS-Signature: sha256=<HMAC-SHA256 del cuerpo con el secret>."
      }, 201);
    }
    const whDel = p.match(/^\/api\/fms\/webhooks\/([0-9a-fA-F-]{36})$/);
    if (whDel && req.method === "DELETE") {
      const fc = await fmsClient(req);
      if (fc.error) return fc.error;
      await restS(`fms_webhooks?id=eq.${whDel[1]}&client_id=eq.${fc.client.id}`, {
        method: "DELETE"
      });
      return json({
        ok: true
      });
    }
    // ---- Documentos legales (publicos: se leen tambien en onboarding, antes de tener cuenta) ----
    if (p.startsWith("/api/legal/documents/") && req.method === "GET") {
      const key = p.split("/").pop() ?? "";
      const doc = LEGAL_DOCS[key];
      if (!doc) return err("NOT_FOUND", "Documento no encontrado", 404);
      return json(doc);
    }
    return json({
      detail: {
        code: "SERVICE_NOT_CONFIGURED",
        title: "Ruta no disponible",
        reason: p
      }
    }, 503);
  } catch (e) {
    return json({
      detail: {
        code: "INTERNAL",
        title: "Error interno",
        reason: String(e)
      }
    }, 500);
  }
});
