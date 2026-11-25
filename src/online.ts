import { normalize, perKcal } from './foodDb';
import { FoodOption } from './foodSearch';

/**
 * USDA FoodData Central search (https://fdc.nal.usda.gov/api-guide).
 * DEMO_KEY works without signing up but is rate-limited (about 10 searches/hour per
 * network). For more, get a free key at https://fdc.nal.usda.gov/api-key-signup and put it here.
 */
const API_KEY = 'DEMO_KEY';
const URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

type FdcNutrient = { nutrientNumber?: string; unitName?: string; value?: number };
type FdcMeasure = { disseminationText?: string; gramWeight?: number };
type FdcFood = {
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: FdcNutrient[];
  foodMeasures?: FdcMeasure[];
};

export class OnlineError extends Error {}

const cache = new Map<string, FoodOption[]>();

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** "BRUSSELS SPROUTS" -> "Brussels sprouts" */
function tidy(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t !== t.toUpperCase()) return t;
  const lower = t.toLowerCase();
  return lower[0].toUpperCase() + lower.slice(1);
}

/** Grams per 100 g of a nutrient by USDA number ('205' carbs, '203' protein, '307' sodium mg). */
function gramsPer100(f: FdcFood, nutrientNumber: string): number | undefined {
  const n = (f.foodNutrients ?? []).find((x) => x.nutrientNumber === nutrientNumber && typeof x.value === 'number');
  return n?.value;
}

function kcalPer100(f: FdcFood): number | null {
  const ns = f.foodNutrients ?? [];
  for (const num of ['208', '958', '957']) {
    const n = ns.find((x) => x.nutrientNumber === num && typeof x.value === 'number');
    if (n) return n.unitName?.toUpperCase() === 'KJ' ? n.value! / 4.184 : n.value!;
  }
  return null;
}

/** "1 cup, chopped" -> { label: "cup", amount: 1 } */
function measureLabel(text: string): { label: string; amount: number } | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?|\d+\/\d+)?\s*(.*)$/);
  if (!m) return null;
  const amount = m[1]?.includes('/') ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1]) : Number(m[1] ?? 1);
  let label = m[2]
    .replace(/\s*\(.*$/, '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (label === 'tablespoon') label = 'tbsp';
  if (label === 'teaspoon') label = 'tsp';
  if (!label || label.length > 24 || /quantity not specified/.test(label) || !(amount > 0)) return null;
  return { label, amount };
}

function toOption(f: FdcFood): FoodOption | null {
  const per100 = kcalPer100(f);
  if (per100 === null) return null;
  const units: Record<string, number> = {};
  const unitOrder: string[] = [];
  const add = (label: string, grams: number) => {
    if (label in units || !(grams > 0)) return;
    units[label] = round1((per100 * grams) / 100);
    unitOrder.push(label);
  };
  for (const m of f.foodMeasures ?? []) {
    const parsed = m.disseminationText ? measureLabel(m.disseminationText) : null;
    if (parsed && m.gramWeight) add(parsed.label, m.gramWeight / parsed.amount);
  }
  const su = f.servingSizeUnit?.toLowerCase();
  if (f.servingSize && (su === 'g' || su === 'grm' || su === 'ml' || su === 'mlt')) add('serving', f.servingSize);
  const liquid = su === 'ml' || su === 'mlt';
  units[liquid ? 'ml' : 'g'] = round1(per100);
  units.oz = round1((per100 * (liquid ? 29.57 : 28.35)) / 100);

  const brand = f.brandName || f.brandOwner;
  const name = brand ? `${tidy(f.description)} (${tidy(brand)})` : tidy(f.description);
  return {
    name,
    units,
    defaultUnit: unitOrder[0] ?? (liquid ? 'ml' : 'g'),
    countUnit: unitOrder.find((u) => !['cup', 'tbsp', 'tsp', 'fl oz', 'serving'].includes(u)) ?? null,
    carbsPerKcal: perKcal(per100, gramsPer100(f, '205')),
    proteinPerKcal: perKcal(per100, gramsPer100(f, '203')),
    sodiumPerKcal: perKcal(per100, gramsPer100(f, '307')),
    terms: [normalize(name)],
    source: 'online',
  };
}

export async function searchOnline(query: string): Promise<FoodOption[]> {
  const key = normalize(query);
  const hit = cache.get(key);
  if (hit) return hit;
  const url = `${URL}?api_key=${API_KEY}&pageSize=10&requireAllWords=true&query=${encodeURIComponent(query)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new OnlineError('No internet connection.');
  }
  if (res.status === 429) throw new OnlineError('Online search limit reached for this hour. Try again later.');
  if (!res.ok) throw new OnlineError(`Online search failed (${res.status}).`);
  const json = (await res.json()) as { foods?: FdcFood[] };
  const seen = new Set<string>();
  const results: FoodOption[] = [];
  for (const f of json.foods ?? []) {
    const o = toOption(f);
    if (!o || seen.has(o.terms[0])) continue;
    seen.add(o.terms[0]);
    results.push(o);
  }
  cache.set(key, results);
  return results;
}
