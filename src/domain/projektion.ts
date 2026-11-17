/* Vad varje roll får läsa.
 *
 * Appen gömde kundregistret för en snickare, men servern skickade det ändå.
 * Att gömma något i gränssnittet är ingen spärr: /api/state svarar likadant
 * oavsett vilken skärm som frågar. Därför skärs svaret till här, på servern.
 */
import { State, Person, Customer } from "./types";
import { Roll } from "./roles";

/* Snickaren behöver veta vart hen ska, vem som är med och vem som är borta.
   Hen behöver inte kollegornas intyg, semestersaldon, firmans kundregister
   eller inkorgen. */
export function visaFor(roll: Roll, migId: string | null, s: State): State {
  if (roll === "ledare") return s;

  const minaJobb = s.jobs;   // hela planen syns: veckovyn är till för att se laget
  const kundIds = new Set(minaJobb.map(j => j.customerId));

  const kunder: Customer[] = s.customers
    .filter(c => kundIds.has(c.id))
    .map(c => ({ id: c.id, name: c.name, contact: c.contact, phone: c.phone, address: c.address, status: c.status }));

  const folk: Person[] = s.people.map(p => {
    const bas: Person = {
      id: p.id, name: p.name, role: p.role, phone: p.id === migId ? p.phone : "",
      // Eget uttag syns för en själv: det är ens egna semesterdagar.
      away: p.away
        ? { type: p.away.type, from: p.away.from, to: p.away.to, ...(p.id === migId && p.away.dragna ? { dragna: p.away.dragna } : {}) }
        : null,
      vacLeft: p.id === migId ? p.vacLeft : null,
      mfa: p.id === migId ? p.mfa : true,
      certs: p.id === migId ? p.certs : [],
    };
    return bas;
  });

  return {
    rev: s.rev,
    firm: s.firm,
    jobs: minaJobb,
    customers: kunder,
    people: folk,
    sms: [],                                             // inkorgen är arbetsledarens
    security: s.security,                                // checklistan är allas sak
    incidents: s.incidents.filter(i => i.av && i.av === migId),
    log: [],                                             // händelselistan röjer det som skurits bort
  };
}
