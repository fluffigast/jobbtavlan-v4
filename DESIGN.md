# Från v3 till v4: vad som ändrades och varför

v3 var en enda HTML-fil, byggd för en skrivbordsskärm: sidomeny till vänster,
verktygsrad överst, breda tabeller. Den stod kvar i v3:s egen lista över luckor
att "telefonbredd inte är genomgången". v4 är en app, och då är telefonen inte
ett specialfall utan hela fallet.

## Valet av stack

Expo och React Native, ett kodförråd för båda plattformarna.

Alternativen var att slå in v3:s HTML i en webbvy (Capacitor), eller att skriva
två appar. Webbvyn hade blivit samma skrivbordsgränssnitt bakom en app-ikon, och
det var just det som skulle bort. Två appar är dubbelt underhåll för en firma
med sex anställda. Expo ger dessutom native flikrad, native ark som reser sig
underifrån, systemets mörka läge och tryck-för-att-ringa utan extra arbete.

Domänlogiken skrevs inte om. `out`, `shortage`, `free`, `certState`, `jobsOn`
och datumfunktionerna är portade rakt av från v3:s `app.js` med samma namn. Det
är den delen som är värd något, och den delen var redan rätt.

## Navigeringen: sex menyposter blir fem flikar

v3 hade Idag, Veckoplanering, Kunder, Sms, HR och Säkerhet i en sidomeny.
En flikrad rymmer fem utan att bli en smal remsa med trunkerade ord.

| v3 | v4 |
| --- | --- |
| Idag | Idag |
| Veckoplanering | Vecka |
| Kunder, HR | Register, med ett läge för var sak |
| Sms | Inkorg, sms och rapporter i var sitt läge |
| Säkerhet | Skydd |

Kunder och personal är båda register man slår i, och de delar sökfält och
radform. Sms och rapporter är båda inkommande saker som ska betas av. Att para
ihop dem frigjorde plats utan att slå ihop sådant som gör olika saker.

Händelseloggen låg i v3 längst ned på Idag. Den flyttade till Skydd. På en
telefon är Idag redan lång, och loggen läses när något ska redas ut, inte varje
morgon.

## Veckovyn: tabellen blir ett rutnät av lägesmärken

v3 ritade en tabell med en kolumn per dag och jobbets namn i varje ruta. Fem
kolumner plus en namnkolumn blir runt 52 px per ruta på en telefon. Där får
ingen text plats.

v4 behåller rutnätet, för det är det som svarar på frågan "vem är var i veckan",
men rutan bär bara läget: blå för bemannat jobb, rosa för jobb som saknar folk,
streckad för ledig, grå för borta. Första ordet i kundnamnet får plats och
räcker för att känna igen jobbet. Trycket öppnar det v3 visade direkt i rutan.
Under rutnätet står en teckenförklaring med samma rutor som i tabellen, inte med
färgprickar som ser annorlunda ut än det de förklarar.

## Tabellrader blir listrader

En tabellrad med sju kolumner blir på en telefon antingen en vågrät rullning
eller sju staplade etiketter. v4 gör i stället en listrad: kundnamn starkt
överst, uppdrag och adress som underrad, lägesmärken på en egen rad, och den
enda knapp raden faktiskt behöver till höger. Resten av kolumnerna ligger kvar
men flyttade in i detaljarket.

Radhöjden gick från 48 px till 56 px som golv. 48 px är rimligt för en muspekare.
En tumme träffar sämre, och både Apple och Google sätter sitt golv vid 44 px för
själva träffytan, inte för raden runt den.

## Dialoger blir ark, och datumsnurran blir en remsa

v3:s modaler mitt på skärmen blev ark som reser sig underifrån, med rullning och
en fotrad som alltid syns. Spara-knappen är därför alltid nåbar utan att man
rullar tillbaka.

Datum väljs inte med systemets datumsnurra utan med en remsa dagar man drar i
sidled. Jobb planeras någon vecka framåt. För det avståndet är ett tryck
snabbare än att öppna en snurra, välja och bekräfta. Remsan går tre dagar bakåt och drygt
tre veckor framåt, och längre än så går inte att välja i arket. Det är
avsiktligt: planering längre fram hör hemma i en kalendervy, inte i en
snabbinmatning.

Kundlistan i jobb-arket ligger på en rad som dras i sidled. Tio kunder som
radbryts åt halva arket och tryckte ned allt annat under skärmkanten.

## Demodata som inte blir gammal

v3:s data var daterad till en bestämd vecka i november 2026. En demo som öppnas
veckan efter visar en tom dag.

v4 skjuter all data till innevarande vecka vid start, i hela veckor så att
veckodagarna stämmer. Dessutom är veckan lagd så att demot alltid har ett
problem som går att lösa, vilken vardag det än öppnas: Jonas är sjuk hela
veckan, varje vardag saknar därför exakt en person på ett jobb, och exakt en
annan är ledig just den dagen. Vem som är ledig roterar över veckan. Öppna
appen, tryck Ersättare, välj personen, och dagen är bemannad. Det är hela
poängen med verktyget, och det syns på tio sekunder.

Den invarianten är inte en förhoppning utan ett test: `tests/demo.test.ts`
faller om någon vardag saknar jobb, saknar fler eller färre än en person, eller
inte har någon ledig som kan fylla luckan.

## Vad appen kan som webbsidan inte kunde

