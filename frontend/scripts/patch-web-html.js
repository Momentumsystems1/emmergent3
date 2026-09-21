#!/usr/bin/env node
// Post-export patch for `expo export --platform web` with output:"single".
// SPA mode ignores app/+html.tsx, so we inject the document shell directly into dist/index.html:
// lang/description/theme-color + Sentinel web shell (centered 440px column on wide screens).
// Usage: node scripts/patch-web-html.js [distDir]
const fs = require("fs");
const path = require("path");

const dist = process.argv[2] || path.join(__dirname, "..", "dist");
const file = path.join(dist, "index.html");
let h = fs.readFileSync(file, "utf8");

h = h.replace('<html lang="en">', '<html lang="es">');
h = h.replace(
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
  // maximum-scale/user-scalable=no: evita zoom accidental de doble toque; la app se siente nativa.
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover" />\n' +
    '    <meta name="description" content="MY CLUSTER — tu gente localizada y protegida en tiempo real. Ubicación en vivo, alertas y rutas compartidas. Privado y sin anuncios." />\n' +
    '    <meta name="theme-color" content="#D93025" />\n' +
    '    <meta name="color-scheme" content="light dark" />\n' +
    // PWA: "Añadir a pantalla de inicio" abre standalone, sin cromo de navegador.
    '    <link rel="manifest" href="/manifest.json" />\n' +
    '    <meta name="mobile-web-app-capable" content="yes" />\n' +
    '    <meta name="apple-mobile-web-app-capable" content="yes" />\n' +
    '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n' +
    '    <meta name="apple-mobile-web-app-title" content="MY CLUSTER" />\n' +
    '    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />'
);

const shell = `
    <style id="sentinel-shell">
      html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
      body {
        background-color: #EDEFF2;
        background-image:
          radial-gradient(60vw 60vh at 12% -10%, rgba(234,67,53,0.08), transparent 60%),
          radial-gradient(50vw 50vh at 95% 110%, rgba(95,99,104,0.10), transparent 60%);
        background-attachment: fixed;
      }
      ::selection { background: rgba(234,67,53,0.28); }
      * { scrollbar-width: thin; scrollbar-color: rgba(136,150,174,0.4) transparent; }
      *::-webkit-scrollbar { width: 8px; height: 8px; }
      *::-webkit-scrollbar-thumb { background: rgba(136,150,174,0.35); border-radius: 4px; }
      *::-webkit-scrollbar-track { background: transparent; }
      input, textarea { outline: none; }
      /* Sensación nativa: sin flash gris al tocar, sin rebote de goma, sin zoom de doble toque,
         sin selección de texto accidental en la UI (los inputs sí seleccionan). */
      * { -webkit-tap-highlight-color: transparent; }
      html, body { overscroll-behavior: none; touch-action: manipulation; }
      body { user-select: none; -webkit-user-select: none; }
      input, textarea, [contenteditable] { user-select: text; -webkit-user-select: text; }
      [data-testid="welcome-screen"] { width: 100% !important; height: 100% !important; }
      @media (min-width: 560px) {
        body > div {
          position: fixed !important;
          top: 0 !important; bottom: 0 !important;
          left: 50% !important; right: auto !important;
          transform: translateX(-50%) !important;
          width: 100% !important; max-width: 440px !important;
          border-left: 1px solid rgba(148,170,205,0.16);
          border-right: 1px solid rgba(148,170,205,0.16);
          box-shadow: 0 0 90px rgba(2,6,14,0.85);
        }
      }
    </style>
`;
if (!h.includes('id="sentinel-shell"')) h = h.replace("</head>", shell + "</head>");
// Fuentes estáticas: sin este bloque, @font-face depende de que expo-font inyecte las reglas en
// runtime y apunte a /assets/node_modules/... — rutas que algunos hosts/CDN no sirven y que dejan
// la app SIN ICONOS (Ionicons) y con tipografía de sistema. Copiamos los .ttf a /fonts/ (ruta
// estable y corta) e inyectamos @font-face estático con las mismas familias que registra la app
// (ver app/_layout.tsx y @react-native-vector-icons/ionicons).
const fontsDir = path.join(dist, "fonts");
fs.mkdirSync(fontsDir, { recursive: true });
const fontSources = [
  ["Jakarta", path.join(__dirname, "..", "assets", "fonts", "PlusJakartaSans-Regular.ttf")],
  ["JakartaMedium", path.join(__dirname, "..", "assets", "fonts", "PlusJakartaSans-Medium.ttf")],
  ["JakartaSemi", path.join(__dirname, "..", "assets", "fonts", "PlusJakartaSans-SemiBold.ttf")],
  ["JakartaBold", path.join(__dirname, "..", "assets", "fonts", "PlusJakartaSans-Bold.ttf")],
  ["SpaceMono", path.join(__dirname, "..", "assets", "fonts", "SpaceMono-Regular.ttf")],
  ["Ionicons", path.join(__dirname, "..", "node_modules", "@react-native-vector-icons", "ionicons", "fonts", "Ionicons.ttf")],
];
const faceCss = fontSources
  .map(([family, src]) => {
    const out = `${family}.ttf`;
    fs.copyFileSync(src, path.join(fontsDir, out));
    // Ionicons: block (nunca glifos de texto como fallback). Texto: swap (nunca texto invisible).
    const display = family === "Ionicons" ? "block" : "swap";
    return `@font-face { font-family: "${family}"; src: url("/fonts/${out}") format("truetype"); font-weight: normal; font-style: normal; font-display: ${display}; }`;
  })
  .join("\n        ");
const faceTag = `    <style id="sentinel-fonts">\n        ${faceCss}\n    </style>\n`;
if (!h.includes('id="sentinel-fonts"')) h = h.replace("</head>", faceTag + "</head>");
fs.writeFileSync(file, h);
console.log("patched", file, "+ fuentes", fontsDir);

// SPA fallback: static hosts that honor a project 404.html (GitHub Pages / Netlify / kimi.page-style)
// will serve the app shell for unknown subroutes instead of a hard 404; expo-router then routes client-side.
fs.writeFileSync(path.join(dist, "404.html"), h);
console.log("patched", path.join(dist, "404.html"));

// PWA: manifest + iconos (casco sobre rojo marca). "Añadir a pantalla de inicio" → standalone sin cromo.
const manifest = {
  name: "MY CLUSTER",
  short_name: "MY CLUSTER",
  description: "Tu gente localizada y protegida en tiempo real. Privado y sin anuncios.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#FFFFFF",
  theme_color: "#D93025",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
fs.writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));
const pwaDir = path.join(__dirname, "..", "assets", "images", "pwa");
for (const f of ["apple-touch-icon.png", "icon-192.png", "icon-512.png"]) {
  fs.copyFileSync(path.join(pwaDir, f), path.join(dist, f));
}
console.log("patched", path.join(dist, "manifest.json"), "+ iconos PWA");
