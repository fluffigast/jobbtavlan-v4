import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useStore } from "../store";
import { useSheet } from "../sheets/Sheets";
import { Screen, Pad } from "../ui/Screen";
import { Avatar, Badge, Btn, Card, Empty, Row, T, useT } from "../ui/kit";
import { S, F } from "../theme";
import { add, dayNum, dayShort, monday, nice, today, weekNo } from "../domain/dates";
import { cname, jobsOf, jobsOn, out, shortage, weekDays } from "../domain/logic";

/* v3 hade en bred tabell: en kolumn per dag, en rad per person, jobbnamnet i rutan.
   På en telefon får fem kolumner plus namn inte plats med text i rutorna.
   Rutan blir därför ett lägesmärke, och trycket öppnar det som v3 visade direkt. */
/* Rutan är smal. Första ordet i kundnamnet bär mer än sex tecken av hela namnet. */
const short1 = (name: string) => {
  const w = name.split(" ")[0];
  return w.length > 8 ? w.slice(0, 8) : w;
};
const awayShort = (type: string) =>
  type === "Semester" ? "sem" : type === "Sjuk" ? "sjuk" : type.toLowerCase().slice(0, 4);

function Legend({ swatch, text }: { swatch: any; text: string }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={[{ width: 16, height: 16, borderRadius: 5 }, swatch]} />
      <Text style={{ color: t.c.muted, fontSize: F.xs }}>{text}</Text>
    </View>
  );
}

export function Vecka() {
  const { s } = useStore();
  const open = useSheet();
  const t = useT();
  const [week, setWeek] = useState(monday(today()));
  const ds = weekDays(week);

  const cell = (pid: string, d: string) => {
    const p = s.people.find(x => x.id === pid)!;
    const away = out(p, d);
    const mine = jobsOf(s, p.id, d);
    const short = mine.some(j => shortage(s, j));
    const press = () => {
      if (away) return;
      if (mine.length) open({ t: "job", id: mine[0].id });
      else open({ t: "give", pid: p.id, date: d });
    };
    const bg = away ? t.c.hover : short ? t.c.critBg : mine.length ? t.c.accent : "transparent";
    const fg = away ? t.c.muted : short ? t.c.crit : mine.length ? t.c.onAccent : t.c.muted;
    return (
      <Pressable key={d} onPress={press} disabled={away}
        style={{ flex: 1, height: 44, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center",
          borderColor: mine.length || away ? "transparent" : t.c.line, borderStyle: mine.length || away ? "solid" : "dashed",
          backgroundColor: bg }}>
        <Text numberOfLines={1} style={{ color: fg, fontSize: F.xs, fontWeight: "700" }}>
          {away ? awayShort(p.away!.type) : mine.length ? (mine.length > 1 ? mine.length + " jobb" : short1(cname(s, mine[0]))) : "ledig"}
        </Text>
      </Pressable>
    );
  };

  return (
    <Screen title={"Vecka " + weekNo(week)} subtitle={nice(week) + " – " + nice(add(week, 4))}
      right={
        <View style={{ flexDirection: "row", gap: S.x1 }}>
          <Btn title="‹" onPress={() => setWeek(add(week, -7))} style={{ paddingHorizontal: S.x4 }} />
          <Btn title="›" onPress={() => setWeek(add(week, 7))} style={{ paddingHorizontal: S.x4 }} />
        </View>
      }>
      <Pad>
        {week !== monday(today()) ? <Btn title="Denna vecka" onPress={() => setWeek(monday(today()))} /> : null}
        <Card>
          <View style={{ flexDirection: "row", gap: S.x1, paddingHorizontal: S.x3, paddingTop: S.x3, paddingBottom: S.x1 }}>
            <View style={{ width: 84 }} />
            {ds.map(d => (
              <View key={d} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: d === today() ? t.c.accent : t.c.muted, fontSize: F.xs }}>{dayShort(d)}</Text>
                <Text style={{ color: d === today() ? t.c.accent : t.c.ink, fontSize: F.sm, fontWeight: "700" }}>{dayNum(d)}</Text>
              </View>
            ))}
          </View>
          {s.people.map((p, i) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: S.x1, paddingHorizontal: S.x3,
              paddingVertical: S.x1, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}>
              <View style={{ width: 84, flexDirection: "row", alignItems: "center", gap: S.x1 }}>
                <Avatar name={p.name} />
                <Text numberOfLines={1} style={{ color: t.c.ink, fontSize: F.sm, fontWeight: "600", flex: 1 }}>{p.name}</Text>
              </View>
              {ds.map(d => cell(p.id, d))}
            </View>
          ))}
        </Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.x3, alignItems: "center" }}>
          <Legend swatch={{ backgroundColor: t.c.accent }} text="Bemannat" />
          <Legend swatch={{ backgroundColor: t.c.critBg }} text="Saknar folk" />
          <Legend swatch={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.c.line }} text="Ledig, tryck för att ge jobb" />
          <Legend swatch={{ backgroundColor: t.c.hover }} text="Borta" />
        </View>

        <Card title="Saknas folk i veckan">
          {(() => {
            const rows = ds.flatMap(d => jobsOn(s, d).filter(j => shortage(s, j)).map(j => ({ d, j })));
            if (!rows.length) return <Empty>Hela veckan är bemannad.</Empty>;
            return rows.map((r, i) => (
              <Row key={r.j.id} last={i === rows.length - 1}
                right={<Btn title="Ersättare" kind="pri" onPress={() => open({ t: "replace", id: r.j.id })} />}>
                <T k="strong">{cname(s, r.j)}</T>
                <T k="sub">{nice(r.d)} · {r.j.title}</T>
                <Badge tone="crit">{"Saknas " + shortage(s, r.j)}</Badge>
              </Row>
            ));
          })()}
        </Card>
      </Pad>
    </Screen>
  );
}
