import { DbFood, FOOD_DB, normalize } from './foodDb';
import { SavedFood } from './storage';

export type FoodOption = {
  name: string;
  /** kcal per unit; for g/ml the value is per 100. */
  units: Record<string, number>;
  defaultUnit: string;
  countUnit: string | null;
  /** Grams of carbs per kcal; null if unknown. */
  carbsPerKcal: number | null;
  /** Grams of protein per kcal; null if unknown. */
  proteinPerKcal: number | null;
  terms: string[];
  source: 'mine' | 'db' | 'usda' | 'online';
};

const STOPWORDS = new Set(['with', 'and', 'of', 'the', 'a', 'an', 'in', 'on', 'or', 'some']);

function words(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w));
}

// ---------- Index over the built-in foods (built once) ----------

type Indexed = { food: FoodOption; nameWords: string[]; allWords: Set<string>; tier: number };

function fromDb(f: DbFood): FoodOption {
  return {
    name: f.name,
    units: f.units,
    defaultUnit: f.defaultUnit,
    countUnit: f.countUnit,
    carbsPerKcal: f.carbsPerKcal,
    proteinPerKcal: f.proteinPerKcal,
    terms: f.terms,
    source: f.tier === 0 ? 'db' : 'usda',
  };
}

const DB_INDEX: Indexed[] = FOOD_DB.map((f) => ({
  food: fromDb(f),
  nameWords: f.terms[0].split(' '),
  allWords: new Set(f.terms.flatMap((t) => t.split(' '))),
  tier: f.tier,
}));

/** word -> indexes into DB_INDEX */
const WORD_MAP = new Map<string, number[]>();
DB_INDEX.forEach((entry, i) => {
  for (const w of entry.allWords) {
    const list = WORD_MAP.get(w);
    if (list) list.push(i);
    else WORD_MAP.set(w, [i]);
  }
});
const VOCAB = [...WORD_MAP.keys()];

/** Optimal string alignment distance (Levenshtein + adjacent swaps), capped at max+1. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Vocabulary words that match a query word, with a cost (0 = exact). */
function matchWord(q: string, isLast: boolean): Map<string, number> {
  const out = new Map<string, number>();
  const maxEdits = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  for (const w of VOCAB) {
    if (w === q) out.set(w, 0);
    else if (isLast && q.length >= 2 && w.startsWith(q)) out.set(w, 0.4);
    else if (maxEdits > 0) {
      const dist = editDistance(q, w, maxEdits);
      if (dist <= maxEdits) out.set(w, 0.8 * dist);
    }
  }
  return out;
}

const AVOID = new Set(['baby', 'infant', 'toddler', 'formula']);

type Scored = { food: FoodOption; score: number };

/** Each query word a food doesn't contain adds this much (so "extra virgin olive oil" still finds olive oil). */
const MISSING_WORD = 1.5;

function searchDb(qWords: string[]): Scored[] {
  if (qWords.length === 0) return [];
  const matches = qWords.map((q, i) => matchWord(q, i === qWords.length - 1));

  // Count how many query words each food matches; it must match at least half of them.
  const hits = new Map<number, number>();
  for (const m of matches) {
    const ids = new Set<number>();
    for (const w of m.keys()) for (const id of WORD_MAP.get(w) ?? []) ids.add(id);
    for (const id of ids) hits.set(id, (hits.get(id) ?? 0) + 1);
  }
  // Words that appear in no food at all ("organic", "homemade") don't count against a match.
  const known = matches.filter((m) => m.size > 0).length;
  if (known === 0) return [];
  const needed = Math.max(1, Math.ceil(known / 2));

  const results: Scored[] = [];
  for (const [id, count] of hits) {
    if (count < needed) continue;
    const entry = DB_INDEX[id];
    let score = 0;
    let inName = 0;
    for (const m of matches) {
      let best = Infinity;
      let bestInName = false;
      for (const w of entry.allWords) {
        const c = m.get(w);
        if (c === undefined) continue;
        const isName = entry.nameWords.includes(w);
        const cost = c + (isName ? 0 : 0.6);
        if (cost < best) {
          best = cost;
          bestInName = isName;
        }
      }
      score += best === Infinity ? MISSING_WORD : best;
      if (bestInName) inName++;
    }
    // Prefer short, plain names ("Brussels sprouts, raw" over "... with cheese sauce").
    score += 0.12 * Math.max(0, entry.nameWords.length - inName);
    if (entry.nameWords.some((w) => AVOID.has(w))) score += 3;
    if (entry.nameWords.includes('raw')) score += 0.15;
    if (entry.tier === 0) score -= 0.5;
    if (matches[0].has(entry.nameWords[0])) score -= 0.3;
    results.push({ food: entry.food, score });
  }
  return results.sort((a, b) => a.score - b.score || a.food.name.length - b.food.name.length);
}

// ---------- The user's own foods ----------

export function mineOptions(saved: Record<string, SavedFood>): FoodOption[] {
  return Object.values(saved)
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .map((f) => {
      const units = f.units ?? { [f.unit]: f.kcalPer };
      return {
        name: f.name,
        units,
        defaultUnit: f.unit in units ? f.unit : Object.keys(units)[0],
        countUnit: f.countUnit ?? null,
        carbsPerKcal: f.carbsPerKcal ?? null,
        proteinPerKcal: f.proteinPerKcal ?? null,
        terms: [normalize(f.name)],
        source: 'mine' as const,
      };
    });
}

