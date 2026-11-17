/* Ändringar som flera skärmar gör likadant. Att de bor här i stället för i varje
   vy är skillnaden mellan "samma knapp gör samma sak" och "nästan samma sak". */
import { State, Person, Job } from "./types";
import { cname, onSite, P, free, shortage } from "./logic";
import { nice, today } from "./dates";

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

/* Sjukanmälan i ett tryck: idag, tills vidare. Resten ändras i arket. */
export function sjukIdag(d: State, personId: string) {
  const p = P(d, personId);
  if (p) p.away = { type: "Sjuk", from: today(), to: null };
}

export function tillbaka(d: State, personId: string) {
  const p = P(d, personId);
  if (p) p.away = null;
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
