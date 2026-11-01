// src/features/mealPlanner/plateBuilder/plateModel.js
//
// "Build a plate": for people who eat components (a protein, a veg, a carb) rather than
// recipes. A plate is stored as a recipe-shaped object with PER-PERSON portions and
// `servings: 1`, so the meal plan, shopping list builder, pantry and product matching all
// treat it exactly like a recipe: planning it for 3 people triples every portion.

import { parseAmount, normalizeIngredientName } from '../../../utils/quantity';

export const PLATE_KIND = 'plate';

/**
 * Plate sections in the order they appear, each with common choices and a sensible
 * per-person portion. Units must be ones the quantity engine knows ('' = a count).
 */
export const PLATE_SECTIONS = [
  {
    id: 'protein',
    label: 'Protein',
    options: [
      { name: 'Chicken breast', amount: '6', unit: 'oz' },
      { name: 'Chicken thighs', amount: '6', unit: 'oz' },
      { name: 'Ground beef', amount: '6', unit: 'oz' },
      { name: 'Steak', amount: '6', unit: 'oz' },
      { name: 'Ground turkey', amount: '6', unit: 'oz' },
      { name: 'Salmon', amount: '6', unit: 'oz' },
      { name: 'Shrimp', amount: '5', unit: 'oz' },
      { name: 'Eggs', amount: '2', unit: '' },
      { name: 'Tofu', amount: '5', unit: 'oz' },
    ],
  },
  {
    id: 'veg',
    label: 'Veg',
    options: [
      { name: 'Broccoli', amount: '1 1/2', unit: 'cup' },
      { name: 'Spinach', amount: '2', unit: 'cup' },
      { name: 'Green beans', amount: '1', unit: 'cup' },
      { name: 'Bell pepper', amount: '1', unit: '' },
      { name: 'Zucchini', amount: '1', unit: '' },
      { name: 'Carrots', amount: '1', unit: 'cup' },
      { name: 'Cauliflower', amount: '1 1/2', unit: 'cup' },
      { name: 'Asparagus', amount: '6', unit: 'oz' },
      { name: 'Salad greens', amount: '2', unit: 'cup' },
    ],
  },
  {
    id: 'carb',
    label: 'Carb',
    options: [
      { name: 'Rice', amount: '1/2', unit: 'cup' },
      { name: 'Quinoa', amount: '1/2', unit: 'cup' },
      { name: 'Pasta', amount: '2', unit: 'oz' },
      { name: 'Sweet potato', amount: '1', unit: '' },
      { name: 'Potatoes', amount: '8', unit: 'oz' },
      { name: 'Tortillas', amount: '2', unit: '' },
      { name: 'Bread', amount: '2', unit: 'slice' },
    ],
  },
  {
    id: 'extras',
    label: 'Extras',
    options: [
      { name: 'Olive oil', amount: '1', unit: 'tbsp' },
      { name: 'Butter', amount: '1', unit: 'tbsp' },
      { name: 'Avocado', amount: '1/2', unit: '' },
      { name: 'Cheese', amount: '1', unit: 'oz' },
      { name: 'Salsa', amount: '2', unit: 'tbsp' },
      { name: 'Soy sauce', amount: '1', unit: 'tbsp' },
      { name: 'Lemon', amount: '1/2', unit: '' },
    ],
  },
];

const SECTION_IDS = PLATE_SECTIONS.map((s) => s.id);

/** Grouping key for a component, so "Eggs" and "egg" are the same pick. */
export const componentKey = (name) => normalizeIngredientName(name);

/** An empty plate: one list of picks per section. */
export const emptyPlate = () => Object.fromEntries(SECTION_IDS.map((id) => [id, []]));

/** Default portion for a name in a section (custom names get a neutral "1"). */
export function defaultPortion(sectionId, name) {
  const section = PLATE_SECTIONS.find((s) => s.id === sectionId);
  const key = componentKey(name);
  const option = section?.options.find((o) => componentKey(o.name) === key);
  return option ? { amount: option.amount, unit: option.unit } : { amount: '1', unit: '' };
}

