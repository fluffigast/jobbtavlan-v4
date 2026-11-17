import React, { createContext, useContext, useMemo, useState } from "react";
import { ScrollView, View, Pressable, Text } from "react-native";
import { useStore } from "../store";
import { useT, Sheet, Field, Choice, Check, Btn, T, Badge, Row, Empty } from "../ui/kit";
import { S, F } from "../theme";
import { add, monday, nice, today, uid, dayShort, dayNum } from "../domain/dates";
import { C, P, cname, free, jobsOf, out, shortage, onSite } from "../domain/logic";
import { forslag, tillsatt, tillsattText } from "../domain/actions";
import { Job, Person, Customer } from "../domain/types";

export type SheetSpec =
  | { t: "job"; id?: string; date?: string; cid?: string; pid?: string }
  | { t: "absence"; id: string; date?: string }
  | { t: "cust"; id?: string; phone?: string }
  | { t: "person"; id?: string }
  | { t: "replace"; id: string }
  | { t: "give"; pid: string; date: string }
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
          <Pressable onPress={() => onChange(null)}
            style={{ minHeight: 56, paddingHorizontal: S.x3, borderRadius: S.r, borderWidth: 1, alignItems: "center", justifyContent: "center",
              borderColor: value === null ? t.c.accent : t.c.line, backgroundColor: value === null ? t.c.accent : t.c.surface }}>
            <Text style={{ color: value === null ? t.c.onAccent : t.c.ink, fontSize: F.sm, fontWeight: "600" }}>Tills vidare</Text>
          </Pressable>
        ) : null}
        {days.map(d => {
          const on = d === value, isToday = d === today();
          return (
            <Pressable key={d} onPress={() => onChange(d)}
              style={{ width: 52, minHeight: 56, borderRadius: S.r, borderWidth: 1, alignItems: "center", justifyContent: "center",
                borderColor: on ? t.c.accent : t.c.line, backgroundColor: on ? t.c.accent : t.c.surface }}>
              <Text style={{ color: on ? t.c.onAccent : t.c.muted, fontSize: F.xs }}>{dayShort(d)}</Text>
              <Text style={{ color: on ? t.c.onAccent : isToday ? t.c.accent : t.c.ink, fontSize: F.lg, fontWeight: "700" }}>{dayNum(d)}</Text>
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
        <Text style={{ color: t.c.ink, fontSize: F.lg, fontWeight: "700", minWidth: 32, textAlign: "center" }}>{value}</Text>
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
  return <GiveSheet spec={spec} close={close} />;
}

function JobSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "job" }>; close: () => void }) {
  const { s, edit } = useStore();
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
    const o = { date, customerId: cid, title: title.trim(), need, people };
    const name = (C(s, cid) || ({} as Customer)).name || "Okänd kund";
    edit((spec.id ? "Jobb ändrat: " : "Nytt jobb: ") + name + ", " + nice(date), d => {
      if (spec.id) Object.assign(d.jobs.find(j => j.id === spec.id)!, o);
      else d.jobs.push({ id: uid(), ...o });
    });
    close();
  };
  const del = () => {
    edit("Jobb borttaget: " + (existing ? cname(s, existing) : "") + ", " + nice(date), d => {
      d.jobs = d.jobs.filter(j => j.id !== spec.id);
    });
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
  const { s, edit } = useStore();
  const th = useT();
  const p = P(s, spec.id)!;
  const [type, setType] = useState(p.away?.type || "Sjuk");
  const [from, setFrom] = useState(p.away?.from || spec.date || today());
  const [to, setTo] = useState<string | null>(p.away?.to ?? null);

  const spara = (typ: string, f: string, tt: string | null, text: string) => {
    edit(text, d => { P(d, spec.id)!.away = { type: typ, from: f, to: tt }; });
    close();
  };
  const fredag = add(monday(spec.date || today()), 4);

  /* De tre vanligaste fallen är ett tryck. Allt annat ställs in under. */
  const snabb = p.away ? null : (
    <View style={{ gap: S.x2 }}>
      <Text style={{ color: th.c.muted, fontSize: F.xs, fontWeight: "600" }}>VANLIGAST</Text>
      <Btn title="Sjuk idag, tills vidare" kind="pri"
        onPress={() => spara("Sjuk", today(), null, p.name + " sjukanmäld från idag")} />
      <Btn title={"Sjuk resten av veckan, t.o.m. " + nice(fredag)}
        onPress={() => spara("Sjuk", today(), fredag, p.name + " sjuk t.o.m. " + nice(fredag))} />
      <Btn title="VAB idag, tills vidare"
        onPress={() => spara("VAB", today(), null, p.name + " vabbar från idag")} />
    </View>
  );

  return (
    <Sheet open title={"Frånvaro: " + p.name} onClose={close}
      footer={
        <>
          {p.away ? <Btn title="Ta bort frånvaro" kind="danger"
            onPress={() => { edit(p.name + " är tillbaka", d => { P(d, spec.id)!.away = null; }); close(); }} /> : null}
          <Btn title="Spara" kind="pri" style={{ flex: 1 }}
            onPress={() => spara(type, from, to, p.name + ": " + type.toLowerCase() + " från " + nice(from))} />
        </>
      }>
      {snabb}
      <Choice label="Orsak" value={type} onChange={setType}
        options={[{ key: "Sjuk", label: "Sjuk" }, { key: "Semester", label: "Semester" }, { key: "VAB", label: "VAB" }]} />
      <DateStrip value={from} onChange={d => setFrom(d || today())} />
      <Text style={{ color: th.c.muted, fontSize: F.xs, fontWeight: "600" }}>TILL OCH MED</Text>
      <DateStrip value={to} onChange={setTo} allowNone />
    </Sheet>
  );
}

