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

32 tester över datumräkning, bemanningsregler och demodata, körda med Node:s
egen testkörare (`npm test`). De testar de riktiga modulerna, inget är ersatt
med attrapper.

Körd och genomgången på Android (emulator Pixel 9, Android 16, Expo Go, SDK 58).
Paketeringen för iOS går igenom (`npx expo export --platform ios`), men appen är
inte startad på en iOS-enhet: den här maskinen har Xcode utan nedladdad
simulatorkörtid. Inget i koden är Android-specifikt, men iOS är alltså oprövat.

## Webbversion och publicering

Samma kod kör också i en webbläsare via react-native-web. Det är inte appen,
men det räcker för att visa den på en adress utan att installera något.

    node scripts/build-web.mjs            # bygger dist/ för en projektsida
    node scripts/build-web.mjs --domain jobbtavlan.exempel.se   # egen domän
    npx serve dist                        # titta lokalt

`.github/workflows/pages.yml` kör testerna, bygger och publicerar till GitHub
Pages vid varje push till `main`. För att koppla en egen underdomän:

1. Sätt variabeln `PAGES_DOMAIN` i repots inställningar till underdomänen.
2. Peka underdomänen med en CNAME till `<konto>.github.io` hos din DNS-leverantör.
3. Kör om arbetsflödet. Bygget skriver CNAME-filen och lägger bunten i roten.

Repot är ännu inte skapat på GitHub, så ingenting är publicerat.
