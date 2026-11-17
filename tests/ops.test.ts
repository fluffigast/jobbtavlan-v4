/* Handlingarna: vad de gör, vad de inte låter någon påstå, och att ångra är
   en riktig motsats. Tolken testas med de försök som faktiskt gjordes mot den
   gamla servern. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoState } from "../src/domain/demo";
import { State } from "../src/domain/types";
import { tillampa, tolka, invers, farGora, beskriv, Op, Kontext } from "../src/domain/ops";
import { P, shortage, onSite } from "../src/domain/logic";
import { today, add, monday } from "../src/domain/dates";

const kopia = (s: State): State => JSON.parse(JSON.stringify(s));
const k = (migId: string | null = null, namn: string | null = null): Kontext =>
  ({ nu: "2026-11-17 08:00", migId, namn });
const kor = (s: State, op: Op, ctx = k()) => { const d = kopia(s); tillampa(d, op, ctx); return d; };

const bas = demoState();
const jonas = bas.people[1].id;
const erik = bas.people[0].id;

test("bemanning sätter laget och struntar i personer som inte finns", () => {
  const j = bas.jobs[0];
  const d = kor(bas, { typ: "bemanning", jobbId: j.id, personer: [erik, "spöke"] });
  assert.deepEqual(d.jobs.find(x => x.id === j.id)!.people, [erik]);
});

test("frånvaro räknas av servern, inte av den som skickar", () => {
  const man = monday(today());
  const d = kor(bas, { typ: "franvaro", personId: erik, away: { type: "Semester", from: man, to: add(man, 4) } });
  const fore = P(bas, erik)!.vacLeft!;
  assert.equal(P(d, erik)!.vacLeft, fore - 5);
  assert.equal(P(d, erik)!.away!.dragna, 5);
});

test("tolken kastar ett påhittat semesteruttag", () => {
  const forsok = { typ: "franvaro", personId: jonas, away: { type: "Sjuk", from: "2026-11-16", to: null, dragna: 500 } };
  assert.equal(tolka(forsok), null, "dragna är inget fält som får skickas in");
});

test("tolken kastar okända fält och okända handlingar", () => {
  assert.equal(tolka({ typ: "grundskydd", id: "c1", done: true, bakdorr: 1 }), null);
  assert.equal(tolka({ typ: "logg-skriv", rader: [] }), null);
  assert.equal(tolka({ typ: "jobb-andra", id: "j1", jobb: { date: "2026-11-16", customerId: "k1", title: "x", need: 1, people: [], extra: 1 } }), null);
  assert.equal(tolka(null), null);
  assert.equal(tolka("jobb-bort"), null);
});

test("tolken håller formen på det som släpps igenom", () => {
  assert.equal(tolka({ typ: "jobb-bort", id: "../../etc/passwd" }), null, "id är inte en sökväg");
  assert.equal(tolka({ typ: "franvaro", personId: erik, away: { type: "Ledig", from: "2026-11-16", to: null } }), null, "okänd orsak");
  assert.equal(tolka({ typ: "franvaro", personId: erik, away: { type: "Semester", from: "2026-11-20", to: "2026-11-16" } }), null, "slut före start");
  assert.equal(tolka({ typ: "sms-ny", id: "s9", from: "070", text: "x".repeat(2000) }), null, "orimligt lång text");
  assert.ok(tolka({ typ: "sms-ny", id: "s9", from: "070-555 02 01", text: "hej" }), "ett rimligt sms går igenom");
});

test("sms får sin tid och sin avsändare av mottagaren", () => {
  const d = kor(bas, { typ: "sms-ny", id: "nytt", from: "070-555 02 01", text: "hej" }, k(jonas, "jonas"));
  const m = d.sms.find(x => x.id === "nytt")!;
  assert.equal(m.ts, "2026-11-17 08:00", "tiden sätts här, inte av klienten");
  assert.equal(m.av, jonas, "vem som la in det sparas");
  assert.equal(m.done, false);
});

test("rapportens namn kommer från inloggningen när det finns en", () => {
  const inloggad = kor(bas, { typ: "rapport-ny", id: "r1", text: "bluffsamtal", who: "Erik" }, k(jonas, "jonas"));
  assert.equal(inloggad.incidents.find(i => i.id === "r1")!.who, "jonas", "inloggningen går före påståendet");
  const demo = kor(bas, { typ: "rapport-ny", id: "r2", text: "bluffsamtal", who: "Maria" }, k());
  assert.equal(demo.incidents.find(i => i.id === "r2")!.who, "Maria", "utan inloggning duger demots val");
});

test("person-andra rör inte frånvaron, och därmed inte semestersaldot", () => {
  const man = monday(today());
  let d = kor(bas, { typ: "franvaro", personId: erik, away: { type: "Semester", from: man, to: add(man, 4) } });
  const saldo = P(d, erik)!.vacLeft;
  const p = P(d, erik)!;
  d = kor(d, { typ: "person-andra", id: erik, person: {
    name: p.name, phone: p.phone, role: p.role, since: p.since, vacLeft: 999, mfa: p.mfa, certs: p.certs,
  } });
  assert.equal(P(d, erik)!.away!.dragna, 5, "frånvaron står kvar orörd");
  assert.equal(P(d, erik)!.vacLeft, 999, "saldot får ändras av den som får ändra personen");
  assert.notEqual(saldo, null);
});

test("snickaren får sin egen frånvaro och sin egen rapport, inget mer", () => {
  const egen: Op = { typ: "franvaro", personId: jonas, away: { type: "Sjuk", from: today(), to: null } };
  const annans: Op = { typ: "franvaro", personId: erik, away: { type: "Sjuk", from: today(), to: null } };
  assert.equal(farGora("snickare", jonas, egen, bas), true);
  assert.equal(farGora("snickare", jonas, annans, bas), false);
  assert.equal(farGora("snickare", jonas, { typ: "rapport-ny", id: "r", text: "x" }, bas), true);
  assert.equal(farGora("snickare", jonas, { typ: "sms-ny", id: "s", from: "070", text: "x" }, bas), false);
  assert.equal(farGora("snickare", jonas, { typ: "jobb-bort", id: bas.jobs[0].id }, bas), false);
  assert.equal(farGora("snickare", jonas, { typ: "grundskydd", id: "c1", done: true }, bas), false);
  assert.equal(farGora("ledare", erik, { typ: "jobb-bort", id: bas.jobs[0].id }, bas), true);
});

test("snickaren får ta bort sin egen rapport, men inte en kollegas", () => {
  const med = kor(bas, { typ: "rapport-ny", id: "r1", text: "x" }, k(jonas, "jonas"));
  assert.equal(farGora("snickare", jonas, { typ: "rapport-bort", id: "r1" }, med), true);
  assert.equal(farGora("snickare", erik, { typ: "rapport-bort", id: "r1" }, med), false);
});

test("ångra är en motsats som går att köra, inte ett överskrivet tillstånd", () => {
  const j = bas.jobs.find(x => shortage(bas, x) > 0)!;
  const op: Op = { typ: "bemanning", jobbId: j.id, personer: [...onSite(bas, j), erik] };
  const efter = kor(bas, op);
  const inv = invers(bas, op)!;
  const tillbaka = kor(efter, inv);
  assert.deepEqual(tillbaka.jobs.find(x => x.id === j.id)!.people, j.people);
});

test("ångra gäller även frånvaro, och lämnar tillbaka semesterdagarna", () => {
  const man = monday(today());
  const op: Op = { typ: "franvaro", personId: erik, away: { type: "Semester", from: man, to: add(man, 4) } };
  const fore = P(bas, erik)!.vacLeft;
  const efter = kor(bas, op);
  const tillbaka = kor(efter, invers(bas, op)!);
  assert.equal(P(tillbaka, erik)!.vacLeft, fore);
  assert.equal(P(tillbaka, erik)!.away, null);
});

test("ångra ett borttaget jobb lägger tillbaka det med samma id", () => {
  const j = bas.jobs[0];
  const op: Op = { typ: "jobb-bort", id: j.id };
  const efter = kor(bas, op);
  assert.equal(efter.jobs.some(x => x.id === j.id), false);
  const tillbaka = kor(efter, invers(bas, op)!);
  assert.deepEqual(tillbaka.jobs.find(x => x.id === j.id), j);
});

test("beskrivningen säger vad som hände, på svenska", () => {
  const j = bas.jobs.find(x => !x.people.includes(erik))!;
  assert.match(beskriv(bas, { typ: "bemanning", jobbId: j.id, personer: [...j.people, erik] }), /insatt på/);
  assert.match(beskriv(bas, { typ: "franvaro-bort", personId: erik }), /är tillbaka/);
  assert.match(beskriv(bas, { typ: "grundskydd", id: bas.security[0].id, done: true }), /^Grundskydd klart/);
});

test("intygets kvitto bär årtalet, annars ser 2031 ut som december", () => {
  const om5 = String(new Date().getFullYear() + 5) + "-12-05";
  const text = beskriv(bas, { typ: "intyg", personId: erik, namn: "Heta arbeten", expires: om5 });
  assert.match(text, new RegExp(String(new Date().getFullYear() + 5)));
});
