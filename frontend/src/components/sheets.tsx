// Bottom sheet flows shared by group creation and group detail: add member, pending member detail.
import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { copyText } from "@/src/clipboard";
import { Button, Pill, T, toast } from "@/src/components/ui";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function Sheet({ visible, onClose, children, testID }: { visible: boolean; onClose: () => void; children: React.ReactNode; testID: string }) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={s.backdrop} onPress={onClose} testID={`${testID}-backdrop`} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID={testID}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type NewInvite = { name: string; membership: "fixed" | "temporary"; channel: "whatsapp" | "sms"; duration_hours?: number };

export function AddMemberSheet({ visible, onClose, onSubmit, loading }: { visible: boolean; onClose: () => void; onSubmit: (v: NewInvite) => void; loading: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [membership, setMembership] = useState<"fixed" | "temporary">("fixed");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [hours, setHours] = useState(24);
  const reset = () => { setName(""); setMembership("fixed"); setChannel("whatsapp"); setHours(24); };
  return (
    <Sheet visible={visible} onClose={onClose} testID="add-member-sheet">
      <T weight="bold" style={{ fontSize: 20 }}>Añadir persona</T>
      <TextInput testID="add-member-name-input" style={s.input} placeholder="Nombre" placeholderTextColor={colors.muted} value={name} onChangeText={setName} autoFocus />
      <T weight="semibold" style={{ marginTop: spacing.lg }}>¿Cómo participará esta persona?</T>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
        <Option testID="membership-fixed" active={membership === "fixed"} onPress={() => setMembership("fixed")} title="Miembro fijo" sub="Sin expiración automática" icon="infinite" />
        <Option testID="membership-temporary" active={membership === "temporary"} onPress={() => setMembership("temporary")} title="Invitado temporal" sub="Con expiración" icon="timer" />
      </View>
      {membership === "temporary" ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          {[4, 24, 72, 168].map((h) => (
            <Pressable key={h} testID={`duration-${h}`} onPress={() => setHours(h)} style={[s.chip, hours === h && s.chipOn]}>
              <T weight="semibold" style={{ fontSize: 13, color: hours === h ? colors.onBrandPrimary : colors.onSurface }}>{h < 24 ? `${h} h` : `${h / 24} d`}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      <T weight="semibold" style={{ marginTop: spacing.lg }}>Canal de invitación</T>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
        <Option testID="channel-whatsapp" active={channel === "whatsapp"} onPress={() => setChannel("whatsapp")} title="WhatsApp" sub="Podrás copiar el enlace o abrir WhatsApp" icon="logo-whatsapp" />
        <Option testID="channel-sms" active={channel === "sms"} onPress={() => setChannel("sms")} title="SMS" sub="Podrás copiar el enlace o abrir Mensajes" icon="chatbox" />
      </View>
      <T style={{ color: colors.muted, fontSize: 12, marginTop: spacing.md }}>MY CLUSTER no puede confirmar la entrega del mensaje: mostrará “Invitación preparada” hasta que la persona acepte.</T>
      <View style={{ marginTop: spacing.lg }}>
        <Button testID="add-member-submit" title="Crear invitación" loading={loading} disabled={name.trim().length < 1}
          onPress={() => { onSubmit({ name: name.trim(), membership, channel, duration_hours: membership === "temporary" ? hours : undefined }); reset(); }} />
      </View>
    </Sheet>
  );
}

function Option({ active, onPress, title, sub, icon, testID }: { active: boolean; onPress: () => void; title: string; sub: string; icon: string; testID: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.option, active && s.optionOn]}>
      <Ionicons name={icon as any} size={20} color={active ? colors.brandPrimary : colors.muted} />
      <T weight="semibold" style={{ fontSize: 14, marginTop: 6 }}>{title}</T>
      <T style={{ fontSize: 11, color: colors.muted }}>{sub}</T>
    </Pressable>
  );
}

export type MemberInfo = { id: string; display_name: string; status: string; membership: string; role: string; expires_at?: string | null; location_state?: string; user_id?: string | null; color?: string;
  invitation?: { id: string; status: string; channel: string; created_at: string; dispatched_at?: string | null } };

// Resultado de crear una invitación: el enlace queda visible y copiable (esa era la queja: se veía solo dentro de WhatsApp).
export function InviteCreatedSheet({ name, link, message, channel, onClose, onOpenChannel }: { name: string; link: string; message: string; channel: string; onClose: () => void; onOpenChannel: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    toast(ok ? `${label} copiado` : "No se pudo copiar; mantén pulsado el enlace para seleccionarlo", ok ? "success" : "error");
  };
  return (
    <Sheet visible onClose={onClose} testID="invite-created-sheet">
      <T weight="bold" style={{ fontSize: 20 }}>Invitación lista para {name}</T>
      <T style={{ color: colors.muted, fontSize: 13, marginTop: spacing.xs }}>Este es el enlace de la invitación: cópialo y pégalo donde quieras, o abre el canal directamente.</T>
      <View style={s.linkBox}>
        <Ionicons name="link" size={16} color={colors.brandPrimary} />
        <T testID="invite-created-link" selectable style={{ fontSize: 13, flex: 1, color: colors.brandPrimary }}>{link}</T>
      </View>
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button testID="invite-copy-link" title="Copiar enlace" icon="copy" onPress={() => copy(link, "Enlace")} />
        <Button testID="invite-copy-message" title="Copiar mensaje completo" icon="chatbox" variant="secondary" onPress={() => copy(message, "Mensaje")} />
        <Button testID="invite-open-channel" title={channel === "sms" ? "Abrir Mensajes" : "Abrir WhatsApp"} icon={channel === "sms" ? "chatbox" : "logo-whatsapp"} variant="secondary" onPress={onOpenChannel} />
        <Button testID="invite-created-done" title="Listo" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}

export function MemberSheet({ member, onClose, onResend, onCancel, onRemove, onChangeRole, canManage, changingRole }: { member: MemberInfo | null; onClose: () => void; onResend?: () => void; onCancel?: () => void; onRemove?: () => void; onChangeRole?: (role: string) => void; canManage: boolean; changingRole?: boolean }) {
  const { colors } = useTheme();
  if (!member) return null;
  const pending = member.status === "pending";
  const inv = member.invitation;
  const STATUS_LABEL: Record<string, string> = { open: "Enlace activo", accepted: "Aceptada", cancelled: "Cancelada", removed: "Eliminado" };
  const statusLabel = pending ? "A la espera de confirmación" : member.status === "active" ? "Miembro activo" : member.status === "declined" ? "Invitación rechazada" : member.status === "expired" ? "Invitación temporal expirada" : (STATUS_LABEL[member.status] ?? member.status);
  const statusTone = pending ? "muted" : member.status === "active" ? "cyan" : member.status === "open" ? "amber" : "red";
  const locLabel = { shared: "Ubicación compartida", not_shared: "Ubicación no compartida", permission_pending: "Ubicación: permiso pendiente", pending_invitation: "Invitación pendiente" }[member.location_state ?? ""] ?? "";
  const canEditRole = canManage && !!onChangeRole && member.role !== "owner";
  return (
    <Sheet visible={!!member} onClose={onClose} testID="member-sheet">
      <T weight="bold" style={{ fontSize: 20 }}>{member.display_name}</T>
      <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm, flexWrap: "wrap" }}>
        <Pill testID="member-status-pill" label={statusLabel} tone={statusTone} />
        <Pill label={member.membership === "temporary" ? "Invitado temporal" : "Miembro fijo"} tone={member.membership === "temporary" ? "amber" : "blue"} />
        {locLabel ? <Pill testID="member-location-pill" label={locLabel} tone={member.location_state === "shared" ? "green" : "muted"} /> : null}
      </View>
      {inv ? (
        <View style={{ marginTop: spacing.lg, gap: 4 }}>
          <T style={{ color: colors.muted, fontSize: 13 }}>Canal: {inv.channel === "whatsapp" ? "WhatsApp" : "SMS"}</T>
          <T style={{ color: colors.muted, fontSize: 13 }}>Creada: {new Date(inv.created_at).toLocaleString("es-ES")}</T>
          <T style={{ color: colors.muted, fontSize: 13 }}>Estado de envío: {inv.status === "prepared" ? "Invitación preparada (sin lanzar)" : inv.status === "dispatched" ? "Invitación lanzada · entrega no confirmable" : inv.status}</T>
          {member.expires_at ? <T style={{ color: colors.muted, fontSize: 13 }}>Expira: {new Date(member.expires_at).toLocaleString("es-ES")}</T> : null}
        </View>
      ) : null}
      {canEditRole ? (
        <View style={{ marginTop: spacing.lg }}>
          <T weight="semibold" style={{ fontSize: 13, marginBottom: spacing.sm }}>Permisos en el grupo</T>
          <View style={{ gap: 6 }}>
            {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
              <RoleRow key={r} testID={`member-role-${r}`} label={ROLE_LABEL[r]} sub={ROLE_SUB[r]} active={member.role === r} loading={!!changingRole} onPress={() => r !== member.role && onChangeRole?.(r)} />
            ))}
          </View>
        </View>
      ) : null}
      {canManage ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
          {pending && onResend ? <Button testID="member-resend-button" title="Reenviar invitación" variant="secondary" icon="refresh" onPress={onResend} /> : null}
          {pending && onCancel ? <Button testID="member-cancel-button" title="Cancelar invitación" variant="danger" icon="close" onPress={onCancel} /> : null}
          {!pending && member.role !== "owner" && onRemove ? <Button testID="member-remove-button" title="Quitar del grupo" variant="danger" icon="person-remove" onPress={onRemove} /> : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const ROLE_LABEL = { admin: "Administrador", adult_responsible: "Adulto responsable", adult_member: "Miembro adulto", protected_minor: "Menor protegido", temporary_guest: "Invitado temporal" } as const;
const ROLE_SUB = {
  admin: "Puede gestionar miembros, invitaciones y roles",
  adult_responsible: "Adulto con responsabilidad sobre menores del grupo",
  adult_member: "Miembro adulto sin permisos de gestión",
  protected_minor: "Menor bajo supervisión: visibilidad reforzada",
  temporary_guest: "Acceso temporal, sin permisos de gestión",
} as const;

function RoleRow({ label, sub, active, onPress, testID, loading }: { label: string; sub: string; active: boolean; onPress: () => void; testID: string; loading: boolean }) {
  const s = useStyles(); const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={active || loading} style={[s.roleRow, active && s.roleRowOn]}>
      <View style={{ flex: 1 }}>
        <T weight="semibold" style={{ fontSize: 14, color: active ? colors.brandPrimary : colors.onSurface }}>{label}</T>
        <T style={{ fontSize: 11, color: colors.muted }}>{sub}</T>
      </View>
      {active ? <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} /> : <Ionicons name="ellipse-outline" size={20} color={colors.border} />}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: spacing.md },
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingTop: spacing.sm, maxHeight: "72%", overflow: "hidden", borderWidth: 1, borderColor: c.hairline },
  input: { height: 54, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 16, color: c.onSurface, marginTop: spacing.md },
  option: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceTertiary },
  optionOn: { borderColor: c.brandPrimary, backgroundColor: c.surfaceSecondary },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border },
  chipOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  roleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1.5, borderColor: c.border },
  roleRowOn: { borderColor: c.brandPrimary, backgroundColor: c.surfaceSecondary },
  linkBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
}));
