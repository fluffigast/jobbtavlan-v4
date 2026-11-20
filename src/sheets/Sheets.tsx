import React, { createContext, useContext, useMemo, useState } from "react";
import { Platform, ScrollView, View, Pressable, Text } from "react-native";
import { useStore } from "../store";
import { useT, Sheet, Field, Choice, Check, Btn, T, Badge, Row, Empty } from "../ui/kit";
import { S, F } from "../theme";
import { add, monday, nice, niceAr, today, uid, dayShort, dayNum } from "../domain/dates";
import { C, P, cname, jobsOf, out, shortage, onSite } from "../domain/logic";
import { ROLLNAMN } from "../domain/roles";
import { BYGGE } from "../bygge";
import { forslag, medInsatt, omAr, vardagar } from "../domain/actions";
import { Job } from "../domain/types";

export type SheetSpec =
  | { t: "job"; id?: string; date?: string; cid?: string; pid?: string }
  | { t: "absence"; id: string; date?: string }
  | { t: "cust"; id?: string; phone?: string }
  | { t: "person"; id?: string }
  | { t: "replace"; id: string }
  | { t: "give"; pid: string; date: string }
  | { t: "cert"; id: string; namn: string }
  | { t: "konto" }
  | { t: "sms" }
  | { t: "rapport" }
  | null;

const Ctx = createContext<(s: SheetSpec) => void>(() => {});
export const useSheet = () => useContext(Ctx);

/* Dagväljare: en remsa dagar i stället för en datumsnurra. Jobb planeras
   någon vecka framåt, och då är ett tryck snabbare än tre snurr. */
