# Jobbtavlan v4

Planering, HR och grundskydd för en liten hantverksfirma, som app för Android och iOS.
Omskrivning av v3 (en enda HTML-fil) i Expo och React Native. All data är påhittad.

    npm install
    npm test
    npx expo start

Tryck `a` för Android eller `i` för iOS i terminalen, eller läs QR-koden med Expo Go
på en riktig telefon. Ändringar sparas lokalt på enheten.

- `DESIGN.md` beskriver vad som ändrades från v3 och varför.
- `CLAUDE.md` beskriver hur koden hänger ihop.

## Status

75 tester över datumräkning, bemanningsregler, demodata, handlingarna och
servern, körda med Node:s egen testkörare (`npm test`). De testar de riktiga
modulerna och riktig http, inget är ersatt med attrapper. Fem av dem är de hål
en granskning hittade i den första servern, och de ligger kvar som vakt.

Den delade planen är provad med två inloggade klienter mot en riktig server:
arbetsledaren fyller en lucka, och snickarens skärm räknar om sig utan att någon
trycker uppdatera. Provet ligger i `scripts/prov-delad-plan.mjs`.

Körd och genomgången på Android (emulator Pixel 9, Android 16, Expo Go, SDK 58).
Paketeringen för iOS går igenom (`npx expo export --platform ios`), men appen är
inte startad på en iOS-enhet: den här maskinen har Xcode utan nedladdad
simulatorkörtid. Inget i koden är Android-specifikt, men iOS är alltså oprövat.

## Delad plan

Utan server ligger planen i telefonen. Med server ser hela firman samma plan,
och sjukanmälan når arbetsledaren utan ett telefonsamtal.

    npm run server                                      # 127.0.0.1:8080, data i .data/
    npm run server:konto -- erik erik ledare <pinkod>   # arbetsledare
    npm run server:konto -- jonas jonas snickare <pinkod>

Logga sedan in i appen under kontoknappen, med serveradressen, ditt namn och
pinkoden. Pinkoderna lagras hashade. Skriv dem aldrig i repot eller i ett
kommando som hamnar i skalets historik.

Två roller: arbetsledaren ändrar planen, snickaren ser den, sjukanmäler sig själv
och rapporterar skumma sms. Servern avgör, inte appen.

### Innan den möter internet

Servern är skriven för en firma, inte för att stå naken på nätet. Som den står:

- **Binder loopback.** `VARD=0.0.0.0` krävs för att nås utifrån, och då ska den
  stå bakom en omvänd proxy som sköter TLS. Servern själv talar ren http.
- **Inga webbläsare utifrån** förrän `ORIGIN=https://din.sida` är satt.
- **Pinkoder minst sex tecken**, hashade med scrypt, jämförda i konstant tid.
- **Fem fel i rad spärrar** namnet och adressen i en kvart.
- **Tar emot handlingar, inte tillstånd.** Klienten kan be om "sätt in Maria på
  j1"; den kan inte påstå hur planen ser ut efteråt. Allt som följer av en
  handling räknas ut på servern.
- **Svaret skärs efter roll.** En snickare får inte kundregistret, kollegornas
  intyg, semestersaldon, inkorgen eller händelselistan.

Det som återstår innan den kan betjäna riktiga personuppgifter: TLS på riktigt,
säkerhetskopior, utgallring, och ett beslut om var datafilen får ligga.

## Webbversion och publicering

Samma kod kör också i en webbläsare via react-native-web. Det är inte appen,
men det räcker för att visa den på en adress utan att installera något.

    node scripts/build-web.mjs            # bygger dist/ för en projektsida
    node scripts/build-web.mjs --domain jobbtavlan.exempel.se   # egen domän
    npx serve dist                        # titta lokalt

`public/index.html` är sidans mall: språk, bakgrundsfärg i ljust och mörkt
läge innan bunten laddat. Expo fyller i titel och språk från `app.json`.

`.github/workflows/pages.yml` kör testerna, bygger och publicerar till GitHub
Pages vid varje push till `main`. För att koppla en egen underdomän:

1. Sätt variabeln `PAGES_DOMAIN` i repots inställningar till underdomänen.
2. Peka underdomänen med en CNAME till `<konto>.github.io` hos din DNS-leverantör.
3. Kör om arbetsflödet. Bygget skriver CNAME-filen och lägger bunten i roten.

Webbdemot ligger på https://fluffigast.github.io/jobbtavlan-v4/ och byggs av
arbetsflödet vid varje push. Vilken commit en publicerad sida kommer från står
under kontoknappen, så att sidan går att para ihop med källkoden.
