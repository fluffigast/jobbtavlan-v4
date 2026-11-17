/* Demodata är en del av produkten här: ett demo som öppnar på en tom dag, eller
   på en lucka ingen kan fylla, visar inte vad verktyget är till för.
   Testerna är därför invarianter över demot, inte avskrifter av innehållet. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoState } from "../src/domain/demo";
import { monday, today, weekNo, pd, iso } from "../src/domain/dates";
import { free, jobsOn, shortage, weekDays, isWeekend, out } from "../src/domain/logic";

const s = demoState();
const veckan = weekDays(monday(today()));

test("demodata pekar bara på personer och kunder som finns", () => {
  const pids = new Set(s.people.map(p => p.id));
  const cids = new Set(s.customers.map(c => c.id));
  for (const j of s.jobs) {
    assert.ok(cids.has(j.customerId), `jobb ${j.id} pekar på okänd kund ${j.customerId}`);
    for (const id of j.people) assert.ok(pids.has(id), `jobb ${j.id} pekar på okänd person ${id}`);
    assert.ok(j.need >= 1, `jobb ${j.id} behöver minst en person`);
  }
  for (const key of ["firm", "people", "customers", "jobs", "sms", "security", "incidents", "log"] as const) {
    assert.ok(s[key], `demodata saknar ${key}`);
  }
});

test("alla id:n är unika", () => {
  const unika = (xs: { id: string }[]) => new Set(xs.map(x => x.id)).size === xs.length;
  assert.ok(unika(s.people), "personer");
  assert.ok(unika(s.customers), "kunder");
  assert.ok(unika(s.jobs), "jobb");
  assert.ok(unika(s.sms), "sms");
});

test("demot ligger i innevarande vecka, oavsett när det öppnas", () => {
  for (const d of veckan) {
    assert.ok(jobsOn(s, d).length > 0, `${d} saknar jobb`);
    assert.equal(weekNo(d), weekNo(today()), `${d} hamnade i fel vecka`);
  }
});

test("förskjutningen sker i hela veckor, så inget jobb landar på en helg", () => {
  for (const j of s.jobs) assert.equal(isWeekend(j.date), false, `jobb ${j.id} ligger på en helg: ${j.date}`);
});

test("varje vardag saknar exakt en person och har någon som är ledig", () => {
  for (const d of veckan) {
    const brist = jobsOn(s, d).reduce((a, j) => a + shortage(s, j), 0);
    assert.equal(brist, 1, `${d} borde sakna exakt en person, saknar ${brist}`);
    assert.ok(free(s, d).length >= 1, `${d} har ingen ledig som kan fylla luckan`);
  }
});

test("någon är frånvarande under veckan, annars finns ingen lucka att förklara", () => {
  const borta = veckan.flatMap(d => s.people.filter(p => out(p, d)).map(p => p.id));
  assert.ok(borta.length > 0, "ingen är borta någon dag i veckan");
});

test("veckan efter är inbokad, så pilen framåt visar något", () => {
  const nasta = weekDays(monday(iso(new Date(+pd(monday(today())) + 7 * 864e5))));
  assert.ok(nasta.some(d => jobsOn(s, d).length > 0), "tom vecka efter den här");
});

test("inkorgen är daterad till den här veckan, inte till förra månaden", () => {
  const start = monday(today()), slut = veckan[veckan.length - 1];
  for (const m of s.sms) {
    const dag = m.ts.split(" ")[0];
    assert.ok(dag >= start && dag <= slut, `sms ${m.id} är daterat ${dag}, utanför veckan`);
    assert.match(m.ts, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  }
  for (const i of s.incidents) {
    const dag = i.ts.split(" ")[0];
    assert.ok(dag >= start && dag <= slut, `rapport ${i.id} är daterad ${dag}, utanför veckan`);
  }
});

test("demoState är rent: två anrop ger samma data och delar inte referenser", () => {
  const a = demoState(), b = demoState();
  assert.deepEqual(a, b);
  a.jobs[0].title = "ändrad";
  assert.notEqual(demoState().jobs[0].title, "ändrad", "demodata läcker mellan anrop");
});

test("minst ett intyg är utgånget och minst ett är på väg ut", () => {
  const alla = s.people.flatMap(p => p.certs || []);
  const t = today();
  assert.ok(alla.some(c => c.expires < t), "inget utgånget intyg att visa");
  assert.ok(alla.some(c => c.expires >= t && c.expires <= iso(new Date(+pd(t) + 60 * 864e5))), "inget intyg på väg ut");
});

test("grundskyddet har både avklarade och öppna punkter", () => {
  assert.ok(s.security.some(i => i.done), "inget är klart");
  assert.ok(s.security.some(i => !i.done), "inget är öppet");
  assert.ok(s.people.some(p => !p.mfa), "alla har tvåsteg, då syns inte den automatiska punkten");
});
