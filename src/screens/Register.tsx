import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useStore } from "../store";
import { useSheet } from "../sheets/Sheets";
import { Screen, Pad } from "../ui/Screen";
import { Avatar, Badge, Btn, Card, Empty, Row, Segmented, T, Tel, useT } from "../ui/kit";
import { S, F } from "../theme";
import { nice, today } from "../domain/dates";
import { certIssues, certState, cname, jobsOf, nextBooked, out, telNyckel } from "../domain/logic";

/* Kunder och personal är två register. På en telefon är det en flik med
   två lägen, inte två flikar: flikraden har plats för fem, och Idag, Vecka,
   Inkorg och Skydd gör alla fyra något annat. */
export function Register() {
  const { s, kor } = useStore();
  const open = useSheet();
  const t = useT();
  const [tab, setTab] = useState("kunder");
  const [q, setQ] = useState("");
  const d = today();

  const traff = (text: string, tel: string | undefined) => {
    if (!q.trim()) return true;
    const n = telNyckel(q);
    return text.toLowerCase().includes(q.toLowerCase().trim()) || (!!n && telNyckel(tel).includes(n));
  };
  const kunder = s.customers
    .filter(c => traff(c.name + " " + (c.contact || "") + " " + (c.project || "") + " " + (c.address || ""), c.phone))
    .slice()
    .sort((a, b) => rank(a.status, nextBooked(s, a.id)) - rank(b.status, nextBooked(s, b.id)));

  const personal = s.people.filter(p => traff(p.name + " " + (p.role || ""), p.phone));
  const iss = certIssues(s);
  const notBooked = s.customers.filter(c => c.status !== "Klart" && !nextBooked(s, c.id)).length;

  return (
    <Screen
      title="Register"
      subtitle={tab === "kunder"
        ? s.customers.length + " kunder · " + notBooked + (notBooked === 1 ? " inte inbokad" : " inte inbokade")
        : s.people.length + " anställda · " + iss.length + (iss.length === 1 ? " intyg att förnya" : " intyg att förnya")}
      right={<Btn title={tab === "kunder" ? "Ny kund" : "Ny person"} kind="pri"
        onPress={() => open(tab === "kunder" ? { t: "cust" } : { t: "person" })} />}>
      <Pad gap={S.x3}>
        <Segmented value={tab} onChange={setTab}
          options={[{ key: "kunder", label: "Kunder" }, { key: "personal", label: "Personal" }]} />
        <TextInput value={q} onChangeText={setQ} placeholder="Sök namn, uppdrag eller telefonnummer" placeholderTextColor={t.c.muted}
          clearButtonMode="while-editing" returnKeyType="search"
          style={{ height: 44, borderWidth: 1, borderColor: t.c.line, borderRadius: S.r,
            paddingHorizontal: S.x3, backgroundColor: t.c.surface, color: t.c.ink, fontSize: F.md }} />

        {tab === "kunder" ? (
          <Card>
            {kunder.length ? kunder.map((c, i) => {
              const n = nextBooked(s, c.id), done = c.status === "Klart";
              return (
                <Row key={c.id} last={i === kunder.length - 1} onPress={() => open({ t: "cust", id: c.id })}
                  right={done ? <Badge tone="ok">Klart</Badge>
                    : <Btn title="Boka in" kind={n ? "plain" : "pri"} onPress={() => open({ t: "job", cid: c.id })} />}>
                  <T k="strong">{c.name}</T>
                  <T k="sub">{[c.project, c.address].filter(Boolean).join(" · ")}</T>
                  <View style={{ flexDirection: "row", gap: S.x2, alignItems: "center", flexWrap: "wrap" }}>
                    {!done ? <Badge tone={c.status === "Väntar" ? "warn" : "plain"}>{c.status}</Badge> : null}
                    {done ? null : n ? <T k="sub">Nästa: {nice(n)}</T> : <Badge tone="crit">Inte inbokad</Badge>}
                  </View>
                  <Tel phone={c.phone} label={"Ring " + (c.contact || c.name)} />
                </Row>
              );
            }) : <Empty action={<Btn title="Ny kund" kind="pri" onPress={() => open({ t: "cust" })} />}>
                   Ingen kund matchar sökningen.
                 </Empty>}
          </Card>
        ) : (
          <Card>
            {personal.length ? personal.map((p, i) => {
              const away = out(p, d);
              const mine = jobsOf(s, p.id, d);
              return (
                <Row key={p.id} last={i === personal.length - 1} onPress={() => open({ t: "person", id: p.id })}
                  right={away
                    ? <Btn title="Tillbaka" onPress={() => kor({ typ: "franvaro-bort", personId: p.id })} />
                    : <Btn title="Frånvaro" onPress={() => open({ t: "absence", id: p.id })} />}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: S.x2 }}>
                    <Avatar name={p.name} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T k="strong">{p.name}</T>
                      <T k="sub">{p.role || ""}</T>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: S.x1, flexWrap: "wrap", marginTop: 2 }}>
                    {away ? <Badge tone="crit">{p.away!.type}</Badge>
                      : mine.length ? <Badge tone="ok">På jobb</Badge> : <Badge tone="warn">Ledig</Badge>}
                    {p.mfa ? null : <Badge tone="crit">Tvåsteg saknas</Badge>}
                    {p.vacLeft != null
                      ? <Badge tone={p.vacLeft < 0 ? "crit" : "plain"}>
                          {p.vacLeft < 0 ? Math.abs(p.vacLeft) + " dagar över" : p.vacLeft + " semesterdagar"}
                        </Badge>
                      : null}
                    {/* Ett intyg som går ut är inget att bara titta på. Trycket förnyar det. */}
                    {(p.certs || []).map(c => {
                      const st = certState(c);
                      if (st === "ok") return null;
                      return (
                        <Pressable key={c.name} onPress={() => open({ t: "cert", id: p.id, namn: c.name })}>
                          <Badge tone={st}>{c.name + (st === "crit" ? " gick ut " : " går ut ") + c.expires + " · förnya"}</Badge>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Tel phone={p.phone} label={"Ring " + p.name} />
                </Row>
              );
            }) : <Empty>Ingen person matchar sökningen.</Empty>}
          </Card>
        )}
      </Pad>
    </Screen>
  );
}

const rank = (status: string, booked: string | null) => (status === "Klart" ? 2 : booked ? 1 : 0);