/** True when `name` is already picked in `sectionId`. */
export function isPicked(plate, sectionId, name) {
  const key = componentKey(name);
  return (plate[sectionId] || []).some((c) => componentKey(c.name) === key);
}

/** Adds a pick (with its default portion) or removes it if already picked. */
export function togglePick(plate, sectionId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed || !SECTION_IDS.includes(sectionId)) return plate;
  const key = componentKey(trimmed);
  const current = plate[sectionId] || [];
  const next = isPicked(plate, sectionId, trimmed)
    ? current.filter((c) => componentKey(c.name) !== key)
    : [...current, { name: trimmed, ...defaultPortion(sectionId, trimmed) }];
  return { ...plate, [sectionId]: next };
}

/** Updates the per-person portion of one pick. */
export function setPortion(plate, sectionId, name, { amount, unit }) {
  const key = componentKey(name);
  return {
    ...plate,
    [sectionId]: (plate[sectionId] || []).map((c) =>
      componentKey(c.name) === key
        ? { ...c, ...(amount !== undefined ? { amount } : {}), ...(unit !== undefined ? { unit } : {}) }
        : c,
    ),
  };
}

/** Every pick in section order. */
export const plateComponents = (plate) =>
  SECTION_IDS.flatMap((id) => (plate[id] || []).map((c) => ({ ...c, section: id })));

export const isPlateEmpty = (plate) => plateComponents(plate).length === 0;

/** A portion is valid when it parses to a positive number (blank = "some", also fine). */
export function isValidPortion(amount) {
  if (amount === undefined || amount === null || String(amount).trim() === '') return true;
  const parsed = parseAmount(amount);
  return parsed.value !== null && parsed.value > 0;
}

export const plateErrors = (plate) =>
  plateComponents(plate)
    .filter((c) => !isValidPortion(c.amount))
    .map((c) => `${c.name}: enter an amount like 6, 1/2 or 1 1/2`);

/**
 * "Chicken thighs, Broccoli & Rice" — readable default title. Extras (oil, sauces) are left
 * out unless the plate has nothing else, so names stay short.
 */
export function plateTitle(plate) {
  const all = plateComponents(plate);
  const mains = all.filter((c) => c.section !== 'extras');
  const names = (mains.length ? mains : all).map((c) => c.name);
  if (names.length === 0) return 'Plate';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/**
 * The recipe-shaped object stored in a meal slot (and, for favourites, in `recipes`).
 * Portions are per person, so servings is 1 and the slot's servings is the number of people.
 */
export function plateToRecipe(plate, { title, mealType, id } = {}) {
  return {
    ...(id ? { id } : {}),
    kind: PLATE_KIND,
    title: (title && String(title).trim()) || plateTitle(plate),
    mealType: mealType || '',
    servings: 1,
    instructions: '',
    ingredients: plateComponents(plate).map(({ name, amount, unit, section }) => ({
      ingredientId: name,
      amount: String(amount ?? '').trim(),
      unit: unit || '',
      plateSection: section,
    })),
  };
}

export const isPlateRecipe = (recipe) => recipe?.kind === PLATE_KIND;

/** Rebuilds the editable plate from a stored plate recipe (to edit a planned plate). */
export function recipeToPlate(recipe) {
  const plate = emptyPlate();
  (recipe?.ingredients || []).forEach((ing) => {
    const name = String(ing?.ingredientId || ing?.name || '').trim();
    if (!name) return;
    const section = SECTION_IDS.includes(ing.plateSection) ? ing.plateSection : 'extras';
    if (isPicked(plate, section, name)) return;
    plate[section] = [
      ...plate[section],
      { name, amount: ing.amount === undefined ? '' : String(ing.amount), unit: ing.unit || '' },
    ];
  });
  return plate;
}
