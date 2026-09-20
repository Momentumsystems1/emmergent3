// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Web document shell. On wide screens the app renders as a centered phone-width column
// over a quiet branded backdrop; on phones it is full-bleed.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>MY CLUSTER</title>
        <meta name="description" content="MY CLUSTER — tu gente localizada y protegida en tiempo real. Ubicación en vivo, alertas y rutas compartidas. Privado y sin anuncios." />
        <meta name="theme-color" content="#D93025" />
        <meta name="color-scheme" content="light dark" />
        <meta property="og:title" content="MY CLUSTER" />
        <meta property="og:description" content="Movilidad, coordinación y seguridad para los tuyos." />
        <meta property="og:type" content="website" />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
              body {
                background-color: #EDEFF2;
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
              @media (min-width: 560px) {
                body > div {
                  position: fixed !important; top: 0 !important; bottom: 0 !important;
                  left: 50% !important; right: auto !important;
                  transform: translateX(-50%) !important;
                  width: 100% !important; max-width: 440px !important;
                  border-left: 1px solid rgba(148,170,205,0.16);
                  border-right: 1px solid rgba(148,170,205,0.16);
                  box-shadow: 0 0 90px rgba(2,6,14,0.85);
                }
              }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
              input, textarea { outline: none; }
      [data-testid="welcome-screen"] { width: 100% !important; height: 100% !important; }
              input:focus-visible, textarea:focus-visible { outline: none; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
