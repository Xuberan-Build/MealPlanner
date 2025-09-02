// src/features/shoppingList/constants/categories.js

export const SHOPPING_CATEGORIES = [
  { 
    name: 'Snacks & Treats', 
    subcategories: [
      {
        name: 'Granola Bars',
        items: ['Nature Valley Oats & Honey', 'Kind Dark Chocolate Nuts', 'Clif Bar Energy', 'RX Bar Chocolate Sea Salt', 'Quaker Chewy Chocolate Chip']
      },
      {
        name: 'Chips & Crackers', 
        items: ['Lay\'s Classic', 'Doritos Nacho Cheese', 'Pringles Original', 'Goldfish Crackers', 'Ritz Crackers']
      },
      {
        name: 'Nuts & Seeds',
        items: ['Almonds (raw)', 'Mixed nuts', 'Cashews (roasted)', 'Peanuts (salted)', 'Sunflower seeds']
      },
      {
        name: 'Cookies & Sweets',
        items: ['Oreo cookies', 'Chocolate chip cookies', 'Animal crackers', 'Gummy bears', 'Dark chocolate bar']
      }
    ]
  },
  { 
    name: 'Beverages', 
    subcategories: [
      {
        name: 'Hot Beverages',
        items: ['Coffee beans (medium roast)', 'Green tea bags', 'Earl Grey tea', 'Hot chocolate mix', 'Chai tea latte']
      },
      {
        name: 'Cold Beverages',
        items: ['Orange juice', 'Apple juice', 'Sparkling water', 'Coca Cola', 'Iced tea']
      },
      {
        name: 'Alcoholic',
        items: ['Red wine', 'White wine', 'Beer (IPA)', 'Vodka', 'Whiskey']
      }
    ]
  },
  { 
    name: 'Household Items', 
    subcategories: [
      {
        name: 'Cleaning Supplies',
        items: ['All-purpose cleaner', 'Dish soap', 'Laundry detergent', 'Glass cleaner', 'Disinfectant wipes']
      },
      {
        name: 'Paper Products',
        items: ['Paper towels', 'Toilet paper', 'Napkins', 'Paper plates', 'Tissues']
      },
      {
        name: 'Storage & Organization',
        items: ['Zip-lock bags', 'Aluminum foil', 'Plastic wrap', 'Food containers', 'Trash bags']
      }
    ]
  },
  { 
    name: 'Personal Care', 
    subcategories: [
      {
        name: 'Hair Care',
        items: ['Shampoo', 'Conditioner', 'Hair gel', 'Dry shampoo', 'Hair ties']
      },
      {
        name: 'Oral Care',
        items: ['Toothpaste', 'Toothbrush', 'Mouthwash', 'Dental floss', 'Whitening strips']
      },
      {
        name: 'Body Care',
        items: ['Body wash', 'Deodorant', 'Lotion', 'Sunscreen', 'Hand soap']
      }
    ]
  },
  { 
    name: 'Pet Supplies', 
    subcategories: [
      {
        name: 'Dog Supplies',
        items: ['Dog food (dry)', 'Dog treats', 'Dog toys', 'Poop bags', 'Dog shampoo']
      },
      {
        name: 'Cat Supplies',
        items: ['Cat food (wet)', 'Cat litter', 'Cat treats', 'Cat toys', 'Litter box liners']
      }
    ]
  }
];