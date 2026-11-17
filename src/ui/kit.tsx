import React from "react";
import {
  ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text,
  TextInput, useColorScheme, View, ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeTheme, Theme, S, F } from "../theme";

export function useT(): Theme {
  return makeTheme(useColorScheme());
}

export type Tone = "ok" | "warn" | "crit" | "plain";
const toneColors = (t: Theme, tone: Tone) =>
  tone === "ok" ? { fg: t.c.ok, bg: t.c.okBg }
  : tone === "warn" ? { fg: t.c.warn, bg: t.c.warnBg }
  : tone === "crit" ? { fg: t.c.crit, bg: t.c.critBg }
  : { fg: t.c.ink, bg: t.c.hover };

/* Lägesmärke. Liten yta, aldrig ett helt fält i färg. */
export function Badge({ tone = "plain", children, strike }: { tone?: Tone; children: string; strike?: boolean }) {
  const t = useT(); const c = toneColors(t, tone);
  return (
    <View style={[st.badge, { backgroundColor: c.bg }]}>
      <View style={[st.dot, { backgroundColor: c.fg }]} />
      <Text style={{ color: c.fg, fontSize: F.xs, fontWeight: "500", textDecorationLine: strike ? "line-through" : "none" }}>
        {children}
      </Text>
    </View>
  );
}

