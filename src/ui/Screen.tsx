import React from "react";
import { Pressable, ScrollView, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "./kit";
import { S, F } from "../theme";
import { useStore } from "../store";
import { useSheet } from "../sheets/Sheets";

/* Ett skärmskal: titelrad som stannar, innehåll som rullar.
   Sidomenyn från v3 är borta, den ligger i flikraden längst ned. */
export function Screen({ title, subtitle, right, children, scroll = true }:
  { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; scroll?: boolean }) {
  const t = useT(); const ins = useSafeAreaInsets();
  const head = (
    <View style={{
      paddingTop: ins.top + S.x2, paddingBottom: S.x3, paddingHorizontal: S.x4,
      backgroundColor: t.c.surface, borderBottomWidth: 1, borderBottomColor: t.c.line,
      flexDirection: "row", alignItems: "flex-end", gap: S.x3,
    }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.c.ink, fontSize: F.xxl, fontWeight: "700", letterSpacing: -0.4 }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ color: t.c.muted, fontSize: F.sm, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right}
      <Konto />
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {head}
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingVertical: S.x4, gap: S.x4, paddingBottom: S.x6 }}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </View>
  );
}

/* Innehåll som ska ha marginal mot skärmkanten. Stats-remsan ska inte ha det. */
export function Pad({ children, gap = S.x4 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ paddingHorizontal: S.x4, gap }}>{children}</View>;
}


/* Vem du är och om de andra ser det du gör. Finns på varje skärm, för frågan
   "sparas det här någonstans?" dyker upp där man råkar stå. */
function Konto() {
  const t = useT();
  const { session, nat } = useStore();
  const open = useSheet();
  const prick = !session ? t.c.muted : nat === "offline" ? t.c.warn : t.c.ok;
  return (
    <Pressable onPress={() => open({ t: "konto" })} accessibilityRole="button"
      accessibilityLabel={session ? "Inloggad som " + session.namn : "Demoläge, inte inloggad"}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: t.c.line,
        backgroundColor: pressed ? t.c.hover : t.c.surface, alignItems: "center", justifyContent: "center",
      })}>
      <Text style={{ color: t.c.ink, fontSize: F.sm, fontWeight: "700" }}>
        {session ? session.namn.charAt(0).toUpperCase() : "D"}
      </Text>
      <View style={{ position: "absolute", right: 1, bottom: 1, width: 10, height: 10, borderRadius: 5,
        backgroundColor: prick, borderWidth: 2, borderColor: t.c.surface }} />
    </Pressable>
  );
}
