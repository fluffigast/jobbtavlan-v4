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

const file = "app.json";
const original = fs.readFileSync(file, "utf8");
const config = JSON.parse(original);
config.expo.experiments = { ...(config.expo.experiments || {}), baseUrl: base };
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

try {
  console.log(`Bygger webb med baseUrl ${JSON.stringify(base)}${domain ? ` för ${domain}` : ""}`);
  execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", "dist", "--clear"], { stdio: "inherit" });
} finally {
  // app.json ska inte ändras av ett bygge.
  fs.writeFileSync(file, original);
}

// Utan .nojekyll hoppar GitHub Pages över kataloger som börjar med _, och
// hela bunten ligger i _expo/.
fs.writeFileSync("dist/.nojekyll", "");
if (domain) fs.writeFileSync("dist/CNAME", domain + "\n");

const index = fs.readFileSync("dist/index.html", "utf8");
const src = index.match(/src="([^"]+)"/)?.[1] ?? "";
if (!src.startsWith(base || "/")) throw new Error(`Fel sökväg i index.html: ${src}`);
console.log(`Klart. dist/ innehåller ${fs.readdirSync("dist").length} poster, bunten laddas från ${src}`);
