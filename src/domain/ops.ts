/* Handlingar, inte tillstånd.
 *
 * Den första servern tog emot hela planen från klienten och jämförde den med
 * den gamla för att se vad som ändrats. Det gick att runda på fem sätt: man kan
 * skicka med ett påhittat semesteruttag, skriva om händelseloggen, lägga in ett
 * sms i någon annans namn och smyga in fält som jämförelsen inte tittade på.
 *
 * Här skickas i stället en handling: "sätt in Maria på jobb j1". Servern räknar
 * själv ut allt som följer av den, och klienten kan inte påstå något om
 * resultatet. Samma reducerare körs lokalt i demoläge, så ett demo beter sig
 * exakt som en firma med server.
 */
import { State, Job, Customer, Person, Away, Cert } from "./types";
import { Roll } from "./roles";
import { P, C, cname, onSite } from "./logic";
import { sattFranvaro, taBortFranvaro, fornyaIntyg } from "./actions";
import { nice, niceAr } from "./dates";

export type JobbFalt = { date: string; customerId: string; title: string; need: number; people: string[] };
export type KundFalt = Omit<Customer, "id">;
export type PersonFalt = Omit<Person, "id" | "away">;

export type Op =
  | { typ: "bemanning"; jobbId: string; personer: string[] }
  | { typ: "jobb-ny"; id: string; jobb: JobbFalt }
  | { typ: "jobb-andra"; id: string; jobb: JobbFalt }
  | { typ: "jobb-bort"; id: string }
  | { typ: "kund-ny"; id: string; kund: KundFalt }
  | { typ: "kund-andra"; id: string; kund: KundFalt }
  | { typ: "person-ny"; id: string; person: PersonFalt }
  | { typ: "person-andra"; id: string; person: PersonFalt }
  | { typ: "person-bort"; id: string }
  | { typ: "franvaro"; personId: string; away: { type: string; from: string; to: string | null } }
  | { typ: "franvaro-bort"; personId: string }
  | { typ: "intyg"; personId: string; namn: string; expires: string }
  | { typ: "grundskydd"; id: string; done: boolean }
  | { typ: "sms-ny"; id: string; from: string; text: string }
  | { typ: "sms-bort"; id: string }
  | { typ: "sms-klart"; id: string; done: boolean }
  | { typ: "rapport-ny"; id: string; text: string; who?: string }
  | { typ: "rapport-bort"; id: string }
  | { typ: "rapport-klar"; id: string; done: boolean };

export type Kontext = { nu: string; migId: string | null; namn: string | null };

/* ---- vem som får göra vad ---- */

export function farGora(roll: Roll, migId: string | null, op: Op, s: State): boolean {
  if (roll === "ledare") return true;
  // Snickaren sköter sin egen frånvaro och kan säga ifrån om något skumt.
  if (op.typ === "franvaro" || op.typ === "franvaro-bort") return !!migId && op.personId === migId;
  if (op.typ === "rapport-ny") return true;
  if (op.typ === "rapport-bort") {
    const r = s.incidents.find(i => i.id === op.id);
    return !!r && !!migId && r.av === migId;      // bara sin egen, och bara för att ångra
  }
  return false;
}

/* ---- vad handlingen gör ---- */

