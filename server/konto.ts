/* Lägger upp eller ändrar en inloggning.
 *   npm run server:konto -- erik erik ledare 4821
 * Pinkoden lagras hashad. Skriv den aldrig i ett chattfönster eller i repot. */
import { Store } from "./store";
import { demoState } from "../src/domain/demo";
import { Roll } from "../src/domain/roles";

const [namn, personId, roll, pin] = process.argv.slice(2);
if (!namn || !personId || !roll || !pin) {
  console.error("Användning: npm run server:konto -- <namn> <personId> <ledare|snickare> <pinkod>");
  process.exit(1);
}
if (roll !== "ledare" && roll !== "snickare") { console.error("Rollen måste vara ledare eller snickare."); process.exit(1); }
if (pin.length < 4) { console.error("Pinkoden behöver minst fyra tecken."); process.exit(1); }

const store = new Store(process.env.DATA_DIR || ".data", demoState);
const finns = store.las().state.people.some(p => p.id === personId);
if (!finns) {
  console.error(`Ingen person med id ${personId} i planen. Finns: ${store.las().state.people.map(p => p.id).join(", ")}`);
  process.exit(1);
}
store.sattKonto(namn, personId, roll as Roll, pin);
console.log(`Inloggning klar för ${namn} som ${roll}. Pinkoden är hashad i datafilen.`);
