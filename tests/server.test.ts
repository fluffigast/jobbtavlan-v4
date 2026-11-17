/* Servern testas som den körs: riktig http, riktig fil på disk, riktiga svar.
   Ingenting är ersatt med en attrapp, för det är just plumbningen som ska hålla. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AddressInfo } from "node:net";
import { Store } from "../server/store";
import { skapaServer } from "../server/main";
import { demoState } from "../src/domain/demo";
import { State } from "../src/domain/types";
import { today } from "../src/domain/dates";

let bas = "", katalog = "", server: ReturnType<typeof skapaServer>, store: Store;

before(async () => {
  katalog = fs.mkdtempSync(path.join(os.tmpdir(), "jobbtavlan-test-"));
  store = new Store(katalog, demoState);
  const plan = store.las().state;
  store.sattKonto("erik", plan.people[0].id, "ledare", "4821");
  store.sattKonto("jonas", plan.people[1].id, "snickare", "7390");
  server = skapaServer(store);
  await new Promise<void>(r => server.listen(0, r));
  bas = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
});

after(() => { server.close(); fs.rmSync(katalog, { recursive: true, force: true }); });

const post = (vag: string, kropp: unknown, token?: string) =>
  fetch(bas + vag, {
    method: "POST", body: JSON.stringify(kropp),
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
  });
const put = (vag: string, kropp: unknown, token: string) =>
  fetch(bas + vag, {
    method: "PUT", body: JSON.stringify(kropp),
    headers: { "content-type": "application/json", authorization: "Bearer " + token },
  });
const loggaIn = async (namn: string, pin: string) => {
  const r = await post("/api/login", { namn, pin });
  assert.equal(r.status, 200, "inloggning " + namn);
  return r.json() as Promise<{ token: string; roll: string; personId: string; rev: number; state: State }>;
};

test("hälsokollen svarar utan inloggning", async () => {
  const r = await fetch(bas + "/api/health");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test("planen kräver inloggning", async () => {
  const r = await fetch(bas + "/api/state");
  assert.equal(r.status, 401);
});

test("fel pinkod släpps inte in, och avslöjar inte vad som var fel", async () => {
  const a = await post("/api/login", { namn: "erik", pin: "0000" });
  const b = await post("/api/login", { namn: "finnsinte", pin: "0000" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.deepEqual(await a.json(), await b.json());
});

test("arbetsledaren loggar in och får hela planen", async () => {
  const { token, roll, state } = await loggaIn("erik", "4821");
  assert.equal(roll, "ledare");
  assert.ok(state.jobs.length > 0);
  const r = await fetch(bas + "/api/state", { headers: { authorization: "Bearer " + token } });
  assert.equal(r.status, 200);
});

test("två telefoner ser samma plan: det ena trycket syns hos den andra", async () => {
  const ledare = await loggaIn("erik", "4821");
  const snickare = await loggaIn("jonas", "7390");

  const ny: State = JSON.parse(JSON.stringify(ledare.state));
  ny.jobs[0].title = "Gjuta plintar, ändrat av Erik";
  const skriv = await put("/api/state", { rev: ledare.rev, state: ny }, ledare.token);
  assert.equal(skriv.status, 200);

  const hos = await fetch(bas + "/api/state", { headers: { authorization: "Bearer " + snickare.token } });
  const sedd = await hos.json() as { rev: number; state: State };
  assert.equal(sedd.state.jobs[0].title, "Gjuta plintar, ändrat av Erik");
  assert.ok(sedd.rev > ledare.rev, "revisionen räknas upp");
});

test("den som skriver på gammalt underlag får veta det, inte skriva över", async () => {
  const a = await loggaIn("erik", "4821");
  const forst: State = JSON.parse(JSON.stringify(a.state));
  forst.jobs[0].title = "först";
  const r1 = await put("/api/state", { rev: a.rev, state: forst }, a.token);
  assert.equal(r1.status, 200);

  const sent: State = JSON.parse(JSON.stringify(a.state));
  sent.jobs[0].title = "för sent";
  const r2 = await put("/api/state", { rev: a.rev, state: sent }, a.token);
  assert.equal(r2.status, 409);
  const svar = await r2.json() as { rev: number; state: State };
  assert.equal(svar.state.jobs[0].title, "först", "servern behåller det som hann först");
});

test("snickaren får sjukanmäla sig själv", async () => {
  const j = await loggaIn("jonas", "7390");
  const ny: State = JSON.parse(JSON.stringify(j.state));
  ny.people.find(p => p.id === j.personId)!.away = { type: "Sjuk", from: today(), to: null };
  const r = await put("/api/state", { rev: j.rev, state: ny }, j.token);
  assert.equal(r.status, 200);
});

test("snickaren får inte röra planen, och servern säger vad som stoppades", async () => {
  const j = await loggaIn("jonas", "7390");
  const ny: State = JSON.parse(JSON.stringify(j.state));
  ny.jobs[0].title = "jag flyttar det här";
  const r = await put("/api/state", { rev: j.rev, state: ny }, j.token);
  assert.equal(r.status, 403);
  assert.deepEqual((await r.json() as any).nekade, ["jobb"]);
});

test("snickaren får inte sjukanmäla någon annan", async () => {
  const j = await loggaIn("jonas", "7390");
  const annan = j.state.people.find(p => p.id !== j.personId)!;
  const ny: State = JSON.parse(JSON.stringify(j.state));
  ny.people.find(p => p.id === annan.id)!.away = { type: "Semester", from: today(), to: null };
  const r = await put("/api/state", { rev: j.rev, state: ny }, j.token);
  assert.equal(r.status, 403);
});

test("snickaren får rapportera något skumt", async () => {
  const j = await loggaIn("jonas", "7390");
  const ny: State = JSON.parse(JSON.stringify(j.state));
  ny.incidents.push({ id: "t1", ts: "2026-11-16 09:00", who: "Jonas", text: "konstigt sms om faktura", done: false });
  const r = await put("/api/state", { rev: j.rev, state: ny }, j.token);
  assert.equal(r.status, 200);
});

test("utloggning gör token oanvändbar", async () => {
  const a = await loggaIn("erik", "4821");
  assert.equal((await post("/api/logout", {}, a.token)).status, 200);
  const r = await fetch(bas + "/api/state", { headers: { authorization: "Bearer " + a.token } });
  assert.equal(r.status, 401);
});

test("planen överlever en omstart av servern", async () => {
  const a = await loggaIn("erik", "4821");
  const ny: State = JSON.parse(JSON.stringify(a.state));
  ny.firm = "Kvist & Tapp Snickeri AB (sparad)";
  await put("/api/state", { rev: a.rev, state: ny }, a.token);
  const igen = new Store(katalog, demoState);
  assert.equal(igen.las().state.firm, "Kvist & Tapp Snickeri AB (sparad)");
});
