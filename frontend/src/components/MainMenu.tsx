// Hamburger menu (top bar): account, privacy, groups, plans, sign-out. Only real, existing destinations.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { useAuth } from "@/src/auth";
import { Sheet } from "@/src/components/sheets";
import { T } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function MainMenu({ visible, onClose, groups }: { visible: boolean; onClose: () => void; groups: { id: string; name: string }[] }) {
  const { colors } = useTheme(); const router = useRouter(); const { signOut, user } = useAuth();
  const go = (path: string) => { onClose(); router.push(path as any); };
  return (
    <Sheet visible={visible} onClose={onClose} testID="main-menu">
      <T weight="bold" style={{ fontSize: 20 }}>{user?.profile?.name ?? "Menú"}</T>
      <T style={{ color: colors.muted, fontSize: 12, marginBottom: spacing.sm }}>{user?.email}</T>
      <Item testID="menu-profile" icon="person" label="Mi perfil" sub="Nombre, foto, color y avatar" onPress={() => go("/profile")} />
      <Item testID="menu-privacy" icon="lock-closed" label="Privacidad y visibilidad" sub="Qué compartes, con quién y con qué precisión" onPress={() => go("/privacy")} />
      {groups.map((g) => <Item key={g.id} testID={`menu-group-${g.id}`} icon="people" label={g.name} sub="Miembros, invitaciones y permisos" onPress={() => go(`/group/${g.id}`)} />)}
      <Item testID="menu-groups-manage" icon="add-circle" label="Crear o editar grupos" onPress={() => go("/onboarding/group")} />
      <Item testID="menu-plans" icon="card" label="Plan y límites" onPress={() => go("/plans")} />
      <Item testID="menu-signout" icon="log-out" label="Cerrar sesión" danger onPress={async () => { onClose(); await signOut(); router.replace("/"); }} />
    </Sheet>
  );
}

function Item({ icon, label, sub, onPress, testID, danger }: { icon: string; label: string; sub?: string; onPress: () => void; testID: string; danger?: boolean }) {
  const s = useStyles(); const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={s.item}>
      <View style={[s.icon, danger && { backgroundColor: colors.error }]}><Ionicons name={icon as any} size={18} color={danger ? colors.onError : colors.brandPrimary} /></View>
      <View style={{ flex: 1 }}><T weight="semibold" style={{ fontSize: 15, color: danger ? colors.error : colors.onSurface }}>{label}</T>{sub ? <T style={{ fontSize: 12, color: colors.muted }}>{sub}</T> : null}</View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.divider },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
}));
