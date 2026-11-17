/* Jobbtavlans server: håller firmans plan så att alla ser samma sak.
 *
 *   npm run server            # lyssnar på 127.0.0.1:8080, data i .data/
 *   npm run server:konto      # lägger upp en inloggning
 *
 * Servern tar emot handlingar, inte tillstånd. Klienten kan be om "sätt in
 * Maria på j1"; den kan inte påstå hur planen ser ut efteråt. Allt som följer
 * av en handling, som semesteruttag, tidsstämplar, vem som skrev och vad som
 * hamnar i händelselistan, räknas ut här.
 *
 * Servern talar ren http och binder loopback. Ska den nås utifrån ska den stå
 * bakom en omvänd proxy som sköter TLS, och då sätts VARD och ORIGIN.
 */
import http from "node:http";
import crypto from "node:crypto";
import { Store, stammerPin, startState } from "./store";
import { demoState } from "../src/domain/demo";
import { Roll } from "../src/domain/roles";
import { farGora, tillampa, beskriv, tolka, Op } from "../src/domain/ops";
import { visaFor } from "../src/domain/projektion";
import { State } from "../src/domain/types";
import { stamp } from "../src/domain/dates";

const PORT = Number(process.env.PORT || 8080);
const VARD = process.env.VARD || "127.0.0.1";
const DATA = process.env.DATA_DIR || ".data";
const ORIGIN = process.env.ORIGIN || "";          // tomt = inga webbläsare utifrån
const TIMMAR_12 = 12 * 3600_000;

/* Spärr mot gissning. Fem fel i rad kostar en kvart, räknat både på namnet och
   på adressen, så att varken ett konto eller en maskin kan betas av. */
type Sparr = { antal: number; tills: number };
export type Installning = { forsokMax?: number; fonsterMs?: number };

type Session = { namn: string; personId: string; roll: Roll; sedd: number };