export function tillampa(d: State, op: Op, k: Kontext): void {
  switch (op.typ) {
    case "bemanning": {
      const j = d.jobs.find(x => x.id === op.jobbId);
      if (j) j.people = op.personer.filter(id => d.people.some(p => p.id === id));
      break;
    }
    case "jobb-ny":
      if (!d.jobs.some(j => j.id === op.id)) d.jobs.push({ id: op.id, ...rensaJobb(op.jobb, d) });
      break;
    case "jobb-andra": {
      const j = d.jobs.find(x => x.id === op.id);
      if (j) Object.assign(j, rensaJobb(op.jobb, d));
      break;
    }
    case "jobb-bort":
      d.jobs = d.jobs.filter(j => j.id !== op.id);
      break;
    case "kund-ny":
      if (!d.customers.some(c => c.id === op.id)) d.customers.push({ id: op.id, ...op.kund });
      break;
    case "kund-andra": {
      const c = C(d, op.id);
      if (c) Object.assign(c, op.kund);
      break;
    }
    case "person-ny":
      if (!d.people.some(p => p.id === op.id)) d.people.push({ id: op.id, away: null, ...op.person });
      break;
    case "person-andra": {
      const p = P(d, op.id);
      // Frånvaron ändras bara via sina egna handlingar, så saldot inte kan smygas om.
      if (p) Object.assign(p, op.person, { away: p.away });
      break;
    }
    case "person-bort":
      d.people = d.people.filter(p => p.id !== op.id);
      d.jobs.forEach(j => { j.people = j.people.filter(id => id !== op.id); });
      break;
    case "franvaro":
      sattFranvaro(d, op.personId, { type: op.away.type, from: op.away.from, to: op.away.to });
      break;
    case "franvaro-bort":
      taBortFranvaro(d, op.personId);
      break;
    case "intyg":
      fornyaIntyg(d, op.personId, op.namn, op.expires);
      break;
    case "grundskydd": {
      const i = d.security.find(x => x.id === op.id);
      if (i) i.done = op.done;
      break;
    }
    case "sms-ny":
      if (!d.sms.some(m => m.id === op.id))
        d.sms.push({ id: op.id, ts: k.nu, from: op.from, text: op.text, done: false, av: k.migId || undefined });
      break;
    case "sms-bort":
      d.sms = d.sms.filter(m => m.id !== op.id);
      break;
    case "sms-klart": {
      const m = d.sms.find(x => x.id === op.id);
      if (m) m.done = op.done;
      break;
    }
    case "rapport-ny":
      if (!d.incidents.some(i => i.id === op.id))
        d.incidents.push({
          id: op.id, ts: k.nu, text: op.text, done: false,
          // Inloggningen går före det klienten påstår. Utan inloggning finns
          // ingen sanning att gå på, och då duger demots val.
          who: k.namn || (k.migId ? P(d, k.migId)?.name : null) || op.who || "Okänd",
          av: k.migId || undefined,
        });
      break;
    case "rapport-bort":
      d.incidents = d.incidents.filter(i => i.id !== op.id);
      break;
    case "rapport-klar": {
      const i = d.incidents.find(x => x.id === op.id);
      if (i) i.done = op.done;
      break;
    }
  }
}

/* Ett jobb får aldrig peka på en kund eller person som inte finns. */
function rensaJobb(j: JobbFalt, d: State): JobbFalt {
  return {
    date: j.date,
    customerId: d.customers.some(c => c.id === j.customerId) ? j.customerId : "",
    title: j.title,
    need: Math.max(1, Math.min(99, Math.round(j.need))),
    people: j.people.filter(id => d.people.some(p => p.id === id)),
  };
}

/* ---- vad som hamnar i händelselistan ---- */