function CustSheet({ spec, close }: { spec: Extract<NonNullable<SheetSpec>, { t: "cust" }>; close: () => void }) {
  const { s, edit } = useStore();
  const k = spec.id ? C(s, spec.id)! : null;
  const [name, setName] = useState(k?.name || "");
  const [contact, setContact] = useState(k?.contact || "");
  const [phone, setPhone] = useState(k?.phone || spec.phone || "");
  const [address, setAddress] = useState(k?.address || "");
  const [project, setProject] = useState(k?.project || "");
  const [status, setStatus] = useState(k?.status || "Pågår");
  const save = () => {
    if (!name.trim()) return;
    const o = { name: name.trim(), contact, phone, address, project, status };
    edit((spec.id ? "Kund ändrad: " : "Ny kund: ") + o.name, d => {
      if (spec.id) Object.assign(C(d, spec.id)!, o);
      else d.customers.push({ id: uid(), ...o });
    });
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
  const { s, edit } = useStore();
  const r = spec.id ? P(s, spec.id)! : null;
  const [name, setName] = useState(r?.name || "");
  const [phone, setPhone] = useState(r?.phone || "");
  const [role, setRole] = useState(r?.role || "");
  const [vac, setVac] = useState(r?.vacLeft == null ? "" : String(r.vacLeft));
  const [mfa, setMfa] = useState(!!r?.mfa);
  const [certs, setCerts] = useState((r?.certs || []).map(c => c.name + ", " + c.expires).join("\n"));
  const save = () => {
    if (!name.trim()) return;
    const o = {
      name: name.trim(), phone, role, vacLeft: vac === "" ? null : Number(vac), mfa,
      certs: certs.split("\n").map(l => {
        const m = l.match(/^(.+?),\s*(\d{4}-\d{2}-\d{2})\s*$/);
        return m ? { name: m[1].trim(), expires: m[2] } : null;
      }).filter(Boolean) as { name: string; expires: string }[],
    };
    edit((spec.id ? "Person ändrad: " : "Ny person: ") + o.name, d => {
      if (spec.id) Object.assign(P(d, spec.id)!, o);
      else d.people.push({ id: uid(), away: null, ...o } as Person);
    });
    close();
  };
  const del = () => {
    edit("Person borttagen: " + (r?.name || ""), d => {
      d.people = d.people.filter(p => p.id !== spec.id);
      d.jobs.forEach(j => { j.people = j.people.filter(i => i !== spec.id); });
    });
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
  const { s, edit } = useStore();
  const open2 = useSheet();
  const j = s.jobs.find(x => x.id === spec.id)!;
  const kandidater = forslag(s, j);
  const pass = (pid: string) => s.jobs.filter(x => x.people.indexOf(pid) >= 0).length;

  const satt = (pid: string) => {
    edit(tillsattText(s, j.id, pid), d => tillsatt(d, j.id, pid));
    close();
  };
  const sank = () => {
    edit("Antalet sänkt på " + cname(s, j) + ", " + nice(j.date), d => {
      const job = d.jobs.find(x => x.id === j.id)!;
      job.need = Math.max(1, onSite(d, job).length);
    });
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
  const { s, edit } = useStore();
  const open2 = useSheet();
  const p = P(s, spec.pid)!;
  const js = s.jobs.filter(j => j.date === spec.date).sort((a, b) => shortage(s, b) - shortage(s, a));
  const assign = (j: Job) => {
    edit(tillsattText(s, j.id, p.id), d => tillsatt(d, j.id, p.id));
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
