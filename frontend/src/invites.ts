// Legitimate invitation dispatch through OS capabilities. We only ever report what the OS confirmed.
import * as SMS from "expo-sms";
import { Linking, Platform } from "react-native";

import { api } from "@/src/api";

export type Invitation = { id: string; name: string; channel: "whatsapp" | "sms" | "link"; status: string; phone?: string | null; multi?: boolean; code?: string; link: string; group_name: string; membership: string; created_at?: string; dispatched_at?: string | null };

export function inviteText(inv: Invitation) {
  const code = inv.code ? `\n\nSi el enlace no abre la app, entra en Sentinel → “Me han invitado” y escribe el código: ${inv.code}` : "";
  return `Hola ${inv.name}, te invito a mi grupo "${inv.group_name}" en Sentinel Family. Abre este enlace para aceptar: ${inv.link}${code}`;
}

/** Returns a truthful state label. Never "Mensaje enviado" unless the OS reported it. */
export async function dispatchInvitation(inv: Invitation): Promise<{ ok: boolean; label: string }> {
  const text = inviteText(inv);
  try {
    if (inv.channel === "whatsapp") {
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      const can = Platform.OS === "web" ? true : await Linking.canOpenURL(url).catch(() => true);
      if (!can) return { ok: false, label: "WhatsApp no disponible en este dispositivo" };
      await Linking.openURL(url);
      await api(`/invitations/${inv.id}/dispatched`, { method: "POST" });
      return { ok: true, label: "Invitación preparada en WhatsApp" };
    }
    if (Platform.OS !== "web" && (await SMS.isAvailableAsync())) {
      const r = await SMS.sendSMSAsync([], text);
      if (r.result === "sent") {
        await api(`/invitations/${inv.id}/dispatched`, { method: "POST" });
        return { ok: true, label: "SMS enviado (confirmado por el sistema)" };
      }
      if (r.result === "cancelled") return { ok: false, label: "Envío de SMS cancelado" };
      await api(`/invitations/${inv.id}/dispatched`, { method: "POST" });
      return { ok: true, label: "Invitación preparada (estado de entrega desconocido)" };
    }
    await Linking.openURL(`sms:?&body=${encodeURIComponent(text)}`);
    await api(`/invitations/${inv.id}/dispatched`, { method: "POST" });
    return { ok: true, label: "Invitación preparada" };
  } catch {
    return { ok: false, label: "No se pudo abrir el canal de invitación" };
  }
}
