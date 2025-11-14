import fs from "fs";
import path from "path";
import vm from "vm";
import Papa from "papaparse";

const SHEET_SOURCE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSE0Uj_7o0hhbiJq9tiaNhN1XvM-6TDz3me8v_4V-mLEHaN4Up8Owb9A9wyli33shDIUMpvdoSPQzD0/pubhtml";
const SHEET_CSV = SHEET_SOURCE.replace(/\/pubhtml(?:\?.*)?$/, "/pub?output=csv");
const OUT_FILE = path.resolve("assets/js/neighborhoods-data.js");
const ONLY_SLUG = process.env.ONLY_SLUG || ""; // e.g. queen-anne

const toSlug = s => String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
const normalize = s => String(s||"")
  .replace(/single-family/gi,"single family")
  .replace(/multi-family/gi,"multifamily")
  .replace(/mid-rise/gi,"midrise")
  .replace(/\s+/g," ")
  .trim();
const sentence = s => { const t=String(s||"").trim().replace(/[.!?]+$/,""); return t ? t.charAt(0).toUpperCase()+t.slice(1)+"." : ""; };

async function fetchCSV(url){ const r=await fetch(url); if(!r.ok) throw new Error(`CSV fetch failed: ${r.status} ${r.statusText}`); return r.text(); }
function parseCSV(text){ return Papa.parse(text,{header:true,skipEmptyLines:true}).data; }

const pick = (row, ...keys) => {
  for (const key of keys) {
    const val = row[key];
    if (val != null && String(val).trim()) return String(val);
  }
  return "";
};

function buildFromSheet(rows){
  const out = {};
  for(const row of rows){
    const slugSource = pick(row, "Neighborhood", "neighborhood", "slug", "Slug", "name");
    const slug=toSlug(slugSource);
    if(!slug) continue;
    if(ONLY_SLUG && slug!==ONLY_SLUG) continue; // limit during test
    const medianValue = pick(row, "Median Value", "medianValue");
    const medianRent  = pick(row, "Median Rent", "medianRent");
    const bullet1     = pick(row, "Bullet 1", "bullet1", "Median Value", "medianValue");
    const bullet2     = pick(row, "Bullet 2", "bullet2", "Median Rent", "medianRent");
    const bullet3     = pick(row, "Bullet 3", "bullet3");
    const types       = pick(row, "What's Built Here", "Types", "types");
    const vibes       = pick(row, "Why People Live Here", "Vibes", "vibes");
    const around      = pick(row, "How to Get Around", "Around", "around");
    const insights    = pick(row, "Zor's Insights", "Insights", "insights");
    const heroImage   = pick(row, "Hero Image", "heroImage", "Hero", "hero");

    const bullets = [];
    [bullet1, bullet2, bullet3].forEach(item => {
      if (item && item.trim()) bullets.push(item.trim());
    });

    out[slug] = {
      ...(row.name ? {name: normalize(row.name)} : {}),
      ...(row.city ? {city: normalize(row.city), citySlug: toSlug(row.city)} : {}),
      ...(row.subtitle ? {subtitle: normalize(row.subtitle)} : {}),
      ...(bullets.length ? {bullets: bullets.map(sentence)} : {}),
      ...(types ? {homes: normalize(types)} : {}),
      ...(vibes ? {vibes: normalize(vibes)} : {}),
      ...(around ? {around: normalize(around)} : {}),
      ...(insights ? {insights: normalize(insights)} : {}),
      ...(heroImage ? {heroImage: heroImage.trim()} : {}),
      ...((bullet1 || medianValue) ? {bullet1: bullet1 || medianValue} : {}),
      ...((bullet2 || medianRent) ? {bullet2: bullet2 || medianRent} : {}),
      ...(bullet3 ? {bullet3} : {}),
      ...(medianValue ? {medianValue} : {}),
      ...(medianRent ? {medianRent} : {}),
      ...(row.mapEmbed ? {mapEmbed: row.mapEmbed.trim()} : {})
    };
  }
  return out;
}

function loadExistingMap(filePath){
  if(!fs.existsSync(filePath)) return {};
  const code = fs.readFileSync(filePath,"utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "neighborhoods-data.js" });
  return sandbox.window?.NEIGHBORHOODS || {};
}

function deepMerge(base, patch){
  for(const slug of Object.keys(patch)){
    base[slug] = { ...(base[slug]||{}), ...(patch[slug]||{}) };
  }
  return base;
}

function emitJS(obj){
  const banner = `/**
 * GENERATED MERGE — Existing file + Sheet overrides
 * Build time: ${new Date().toISOString()}
 */\n`;
  return `${banner}window.NEIGHBORHOODS = ${JSON.stringify(obj,null,2)};\n`;
}

async function main(){
  console.log(`[merge] Loading existing ${OUT_FILE}…`);
  const existing = loadExistingMap(OUT_FILE);

  console.log("[merge] Fetching & parsing sheet…");
  const csv = await fetchCSV(SHEET_CSV);
  const rows = parseCSV(csv);
  const patch = buildFromSheet(rows);

  const slugs = Object.keys(patch);
  if(!slugs.length){
    console.log(ONLY_SLUG ? `[merge] No rows for slug "${ONLY_SLUG}". Nothing to do.` : "[merge] No patch rows found.");
    process.exit(0);
  }
  console.log(`[merge] Will update slugs: ${slugs.join(", ")}`);

  const merged = deepMerge({...existing}, patch);

  // Write merged file
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, emitJS(merged), "utf8");
  console.log(`[merge] ✅ Wrote: ${OUT_FILE}`);
}
main().catch(e => { console.error("[merge] ❌", e); process.exit(1); });
