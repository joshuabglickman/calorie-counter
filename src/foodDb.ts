/**
 * Built-in list of common foods with typical calorie values (approximate,
 * based on USDA averages). Each food is defined as kcal per 100 g (or 100 ml
 * for drinks) plus the gram weight of its common portions.
 */

/** [name, kcal per 100 g/ml, portion grams by unit, aliases, isLiquid] */
import { CARBS_PER_100 } from './carbs';

type Raw = [string, number, Record<string, number>, string[]?, boolean?];

const RAW: Raw[] = [
  // Eggs & dairy
  ['Egg', 143, { piece: 50 }, ['eggs', 'boiled egg', 'hard boiled egg', 'poached egg', 'raw egg', 'large egg']],
  ['Fried egg', 196, { piece: 46 }],
  ['Scrambled eggs', 149, { serving: 120, cup: 220 }, ['scrambled egg']],
  ['Omelette', 154, { serving: 130 }, ['omelet', 'egg omelette']],
  ['Egg white', 52, { piece: 33, cup: 243 }, ['egg whites']],
  ['Milk (whole)', 61, { cup: 244, tbsp: 15 }, ['milk', 'whole milk'], true],
  ['Milk (2%)', 50, { cup: 244, tbsp: 15 }, ['2% milk', 'reduced fat milk'], true],
  ['Milk (skim)', 34, { cup: 245 }, ['skim milk', 'nonfat milk', 'fat free milk'], true],
  ['Oat milk', 48, { cup: 240 }, [], true],
  ['Almond milk', 15, { cup: 240 }, ['almond milk unsweetened'], true],
  ['Soy milk', 43, { cup: 243 }, [], true],
  ['Butter', 717, { tbsp: 14, tsp: 5 }],
  ['Cheddar cheese', 403, { slice: 28, cup: 113 }, ['cheddar', 'cheese', 'cheese slice']],
  ['Mozzarella', 280, { slice: 28, cup: 112 }, ['mozzarella cheese']],
  ['Parmesan', 420, { tbsp: 5 }, ['parmesan cheese', 'parmigiano']],
  ['Feta', 264, { cup: 150, tbsp: 9 }, ['feta cheese']],
  ['Cream cheese', 342, { tbsp: 14.5 }],
  ['Cottage cheese', 98, { cup: 226 }],
  ['Greek yogurt (plain, nonfat)', 59, { piece: 170, cup: 245 }, ['greek yogurt', 'greek yoghurt', 'skyr']],
  ['Greek yogurt (whole)', 97, { piece: 170, cup: 245 }, ['full fat greek yogurt']],
  ['Yogurt (plain)', 61, { piece: 170, cup: 245 }, ['yogurt', 'yoghurt', 'plain yogurt']],
  ['Yogurt (fruit)', 99, { piece: 170, cup: 245 }, ['fruit yogurt', 'flavored yogurt', 'strawberry yogurt']],
  ['Ice cream', 207, { piece: 66, cup: 132 }, ['vanilla ice cream', 'ice cream scoop', 'gelato']],
  ['Heavy cream', 340, { tbsp: 15, cup: 238 }, ['whipping cream', 'cream']],
  ['Half and half', 131, { tbsp: 15 }, ['coffee creamer'], true],
  ['Sour cream', 198, { tbsp: 12 }],
  ['Whipped cream', 257, { tbsp: 3, cup: 60 }],

  // Bread, grains & cereal
  ['White bread', 266, { slice: 28 }, ['bread', 'toast', 'white toast']],
  ['Whole wheat bread', 252, { slice: 32 }, ['wholemeal bread', 'brown bread', 'wheat bread', 'whole wheat toast', 'wheat toast']],
  ['Sourdough bread', 272, { slice: 45 }, ['sourdough', 'sourdough toast']],
  ['Bagel', 257, { piece: 105 }, ['plain bagel']],
  ['English muffin', 227, { piece: 57 }],
  ['Croissant', 406, { piece: 57 }],
  ['Flour tortilla', 306, { piece: 45 }, ['tortilla', 'wrap']],
  ['Corn tortilla', 218, { piece: 26 }],
  ['Pita bread', 275, { piece: 60 }, ['pita']],
  ['Naan', 290, { piece: 90 }, ['naan bread']],
  ['Dinner roll', 289, { piece: 28 }, ['bread roll', 'roll', 'bun', 'hamburger bun']],
  ['White rice (cooked)', 130, { cup: 158 }, ['rice', 'white rice', 'steamed rice', 'jasmine rice', 'basmati rice']],
  ['Brown rice (cooked)', 123, { cup: 195 }, ['brown rice']],
  ['Pasta (cooked)', 158, { cup: 140 }, ['pasta', 'spaghetti', 'penne', 'macaroni', 'noodles', 'linguine', 'fettuccine']],
  ['Egg noodles (cooked)', 138, { cup: 160 }, ['egg noodles']],
  ['Instant ramen', 436, { piece: 85 }, ['ramen', 'cup noodles', 'instant noodles']],
  ['Quinoa (cooked)', 120, { cup: 185 }, ['quinoa']],
  ['Couscous (cooked)', 112, { cup: 157 }, ['couscous']],
  ['Oatmeal (cooked)', 71, { cup: 234 }, ['oatmeal', 'porridge']],
  ['Oats (dry)', 379, { cup: 81, tbsp: 5 }, ['oats', 'rolled oats', 'dry oats']],
  ['Granola', 471, { cup: 122, tbsp: 8 }],
  ['Corn flakes', 357, { cup: 28 }, ['cornflakes', 'cereal']],
  ['Toasted oat cereal', 376, { cup: 28 }, ['cheerios', 'oat cereal']],
  ['Pancake', 227, { piece: 77 }, ['pancakes']],
  ['Waffle', 291, { piece: 75 }, ['waffles']],
  ['French toast', 229, { slice: 65 }],
  ['Blueberry muffin', 377, { piece: 113 }, ['muffin']],
  ['Donut', 421, { piece: 60 }, ['doughnut', 'glazed donut']],
  ['Cinnamon roll', 400, { piece: 100 }],
  ['Crackers', 421, { piece: 3 }, ['saltines', 'saltine crackers', 'cracker']],
  ['Rice cake', 387, { piece: 9 }, ['rice cakes']],
  ['Popcorn', 387, { cup: 8 }, ['air popped popcorn']],

  // Meat, fish & protein
  ['Chicken breast (cooked)', 165, { piece: 172 }, ['chicken breast', 'chicken', 'grilled chicken', 'baked chicken']],
  ['Chicken thigh (cooked)', 209, { piece: 70 }, ['chicken thigh']],
  ['Chicken wing', 254, { piece: 34 }, ['chicken wings', 'wings', 'buffalo wings']],
  ['Chicken drumstick', 216, { piece: 75 }, ['drumstick']],
  ['Fried chicken', 260, { piece: 120 }],
  ['Chicken nuggets', 296, { piece: 16 }, ['nuggets', 'chicken nugget']],
  ['Ground beef (cooked)', 250, { cup: 140 }, ['ground beef', 'mince', 'minced beef']],
  ['Steak', 250, { piece: 225 }, ['beef steak', 'sirloin', 'ribeye']],
  ['Pork chop', 231, { piece: 140 }],
  ['Bacon', 541, { slice: 8 }, ['bacon strip', 'bacon slice']],
  ['Sausage', 325, { piece: 25 }, ['breakfast sausage', 'sausage link', 'pork sausage']],
  ['Ham', 145, { slice: 28 }, ['deli ham', 'sliced ham']],
  ['Turkey (deli)', 104, { slice: 28 }, ['turkey', 'deli turkey', 'turkey slices', 'turkey breast']],
  ['Salmon (cooked)', 206, { piece: 170 }, ['salmon', 'salmon fillet']],
  ['Tuna (canned)', 116, { can: 113, cup: 154 }, ['tuna', 'canned tuna']],
  ['Shrimp (cooked)', 99, { piece: 6, cup: 145 }, ['shrimp', 'prawns', 'prawn']],
  ['Cod (cooked)', 105, { piece: 180 }, ['cod', 'white fish']],
  ['Tilapia (cooked)', 128, { piece: 87 }, ['tilapia']],
  ['Tofu', 144, { cup: 252, slice: 85 }, ['firm tofu']],
  ['Lentils (cooked)', 116, { cup: 198 }, ['lentils']],
  ['Black beans (cooked)', 132, { cup: 172 }, ['black beans', 'beans']],
  ['Chickpeas (cooked)', 164, { cup: 164 }, ['chickpeas', 'garbanzo beans']],
  ['Kidney beans (cooked)', 127, { cup: 177 }, ['kidney beans']],
  ['Refried beans', 91, { cup: 252 }],
  ['Hummus', 166, { tbsp: 15 }, ['houmous']],
  ['Falafel', 333, { piece: 17 }],
  ['Protein powder', 400, { scoop: 30 }, ['whey', 'whey protein', 'protein scoop']],
  ['Beef jerky', 410, { piece: 10 }, ['jerky']],

  // Nuts, seeds & spreads
  ['Peanut butter', 588, { tbsp: 16 }, ['pb']],
  ['Almond butter', 614, { tbsp: 16 }],
  ['Almonds', 579, { piece: 1.2, cup: 143 }, ['almond']],
  ['Peanuts', 585, { cup: 146 }, ['peanut']],
  ['Walnuts', 654, { cup: 117 }, ['walnut']],
  ['Cashews', 553, { piece: 1.6, cup: 137 }, ['cashew']],
  ['Mixed nuts', 607, { cup: 137 }, ['nuts', 'trail mix']],
  ['Sunflower seeds', 584, { tbsp: 9 }],
  ['Chia seeds', 486, { tbsp: 12 }, ['chia']],
  ['Chocolate hazelnut spread', 539, { tbsp: 18.5 }, ['nutella']],

  // Fruit
  ['Apple', 52, { piece: 182, cup: 109 }, ['apples']],
  ['Banana', 89, { piece: 118, cup: 150 }, ['bananas']],
  ['Orange', 47, { piece: 131 }, ['oranges']],
  ['Clementine', 47, { piece: 74 }, ['mandarin', 'tangerine', 'satsuma']],
  ['Strawberries', 32, { cup: 152, piece: 12 }, ['strawberry']],
  ['Blueberries', 57, { cup: 148 }, ['blueberry']],
  ['Raspberries', 52, { cup: 123 }, ['raspberry']],
  ['Grapes', 69, { cup: 151, piece: 5 }, ['grape']],
  ['Watermelon', 30, { cup: 152, slice: 286 }],
  ['Cantaloupe', 34, { cup: 160 }, ['melon']],
  ['Pineapple', 50, { cup: 165, slice: 84 }],
  ['Mango', 60, { piece: 207, cup: 165 }],
  ['Pear', 57, { piece: 178 }],
  ['Peach', 39, { piece: 150 }, ['nectarine']],
  ['Plum', 46, { piece: 66 }],
  ['Kiwi', 61, { piece: 69 }, ['kiwifruit']],
  ['Cherries', 63, { cup: 138, piece: 8 }, ['cherry']],
  ['Grapefruit', 42, { piece: 246 }],
  ['Avocado', 160, { piece: 136 }, ['avo']],
  ['Raisins', 299, { tbsp: 9, cup: 145 }, ['raisin']],
  ['Dates', 277, { piece: 24 }, ['date', 'medjool dates']],

  // Vegetables
  ['Broccoli', 35, { cup: 156 }, ['steamed broccoli']],
  ['Carrot', 41, { piece: 61, cup: 128 }, ['carrots']],
  ['Baby carrots', 35, { piece: 10 }],
  ['Spinach', 23, { cup: 30 }, ['baby spinach']],
  ['Lettuce', 17, { cup: 47 }, ['romaine', 'salad greens', 'mixed greens', 'side salad']],
  ['Kale', 35, { cup: 21 }],
  ['Tomato', 18, { piece: 123, slice: 20, cup: 180 }, ['tomatoes', 'cherry tomatoes']],
  ['Cucumber', 15, { piece: 300, slice: 7, cup: 119 }],
  ['Bell pepper', 31, { piece: 119, cup: 149 }, ['pepper', 'red pepper', 'green pepper', 'capsicum']],
  ['Onion', 40, { piece: 110, cup: 160 }, ['onions']],
  ['Potato (baked)', 93, { piece: 173 }, ['potato', 'baked potato', 'boiled potato']],
  ['Sweet potato', 90, { piece: 114 }, ['yam', 'baked sweet potato']],
  ['French fries', 312, { serving: 117 }, ['fries']],
  ['Mashed potatoes', 113, { cup: 210 }, ['mashed potato', 'mash']],
  ['Hash browns', 265, { piece: 56 }, ['hash brown']],
  ['Corn', 96, { piece: 90, cup: 145 }, ['corn on the cob', 'sweetcorn', 'sweet corn']],
  ['Peas', 84, { cup: 160 }, ['green peas']],
  ['Green beans', 35, { cup: 125 }],
  ['Mushrooms', 22, { cup: 70 }, ['mushroom']],
  ['Zucchini', 17, { piece: 196, cup: 124 }, ['courgette']],
  ['Cauliflower', 25, { cup: 107 }],
  ['Celery', 16, { piece: 40 }, ['celery stick']],
  ['Asparagus', 20, { piece: 16 }],
  ['Cabbage', 25, { cup: 89 }],
  ['Edamame', 121, { cup: 155 }],
  ['Olives', 115, { piece: 4 }, ['olive']],
  ['Pickle', 12, { piece: 65 }, ['pickles', 'gherkin']],

  // Meals & fast food
  ['Cheese pizza', 266, { slice: 107 }, ['pizza', 'pizza slice', 'margherita pizza']],
  ['Pepperoni pizza', 298, { slice: 111 }],
  ['Burger', 250, { piece: 220 }, ['hamburger']],
  ['Cheeseburger', 263, { piece: 230 }],
  ['Hot dog', 281, { piece: 96 }, ['hotdog']],
  ['Burrito', 200, { piece: 350 }, ['bean burrito', 'chicken burrito', 'beef burrito']],
  ['Breakfast burrito', 210, { piece: 220 }],
  ['Taco', 226, { piece: 78 }, ['tacos']],
  ['Quesadilla', 300, { piece: 180 }],
  ['Turkey sandwich', 220, { piece: 160 }, ['sandwich', 'ham sandwich', 'chicken sandwich']],
  ['Grilled cheese', 340, { piece: 120 }, ['grilled cheese sandwich']],
  ['PB&J sandwich', 330, { piece: 110 }, ['peanut butter sandwich', 'pbj', 'peanut butter and jelly']],
  ['Caesar salad', 190, { serving: 200 }],
  ['California roll', 140, { piece: 30, serving: 180 }, ['sushi', 'sushi roll']],
  ['Nigiri', 160, { piece: 35 }, ['salmon nigiri', 'tuna nigiri']],
  ['Dumplings', 220, { piece: 30 }, ['dumpling', 'gyoza', 'potstickers']],
  ['Fried rice', 163, { cup: 198 }],
  ['Chicken curry', 140, { cup: 240 }, ['curry']],
  ['Spaghetti with meat sauce', 140, { cup: 248 }, ['spaghetti bolognese', 'bolognese']],
  ['Mac and cheese', 175, { cup: 200 }, ['macaroni and cheese', 'mac n cheese']],
  ['Lasagna', 150, { serving: 250 }, ['lasagne']],
  ['Chili', 112, { cup: 256 }, ['chili con carne', 'chilli']],
  ['Chicken noodle soup', 30, { cup: 241 }, ['chicken soup', 'soup'], true],
  ['Tomato soup', 30, { cup: 244 }, [], true],
  ['Miso soup', 16, { cup: 240 }, [], true],

  // Snacks & sweets
  ['Potato chips', 536, { serving: 28 }, ['crisps', 'chips', 'chip']],
  ['Tortilla chips', 489, { serving: 28, piece: 2 }, ['nachos chips', 'corn chips']],
  ['Pretzels', 380, { serving: 28 }, ['pretzel']],
  ['Dark chocolate', 598, { piece: 10 }, ['chocolate square']],
  ['Milk chocolate', 535, { piece: 43 }, ['chocolate', 'chocolate bar', 'candy bar']],
  ['Chocolate chip cookie', 488, { piece: 30 }, ['cookie', 'cookies']],
  ['Brownie', 466, { piece: 56 }, ['brownies']],
  ['Chocolate cake', 367, { slice: 95 }, ['cake', 'birthday cake']],
  ['Cheesecake', 321, { slice: 125 }],
  ['Apple pie', 237, { slice: 125 }, ['pie']],
  ['Granola bar', 471, { piece: 24 }, ['cereal bar']],
  ['Protein bar', 380, { piece: 60 }],
  ['Gummy candy', 343, { piece: 2 }, ['gummies', 'gummy bears', 'sweets', 'candy']],
  ['Jam', 278, { tbsp: 20, tsp: 7 }, ['jelly', 'jam spread']],
  ['Honey', 304, { tbsp: 21, tsp: 7 }],
  ['Sugar', 387, { tsp: 4, tbsp: 12.5 }],
  ['Maple syrup', 260, { tbsp: 20 }, ['syrup', 'pancake syrup']],

  // Oils, sauces & condiments
  ['Olive oil', 884, { tbsp: 13.5, tsp: 4.5 }, ['oil', 'extra virgin olive oil', 'evoo', 'vegetable oil', 'canola oil', 'cooking oil']],
  ['Mayonnaise', 680, { tbsp: 14 }, ['mayo']],
  ['Ketchup', 101, { tbsp: 17 }, ['tomato sauce', 'catsup']],
  ['Mustard', 60, { tsp: 5, tbsp: 15 }],
  ['Ranch dressing', 450, { tbsp: 15 }, ['ranch']],
  ['Italian dressing', 240, { tbsp: 15 }, ['salad dressing', 'vinaigrette']],
  ['Caesar dressing', 500, { tbsp: 15 }],
  ['BBQ sauce', 172, { tbsp: 17 }, ['barbecue sauce']],
  ['Soy sauce', 53, { tbsp: 16 }],
  ['Salsa', 36, { tbsp: 16, cup: 259 }],
  ['Guacamole', 155, { tbsp: 15 }, ['guac']],
  ['Pasta sauce', 50, { cup: 250 }, ['marinara', 'tomato pasta sauce']],

  // Drinks
  ['Water', 0, { cup: 240, glass: 250, bottle: 500 }, [], true],
  ['Coffee (black)', 1, { cup: 240 }, ['coffee', 'black coffee', 'espresso', 'americano'], true],
  ['Latte', 40, { cup: 240, serving: 473 }, ['cafe latte', 'flat white'], true],
  ['Cappuccino', 30, { cup: 240, serving: 473 }, [], true],
  ['Tea', 1, { cup: 240 }, ['black tea', 'green tea', 'herbal tea'], true],
  ['Hot chocolate', 77, { cup: 250 }, ['hot cocoa', 'cocoa'], true],
  ['Orange juice', 45, { cup: 248, glass: 250 }, ['oj', 'juice'], true],
  ['Apple juice', 46, { cup: 248, glass: 250 }, [], true],
  ['Smoothie', 60, { cup: 240, serving: 473 }, ['fruit smoothie'], true],
  ['Milkshake', 112, { cup: 240, serving: 473 }, ['shake'], true],
  ['Soda', 39, { can: 355, bottle: 591, glass: 250 }, ['coke', 'cola', 'pepsi', 'soft drink', 'pop', 'sprite'], true],
  ['Diet soda', 0, { can: 355, bottle: 591 }, ['diet coke', 'coke zero', 'pepsi max'], true],
  ['Sports drink', 24, { bottle: 591 }, ['gatorade', 'powerade'], true],
  ['Energy drink', 45, { can: 250 }, ['red bull', 'monster'], true],
  ['Kombucha', 13, { cup: 240, bottle: 473 }, [], true],
  ['Beer', 43, { can: 355, bottle: 355, glass: 473 }, ['lager', 'ale', 'pint'], true],
  ['Light beer', 29, { can: 355, bottle: 355 }, ['lite beer'], true],
  ['Red wine', 85, { glass: 150 }, ['wine'], true],
  ['White wine', 82, { glass: 150 }, ['rose', 'rosé', 'prosecco', 'champagne'], true],
  ['Spirits', 231, { serving: 42 }, ['vodka', 'whiskey', 'whisky', 'rum', 'gin', 'tequila', 'shot', 'liquor'], true],
];

