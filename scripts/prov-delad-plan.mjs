/* Prov av den delade planen, körs för hand mot en lokal server.
 *
 *   npm run server                                   # i ett fönster
 *   npm run server:konto -- erik erik ledare <pin>
 *   npm run server:konto -- jonas jonas snickare <pin>
 *   node scripts/build-web.mjs --base "" && npx serve dist -l 8792
 *   PINS=/sökväg/till/pins APP=... SRV=... node scripts/prov-delad-plan.mjs
 *
 * Pinkoderna läses ur en fil med raderna ERIK=.... och JONAS=....
 * Skriv dem aldrig i repot eller i ett kommando som hamnar i historiken.
 */
import { chromium } from '/Users/ak/.nvm/versions/node/v20.20.2/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const pins = Object.fromEntries(fs.readFileSync(process.env.PINS || '/tmp/jt-data/.pins','utf8').trim().split('\n').map(r=>r.split('=')));
const out=process.env.OUT || '/tmp/audit/jobbtavlan-v4/delad'; fs.mkdirSync(out,{recursive:true});
const APP=process.env.APP || 'http://127.0.0.1:8792/', SRV=process.env.SRV || 'http://127.0.0.1:8099';
const b = await chromium.launch();

/* Fliken ligger sist i dokumentet; rubriken med samma ord ligger först. */
async function flik(p, namn) {
  const viaRoll = p.getByRole('tab', { name: namn });
  if (await viaRoll.count()) { await viaRoll.first().click({ force:true }); return; }
  await p.getByText(namn, { exact:true }).last().click({ force:true });
}

async function loggaIn(namn, pin, etikett) {
  const ctx = await b.newContext({ viewport:{width:412,height:880} });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(etikett,'PAGEERROR', e.message));
  await p.goto(APP, { waitUntil:'networkidle' });
  await p.waitForTimeout(1000);
  await flik(p, 'Skydd');
  await p.waitForTimeout(800);
  const falt = p.locator('input');
  await falt.nth(0).fill(SRV);
  await falt.nth(1).fill(namn);
  await falt.nth(2).fill(pin);
  const knapp = p.getByText('Logga in', { exact:true });
  await knapp.scrollIntoViewIfNeeded();
  await knapp.click({ force:true });
  await p.waitForTimeout(2500);
  const text = await p.evaluate(() => document.body.innerText);
  const ok = /Arbetsledare|Snickare/.test(text);
  console.log(etikett, 'inloggad:', ok ? 'ja' : 'NEJ');
  if (!ok) console.log(etikett, text.slice(0,300).replace(/\n+/g,' | '));
  await p.screenshot({ path: out+'/'+etikett+'-inloggad.png' });
  return p;
}

const ledare = await loggaIn('erik', pins.ERIK, 'ledare');
const snickare = await loggaIn('jonas', pins.JONAS, 'snickare');

const flikar = await snickare.evaluate(() => {
  const rader = document.body.innerText;
  return ['Idag','Vecka','Register','Inkorg','Skydd'].filter(f => rader.includes(f));
});
console.log('snickaren har flikarna:', flikar.join(', '));

await flik(ledare, 'Idag');
await ledare.waitForTimeout(1000);
const knapp = ledare.locator('text=/^Sätt in /').first();
console.log('ledaren trycker:', (await knapp.textContent()).trim());
await knapp.scrollIntoViewIfNeeded();
await knapp.click({ force:true });
await ledare.waitForTimeout(2000);
await ledare.screenshot({ path: out+'/ledare-efter.png' });

await flik(snickare, 'Idag');
let sett = false, text = '';
for (let i=0;i<12 && !sett;i++) {
  await snickare.waitForTimeout(1000);
  text = await snickare.evaluate(() => document.body.innerText);
  sett = /Allt bemannat/.test(text);
}
console.log('snickaren ser ledarens ändring utan att trycka något:', sett ? 'JA' : 'NEJ');
console.log(text.slice(0,200).replace(/\n+/g,' | '));
await snickare.screenshot({ path: out+'/snickare-efter.png' });
await b.close();
