import AsyncStorage from '@react-native-async-storage/async-storage';

export type Unit = string;

/** Units offered for foods that aren't in the food list. */
export const UNITS: Unit[] = ['serving', 'piece', 'slice', 'cup', 'tbsp', 'tsp', 'oz', 'g', 'ml'];

const NO_PLURAL = new Set(['g', 'ml', 'oz', 'tbsp', 'tsp']);

/** "2 slices", "1 cup", "150 g" */
export function formatAmount(amount: number, unit: Unit): string {
  const n = Math.round(amount * 100) / 100;
  if (NO_PLURAL.has(unit) || n === 1) return `${n} ${unit}`;
  return `${n} ${unit === 'glass' ? 'glasses' : `${unit}s`}`;
}

/** Calories for g and ml are entered per 100; everything else per 1 unit. */
export function unitBasis(unit: Unit): number {
  return unit === 'g' || unit === 'ml' ? 100 : 1;
}

export function calcCalories(amount: number, unit: Unit, kcalPer: number): number {
  return Math.round((amount / unitBasis(unit)) * kcalPer);
}

/** Grams of a nutrient (carbs, protein, sodium mg) for an entry's calories, rounded to whole grams. */
export function calcGrams(kcal: number, perKcal: number | null | undefined): number | undefined {
  return perKcal == null ? undefined : Math.round(kcal * perKcal);
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

/** The meal you're most likely logging at a given time. */
export function mealForTime(d: Date): Meal {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return 'breakfast';
  if (h >= 10.5 && h < 15) return 'lunch';
  if (h >= 17 && h < 21.5) return 'dinner';
  return 'snack';
}

/** Entries logged before meals existed are placed by the time they were added. */
export function entryMeal(e: Entry): Meal {
  return e.meal ?? mealForTime(new Date(e.createdAt));
}

export type Entry = {
  id: string;
  meal?: Meal;
  date: string; // YYYY-MM-DD, local time
  name: string;
  amount: number;
  unit: Unit;
  kcalPer: number; // per 1 unit, or per 100 for g/ml
  kcal: number;
  /** Grams of carbs; undefined if unknown. */
  carbs?: number;
  /** Grams of protein; undefined if unknown. */
  protein?: number;
  /** Milligrams of sodium; undefined if unknown. */
  sodium?: number;
  createdAt: number;
};

/** A food remembered from past entries, used for quick re-entry. */
export type SavedFood = {
  name: string;
  amount: number;
  unit: Unit;
  kcalPer: number;
  /** All known portions (kcal per unit, per 100 for g/ml), e.g. for foods picked from online search. */
  units?: Record<string, number>;
  countUnit?: string | null;
  carbsPerKcal?: number | null;
  proteinPerKcal?: number | null;
  sodiumPerKcal?: number | null;
  lastUsed: number;
  uses: number;
};

export type Data = {
  entries: Entry[];
  foods: Record<string, SavedFood>; // keyed by lowercased name
  goal: number;
  /** Daily carb limit in grams. */
  carbGoal: number;
  /** Daily protein target in grams; undefined until set. */
  proteinGoal?: number;
  /** Daily sodium limit in mg; undefined until set. */
  sodiumGoal?: number;
  /** Goal body weight in weightUnit; undefined until set. */
  weightGoal?: number;
  /** Body weight by day (YYYY-MM-DD), in weightUnit. */
  weights: Record<string, number>;
  weightUnit: WeightUnit;
};

export type WeightUnit = 'lb' | 'kg';

const KEY = 'caloriecounter:data:v1';

export const DEFAULT_DATA: Data = { entries: [], foods: {}, goal: 2000, carbGoal: 20, weights: {}, weightUnit: 'lb' };

export async function loadData(): Promise<Data> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_DATA;
    return parseData(JSON.parse(raw));
  } catch {
    return DEFAULT_DATA;
  }
}

/** Fills in defaults for anything missing; used for saved data and backups. */
export function parseData(parsed: Partial<Data>): Data {
  return {
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    foods: parsed.foods ?? {},
    goal: typeof parsed.goal === 'number' && parsed.goal > 0 ? parsed.goal : DEFAULT_DATA.goal,
    carbGoal: typeof parsed.carbGoal === 'number' && parsed.carbGoal > 0 ? parsed.carbGoal : DEFAULT_DATA.carbGoal,
    proteinGoal: typeof parsed.proteinGoal === 'number' && parsed.proteinGoal > 0 ? parsed.proteinGoal : undefined,
    sodiumGoal: typeof parsed.sodiumGoal === 'number' && parsed.sodiumGoal > 0 ? parsed.sodiumGoal : undefined,
    weightGoal: typeof parsed.weightGoal === 'number' && parsed.weightGoal > 0 ? parsed.weightGoal : undefined,
    weights: parsed.weights ?? {},
    weightUnit: parsed.weightUnit === 'kg' ? 'kg' : 'lb',
  };
}

export async function saveData(data: Data): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

/** Converts every logged weight when the unit is switched. */
export function convertWeights(weights: Record<string, number>, from: WeightUnit, to: WeightUnit) {
  if (from === to) return weights;
  const f = to === 'kg' ? 1 / 2.20462 : 2.20462;
  return Object.fromEntries(Object.entries(weights).map(([d, w]) => [d, Math.round(w * f * 10) / 10]));
}

/** The most recent weight logged before a day, for showing the change. */
export function previousWeight(weights: Record<string, number>, day: string): number | null {
  const earlier = Object.keys(weights)
    .filter((d) => d < day)
    .sort();
  return earlier.length ? weights[earlier[earlier.length - 1]] : null;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Parses user-typed numbers, accepting "1,5" as 1.5. Returns NaN if invalid. */
export function parseNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  if (t === '' || !/^\d*\.?\d*$/.test(t)) return NaN;
  return Number(t);
}
