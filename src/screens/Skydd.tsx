import React from "react";
import { Alert as RNAlert, View } from "react-native";
import { useStore } from "../store";
import { Screen, Pad } from "../ui/Screen";
import { Badge, Btn, Card, Empty, Row, T, useT } from "../ui/kit";
import { S, F } from "../theme";
import { secItems } from "../domain/logic";

export function Skydd() {
  const { s, edit, reset } = useStore();
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
                : <Btn title={i.done ? "Ångra" : "Klart"}
                    onPress={() => edit("Grundskydd " + (i.done ? "öppnat igen" : "klart") + ": " + i.text,
                      d => { const x = d.security.find(y => y.id === i.id)!; x.done = !x.done; })} />}>
              {i.done ? <Badge tone="ok">Klart</Badge> : <Badge tone="crit">Öppen</Badge>}
              <T>{i.text}</T>
              {i.sub ? <T k="sub">{i.sub}</T> : null}
            </Row>
          ))}
        </Card>

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
              Allt innehåll är påhittat ({s.firm}). Ändringar sparas bara på den här telefonen,
              ingen inloggning och ingen server. Händelselistan är en hjälp för minnet,
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