function searchMine(qWords: string[], mine: FoodOption[]): Scored[] {
  const out: Scored[] = [];
  for (const f of mine) {
    const fw = f.terms[0].split(' ');
    let score = 0;
    for (const [i, q] of qWords.entries()) {
      const isLast = i === qWords.length - 1;
      let best = Infinity;
      for (const w of fw) {
        if (w === q) best = 0;
        else if (isLast && q.length >= 2 && w.startsWith(q)) best = Math.min(best, 0.4);
        else {
          const maxEdits = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
          const dist = maxEdits ? editDistance(q, w, maxEdits) : 1;
          if (dist <= maxEdits) best = Math.min(best, 0.8 * dist);
        }
      }
      score += best;
    }
    if (score < Infinity) out.push({ food: f, score: score + 0.12 * Math.max(0, fw.length - qWords.length) - 1 });
  }
  return out;
}

// ---------- Public API ----------

export function searchFoods(query: string, mine: FoodOption[], limit = 6): FoodOption[] {
  const qWords = words(query);
  if (qWords.length === 0) return mine.slice(0, limit);
  const all = [...searchMine(qWords, mine), ...searchDb(qWords)];
  const seen = new Set<string>();
  const out: FoodOption[] = [];
  for (const r of all.sort((a, b) => a.score - b.score)) {
    const key = normalize(r.food.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.food);
    if (out.length >= limit) break;
  }
  return out;
}

/** Exact match on a food's name or alias: the user's foods, then the hand-picked list, then USDA. */
export function findExact(query: string, mine: FoodOption[]): FoodOption | null {
  const q = normalize(query);
  if (!q) return null;
  const m = mine.find((o) => o.terms.includes(q));
  if (m) return m;
  const ids = WORD_MAP.get(q.split(' ')[0]) ?? [];
  let best: Indexed | null = null;
  for (const id of ids) {
    const e = DB_INDEX[id];
    if (e.food.terms.includes(q) && (!best || e.tier < best.tier)) best = e;
  }
  return best?.food ?? null;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  dozen: 12,
};

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

const UNIT_WORDS: Record<string, string> = {
  g: 'g',
  gr: 'g',
  gram: 'g',
  grams: 'g',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tbs: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  slice: 'slice',
  slices: 'slice',
  piece: 'piece',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  can: 'can',
  cans: 'can',
  glass: 'glass',
  glasses: 'glass',
  bottle: 'bottle',
  bottles: 'bottle',
  scoop: 'scoop',
  scoops: 'scoop',
  serving: 'serving',
  servings: 'serving',
  bowl: 'cup',
  bowls: 'cup',
  small: 'small',
  medium: 'medium',
  large: 'large',
};

function parseAmount(token: string): number | null {
  if (token in NUMBER_WORDS) return NUMBER_WORDS[token];
  if (token in FRACTIONS) return FRACTIONS[token];
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  if (/^\d+([.,]\d+)?$/.test(token)) return Number(token.replace(',', '.'));
  return null;
}

export type ParsedQuery = { amount: number | null; unit: string | null; query: string };

/** Splits "2 eggs", "200g chicken", "a cup of rice" into amount, unit and food. */
export function parseQuery(text: string): ParsedQuery {
  const tokens = text
    .toLowerCase()
    .replace(/(\d)([a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let i = 0;
  let amount: number | null = null;
  let unit: string | null = null;
  if (tokens.length > 1) {
    const a = parseAmount(tokens[0]);
    if (a !== null) {
      amount = a;
      i = 1;
    }
  }
  if (tokens.length > i + 1 && tokens[i] in UNIT_WORDS) {
    unit = UNIT_WORDS[tokens[i]];
    i++;
    if (amount === null) amount = 1;
  }
  if (i > 0 && tokens[i] === 'of' && tokens.length > i + 1) i++;
  const rest = tokens.slice(i).join(' ');
  return { amount, unit, query: i > 0 ? rest : text.trim() };
}

export type Resolved = { food: FoodOption | null; parsed: ParsedQuery; guessed: boolean };

/**
 * Works out which food the typed text means: an exact name first (so "half and half"
 * stays a food), then the part after any amount/unit, then the best search match.
 */
export function resolve(text: string, mine: FoodOption[]): Resolved {
  const whole = findExact(text, mine);
  if (whole) return { food: whole, parsed: { amount: null, unit: null, query: text.trim() }, guessed: false };
  const parsed = parseQuery(text);
  const exact = findExact(parsed.query, mine);
  if (exact) return { food: exact, parsed, guessed: false };
  if (parsed.query.replace(/\s/g, '').length < 3) return { food: null, parsed, guessed: false };
  const [best] = searchFoods(parsed.query, mine, 1);
  return { food: best ?? null, parsed, guessed: !!best };
}

/** Picks the unit to start with for a food, given what the user typed. */
export function startUnit(food: FoodOption, parsed: ParsedQuery): string {
  if (parsed.unit && parsed.unit in food.units) return parsed.unit;
  if (parsed.amount !== null && !parsed.unit && food.countUnit) return food.countUnit;
  return food.defaultUnit;
}