export function beskriv(fore: State, op: Op): string {
  const jobbNamn = (id: string) => {
    const j = fore.jobs.find(x => x.id === id);
    return j ? cname(fore, j) + ", " + nice(j.date) : "jobbet";
  };
  const namn = (id: string) => P(fore, id)?.name || "Någon";
  switch (op.typ) {
    case "bemanning": {
      const j = fore.jobs.find(x => x.id === op.jobbId);
      const fore_ = j ? onSite(fore, j) : [];
      const nya = op.personer.filter(id => !fore_.includes(id));
      return nya.length
        ? nya.map(namn).join(", ") + " insatt på " + jobbNamn(op.jobbId)
        : "Bemanning ändrad: " + jobbNamn(op.jobbId);
    }
    case "jobb-ny": return "Nytt jobb: " + (C(fore, op.jobb.customerId)?.name || "kund") + ", " + nice(op.jobb.date);
    case "jobb-andra": return "Jobb ändrat: " + jobbNamn(op.id);
    case "jobb-bort": return "Jobb borttaget: " + jobbNamn(op.id);
    case "kund-ny": return "Ny kund: " + op.kund.name;
    case "kund-andra": return "Kund ändrad: " + op.kund.name;
    case "person-ny": return "Ny person: " + op.person.name;
    case "person-andra": return "Person ändrad: " + op.person.name;
    case "person-bort": return "Person borttagen: " + namn(op.id);
    case "franvaro": return namn(op.personId) + ": " + op.away.type.toLowerCase() + " från " + nice(op.away.from) +
      (op.away.to ? " t.o.m. " + nice(op.away.to) : " tills vidare");
    case "franvaro-bort": return namn(op.personId) + " är tillbaka";
    case "intyg": return namn(op.personId) + ": " + op.namn + " giltigt till " + niceAr(op.expires);
    case "grundskydd": {
      const i = fore.security.find(x => x.id === op.id);
      return "Grundskydd " + (op.done ? "klart" : "öppnat igen") + ": " + (i?.text || "");
    }
    case "sms-ny": return "Sms inlagt från " + op.from;
    case "sms-bort": return "Sms borttaget";
    case "sms-klart": return op.done ? "Sms markerat som klart" : "Sms öppnat igen";
    case "rapport-ny": return "Rapporterat: " + op.text;
    case "rapport-bort": return "Rapport borttagen";
    case "rapport-klar": return op.done ? "Rapport markerad som hanterad" : "Rapport öppnad igen";
  }
}

/* ---- ångra ----
   Motsatsen räknas ut ur tillståndet innan handlingen, så att ångra blir en
   vanlig handling som servern prövar mot samma regler. */
export function invers(fore: State, op: Op): Op | null {
  switch (op.typ) {
    case "bemanning": {
      const j = fore.jobs.find(x => x.id === op.jobbId);
      return j ? { typ: "bemanning", jobbId: j.id, personer: [...j.people] } : null;
    }
    case "jobb-ny": return { typ: "jobb-bort", id: op.id };
    case "jobb-andra": {
      const j = fore.jobs.find(x => x.id === op.id);
      return j ? { typ: "jobb-andra", id: j.id, jobb: { date: j.date, customerId: j.customerId, title: j.title, need: j.need, people: [...j.people] } } : null;
    }
    case "jobb-bort": {
      const j = fore.jobs.find(x => x.id === op.id);
      return j ? { typ: "jobb-ny", id: j.id, jobb: { date: j.date, customerId: j.customerId, title: j.title, need: j.need, people: [...j.people] } } : null;
    }
    case "kund-ny": return null;   // kunder tas inte bort av en ångring
    case "kund-andra": {
      const c = C(fore, op.id);
      if (!c) return null;
      const { id, ...falt } = c;
      return { typ: "kund-andra", id, kund: falt };
    }
    case "person-ny": return { typ: "person-bort", id: op.id };
    case "person-andra": {
      const p = P(fore, op.id);
      if (!p) return null;
      const { id, away, ...falt } = p;
      return { typ: "person-andra", id, person: falt };
    }
    case "person-bort": {
      const p = P(fore, op.id);
      if (!p) return null;
      const { id, away, ...falt } = p;
      return { typ: "person-ny", id, person: falt };
    }
    case "franvaro":
    case "franvaro-bort": {
      const p = P(fore, op.personId);
      if (!p) return null;
      return p.away
        ? { typ: "franvaro", personId: p.id, away: { type: p.away.type, from: p.away.from, to: p.away.to } }
        : { typ: "franvaro-bort", personId: p.id };
    }
    case "intyg": {
      const c = P(fore, op.personId)?.certs?.find(x => x.name === op.namn);
      return c ? { typ: "intyg", personId: op.personId, namn: op.namn, expires: c.expires } : null;
    }
    case "grundskydd": {
      const i = fore.security.find(x => x.id === op.id);
      return i ? { typ: "grundskydd", id: i.id, done: i.done } : null;
    }
    case "sms-ny": return { typ: "sms-bort", id: op.id };
    case "sms-bort": return null;
    case "sms-klart": {
      const m = fore.sms.find(x => x.id === op.id);
      return m ? { typ: "sms-klart", id: m.id, done: m.done } : null;
    }
    case "rapport-ny": return { typ: "rapport-bort", id: op.id };
    case "rapport-bort": return null;
    case "rapport-klar": {
      const i = fore.incidents.find(x => x.id === op.id);
      return i ? { typ: "rapport-klar", id: i.id, done: i.done } : null;
    }
  }
}

