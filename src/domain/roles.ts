/* Vem får ändra vad.
 *
 * Samma fil används av appen, som gömmer det du ändå inte får göra, och av
 * servern, som avgör saken. Appen får aldrig vara den som bestämmer: den
 * ligger i någon annans telefon.
 */
import { State } from "./types";

export type Roll = "ledare" | "snickare";

export const ROLLNAMN: Record<Roll, string> = {
  ledare: "Arbetsledare",
  snickare: "Snickare",
};

const lika = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* Beskriver vad som skiljer två tillstånd åt, i ord som reglerna kan läsa.
   "egen:<id>" betyder att bara den personens frånvaro ändrats. */
export function andringar(fore: State, efter: State): string[] {
  const ut: string[] = [];

  if (!lika(fore.jobs, efter.jobs)) ut.push("jobb");
  if (!lika(fore.customers, efter.customers)) ut.push("kunder");
  if (!lika(fore.security, efter.security)) ut.push("grundskydd");
  if (fore.firm !== efter.firm) ut.push("firma");

  // Personal: egen frånvaro är något annat än att lägga till eller ändra folk.
  const foreIds = fore.people.map(p => p.id).join(",");
  const efterIds = efter.people.map(p => p.id).join(",");
  if (foreIds !== efterIds) ut.push("personal");
  else {
    for (const p of efter.people) {
      const f = fore.people.find(x => x.id === p.id)!;
      if (lika(f, p)) continue;
      if (lika({ ...f, away: null }, { ...p, away: null })) ut.push("egen:" + p.id);
      else ut.push("personal");
    }
  }

  // Rapporter och sms: att lägga till sist är inte samma sak som att ändra.
  ut.push(...tillagg(fore.incidents, efter.incidents, "rapport"));
  ut.push(...tillagg(fore.sms, efter.sms, "sms"));

  return [...new Set(ut)];
}

function tillagg<T extends { id: string }>(fore: T[], efter: T[], namn: string): string[] {
  if (lika(fore, efter)) return [];
  const gamla = efter.slice(0, fore.length);
  if (efter.length > fore.length && lika(gamla, fore)) return [namn + ":ny"];
  // Lika många, och bara fält som markerar något som hanterat har ändrats.
  if (efter.length === fore.length) return [namn + ":ändrad"];
  return [namn];
}

/* Snickaren får sjukanmäla sig själv och säga ifrån om något skumt.
   Allt annat är arbetsledarens. */
export function farAndra(roll: Roll, migId: string | null, andring: string): boolean {
  if (roll === "ledare") return true;
  if (andring === "rapport:ny" || andring === "sms:ny") return true;
  return !!migId && andring === "egen:" + migId;
}

export function provaAndring(roll: Roll, migId: string | null, fore: State, efter: State):
  { ok: true } | { ok: false; nekade: string[] } {
  const nekade = andringar(fore, efter).filter(a => !farAndra(roll, migId, a));
  return nekade.length ? { ok: false, nekade } : { ok: true };
}

/* Vad appen ska visa. Separat från reglerna ovan, men med samma svar. */
export const serAllt = (roll: Roll) => roll === "ledare";
