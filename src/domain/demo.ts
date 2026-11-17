/* Demodata från v3 (src/data.json), men förskjuten så att den alltid ligger i
   innevarande vecka. Annars visar Idag en tom dag så fort demot är en vecka gammalt.
   Allt innehåll är påhittat: Kvist & Tapp Snickeri AB. */
import raw from "./demo.json";
import { State } from "./types";
import { add, monday, pd, today } from "./dates";

/* Måndagen i den vecka datafilen är skriven för. */
const ANCHOR = "2026-11-16";

const shiftDate = (d: string, n: number) => add(d, n);
const shiftTs = (ts: string, n: number) => {
  const [d, t] = ts.split(" ");
  return shiftDate(d, n) + (t ? " " + t : "");
};

export function demoState(): State {
  const s: State = JSON.parse(JSON.stringify(raw));
  const n = Math.round((+pd(monday(today())) - +pd(ANCHOR)) / 864e5);
  if (n) {
    s.jobs.forEach(j => { j.date = shiftDate(j.date, n); });
    s.people.forEach(p => {
      if (p.away) { p.away.from = shiftDate(p.away.from, n); if (p.away.to) p.away.to = shiftDate(p.away.to, n); }
      (p.certs || []).forEach(c => { c.expires = shiftDate(c.expires, n); });
    });
    s.sms.forEach(m => { m.ts = shiftTs(m.ts, n); });
    s.incidents.forEach(i => { i.ts = shiftTs(i.ts, n); });
    (s.log || []).forEach(l => { l.ts = shiftTs(l.ts, n); });
  }
  return s;
}