/* ---- tolkning ----
   Allt som kommer utifrån tolkas fält för fält. Det som inte står i listan
   finns inte: okända nycklar är inte "extra", de är ett försök. */

const str = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v.length <= max ? v : null;
const id = (v: unknown): string | null =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null;
const datum = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const heltal = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;
const lista = (v: unknown, max: number): unknown[] | null =>
  Array.isArray(v) && v.length <= max ? v : null;

/* Bara de nycklar som står här får finnas, och ingen annan. */
function exakt(o: unknown, nycklar: string[]): Record<string, unknown> | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!nycklar.includes(k)) return null;
  return r;
}

function tolkaJobb(v: unknown): JobbFalt | null {
  const o = exakt(v, ["date", "customerId", "title", "need", "people"]);
  if (!o) return null;
  const d = datum(o.date), c = id(o.customerId), t = str(o.title, 120), n = heltal(o.need, 1, 99);
  const pl = lista(o.people, 50);
  if (!d || !c || t === null || n === null || !pl) return null;
  const personer: string[] = [];
  for (const x of pl) { const i = id(x); if (!i) return null; personer.push(i); }
  return { date: d, customerId: c, title: t, need: n, people: personer };
}

function tolkaKund(v: unknown): KundFalt | null {
  const o = exakt(v, ["name", "contact", "phone", "address", "project", "status"]);
  if (!o) return null;
  const name = str(o.name, 120);
  if (!name) return null;
  const valfri = (x: unknown) => (x === undefined ? "" : str(x, 200));
  const contact = valfri(o.contact), phone = valfri(o.phone), address = valfri(o.address), project = valfri(o.project);
  const status = str(o.status, 20);
  if (contact === null || phone === null || address === null || project === null || !status) return null;
  if (!["Pågår", "Väntar", "Klart"].includes(status)) return null;
  return { name, contact, phone, address, project, status };
}

function tolkaPerson(v: unknown): PersonFalt | null {
  const o = exakt(v, ["name", "phone", "role", "since", "vacLeft", "mfa", "certs"]);
  if (!o) return null;
  const name = str(o.name, 80);
  if (!name) return null;
  const phone = o.phone === undefined ? "" : str(o.phone, 40);
  const role = o.role === undefined ? "" : str(o.role, 80);
  const since = o.since === undefined ? "" : str(o.since, 10);
  const mfa = o.mfa === undefined ? false : bool(o.mfa);
  if (phone === null || role === null || since === null || mfa === null) return null;
  const vacLeft = o.vacLeft === undefined || o.vacLeft === null ? null : heltal(o.vacLeft, -365, 365);
  if (o.vacLeft !== undefined && o.vacLeft !== null && vacLeft === null) return null;
  const cl = o.certs === undefined ? [] : lista(o.certs, 30);
  if (!cl) return null;
  const certs: Cert[] = [];
  for (const c of cl) {
    const co = exakt(c, ["name", "expires"]);
    const cn = co && str(co.name, 80), ce = co && datum(co.expires);
    if (!cn || !ce) return null;
    certs.push({ name: cn, expires: ce });
  }
  return { name, phone, role, since, vacLeft, mfa, certs };
}