export function skapaServer(store: Store, inst: Installning = {}) {
  const FORSOK_MAX = inst.forsokMax ?? 5;
  const FONSTER_MS = inst.fonsterMs ?? 15 * 60_000;
  const sessioner = new Map<string, Session>();
  const sparrar = new Map<string, Sparr>();

  const sparrad = (nyckel: string): number => {
    const s = sparrar.get(nyckel);
    if (!s) return 0;
    if (Date.now() > s.tills) { sparrar.delete(nyckel); return 0; }
    return s.antal >= FORSOK_MAX ? Math.ceil((s.tills - Date.now()) / 1000) : 0;
  };
  const rakna = (nyckel: string) => {
    const s = sparrar.get(nyckel);
    if (!s || Date.now() > s.tills) sparrar.set(nyckel, { antal: 1, tills: Date.now() + FONSTER_MS });
    else { s.antal += 1; s.tills = Date.now() + FONSTER_MS; }
  };
  const glom = (nyckel: string) => sparrar.delete(nyckel);

  const session = (req: http.IncomingMessage): Session | null => {
    const t = (req.headers.authorization || "").replace(/^Bearer /, "");
    const s = t && sessioner.get(t);
    if (!s) return null;
    if (Date.now() - s.sedd > TIMMAR_12) { sessioner.delete(t); return null; }
    s.sedd = Date.now();
    return s;
  };

  const svara = (res: http.ServerResponse, kod: number, kropp: unknown, extra: Record<string, string> = {}) => {
    res.writeHead(kod, {
      "content-type": "application/json; charset=utf-8",
      ...(ORIGIN ? {
        "access-control-allow-origin": ORIGIN,
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "vary": "origin",
      } : {}),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    });
    res.end(JSON.stringify(kropp));
  };

  const kropp = (req: http.IncomingMessage) => new Promise<any>((ok, fel) => {
    let d = "", stor = false;
    req.on("data", (c: Buffer) => {
      d += c;
      if (d.length > 200_000) { stor = true; req.destroy(); }   // en handling är liten
    });
    req.on("end", () => { if (stor) return fel(new Error("för stor")); try { ok(d ? JSON.parse(d) : {}); } catch (e) { fel(e); } });
    req.on("error", fel);
  });

  const projekt = (s: Session) => {
    const { rev, state } = store.las();
    return { rev, state: visaFor(s.roll, s.personId, state) };
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://x");
    if (req.method === "OPTIONS") return svara(res, 204, {});

    try {
      if (url.pathname === "/api/health") return svara(res, 200, { ok: true });

      if (url.pathname === "/api/login" && req.method === "POST") {
        const b = await kropp(req);
        const namn = typeof b.namn === "string" ? b.namn.trim().slice(0, 40) : "";
        const pin = typeof b.pin === "string" ? b.pin : "";
        const adress = (req.socket.remoteAddress || "okänd");
        const kvar = Math.max(sparrad("namn:" + namn.toLowerCase()), sparrad("ip:" + adress));
        if (kvar) return svara(res, 429, { fel: "För många försök. Försök igen om " + Math.ceil(kvar / 60) + " minuter." },
          { "retry-after": String(kvar) });

        const konto = namn ? store.konto(namn) : undefined;
        // Kör alltid nyckelfunktionen, även när kontot inte finns: annars säger
        // svarstiden vilka namn som existerar.
        const ok = stammerPin(pin, konto || store.attrappKonto());
        if (!konto || !ok) {
          rakna("namn:" + namn.toLowerCase());
          rakna("ip:" + adress);
          return svara(res, 401, { fel: "Fel namn eller pinkod." });
        }
        glom("namn:" + namn.toLowerCase());
        glom("ip:" + adress);

        const token = crypto.randomBytes(24).toString("hex");
        const s: Session = { namn, personId: konto.personId, roll: konto.roll, sedd: Date.now() };
        sessioner.set(token, s);
        return svara(res, 200, { token, roll: s.roll, personId: s.personId, ...projekt(s) });
      }

      const s = session(req);
      if (!s) return svara(res, 401, { fel: "Logga in igen." });

      if (url.pathname === "/api/state" && req.method === "GET") return svara(res, 200, projekt(s));

      if (url.pathname === "/api/op" && req.method === "POST") {
        const b = await kropp(req);
        if (typeof b.rev !== "number") return svara(res, 400, { fel: "rev krävs." });
        const op: Op | null = tolka(b.op);
        if (!op) return svara(res, 400, { fel: "Begriper inte handlingen." });

        const nu = store.las();
        if (!farGora(s.roll, s.personId, op, nu.state)) return svara(res, 403, { fel: "Det får inte du göra." });
        if (b.rev !== nu.rev) return svara(res, 409, { fel: "Någon hann före.", ...projekt(s) });

        const efter: State = JSON.parse(JSON.stringify(nu.state));
        tillampa(efter, op, { nu: stamp(), migId: s.personId, namn: s.namn });
        efter.log = [{ ts: stamp(), text: beskriv(nu.state, op), by: s.namn }, ...(efter.log || [])].slice(0, 200);
        const svar = store.skrivState(nu.rev, efter);
        if (!svar.ok) return svara(res, 409, { fel: "Någon hann före.", ...projekt(s) });
        return svara(res, 200, projekt(s));
      }

      if (url.pathname === "/api/logout" && req.method === "POST") {
        sessioner.delete((req.headers.authorization || "").replace(/^Bearer /, ""));
        return svara(res, 200, { ok: true });
      }

      return svara(res, 404, { fel: "Finns inte." });
    } catch {
      return svara(res, 400, { fel: "Trasig begäran." });
    }
  });
}

if (process.argv[1] && process.argv[1].endsWith("main.js")) {
  const store = new Store(DATA, startState(demoState));
  skapaServer(store).listen(PORT, VARD, () => {
    const konton = store.konton();
    console.log(`Jobbtavlan-servern lyssnar på http://${VARD}:${PORT}`);
    if (VARD === "127.0.0.1" || VARD === "localhost")
      console.log("Bunden till loopback. Ska den nås utifrån: sätt VARD=0.0.0.0 och ställ den bakom en proxy som sköter TLS.");
    else
      console.log("VARNING: servern talar ren http. Står den inte bakom TLS går pinkoder och plan i klartext.");
    if (!ORIGIN) console.log("ORIGIN är inte satt, så webbläsare från andra adresser nekas. Sätt ORIGIN=https://din.sida för webbklienten.");
    console.log(konton.length ? `Inloggningar: ${konton.map(k => k.namn + " (" + k.roll + ")").join(", ")}`
                              : "Inga inloggningar än. Kör: npm run server:konto -- <namn> <personId> <roll> <pinkod>");
  });
}
