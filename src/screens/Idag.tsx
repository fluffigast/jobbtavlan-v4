import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useStore, useLedare } from "../store";
import { useSheet } from "../sheets/Sheets";
import { Screen, Pad } from "../ui/Screen";
import { Alert, Badge, Btn, Card, Empty, Row, Stats, T, Tel, Avatar, useT } from "../ui/kit";
import { S, F } from "../theme";
import { add, dayNum, dayShort, longDate, monday, nice, today, weekNo, workday } from "../domain/dates";
import { cname, free, jobsOf, jobsOn, out, shortage, unread } from "../domain/logic";
import { forslag, luckor, sjukIdag, tillbaka, tillsatt, tillsattText } from "../domain/actions";
import { Job } from "../domain/types";

function WeekStrip({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  const t = useT(); const { s } = useStore();
  const days = Array.from({ length: 7 }, (_, i) => add(monday(date), i));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.x2, paddingHorizontal: S.x4 }}>
      {days.map(d => {
        const on = d === date, isToday = d === today();
        const n = jobsOn(s, d).reduce((a, j) => a + shortage(s, j), 0);
        return (
          <Pressable key={d} onPress={() => onPick(d)} accessibilityRole="button"
            accessibilityLabel={nice(d) + (n ? ", saknar " + n : "")}
            style={{ width: 56, paddingVertical: S.x2, borderRadius: S.r, borderWidth: 1, alignItems: "center", gap: 2,
              borderColor: on ? t.c.accent : t.c.line, backgroundColor: on ? t.c.accent : t.c.surface }}>
            <Text style={{ color: on ? t.c.onAccent : t.c.muted, fontSize: F.xs }}>{dayShort(d)}</Text>
            <Text style={{ color: on ? t.c.onAccent : isToday ? t.c.accent : t.c.ink, fontSize: F.lg, fontWeight: "700" }}>{dayNum(d)}</Text>
            <View style={{ height: 6 }}>
              {n ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? t.c.onAccent : t.c.crit }} /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Idag() {
  const { s, edit, migId, session, nat } = useStore();
  const ledare = useLedare();
  const open = useSheet();
  const [date, setDate] = useState(today());
  const js = jobsOn(s, date).slice().sort((a, b) => shortage(s, b) - shortage(s, a));
  const gaps = luckor(s, date);
  const tot = gaps.reduce((a, j) => a + shortage(s, j), 0);
  const fr = free(s, date);
  const aw = s.people.filter(p => out(p, date));
  const un = unread(s);

  const satt = (j: Job, pid: string) => edit(tillsattText(s, j.id, pid), d => tillsatt(d, j.id, pid));

  /* Ett tryck när svaret är självklart, ett val när det inte är det.
     Knappen säger vad som händer, inte vad den heter. */
  const fyllKnapp = (j: Job) => {
    const kandidater = forslag(s, j);
    if (kandidater.length === 1)
      return <Btn title={"Sätt in " + kandidater[0].name} kind="pri" onPress={() => satt(j, kandidater[0].id)} />;
    if (kandidater.length > 1)
      return <Btn title="Välj ersättare" kind="pri" onPress={() => open({ t: "replace", id: j.id })} />;
    return <Btn title="Flytta jobbet" onPress={() => open({ t: "job", id: j.id })} />;
  };

  return (
    <Screen
      title={date === today() ? "Idag" : nice(date)}
      subtitle={longDate(date) + " · vecka " + weekNo(date)}
      right={ledare ? <Btn title="Nytt jobb" kind="pri" onPress={() => open({ t: "job", date })} />
        : <Badge>Du ser firmans plan</Badge>}>
      <WeekStrip date={date} onPick={setDate} />
      <Stats items={[
        { label: "Jobb", value: js.length, sub: js.length ? js.reduce((a, j) => a + j.need, 0) + " platser" : "" },
        { label: "Saknas", value: tot, tone: tot ? "crit" : undefined, sub: tot ? gaps.map(j => cname(s, j)).join(", ") : "Fullt bemannat" },
        { label: "Lediga", value: fr.length, sub: fr.map(p => p.name).join(", ") },
        { label: "Borta", value: aw.length, sub: aw.map(p => p.name).join(", ") },
        { label: "Olästa sms", value: un.length },
      ]} />

      <Pad>
        {/* Utan kontakt fortsätter allt att fungera, men den som planerar ska
            veta att de andra inte ser det än. */}
        {session && nat === "offline" ? (
          <Alert tone="warn">
            <T k="strong" tone="warn">Ingen kontakt med firmans server</T>
            <T k="sub">Det du ändrar sparas här och skickas när nätet är tillbaka.</T>
          </Alert>
        ) : null}
        {/* Den som är inloggad som sig själv vill först veta sin egen dag.
            Arbetsledaren vill veta firmans. Därför ligger den här överst, men
            bara när appen vet vem som håller i telefonen. */}
        {migId ? (() => {
          const jag = s.people.find(p => p.id === migId);
          if (!jag) return null;
          const mitt = jobsOf(s, jag.id, date);
          const borta = out(jag, date);
          return (
            <Card title="Din dag">
              {borta ? (
                <Row right={<Btn title="Jag är tillbaka" onPress={() => edit(jag.name + " är tillbaka", d => tillbaka(d, jag.id))} />}>
                  <T k="strong">{jag.away!.type}{jag.away!.to ? " t.o.m. " + nice(jag.away!.to) : " tills vidare"}</T>
                  <T k="sub">Arbetsledaren ser det och kan sätta in någon annan.</T>
                </Row>
              ) : mitt.length ? mitt.map((j, i) => {
                const c = s.customers.find(x => x.id === j.customerId);
                return (
                  <Row key={j.id} last={i === mitt.length - 1}>
                    <T k="strong">{cname(s, j)}</T>
                    <T k="sub">{j.title}{c?.address ? " · " + c.address : ""}</T>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.x1, marginTop: 2 }}>
                      {j.people.filter(id => id !== jag.id).map(id => {
                        const kollega = s.people.find(x => x.id === id);
                        return kollega ? <Badge key={id}>{"Med " + kollega.name}</Badge> : null;
                      })}
                    </View>
                    {c?.phone ? <Tel phone={c.phone} label={"Ring " + (c.contact || c.name)} /> : null}
                  </Row>
                );
              }) : (
                <Row right={<Btn title="Sjukanmäl mig" onPress={() => edit(jag.name + " sjukanmäld från idag", d => sjukIdag(d, jag.id))} />}>
                  <T k="strong">Inget inbokat på dig</T>
                  <T k="sub">Hör av dig till arbetsledaren om du står utan jobb.</T>
                </Row>
              )}
            </Card>
          );
        })() : null}
        {/* Luckorna först, med knappen bredvid. Det ska inte gå att läsa om
            problemet utan att se lösningen. */}
        {tot ? (
          <Card title={tot === 1 ? "En lucka att fylla" : tot + " luckor att fylla"}>
            {gaps.map((j, i) => {
              const kandidater = forslag(s, j);
              return (
                <Row key={j.id} last={i === gaps.length - 1} right={ledare ? fyllKnapp(j) : undefined}>
                  <T k="strong">{cname(s, j)}</T>
                  <T k="sub">{j.title} · saknas {shortage(s, j)}</T>
                  <T k="sub">
                    {kandidater.length === 0
                      ? "Ingen är ledig. Flytta jobbet eller sänk antalet."
                      : kandidater.length === 1
                        ? kandidater[0].name + " är ledig och har minst pass den här veckan."
                        : "Lediga: " + kandidater.map(p => p.name).join(", ")}
                  </T>
                </Row>
              );
            })}
          </Card>
        ) : fr.length && workday(date) && js.length ? (
          <Alert tone="warn">
            <T k="strong" tone="warn">Utan jobb: {fr.map(p => p.name).join(", ")}</T>
            <T k="sub">Boka in en kund som väntar, under Register.</T>
          </Alert>
        ) : js.length ? (
          <Alert tone="ok"><T k="strong" tone="ok">Allt bemannat</T><T k="sub">Inget kräver dig just nu.</T></Alert>
        ) : null}

        <Card title={"Jobb  " + js.length}>
          {js.length ? js.map((j, i) => {
            const n = shortage(s, j);
            const c = s.customers.find(x => x.id === j.customerId);
            return (
              <Row key={j.id} last={i === js.length - 1} onPress={ledare ? () => open({ t: "job", id: j.id }) : undefined}
                right={n ? <Badge tone="crit">{"Saknas " + n}</Badge> : <Badge tone="ok">Bemannat</Badge>}>
                <T k="strong">{cname(s, j)}</T>
                <T k="sub">{j.title}{c?.address ? " · " + c.address : ""}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: S.x1, marginTop: 2 }}>
                  {j.people.map(id => {
                    const p = s.people.find(x => x.id === id);
                    if (!p) return null;
                    return out(p, j.date)
                      ? <Badge key={id} tone="warn" strike>{p.name + " · " + p.away!.type.toLowerCase()}</Badge>
                      : <Badge key={id}>{p.name}</Badge>;
                  })}
                </View>
                {c?.phone ? <Tel phone={c.phone} label={"Ring " + (c.contact || c.name)} /> : null}
              </Row>
            );
          }) : (
            <Empty action={ledare ? <Btn title="Boka in ett jobb" kind="pri" onPress={() => open({ t: "job", date })} /> : undefined}>
              Inga jobb den här dagen.
            </Empty>
          )}
        </Card>

        <Card title={"Personal  " + s.people.length}>
          {s.people.map((p, i) => {
            const away = out(p, date);
            const mine = jobsOf(s, p.id, date);
            return (
              <Row key={p.id} last={i === s.people.length - 1}
                onPress={ledare ? () => open({ t: "person", id: p.id }) : undefined}
                right={!(ledare || p.id === migId) ? undefined : away
                  ? <Btn title="Tillbaka" onPress={() => edit(p.name + " är tillbaka", d => tillbaka(d, p.id))} />
                  : (
                    <View style={{ flexDirection: "row", gap: S.x1 }}>
                      <Btn title="Sjuk idag" onPress={() => edit(p.name + " sjukanmäld från idag", d => sjukIdag(d, p.id))} />
                      <Btn title="···" onPress={() => open({ t: "absence", id: p.id, date })} />
                    </View>
                  )}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: S.x2 }}>
                  <Avatar name={p.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T k="strong">{p.name}</T>
                    {away ? <Badge tone="crit">{p.away!.type + (p.away!.to ? " t.o.m. " + nice(p.away!.to) : " tills vidare")}</Badge>
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