/** [name, kcal per 100 g, carbs g per 100 g, [[unit, grams], ...], aliases?] generated by scripts/build-usda-foods.mjs */
type UsdaRaw = [string, number, number, [string, number][], string[]?];
// eslint-disable-next-line @typescript-eslint/no-require-imports
const USDA: UsdaRaw[] = require('./data/usda-foods.json');

export type DbFood = {
  name: string;
  /** kcal per unit; for g/ml the value is per 100. */
  units: Record<string, number>;
  defaultUnit: string;
  /** A countable unit (piece, slice, sprout, egg...) used when the user types "3 x" without a unit. */
  countUnit: string | null;
  /** Normalized name followed by normalized aliases. */
  terms: string[];
  /** Grams of carbs per kcal (same for every unit); null if unknown. */
  carbsPerKcal: number | null;
  /** 0 = hand-picked list, 1 = USDA list. Lower ranks first in search. */
  tier: 0 | 1;
};

const OZ_G = 28.35;
const FL_OZ_ML = 29.57;
const MEASURES = new Set(['cup', 'tbsp', 'tsp', 'fl oz', 'oz', 'g', 'ml', 'serving']);
const PREFERRED_DEFAULT = ['medium', 'regular'];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[()&,.'’"/\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (/(oes|ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

function makeFood(
  name: string,
  per100: number,
  carbs100: number | undefined,
  portions: [string, number][],
  aliases: string[],
  liquid: boolean,
  tier: 0 | 1,
): DbFood {
  const units: Record<string, number> = {};
  for (const [unit, grams] of portions) units[unit] = round1((per100 * grams) / 100);
  units[liquid ? 'ml' : 'g'] = per100;
  if (!('oz' in units)) units.oz = round1((per100 * (liquid ? FL_OZ_ML : OZ_G)) / 100);
  const labels = portions.map((p) => p[0]);
  // USDA's "serving" is the typical amount eaten ("Quantity not specified"), a good default.
  const defaultUnit =
    (tier === 1 && ['serving', ...PREFERRED_DEFAULT].find((u) => labels.includes(u))) ||
    labels[0] ||
    (liquid ? 'ml' : 'g');
  return {
    name,
    units,
    defaultUnit,
    countUnit: labels.find((u) => !MEASURES.has(u)) ?? null,
    carbsPerKcal: carbsPerKcal(per100, carbs100),
    terms: [name, ...aliases].map(normalize),
    tier,
  };
}

export function carbsPerKcal(kcal100: number, carbs100: number | undefined): number | null {
  if (carbs100 === undefined) return null;
  return kcal100 > 0 ? carbs100 / kcal100 : 0;
}

export const FOOD_DB: DbFood[] = [
  ...RAW.map(([name, per100, portions, aliases = [], liquid = false]) =>
    makeFood(name, per100, CARBS_PER_100[name], Object.entries(portions), aliases, liquid, 0),
  ),
  ...USDA.map(([name, per100, carbs100, portions, aliases = []]) =>
    makeFood(name, per100, carbs100, portions, aliases, false, 1),
  ),
];
