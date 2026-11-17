import React, { useState } from "react";
import { View } from "react-native";
import { useStore } from "../store";
import { Screen, Pad } from "../ui/Screen";
import { Badge, Btn, Card, Choice, Empty, Field, Row, Segmented, T, Tel } from "../ui/kit";
import { useSheet } from "../sheets/Sheets";
import { S } from "../theme";
import { stamp, uid } from "../domain/dates";
import { unread, who } from "../domain/logic";

/* Appen läser inte telefonens sms själv: iOS tillåter det inte alls, och på
   Android kräver det SMS-behörighet som Google bara släpper igenom för appar
   vars huvudsyfte är meddelanden. Därför skrivs de in för hand, som i v3. */
export function Inkorg() {
  const { s, edit } = useStore();
  const open = useSheet();
  const [tab, setTab] = useState("sms");
  const [from, setFrom] = useState("");
  const [text, setText] = useState("");
  const [incWho, setIncWho] = useState(s.people[0]?.name || "");
  const [incText, setIncText] = useState("");

  const sms = s.sms.slice().sort((a, b) => Number(a.done) - Number(b.done) || (a.ts < b.ts ? 1 : -1));
  const inc = s.incidents.slice().sort((a, b) => Number(a.done) - Number(b.done) || (a.ts < b.ts ? 1 : -1));
  const openInc = inc.filter(i => !i.done).length;

  return (
    <Screen title="Inkorg"
      subtitle={unread(s).length + (unread(s).length === 1 ? " oläst sms · " : " olästa sms · ") +
        openInc + (openInc === 1 ? " öppen rapport" : " öppna rapporter")}>
      <Pad gap={S.x3}>
        <Segmented value={tab} onChange={setTab}
          options={[{ key: "sms", label: "Sms", n: unread(s).length }, { key: "rapport", label: "Rapporter", n: openInc }]} />

        {tab === "sms" ? (
          <>
            <Card title="Lägg in inkommande sms">
              <View style={{ padding: S.x4, gap: S.x3 }}>
                <Field label="Från nummer" value={from} onChange={setFrom} keyboardType="phone-pad" placeholder="070-555 02 01" />
                <Field label="Meddelande" value={text} onChange={setText} multiline />
                <Btn title="Lägg till" kind="pri" disabled={!from.trim() || !text.trim()}
                  onPress={() => {
                    edit("Sms inlagt från " + from, d => {
                      d.sms.push({ id: uid(), ts: stamp(), from: from.trim(), text: text.trim(), done: false });
                    });
                    setFrom(""); setText("");
                  }} />
              </View>
            </Card>
            <Card>
              {sms.length ? sms.map((m, i) => {
                const w = who(s, m.from);
                return (
                  <Row key={m.id} last={i === sms.length - 1}
                    right={m.done ? <Badge tone="ok">Klart</Badge>
                      : <Btn title="Klart" onPress={() => edit("Sms markerat som klart", d => { d.sms.find(x => x.id === m.id)!.done = true; })} />}>
                    {w ? <T k="strong">{w}</T> : <Badge tone="warn">Okänt nummer</Badge>}
                    <T k="sub">{m.text}</T>
                    <View style={{ flexDirection: "row", gap: S.x2, alignItems: "center", flexWrap: "wrap" }}>
                      <T k="mono" style={{ opacity: 0.6 }}>{m.ts}</T>
                      <Tel phone={m.from} label={w ? "Ring tillbaka" : "Ring numret"} />
                      {w ? null : <Btn title="Lägg upp som kund" onPress={() => open({ t: "cust", phone: m.from })} />}
                    </View>
                  </Row>
                );
              }) : <Empty>Inga sms inlagda. Skriv in det du fått i formuläret ovanför.</Empty>}
            </Card>
          </>
        ) : (
          <>
            <Card title="Rapportera konstigt mejl, sms eller samtal">
              <View style={{ padding: S.x4, gap: S.x3 }}>
                <Choice label="Vem" value={incWho} onChange={setIncWho} scroll
                  options={s.people.map(p => ({ key: p.name, label: p.name }))} />
                <Field label="Vad hände" value={incText} onChange={setIncText} multiline
                  placeholder="Sms om obetald faktura med länk" />
                <Btn title="Rapportera" kind="pri" disabled={!incText.trim()}
                  onPress={() => {
                    edit(incWho + " rapporterade: " + incText.trim(), d => {
                      d.incidents.push({ id: uid(), ts: stamp(), who: incWho, text: incText.trim(), done: false });
                    });
                    setIncText("");
                  }} />
              </View>
            </Card>
            <Card>
              {inc.length ? inc.map((i, n) => (
                <Row key={i.id} last={n === inc.length - 1}
                  right={i.done ? <Badge tone="ok">Hanterat</Badge>
                    : <Btn title="Hanterat" onPress={() => edit("Rapport markerad som hanterad", d => { d.incidents.find(x => x.id === i.id)!.done = true; })} />}>
                  <T k="strong">{i.who}</T>
                  <T k="sub">{i.text}</T>
                  <T k="mono" style={{ opacity: 0.6 }}>{i.ts}</T>
                </Row>
              )) : <Empty>Inget rapporterat. Det är ett gott tecken, men påminn gärna om att det är bättre att fråga en gång för mycket.</Empty>}
            </Card>
          </>
        )}
      </Pad>
    </Screen>
  );
}
