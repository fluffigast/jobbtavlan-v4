/* Servern testas som den körs: riktig http, riktig fil på disk, riktiga svar.
   De fem hålen som granskningen hittade ligger här som regressionstester, så
   att de inte kan komma tillbaka obemärkt. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AddressInfo } from "node:net";
import { Store, startState } from "../server/store";
import { skapaServer, Installning } from "../server/main";
import { demoState } from "../src/domain/demo";
import { State } from "../src/domain/types";
import { today } from "../src/domain/dates";

const PIN_LEDARE = "sexsiffrig-ledare", PIN_SNICKARE = "sexsiffrig-snickare";
let bas = "", katalog = "", server: ReturnType<typeof skapaServer>, store: Store;

function starta(inst: Installning = {}) {
  const kat = fs.mkdtempSync(path.join(os.tmpdir(), "jobbtavlan-test-"));
  const st = new Store(kat, startState(demoState));
  const plan = st.las().state;
  st.sattKonto("erik", plan.people[0].id, "ledare", PIN_LEDARE);
  st.sattKonto("jonas", plan.people[1].id, "snickare", PIN_SNICKARE);
  const srv = skapaServer(st, inst);
  return { kat, st, srv };
}

before(async () => {
  // Hög gräns här: spärren prövas i en egen server, annars låser testsviten ut sig själv.
  const x = starta({ forsokMax: 10_000 });
  katalog = x.kat; store = x.st; server = x.srv;
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  bas = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
});
after(() => { server.close(); fs.rmSync(katalog, { recursive: true, force: true }); });

const J = { "content-type": "application/json" };
const post = (url: string, vag: string, kropp: unknown, token?: string) =>
  fetch(url + vag, { method: "POST", body: JSON.stringify(kropp), headers: { ...J, ...(token ? { authorization: "Bearer " + token } : {}) } });
const las = (token: string) => fetch(bas + "/api/state", { headers: { authorization: "Bearer " + token } });

type Inlogg = { token: string; roll: string; personId: string; rev: number; state: State };
const loggaIn = async (namn: string, pin: string, url = bas): Promise<Inlogg> => {
  const r = await post(url, "/api/login", { namn, pin });
  assert.equal(r.status, 200, "inloggning " + namn);
  return r.json() as Promise<Inlogg>;
};
const korOp = (i: Inlogg, op: unknown, rev = i.rev) => post(bas, "/api/op", { rev, op }, i.token);

test("hälsokollen svarar, planen kräver inloggning", async () => {
  assert.deepEqual(await (await fetch(bas + "/api/health")).json(), { ok: true });
  assert.equal((await fetch(bas + "/api/state")).status, 401);
  assert.equal((await post(bas, "/api/op", { rev: 1, op: { typ: "jobb-bort", id: "j1" } })).status, 401);
});

test("fel pinkod och okänt namn ger samma svar", async () => {
  const a = await post(bas, "/api/login", { namn: "erik", pin: "fel-pinkod" });
  const b = await post(bas, "/api/login", { namn: "finnsinte", pin: "fel-pinkod" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.deepEqual(await a.json(), await b.json());
});

test("okänt namn kostar lika mycket arbete som ett känt, annars läcker namnen", async () => {
  const mat = async (namn: string) => {
    const tider: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = Date.now();
      await post(bas, "/api/login", { namn, pin: "fel-pinkod" });
      tider.push(Date.now() - t);
    }
    return tider.sort((a, b) => a - b)[1];   // median
  };
  const kant = await mat("erik"), okant = await mat("finnsinte-alls");
  assert.ok(okant > kant * 0.5, `okänt namn gick för fort: ${okant}ms mot ${kant}ms`);
});

test("gissning spärras efter några fel, på namnet och på adressen", async () => {
  const { kat, srv } = starta({ forsokMax: 3, fonsterMs: 60_000 });
  await new Promise<void>(r => srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + (srv.address() as AddressInfo).port;
  try {
    for (let i = 0; i < 3; i++) assert.equal((await post(url, "/api/login", { namn: "erik", pin: "fel" + i })).status, 401);
    const spard = await post(url, "/api/login", { namn: "erik", pin: "fel4" });
    assert.equal(spard.status, 429, "fjärde försöket ska mötas av en spärr");
    assert.ok(spard.headers.get("retry-after"), "svaret säger hur länge");
    const rattPin = await post(url, "/api/login", { namn: "erik", pin: PIN_LEDARE });
    assert.equal(rattPin.status, 429, "spärren gäller även när pinkoden är rätt");
  } finally { srv.close(); fs.rmSync(kat, { recursive: true, force: true }); }
});

test("två telefoner ser samma plan: det ena trycket syns hos den andra", async () => {
  const ledare = await loggaIn("erik", PIN_LEDARE);
  const snickare = await loggaIn("jonas", PIN_SNICKARE);
  const jobb = ledare.state.jobs[0];
  const r = await korOp(ledare, { typ: "jobb-andra", id: jobb.id, jobb: {
    date: jobb.date, customerId: jobb.customerId, title: "Ändrat av Erik", need: jobb.need, people: jobb.people,
  } });
  assert.equal(r.status, 200);
  const hos = await (await las(snickare.token)).json() as { rev: number; state: State };
  assert.equal(hos.state.jobs.find(j => j.id === jobb.id)!.title, "Ändrat av Erik");
  assert.ok(hos.rev > ledare.rev);
});

test("den som räknat på ett gammalt underlag får veta det", async () => {
  const a = await loggaIn("erik", PIN_LEDARE);
  const j = a.state.jobs[0];
  const op = { typ: "jobb-andra", id: j.id, jobb: { date: j.date, customerId: j.customerId, title: "först", need: j.need, people: j.people } };
  assert.equal((await korOp(a, op)).status, 200);
  const sent = await korOp(a, { ...op, jobb: { ...op.jobb, title: "för sent" } }, a.rev);
  assert.equal(sent.status, 409);
  const svar = await sent.json() as { state: State };
  assert.equal(svar.state.jobs.find(x => x.id === j.id)!.title, "först");
});

/* ---- de fem hålen ---- */

