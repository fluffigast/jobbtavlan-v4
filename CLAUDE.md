@AGENTS.md

# Jobbtavlan v4

Planeringsverktyg för små hantverksfirmor: dagens jobb, veckoplanering, kunder,
sms-logg, HR och en säkerhetschecklista. Android och iOS, Expo och React Native.
All data i repot är påhittad demodata (Kvist & Tapp Snickeri AB).

Föregångaren v3 var en enda HTML-fil för skrivbordsskärm. `DESIGN.md` håller
besluten bakom omskrivningen.

## Kommandon

- `npm test` bygger `tests/` med `tsconfig.test.json` och kör dem med Node:s egen
  testkörare. Kör alltid efter en ändring i `src/domain/` eller i demodata.
- `npx tsc --noEmit` typkontroll av appen. `tests/` ligger utanför den och har
  egna Node-typer, därför två konfigurationer.
- `npx expo start` startar Metro, `a` öppnar på Android, `i` på iOS.
- `npx expo export --platform ios` paketerar utan att starta, bra när ingen
  simulator finns installerad.
- `npm run server` startar den delade planen lokalt på loopback.
  `npm run server:konto` lägger upp en inloggning.

## Delad plan

- `src/domain/ops.ts` är hjärtat: handlingarna, vad de gör (`tillampa`), vem som
  får göra dem (`farGora`), vad som hamnar i loggen (`beskriv`), hur de ångras
  (`invers`) och hur något som kommer utifrån tolkas (`tolka`).
- `src/domain/projektion.ts` vad varje roll får läsa.
- `server/` egen liten server utan beroenden: `store.ts` (en JSON-fil, skriven
  helt eller inte alls), `main.ts` (http, sessioner, spärr), `konto.ts`.
- `src/sync.ts` klientsidan. Allt får misslyckas utan att appen gör det.
- Krockar löses genom att göra om samma handling på serverns tillstånd, inte
  genom att skriva över. Se `upp()` i `src/store.tsx`.

### Regler som inte får tummas på

- **Servern tar aldrig emot ett tillstånd.** En gång gjorde den det, och då gick
  det att skicka med ett påhittat semesteruttag, skriva om händelseloggen och
  lägga in ett sms i någon annans namn. Lägg till en handling i stället.
- **Allt utifrån går genom `tolka()`.** Okända nycklar är inte extra, de är ett
  försök. Lägg till fältet i tolken eller låt bli att skicka det.
- **Det klienten påstår om sig själv gäller inte.** Tid, avsändare, vem som
  rapporterade och vad som dras från semestersaldot sätts av mottagaren.
- **Att gömma något i appen är ingen spärr.** Skär bort det i `projektion.ts`
  också, annars ligger det i svaret ändå.

## Struktur

- `src/domain/actions.ts` ändringar som flera skärmar gör likadant: tillsätta,
  sjukanmäla, dra semesterdagar, förnya intyg. Lägg en ändring här så fort den
  görs från mer än ett ställe, annars blir "nästan samma sak" på två ställen.
- `src/domain/` logiken utan skärm: `dates.ts` och `logic.ts` är portade rakt av
  från v3:s `app.js`, samma funktionsnamn. `demo.json` är startdata, `demo.ts`
  skjuter den till innevarande vecka.
- `src/store.tsx` hela tillståndet i en React-context. Varje ändring går genom
  `edit(meddelande, fn)`, som loggar, sparar i AsyncStorage och visar en toast.
- `src/ui/kit.tsx` alla byggdelar: `Badge`, `Btn`, `Card`, `Row`, `Sheet`, `Field`.
  `src/ui/Screen.tsx` skärmskalet med titelrad.
- `src/screens/` en fil per flik. `src/sheets/Sheets.tsx` alla dialoger, öppnas
  med `useSheet()({ t: "job", id })`.
- `src/theme.ts` färger och mått, ljust och mörkt. Samma tokens som v3:s CSS.
- `tests/` rena noder utan skärm: `dates`, `logic` och `demo`. De två första
  bygger sina egna lägen, den sista vaktar invarianterna i demodata.

## Regler

- Svenska i all text som användaren ser.
- Stil: sakligt verktyg. Listor, 56 px som minsta radhöjd, 4 px-rutnät, färg bara
  som små lägesmärken. Inga stora färgade ytor, inga versalrubriker, inga emoji.
- Träffytor minst 44 px.
- Ändra aldrig `S` direkt. Allt går genom `edit()`, annars sparas det inte och
  hamnar inte i händelselistan.
- Lägg aldrig in riktiga person- eller kunduppgifter i `src/domain/demo.json`.
- Telefonnummer jämförs alltid med `telNyckel()`, aldrig tecken för tecken.
  Samma nummer skrivs på fem sätt och telefonen väljer sitt.
- Semestersaldot ändras bara genom `sattFranvaro()` och `taBortFranvaro()`.
  Räknar du dagar på egen hand någonstans blir saldot fel vid andra ändringen.
- Demodata ska hålla sig till sin invariant: varje vardag i ankarveckan har jobb,
  saknar exakt en person och har exakt en ledig. Ändrar du `demo.json`, kör
  `npm test` och läs vad som brast innan du ändrar testet.

## Kända luckor

- Ingen inloggning och inga roller. Den som har telefonen ser och ändrar allt.
- Allt ligger på enheten. Ingen server, ingen synk mellan två telefoner, ingen
  backup om telefonen försvinner.
- Sms läses inte in automatiskt, de skrivs in för hand. Se `DESIGN.md`.
- Händelselistan är ett minnesstöd, inte en granskningslogg som går att lita på.
- Inte startad på iOS, se `README.md`.
- Ingen push, ingen kalendersynk, ingen offlinekö (behövs inte, allt är lokalt).