export function tolka(rad: unknown): Op | null {
  const o = rad && typeof rad === "object" ? (rad as Record<string, unknown>) : null;
  if (!o || typeof o.typ !== "string") return null;
  switch (o.typ) {
    case "bemanning": {
      const v = exakt(o, ["typ", "jobbId", "personer"]); if (!v) return null;
      const j = id(v.jobbId), pl = lista(v.personer, 50);
      if (!j || !pl) return null;
      const personer: string[] = [];
      for (const x of pl) { const i = id(x); if (!i) return null; personer.push(i); }
      return { typ: "bemanning", jobbId: j, personer };
    }
    case "jobb-ny": case "jobb-andra": {
      const v = exakt(o, ["typ", "id", "jobb"]); if (!v) return null;
      const i = id(v.id), j = tolkaJobb(v.jobb);
      return i && j ? { typ: o.typ as "jobb-ny" | "jobb-andra", id: i, jobb: j } : null;
    }
    case "jobb-bort": case "person-bort": case "sms-bort": case "rapport-bort": {
      const v = exakt(o, ["typ", "id"]); if (!v) return null;
      const i = id(v.id);
      return i ? ({ typ: o.typ, id: i } as Op) : null;
    }
    case "kund-ny": case "kund-andra": {
      const v = exakt(o, ["typ", "id", "kund"]); if (!v) return null;
      const i = id(v.id), k = tolkaKund(v.kund);
      return i && k ? { typ: o.typ as "kund-ny" | "kund-andra", id: i, kund: k } : null;
    }
    case "person-ny": case "person-andra": {
      const v = exakt(o, ["typ", "id", "person"]); if (!v) return null;
      const i = id(v.id), p = tolkaPerson(v.person);
      return i && p ? { typ: o.typ as "person-ny" | "person-andra", id: i, person: p } : null;
    }
    case "franvaro": {
      const v = exakt(o, ["typ", "personId", "away"]); if (!v) return null;
      const pid = id(v.personId);
      const a = exakt(v.away, ["type", "from", "to"]);
      if (!pid || !a) return null;
      const typ = str(a.type, 20), from = datum(a.from);
      const to = a.to === null || a.to === undefined ? null : datum(a.to);
      if (!typ || !from || (a.to != null && !to)) return null;
      if (!["Sjuk", "Semester", "VAB"].includes(typ)) return null;
      if (to && to < from) return null;
      return { typ: "franvaro", personId: pid, away: { type: typ, from, to } };
    }
    case "franvaro-bort": {
      const v = exakt(o, ["typ", "personId"]); if (!v) return null;
      const pid = id(v.personId);
      return pid ? { typ: "franvaro-bort", personId: pid } : null;
    }
    case "intyg": {
      const v = exakt(o, ["typ", "personId", "namn", "expires"]); if (!v) return null;
      const pid = id(v.personId), n = str(v.namn, 80), e = datum(v.expires);
      return pid && n && e ? { typ: "intyg", personId: pid, namn: n, expires: e } : null;
    }
    case "grundskydd": case "sms-klart": case "rapport-klar": {
      const v = exakt(o, ["typ", "id", "done"]); if (!v) return null;
      const i = id(v.id), b = bool(v.done);
      return i && b !== null ? ({ typ: o.typ, id: i, done: b } as Op) : null;
    }
    case "sms-ny": {
      const v = exakt(o, ["typ", "id", "from", "text"]); if (!v) return null;
      const i = id(v.id), f = str(v.from, 40), t = str(v.text, 1000);
      return i && f && t ? { typ: "sms-ny", id: i, from: f, text: t } : null;
    }
    case "rapport-ny": {
      const v = exakt(o, ["typ", "id", "text", "who"]); if (!v) return null;
      const i = id(v.id), t = str(v.text, 1000);
      const w = v.who === undefined ? undefined : str(v.who, 80);
      if (!i || !t || w === null) return null;
      return { typ: "rapport-ny", id: i, text: t, ...(w ? { who: w } : {}) };
    }
    default: return null;
  }
}
