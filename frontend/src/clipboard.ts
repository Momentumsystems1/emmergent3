// Copiar al portapapeles con las capacidades reales del sistema:
// web → navigator.clipboard (contexto seguro) con fallback textarea+execCommand;
// nativo → hoja de compartir del sistema (incluye "Copiar").
import { Platform, Share } from "react-native";

export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* sigue con el fallback */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}

/** Origen público de la app web: los enlaces de invitación se abren en el navegador. */
export function appOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "https://momentumsystems1.github.io";
}