- Tryck på ett telefonnummer ringer upp.
- Flikraden bär siffror: hur många som saknas idag, olästa i inkorgen, öppna
  punkter i skyddet. De syns utan att man öppnar fliken.
- Mörkt läge följer systemet.
- En liten vibration när något sparas.
- Appen ligger kvar på telefonen och startar utan nät.

## Vad som inte löstes

**Sms läses fortfarande in för hand.** Det är inte lättja. iOS ger ingen app
tillgång till inkommande sms, punkt. Android gör det, men `READ_SMS` är en av de
behörigheter Google bara släpper igenom för appar vars huvudsyfte är
meddelandehantering, och ett planeringsverktyg är inte det. Den ärliga vägen
framåt är att låta personalen dela ett sms till appen via systemets delningsmeny,
vilket är ett tryck i stället för en avskrift. Det är inte byggt.

**Sms läses fortfarande in för hand**, av skälen ovan. Det är den sista biten
teater som står kvar.


## Delad plan, roller och krockar

Den första versionen av v4 höll planen i telefonen. Det var fel väg. Ett
planeringsverktyg som inte delar planen är ett anteckningsblock: sjukanmälan når
ingen, två personer ser olika veckor, och försvinner telefonen är planen borta.

Nu finns en server i `server/`. Den är avsiktligt liten: en JSON-fil som skrivs
helt eller inte alls, sessioner i minnet, inga beroenden utanför Node. En firma
med sex anställda ändrar planen några gånger om dagen, och då är en databas en
sak till som kan gå sönder på ett tak i Norrland.

**Roller.** Arbetsledaren ändrar planen. Snickaren ser den, sjukanmäler sig själv
och rapporterar skumma sms. Reglerna står i `src/domain/roles.ts` och används av
båda sidor, men bara serverns ord gäller: appen ligger i någon annans telefon och
får aldrig vara den som avgör. Appen gömmer det som ändå skulle nekas, för en
knapp som alltid säger nej är sämre än ingen knapp. Kundregistret syns inte alls
för en snickare, för en tappad telefon ska inte vara en tappad kundlista.

**Krockar.** Två personer kan trycka samtidigt. Servern räknar upp en revision
vid varje skrivning och avvisar den som räknat på ett gammalt underlag. Klienten
svarar inte med att skriva över, utan med att göra om samma handling på det
servern har. Den som satte in Maria får Maria insatt, även om någon hann boka ett
jobb emellan.

**Utan nät.** Allt fungerar vidare lokalt, och skärmen säger att de andra inte
ser det än. Det är sämre än synk, men det är ärligt, och det är vad en telefon på
ett tak faktiskt kan lova.

## Idéer som bara var påbörjade, och vad som gjordes med dem

Första omgången av v4 hade rätt skärmar men flera halva tankar. Det här är vad
som fattades och hur de avslutades.

**Kontot låg i en checklista.** Inloggning, synkstatus och återställning av
demot låg under Skydd, bland punkter om lösenordshanterare och backup. Det är
två olika frågor: "hur skyddar firman sig" och "vem är jag och var sparas det
här". Nu finns en kontoknapp i huvudet på varje skärm, med en prick som är grå i
demoläge, grön när allt är hos firman och gul när kontakten är borta. Frågan
"sparas det här någonstans?" dyker upp där man råkar stå, inte i en flik man
måste komma på att öppna.

**Inkorgen var en lista att läsa.** Ett sms är sällan bara text. Det är en kund
som vill boka, eller någon som inte kommer. Nu står handlingen i meddelandet:
känt kundnummer ger "Boka in Familjen Lind", personalnummer ger "Sjukanmäl
Jonas", okänt nummer ger "Lägg upp som kund". Appen vet redan vem numret
tillhör, den gjorde bara ingenting med det.

**Semesterdagarna var en siffra som ingen rörde.** Nu drar en inlagd semester
sina vardagar, och arket säger vad det kostar innan man sparar. Tas semestern
bort kommer dagarna tillbaka, och ändras den räknas den om i stället för att dras
dubbelt. Uttaget sparas på frånvaron, inte som en gissning i efterhand. Går
någon över sitt saldo visas ett minus, för en tyst nolla är en lögn som upptäcks
vid löneköringen.

**Intygen var märken att titta på.** Ett intyg som gått ut blev rött och sedan
hände ingenting. Nu är märket en knapp som förnyar, med val på ett, två, tre
eller fem år. Appen gissar inte giltighetstiden: ID06 är fem år, fallskydd ofta
ett, och den som förnyar vet vilket.

**Loggen visste inte vem.** Med inloggning finns ett namn, och då ska det stå
där. Utan inloggning står det inget, för ett namn utan inloggning är en gissning.

**Den inloggade såg firmans dag, inte sin egen.** En snickare som öppnar appen
vill först veta var hen ska stå idag och med vem. Nu ligger "Din dag" överst när
appen vet vem som håller i telefonen, med adress, kollega och ett tryck för att
ringa kunden. För arbetsledaren ligger luckorna kvar överst, för det är den
frågan som är hens.

**En bugg som testet hittade.** Telefonen skickar nummer som +46 70 555 01 02,
registret innehåller 070-555 01 02. Jämförelsen var tecken för tecken, så ett sms
från en känd kund blev "okänt nummer". Det är nu översatt till en gemensam form
för svenska nummer, med testet kvar som vakt.