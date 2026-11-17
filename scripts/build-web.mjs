#!/usr/bin/env node
/* Bygger webbversionen till dist/.
 *
 * GitHub Pages serverar en projektsida under /<repo>/, en egen (under)domän
 * under /. Tillgångarnas sökvägar måste följa med, annars laddar sidan tomt.
 *
 *   node scripts/build-web.mjs                 # /jobbtavlan-v4 (projektsida)
 *   node scripts/build-web.mjs --base ""       # egen domän, rot
 *   node scripts/build-web.mjs --domain app.exempel.se   # rot + CNAME-fil
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const domain = arg("domain", "");
const base = domain ? "" : arg("base", "/jobbtavlan-v4");

/* Byggstämpeln: vilken commit sidan kommer från. Skrivs in före bygget och
   återställs efteråt, så att arbetskopian inte bär en stämpel. */
const byggeFil = "src/bygge.ts";
const byggeOriginal = fs.readFileSync(byggeFil, "utf8");
let commit = "okänd";
try { commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
let smutsig = false;
try { smutsig = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0; } catch {}
fs.writeFileSync(byggeFil,
  byggeOriginal.replace('commit: "dev", tid: ""',
    `commit: "${commit}${smutsig ? "+ändrat" : ""}", tid: "${new Date().toISOString().slice(0, 16).replace("T", " ")}"`));

const file = "app.json";
const original = fs.readFileSync(file, "utf8");
const config = JSON.parse(original);
config.expo.experiments = { ...(config.expo.experiments || {}), baseUrl: base };
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

try {
  console.log(`Bygger webb med baseUrl ${JSON.stringify(base)}${domain ? ` för ${domain}` : ""}`);
  execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", "dist", "--clear"], { stdio: "inherit" });
} finally {
  // Varken app.json eller byggstämpeln ska ändras av ett bygge.
  fs.writeFileSync(file, original);
  fs.writeFileSync(byggeFil, byggeOriginal);
}

// Utan .nojekyll hoppar GitHub Pages över kataloger som börjar med _, och
// hela bunten ligger i _expo/.
fs.writeFileSync("dist/.nojekyll", "");
if (domain) fs.writeFileSync("dist/CNAME", domain + "\n");

const index = fs.readFileSync("dist/index.html", "utf8");
const src = index.match(/src="([^"]+)"/)?.[1] ?? "";
if (!src.startsWith(base || "/")) throw new Error(`Fel sökväg i index.html: ${src}`);
console.log(`Klart. dist/ innehåller ${fs.readdirSync("dist").length} poster, bunten laddas från ${src}`);
