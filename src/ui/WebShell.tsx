import React from "react";
import { Linking, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useT } from "./kit";
import { S, F } from "../theme";

/* På en telefon är appen hela skärmen. I en bred webbläsare blir samma vy en
   utsträckt flikrad över 1400 px, vilket ser ut som ett misstag. Där ställer vi
   i stället upp appen i telefonformat bredvid en text som säger vad man ser. */
const BRED = 900, TELEFON = 412;

export function WebShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== "web" || width < BRED) return <>{children}</>;

  const punkt = (text: string) => (
    <View style={{ flexDirection: "row", gap: S.x2 }}>
      <Text style={{ color: t.c.accent, fontSize: F.md }}>·</Text>
      <Text style={{ color: t.c.muted, fontSize: F.md, flex: 1, lineHeight: 22 }}>{text}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, flexDirection: "row", justifyContent: "center",
      alignItems: "center", gap: 56, padding: S.x6 }}>
      <View style={{ maxWidth: 420, gap: S.x4 }}>
        <View style={{ gap: S.x2 }}>
          <Text style={{ color: t.c.ink, fontSize: 40, fontWeight: "700", letterSpacing: -0.8 }}>Jobbtavlan</Text>
          <Text style={{ color: t.c.muted, fontSize: F.lg, lineHeight: 26 }}>
            Dagens jobb, veckans bemanning och personalen, för en firma med en handfull anställda.
          </Text>
        </View>
        <View style={{ gap: S.x3 }}>
          {punkt("Idag öppnar på det som behöver dig: luckan, och knappen som fyller den.")}
          {punkt("Veckan visar vem som är var. Dra rutnätet i sidled.")}
          {punkt("Sjukanmäl någon och se planen räkna om sig. Ångra ligger kvar i rutan som dyker upp.")}
        </View>
        <View style={{ gap: S.x2, borderTopWidth: 1, borderTopColor: t.c.line, paddingTop: S.x4 }}>
          <Text style={{ color: t.c.muted, fontSize: F.sm, lineHeight: 20 }}>
            Det här är webbversionen av en app som är byggd för Android och iOS. Samma kod, samma logik.
            Allt innehåll är påhittat, och det du ändrar sparas bara i din egen webbläsare.
          </Text>
          <Pressable onPress={() => Linking.openURL("https://github.com/fluffigast/jobbtavlan-v4")}>
            <Text style={{ color: t.c.accent, fontSize: F.sm, fontWeight: "600" }}>Källkoden på GitHub</Text>
          </Pressable>
        </View>
      </View>

      <View style={{
        width: TELEFON, height: Math.min(880, height - 64), borderRadius: 36, overflow: "hidden",
        backgroundColor: t.c.bg, borderWidth: 10, borderColor: t.dark ? "#000" : "#1F2328",
        shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 36, shadowOffset: { width: 0, height: 18 },
      }}>
        {children}
      </View>
    </View>
  );
}
