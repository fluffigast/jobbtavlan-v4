/* Domänlogiken från v3 (src/app.js rad 27–43), nu rena funktioner som tar state.
   Samma regler: out = frånvarande den dagen, shortage = platser utan folk på plats. */
import { State, Person, Customer, Job } from "./types";
import { add, digits, today, pd } from "./dates";

/* Samma svenska nummer skrivs på flera sätt: 070-555 01 02, 0705550102 och
   +46 70 555 01 02. Telefonen skickar det sista, registret innehåller det
   första. Utan den här översättningen blir ett sms från en känd kund "okänt
   nummer", vilket var precis vad som hände. Gäller svenska nummer; ett
   utländskt nummer jämförs som det står. */
export function telNyckel(num?: string): string {
  let n = digits(num);
  if (!n) return "";
  if (n.startsWith("0046")) n = "0" + n.slice(4);
  else if (n.startsWith("46") && n.length >= 10) n = "0" + n.slice(2);
  return n;
}

export const P = (s: State, id: string) => s.people.find(p => p.id === id);
export const C = (s: State, id: string) => s.customers.find(c => c.id === id);
export const out = (p: Person | undefined, d: string) =>
  !!(p && p.away && d >= p.away.from && (!p.away.to || d <= p.away.to));
export const jobsOn = (s: State, d: string) => s.jobs.filter(j => j.date === d);
export const onSite = (s: State, j: Job) => j.people.filter(id => { const p = P(s, id); return p && !out(p, j.date); });
export const shortage = (s: State, j: Job) => Math.max(0, j.need - onSite(s, j).length);
export const jobsOf = (s: State, pid: string, d: string) => jobsOn(s, d).filter(j => j.people.indexOf(pid) >= 0);
export const free = (s: State, d: string) => s.people.filter(p => !out(p, d) && !jobsOf(s, p.id, d).length);
export const cname = (s: State, j: Job) => (C(s, j.customerId) || ({} as Customer)).name || "Okänd kund";
export const nextBooked = (s: State, cid: string) => {
  const t = today();
  return s.jobs.filter(j => j.customerId === cid && j.date >= t).map(j => j.date).sort()[0] || null;
};
export const who = (s: State, num: string) => {
  const a = avsandare(s, num);
  if (a.typ === "kund") return a.kund.name + (a.kund.contact ? " (" + a.kund.contact + ")" : "");
  if (a.typ === "person") return a.person.name + " (personal)";
  return null;
};
export const unread = (s: State) => s.sms.filter(m => !m.done);

/* Vem numret tillhör, i en form som går att agera på. who() ger bara ett namn,
   och ett namn går inte att boka in eller sjukanmäla. */
export type Avsandare =
  | { typ: "kund"; kund: Customer }
  | { typ: "person"; person: Person }
  | { typ: "okand" };
export function avsandare(s: State, num: string): Avsandare {
  const n = telNyckel(num);
  if (!n) return { typ: "okand" };
  const k = s.customers.find(c => telNyckel(c.phone) === n);
  if (k) return { typ: "kund", kund: k };
  const p = s.people.find(x => telNyckel(x.phone) === n);
  if (p) return { typ: "person", person: p };
  return { typ: "okand" };
}
export const certState = (c: { expires: string }): "ok" | "warn" | "crit" => {
  const t = today();
  return c.expires < t ? "crit" : c.expires <= add(t, 60) ? "warn" : "ok";
};
export const certIssues = (s: State) => {
  const r: { p: Person; c: { name: string; expires: string }; s: "warn" | "crit" }[] = [];
  s.people.forEach(p => (p.certs || []).forEach(c => {
    const st = certState(c); if (st !== "ok") r.push({ p, c, s: st });
  }));
  return r;
};
/* Tvåstegsinloggning räknas av sig själv ur personallistan, som i v3. */
export const secItems = (s: State) => {
  const no = s.people.filter(p => !p.mfa);
  return [{
    id: "mfa", auto: true, done: !no.length,
    text: "Tvåstegsinloggning på mejlen för alla",
    sub: no.length ? "Saknas för: " + no.map(p => p.name).join(", ") + ". Ändras under Personal." : "Alla har det påslaget.",
  }].concat(s.security.map(i => ({ ...i, auto: false, sub: "" })) as any);
};
export const secOpen = (s: State) =>
  secItems(s).filter(i => !i.done).length + s.incidents.filter(i => !i.done).length;
export const shortToday = (s: State) => jobsOn(s, today()).reduce((a, j) => a + shortage(s, j), 0);
export const weekDays = (mon: string) => [0, 1, 2, 3, 4].map(i => add(mon, i));
export const isWeekend = (d: string) => { const n = pd(d).getDay(); return n === 0 || n === 6; };
