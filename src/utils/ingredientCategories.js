// Unified ingredient categorizer and grocery-aisle ordering for shopping lists.
//
// Public API:
//   AISLES                       ordered list of aisles (store-walk order)
//   AISLE_IDS                    map of constant -> aisleId
//   getAisle(name)               -> { aisleId, aisleName, order, subcategory, matched }
//   categorizeIngredient(name)   -> { category: { name, ... }, subcategory }  (back-compat shape)
//   normalizeIngredientName(name)-> lowercase, accent-free, de-hyphenated string
//   compareByAisle(a, b, getName?) comparator for sorting items in aisle order
//   sortByAisle(items, getName?) -> new array sorted by aisle order, then name
//   groupByAisle(items, getName?)-> [{ aisle, items }] in aisle order (empty aisles omitted)
//   INGREDIENT_CATEGORIES, getAllCategories, isValidCategory (legacy, unchanged)

/* ------------------------------------------------------------------ */
/* Legacy category hierarchy (kept for back-compat)                    */
/* ------------------------------------------------------------------ */

export const INGREDIENT_CATEGORIES = {
  PRODUCE: {
    name: 'Produce',
    subcategories: {
      FRUITS: 'Fruits',
      VEGETABLES: 'Vegetables',
      HERBS: 'Fresh Herbs',
      SALAD: 'Salad & Leafy Greens'
    }
  },
  MEAT_SEAFOOD: {
    name: 'Meat & Seafood',
    subcategories: {
      POULTRY: 'Poultry',
      BEEF: 'Beef',
      PORK: 'Pork',
      SEAFOOD: 'Fish & Seafood',
      OTHER_MEAT: 'Other Meats'
    }
  },
  DAIRY_EGGS: {
    name: 'Dairy & Eggs',
    subcategories: {
      MILK: 'Milk & Cream',
      CHEESE: 'Cheese',
      YOGURT: 'Yogurt & Cultured Dairy',
      EGGS: 'Eggs',
      OTHER_DAIRY: 'Other Dairy Products'
    }
  },
  PANTRY: {
    name: 'Pantry',
    subcategories: {
      GRAINS: 'Grains & Pasta',
      CANNED: 'Canned Goods',
      BAKING: 'Baking Supplies',
      CONDIMENTS: 'Condiments & Sauces',
      SPICES: 'Spices & Seasonings',
      OILS: 'Oils & Vinegars'
    }
  },
  FROZEN: {
    name: 'Frozen Foods',
    subcategories: {
      FROZEN_VEG: 'Frozen Vegetables',
      FROZEN_FRUITS: 'Frozen Fruits',
      FROZEN_MEALS: 'Frozen Meals',
      OTHER_FROZEN: 'Other Frozen Items'
    }
  },
  OTHER: {
    name: 'Other Items',
    subcategories: {
      BEVERAGES: 'Beverages',
      SNACKS: 'Snacks',
      MISC: 'Miscellaneous'
    }
  }
};

/* ------------------------------------------------------------------ */
/* Aisles                                                              */
/* ------------------------------------------------------------------ */

export const AISLE_IDS = {
  PRODUCE: 'produce',
  BAKERY: 'bakery',
  MEAT_SEAFOOD: 'meat-seafood',
  DAIRY_EGGS: 'dairy-eggs',
  DELI: 'deli',
  FROZEN: 'frozen',
  GRAINS: 'grains-pasta',
  CANNED: 'canned-jarred',
  BAKING: 'baking',
  SPICES: 'spices',
  CONDIMENTS: 'condiments',
  SNACKS: 'snacks',
  BEVERAGES: 'beverages',
  HOUSEHOLD: 'household'
};

const A = AISLE_IDS;

// Ordered in a sensible store walk. `legacy` maps to INGREDIENT_CATEGORIES keys.
export const AISLES = Object.freeze([
  { id: A.PRODUCE, name: 'Produce', order: 1, icon: 'leaf', legacy: 'PRODUCE' },
  { id: A.BAKERY, name: 'Bakery', order: 2, icon: 'bread', legacy: 'PANTRY' },
  { id: A.MEAT_SEAFOOD, name: 'Meat & Seafood', order: 3, icon: 'meat', legacy: 'MEAT_SEAFOOD' },
  { id: A.DAIRY_EGGS, name: 'Dairy & Eggs', order: 4, icon: 'egg', legacy: 'DAIRY_EGGS' },
  { id: A.DELI, name: 'Deli & Refrigerated', order: 5, icon: 'deli', legacy: 'DAIRY_EGGS' },
  { id: A.FROZEN, name: 'Frozen', order: 6, icon: 'snowflake', legacy: 'FROZEN' },
  { id: A.GRAINS, name: 'Pantry: Grains & Pasta', order: 7, icon: 'pasta', legacy: 'PANTRY' },
  { id: A.CANNED, name: 'Pantry: Canned & Jarred', order: 8, icon: 'can', legacy: 'PANTRY' },
  { id: A.BAKING, name: 'Baking', order: 9, icon: 'whisk', legacy: 'PANTRY' },
  { id: A.SPICES, name: 'Spices & Seasonings', order: 10, icon: 'salt', legacy: 'PANTRY' },
  { id: A.CONDIMENTS, name: 'Oils, Vinegars & Condiments', order: 11, icon: 'bottle', legacy: 'PANTRY' },
  { id: A.SNACKS, name: 'Snacks', order: 12, icon: 'pretzel', legacy: 'OTHER' },
  { id: A.BEVERAGES, name: 'Beverages', order: 13, icon: 'cup', legacy: 'OTHER' },
  { id: A.HOUSEHOLD, name: 'Household & Other', order: 14, icon: 'home', legacy: 'OTHER' }
].map(a => Object.freeze(a)));