function DateStrip({ value, onChange, allowNone }:
  { value: string | null; onChange: (d: string | null) => void; allowNone?: boolean }) {
  const t = useT();
  const start = add(today(), -3);
  const days = Array.from({ length: 28 }, (_, i) => add(start, i));
  return (
    <View style={{ gap: S.x1 }}>
      <Text style={{ color: t.c.muted, fontSize: F.xs, fontWeight: "600" }}>Dag</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.x2 }}>
        {allowNone ? (
          <Pressable onPress={() => onChange(null)} accessibilityRole="radio" accessibilityState={{ selected: value === null, checked: value === null }}
            style={{ minHeight: 56, paddingHorizontal: S.x3, borderRadius: S.r, borderWidth: 1, alignItems: "center", justifyContent: "center",
              borderColor: value === null ? t.c.accent : t.c.line, backgroundColor: value === null ? t.c.accent : t.c.surface }}>
            <Text style={{ color: value === null ? t.c.onAccent : t.c.ink, fontSize: F.sm, fontWeight: "600" }}>Tills vidare</Text>
          </Pressable>
        ) : null}
        {days.map(d => {
          const on = d === value, isToday = d === today();
          return (
            <Pressable key={d} onPress={() => onChange(d)} accessibilityRole="radio" accessibilityLabel={nice(d)}
              accessibilityState={{ selected: on, checked: on }}
              style={{ width: 52, minHeight: 56, borderRadius: S.r, borderWidth: 1, alignItems: "center", justifyContent: "center",
                borderColor: on ? t.c.accent : t.c.line, backgroundColor: on ? t.c.accent : t.c.surface }}>
              <Text style={{ color: on ? t.c.onAccent : t.c.muted, fontSize: F.xs }}>{dayShort(d)}</Text>
              <Text style={{ color: on ? t.c.onAccent : isToday ? t.c.accent : t.c.ink, fontSize: F.lg, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{dayNum(d)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Stepper({ label, value, onChange, min = 1, max = 9 }:
  { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const t = useT();
  const btn = (txt: string, d: number, off: boolean) => (
    <Pressable disabled={off} onPress={() => onChange(Math.min(max, Math.max(min, value + d)))}
      accessibilityRole="button" accessibilityLabel={d < 0 ? "Färre" : "Fler"}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: off ? 0.3 : 1 }}>
      <Text style={{ color: t.c.ink, fontSize: F.xl, fontWeight: "600" }}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: S.x1 }}>
      <Text style={{ color: t.c.muted, fontSize: F.xs, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
        borderWidth: 1, borderColor: t.c.line, borderRadius: S.r, backgroundColor: t.c.surface }}>
        {btn("−", -1, value <= min)}
        <Text accessibilityLabel={label + ": " + value} style={{ color: t.c.ink, fontSize: F.lg, fontWeight: "700", minWidth: 32, textAlign: "center", fontVariant: ["tabular-nums"] }}>{value}</Text>
        {btn("+", 1, value >= max)}
      </View>
    </View>
  );
}

export function SheetHost({ children }: { children: React.ReactNode }) {
  const [spec, setSpec] = useState<SheetSpec>(null);
  const open = useMemo(() => (s: SheetSpec) => setSpec(s), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {spec ? <Body spec={spec} close={() => setSpec(null)} /> : null}
    </Ctx.Provider>
  );
}

function Body({ spec, close }: { spec: NonNullable<SheetSpec>; close: () => void }) {
  if (spec.t === "job") return <JobSheet spec={spec} close={close} />;
  if (spec.t === "absence") return <AbsenceSheet spec={spec} close={close} />;
  if (spec.t === "cust") return <CustSheet spec={spec} close={close} />;
  if (spec.t === "person") return <PersonSheet spec={spec} close={close} />;
  if (spec.t === "replace") return <ReplaceSheet spec={spec} close={close} />;
  if (spec.t === "cert") return <CertSheet spec={spec} close={close} />;
  if (spec.t === "konto") return <KontoSheet close={close} />;
  if (spec.t === "sms") return <SmsSheet close={close} />;
  if (spec.t === "rapport") return <RapportSheet close={close} />;
  return <GiveSheet spec={spec} close={close} />;
}

function JobSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "job" }>; close: () => void }) {
  const { s, kor } = useStore();
  const thJob = useT();
  const existing = spec.id ? s.jobs.find(j => j.id === spec.id) : undefined;
  const [date, setDate] = useState(existing?.date || spec.date || today());
  const [cid, setCid] = useState(existing?.customerId || spec.cid || "");
  const [title, setTitle] = useState(existing?.title || "");
  const [need, setNeed] = useState(existing?.need || 2);
  const [people, setPeople] = useState<string[]>(existing?.people || (spec.pid ? [spec.pid] : []));
  const picks = s.customers.filter(c => c.status !== "Klart" || c.id === cid);
  const rang = (p: typeof s.people[number]) =>
    out(p, date) ? 2 : jobsOf(s, p.id, date).some(j => j.id !== spec.id) ? 1 : 0;
  const ordnade = s.people.slice().sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, "sv"));
  const lediga = ordnade.filter(p => rang(p) === 0);

  const save = () => {
    if (!cid || !title.trim()) return;
    const jobb = { date, customerId: cid, title: title.trim(), need, people };
    kor(spec.id ? { typ: "jobb-andra", id: spec.id, jobb } : { typ: "jobb-ny", id: uid(), jobb });
    close();
  };
  const del = () => {
    if (spec.id) kor({ typ: "jobb-bort", id: spec.id });
    close();
  };

  return (
    <Sheet open title={spec.id ? "Ändra jobb" : "Nytt jobb"} onClose={close}
      footer={<>
        {spec.id ? <Btn title="Ta bort" kind="danger" onPress={del} /> : null}
        <Btn title="Spara" kind="pri" onPress={save} disabled={!cid || !title.trim()} style={{ flex: 1 }} />
      </>}>
      <DateStrip value={date} onChange={d => setDate(d || today())} />
      <Choice label="Kund" value={cid} onChange={setCid} scroll
        options={picks.map(c => ({ key: c.id, label: c.name }))} />
      <Field label="Vad ska göras" value={title} onChange={setTitle} placeholder="Gjuta plintar" />
      <Stepper label="Antal som behövs" value={need} onChange={setNeed} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: S.x2 }}>
        <Text style={{ color: thJob.c.muted, fontSize: F.xs, fontWeight: "600", flex: 1 }}>
          VILKA ÅKER · {people.length} av {need}
        </Text>
        {lediga.length ? (
          <Btn title={"Föreslå " + Math.min(need, lediga.length)}
            onPress={() => setPeople(lediga.slice(0, need).map(p => p.id))} />
        ) : null}
      </View>
      {/* Lediga först: den som bockar i ska inte behöva leta förbi de upptagna. */}
      <View style={{ gap: S.x2 }}>
        {ordnade.map(p => {
          const away = out(p, date);
          const busy = jobsOf(s, p.id, date).some(j => j.id !== spec.id);
          return (
            <Check key={p.id} value={people.indexOf(p.id) >= 0}
              onChange={v => setPeople(v ? [...people, p.id] : people.filter(x => x !== p.id))}
              label={p.name + (away ? "  · " + p.away!.type.toLowerCase() : busy ? "  · upptagen" : "  · ledig")} />
          );
        })}
      </View>
    </Sheet>
  );
}

function AbsenceSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "absence" }>; close: () => void }) {
  const { s, kor } = useStore();
  const th = useT();
  const p = P(s, spec.id)!;
  const [type, setType] = useState(p.away?.type || "Sjuk");
  const [from, setFrom] = useState(p.away?.from || spec.date || today());
  const [to, setTo] = useState<string | null>(p.away?.to ?? null);

  const spara = (typ: string, f: string, tt: string | null) => {
    kor({ typ: "franvaro", personId: spec.id, away: { type: typ, from: f, to: tt } });
    close();
  };
  const fredag = add(monday(spec.date || today()), 4);

  /* De tre vanligaste fallen är ett tryck. Allt annat ställs in under. */
  const snabb = p.away ? null : (
    <View style={{ gap: S.x2 }}>
      <Text style={{ color: th.c.muted, fontSize: F.xs, fontWeight: "600" }}>VANLIGAST</Text>
      <Btn title="Sjuk idag, tills vidare" kind="pri"
        onPress={() => spara("Sjuk", today(), null)} />
      <Btn title={"Sjuk resten av veckan, t.o.m. " + nice(fredag)}
        onPress={() => spara("Sjuk", today(), fredag)} />
      <Btn title="VAB idag, tills vidare"
        onPress={() => spara("VAB", today(), null)} />
    </View>
  );

  return (
    <Sheet open title={"Frånvaro: " + p.name} onClose={close}
      footer={
        <>
          {p.away ? <Btn title="Ta bort frånvaro" kind="danger"
            onPress={() => { kor({ typ: "franvaro-bort", personId: spec.id }); close(); }} /> : null}
          <Btn title="Spara" kind="pri" style={{ flex: 1 }} onPress={() => spara(type, from, to)} />
        </>
      }>
      {snabb}
      <Choice label="Orsak" value={type} onChange={setType}
        options={[{ key: "Sjuk", label: "Sjuk" }, { key: "Semester", label: "Semester" }, { key: "VAB", label: "VAB" }]} />
      <DateStrip value={from} onChange={d => setFrom(d || today())} />
      <Text style={{ color: th.c.muted, fontSize: F.xs, fontWeight: "600" }}>TILL OCH MED</Text>
      <DateStrip value={to} onChange={setTo} allowNone />
      {type === "Semester" ? (
        <T k="sub">
          {to
            ? vardagar(from, to) + " semesterdagar dras. " +
              (p.vacLeft == null ? "" : "Kvar efter: " + (p.vacLeft + (p.away?.dragna || 0) - vardagar(from, to)) + ".")
            : "Utan slutdatum dras inga dagar förrän du sätter ett."}
        </T>
      ) : null}
    </Sheet>
  );
}

function CustSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "cust" }>; close: () => void }) {
  const { s, kor } = useStore();
  const k = spec.id ? C(s, spec.id)! : null;
  const [name, setName] = useState(k?.name || "");
  const [contact, setContact] = useState(k?.contact || "");
  const [phone, setPhone] = useState(k?.phone || spec.phone || "");
  const [address, setAddress] = useState(k?.address || "");
  const [project, setProject] = useState(k?.project || "");
  const [status, setStatus] = useState(k?.status || "Pågår");
  const save = () => {
    if (!name.trim()) return;
    const kund = { name: name.trim(), contact, phone, address, project, status };
    kor(spec.id ? { typ: "kund-andra", id: spec.id, kund } : { typ: "kund-ny", id: uid(), kund });
    close();
  };
  return (
    <Sheet open title={spec.id ? "Ändra kund" : "Ny kund"} onClose={close}
      footer={<Btn title="Spara" kind="pri" onPress={save} disabled={!name.trim()} style={{ flex: 1 }} />}>
      <Field label="Kund" value={name} onChange={setName} />
      <View style={{ flexDirection: "row", gap: S.x3 }}>
        <Field label="Kontaktperson" value={contact} onChange={setContact} />
        <Field label="Telefon" value={phone} onChange={setPhone} keyboardType="phone-pad" />
      </View>
      <Field label="Adress" value={address} onChange={setAddress} />
      <Field label="Uppdrag" value={project} onChange={setProject} />
      <Choice label="Status" value={status} onChange={setStatus}
        options={[{ key: "Pågår", label: "Pågår" }, { key: "Väntar", label: "Väntar" }, { key: "Klart", label: "Klart" }]} />
    </Sheet>
  );
}

function PersonSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "person" }>; close: () => void }) {
  const { s, kor } = useStore();
  const r = spec.id ? P(s, spec.id)! : null;
  const [name, setName] = useState(r?.name || "");
  const [phone, setPhone] = useState(r?.phone || "");
  const [role, setRole] = useState(r?.role || "");
  const [vac, setVac] = useState(r?.vacLeft == null ? "" : String(r.vacLeft));
  const [mfa, setMfa] = useState(!!r?.mfa);
  const [certs, setCerts] = useState((r?.certs || []).map(c => c.name + ", " + c.expires).join("\n"));
  const save = () => {
    if (!name.trim()) return;
    const person = {
      name: name.trim(), phone, role, since: r?.since || "",
      vacLeft: vac === "" ? null : Number(vac), mfa,
      certs: certs.split("\n").map(l => {
        const m = l.match(/^(.+?),\s*(\d{4}-\d{2}-\d{2})\s*$/);
        return m ? { name: m[1].trim(), expires: m[2] } : null;
      }).filter(Boolean) as { name: string; expires: string }[],
    };
    kor(spec.id ? { typ: "person-andra", id: spec.id, person } : { typ: "person-ny", id: uid(), person });
    close();
  };
  const del = () => {
    if (spec.id) kor({ typ: "person-bort", id: spec.id });
    close();
  };
  return (
    <Sheet open title={spec.id ? "Ändra person" : "Ny person"} onClose={close}
      footer={<>
        {spec.id ? <Btn title="Ta bort" kind="danger" onPress={del} /> : null}
        <Btn title="Spara" kind="pri" onPress={save} disabled={!name.trim()} style={{ flex: 1 }} />
      </>}>
      <View style={{ flexDirection: "row", gap: S.x3 }}>
        <Field label="Namn" value={name} onChange={setName} />
        <Field label="Telefon" value={phone} onChange={setPhone} keyboardType="phone-pad" />
      </View>
      <View style={{ flexDirection: "row", gap: S.x3 }}>
        <Field label="Roll" value={role} onChange={setRole} />
        <Field label="Semesterdagar kvar" value={vac} onChange={setVac} keyboardType="number-pad" />
      </View>
      <Field label="Intyg, ett per rad: namn, giltigt till (ÅÅÅÅ-MM-DD)" value={certs} onChange={setCerts} multiline />
      <Check label="Tvåstegsinloggning på mejlen" value={mfa} onChange={setMfa} />
    </Sheet>
  );
}

function ReplaceSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "replace" }>; close: () => void }) {
  const { s, kor } = useStore();
  const open2 = useSheet();
  const j = s.jobs.find(x => x.id === spec.id)!;
  const kandidater = forslag(s, j);
  const pass = (pid: string) => s.jobs.filter(x => x.people.indexOf(pid) >= 0).length;

  const satt = (pid: string) => {
    kor({ typ: "bemanning", jobbId: j.id, personer: medInsatt(s, j, pid) });
    close();
  };
  const sank = () => {
    kor({ typ: "jobb-andra", id: j.id, jobb: {
      date: j.date, customerId: j.customerId, title: j.title,
      need: Math.max(1, onSite(s, j).length), people: j.people,
    } });
    close();
  };

  return (
    <Sheet open title={"Fyll luckan: " + cname(s, j)} onClose={close}
      footer={<Btn title="Ändra jobbet" onPress={() => open2({ t: "job", id: j.id })} style={{ flex: 1 }} />}>
      <T k="sub">{nice(j.date)} · {j.title} · saknas {shortage(s, j)}</T>
      {kandidater.length ? kandidater.map((p, i) => (
        <Row key={p.id} last={i === kandidater.length - 1}
          right={<Btn title="Sätt in" kind={i === 0 ? "pri" : "plain"} onPress={() => satt(p.id)} />}>
          <T k="strong">{p.name}</T>
          <T k="sub">{(p.role || "Ledig")} · {pass(p.id)} pass inbokade</T>
          {i === 0 && kandidater.length > 1 ? <Badge tone="ok">Föreslås, har minst pass</Badge> : null}
        </Row>
      )) : (
        <>
          <T>Ingen är ledig den dagen.</T>
          <T k="sub">Antingen flyttar du jobbet, eller så klarar det sig med dem som redan är på plats.</T>
          <Btn title={"Sänk till " + Math.max(1, onSite(s, j).length) + " personer"} onPress={sank} />
        </>
      )}
    </Sheet>
  );
}

function GiveSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "give" }>; close: () => void }) {
  const { s, kor } = useStore();
  const open2 = useSheet();
  const p = P(s, spec.pid)!;
  const js = s.jobs.filter(j => j.date === spec.date).sort((a, b) => shortage(s, b) - shortage(s, a));
  const assign = (j: Job) => {
    kor({ typ: "bemanning", jobbId: j.id, personer: medInsatt(s, j, p.id) });
    close();
  };
  return (
    <Sheet open title={p.name + " · " + nice(spec.date)} onClose={close}
      footer={<Btn title="Nytt jobb" onPress={() => open2({ t: "job", date: spec.date, pid: p.id })} style={{ flex: 1 }} />}>
      {js.length ? js.map(j => {
        const n = shortage(s, j);
        return (
          <Row key={j.id} right={<Btn title="Lägg till" kind={n ? "pri" : "plain"} onPress={() => assign(j)} />}>
            <T k="strong">{cname(s, j)}</T>
            <T k="sub">{j.title}</T>
            {n ? <Badge tone="crit">{"Saknas " + n}</Badge> : null}
          </Row>
        );
      }) : <Empty>Inga jobb den dagen.</Empty>}
    </Sheet>
  );
}


/* Ett intyg förnyas med ett nytt giltighetsdatum. Appen gissar inte hur länge
   ett intyg gäller, för det skiljer sig åt: ID06 är fem år, heta arbeten fem,
   fallskydd ofta ett. Den som förnyar vet, och får välja. */
function CertSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "cert" }>; close: () => void }) {
  const { s, kor } = useStore();
  const p = P(s, spec.id)!;
  const cert = (p.certs || []).find(c => c.name === spec.namn)!;
  const utgick = cert.expires < today();
  const [datum, setDatum] = useState(omAr(utgick ? today() : cert.expires, 1));

  const spara = () => {
    kor({ typ: "intyg", personId: p.id, namn: cert.name, expires: datum });
    close();
  };

  return (
    <Sheet open title={"Förnya " + cert.name} onClose={close}
      footer={<Btn title="Spara" kind="pri" onPress={spara} style={{ flex: 1 }} />}>
      <T k="sub">
        {p.name} · {utgick ? "gick ut " + niceAr(cert.expires) : "giltigt till " + niceAr(cert.expires)}
      </T>
      <Choice label="Giltigt till" value={datum} onChange={setDatum} scroll
        options={[1, 2, 3, 5].map(ar => ({
          key: omAr(utgick ? today() : cert.expires, ar),
          label: "+" + ar + (ar === 1 ? " år" : " år"),
        }))} />
      <T k="sub">Nytt datum: {niceAr(datum)}</T>
    </Sheet>
  );
}


/* Kontot: vem du är, var planen sparas, och vägen mellan demo och firmans
   server. Det hörde aldrig hemma i en checklista över grundskydd. */
