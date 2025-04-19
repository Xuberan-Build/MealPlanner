import { createWorker } from 'tesseract.js';

export async function extractRecipeFromImage(imageFiles) {
  const worker = await createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  try {
    let fullText = '';

    for (const file of imageFiles) {
      const imageSrc = URL.createObjectURL(file);
      const { data: { text } } = await worker.recognize(imageSrc);
      console.log(`🧠 OCR text from image:`, text);
      fullText += '\n' + text;
      URL.revokeObjectURL(imageSrc); // Clean up
    }

    await worker.terminate();

    const recipe = parseRecipeText(fullText);
    return recipe;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}
function extractHeaderBlock(lines) {
  const headerMap = {
    "prep time": "prepTime",
    "cook time": "cookTime",
    "servings": "servings",
    "diet type": "dietType",
    "meal type": "mealType"
  };

  for (let i = 0; i < lines.length - 1; i++) {
    const headerLine = lines[i].toLowerCase().replace(/\s+/g, ' ').trim();
    const valueLine = lines[i + 1].trim();

    // Step 1: Find valid headers
    const headers = [];
    const keysInOrder = [];

    for (const header in headerMap) {
      if (headerLine.includes(header)) {
        headers.push(header);
        keysInOrder.push(headerMap[header]);
      }
    }

    // Step 2: Extract values carefully
    const valueRegex = /(\d+\s*min(?:utes)?|\d+\s*hrs?|[A-Za-z][A-Za-z\s\-]+|\d+)/g;
    const values = valueLine.match(valueRegex)?.map(v => v.trim()) || [];

    if (headers.length && values.length >= headers.length) {
      const extracted = {};
      keysInOrder.forEach((key, index) => {
        extracted[key] = values[index] || '';
      });

      console.log('🥣 OCR Header Extraction:', extracted);
      return extracted;
    }
  }

  return {};
}

function parseRecipeText(text) {
  const recipe = {
    title: '',
    ingredients: [],
    instructions: '',
    prepTime: '',
    cookTime: '',
    servings: '',
    dietType: '',
    mealType: ''
  };

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

  // Smart header parsing block
  const headers = extractHeaderBlock(lines);
  console.log(headers)
  recipe.prepTime = headers.prepTime || '';
  recipe.cookTime = headers.cookTime || '';
  recipe.servings = headers.servings || '';
  recipe.dietType = headers.dietType || '';
  recipe.mealType = headers.mealType || '';

  // fallback if not extracted
  if (!recipe.title) recipe.title = extractTitle(lines);
  if (!recipe.prepTime || !recipe.cookTime) {
    const timeInfo = extractTimeInfo(text);
    recipe.prepTime = recipe.prepTime || timeInfo.prepTime;
    recipe.cookTime = recipe.cookTime || timeInfo.cookTime || timeInfo.prepTime;
  }

  if (!recipe.servings) recipe.servings = extractServings(text);
  recipe.ingredients = extractIngredients(text);
  recipe.instructions = extractInstructions(text);

  return recipe;
}


function extractTitle(lines) {
  // Look for patterns that might indicate a title
  const titlePatterns = [
    /recipe\s*:\s*(.+)/i,
    /^([^:]+)$/,  // First line that doesn't contain a colon
    /^(.+?)\s*\(\d+/  // Text before parentheses with numbers
  ];

  for (const line of lines) {
    for (const pattern of titlePatterns) {
      const match = line.match(pattern);
      if (match && match[1] && !match[1].toLowerCase().includes('ingredient')) {
        return match[1].trim();
      }
    }
  }

  // Fallback: Use first non-empty line
  return lines[0] || '';
}

function extractTimeInfo(text) {
  const timeInfo = {
    prepTime: '',
    cookTime: ''
  };

  // Look for various time formats
  const prepTimePatterns = [
    /prep(?:aration)?\s*time:?\s*(\d+)\s*(?:min|minutes?|hrs?|hours?)/i,
    /prep(?:aration)?:?\s*(\d+)\s*(?:min|minutes?|hrs?|hours?)/i
  ];

  const cookTimePatterns = [
    /cook(?:ing)?\s*time:?\s*(\d+)\s*(?:min|minutes?|hrs?|hours?)/i,
    /cook(?:ing)?:?\s*(\d+)\s*(?:min|minutes?|hrs?|hours?)/i,
    /bake(?:ing)?\s*time:?\s*(\d+)\s*(?:min|minutes?|hrs?|hours?)/i
  ];

  for (const pattern of prepTimePatterns) {
    const match = text.match(pattern);
    if (match) {
      timeInfo.prepTime = match[1] + ' min';
      break;
    }
  }

  for (const pattern of cookTimePatterns) {
    const match = text.match(pattern);
    if (match) {
      timeInfo.cookTime = match[1] + ' min';
      break;
    }
  }

  // Try to find total time if specific times aren't found
  if (!timeInfo.prepTime && !timeInfo.cookTime) {
    const totalTimeMatch = text.match(/total\s*time:?\s*(\d+)\s*(?:min|minutes?|hrs?|hours?)/i);
    if (totalTimeMatch) {
      timeInfo.prepTime = totalTimeMatch[1] + ' min';
    }
  }

  return timeInfo;
}

function extractServings(text) {
  const servingsPatterns = [
    /serves:?\s*(\d+)/i,
    /servings:?\s*(\d+)/i,
    /yield:?\s*(\d+)/i,
    /makes:?\s*(\d+)/i,
    /(\d+)\s*servings/i
  ];

  for (const pattern of servingsPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return '';
}

function extractIngredients(text) {
  const ingredients = [];
  let inIngredientsSection = false;
  let ingredientsText = '';

  // Try to find ingredients section
  const sections = text.split(/(?:instructions|directions|method|steps)/i)[0];
  const ingredientsMatch = sections.match(/ingredients?[:\s]+([\s\S]+)$/i);

  if (ingredientsMatch) {
    ingredientsText = ingredientsMatch[1];
  } else {
    // Fallback: Look for lines that look like ingredients
    ingredientsText = text;
  }

  // Split into lines and process each
  const lines = ingredientsText.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and likely headers
    if (!trimmedLine || trimmedLine.toLowerCase().includes('ingredients')) {
      continue;
    }

    // Check if line looks like an ingredient
    if (isIngredientLine(trimmedLine)) {
      ingredients.push(trimmedLine);
    }
  }

  return ingredients;
}

function isIngredientLine(line) {
  // Check for common ingredient line patterns
  const patterns = [
    /^\d+/, // Starts with number
    /^[\d⅛⅙⅕¼⅓½⅔¾]/, // Starts with number or fraction
    /^([a-z]+\s)?cup/i, // Cup measurements
    /^([a-z]+\s)?tablespoon/i,
    /^([a-z]+\s)?teaspoon/i,
    /^([a-z]+\s)?pound/i,
    /^([a-z]+\s)?ounce/i,
    /^•/, // Bullet points
    /^-/, // Dashes
    /^[a-z\s]+\s+(?:to taste|chopped|minced|diced|sliced)/i // Common ingredient preparations
  ];

  return patterns.some(pattern => pattern.test(line));
}

function extractInstructions(text) {
  // Try to find instructions section
  const instructionsMatch = text.match(/(?:instructions|directions|method|steps)[:\s]+([\s\S]+)$/i);

  if (instructionsMatch) {
    return instructionsMatch[1].trim();
  }

  // Fallback: Look for numbered lines after ingredients
  const lines = text.split('\n');
  let instructions = [];
  let foundNumberedLine = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (/^\d+\.?\s/.test(trimmedLine)) {
      foundNumberedLine = true;
      instructions.push(trimmedLine);
    } else if (foundNumberedLine && trimmedLine.length > 20) {
      // Continue collecting long lines after finding numbered steps
      instructions.push(trimmedLine);
    }
  }

  return instructions.join('\n');
}
