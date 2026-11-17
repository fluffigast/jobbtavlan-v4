/* Reglerna avgör vad någon annans telefon får göra med firmans plan.
   De testas därför på riktiga tillståndspar, inte på en beskrivning av dem. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoState } from "../src/domain/demo";
import { andringar, provaAndring, farAndra } from "../src/domain/roles";
import { today, uid } from "../src/domain/dates";
import { State } from "../src/domain/types";

const kopia = (s: State): State => JSON.parse(JSON.stringify(s));
const bas = demoState();
const jonas = bas.people[1].id;
const erik = bas.people[0].id;

test("egen frånvaro känns igen som just egen", () => {
  const n = kopia(bas);
  n.people.find(p => p.id === erik)!.away = { type: "Sjuk", from: today(), to: null };
  assert.deepEqual(andringar(bas, n), ["egen:" + erik]);
});

test("ändrat namn eller telefon är inte frånvaro", () => {
  const n = kopia(bas);
  n.people.find(p => p.id === erik)!.phone = "070-000 00 00";
  assert.deepEqual(andringar(bas, n), ["personal"]);
});

test("ny rapport skiljs från ändrad rapport", () => {
  const ny = kopia(bas);
  ny.incidents.push({ id: uid(), ts: "2026-11-16 09:00", who: "Erik", text: "bluffsamtal", done: false });
  assert.deepEqual(andringar(bas, ny), ["rapport:ny"]);

  const andrad = kopia(bas);
  andrad.incidents[0].done = true;
  assert.deepEqual(andringar(bas, andrad), ["rapport:ändrad"]);
});

test("snickaren får sjukanmäla sig själv, men inte någon annan", () => {
  const egen = kopia(bas);
  egen.people.find(p => p.id === jonas)!.away = { type: "Sjuk", from: today(), to: null };
  assert.deepEqual(provaAndring("snickare", jonas, bas, egen), { ok: true });

  const annans = kopia(bas);
  annans.people.find(p => p.id === erik)!.away = { type: "Sjuk", from: today(), to: null };
  const svar = provaAndring("snickare", jonas, bas, annans);
  assert.equal(svar.ok, false);
  assert.deepEqual(svar.ok === false && svar.nekade, ["egen:" + erik]);
});

test("snickaren rör inte planen, kunderna eller grundskyddet", () => {
  for (const andra of [
    (d: State) => { d.jobs[0].title = "annat"; },
    (d: State) => { d.customers[0].name = "annat"; },
    (d: State) => { d.security[0].done = !d.security[0].done; },
    (d: State) => { d.people.push({ ...d.people[0], id: "ny" }); },
  ]) {
    const n = kopia(bas); andra(n);
    assert.equal(provaAndring("snickare", jonas, bas, n).ok, false);
  }
});

test("arbetsledaren får allt, även det som ser ut som sabotage", () => {
  const n = kopia(bas);
  n.jobs = []; n.customers = []; n.people = [n.people[0]];
  assert.deepEqual(provaAndring("ledare", erik, bas, n), { ok: true });
});

test("oförändrat tillstånd är ingen ändring alls", () => {
  assert.deepEqual(andringar(bas, kopia(bas)), []);
  assert.deepEqual(provaAndring("snickare", null, bas, kopia(bas)), { ok: true });
});

test("utan inloggad person får snickaren inte ändra någons frånvaro", () => {
  assert.equal(farAndra("snickare", null, "egen:" + erik), false);
  assert.equal(farAndra("snickare", null, "rapport:ny"), true);
});