test("HÅL 1: snickaren kan inte hitta på sitt eget semesteruttag", async () => {
  const j = await loggaIn("jonas", PIN_SNICKARE);
  const r = await korOp(j, { typ: "franvaro", personId: j.personId, away: { type: "Sjuk", from: today(), to: null, dragna: 500 } });
  assert.equal(r.status, 400, "fältet finns inte i protokollet");

  const ok = await korOp(j, { typ: "franvaro", personId: j.personId, away: { type: "Semester", from: "2026-11-16", to: "2026-11-20" } });
  assert.equal(ok.status, 200);
  const efter = await (await las(j.token)).json() as { state: State };
  const jag = efter.state.people.find(p => p.id === j.personId)!;
  assert.equal(jag.away!.dragna, 5, "servern räknar uttaget själv");
});

test("HÅL 2: händelselistan går inte att skriva om, och okända fält nekas", async () => {
  const j = await loggaIn("jonas", PIN_SNICKARE);
  assert.equal((await korOp(j, { typ: "logg-skriv", rader: [{ ts: "2020-01-01 00:00", text: "Erik raderade allt" }] })).status, 400);
  assert.equal((await korOp(j, { typ: "franvaro-bort", personId: j.personId, bakdorr: 1 })).status, 400);
  const ledare = await loggaIn("erik", PIN_LEDARE);
  const logg = (await (await las(ledare.token)).json() as { state: State }).state.log;
  assert.equal(logg.some(l => /raderade allt/.test(l.text)), false);
  assert.ok(logg.every(l => !!l.by), "varje rad bär vem som gjorde det");
});

test("HÅL 3: snickaren kan inte lägga in ett sms i någon annans namn", async () => {
  const j = await loggaIn("jonas", PIN_SNICKARE);
  const r = await korOp(j, { typ: "sms-ny", id: "falskt", from: "070-555 01 01", text: "Jag är sjuk idag" });
  assert.equal(r.status, 403, "inkorgen är arbetsledarens");
  const ledare = await loggaIn("erik", PIN_LEDARE);
  assert.equal((await (await las(ledare.token)).json() as { state: State }).state.sms.some(m => m.id === "falskt"), false);
});

test("HÅL 4: sms som arbetsledaren lägger in bär vem som la in det", async () => {
  const e = await loggaIn("erik", PIN_LEDARE);
  assert.equal((await korOp(e, { typ: "sms-ny", id: "akta", from: "070-555 02 01", text: "Ring mig" })).status, 200);
  const efter = (await (await las(e.token)).json() as { state: State }).state;
  const m = efter.sms.find(x => x.id === "akta")!;
  assert.equal(m.av, e.personId);
  assert.match(m.ts, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, "tiden sätts av servern");
});

