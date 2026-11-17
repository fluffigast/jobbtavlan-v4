import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useStore } from "../store";
import { useSheet } from "../sheets/Sheets";
import { Screen, Pad } from "../ui/Screen";
import { Alert, Badge, Btn, Card, Empty, Row, Stats, T, Tel, Avatar, useT } from "../ui/kit";
import { S, F } from "../theme";
import { add, dayNum, dayShort, longDate, monday, nice, today, weekNo, workday } from "../domain/dates";
import { cname, free, jobsOf, jobsOn, out, shortage, unread } from "../domain/logic";

function WeekStrip({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  const t = useT(); const { s } = useStore();
  const mon = monday(date);
  const days = Array.from({ length: 7 }, (_, i) => add(mon, i));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.x2, paddingHorizontal: S.x4 }}>
      {days.map(d => {
        const on = d === date, isToday = d === today();
        const n = jobsOn(s, d).reduce((a, j) => a + shortage(s, j), 0);
        return (
          <Pressable key={d} onPress={() => onPick(d)}
            style={{ width: 56, paddingVertical: S.x2, borderRadius: S.r, borderWidth: 1, alignItems: "center", gap: 2,
              borderColor: on ? t.c.accent : t.c.line, backgroundColor: on ? t.c.accent : t.c.surface }}>
            <Text style={{ color: on ? t.c.onAccent : t.c.muted, fontSize: F.xs }}>{dayShort(d)}</Text>
            <Text style={{ color: on ? t.c.onAccent : isToday ? t.c.accent : t.c.ink, fontSize: F.lg, fontWeight: "700" }}>{dayNum(d)}</Text>
            <View style={{ height: 6, flexDirection: "row", gap: 3 }}>
              {n ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? t.c.onAccent : t.c.crit }} /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Idag() {
  const { s, edit } = useStore();
  const open = useSheet();
  const [date, setDate] = useState(today());
  const js = jobsOn(s, date).slice().sort((a, b) => shortage(s, b) - shortage(s, a));
  const sh = js.filter(j => shortage(s, j));
  const tot = sh.reduce((a, j) => a + shortage(s, j), 0);
  const fr = free(s, date);
  const aw = s.people.filter(p => out(p, date));
  const un = unread(s);

  return (
    <Screen
      title={date === today() ? "Idag" : nice(date)}
      subtitle={longDate(date) + " · vecka " + weekNo(date)}
      right={<Btn title="Nytt jobb" kind="pri" onPress={() => open({ t: "job", date })} />}>
      <WeekStrip date={date} onPick={setDate} />
      <Stats items={[
        { label: "Jobb", value: js.length, sub: js.length ? js.reduce((a, j) => a + j.need, 0) + " platser" : "" },
        { label: "Saknas", value: tot, tone: tot ? "crit" : undefined, sub: tot ? sh.map(j => cname(s, j)).join(", ") : "Fullt bemannat" },
        { label: "Lediga", value: fr.length, sub: fr.map(p => p.name).join(", ") },
        { label: "Borta", value: aw.length, sub: aw.map(p => p.name).join(", ") },
        { label: "Olästa sms", value: un.length },
      ]} />

      <Pad>
        {tot ? (
          <Alert tone="crit">
            <T k="strong" tone="crit">{tot + (tot === 1 ? " person saknas" : " personer saknas")}</T>
            <T k="sub">{"På " + sh.map(j => cname(s, j)).join(", ") + ". " +
              (fr.length ? "Lediga: " + fr.map(p => p.name).join(", ") + "." : "Ingen är ledig, flytta ett jobb.")}</T>
          </Alert>
        ) : fr.length && workday(date) && js.length ? (
          <Alert tone="warn">
            <T k="strong" tone="warn">Utan jobb: {fr.map(p => p.name).join(", ")}</T>
            <T k="sub">Boka in en kund som väntar.</T>
          </Alert>
        ) : null}

        <Card title={"Jobb  " + js.length}>
          {js.length ? js.map((j, i) => {
            const n = shortage(s, j);
            const c = s.customers.find(x => x.id === j.customerId);
            return (
              <Row key={j.id} last={i === js.length - 1} onPress={() => open({ t: "job", id: j.id })}
                right={n
                  ? <Btn title="Ersättare" kind="pri" onPress={() => open({ t: "replace", id: j.id })} />
                  : <Badge tone="ok">Bemannat</Badge>}>
                <T k="strong">{cname(s, j)}</T>
                <T k="sub">{j.title}{c?.address ? " · " + c.address : ""}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.x1, marginTop: 2 }}>
                  {n ? <Badge tone="crit">{"Saknas " + n}</Badge> : null}
                  {j.people.map(id => {
                    const p = s.people.find(x => x.id === id);
                    if (!p) return null;
                    return out(p, j.date)
                      ? <Badge key={id} tone="warn" strike>{p.name + " · " + p.away!.type.toLowerCase()}</Badge>
                      : <Badge key={id}>{p.name}</Badge>;
                  })}
                </View>
                {c?.phone ? <Tel phone={c.phone} /> : null}
              </Row>
            );
          }) : <Empty>Inga jobb inbokade den här dagen.</Empty>}
        </Card>

        <Card title={"Personal  " + s.people.length}>
          {s.people.map((p, i) => {
            const away = out(p, date);
            const mine = jobsOf(s, p.id, date);
            return (
              <Row key={p.id} last={i === s.people.length - 1}
                right={away
                  ? <Btn title="Tillbaka" onPress={() => edit(p.name + ": frånvaro borttagen", d => { d.people.find(x => x.id === p.id)!.away = null; })} />
                  : <Btn title="Frånvaro" onPress={() => open({ t: "absence", id: p.id, date })} />}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: S.x2 }}>
                  <Avatar name={p.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T k="strong">{p.name}</T>
                    {away ? <Badge tone="crit">{p.away!.type + (p.away!.to ? " t.o.m. " + nice(p.away!.to) : "")}</Badge>
                      : mine.length ? <T k="sub">{mine.map(j => cname(s, j)).join(", ")}</T>
                      : <Badge tone="warn">Ledig</Badge>}
                  </View>
                </View>
              </Row>
            );
          })}
        </Card>
      </Pad>
    </Screen>
  );
}
