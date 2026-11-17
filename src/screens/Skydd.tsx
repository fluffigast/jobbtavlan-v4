import React, { useState } from "react";
import { Alert as RNAlert, View } from "react-native";
import { useStore, useLedare } from "../store";
import { Screen, Pad } from "../ui/Screen";
import { Badge, Btn, Card, Empty, Field, Row, T, useT } from "../ui/kit";
import { S, F } from "../theme";
import { secItems } from "../domain/logic";
import { ROLLNAMN } from "../domain/roles";

export function Skydd() {
  const { s, edit, reset } = useStore();
  const ledare = useLedare();
  const t = useT();
  const items = secItems(s).slice().sort((a, b) => Number(a.done) - Number(b.done));
  const done = items.filter(i => i.done).length;
  const log = (s.log || []).slice(0, 12);

  return (
    <Screen title="Skydd" subtitle={done + " av " + items.length + " grundskydd klara"}>
      <Pad>
        <Card>
          <View style={{ padding: S.x4, gap: S.x2 }}>
            <T k="strong">{done} av {items.length} klara</T>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.c.hover, overflow: "hidden" }}>
              <View style={{ width: ((done / items.length) * 100) + "%", height: "100%", backgroundColor: t.c.ok }} />
            </View>
          </View>
        </Card>

        <Card title="Grundskydd">
          {items.map((i, n) => (
            <Row key={i.id} last={n === items.length - 1}
              right={i.auto ? <Badge>Räknas av sig själv</Badge>
                : ledare ? <Btn title={i.done ? "Ångra" : "Klart"}
                    onPress={() => edit("Grundskydd " + (i.done ? "öppnat igen" : "klart") + ": " + i.text,
                      d => { const x = d.security.find(y => y.id === i.id)!; x.done = !x.done; })} />
                : null}>
              {i.done ? <Badge tone="ok">Klart</Badge> : <Badge tone="crit">Öppen</Badge>}
              <T>{i.text}</T>
              {i.sub ? <T k="sub">{i.sub}</T> : null}
            </Row>
          ))}
        </Card>

        <DeladPlan />

        <Card title="Händelser">
          {log.length ? log.map((l, i) => (
            <Row key={i} last={i === log.length - 1}>
              <T k="sub">{l.text}</T>
              <T k="mono" style={{ opacity: 0.6 }}>{l.ts}</T>
            </Row>
          )) : <Empty>Inget ändrat ännu.</Empty>}
        </Card>

        <Card title="Om demot">
          <View style={{ padding: S.x4, gap: S.x3 }}>
            <T k="sub">
              Allt innehåll är påhittat ({s.firm}). Händelselistan är en hjälp för minnet,
              inte en granskningslogg som går att lita på i efterhand.
            </T>
            <Btn title="Återställ demodata" kind="danger"
              onPress={() => RNAlert.alert("Återställ demodata?", "Allt du ändrat i demot försvinner.",
                [{ text: "Avbryt", style: "cancel" }, { text: "Återställ", style: "destructive", onPress: reset }])} />
          </View>
        </Card>
      </Pad>
    </Screen>
  );
}

/* Utan server ligger planen i den här telefonen och ingen annanstans. Det ska
   stå rakt ut, och vägen till en delad plan ska ligga bredvid påståendet. */
function DeladPlan() {
  const { session, nat, login, logout } = useStore();
  const [bas, setBas] = useState("http://localhost:8080");
  const [namn, setNamn] = useState("");
  const [pin, setPin] = useState("");
  const [fel, setFel] = useState<string | null>(null);
  const [vantar, setVantar] = useState(false);

  if (session) {
    const lage = nat === "synkat" ? "Allt sparat hos firman"
      : nat === "synkar" ? "Sparar…"
      : "Ingen kontakt just nu, ändringar ligger kvar här";
    return (
      <Card title="Delad plan">
        <Row right={<Btn title="Logga ut" onPress={logout} />}>
          <T k="strong">{session.namn} · {ROLLNAMN[session.roll]}</T>
          <T k="sub">{session.bas}</T>
          <Badge tone={nat === "offline" ? "warn" : "ok"}>{lage}</Badge>
        </Row>
      </Card>
    );
  }

  return (
    <Card title="Delad plan">
      <View style={{ padding: S.x4, gap: S.x3 }}>
        <T k="sub">
          Just nu ligger planen bara i den här telefonen. Logga in på firmans server
          för att se samma plan som alla andra, och för att din sjukanmälan ska nå arbetsledaren.
        </T>
        <Field label="Serveradress" value={bas} onChange={setBas} placeholder="https://plan.firman.se" />
        <View style={{ flexDirection: "row", gap: S.x3 }}>
          <Field label="Ditt namn" value={namn} onChange={setNamn} placeholder="erik" />
          <Field label="Pinkod" value={pin} onChange={setPin} keyboardType="number-pad" />
        </View>
        {fel ? <T tone="crit">{fel}</T> : null}
        <Btn title={vantar ? "Loggar in…" : "Logga in"} kind="pri" disabled={vantar || !namn.trim() || !pin}
          onPress={async () => {
            setVantar(true); setFel(null);
            const svar = await login(bas, namn, pin);
            setVantar(false);
            if (!svar.ok) setFel(svar.fel || "Kunde inte logga in.");
            else { setNamn(""); setPin(""); }
          }} />
      </View>
    </Card>
  );
}
