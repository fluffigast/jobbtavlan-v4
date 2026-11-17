/* Semestersaldot och intygen ska vara sanna utan att någon räknar för hand.
   Det är lätt att få rätt en gång och fel vid andra ändringen, så det testas
   genom att ändra flera gånger i rad. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoState } from "../src/domain/demo";
import { State } from "../src/domain/types";
import { sattFranvaro, taBortFranvaro, vardagar, fornyaIntyg, omAr, forslag } from "../src/domain/actions";
import { P, free, shortage } from "../src/domain/logic";
import { monday, today, add } from "../src/domain/dates";

const kopia = (s: State): State => JSON.parse(JSON.stringify(s));
const man = monday("2026-11-16");   // en vanlig vecka: mån 16 till fre 20

test("vardagar räknar bort helgen, och tar med bägge ändarna", () => {
  assert.equal(vardagar("2026-11-16", "2026-11-20"), 5, "hel arbetsvecka");
  assert.equal(vardagar("2026-11-16", "2026-11-16"), 1, "en dag");
  assert.equal(vardagar("2026-11-20", "2026-11-23"), 2, "fredag och måndag, helgen emellan");
  assert.equal(vardagar("2026-11-21", "2026-11-22"), 0, "bara helg");
  assert.equal(vardagar("2026-11-20", "2026-11-16"), 0, "bakvänt spann ger noll");
});

test("semester drar dagar, och att ta bort den lämnar tillbaka dem", () => {
  const s = kopia(demoState());
  const p = s.people[0];
  const fore = p.vacLeft!;
  sattFranvaro(s, p.id, { type: "Semester", from: man, to: add(man, 4) });
  assert.equal(P(s, p.id)!.vacLeft, fore - 5);
  assert.equal(P(s, p.id)!.away!.dragna, 5, "uttaget sparas på frånvaron");
  taBortFranvaro(s, p.id);
  assert.equal(P(s, p.id)!.vacLeft, fore);
  assert.equal(P(s, p.id)!.away, null);
});

test("att ändra en pågående semester räknar om, inte dubbelt", () => {
  const s = kopia(demoState());
  const p = s.people[0];
  const fore = p.vacLeft!;
  sattFranvaro(s, p.id, { type: "Semester", from: man, to: add(man, 4) });
  sattFranvaro(s, p.id, { type: "Semester", from: man, to: add(man, 1) });
  assert.equal(P(s, p.id)!.vacLeft, fore - 2, "bara det nya uttaget gäller");
  sattFranvaro(s, p.id, { type: "Sjuk", from: man, to: add(man, 4) });
  assert.equal(P(s, p.id)!.vacLeft, fore, "sjukdom kostar inga semesterdagar");
});

test("semester utan slutdatum drar ingenting förrän den har ett slut", () => {
  const s = kopia(demoState());
  const p = s.people[0];
  const fore = p.vacLeft!;
  sattFranvaro(s, p.id, { type: "Semester", from: man, to: null });
  assert.equal(P(s, p.id)!.vacLeft, fore);
  sattFranvaro(s, p.id, { type: "Semester", from: man, to: add(man, 2) });
  assert.equal(P(s, p.id)!.vacLeft, fore - 3);
});

test("fler dagar än saldot ger ett minus, inte en tyst nolla", () => {
  const s = kopia(demoState());
  const p = s.people[0];
  p.vacLeft = 2;
  sattFranvaro(s, p.id, { type: "Semester", from: man, to: add(man, 4) });
  assert.equal(P(s, p.id)!.vacLeft, -3, "övertaget syns i stället för att döljas");
});

test("frånvaro gör personen otillgänglig och skapar luckan", () => {
  const s = kopia(demoState());
  const d = today();
  const nagon = free(s, d)[0] ?? s.people[0];
  sattFranvaro(s, nagon.id, { type: "Sjuk", from: d, to: null });
  assert.equal(free(s, d).some(p => p.id === nagon.id), false);
});

test("omAr flyttar ett intyg ett år fram, även över en skottdag", () => {
  assert.equal(omAr("2026-12-05", 1), "2027-12-05");
  assert.equal(omAr("2026-11-17", 5), "2031-11-17");
  assert.equal(omAr("2028-02-29", 1), "2029-03-01", "skottdagen blir första mars");
});

test("förnyat intyg slutar räknas som en brist", () => {
  const s = kopia(demoState());
  const p = s.people.find(x => (x.certs || []).some(c => c.expires < today()))!;
  const utganget = p.certs.find(c => c.expires < today())!;
  fornyaIntyg(s, p.id, utganget.name, omAr(today(), 1));
  assert.ok(P(s, p.id)!.certs.find(c => c.name === utganget.name)!.expires > today());
});

test("förslaget är de lediga, med minst inbokade först", () => {
  const s = kopia(demoState());
  const jobb = s.jobs.find(j => shortage(s, j) > 0)!;
  const lista = forslag(s, jobb);
  const lediga = free(s, jobb.date).map(p => p.id).sort();
  assert.deepEqual(lista.map(p => p.id).sort(), lediga, "samma personer som free");
  const pass = (id: string) => s.jobs.filter(j => j.people.includes(id)).length;
  for (let i = 1; i < lista.length; i++) {
    assert.ok(pass(lista[i - 1].id) <= pass(lista[i].id), "sorterat på antal pass");
  }
});
