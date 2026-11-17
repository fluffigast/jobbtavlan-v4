/* Bemanningsreglerna. Testerna bygger sina egna lägen i stället för att luta sig
   mot demodata, så att en ändring i demot inte tyst gör ett test meningslöst. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { State, Person, Job } from "../src/domain/types";
import { add, today } from "../src/domain/dates";
import {
  out, shortage, onSite, free, jobsOf, jobsOn, nextBooked, who,
  certState, certIssues, secItems, secOpen, shortToday, cname, weekDays, isWeekend,
} from "../src/domain/logic";

const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id, name: id, phone: "", role: "", away: null, vacLeft: null, mfa: true, certs: [], ...extra,
});
const job = (id: string, date: string, need: number, people: string[]): Job =>
  ({ id, date, customerId: "k1", title: "arbete", need, people });

const base = (people: Person[], jobs: Job[]): State => ({
  rev: 1, firm: "Testfirman",
  people, jobs,
  customers: [{ id: "k1", name: "Kund ett", phone: "070-111 11 11", contact: "Ida", status: "Pågår" }],
  sms: [], security: [], incidents: [], log: [],
});

test("out gäller inom frånvarofönstret, inte utanför", () => {
  const p = person("a", { away: { type: "Sjuk", from: "2026-11-16", to: "2026-11-18" } });
  assert.equal(out(p, "2026-11-15"), false, "dagen före");
  assert.equal(out(p, "2026-11-16"), true, "första dagen räknas");
  assert.equal(out(p, "2026-11-18"), true, "sista dagen räknas");
  assert.equal(out(p, "2026-11-19"), false, "dagen efter");
});

test("frånvaro utan slutdatum gäller framåt utan slut", () => {
  const p = person("a", { away: { type: "Sjuk", from: "2026-11-16", to: null } });
  assert.equal(out(p, "2026-11-15"), false);
  assert.equal(out(p, "2027-05-01"), true);
});

test("en frånvarande person räknas inte som bemanning", () => {
  const p = [person("erik"), person("jonas", { away: { type: "Sjuk", from: "2026-11-16", to: "2026-11-20" } })];
  const s = base(p, [job("j1", "2026-11-17", 2, ["erik", "jonas"])]);
  assert.deepEqual(onSite(s, s.jobs[0]), ["erik"]);
  assert.equal(shortage(s, s.jobs[0]), 1);
});

test("shortage blir noll när fler är tillsatta än som behövs", () => {
  const s = base([person("a"), person("b"), person("c")], [job("j1", "2026-11-17", 2, ["a", "b", "c"])]);
  assert.equal(shortage(s, s.jobs[0]), 0, "ingen negativ brist");
});

test("free är de som varken är borta eller redan bokade", () => {
  const s = base(
    [person("erik"), person("maria"), person("jonas", { away: { type: "Sjuk", from: "2026-11-17", to: "2026-11-17" } })],
    [job("j1", "2026-11-17", 1, ["erik"])],
  );
  assert.deepEqual(free(s, "2026-11-17").map(p => p.id), ["maria"]);
  assert.deepEqual(jobsOf(s, "erik", "2026-11-17").map(j => j.id), ["j1"]);
  assert.equal(jobsOn(s, "2026-11-18").length, 0);
});

test("certState: utgånget är kritiskt, inom 60 dagar är varning", () => {
  assert.equal(certState({ expires: add(today(), -1) }), "crit");
  assert.equal(certState({ expires: today() }), "warn", "går ut idag, inte ännu utgånget");
  assert.equal(certState({ expires: add(today(), 59) }), "warn");
  assert.equal(certState({ expires: add(today(), 60) }), "warn", "gränsen räknas med");
  assert.equal(certState({ expires: add(today(), 61) }), "ok");
});

test("certIssues plockar bara de intyg som inte är ok", () => {
  const s = base([person("a", { certs: [
    { name: "Fallskydd", expires: add(today(), 400) },
    { name: "Heta arbeten", expires: add(today(), 10) },
    { name: "ID06", expires: add(today(), -5) },
  ] })], []);
  assert.deepEqual(certIssues(s).map(i => [i.c.name, i.s]), [["Heta arbeten", "warn"], ["ID06", "crit"]]);
});

test("tvåstegspunkten räknas ur personallistan och går inte att bocka av för hand", () => {
  const utan = base([person("a", { mfa: false }), person("b", { mfa: true })], []);
  const med = base([person("a", { mfa: true })], []);
  const punkt = (s: State) => secItems(s)[0];
  assert.equal(punkt(utan).done, false);
  assert.match(punkt(utan).sub, /Saknas för: a/);
  assert.equal(punkt(utan).auto, true);
  assert.equal(punkt(med).done, true);
});

test("secOpen summerar öppna punkter och ohanterade rapporter", () => {
  const s = base([person("a", { mfa: true })], []);
  s.security = [{ id: "c1", text: "Lösenordshanterare", done: false }, { id: "c2", text: "Backup", done: true }];
  s.incidents = [{ id: "i1", ts: "2026-11-16 13:05", who: "a", text: "bluff-sms", done: false }];
  assert.equal(secOpen(s), 2, "en öppen checkpunkt plus en öppen rapport");
});

test("shortToday räknar bara dagens brist", () => {
  const s = base([person("a"), person("b")], [
    job("j1", today(), 2, ["a"]),
    job("j2", add(today(), 1), 2, []),
  ]);
  assert.equal(shortToday(s), 1);
});

test("nextBooked tar första bokningen från och med idag", () => {
  const s = base([], [
    job("gammalt", add(today(), -3), 1, []),
    job("senare", add(today(), 5), 1, []),
    job("snart", add(today(), 1), 1, []),
  ]);
  assert.equal(nextBooked(s, "k1"), add(today(), 1));
  assert.equal(nextBooked(s, "finns-inte"), null);
});

test("who känner igen numret oavsett mellanslag och bindestreck", () => {
  const s = base([person("lina", { name: "Lina", phone: "0705550102" })], []);
  assert.equal(who(s, "070-111 11 11"), "Kund ett (Ida)");
  assert.equal(who(s, "070-555 01 02"), "Lina (personal)");
  assert.equal(who(s, "070-999 99 99"), null);
  assert.equal(who(s, ""), null);
});

test("cname faller tillbaka på okänd kund", () => {
  const s = base([], [job("j1", today(), 1, [])]);
  assert.equal(cname(s, s.jobs[0]), "Kund ett");
  assert.equal(cname(s, { ...s.jobs[0], customerId: "borta" }), "Okänd kund");
});

test("weekDays ger måndag till fredag, inga helgdagar", () => {
  const ds = weekDays("2026-11-16");
  assert.deepEqual(ds, ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
  assert.equal(ds.some(isWeekend), false);
  assert.equal(isWeekend("2026-11-21"), true);
});