function KontoSheet({ close }: { close: () => void }) {
  const { session, nat, login, logout, reset, s } = useStore();
  const th = useT();
  const [bas, setBas] = useState(session?.bas || "http://localhost:8080");
  const [namn, setNamn] = useState("");
  const [pin, setPin] = useState("");
  const [fel, setFel] = useState<string | null>(null);
  const [vantar, setVantar] = useState(false);

  if (session) {
    const lage = nat === "synkat" ? "Allt du ändrar syns hos de andra"
      : nat === "synkar" ? "Skickar…"
      : "Ingen kontakt just nu. Ändringar ligger kvar här tills nätet är tillbaka.";
    return (
      <Sheet open title="Ditt konto" onClose={close}
        footer={<Btn title="Logga ut" kind="danger" onPress={() => { logout(); close(); }} style={{ flex: 1 }} />}>
        <T k="strong">{session.namn} · {ROLLNAMN[session.roll]}</T>
        <Badge tone={nat === "offline" ? "warn" : "ok"}>{lage}</Badge>
        <T k="sub">Planen ligger hos {session.bas}, och delas med alla som loggar in där.</T>
        <Bygge />
        <T k="sub">
          {session.roll === "ledare"
            ? "Som arbetsledare ändrar du planen, kunderna och personalen."
            : "Som snickare ser du planen, sjukanmäler dig själv och rapporterar skumma sms. Resten är arbetsledarens."}
        </T>
      </Sheet>
    );
  }

  return (
    <Sheet open title="Demoläge" onClose={close}
      footer={
        <Btn title={vantar ? "Loggar in…" : "Logga in"} kind="pri" disabled={vantar || !namn.trim() || !pin} style={{ flex: 1 }}
          onPress={async () => {
            setVantar(true); setFel(null);
            const svar = await login(bas, namn, pin);
            setVantar(false);
            if (!svar.ok) setFel(svar.fel || "Kunde inte logga in.");
            else close();
          }} />
      }>
      <T k="strong">Planen ligger bara här</T>
      <T k="sub">
        Allt du ändrar sparas i den här {Platform.OS === "web" ? "webbläsaren" : "telefonen"} och syns inte för någon annan.
        Innehållet är påhittat: {s.firm}.
      </T>
      <View style={{ height: 1, backgroundColor: th.c.line }} />
      <T k="strong">Logga in på firmans plan</T>
      <T k="sub">Då ser alla samma vecka, och din sjukanmälan når arbetsledaren utan ett samtal.</T>
      <Field label="Serveradress" value={bas} onChange={setBas} placeholder="https://plan.firman.se" />
      <View style={{ flexDirection: "row", gap: S.x3 }}>
        <Field label="Ditt namn" value={namn} onChange={setNamn} placeholder="erik" />
        <Field label="Pinkod" value={pin} onChange={setPin} keyboardType="number-pad" secure />
      </View>
      {fel ? <T tone="crit">{fel}</T> : null}
      <View style={{ height: 1, backgroundColor: th.c.line }} />
      <Btn title="Återställ demodata" onPress={() => { reset(); close(); }} />
      <Bygge />
    </Sheet>
  );
}


/* Ett inkommet sms skrivs av för hand, se Inkorg. Arket gör att inkorgen
   börjar med det som kommit in, inte med ett tomt formulär. */
function SmsSheet({ close }: { close: () => void }) {
  const { kor } = useStore();
  const [from, setFrom] = useState("");
  const [text, setText] = useState("");
  const spara = () => {
    kor({ typ: "sms-ny", id: uid(), from: from.trim(), text: text.trim() });
    close();
  };
  return (
    <Sheet open title="Nytt sms" onClose={close}
      footer={<Btn title="Lägg till" kind="pri" disabled={!from.trim() || !text.trim()} onPress={spara} style={{ flex: 1 }} />}>
      <T k="sub">Skriv av det sms som kom till jobbtelefonen. Känt nummer får en knapp som bokar eller sjukanmäler.</T>
      <Field label="Från nummer" value={from} onChange={setFrom} keyboardType="phone-pad" placeholder="070-555 02 01" />
      <Field label="Meddelande" value={text} onChange={setText} multiline placeholder="Hej, när kan ni komma?" />
    </Sheet>
  );
}

function RapportSheet({ close }: { close: () => void }) {
  const { s, kor } = useStore();
  const [who, setWho] = useState(s.people[0]?.name || "");
  const [text, setText] = useState("");
  const spara = () => {
    kor({ typ: "rapport-ny", id: uid(), text: text.trim(), who });
    close();
  };
  return (
    <Sheet open title="Rapportera konstigt mejl, sms eller samtal" onClose={close}
      footer={<Btn title="Rapportera" kind="pri" disabled={!text.trim()} onPress={spara} style={{ flex: 1 }} />}>
      <Choice label="Vem" value={who} onChange={setWho} scroll
        options={s.people.map(p => ({ key: p.name, label: p.name }))} />
      <Field label="Vad hände" value={text} onChange={setText} multiline
        placeholder="Sms om obetald faktura med länk" />
    </Sheet>
  );
}


/* Vilken commit den här sidan är byggd från. Utan den går ett publicerat bygge
   inte att para ihop med källkoden utan att ta någons ord för det. */
function Bygge() {
  if (!BYGGE.tid) return null;
  return <T k="sub">Bygge {BYGGE.commit} · {BYGGE.tid}</T>;
}
