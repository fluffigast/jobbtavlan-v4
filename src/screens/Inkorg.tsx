import React, { useState } from "react";
import { View } from "react-native";
import { useStore } from "../store";
import { Screen, Pad } from "../ui/Screen";
import { Badge, Btn, Card, Empty, Row, Segmented, T, Tel } from "../ui/kit";
import { useSheet } from "../sheets/Sheets";
import { S } from "../theme";
import { avsandare, unread, who } from "../domain/logic";

/* Appen läser inte telefonens sms själv: iOS tillåter det inte alls, och på
   Android kräver det SMS-behörighet som Google bara släpper igenom för appar
   vars huvudsyfte är meddelanden. Därför skrivs de in för hand, som i v3.
   Formuläret ligger i ett ark bakom en knapp i titelraden: inkorgen finns för
   det som kommit in, och på en telefon fyllde formuläret hela första skärmen. */
export function Inkorg() {
  const { s, kor } = useStore();
  const open = useSheet();
  const [tab, setTab] = useState("sms");

  const sms = s.sms.slice().sort((a, b) => Number(a.done) - Number(b.done) || (a.ts < b.ts ? 1 : -1));
  const inc = s.incidents.slice().sort((a, b) => Number(a.done) - Number(b.done) || (a.ts < b.ts ? 1 : -1));
  const openInc = inc.filter(i => !i.done).length;

  return (
    <Screen title="Inkorg"
      subtitle={unread(s).length + (unread(s).length === 1 ? " oläst sms · " : " olästa sms · ") +
        openInc + (openInc === 1 ? " öppen rapport" : " öppna rapporter")}
      right={tab === "sms"
        ? <Btn title="Nytt sms" kind="pri" onPress={() => open({ t: "sms" })} />
        : <Btn title="Rapportera" kind="pri" onPress={() => open({ t: "rapport" })} />}>
      <Pad gap={S.x3}>
        <Segmented value={tab} onChange={setTab}
          options={[{ key: "sms", label: "Sms", n: unread(s).length }, { key: "rapport", label: "Rapporter", n: openInc }]} />

        {tab === "sms" ? (
          <>
            <Card>
              {sms.length ? sms.map((m, i) => {
                const w = who(s, m.from);
                return (
                  <Row key={m.id} last={i === sms.length - 1}
                    right={m.done ? <Badge tone="ok">Klart</Badge>
                      : <Btn title="Klart" onPress={() => kor({ typ: "sms-klart", id: m.id, done: true })} />}>
                    {w ? <T k="strong">{w}</T> : <Badge tone="warn">Okänt nummer</Badge>}
                    <T k="sub">{m.text}</T>
                    {/* Ett sms är sällan bara text. Det är en kund som vill boka,
                        eller någon som inte kommer. Handlingen hör till meddelandet. */}
                    <View style={{ flexDirection: "row", gap: S.x2, alignItems: "center", flexWrap: "wrap" }}>
                      <T k="mono" style={{ opacity: 0.6 }}>{m.ts}</T>
                      <Tel phone={m.from} label={w ? "Ring tillbaka" : "Ring numret"} />
                      {(() => {
                        const a = avsandare(s, m.from);
                        if (a.typ === "kund") return <Btn title={"Boka in " + a.kund.name} onPress={() => open({ t: "job", cid: a.kund.id })} />;
                        if (a.typ === "person") return <Btn title={"Sjukanmäl " + a.person.name} onPress={() => open({ t: "absence", id: a.person.id })} />;
                        return <Btn title="Lägg upp som kund" onPress={() => open({ t: "cust", phone: m.from })} />;
                      })()}
                    </View>
                  </Row>
                );
              }) : <Empty action={<Btn title="Nytt sms" kind="pri" onPress={() => open({ t: "sms" })} />}>Inga sms inlagda. Skriv in det du fått.</Empty>}
            </Card>
          </>
        ) : (
          <>
            <Card>
              {inc.length ? inc.map((i, n) => (
                <Row key={i.id} last={n === inc.length - 1}
                  right={i.done ? <Badge tone="ok">Hanterat</Badge>
                    : <Btn title="Hanterat" onPress={() => kor({ typ: "rapport-klar", id: i.id, done: true })} />}>
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
