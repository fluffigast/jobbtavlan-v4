/* Portat rakt av från Jobbtavlan v3, src/app.js rad 8–18. Samma funktioner, samma namn. */
const DAYS = ["sön", "mån", "tis", "ons", "tors", "fre", "lör"];
const MON = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const DAYL = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
const MONL = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const pd = (s: string) => { const a = s.split("-").map(Number); return new Date(a[0], a[1] - 1, a[2]); };
export const add = (s: string, n: number) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
export const today = () => iso(new Date());
export const monday = (s: string) => add(s, -((pd(s).getDay() + 6) % 7));
export const nice = (s: string) => { const d = pd(s); return DAYS[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; };
export const dayShort = (s: string) => DAYS[pd(s).getDay()];
export const dayNum = (s: string) => String(pd(s).getDate());
/* "fre 5 dec" duger för den här veckan. Ett intyg som går ut om fem år måste
   visa årtalet, annars ser förnyelsen ut att gälla till i december. */
export const niceAr = (s: string) => {
  const d = pd(s);
  return nice(s) + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "");
};
export const longDate = (s: string) => { const d = pd(s); return DAYL[d.getDay()] + " " + d.getDate() + " " + MONL[d.getMonth()] + " " + d.getFullYear(); };
/* Som longDate, men årtalet bara när det inte är i år. Titelraden på en
   telefon har inte plats för "fredag 20 november 2026 · vecka 47". */
export const longDateAr = (s: string) => {
  const d = pd(s);
  return DAYL[d.getDay()] + " " + d.getDate() + " " + MONL[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "");
};
export const weekNo = (s: string) => {
  const d = pd(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((+d - +w) / 864e5 - 3 + ((w.getDay() + 6) % 7)) / 7);
};
export const stamp = () => { const n = new Date(); return iso(n) + " " + pad(n.getHours()) + ":" + pad(n.getMinutes()); };
export const uid = () => Math.random().toString(36).slice(2, 9);
export const workday = (s: string) => { const n = pd(s).getDay(); return n > 0 && n < 6; };
export const digits = (n?: string) => String(n || "").replace(/[^\d]/g, "");
