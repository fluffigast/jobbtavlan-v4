/* Datumräkningen är portad från v3. Den testas mot kända kalenderfakta,
   inte mot dagens datum, så att testet betyder samma sak varje dag. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { add, iso, monday, nice, niceAr, longDate, longDateAr, weekNo, pd, workday, digits, dayShort, dayNum } from "../src/domain/dates";

test("add räknar över månadsskifte och skottår", () => {
  assert.equal(add("2026-11-30", 1), "2026-12-01");
  assert.equal(add("2026-01-01", -1), "2025-12-31");
  assert.equal(add("2028-02-28", 1), "2028-02-29");
  assert.equal(add("2027-02-28", 1), "2027-03-01");
});

test("monday ger veckans måndag, och är sig själv på en måndag", () => {
  assert.equal(monday("2026-11-17"), "2026-11-16");
  assert.equal(monday("2026-11-16"), "2026-11-16");
  assert.equal(monday("2026-11-22"), "2026-11-16", "söndag hör till veckan som började");
});

test("weekNo följer ISO-veckor över årsskiftet", () => {
  assert.equal(weekNo("2026-11-17"), 47);
  assert.equal(weekNo("2026-01-01"), 1);
  assert.equal(weekNo("2025-12-29"), 1, "veckan som bär in i nästa år");
  assert.equal(weekNo("2027-01-04"), 1);
});

test("workday är sant måndag till fredag", () => {
  const vecka = [0, 1, 2, 3, 4, 5, 6].map(i => workday(add("2026-11-16", i)));
  assert.deepEqual(vecka, [true, true, true, true, true, false, false]);
});

test("iso och pd är varandras motsats", () => {
  assert.equal(iso(pd("2026-11-17")), "2026-11-17");
  assert.equal(pd("2026-11-17").getDate(), 17);
});

test("svenska namn på dagar och månader", () => {
  assert.equal(nice("2026-11-17"), "tis 17 nov");
  assert.equal(longDate("2026-11-17"), "tisdag 17 november 2026");
  assert.equal(dayShort("2026-11-16"), "mån");
  assert.equal(dayNum("2026-11-16"), "16");
});

test("digits skalar bort allt utom siffror", () => {
  assert.equal(digits("070-555 02 01"), "0705550201");
  assert.equal(digits("+46 70 555 02 01"), "46705550201");
  assert.equal(digits(undefined), "");
});

test("longDateAr sätter ut årtalet bara när det inte är i år", () => {
  const ar = new Date().getFullYear();
  assert.equal(longDateAr(ar + "-11-17"), longDate(ar + "-11-17").replace(" " + ar, ""));
  assert.equal(longDateAr((ar + 5) + "-11-17"), longDate((ar + 5) + "-11-17"));
});

test("niceAr sätter ut årtalet bara när det inte är i år", () => {
  const iAr = new Date().getFullYear();
  assert.equal(niceAr(iAr + "-12-05"), nice(iAr + "-12-05"), "i år räcker dag och månad");
  assert.equal(niceAr((iAr + 5) + "-12-05"), nice((iAr + 5) + "-12-05") + " " + (iAr + 5));
  assert.match(niceAr((iAr - 1) + "-01-20"), new RegExp(String(iAr - 1) + "$"), "även bakåt i tiden");
});
