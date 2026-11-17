/* Ändringar som flera skärmar gör likadant. Att de bor här i stället för i varje
   vy är skillnaden mellan "samma knapp gör samma sak" och "nästan samma sak". */
import { Away, State, Person, Job } from "./types";
import { cname, onSite, P, free, shortage } from "./logic";
import { add, iso, nice, pd, today, workday } from "./dates";

/* Sätter in en person på ett jobb och städar bort de som är borta den dagen,
   annars ser ett jobb bemannat ut på grund av någon som är sjukskriven. */
export function tillsatt(d: State, jobbId: string, personId: string) {
  const j = d.jobs.find(x => x.id === jobbId);
  if (!j) return;
  j.people = onSite(d, j);
  if (j.people.indexOf(personId) < 0) j.people.push(personId);
}
export const tillsattText = (s: State, jobbId: string, personId: string) => {
  const j = s.jobs.find(x => x.id === jobbId);
  const p = P(s, personId);
  return (p?.name || "Personen") + " insatt på " + (j ? cname(s, j) + ", " + nice(j.date) : "jobbet");
};

/* Sjukanmälan i ett tryck: idag, tills vidare. Resten ändras i arket.
   Går via sattFranvaro så att semestersaldot sköts på ett enda ställe. */
export function sjukIdag(d: State, personId: string) {
  sattFranvaro(d, personId, { type: "Sjuk", from: today(), to: null });
}

export function tillbaka(d: State, personId: string) {
  taBortFranvaro(d, personId);
}

/* Vem appen föreslår när en lucka ska fyllas: de lediga den dagen, med den
   som redan jobbat minst den veckan först. Ingen ska få alla extrapass. */
export function forslag(s: State, j: Job): Person[] {
  const lediga = free(s, j.date);
  const pass = (p: Person) => s.jobs.filter(x => x.people.indexOf(p.id) >= 0).length;
  return lediga.slice().sort((a, b) => pass(a) - pass(b) || a.name.localeCompare(b.name, "sv"));
}

/* Dagens luckor, värst först. Används av Idag och av veckolistan. */
export const luckor = (s: State, datum: string) =>
  s.jobs.filter(j => j.date === datum && shortage(s, j) > 0)
        .sort((a, b) => shortage(s, b) - shortage(s, a));

/* ---- semesterdagar som räknar sig själva ---- */

/* Vardagar i ett spann, bägge dagarna inräknade. Helger kostar inga dagar. */
export function vardagar(fran: string, till: string): number {
  if (till < fran) return 0;
  let n = 0;
  for (let d = fran; d <= till; d = add(d, 1)) if (workday(d)) n++;
  return n;
}

/* Sätter frånvaro och håller semestersaldot sant: lämnar tillbaka det förra
   uttaget innan det nya dras. Utan slutdatum dras ingenting, för ingen vet än
   hur länge det blir. */
export function sattFranvaro(d: State, personId: string, ny: NonNullable<Away>) {
  const p = P(d, personId);
  if (!p) return;
  if (p.away?.dragna && p.vacLeft != null) p.vacLeft += p.away.dragna;
  const dragna = ny.type === "Semester" && ny.to ? vardagar(ny.from, ny.to) : 0;
  if (dragna && p.vacLeft != null) p.vacLeft -= dragna;
  p.away = { ...ny, dragna };
}

export function taBortFranvaro(d: State, personId: string) {
  const p = P(d, personId);
  if (!p) return;
  if (p.away?.dragna && p.vacLeft != null) p.vacLeft += p.away.dragna;
  p.away = null;
}

/* ---- intyg ---- */

export function fornyaIntyg(d: State, personId: string, namn: string, nyttDatum: string) {
  const c = P(d, personId)?.certs?.find(x => x.name === namn);
  if (c) c.expires = nyttDatum;
}

/* Samma dag om n år. Skottdagen blir 1 mars, vilket är hur myndigheter räknar. */
export function omAr(datum: string, ar: number): string {
  const d = pd(datum);
  const m = d.getMonth();
  d.setFullYear(d.getFullYear() + ar);
  if (d.getMonth() !== m) d.setDate(1);
  return iso(d);
}
