import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useStore, useLedare } from "../store";
import { useSheet } from "../sheets/Sheets";
import { Screen, Pad } from "../ui/Screen";
import { Avatar, Btn, Card, Empty, Row, T, useT } from "../ui/kit";
import { S, F } from "../theme";
import { add, dayNum, dayShort, monday, nice, today, weekNo } from "../domain/dates";
import { cname, jobsOf, jobsOn, out, shortage, weekDays } from "../domain/logic";
import { forslag, medInsatt } from "../domain/actions";
import { Job } from "../domain/types";

const NAMN = 96, DAG = 108, RAD = 60, HUVUD = 44;

/* v3 pressade in fem dagar på skärmbredden och klippte texten. Här får en dag
   vara 108 px bred och rutnätet dras i sidled i stället. Namnkolumnen står
   stilla, annars tappar man vem raden gäller. */
export function Vecka() {
  const { s, kor, migId } = useStore();
  const ledare = useLedare();
  const open = useSheet();
  const t = useT();
  const [week, setWeek] = useState(monday(today()));
  const ds = weekDays(week);

  const satt = (j: Job, pid: string) => kor({ typ: "bemanning", jobbId: j.id, personer: medInsatt(s, j, pid) });
  const fyll = (j: Job) => {
    const k = forslag(s, j);
    if (k.length === 1) satt(j, k[0].id);
    else open({ t: "replace", id: j.id });
  };

  const ruta = (pid: string, d: string) => {
    const p = s.people.find(x => x.id === pid)!;
    const borta = out(p, d);
    const mina = jobsOf(s, p.id, d);
    const kort = mina.find(j => shortage(s, j));
    const bg = borta ? t.c.hover : kort ? t.c.critBg : mina.length ? t.c.accent : "transparent";
    const fg = borta ? t.c.muted : kort ? t.c.crit : mina.length ? t.c.onAccent : t.c.muted;
    const far = ledare || p.id === migId;
    const press = () => {
      if (!far) return;
      if (borta) { open({ t: "absence", id: p.id, date: d }); return; }
      if (!ledare) { open({ t: "absence", id: p.id, date: d }); return; }
      if (mina.length) open({ t: "job", id: mina[0].id });
      else open({ t: "give", pid: p.id, date: d });
    };
    return (
      <Pressable key={d} onPress={press} disabled={!far} accessibilityRole="button"
        style={{ width: DAG - S.x2, height: RAD - S.x2, borderRadius: 8, borderWidth: 1, justifyContent: "center",
          paddingHorizontal: S.x2, marginRight: S.x2, marginBottom: S.x2,
          borderColor: mina.length || borta ? "transparent" : t.c.line,
          borderStyle: mina.length || borta ? "solid" : "dashed", backgroundColor: bg }}>
        {borta ? (
          <Text style={{ color: fg, fontSize: F.sm }}>{p.away!.type}</Text>
        ) : mina.length ? (
          <>
            <Text numberOfLines={1} style={{ color: fg, fontSize: F.sm, fontWeight: "700" }}>
              {mina.length > 1 ? mina.length + " jobb" : cname(s, mina[0])}
            </Text>
            <Text numberOfLines={1} style={{ color: fg, fontSize: F.xs, opacity: 0.85 }}>
              {mina.length > 1 ? mina.map(j => cname(s, j)).join(", ") : mina[0].title}
            </Text>
          </>
        ) : (
          <Text style={{ color: fg, fontSize: F.xs }}>Ledig · ge jobb</Text>
        )}
      </Pressable>
    );
  };

  const brist = ds.flatMap(d => jobsOn(s, d).filter(j => shortage(s, j)).map(j => ({ d, j })));

  return (
    <Screen title={"Vecka " + weekNo(week)} subtitle={nice(week) + " – " + nice(add(week, 4))}
      right={
        <View style={{ flexDirection: "row", gap: S.x1 }}>
          <Btn title="‹" onPress={() => setWeek(add(week, -7))} style={{ paddingHorizontal: S.x4 }} />
          <Btn title="›" onPress={() => setWeek(add(week, 7))} style={{ paddingHorizontal: S.x4 }} />
        </View>
      }>
      <Pad>
        {week !== monday(today()) ? <Btn title="Tillbaka till denna vecka" onPress={() => setWeek(monday(today()))} /> : null}

        <Card>
          <View style={{ flexDirection: "row", padding: S.x3, paddingRight: 0 }}>
            <View style={{ width: NAMN }}>
              <View style={{ height: HUVUD }} />
              {s.people.map(p => (
                <View key={p.id} style={{ height: RAD, flexDirection: "row", alignItems: "center", gap: S.x2, paddingRight: S.x2 }}>
                  <Avatar name={p.name} />
                  <Text numberOfLines={1} style={{ color: t.c.ink, fontSize: F.sm, fontWeight: "600", flex: 1 }}>{p.name}</Text>
                </View>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ flexDirection: "row", height: HUVUD }}>
                  {ds.map(d => (
                    <View key={d} style={{ width: DAG - S.x2, marginRight: S.x2, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: d === today() ? t.c.accent : t.c.muted, fontSize: F.xs }}>{dayShort(d)}</Text>
                      <Text style={{ color: d === today() ? t.c.accent : t.c.ink, fontSize: F.md, fontWeight: "700" }}>{dayNum(d)}</Text>
                    </View>
                  ))}
                </View>
                {s.people.map(p => (
                  <View key={p.id} style={{ flexDirection: "row", height: RAD }}>{ds.map(d => ruta(p.id, d))}</View>
                ))}
              </View>
            </ScrollView>
          </View>
        </Card>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.x3, alignItems: "center" }}>
          <Legend swatch={{ backgroundColor: t.c.accent }} text="Bemannat" />
          <Legend swatch={{ backgroundColor: t.c.critBg }} text="Saknar folk" />
          <Legend swatch={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.c.line }} text="Ledig" />
          <Legend swatch={{ backgroundColor: t.c.hover }} text="Borta" />
        </View>

        <Card title={brist.length ? "Luckor i veckan  " + brist.length : "Luckor i veckan"}>
          {brist.length ? brist.map((r, i) => {
            const k = forslag(s, r.j);
            return (
              <Row key={r.j.id} last={i === brist.length - 1}
                right={!ledare ? undefined : k.length === 1
                  ? <Btn title={"Sätt in " + k[0].name} kind="pri" onPress={() => satt(r.j, k[0].id)} />
                  : k.length > 1
                    ? <Btn title="Välj ersättare" kind="pri" onPress={() => fyll(r.j)} />
                    : <Btn title="Flytta jobbet" onPress={() => open({ t: "job", id: r.j.id })} />}>
                <T k="strong">{cname(s, r.j)}</T>
                <T k="sub">{nice(r.d)} · {r.j.title} · saknas {shortage(s, r.j)}</T>
                <T k="sub">{k.length ? "Ledig: " + k.map(p => p.name).join(", ") : "Ingen är ledig den dagen."}</T>
              </Row>
            );
          }) : <Empty>Hela veckan är bemannad.</Empty>}
        </Card>
      </Pad>
    </Screen>
  );
}

function Legend({ swatch, text }: { swatch: any; text: string }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={[{ width: 16, height: 16, borderRadius: 5 }, swatch]} />
      <Text style={{ color: t.c.muted, fontSize: F.xs }}>{text}</Text>
    </View>
  );
}
