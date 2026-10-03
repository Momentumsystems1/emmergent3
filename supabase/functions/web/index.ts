// web: alojamiento estático de la app (SPA) servido desde el bucket público "web".
// - GET/HEAD únicamente.
// - "/" y rutas sin extensión → index.html (fallback SPA).
// - Content-Type por extensión (Storage no lo garantiza) y CSP propia.
// Nota: Storage devuelve 400 (no 404) cuando el objeto no existe.

const SUPA = Deno.env.get("SUPABASE_URL") ?? "";
const BUCKET = "web";

const CT: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon", ".svg": "image/svg+xml",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".webp": "image/webp", ".map": "application/json", ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function ext(p: string): string {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i).toLowerCase() : "";
}

async function fetchObj(path: string): Promise<{ ok: boolean; body: Uint8Array | null }> {
  const url = `${SUPA}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const r = await fetch(url);
  if (!r.ok) { r.body?.cancel(); return { ok: false, body: null }; }
  // buffer completo: evita que el runtime propague cabeceras upstream del stream
  const buf = new Uint8Array(await r.arrayBuffer());
  return { ok: true, body: buf };
}

function respond(path: string, body: Uint8Array | null, head: boolean): Response {
  const immutable = path.startsWith("_expo/") || path.startsWith("assets/");
  const h = new Headers();
  h.set("Content-Type", CT[ext(path)] ?? "application/octet-stream");
  if (ext(path) === ".html") h.set("Content-Type", "Text/HTML; charset=utf-8");
  h.set("Cache-Control", path === "index.html" ? "no-cache" : immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600");
  h.set("Content-Security-Policy", "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https: wss:");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Web-Version", "3");
  return new Response(head ? null : body, { status: 200, headers: h });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const i = segs.indexOf("web");
  let rel = i >= 0 ? segs.slice(i + 1).join("/") : segs.join("/");
  if (rel.includes("..")) return new Response("Bad Request", { status: 400 });
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const head = req.method === "HEAD";
  let obj = await fetchObj(rel);
  if (!obj.ok && ext(rel) === "") { rel = "index.html"; obj = await fetchObj(rel); } // fallback SPA
  if (!obj.ok) return new Response("Not Found", { status: 404 });
  return respond(rel, obj.body, head);
});