test("HÅL 5: snickaren får bara läsa det hen behöver", async () => {
  const j = await loggaIn("jonas", PIN_SNICKARE);
  const sedd = (await (await las(j.token)).json() as { state: State }).state;

  assert.deepEqual(sedd.sms, [], "inkorgen syns inte");
  assert.deepEqual(sedd.log, [], "händelselistan syns inte");
  assert.ok(sedd.incidents.every(i => i.av === j.personId), "bara egna rapporter");

  const kollegor = sedd.people.filter(p => p.id !== j.personId);
  assert.ok(kollegor.every(p => (p.certs || []).length === 0), "kollegors intyg syns inte");
  assert.ok(kollegor.every(p => p.vacLeft === null), "kollegors semestersaldon syns inte");
  assert.ok(kollegor.every(p => !p.phone), "kollegors nummer syns inte");
  assert.ok(kollegor.every(p => p.name), "men namnen gör det, annars går planen inte att läsa");

  assert.ok(sedd.customers.every(c => !("project" in c) || c.project === undefined), "kundernas uppdrag syns inte");
  const ledare = await loggaIn("erik", PIN_LEDARE);
  const allt = (await (await las(ledare.token)).json() as { state: State }).state;
  assert.ok(allt.sms.length > 0 && allt.log.length > 0, "arbetsledaren ser allt");
  assert.ok(allt.customers.some(c => c.project), "inklusive uppdragen");
});

test("snickaren får sjukanmäla sig själv, men inte någon annan", async () => {
  const j = await loggaIn("jonas", PIN_SNICKARE);
  const annan = j.state.people.find(p => p.id !== j.personId)!;
  assert.equal((await korOp(j, { typ: "franvaro", personId: j.personId, away: { type: "Sjuk", from: today(), to: null } })).status, 200);
  const fars = await loggaIn("jonas", PIN_SNICKARE);
  assert.equal((await korOp(fars, { typ: "franvaro", personId: annan.id, away: { type: "Sjuk", from: today(), to: null } })).status, 403);
});

test("snickaren får rapportera, och rapporten bär hens namn", async () => {
  const j = await loggaIn("jonas", PIN_SNICKARE);
  assert.equal((await korOp(j, { typ: "rapport-ny", id: "r-jonas", text: "konstigt sms om faktura", who: "Erik" })).status, 200);
  const e = await loggaIn("erik", PIN_LEDARE);
  const r = (await (await las(e.token)).json() as { state: State }).state.incidents.find(i => i.id === "r-jonas")!;
  assert.equal(r.who, "jonas", "inloggningen går före det klienten påstår");
  assert.equal(r.av, j.personId);
});

test("snickaren kommer inte åt planen, kunderna eller grundskyddet", async () => {
  const j = await loggaIn("jonas", PIN_SNICKARE);
  const jobb = j.state.jobs[0];
  for (const op of [
    { typ: "jobb-bort", id: jobb.id },
    { typ: "bemanning", jobbId: jobb.id, personer: [j.personId] },
    { typ: "kund-ny", id: "ny", kund: { name: "Jag själv", contact: "", phone: "", address: "", project: "", status: "Pågår" } },
    { typ: "grundskydd", id: "c1", done: true },
    { typ: "person-bort", id: j.state.people[0].id },
  ]) {
    const r = await korOp(j, op);
    assert.equal(r.status, 403, "nekas: " + op.typ);
  }
});

test("utloggning gör token oanvändbar, och planen överlever en omstart", async () => {
  const a = await loggaIn("erik", PIN_LEDARE);
  const j = a.state.jobs[0];
  await korOp(a, { typ: "jobb-andra", id: j.id, jobb: { date: j.date, customerId: j.customerId, title: "sparat", need: j.need, people: j.people } });
  assert.equal((await post(bas, "/api/logout", {}, a.token)).status, 200);
  assert.equal((await las(a.token)).status, 401);
  const igen = new Store(katalog, startState(demoState));
  assert.equal(igen.las().state.jobs.find(x => x.id === j.id)!.title, "sparat");
});
