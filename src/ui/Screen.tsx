import React from "react";
import { ScrollView, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "./kit";
import { S, F } from "../theme";

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