const AISLE_BY_ID = AISLES.reduce((acc, a) => {
  acc[a.id] = a;
  return acc;
}, {});

const DEFAULT_SUBCATEGORY = 'Other';

/* ------------------------------------------------------------------ */
/* Keyword dictionary: aisle -> subcategory -> phrases                 */
/* Phrases are written naturally; plural/singular forms both match.    */
/* ------------------------------------------------------------------ */

const DICTIONARY = {
  [A.PRODUCE]: {
    Fruits: [
      'apple', 'banana', 'berry', 'strawberry', 'blueberry', 'raspberry', 'blackberry',
      'cranberry', 'cherry', 'grape', 'orange', 'lemon', 'lime', 'grapefruit', 'clementine',
      'mandarin', 'tangerine', 'citrus', 'peach', 'nectarine', 'plum', 'pear', 'apricot',
      'mango', 'pineapple', 'papaya', 'kiwi', 'melon', 'watermelon', 'cantaloupe',
      'honeydew', 'pomegranate', 'fig', 'date', 'avocado', 'coconut', 'passion fruit',
      'dragon fruit', 'persimmon', 'lemon zest', 'lime zest', 'orange zest',
      'lemon juice', 'lime juice', 'plantain', 'rhubarb'
    ],
    Vegetables: [
      'onion', 'red onion', 'yellow onion', 'white onion', 'sweet onion', 'shallot',
      'garlic', 'garlic clove', 'clove garlic', 'clove of garlic', 'minced garlic', 'leek',
      'scallion', 'green onion', 'spring onion', 'chive', 'carrot', 'potato', 'sweet potato',
      'yam', 'russet', 'tomato', 'cherry tomato', 'grape tomato', 'roma tomato',
      'bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'orange pepper',
      'red bell pepper', 'green bell pepper', 'jalapeno', 'jalapeno pepper', 'serrano',
      'serrano pepper', 'habanero', 'poblano', 'poblano pepper', 'anaheim pepper',
      'chili pepper', 'chile pepper', 'hot pepper', 'banana pepper', 'thai chili',
      'fresno chili', 'sweet pepper', 'mini pepper', 'capsicum', 'chili', 'chile', 'chilli',
      'red chili', 'green chili', 'bird eye chili', 'red chilli', 'green chilli',
      'birds eye chilli', 'long red chilli', 'courgette', 'pak choi', 'pak choy', 'bok choi',
      'silverbeet', 'rocket', 'snow pea sprout', 'kumara', 'swede', 'spring onion',
      'cucumber', 'zucchini', 'squash', 'butternut squash', 'acorn squash', 'pumpkin',
      'eggplant', 'aubergine', 'broccoli', 'broccolini', 'cauliflower', 'cabbage',
      'red cabbage', 'napa cabbage', 'bok choy', 'brussels sprout', 'celery', 'asparagus',
      'green bean', 'string bean', 'snap pea', 'snow pea', 'sugar snap pea', 'corn',
      'corn on the cob', 'sweet corn', 'mushroom', 'portobello', 'shiitake', 'cremini',
      'beet', 'beetroot', 'radish', 'turnip', 'parsnip', 'rutabaga', 'fennel', 'artichoke',
      'okra', 'ginger', 'ginger root', 'fresh ginger', 'turmeric root', 'jicama',
      'bean sprout', 'sprout', 'edamame', 'tomatillo', 'celery root', 'celeriac'
    ],
    'Fresh Herbs': [
      'basil', 'cilantro', 'coriander leaf', 'parsley', 'flat leaf parsley', 'mint',
      'dill', 'rosemary', 'thyme', 'sage', 'tarragon', 'oregano leaf', 'lemongrass',
      'fresh herb', 'herb', 'fresh bay leaf', 'microgreen', 'fresh basil', 'fresh thyme',
      'fresh oregano', 'fresh rosemary', 'fresh dill', 'fresh sage', 'fresh parsley'
    ],
    'Salad & Leafy Greens': [
      'lettuce', 'romaine', 'iceberg', 'iceberg lettuce', 'butter lettuce', 'spinach',
      'baby spinach', 'arugula', 'rocket', 'kale', 'chard', 'swiss chard', 'collard',
      'collard green', 'mixed green', 'spring mix', 'salad green', 'watercress', 'endive',
      'radicchio', 'frisee', 'greens', 'salad mix'
    ]
  },

  [A.BAKERY]: {
    Bread: [
      'bread', 'loaf', 'baguette', 'sourdough', 'ciabatta', 'focaccia', 'brioche',
      'bun', 'hamburger bun', 'hot dog bun', 'roll', 'dinner roll', 'bagel', 'english muffin',
      'croissant', 'pita', 'pita bread', 'naan', 'flatbread', 'challah', 'rye bread',
      'whole wheat bread', 'white bread', 'sandwich bread', 'texas toast', 'muffin',
      'sub roll', 'hoagie roll', 'slider bun', 'brioche bun'
    ],
    'Tortillas & Wraps': [
      'tortilla', 'flour tortilla', 'corn tortilla', 'wrap', 'taco shell', 'tostada',
      'lavash'
    ],
    'Cakes & Pastries': ['cake', 'pie crust', 'pastry', 'donut', 'doughnut', 'danish']
  },

  [A.MEAT_SEAFOOD]: {
    Poultry: [
      'chicken', 'chicken breast', 'chicken thigh', 'chicken wing', 'chicken drumstick',
      'chicken tender', 'whole chicken', 'ground chicken', 'rotisserie chicken', 'turkey',
      'ground turkey', 'turkey breast', 'duck', 'cornish hen', 'poultry'
    ],
    Beef: [
      'beef', 'ground beef', 'steak', 'sirloin', 'ribeye', 'rib eye', 'filet mignon',
      'flank steak', 'skirt steak', 'chuck', 'chuck roast', 'brisket', 'short rib',
      'beef stew meat', 'stew meat', 'roast beef', 'tenderloin', 'veal', 'oxtail',
      'hamburger', 'hamburger patty', 'ground chuck', 'mince', 'minced beef'
    ],
    Pork: [
      'pork', 'pork chop', 'pork loin', 'pork tenderloin', 'pork shoulder', 'pork belly',
      'ground pork', 'bacon', 'ham', 'sausage', 'italian sausage', 'chorizo', 'pancetta',
      'prosciutto', 'rib', 'baby back rib', 'spare rib', 'bratwurst', 'kielbasa', 'hot dog'
    ],
    'Fish & Seafood': [
      'fish', 'salmon', 'salmon fillet', 'tuna steak', 'cod', 'tilapia', 'halibut',
      'trout', 'mahi mahi', 'snapper', 'sea bass', 'catfish', 'haddock', 'swordfish',
      'shrimp', 'prawn', 'scallop', 'crab', 'crab meat', 'lobster', 'mussel', 'clam',
      'oyster', 'squid', 'calamari', 'octopus', 'seafood', 'fillet', 'white fish',
      'ahi tuna', 'fresh tuna'
    ],
    'Other Meats': ['lamb', 'ground lamb', 'lamb chop', 'goat', 'venison', 'bison', 'meat', 'meatball']
  },

  [A.DAIRY_EGGS]: {
    'Milk & Cream': [
      'milk', 'whole milk', 'skim milk', '2% milk', 'buttermilk', 'cream', 'heavy cream',
      'heavy whipping cream', 'whipping cream', 'light cream', 'half and half',
      'half & half', 'whipped cream', 'creamer', 'coffee creamer'
    ],
    'Milk Alternatives': [
      'almond milk', 'oat milk', 'soy milk', 'cashew milk', 'rice milk',
      'plant milk', 'plant based milk', 'non dairy milk', 'dairy free milk',
      'coconut milk beverage', 'oat creamer', 'almond creamer'
    ],
    Cheese: [
      'cheese', 'cheddar', 'cheddar cheese', 'mozzarella', 'parmesan', 'parmigiano',
      'parmigiano reggiano', 'pecorino', 'romano', 'feta', 'goat cheese', 'chevre',
      'ricotta', 'cottage cheese', 'cream cheese', 'brie', 'camembert', 'gouda', 'swiss',
      'swiss cheese', 'provolone', 'monterey jack', 'pepper jack', 'colby', 'gruyere',
      'blue cheese', 'gorgonzola', 'mascarpone', 'halloumi', 'queso', 'queso fresco',
      'cotija', 'paneer', 'american cheese', 'string cheese', 'burrata', 'manchego',
      'asiago', 'havarti', 'shredded cheese', 'mexican cheese blend', 'italian blend'
    ],
    'Yogurt & Cultured Dairy': [
      'yogurt', 'yoghurt', 'greek yogurt', 'sour cream', 'creme fraiche', 'kefir',
      'skyr', 'labneh'
    ],
    Eggs: ['egg', 'large egg', 'egg white', 'egg yolk', 'whole egg', 'liquid egg'],
    'Butter & Margarine': [
      'butter', 'unsalted butter', 'salted butter', 'margarine', 'ghee', 'vegan butter'
    ]
  },

  [A.DELI]: {
    'Deli Meats': [
      'deli meat', 'deli turkey', 'deli ham', 'sliced turkey', 'sliced ham', 'salami',
      'pepperoni', 'bologna', 'pastrami', 'lunch meat', 'cold cut', 'mortadella',
      'capicola', 'roast turkey', 'smoked salmon', 'lox'
    ],
    'Refrigerated': [
      'tofu', 'firm tofu', 'extra firm tofu', 'silken tofu', 'tempeh', 'seitan',
      'hummus', 'guacamole', 'fresh salsa', 'pico de gallo', 'pesto', 'fresh pasta',
      'refrigerated pie crust', 'pizza dough', 'crescent roll', 'biscuit dough',
      'cookie dough', 'egg roll wrapper', 'wonton wrapper', 'dumpling wrapper',
      'tzatziki', 'kimchi', 'miso', 'miso paste',
      'fresh mozzarella', 'plant based meat', 'beyond meat', 'impossible meat'
    ]
  },

  [A.FROZEN]: {
    'Frozen Vegetables': [
      'frozen pea', 'frozen corn', 'frozen spinach', 'frozen broccoli', 'frozen vegetable',
      'frozen mixed vegetable', 'frozen green bean', 'frozen edamame', 'pea', 'green pea',
      'mixed vegetable', 'hash brown', 'tater tot', 'french fry', 'frozen potato'
    ],
    'Frozen Fruits': ['frozen berry', 'frozen fruit', 'frozen mango', 'frozen strawberry', 'frozen blueberry'],
    'Frozen Meals': ['frozen pizza', 'frozen meal', 'frozen dinner', 'frozen waffle', 'frozen burrito', 'pot pie'],
    'Frozen Desserts': ['ice cream', 'gelato', 'sorbet', 'sherbet', 'popsicle', 'frozen yogurt', 'ice pop'],
    'Other Frozen Items': ['ice', 'ice cube', 'puff pastry', 'phyllo', 'filo', 'phyllo dough', 'frozen pie crust', 'cool whip', 'whipped topping']
  },

  [A.GRAINS]: {
    'Pasta & Noodles': [
      'pasta', 'spaghetti', 'penne', 'fusilli', 'rigatoni', 'linguine', 'fettuccine',
      'macaroni', 'elbow macaroni', 'farfalle', 'orzo', 'lasagna', 'lasagna noodle',
      'lasagne', 'ravioli', 'tortellini', 'gnocchi', 'egg noodle', 'noodle', 'ramen',
      'ramen noodle', 'udon', 'soba', 'rice noodle', 'vermicelli', 'angel hair', 'ziti',
      'shell pasta', 'pappardelle', 'bucatini', 'rotini', 'glass noodle', 'lo mein'
    ],
    'Rice & Grains': [
      'rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'arborio rice',
      'wild rice', 'sushi rice', 'quinoa', 'couscous', 'bulgur', 'farro', 'barley',
      'millet', 'polenta', 'grits', 'freekeh', 'amaranth', 'buckwheat', 'rice paper'
    ],
    'Cereal & Breakfast': [
      'oat', 'oatmeal', 'rolled oat', 'old fashioned oat', 'steel cut oat', 'quick oat',
      'cereal', 'granola', 'muesli', 'corn flake', 'pancake mix', 'waffle mix'
    ],
    'Breadcrumbs & Crackers': ['breadcrumb', 'bread crumb', 'panko', 'panko breadcrumb', 'crouton', 'stuffing mix']
  },

  [A.CANNED]: {
    'Canned Tomatoes': [
      'tomato paste', 'tomato sauce', 'tomato puree', 'canned tomato', 'crushed tomato',
      'diced tomato', 'stewed tomato', 'whole peeled tomato', 'san marzano tomato',
      'fire roasted tomato', 'sun dried tomato', 'passata', 'marinara', 'marinara sauce',
      'pasta sauce', 'pizza sauce', 'tomato soup', 'rotel'
    ],
    'Beans & Legumes': [
      'black bean', 'kidney bean', 'pinto bean', 'cannellini bean', 'white bean',
      'navy bean', 'great northern bean', 'garbanzo bean', 'chickpea', 'lentil',
      'red lentil', 'green lentil', 'refried bean', 'baked bean', 'butter bean',
      'lima bean', 'black eyed pea', 'split pea', 'bean', 'canned bean'
    ],
    'Broth & Soup': [
      'broth', 'stock', 'chicken broth', 'chicken stock', 'beef broth', 'beef stock',
      'vegetable broth', 'vegetable stock', 'bone broth', 'bouillon', 'bouillon cube',
      'chicken bouillon', 'beef bouillon', 'stock cube', 'soup', 'cream of mushroom soup',
      'cream of chicken soup', 'cream of mushroom', 'cream of chicken', 'consomme', 'dashi'
    ],
    'Canned Fish & Meat': [
      'tuna', 'canned tuna', 'canned salmon', 'sardine', 'anchovy', 'anchovy fillet',
      'canned chicken', 'spam', 'corned beef'
    ],
    'Coconut & Asian Staples': [
      'coconut milk', 'coconut cream', 'canned coconut milk', 'full fat coconut milk',
      'light coconut milk', 'water chestnut', 'bamboo shoot', 'curry paste',
      'red curry paste', 'green curry paste', 'baby corn', 'nori', 'nori sheet', 'seaweed',
      'rice paper', 'wakame', 'kombu'
    ],
    'Canned Fruits & Vegetables': [
      'canned corn', 'canned pumpkin', 'pumpkin puree', 'canned fruit', 'canned peach',
      'canned pineapple', 'pineapple chunk', 'mandarin orange canned', 'artichoke heart',
      'roasted red pepper', 'green chile', 'diced green chile', 'chipotle in adobo',
      'chipotle pepper in adobo', 'olive', 'kalamata olive', 'black olive', 'green olive',
      'caper', 'pickle', 'dill pickle', 'sauerkraut', 'jalapeno slice', 'pickled jalapeno',
      'evaporated milk', 'sweetened condensed milk', 'condensed milk', 'applesauce',
      'apple sauce', 'pumpkin pie filling', 'pie filling'
    ],
    'Nut Butters & Spreads': [
      'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter', 'nut butter',
      'tahini', 'nutella', 'hazelnut spread', 'vegemite', 'marmite', 'jam', 'jelly', 'preserve', 'fruit preserve',
      'marmalade', 'apple butter', 'honey', 'maple syrup', 'syrup', 'pancake syrup',
      'agave', 'agave nectar'
    ]
  },

  [A.BAKING]: {
    'Flour & Meal': [
      'flour', 'all purpose flour', 'bread flour', 'cake flour', 'whole wheat flour',
      'self rising flour', 'almond flour', 'coconut flour', 'rice flour', 'cornmeal',
      'corn meal', 'semolina', 'masa harina', 'oat flour', 'tapioca flour', 'chickpea flour'
    ],
    Sweeteners: [
      'sugar', 'granulated sugar', 'white sugar', 'brown sugar', 'light brown sugar',
      'dark brown sugar', 'powdered sugar', 'confectioners sugar', 'icing sugar',
      'cane sugar', 'coconut sugar', 'turbinado', 'molasses', 'corn syrup', 'treacle',
      'golden syrup', 'caster sugar', 'raw sugar',
      'stevia', 'monk fruit', 'erythritol', 'sweetener'
    ],
    'Leaveners & Thickeners': [
      'baking soda', 'baking powder', 'bicarbonate of soda', 'yeast', 'active dry yeast',
      'instant yeast', 'cream of tartar', 'cornstarch', 'corn starch', 'cornflour', 'corn flour', 'arrowroot',
      'arrowroot powder', 'tapioca starch', 'potato starch', 'gelatin', 'xanthan gum',
      'pectin', 'agar'
    ],
    'Baking Chocolate & Mix-ins': [
      'chocolate chip', 'semi sweet chocolate chip', 'chocolate', 'baking chocolate',
      'dark chocolate', 'white chocolate', 'cocoa', 'cocoa powder', 'cacao',
      'cacao powder', 'cocoa butter', 'sprinkle', 'shredded coconut', 'coconut flake',
      'desiccated coconut', 'marshmallow', 'graham cracker', 'graham cracker crumb',
      'butterscotch chip', 'food coloring', 'cake mix', 'brownie mix', 'frosting'
    ],
    Extracts: [
      'vanilla', 'vanilla extract', 'pure vanilla extract', 'vanilla bean',
      'almond extract', 'peppermint extract', 'lemon extract', 'extract'
    ],
    'Baking Supplies': ['parchment paper', 'baking paper', 'cupcake liner', 'muffin liner', 'baking spray']
  },

  [A.SPICES]: {
    Salt: [
      'salt', 'kosher salt', 'sea salt', 'table salt', 'flaky salt', 'flaky sea salt',
      'himalayan salt', 'pink salt', 'salt and pepper', 'salt & pepper', 'garlic salt',
      'onion salt', 'celery salt', 'seasoned salt', 'smoked salt'
    ],
    Pepper: [
      'pepper', 'black pepper', 'ground pepper', 'ground black pepper',
      'freshly ground black pepper', 'cracked black pepper', 'cracked pepper',
      'peppercorn', 'black peppercorn', 'white pepper', 'pink peppercorn',
      'cayenne', 'cayenne pepper', 'red pepper flake', 'crushed red pepper',
      'crushed red pepper flake', 'chili flake', 'chilli flake', 'chilli flakes', 'lemon pepper',
      'aleppo pepper', 'ground red pepper'
    ],
    'Ground Spices': [
      'spice', 'garlic powder', 'onion powder', 'granulated garlic', 'granulated onion',
      'dried minced onion', 'onion flake', 'chili powder', 'chile powder', 'chilli powder', 'ancho chili powder',
      'chipotle powder', 'paprika', 'smoked paprika', 'sweet paprika', 'cumin',
      'ground cumin', 'cumin seed', 'coriander', 'ground coriander', 'coriander seed',
      'turmeric', 'ground turmeric', 'ground ginger', 'ginger powder', 'cinnamon',
      'ground cinnamon', 'cinnamon stick', 'nutmeg', 'ground nutmeg', 'allspice', 'clove',
      'ground clove', 'whole clove', 'cardamom', 'star anise', 'fennel seed', 'mustard seed',
      'dry mustard', 'mustard powder', 'ground mustard', 'curry powder', 'garam masala',
      'five spice', 'chinese five spice', 'pumpkin pie spice', 'apple pie spice',
      'saffron', 'sumac', 'za atar', 'zaatar', 'celery seed', 'caraway seed',
      'poppy seed', 'msg', 'ras el hanout', 'berbere', 'fenugreek', 'asafoetida'
    ],
    'Dried Herbs': [
      'oregano', 'dried oregano', 'dried basil', 'dried thyme', 'dried rosemary',
      'dried parsley', 'dried dill', 'dried sage', 'dried tarragon', 'dried mint',
      'dried cilantro', 'dried chive', 'bay leaf', 'bay leave', 'italian seasoning',
      'herbes de provence', 'marjoram', 'dried marjoram', 'rubbed sage', 'ground sage',
      'dried herb', 'mixed herb', 'dill weed'
    ],
    'Seasoning Blends': [
      'seasoning', 'taco seasoning', 'fajita seasoning', 'cajun seasoning',
      'creole seasoning', 'old bay', 'old bay seasoning', 'everything bagel seasoning',
      'poultry seasoning', 'steak seasoning', 'ranch seasoning', 'ranch mix', 'jerk seasoning',
      'adobo seasoning', 'sazon', 'blackening seasoning', 'chili seasoning', 'dry rub', 'rub',
      'nutritional yeast'
    ]
  },

  [A.CONDIMENTS]: {
    'Oils & Vinegars': [
      'oil', 'olive oil', 'extra virgin olive oil', 'vegetable oil', 'canola oil',
      'coconut oil', 'avocado oil', 'sesame oil', 'toasted sesame oil', 'peanut oil',
      'sunflower oil', 'grapeseed oil', 'cooking spray', 'nonstick spray', 'shortening',
      'lard', 'vinegar', 'white vinegar', 'apple cider vinegar', 'cider vinegar',
      'balsamic', 'balsamic vinegar', 'red wine vinegar', 'white wine vinegar',
      'rice vinegar', 'rice wine vinegar', 'sherry vinegar', 'balsamic glaze',
      'cooking wine', 'mirin', 'shaoxing wine', 'cooking sherry'
    ],
    'Condiments & Sauces': [
      'tamarind', 'tamarind paste', 'tamarind puree', 'sauce', 'soy sauce', 'low sodium soy sauce', 'tamari', 'coconut aminos',
      'fish sauce', 'oyster sauce', 'kecap manis', 'kicap manis', 'ketjap manis', 'sweet soy sauce', 'hoisin', 'hoisin sauce', 'teriyaki',
      'teriyaki sauce', 'sriracha', 'hot sauce', 'tabasco', 'buffalo sauce',
      'worcestershire', 'worcestershire sauce', 'bbq sauce', 'barbecue sauce',
      'ketchup', 'catsup', 'mustard', 'dijon', 'dijon mustard', 'yellow mustard',
      'whole grain mustard', 'honey mustard', 'mayonnaise', 'mayo', 'aioli',
      'relish', 'salsa', 'enchilada sauce', 'chili sauce', 'sweet chili sauce',
      'gochujang', 'sambal', 'sambal oelek', 'chili garlic sauce', 'harissa',
      'horseradish', 'wasabi', 'salad dressing', 'dressing', 'ranch', 'ranch dressing',
      'italian dressing', 'vinaigrette', 'caesar dressing', 'liquid smoke', 'steak sauce',
      'tartar sauce', 'cocktail sauce', 'ponzu', 'chili crisp', 'chili oil',
      'lemon juice bottled', 'lime juice bottled'
    ]
  },

  [A.SNACKS]: {
    'Nuts & Seeds': [
      'nut', 'almond', 'sliced almond', 'slivered almond', 'walnut', 'pecan', 'cashew',
      'peanut', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'brazil nut',
      'mixed nut', 'seed', 'sunflower seed', 'pumpkin seed', 'pepita', 'chia seed',
      'flax seed', 'flaxseed', 'ground flaxseed', 'hemp seed', 'sesame seed',
      'trail mix'
    ],
    'Dried Fruit': [
      'raisin', 'golden raisin', 'dried cranberry', 'craisin', 'dried apricot',
      'dried fig', 'dried date', 'medjool date', 'prune', 'dried cherry', 'dried mango',
      'dried fruit'
    ],
    'Chips & Crackers': [
      'chip', 'tortilla chip', 'potato chip', 'pita chip', 'cracker', 'saltine',
      'pretzel', 'popcorn', 'rice cake', 'granola bar', 'protein bar', 'cookie',
      'candy', 'gummy', 'jerky', 'beef jerky', 'pork rind'
    ]
  },

  [A.BEVERAGES]: {
    'Juice & Soda': [
      'juice', 'orange juice', 'apple juice', 'cranberry juice', 'grape juice',
      'pineapple juice', 'tomato juice', 'apple cider', 'lemonade', 'soda', 'cola', 'ginger ale',
      'sparkling water', 'club soda', 'tonic water', 'seltzer', 'water',
      'coconut water', 'kombucha', 'sports drink', 'energy drink'
    ],
    'Coffee & Tea': [
      'coffee', 'ground coffee', 'coffee bean', 'espresso', 'instant coffee',
      'espresso powder', 'tea', 'green tea', 'black tea', 'tea bag', 'matcha',
      'chai', 'herbal tea', 'hot chocolate', 'cocoa mix'
    ],
    Alcohol: [
      'wine', 'red wine', 'white wine', 'dry white wine', 'dry red wine', 'beer',
      'vodka', 'rum', 'tequila', 'whiskey', 'bourbon', 'gin', 'brandy', 'sake',
      'sherry', 'champagne', 'prosecco', 'vermouth', 'marsala', 'marsala wine',
      'liqueur', 'triple sec', 'port'
    ]
  },

  [A.HOUSEHOLD]: {
    'Paper & Wrap': [
      'paper towel', 'toilet paper', 'napkin', 'tissue', 'aluminum foil', 'foil',
      'tin foil', 'plastic wrap', 'cling wrap', 'wax paper', 'zip lock bag',
      'ziploc bag', 'sandwich bag', 'freezer bag', 'trash bag', 'garbage bag',
      'paper plate', 'food container', 'toothpick', 'skewer', 'kitchen twine'
    ],
    Cleaning: [
      'dish soap', 'dishwasher detergent', 'laundry detergent', 'detergent',
      'sponge', 'cleaner', 'all purpose cleaner', 'bleach', 'disinfectant wipe',
      'glass cleaner'
    ],
    'Personal Care': [
      'shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'deodorant', 'soap',
      'hand soap', 'body wash', 'lotion', 'sunscreen', 'razor'
    ],
    Pets: ['dog food', 'cat food', 'cat litter', 'pet food', 'dog treat']
  }
};

