// Group step: create your first circle (or pick an existing one) and continue to the map.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Button, Pill, T, toast } from "@/src/components/ui";
import { createGroup, getMyGroups } from "@/src/sb";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function GroupOnboarding() {
  const router = useRouter();
  const qc = useQueryClient();
  const { reload } = useAuth();
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const groups = useQuery({ queryKey: ["groups"], queryFn: getMyGroups });
  const list = groups.data ?? [];

  const create = async () => {
    const name = newName.trim() || `Grupo ${list.length + 1}`;
    setBusy(true);
    try {
      await createGroup(name);
      setNewName("");
      await qc.invalidateQueries({ queryKey: ["groups"] });
      toast(`Grupo “${name}” creado`, "success");
    } catch (e: any) { toast(e?.message ?? "No se pudo crear el grupo", "error"); } finally { setBusy(false); }
  };

  const finish = async () => { await reload(); router.replace("/map"); };

  return (
    <View style={s.root} testID="onboarding-group">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: 160, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View>
          <T weight="bold" style={{ fontSize: 28 }}>Tu círculo</T>
          <T style={{ color: colors.muted, marginTop: 4 }}>Crea tu grupo (familia, amigos, equipo). Desde el grupo podrás invitar a los tuyos con un enlace.</T>
        </View>

        {list.map((g) => (
          <View key={g.id} style={s.card} testID={`group-card-${g.id}`}>
            <View style={s.groupIcon}><Ionicons name="people" size={18} color={colors.onBrandPrimary} /></View>
            <T weight="bold" style={{ fontSize: 17, flex: 1 }} numberOfLines={1}>{g.name}</T>
            <Pill label={g.my_role === "owner" ? "Propietario" : "Miembro"} tone="cyan" />
          </View>
        ))}

        <View style={s.newCard} testID="new-group-card">
          <T weight="bold">{list.length ? "Crear otro grupo" : "Crea tu primer grupo"}</T>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <TextInput testID="new-group-name" style={s.input} placeholder={list.length ? "Nombre del grupo (p. ej. Amigos)" : "Nombre del grupo (p. ej. Familia)"} placeholderTextColor={colors.muted} value={newName} onChangeText={setNewName} returnKeyType="done" onSubmitEditing={create} />
            <Pressable testID="new-group-create" onPress={create} disabled={busy} style={s.addBtn}><Ionicons name="add" size={22} color={colors.onBrandPrimary} /></Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[s.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button testID="group-continue-button" title={list.length ? "Continuar al mapa" : "Continuar sin grupo"} icon="map" onPress={finish} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  groupIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  newCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.borderStrong, borderStyle: "dashed", padding: spacing.md },
  input: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  addBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  actions: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.divider },
}));
