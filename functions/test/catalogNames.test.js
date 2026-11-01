// Parity: the server port of normalizeIngredientName / toCatalogKey must match the client.
import {test} from "node:test";
import assert from "node:assert/strict";

import {normalizeIngredientName, toCatalogKey} from "../catalogNames.js";
import {loadClientModule} from "./loadClientModule.js";

const client = await loadClientModule("src/utils/quantity/names.js");
const clientKey = (name) => client.normalizeIngredientName(name).replace(/\s+/g, "-");

const dictionary = (await loadClientModule(
    "src/utils/ingredientCategories.js",
    "export {DICTIONARY as __DICTIONARY__};",
)).__DICTIONARY__;
const dictionaryPhrases = Object.values(dictionary).flatMap((subs) => Object.values(subs).flat());

const TRICKY = [
  "All-Purpose Flour", "all purpose flour, sifted", "Garlic Cloves, minced", "3 cloves of garlic",
  "head of garlic", "Tomatoes (diced)", "cherry tomatoes, halved", "Jalapeño", "jalapenos",
  "crème fraîche", "Salt and pepper to taste", "olive oil, plus more for greasing",
  "extra large eggs", "extra virgin olive oil", "fresh basil leaves", "bay leaves",
  "potatoes", "berries", "boxes", "dishes", "glasses", "asparagus", "hummus", "molasses",
  "chilies", "chiles", "Swiss cheese", "half-and-half", "1/2 & 1/2", "Ben & Jerry's",
  "baker's chocolate", "baker’s chocolate", "sour cream [optional]", "of mice",
  "chopped", "and", "", "   ", null, undefined, 42, "ÉCLAIRS", "peas; or beans",
  "lemongrass stalks", "red wine vinegar", "smoked paprika", "ground cinnamon",
  "frozen peas", "canned black beans", "parsley for garnish", "salt as needed",
  "green onions (scallions)", "cilantro_leaves", "beef/chicken stock",
];

test("normalizeIngredientName matches the client for tricky names", () => {
  for (const name of TRICKY) {
    assert.equal(normalizeIngredientName(name), client.normalizeIngredientName(name), `name=${name}`);
  }
});

test("toCatalogKey matches the client formula for every dictionary phrase and tricky name", () => {
  const sample = [...dictionaryPhrases, ...TRICKY];
  assert.ok(dictionaryPhrases.length > 500, "dictionary loaded");
  for (const name of sample) assert.equal(toCatalogKey(name), clientKey(name), `name=${name}`);
});

test("toCatalogKey examples", () => {
  assert.equal(toCatalogKey("all purpose flour"), "all-purpose-flour");
  assert.equal(toCatalogKey("All-Purpose Flour, sifted"), "all-purpose-flour");
  assert.equal(toCatalogKey("Garlic Cloves, minced"), "garlic");
  assert.equal(toCatalogKey("Tomatoes (diced)"), "tomato");
  assert.equal(toCatalogKey(""), "");
});

test("toCatalogKey never yields '/' and is idempotent on its own output", () => {
  for (const name of [...dictionaryPhrases, ...TRICKY]) {
    const key = toCatalogKey(name);
    assert.ok(!key.includes("/"), `no slash: ${key}`);
    assert.match(key, /^[a-z0-9&-]*$/);
    assert.equal(toCatalogKey(key), key, `idempotent: ${key}`);
  }
});
