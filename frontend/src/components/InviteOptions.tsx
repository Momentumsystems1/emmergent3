// Group invitations through real OS capabilities:
//  - Multi-use group link → WhatsApp (wa.me) or any app (WeChat, Telegram…) via the system share sheet. Everyone who taps joins.
//  - Device contacts picker (expo-contacts, contextual permission) → one invitation per contact, WhatsApp opened with their number.
// WhatsApp/WeChat expose no API to read contacts or group members; we never pretend otherwise.
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Contacts from "expo-contacts";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, Share, TextInput, View } from "react-native";

import { api, unavailableOf } from "@/src/api";
import { appOrigin, copyText } from "@/src/clipboard";
import { Sheet } from "@/src/components/sheets";
import { Button, showUnavailable, T, toast } from "@/src/components/ui";
import { Invitation, inviteText } from "@/src/invites";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Contact = { id: string; name: string; phone: string };
const digits = (p: string) => p.replace(/[^\d+]/g, "").replace(/^\+/, "");
// Nombre de la invitación genérica para compartir por cualquier canal (se reutiliza mientras siga abierta).
const GENERIC = "Invitado";

export function InviteOptions({ groupId, groupName, invitations, onChanged }: { groupId: string; groupName: string; invitations?: any[]; onChanged?: () => void }) {
  const s = useStyles(); const { colors } = useTheme();
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  // Enlace compartible: reutiliza la invitación genérica abierta o crea una con el endpoint real del backend.
  const link = async (): Promise<Invitation> => {
    const reuse = (invitations ?? []).find((i) => i.invitee_name === GENERIC && (i.status === "prepared" || i.status === "dispatched") && (!i.expires_at || new Date(i.expires_at).getTime() > Date.now()));
    if (reuse) return { id: reuse.token, name: GENERIC, channel: "link", status: reuse.status, multi: true, link: `${appOrigin()}/invite/${reuse.token}`, group_name: groupName, membership: reuse.membership ?? "fixed" };
    const r = await api<{ invitation: Invitation }>(`/groups/${groupId}/invitations`, { method: "POST", json: { name: GENERIC, membership: "fixed", channel: "link" } });
    onChanged?.();
    return { ...r.invitation, group_name: groupName };
  };
  const msgOf = (inv: Invitation) => `Únete a mi grupo "${groupName}" en MY CLUSTER. Toca el enlace para entrar: ${inv.link}`;
  const viaWhatsApp = async () => {
    setBusy("wa");
    try { const inv = await link(); setShown(inv.link); await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msgOf(inv))}`); toast("Elige un chat o un grupo de WhatsApp; el enlace también lo tienes aquí para copiarlo"); }
    catch (e: any) { toast(e.message ?? "No se pudo abrir WhatsApp", "error"); } finally { setBusy(null); }
  };
  const viaShare = async () => {
    setBusy("share");
    try { const inv = await link(); setShown(inv.link); const text = msgOf(inv); if (Platform.OS === "web") { await Linking.openURL(`mailto:?body=${encodeURIComponent(text)}`); } else { await Share.share({ message: text }); } }
    catch (e: any) { toast(e.message ?? "No se pudo compartir", "error"); } finally { setBusy(null); }
  };
  const viaCopy = async () => {
    setBusy("copy");
    try { const inv = await link(); setShown(inv.link); const ok = await copyText(inv.link); toast(ok ? "Enlace copiado" : "No se pudo copiar; mantén pulsado el enlace para seleccionarlo", ok ? "success" : "error"); }
    catch (e: any) { toast(e.message ?? "No se pudo crear el enlace", "error"); } finally { setBusy(null); }
  };
  return (
    <View style={{ gap: spacing.sm }} testID="invite-options">
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable testID="invite-link-whatsapp" onPress={viaWhatsApp} disabled={!!busy} style={[s.opt, { flex: 1 }]}><Ionicons name="logo-whatsapp" size={18} color={colors.success} /><T weight="semibold" style={{ fontSize: 13 }}>Enlace por WhatsApp</T></Pressable>
        <Pressable testID="invite-link-share" onPress={viaShare} disabled={!!busy} style={[s.opt, { flex: 1 }]}><Ionicons name="share-social" size={18} color={colors.brandSecondary} /><T weight="semibold" style={{ fontSize: 13 }}>WeChat y otras</T></Pressable>
      </View>
      <Pressable testID="invite-link-copy" onPress={viaCopy} disabled={!!busy} style={s.opt}><Ionicons name="copy" size={18} color={colors.brandPrimary} /><T weight="semibold" style={{ fontSize: 13 }}>Copiar enlace de invitación</T><T style={{ fontSize: 11, color: colors.muted, flex: 1, textAlign: "right" }}>para pegarlo donde quieras</T></Pressable>
      {shown ? (
        <View style={s.linkBox} testID="invite-shown-box">
          <Ionicons name="link" size={16} color={colors.brandPrimary} />
          <T testID="invite-shown-link" selectable style={{ fontSize: 12.5, flex: 1, color: colors.brandPrimary }}>{shown}</T>
        </View>
      ) : null}
      <Pressable testID="invite-from-contacts" onPress={() => setPicker(true)} style={s.opt}><Ionicons name="people-circle" size={18} color={colors.brandPrimary} /><T weight="semibold" style={{ fontSize: 13 }}>Elegir de mis contactos</T><T style={{ fontSize: 11, color: colors.muted, flex: 1, textAlign: "right" }}>varios a la vez</T></Pressable>
      <T style={{ fontSize: 11, color: colors.muted }}>Quien reciba el enlace podrá unirse al grupo desde el navegador. Si un enlace deja de funcionar, vuelve a esta pantalla y genera otro.</T>
      <ContactsPicker visible={picker} onClose={() => { setPicker(false); onChanged?.(); }} groupId={groupId} groupName={groupName} />
    </View>
  );
}

function ContactsPicker({ visible, onClose, groupId, groupName }: { visible: boolean; onClose: () => void; groupId: string; groupName: string }) {
  const s = useStyles(); const { colors } = useTheme();
  const [perm, setPerm] = useState<"unknown" | "granted" | "denied" | "blocked" | "unsupported">(Platform.OS === "web" ? "unsupported" : "unknown");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<string, Contact>>({});
  const [created, setCreated] = useState<(Invitation & { phone: string; sent: boolean })[]>([]);
  const [creating, setCreating] = useState(false);
  const queue = useRef<string[]>([]); const lastOpen = useRef(0);

  useEffect(() => {
    if (!visible || Platform.OS === "web") return;
    Contacts.getPermissionsAsync().then((p) => setPerm(p.granted ? "granted" : p.status === "undetermined" ? "unknown" : p.canAskAgain ? "denied" : "blocked")).catch(() => setPerm("unsupported"));
  }, [visible]);
  useEffect(() => {
    if (perm !== "granted" || !visible) return;
    Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName }).then((r) => {
      setContacts(r.data.filter((c) => c.name && c.phoneNumbers?.length).map((c) => ({ id: c.id ?? c.name!, name: c.name!, phone: c.phoneNumbers![0].number ?? "" })));
    }).catch((e) => toast(e.message ?? "No se pudieron leer los contactos", "error"));
  }, [perm, visible]);
  const request = async () => { const p = await Contacts.requestPermissionsAsync(); setPerm(p.granted ? "granted" : p.canAskAgain ? "denied" : "blocked"); };

  // Sequential WhatsApp dispatch: open one chat, continue with the next when the user comes back to MY CLUSTER.
  const openFor = async (inv: Invitation & { phone: string }) => {
    lastOpen.current = Date.now();
    await Linking.openURL(`https://wa.me/${digits(inv.phone)}?text=${encodeURIComponent(inviteText(inv))}`);
    await api(`/invitations/${inv.id}/dispatched`, { method: "POST" }).catch(() => null);
    setCreated((p) => p.map((x) => (x.id === inv.id ? { ...x, sent: true } : x)));
  };
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active" || !queue.current.length || Date.now() - lastOpen.current < 1500) return;
      const next = created.find((c) => c.id === queue.current[0]); queue.current.shift();
      if (next) openFor(next).catch(() => toast("No se pudo abrir WhatsApp", "error"));
    });
    return () => sub.remove();
  }, [created]);
  const sendAll = async () => {
    const pending = created.filter((c) => !c.sent);
    if (!pending.length) return;
    queue.current = pending.slice(1).map((c) => c.id);
    try { await openFor(pending[0]); } catch { toast("No se pudo abrir WhatsApp", "error"); }
  };

  const createInvites = async () => {
    setCreating(true);
    const out: (Invitation & { phone: string; sent: boolean })[] = [];
    for (const c of Object.values(sel)) {
      try {
        const r = await api<{ invitation: Invitation }>(`/groups/${groupId}/invitations`, { method: "POST", json: { name: c.name, membership: "fixed", channel: "whatsapp", phone: c.phone } });
        out.push({ ...r.invitation, name: c.name, group_name: groupName, phone: c.phone, sent: false });
      } catch (e: any) { const u = unavailableOf(e); if (u) { showUnavailable(u); break; } toast(`${c.name}: ${e.message}`, "error"); }
    }
    setCreated(out); setSel({}); setCreating(false);
  };
  const list = useMemo(() => contacts.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 60), [contacts, q]);
  const nSel = Object.keys(sel).length;
  const reset = () => { setCreated([]); setSel({}); setQ(""); queue.current = []; onClose(); };

  return (
    <Sheet visible={visible} onClose={reset} testID="contacts-picker">
      <T weight="bold" style={{ fontSize: 20 }}>Invitar desde contactos</T>
      {perm === "unsupported" ? <T style={{ color: colors.muted, marginTop: spacing.sm }}>La agenda del dispositivo solo está disponible en la app móvil.</T> : null}
      {perm === "unknown" || perm === "denied" ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <T style={{ color: colors.muted, fontSize: 13 }}>MY CLUSTER leerá tu agenda solo para que elijas a quién invitar. No se sube ni se guarda ningún contacto.</T>
          <Button small testID="contacts-permission" title={perm === "denied" ? "Volver a intentar" : "Permitir acceso a contactos"} onPress={request} />
        </View>
      ) : null}
      {perm === "blocked" ? (<View style={{ marginTop: spacing.sm, gap: spacing.sm }}><T style={{ color: colors.muted, fontSize: 13 }}>El acceso a contactos está bloqueado. Puedes activarlo en los ajustes del sistema.</T><Button small testID="contacts-open-settings" title="Abrir ajustes" onPress={() => Linking.openSettings().catch(() => null)} /></View>) : null}
      {perm === "granted" && created.length === 0 ? (
        <>
          <TextInput testID="contacts-search" style={s.input} placeholder="Buscar contacto" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} />
          <View style={{ maxHeight: 320 }}>
            {list.map((c) => { const on = !!sel[c.id]; return (
              <Pressable key={c.id} testID={`contact-${c.id}`} onPress={() => setSel((p) => { const n = { ...p }; if (n[c.id]) delete n[c.id]; else n[c.id] = c; return n; })} style={s.row}>
                <View style={[s.check, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>{on ? <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /> : null}</View>
                <View style={{ flex: 1 }}><T weight="semibold" style={{ fontSize: 14 }} numberOfLines={1}>{c.name}</T><T style={{ fontSize: 11, color: colors.muted }}>{c.phone}</T></View>
              </Pressable>); })}
            {contacts.length === 0 ? <T style={{ color: colors.muted, fontSize: 13, marginTop: spacing.sm }}>Cargando agenda…</T> : null}
          </View>
          <View style={{ marginTop: spacing.md }}><Button testID="contacts-create" title={nSel ? `Preparar ${nSel} ${nSel === 1 ? "invitación" : "invitaciones"}` : "Selecciona contactos"} disabled={!nSel} loading={creating} onPress={createInvites} /></View>
        </>
      ) : null}
      {created.length ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <T style={{ color: colors.muted, fontSize: 13 }}>Invitaciones preparadas. Se abre WhatsApp con cada número; al volver a MY CLUSTER continúa con el siguiente.</T>
          {created.map((c) => (
            <Pressable key={c.id} testID={`created-${c.id}`} onPress={() => openFor(c).catch(() => toast("No se pudo abrir WhatsApp", "error"))} style={s.row}>
              <Ionicons name={c.sent ? "checkmark-circle" : "logo-whatsapp"} size={20} color={c.sent ? colors.success : colors.muted} />
              <View style={{ flex: 1 }}><T weight="semibold" style={{ fontSize: 14 }}>{c.name}</T><T style={{ fontSize: 11, color: colors.muted }}>{c.sent ? "Abierto en WhatsApp" : "Pendiente de enviar · toca para abrir"}</T></View>
            </Pressable>
          ))}
          <Button testID="contacts-send-all" title="Enviar a todos por WhatsApp" icon="paper-plane" onPress={sendAll} disabled={!created.some((c) => !c.sent)} />
          <Button testID="contacts-done" title="Listo" variant="ghost" onPress={reset} />
        </View>
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  opt: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  input: { height: 48, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface, marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.divider },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  linkBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
}));
