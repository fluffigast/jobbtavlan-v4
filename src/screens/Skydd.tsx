import React from "react";
import { View } from "react-native";
import { useStore, useLedare } from "../store";
import { Screen, Pad } from "../ui/Screen";
import { Badge, Btn, Card, Empty, Row, T, useT } from "../ui/kit";
import { S, F } from "../theme";
import { secItems } from "../domain/logic";

export function Skydd() {
  const { s, edit } = useStore();
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

        <Card title="Händelser">
          {log.length ? log.map((l, i) => (
            <Row key={i} last={i === log.length - 1}>
              <T k="sub">{l.text}</T>
              <T k="mono" style={{ opacity: 0.6 }}>{l.ts}{l.by ? " · " + l.by : ""}</T>
            </Row>
          )) : <Empty>Inget ändrat ännu.</Empty>}
          <View style={{ padding: S.x4, paddingTop: 0 }}>
            <T k="sub">
              Listan är ett minnesstöd för firman, inte en granskningslogg som håller i efterhand.
              Den går att ändra av den som kan ändra planen.
            </T>
          </View>
        </Card>

      </Pad>
    </Screen>
  );
}