export function Btn({ title, onPress, kind = "plain", disabled, style }:
  { title: string; onPress?: () => void; kind?: "pri" | "plain" | "danger" | "quiet"; disabled?: boolean; style?: ViewStyle }) {
  const t = useT();
  const pri = kind === "pri";
  return (
    <Pressable
      accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [
        st.btn,
        {
          backgroundColor: pri ? t.c.accent : kind === "quiet" ? "transparent" : t.c.surface,
          borderColor: pri ? t.c.accent : kind === "quiet" ? "transparent" : t.c.line,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}>
      <Text style={{
        color: pri ? t.c.onAccent : kind === "danger" ? t.c.crit : kind === "quiet" ? t.c.accent : t.c.ink,
        fontSize: F.md, fontWeight: "600",
      }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ title, right, children, style }:
  { title?: string; right?: React.ReactNode; children?: React.ReactNode; style?: ViewStyle }) {
  const t = useT();
  return (
    <View style={[st.card, { backgroundColor: t.c.surface, borderColor: t.c.line }, style]}>
      {title ? (
        <View style={[st.cardHead, { borderBottomColor: t.c.line }]}>
          <Text style={{ color: t.c.ink, fontSize: F.sm, fontWeight: "700", flex: 1 }}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/* Listrad. 56 px är golvet, inte taket: innehållet får växa. */
export function Row({ children, onPress, right, last }:
  { children: React.ReactNode; onPress?: () => void; right?: React.ReactNode; last?: boolean }) {
  const t = useT();
  const inner = (
    <View style={[st.row, { borderBottomColor: last ? "transparent" : t.c.line }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>{children}</View>
      {right ? <View style={st.rowRight}>{right}</View> : null}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ backgroundColor: pressed ? t.c.hover : "transparent" })}>
      {inner}
    </Pressable>
  );
}

export function T({ children, k = "body", tone, style }:
  { children: React.ReactNode; k?: "body" | "strong" | "sub" | "mono" | "h"; tone?: Tone; style?: any }) {
  const t = useT();
  const col = tone ? toneColors(t, tone).fg : k === "sub" ? t.c.muted : t.c.ink;
  const base =
    k === "strong" ? { fontSize: F.md, fontWeight: "600" as const }
    : k === "sub" ? { fontSize: F.sm }
    : k === "h" ? { fontSize: F.lg, fontWeight: "700" as const }
    : k === "mono" ? { fontSize: F.sm, fontVariant: ["tabular-nums" as const] }
    : { fontSize: F.md };
  return <Text style={[base, { color: col }, style]}>{children}</Text>;
}

/* Ett nummer är till för att ringas. Med label blir träffytan en knapp som
   säger vem som rings, inte en sifferrad man får sikta på. */
export function Tel({ phone, label }: { phone?: string; label?: string }) {
  const t = useT();
  if (!phone) return null;
  const ring = () => Linking.openURL("tel:" + phone.replace(/[^\d+]/g, ""));
  if (!label) return (
    <Pressable onPress={ring} hitSlop={8} accessibilityRole="link" accessibilityLabel={"Ring " + phone}>
      <Text style={{ color: t.c.accent, fontSize: F.sm, fontVariant: ["tabular-nums"] }}>{phone}</Text>
    </Pressable>
  );
  return (
    <Pressable onPress={ring} accessibilityRole="button" accessibilityLabel={label + ", " + phone}
      style={({ pressed }) => [st.telBtn, { borderColor: t.c.line, backgroundColor: pressed ? t.c.hover : "transparent" }]}>
      <Text numberOfLines={1} style={{ color: t.c.accent, fontSize: F.sm, fontWeight: "600" }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: t.c.muted, fontSize: F.xs, fontVariant: ["tabular-nums"] }}>{phone}</Text>
    </Pressable>
  );
}

export function Avatar({ name }: { name: string }) {
  const t = useT();
  return (
    <View style={[st.av, { backgroundColor: t.c.hover, borderColor: t.c.line }]}>
      <Text style={{ color: t.c.ink, fontSize: F.xs, fontWeight: "700" }}>
        {String(name || "?").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function Alert({ tone = "crit", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = useT(); const c = toneColors(t, tone);
  return (
    <View style={[st.alert, { backgroundColor: c.bg }]}>
      <View style={[st.dot, { backgroundColor: c.fg, marginTop: 6 }]} />
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
    </View>
  );
}

/* Nyckeltal i en rad man kan dra i sidled, i stället för v3:s rutnät. */
export function Stats({ items }: { items: { label: string; value: string | number; tone?: Tone; sub?: string }[] }) {
  const t = useT();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: S.x2, paddingHorizontal: S.x4 }}>
      {items.map((i, n) => (
        <View key={n} style={[st.stat, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
          <Text style={{ color: t.c.muted, fontSize: F.xs }}>{i.label}</Text>
          <Text style={{ color: i.tone ? toneColors(t, i.tone).fg : t.c.ink, fontSize: F.xl, fontWeight: "700" }}>
            {i.value}
          </Text>
          {i.sub ? <Text numberOfLines={1} style={{ color: t.c.muted, fontSize: F.xs, maxWidth: 160 }}>{i.sub}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

export function Segmented({ options, value, onChange }:
  { options: { key: string; label: string; n?: number }[]; value: string; onChange: (k: string) => void }) {
  const t = useT();
  return (
    <View style={[st.seg, { backgroundColor: t.c.hover, borderColor: t.c.line }]}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[st.segItem, on && { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
            <Text style={{ color: on ? t.c.ink : t.c.muted, fontSize: F.sm, fontWeight: on ? "700" : "500" }}>
              {o.label}{o.n ? "  " + o.n : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* Dialogerna från v3 blir ark som reser sig underifrån. */
export function Sheet({ open, title, onClose, children, footer }:
  { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const t = useT(); const ins = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={st.scrim} onPress={onClose} />
      <View style={[st.sheet, { backgroundColor: t.c.surface, borderColor: t.c.line, paddingBottom: ins.bottom || S.x4 }]}>
        <View style={[st.grab, { backgroundColor: t.c.line }]} />
        <View style={[st.sheetHead, { borderBottomColor: t.c.line }]}>
          <Text style={{ color: t.c.ink, fontSize: F.lg, fontWeight: "700", flex: 1 }}>{title}</Text>
          <Btn title="Stäng" kind="quiet" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: S.x4, gap: S.x3 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={[st.sheetFoot, { borderTopColor: t.c.line }]}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

export function Field({ label, value, onChange, placeholder, keyboardType, multiline }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    keyboardType?: "default" | "phone-pad" | "number-pad"; multiline?: boolean }) {
  const t = useT();
  return (
    <View style={{ gap: S.x1, flex: 1 }}>
      <Text style={{ color: t.c.muted, fontSize: F.xs, fontWeight: "600" }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.c.muted}
        keyboardType={keyboardType} multiline={multiline}
        style={[st.input, {
          backgroundColor: t.c.bg, borderColor: t.c.line, color: t.c.ink,
          height: multiline ? 96 : S.tap, textAlignVertical: multiline ? "top" : "center",
          paddingTop: multiline ? S.x2 : 0,
        }]} />
    </View>
  );
}

/* scroll=true lägger alternativen på en rad man drar i sidled. Tio kunder som
   radbryts äter halva arket; en rad håller formuläret läsbart i ett svep. */
export function Choice({ label, options, value, onChange, scroll }:
  { label?: string; options: { key: string; label: string; sub?: string }[]; value: string;
    onChange: (k: string) => void; scroll?: boolean }) {
  const t = useT();
  const Wrap = ({ children }: { children: React.ReactNode }) => scroll
    ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.x2 }}>{children}</ScrollView>
    : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.x2 }}>{children}</View>;
  return (
    <View style={{ gap: S.x1 }}>
      {label ? <Text style={{ color: t.c.muted, fontSize: F.xs, fontWeight: "600" }}>{label}</Text> : null}
      <Wrap>
        {options.map(o => {
          const on = o.key === value;
          return (
            <Pressable key={o.key} onPress={() => onChange(o.key)}
              style={[st.chip, { borderColor: on ? t.c.accent : t.c.line, backgroundColor: on ? t.c.accent : t.c.surface }]}>
              <Text style={{ color: on ? t.c.onAccent : t.c.ink, fontSize: F.sm, fontWeight: on ? "700" : "500" }}>{o.label}</Text>
              {o.sub ? <Text style={{ color: on ? t.c.onAccent : t.c.muted, fontSize: F.xs }}>{o.sub}</Text> : null}
            </Pressable>
          );
        })}
      </Wrap>
    </View>
  );
}

export function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <Pressable onPress={() => onChange(!value)} style={[st.check, { borderColor: t.c.line, backgroundColor: t.c.surface }]}>
      <View style={[st.box, { borderColor: value ? t.c.accent : t.c.line, backgroundColor: value ? t.c.accent : "transparent" }]}>
        {value ? <Text style={{ color: t.c.onAccent, fontSize: F.xs, fontWeight: "900" }}>✓</Text> : null}
      </View>
      <Text style={{ color: t.c.ink, fontSize: F.md, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

/* En tom lista ska säga vad man gör åt saken, inte bara att den är tom. */
export function Empty({ children, action }: { children: string; action?: React.ReactNode }) {
  const t = useT();
  return (
    <View style={{ padding: S.x4, gap: S.x3, alignItems: "flex-start" }}>
      <Text style={{ color: t.c.muted, fontSize: F.md }}>{children}</Text>
      {action}
    </View>
  );
}

export function Loading() {
  const t = useT();
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.c.bg }}><ActivityIndicator /></View>;
}

const st = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: S.x2, height: 24, borderRadius: 12, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  btn: { minHeight: S.tap, paddingHorizontal: S.x4, borderRadius: S.r, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: S.r, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: S.x2, paddingHorizontal: S.x4, minHeight: 48, borderBottomWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: S.x3, paddingHorizontal: S.x4, paddingVertical: S.x2, minHeight: S.row, borderBottomWidth: 1 },
  rowRight: { alignItems: "flex-end", gap: S.x1 },
  av: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  alert: { flexDirection: "row", gap: S.x3, padding: S.x4, borderRadius: S.r },
  stat: { borderWidth: 1, borderRadius: S.r, padding: S.x3, minWidth: 108, gap: 2 },
  seg: { flexDirection: "row", borderRadius: S.r, borderWidth: 1, padding: 3, gap: 3 },
  segItem: { flex: 1, minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,20,26,.45)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1 },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: S.x2 },
  sheetHead: { flexDirection: "row", alignItems: "center", paddingLeft: S.x4, paddingRight: S.x2, minHeight: 56, borderBottomWidth: 1 },
  sheetFoot: { flexDirection: "row", gap: S.x2, padding: S.x4, borderTopWidth: 1 },
  input: { borderWidth: 1, borderRadius: S.r, paddingHorizontal: S.x3, fontSize: F.md },
  chip: { minHeight: S.tap, paddingHorizontal: S.x4, borderRadius: S.r, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  telBtn: { alignSelf: "flex-start", maxWidth: "100%", minHeight: 40, justifyContent: "center", paddingHorizontal: S.x3, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  check: { flexDirection: "row", alignItems: "center", gap: S.x3, minHeight: S.tap, paddingHorizontal: S.x3, borderRadius: S.r, borderWidth: 1 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