// Modifiers that override the aisle of whatever they modify.
const FROZEN_MODIFIERS = ['frozen'];
const CANNED_MODIFIERS = ['canned', 'tinned', 'jarred', 'can of', 'tin of', 'jar of'];
// Herb words that, when dried/ground, move from produce to spices.
const DRIED_MODIFIERS = ['dried', 'dry', 'ground', 'powdered', 'crushed dried'];

/* ------------------------------------------------------------------ */
/* Normalization and tokenization                                      */
/* ------------------------------------------------------------------ */

/**
 * Normalize an ingredient id or display name for matching.
 * "All-Purpose_Flour" -> "all purpose flour"; "Jalapeño" -> "jalapeno".
 */
export function normalizeIngredientName(name) {
  if (name === null || name === undefined) return '';
  let s = String(name).toLowerCase();
  try {
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch (e) {
    // normalize unsupported: ignore
  }
  return s
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical notes: "(optional)", "(14 oz)"
    .replace(/[-_/,.;:!?'"’`*+]/g, ' ')
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Conservative singularizer applied identically to keywords and input,
// so it only needs to be consistent, not linguistically perfect.
const NO_SINGULAR = new Set([
  'asparagus', 'hummus', 'couscous', 'swiss', 'molasses', 'grits', 'greens',
  'citrus', 'octopus', 'gas', 'bass', 'glass', 'hibiscus', 'series', 'species',
  'brussels', 'herbes'
]);
const IRREGULAR = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  chives: 'chive',
  olives: 'olive',
  cloves: 'clove',
  chips: 'chip',
  oats: 'oat',
  lentils: 'lentil',
  peas: 'pea',
  tomatoes: 'tomato',
  potatoes: 'potato',
  mangoes: 'mango',
  avocados: 'avocado',
  jalapenos: 'jalapeno',
  radishes: 'radish',
  peaches: 'peach',
  dishes: 'dish',
  sandwiches: 'sandwich',
  boxes: 'box',
  anchovies: 'anchovy',
  chilies: 'chili',
  chilis: 'chili',
  chillies: 'chilli',
  chillis: 'chilli',
  chiles: 'chile'
};

function singularize(word) {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (NO_SINGULAR.has(word) || word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|xes|sses|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function tokenize(name) {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean).map(singularize);
}

/* ------------------------------------------------------------------ */
/* Build the phrase index                                              */
/* ------------------------------------------------------------------ */

// index: firstToken -> [{ tokens, aisleId, subcategory, length }]
const PHRASE_INDEX = new Map();

function addPhrase(phrase, aisleId, subcategory) {
  const tokens = tokenize(phrase);
  if (!tokens.length) return;
  const entry = { tokens, aisleId, subcategory, phrase, length: tokens.length };
  const list = PHRASE_INDEX.get(tokens[0]) || [];
  // Later duplicate definitions do not override earlier ones.
  if (list.some(e => e.tokens.join(' ') === entry.tokens.join(' '))) return;
  list.push(entry);
  PHRASE_INDEX.set(tokens[0], list);
}

Object.entries(DICTIONARY).forEach(([aisleId, subcats]) => {
  Object.entries(subcats).forEach(([subcategory, phrases]) => {
    phrases.forEach(p => addPhrase(p, aisleId, subcategory));
  });
});

const tokenizedModifiers = list => list.map(tokenize);
const FROZEN_TOKENS = tokenizedModifiers(FROZEN_MODIFIERS);
const CANNED_TOKENS = tokenizedModifiers(CANNED_MODIFIERS);
const DRIED_TOKENS = tokenizedModifiers(DRIED_MODIFIERS);

function containsSequence(tokens, seq) {
  for (let i = 0; i + seq.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < seq.length; j++) {
      if (tokens[i + j] !== seq[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function hasAny(tokens, seqs) {
  return seqs.some(seq => containsSequence(tokens, seq));
}

// Find the best phrase match: most tokens wins (longest phrase),
// then the right-most position (English head nouns come last:
// "chicken sausage" -> sausage, "tomato soup" -> soup).
function findBestMatch(tokens) {
  let best = null;
  let bestPos = -1;
  for (let i = 0; i < tokens.length; i++) {
    const candidates = PHRASE_INDEX.get(tokens[i]);
    if (!candidates) continue;
    for (const c of candidates) {
      if (i + c.length > tokens.length) continue;
      let ok = true;
      for (let j = 1; j < c.length; j++) {
        if (tokens[i + j] !== c.tokens[j]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (!best || c.length > best.length || (c.length === best.length && i > bestPos)) {
        best = c;
        bestPos = i;
      }
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function buildResult(aisleId, subcategory, matched) {
  const aisle = AISLE_BY_ID[aisleId] || AISLE_BY_ID[A.HOUSEHOLD];
  return {
    aisleId: aisle.id,
    aisleName: aisle.name,
    order: aisle.order,
    subcategory: subcategory || DEFAULT_SUBCATEGORY,
    matched: matched || null
  };
}

const FROZEN_SUBCATEGORY_BY_AISLE = {
  [A.PRODUCE]: 'Frozen Vegetables',
  [A.MEAT_SEAFOOD]: 'Frozen Meat & Seafood',
  [A.BAKERY]: 'Frozen Bakery',
  [A.GRAINS]: 'Frozen Meals',
  [A.SNACKS]: 'Frozen Snacks'
};

const cache = new Map();
const CACHE_LIMIT = 2000;

/**
 * Determine the grocery aisle for an ingredient.
 * @param {string} name - ingredient id ("all-purpose-flour") or display name
 * @returns {{aisleId: string, aisleName: string, order: number, subcategory: string, matched: string|null}}
 */
export function getAisle(name) {
  const key = normalizeIngredientName(name);
  if (cache.has(key)) return { ...cache.get(key) };

  const result = computeAisle(key);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return { ...result };
}

function computeAisle(normalized) {
  const tokens = normalized ? normalized.split(' ').map(singularize) : [];
  if (!tokens.length) return buildResult(A.HOUSEHOLD, DEFAULT_SUBCATEGORY, null);

  const match = findBestMatch(tokens);

  // "frozen ..." always goes to the freezer aisle.
  if (hasAny(tokens, FROZEN_TOKENS)) {
    if (match && match.aisleId === A.FROZEN) return buildResult(A.FROZEN, match.subcategory, match.phrase);
    let sub = 'Other Frozen Items';
    if (match) {
      if (match.aisleId === A.PRODUCE) {
        sub = match.subcategory === 'Fruits' ? 'Frozen Fruits' : 'Frozen Vegetables';
      } else if (match.aisleId === A.DAIRY_EGGS && match.subcategory === 'Yogurt & Cultured Dairy') {
        sub = 'Frozen Desserts';
      } else {
        sub = FROZEN_SUBCATEGORY_BY_AISLE[match.aisleId] || sub;
      }
    }
    return buildResult(A.FROZEN, sub, match ? match.phrase : 'frozen');
  }

  // "canned/tinned/jarred ..." goes to canned goods unless the match is already shelf-stable.
  if (hasAny(tokens, CANNED_TOKENS)) {
    const shelfStable = [A.CANNED, A.CONDIMENTS, A.SPICES, A.BAKING, A.GRAINS];
    if (match && shelfStable.includes(match.aisleId)) {
      return buildResult(match.aisleId, match.subcategory, match.phrase);
    }
    let sub = 'Canned Fruits & Vegetables';
    if (match && match.aisleId === A.MEAT_SEAFOOD) sub = 'Canned Fish & Meat';
    return buildResult(A.CANNED, sub, match ? match.phrase : 'canned');
  }

  if (!match) return buildResult(A.HOUSEHOLD, DEFAULT_SUBCATEGORY, null);

  // Bare "pepper" is black pepper, but plural "peppers" means fresh peppers.
  if (match.phrase === 'pepper' && /\bpeppers\b/.test(normalized)) {
    return buildResult(A.PRODUCE, 'Vegetables', 'peppers');
  }

  // "dried thyme", "ground ginger": fresh herb/root matched but it's a dried spice.
  if (
    match.aisleId === A.PRODUCE &&
    (match.subcategory === 'Fresh Herbs' || match.phrase === 'ginger') &&
    hasAny(tokens, DRIED_TOKENS) &&
    !tokens.includes('fresh')
  ) {
    return buildResult(A.SPICES, match.subcategory === 'Fresh Herbs' ? 'Dried Herbs' : 'Ground Spices', match.phrase);
  }

  // "dried mango", "dried apricots": fruit -> dried fruit in snacks.
  if (match.aisleId === A.PRODUCE && match.subcategory === 'Fruits' && tokens.includes('dried')) {
    return buildResult(A.SNACKS, 'Dried Fruit', match.phrase);
  }

  return buildResult(match.aisleId, match.subcategory, match.phrase);
}

/**
 * Back-compat categorizer. Returns { category: { name, ... }, subcategory }.
 * category.name is the aisle name (e.g. "Produce", "Spices & Seasonings"),
 * so existing UIs that group by category.name get aisle grouping for free.
 * category also carries aisleId, order, icon and the legacy category key/name.
 */
export function categorizeIngredient(ingredientName) {
  const aisle = getAisle(ingredientName);
  const meta = AISLE_BY_ID[aisle.aisleId];
  const legacy = INGREDIENT_CATEGORIES[meta.legacy];
  return {
    category: {
      name: aisle.aisleName,
      aisleId: aisle.aisleId,
      order: aisle.order,
      icon: meta.icon,
      legacyKey: meta.legacy,
      legacyName: legacy.name,
      subcategories: legacy.subcategories
    },
    subcategory: aisle.subcategory,
    aisle
  };
}

/**
 * Look up an aisle by id or by display name (case-insensitive). Unknown -> null.
 * Handy for items saved with an older category string.
 */
export function getAisleById(idOrName) {
  if (!idOrName) return null;
  if (AISLE_BY_ID[idOrName]) return AISLE_BY_ID[idOrName];
  const lower = String(idOrName).toLowerCase();
  return AISLES.find(a => a.name.toLowerCase() === lower) || null;
}

const defaultGetName = item => {
  if (typeof item === 'string') return item;
  if (!item) return '';
  return item.name || item.ingredientId || item.id || '';
};

const itemOrder = (item, getName) => {
  if (item && typeof item === 'object' && item.aisleId && AISLE_BY_ID[item.aisleId]) {
    return AISLE_BY_ID[item.aisleId].order;
  }
  return getAisle(getName(item)).order;
};

/** Comparator: aisle order, then subcategory, then name (case-insensitive). */
export function compareByAisle(a, b, getName = defaultGetName) {
  const oa = itemOrder(a, getName);
  const ob = itemOrder(b, getName);
  if (oa !== ob) return oa - ob;
  const sa = getAisle(getName(a)).subcategory;
  const sb = getAisle(getName(b)).subcategory;
  if (sa !== sb) return sa.localeCompare(sb);
  return String(getName(a)).toLowerCase().localeCompare(String(getName(b)).toLowerCase());
}

/** Returns a new array sorted in store-walk order. */
export function sortByAisle(items, getName = defaultGetName) {
  return [...(items || [])].sort((a, b) => compareByAisle(a, b, getName));
}

/**
 * Group items by aisle in store-walk order.
 * @returns {Array<{aisle: object, items: Array}>} non-empty aisles only, items sorted.
 */
export function groupByAisle(items, getName = defaultGetName) {
  const groups = new Map();
  sortByAisle(items, getName).forEach(item => {
    const aisleId =
      item && typeof item === 'object' && item.aisleId && AISLE_BY_ID[item.aisleId]
        ? item.aisleId
        : getAisle(getName(item)).aisleId;
    if (!groups.has(aisleId)) groups.set(aisleId, []);
    groups.get(aisleId).push(item);
  });
  return AISLES.filter(a => groups.has(a.id)).map(a => ({ aisle: a, items: groups.get(a.id) }));
}

/**
 * Gets all available categories and their subcategories (legacy).
 * @returns {Object} Complete category hierarchy
 */
export function getAllCategories() {
  return INGREDIENT_CATEGORIES;
}

/**
 * Validates if a category/subcategory combination exists (legacy).
 */
export function isValidCategory(category, subcategory) {
  return Boolean(
    INGREDIENT_CATEGORIES[category] &&
      INGREDIENT_CATEGORIES[category].subcategories[subcategory]
  );
}
