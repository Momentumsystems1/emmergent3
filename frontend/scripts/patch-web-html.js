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
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />\n' +
    '    <meta name="description" content="My Cluster — movilidad, coordinación y seguridad para los tuyos. Tu privacidad, siempre en tus manos." />\n' +
    '    <meta name="theme-color" content="#060B16" />\n' +
    '    <meta name="color-scheme" content="light dark" />'
);

const shell = `
    <style id="mycluster-shell">
      html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
      body {
        background-color: #04070F;
        background-image:
          radial-gradient(60vw 60vh at 12% -10%, rgba(31,200,236,0.10), transparent 60%),
          radial-gradient(50vw 50vh at 95% 110%, rgba(167,139,250,0.08), transparent 60%);
        background-attachment: fixed;
      }
      ::selection { background: rgba(31,200,236,0.35); }
      * { scrollbar-width: thin; scrollbar-color: rgba(136,150,174,0.4) transparent; }
      *::-webkit-scrollbar { width: 8px; height: 8px; }
      *::-webkit-scrollbar-thumb { background: rgba(136,150,174,0.35); border-radius: 4px; }
      *::-webkit-scrollbar-track { background: transparent; }
      input, textarea { outline: none; }
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
if (!h.includes('id="mycluster-shell"')) h = h.replace("</head>", shell + "</head>");
fs.writeFileSync(file, h);
console.log("patched", file);
