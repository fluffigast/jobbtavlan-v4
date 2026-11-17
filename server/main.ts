/* Jobbtavlans server: håller firmans plan så att alla ser samma sak.
 *
 *   npm run server            # startar på port 8080, data i .data/
 *   npm run server:konto      # lägger upp en inloggning
 *
 * Inga beroenden utanför Node. Inga hemligheter i koden: pinkoder sätts med
 * kommandot ovan och ligger hashade i datafilen.
 */
import http from "node:http";
import crypto from "node:crypto";
import { Store } from "./store";
import { demoState } from "../src/domain/demo";
import { provaAndring, Roll } from "../src/domain/roles";
import { State } from "../src/domain/types";

const PORT = Number(process.env.PORT || 8080);
const DATA = process.env.DATA_DIR || ".data";
const ORIGIN = process.env.ORIGIN || "*";

type Session = { namn: string; personId: string; roll: Roll; sedd: number };
const TIMMAR_12 = 12 * 3600_000;

export function skapaServer(store: Store) {
  const sessioner = new Map<string, Session>();

  const session = (req: http.IncomingMessage): Session | null => {
    const t = (req.headers.authorization || "").replace(/^Bearer /, "");
    const s = t && sessioner.get(t);
    if (!s) return null;
    if (Date.now() - s.sedd > TIMMAR_12) { sessioner.delete(t); return null; }
    s.sedd = Date.now();
    return s;
  };

  const svara = (res: http.ServerResponse, kod: number, kropp: unknown) => {
    const text = JSON.stringify(kropp);
    res.writeHead(kod, {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ORIGIN,
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, PUT, POST, OPTIONS",
      "cache-control": "no-store",
    });
    res.end(text);
  };

  const kropp = (req: http.IncomingMessage) => new Promise<any>((ok, fel) => {
    let d = ""; let for_stor = false;
    req.on("data", c => {
      d += c;
      if (d.length > 4_000_000) { for_stor = true; req.destroy(); }   // ingen ska kunna fylla minnet
    });
    req.on("end", () => { if (for_stor) return fel(new Error("för stor")); try { ok(d ? JSON.parse(d) : {}); } catch (e) { fel(e); } });
    req.on("error", fel);
  });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://x");
    if (req.method === "OPTIONS") return svara(res, 204, {});

    try {
      if (url.pathname === "/api/health") return svara(res, 200, { ok: true });

      if (url.pathname === "/api/login" && req.method === "POST") {
        const b = await kropp(req);
        const konto = typeof b.namn === "string" ? store.konto(b.namn) : undefined;
        // Samma svar oavsett om namnet eller pinkoden var fel.
        if (!konto || typeof b.pin !== "string" || !stammer(b.pin, konto)) {
          await nyckelpaus();
          return svara(res, 401, { fel: "Fel namn eller pinkod." });
        }
        const token = crypto.randomBytes(24).toString("hex");
        sessioner.set(token, { namn: b.namn, personId: konto.personId, roll: konto.roll, sedd: Date.now() });
        const { rev, state } = store.las();
        return svara(res, 200, { token, roll: konto.roll, personId: konto.personId, rev, state });
      }

      const s = session(req);
      if (!s) return svara(res, 401, { fel: "Logga in igen." });

      if (url.pathname === "/api/state" && req.method === "GET") return svara(res, 200, store.las());

      if (url.pathname === "/api/state" && req.method === "PUT") {
        const b = await kropp(req);
        if (typeof b.rev !== "number" || !b.state) return svara(res, 400, { fel: "rev och state krävs." });
        const nu = store.las();
        // Reglerna prövas mot det servern har, inte mot det klienten påstår.
        const prov = provaAndring(s.roll, s.personId, nu.state, b.state as State);
        if (!prov.ok) return svara(res, 403, { fel: "Det får inte du ändra.", nekade: prov.nekade });
        const svar = store.skrivState(b.rev, b.state as State);
        if (!svar.ok) return svara(res, 409, { fel: "Någon hann före.", rev: svar.rev, state: svar.state });
        return svara(res, 200, { rev: svar.rev });
      }

      if (url.pathname === "/api/logout" && req.method === "POST") {
        sessioner.delete((req.headers.authorization || "").replace(/^Bearer /, ""));
        return svara(res, 200, { ok: true });
      }

      return svara(res, 404, { fel: "Finns inte." });
    } catch (e) {
      return svara(res, 400, { fel: "Trasig begäran." });
    }
  });
}

/* Importeras separat för att hålla main testbar utan att starta något. */
import { stammerPin as stammer } from "./store";
const nyckelpaus = () => new Promise(r => setTimeout(r, 300));

if (process.argv[1] && process.argv[1].endsWith("main.js")) {
  const store = new Store(DATA, demoState);
  skapaServer(store).listen(PORT, () => {
    const konton = store.konton();
    console.log(`Jobbtavlan-servern lyssnar på http://localhost:${PORT}`);
    console.log(konton.length ? `Inloggningar: ${konton.map(k => k.namn + " (" + k.roll + ")").join(", ")}`
                              : "Inga inloggningar än. Kör: npm run server:konto -- <namn> <personId> <roll> <pin>");
  });
}
