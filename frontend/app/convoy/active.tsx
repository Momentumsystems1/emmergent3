// /convoy/active — resuelve el destino lógico del tab Convoy:
// si el grupo tiene un convoy en curso, abre su tarjeta; si no, propone crear uno.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { T } from "@/src/components/ui";
import { fetchActiveConvoy } from "@/src/convoys";
import { fetchGroups } from "@/src/groups";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function ConvoyResolver() {
  const router = useRouter();
  const s = useStyles();
  const { colors } = useTheme();
  const groups = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
  const group: any = groups.data?.[0];
  const active = useQuery({ queryKey: ["convoy-active", group?.id], enabled: !!group, queryFn: () => fetchActiveConvoy(group.id) });

  useEffect(() => {
    if (!groups.isSuccess) return;
    if (!group) { router.replace("/onboarding/group"); return; }
    if (!active.isSuccess) return;
    if (active.data) router.replace(`/convoy/${active.data.id}`);
    else router.replace({ pathname: "/convoy/new", params: { group: group.id } });
  }, [groups.isSuccess, active.isSuccess, active.data, group, router]);

  return (
    <View style={s.root}>
      <T style={{ color: colors.muted, fontSize: 13 }}>Buscando convoy…</T>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl },
}));
