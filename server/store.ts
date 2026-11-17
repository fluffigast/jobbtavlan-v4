/* Firmans plan på disk. En fil, skriven helt eller inte alls.
   Ingen databas: en firma med sex anställda ändrar planen några gånger om dagen. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { State } from "../src/domain/types";
import { Roll } from "../src/domain/roles";

export type Konto = { personId: string; roll: Roll; salt: string; hash: string };
export type Data = { rev: number; state: State; konton: Record<string, Konto> };

export function hashaPin(pin: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return { salt, hash };
}
export function stammerPin(pin: string, konto: Konto) {
  const { hash } = hashaPin(pin, konto.salt);
  // Jämför i konstant tid: annars läcker svarstiden hur många tecken som stämde.
  const a = Buffer.from(hash, "hex"), b = Buffer.from(konto.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class Store {
  private fil: string;
  private data: Data;

  constructor(katalog: string, start: () => State) {
    fs.mkdirSync(katalog, { recursive: true });
    this.fil = path.join(katalog, "plan.json");
    if (fs.existsSync(this.fil)) {
      this.data = JSON.parse(fs.readFileSync(this.fil, "utf8"));
    } else {
      this.data = { rev: 1, state: start(), konton: {} };
      this.skriv();
    }
  }

  private skriv() {
    const tmp = this.fil + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.fil);   // byte av namn är atomiskt, halva filer uppstår inte
  }

  las() { return { rev: this.data.rev, state: this.data.state }; }

  /* Skrivning med revisionskontroll. Den som räknat på ett gammalt underlag
     får veta det i stället för att råka skriva över någon annans ändring. */
  skrivState(rev: number, state: State): { ok: true; rev: number } | { ok: false; rev: number; state: State } {
    if (rev !== this.data.rev) return { ok: false, rev: this.data.rev, state: this.data.state };
    this.data.rev += 1;
    this.data.state = state;
    this.skriv();
    return { ok: true, rev: this.data.rev };
  }

  konto(namn: string) { return this.data.konton[namn.toLowerCase()]; }
  sattKonto(namn: string, personId: string, roll: Roll, pin: string) {
    this.data.konton[namn.toLowerCase()] = { personId, roll, ...hashaPin(pin) };
    this.skriv();
  }
  konton() { return Object.entries(this.data.konton).map(([namn, k]) => ({ namn, roll: k.roll, personId: k.personId })); }
}
