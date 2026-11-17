/* Pratet med servern. Allt här får misslyckas utan att appen gör det:
   telefonen är på ett tak, och täckningen är vad den är. */
import { State } from "./domain/types";
import { Roll } from "./domain/roles";

export type Session = { bas: string; token: string; roll: Roll; personId: string; namn: string };
export type Hamtat = { rev: number; state: State };

const JSON_HUVUD = { "content-type": "application/json" };
const TIMEOUT = 8000;

async function anrop(url: string, init: RequestInit = {}) {
  const avbryt = new AbortController();
  const id = setTimeout(() => avbryt.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: avbryt.signal });
  } finally {
    clearTimeout(id);
  }
}

export const rensaAdress = (bas: string) => bas.trim().replace(/\/+$/, "");

export async function loggaIn(bas: string, namn: string, pin: string):
  Promise<{ ok: true; session: Session; rev: number; state: State } | { ok: false; fel: string }> {
  try {
    const r = await anrop(rensaAdress(bas) + "/api/login", {
      method: "POST", headers: JSON_HUVUD, body: JSON.stringify({ namn: namn.trim(), pin }),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, fel: b.fel || "Kunde inte logga in." };
    return {
      ok: true,
      session: { bas: rensaAdress(bas), token: b.token, roll: b.roll, personId: b.personId, namn: namn.trim() },
      rev: b.rev, state: b.state,
    };
  } catch {
    return { ok: false, fel: "Ingen kontakt med servern. Kontrollera adressen och nätet." };
  }
}

export async function hamta(s: Session): Promise<Hamtat | null> {
  try {
    const r = await anrop(s.bas + "/api/state", { headers: { authorization: "Bearer " + s.token } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export type Skrivsvar =
  | { typ: "ok"; rev: number }
  | { typ: "krock"; rev: number; state: State }
  | { typ: "nekat"; nekade: string[] }
  | { typ: "utloggad" }
  | { typ: "offline" };

export async function skriv(s: Session, rev: number, state: State): Promise<Skrivsvar> {
  try {
    const r = await anrop(s.bas + "/api/state", {
      method: "PUT",
      headers: { ...JSON_HUVUD, authorization: "Bearer " + s.token },
      body: JSON.stringify({ rev, state }),
    });
    if (r.status === 401) return { typ: "utloggad" };
    const b = await r.json().catch(() => ({}));
    if (r.status === 409) return { typ: "krock", rev: b.rev, state: b.state };
    if (r.status === 403) return { typ: "nekat", nekade: b.nekade || [] };
    if (!r.ok) return { typ: "offline" };
    return { typ: "ok", rev: b.rev };
  } catch { return { typ: "offline" }; }
}

export async function loggaUt(s: Session) {
  try { await anrop(s.bas + "/api/logout", { method: "POST", headers: { authorization: "Bearer " + s.token } }); }
  catch { /* spelar ingen roll, token glöms lokalt ändå */ }
}
