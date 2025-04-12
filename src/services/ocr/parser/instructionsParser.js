import { cleanText } from '../utils/textCleaner';

/**
 * Determines if a line is likely the start of instructions
 * @param {string} line - Text line to check
 * @returns {boolean} True if line appears to be instruction header
 */
function isInstructionHeader(line) {
  const headerPatterns = [
    /^instructions?:?$/i,
    /^directions?:?$/i,
    /^method:?$/i,
    /^preparation:?$/i,
    /^steps?:?$/i
  ];

  return headerPatterns.some(pattern => pattern.test(line.trim()));
}

/**
 * Formats instruction steps into a clean, numbered list
 * @param {string[]} steps - Array of instruction steps
 * @returns {string} Formatted instructions
 */
function formatInstructions(steps) {
  return steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n\n');
}

/**
 * Extracts cooking instructions from recipe text
 * @param {string} text - Full recipe text
 * @returns {Promise<string>} Formatted cooking instructions
 */
export async function extractInstructions(text) {
  const lines = text.split('\n').map(line => cleanText(line));
  let instructions = [];
  let inInstructionsSection = false;
  let currentStep = '';
  let ingredientsSectionFound = false;

  // First, check if we have an ingredients section
  // This helps us identify where the instructions might start
  for (let i = 0; i < lines.length; i++) {
    if (/^ingredients?:?$/i.test(lines[i].trim())) {
      ingredientsSectionFound = true;
      break;
    }
  }

  // Look for instruction section and collect steps
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line) continue;

    // Check if we've found the instructions section header
    if (isInstructionHeader(line)) {
      inInstructionsSection = true;
      continue;
    }

    // If we found ingredients section earlier, and now we're past it,
    // and we see a pattern that looks like a step, assume we're in instructions
    if (ingredientsSectionFound && !inInstructionsSection && i > 10) {
      // Look for patterns that suggest we're in the instructions section
      if (/^(?:\d+[\.):]|\*|\-|\•)/.test(line) ||
          (/^[A-Z]/.test(line) && line.length > 20)) {
        inInstructionsSection = true;
      }
    }

    // If we're in the instructions section
    if (inInstructionsSection) {
      // Look for numbered steps or bullet points
      if (/^(?:\d+[\.):]|\*|\-|\•)/.test(line)) {
        // If we have a previous step, save it
        if (currentStep) {
          instructions.push(currentStep.trim());
          currentStep = '';
        }
        // Start new step (remove leading numbers/bullets)
        currentStep = line.replace(/^(?:\d+[\.):]|\*|\-|\•)\s*/, '');
      }
      // If line starts with a capital letter and previous line was empty,
      // it might be a new step without numbering
      else if (/^[A-Z]/.test(line) && (!lines[i - 1]?.trim() || lines[i - 1]?.trim().endsWith('.'))) {
        if (currentStep) {
          instructions.push(currentStep.trim());
          currentStep = '';
        }
        currentStep = line;
      }
      // Otherwise, append to current step
      else {
        currentStep += ' ' + line;
      }
    }
  }

  // Add the last step if there is one
  if (currentStep) {
    instructions.push(currentStep.trim());
  }

  // If we didn't find an instructions section, try alternative approach
  if (!instructions.length) {
    // Look for numbered lines anywhere in the text
    const numberedLines = lines.filter(line => /^\d+[\.):]/.test(line));
    if (numberedLines.length > 0) {
      instructions = numberedLines.map(line =>
        line.replace(/^\d+[\.):]/, '').trim()
      );
    }
    
    // If still no instructions, look for sentences that might be instructions
    if (!instructions.length) {
      // Look for sentences that start with action verbs common in recipes
      const actionVerbs = ['preheat', 'heat', 'mix', 'stir', 'add', 'combine', 'cook', 'bake', 'roast', 'simmer', 'boil'];
      const potentialInstructions = lines.filter(line => {
        const words = line.toLowerCase().split(' ');
        return words.length > 5 && actionVerbs.includes(words[0]);
      });
      
      if (potentialInstructions.length > 0) {
        instructions = potentialInstructions;
      }
    }
  }

  // If we still have no instructions, create a placeholder
  if (!instructions.length) {
    return "Instructions not found in the provided image. Please add them manually.";
  }

  // Format the instructions
  return formatInstructions(instructions);
}
