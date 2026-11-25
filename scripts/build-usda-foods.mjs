// Builds src/data/usda-foods.json from the USDA FoodData Central "Survey (FNDDS)"
// CSV download (public domain): https://fdc.nal.usda.gov/download-datasets
//
// Usage: node scripts/build-usda-foods.mjs <path-to-extracted-csv-folder>
//
// Output: [[name, kcalPer100g, carbsPer100g, proteinPer100g, [[unitLabel, grams], ...], [alias, ...]], ...]

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/build-usda-foods.mjs <csv-folder>');
  process.exit(1);
}
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'src', 'data', 'usda-foods.json');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function eachRow(file, fn) {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, file)), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    if (!header) { header = cells; continue; }
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i]));
    fn(row);
  }
}

const foods = new Map(); // fdc_id -> { name, kcal, portions: [], aliases: [] }
await eachRow('food.csv', (r) => foods.set(r.fdc_id, { name: r.description, kcal: null, carbs: 0, protein: 0, portions: [], aliases: [] }));
await eachRow('food_nutrient.csv', (r) => {
  if ((r.nutrient_id === '1008' || r.nutrient_id === '208') && foods.has(r.fdc_id)) foods.get(r.fdc_id).kcal = Number(r.amount);
  if ((r.nutrient_id === '1005' || r.nutrient_id === '205') && foods.has(r.fdc_id)) foods.get(r.fdc_id).carbs = Number(r.amount);
  if ((r.nutrient_id === '1003' || r.nutrient_id === '203') && foods.has(r.fdc_id)) foods.get(r.fdc_id).protein = Number(r.amount);
});

const SKIP_PORTION = /cubic inch|surface inch|yields|guideline|calorie package|^oz\b|^g\b|gram/i;
const RENAME = { tablespoon: 'tbsp', teaspoon: 'tsp', 'quantity not specified': 'serving' };

function parseLeadingAmount(s) {
  const m = s.match(/^(\d+)\s+(\d+)\/(\d+)\s+|^(\d+)\/(\d+)\s+|^(\d+(?:\.\d+)?)\s+/);
  if (!m) return { amount: 1, rest: s };
  let amount;
  if (m[1]) amount = Number(m[1]) + Number(m[2]) / Number(m[3]);
  else if (m[4]) amount = Number(m[4]) / Number(m[5]);
  else amount = Number(m[6]);
  return { amount, rest: s.slice(m[0].length) };
}

await eachRow('food_portion.csv', (r) => {
  const f = foods.get(r.fdc_id);
  const grams = Number(r.gram_weight);
  if (!f || !(grams > 0)) return;
  let desc = r.portion_description.trim();
  if (!desc || SKIP_PORTION.test(desc.replace(/^[\d/.\s]+/, ''))) return;
  const { amount, rest } = parseLeadingAmount(desc);
  if (!(amount > 0)) return;
  let label = rest.replace(/\s*\(.*$/, '').split(',')[0].trim().toLowerCase();
  label = RENAME[label] ?? label;
  if (!label || label.length > 24) return;
  if (f.portions.some((p) => p[0] === label)) return;
  f.portions.push([label, Math.round((grams / amount) * 10) / 10, Number(r.seq_num)]);
});

await eachRow('food_attribute.csv', (r) => {
  const f = foods.get(r.fdc_id);
  if (!f || r.food_attribute_type_id !== '1001' || !r.value) return;
  const v = r.value.trim().toLowerCase();
  if (v.length > 2 && v.length <= 40 && !/^\d/.test(v) && !v.includes('ns as to')) f.aliases.push(v);
});

/** "Brussels sprouts, NS as to form, cooked" -> "Brussels sprouts, cooked" */
function cleanName(name) {
  return name
    .split(', ')
    .filter((seg) => !/^(NFS|NS as to .*|NS)$/i.test(seg.trim()))
    .join(', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Descriptions shared by many foods ("cooking spray", "all types") aren't useful names.
const aliasCount = new Map();
for (const f of foods.values()) for (const a of new Set(f.aliases)) aliasCount.set(a, (aliasCount.get(a) ?? 0) + 1);

const EXCLUDE = /\b(baby food|infant formula|human milk|toddler formula)\b/i;
const seen = new Set();
const out = [];
for (const f of foods.values()) {
  if (f.kcal === null || EXCLUDE.test(f.name)) continue;
  let name = cleanName(f.name);
  if (seen.has(name.toLowerCase())) name = f.name;
  if (seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  // Specific portions (cup, slice, medium...) first in USDA order, "serving" last.
  const portions = f.portions
    .sort((a, b) => (a[0] === 'serving') - (b[0] === 'serving') || a[2] - b[2])
    .map(([l, g]) => [l, g]);
  const entry = [name, Math.round(f.kcal), Math.round(f.carbs * 10) / 10, Math.round(f.protein * 10) / 10, portions];
  const aliases = [...new Set(f.aliases)].filter((a) => aliasCount.get(a) <= 5);
  if (aliases.length) entry.push(aliases);
  out.push(entry);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`Wrote ${out.length} foods to ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
