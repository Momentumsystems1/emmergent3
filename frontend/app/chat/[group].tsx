// Short messages to one or several group members. Doubles as the per-group inbox: shows every message where I am the
// sender or a recipient. Quick presets + free text, and a recipient selector (Todos or specific members).
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Header, T, toast } from "@/src/components/ui";
import { UserPhoto } from "@/src/components/UserPhoto";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const PRESETS = ["Voy de camino", "Estoy llegando", "Llego tarde", "¿Todo bien?", "Estoy bien", "Te llamo ahora"];
const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

type Msg = { id: string; sender_id: string; sender_name: string; sender_color?: string; recipient_ids: string[]; text: string; created_at: string };
type Member = { id: string; user_id: string; display_name: string; color: string; status: string; has_photo?: boolean };

export default function GroupChat() {
  const { group: groupId, to } = useLocalSearchParams<{ group: string; to?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const listRef = useRef<FlatList>(null);
  const [text, setText] = useState("");
  const [sel, setSel] = useState<string[]>(to ? [to] : []); // empty == everyone

  const group = useQuery({ queryKey: ["group", groupId], enabled: !!groupId, queryFn: () => api<any>(`/groups/${groupId}`) });
  const messages = useQuery({ queryKey: ["messages", groupId], enabled: !!groupId, refetchInterval: 8000, queryFn: () => api<Msg[]>(`/groups/${groupId}/messages`) });
  const members: Member[] = (group.data?.members ?? []).filter((m: Member) => m.status === "active" && m.user_id && m.user_id !== user?.id);

  useEffect(() => { if (groupId) api(`/groups/${groupId}/messages/read_all`, { method: "POST" }).then(() => { qc.invalidateQueries({ queryKey: ["msg-unread"] }); qc.invalidateQueries({ queryKey: ["msg-inbox"] }); }).catch(() => null); }, [groupId, messages.data?.length, qc]);

  const send = useMutation({
    mutationFn: (body: { text: string }) => api(`/groups/${groupId}/messages`, { method: "POST", json: { recipient_ids: sel, text: body.text } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["messages", groupId] }); },
    onError: (e: any) => toast(e.message, "error"),
  });
  const doSend = (t: string) => { const v = t.trim(); if (!v) return; if (!members.length) return toast("No hay otros miembros en el grupo"); send.mutate({ text: v }); };

  const toggle = (uid: string) => setSel((cur) => (cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid]));
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? "";
  const recipLabel = (m: Msg) => (m.recipient_ids.length >= members.length ? "Todos" : m.recipient_ids.map(nameOf).filter(Boolean).join(", "));

  return (
    <View style={s.root} testID="chat-screen">
      <Header title={group.data?.name ? `Mensajes · ${group.data.name}` : "Mensajes"} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 8}>
        <FlatList
          ref={listRef}
          testID="chat-list"
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1, justifyContent: (messages.data?.length ?? 0) ? "flex-end" : "center" }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<View style={{ alignItems: "center", gap: 8 }}><Ionicons name="chatbubbles-outline" size={40} color={colors.muted} /><T style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>Aún no hay mensajes.{"\n"}Escribe uno corto abajo.</T></View>}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View style={[s.bubbleRow, { justifyContent: mine ? "flex-end" : "flex-start" }]} testID={`chat-msg-${item.id}`}>
                {!mine ? <View style={s.avatarWrap}><UserPhoto userId={item.sender_id} name={item.sender_name} color={item.sender_color ?? colors.brandPrimary} size={30} hasPhoto /></View> : null}
                <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                  {!mine ? <T weight="bold" style={{ fontSize: 12, color: item.sender_color ?? colors.brandPrimary, marginBottom: 2 }}>{item.sender_name}</T> : null}
                  <T style={{ fontSize: 14.5, color: mine ? colors.onBrandPrimary : colors.onSurface }}>{item.text}</T>
                  <T style={{ fontSize: 10, marginTop: 3, color: mine ? colors.onBrandPrimary : colors.muted, opacity: 0.8, textAlign: "right" }}>{mine ? `Para ${recipLabel(item)} · ` : ""}{fmtTime(item.created_at)}</T>
                </View>
              </View>
            );
          }}
        />

        {/* Recipient selector */}
        <View style={s.recipBar}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.md, alignItems: "center" }}
            data={[{ user_id: "", display_name: "Todos", color: colors.brandPrimary } as any, ...members]}
            keyExtractor={(m) => m.user_id || "all"}
            renderItem={({ item }) => {
              const isAll = !item.user_id;
              const on = isAll ? sel.length === 0 : sel.includes(item.user_id);
              return (
                <Pressable testID={`recip-${item.user_id || "all"}`} onPress={() => (isAll ? setSel([]) : toggle(item.user_id))} style={[s.chip, on && { backgroundColor: item.color, borderColor: item.color }]}>
                  <Ionicons name={isAll ? "people" : "person"} size={13} color={on ? "#FFFFFF" : colors.onSurface} />
                  <T weight="semibold" style={{ fontSize: 12.5, color: on ? "#FFFFFF" : colors.onSurface }}>{item.display_name}</T>
                </Pressable>
              );
            }}
          />
        </View>

        {/* Quick presets */}
        <View style={s.presetBar}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: spacing.md }}
            data={PRESETS}
            keyExtractor={(p) => p}
            renderItem={({ item }) => <Pressable testID={`preset-${item}`} onPress={() => doSend(item)} disabled={send.isPending} style={s.preset}><T style={{ fontSize: 12.5, color: colors.onSurface }}>{item}</T></Pressable>}
          />
        </View>

        {/* Composer */}
        <View style={[s.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput testID="chat-input" style={s.input} value={text} onChangeText={setText} placeholder="Mensaje corto…" placeholderTextColor={colors.muted} multiline maxLength={500} onSubmitEditing={() => doSend(text)} />
          <Pressable testID="chat-send" onPress={() => doSend(text)} disabled={send.isPending || !text.trim()} style={[s.sendBtn, { opacity: text.trim() ? 1 : 0.4 }]}>
            <Ionicons name="send" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  avatarWrap: { width: 30, height: 30, borderRadius: 15, overflow: "hidden" },
  bubble: { maxWidth: "78%", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  mine: { backgroundColor: c.brandPrimary, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4 },
  recipBar: { paddingVertical: spacing.sm, borderTopWidth: 1, borderColor: c.divider },
  presetBar: { paddingBottom: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  preset: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: c.divider, backgroundColor: c.surface },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
