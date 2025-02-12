import { cleanText } from '../utils/textCleaner';

/**
 * A set of words that typically don't appear in recipe titles
 * This helps filter out headers and section markers
 */
const NON_TITLE_WORDS = new Set([
  'ingredients',
  'instructions',
  'directions',
  'steps',
  'method',
  'preparation',
  'recipe',
  'yield',
  'serves',
  'servings',
  'prep time',
  'cook time',
  'total time'
]);

/**
 * Checks if a line matches common recipe title patterns
 * @param {string} line - Text line to analyze
 * @returns {boolean} True if line matches title patterns
 */
function isLikelyTitle(line) {
  // Titles are typically 2-50 characters
  if (line.length < 2 || line.length > 50) return false;

  const lowercaseLine = line.toLowerCase();

  // Check for non-title words
  if ([...NON_TITLE_WORDS].some(word => lowercaseLine.includes(word))) {
    return false;
  }

  // Titles often start with capital letters
  if (!/^[A-Z]/.test(line)) return false;

  // Avoid lines that look like measurements
  if (/^\d+/.test(line)) return false;

  return true;
}

/**
 * Extracts explicit title declarations using common patterns
 * @param {string} text - Full text to search
 * @returns {string|null} Extracted title or null if not found
 */
function findExplicitTitle(text) {
  const titlePatterns = [
    /recipe\s*:\s*([^:\n]+)/i,
    /title\s*:\s*([^:\n]+)/i,
    /name\s*:\s*([^:\n]+)/i,
    /([^:\n]+)\s*recipe\s*$/i
  ];

  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const possibleTitle = cleanText(match[1]);
      if (isLikelyTitle(possibleTitle)) {
        return possibleTitle;
      }
    }
  }

  return null;
}

/**
 * Finds the most likely title from a block of recipe text
 * @param {string} text - Full recipe text content
 * @returns {Promise<string>} Best candidate for recipe title
 */
export async function extractTitle(text) {
  // Split text into lines and clean them
  const lines = text.split('\n')
    .map(line => cleanText(line))
    .filter(line => line.length > 0);

  // Strategy 1: Look for explicit title declarations
  const explicitTitle = findExplicitTitle(text);
  if (explicitTitle) {
    return explicitTitle;
  }

  // Strategy 2: Analyze first few lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (isLikelyTitle(line)) {
      return line;
    }
  }

  // Strategy 3: Look for emphasized text in the first few lines
  // This would typically come from OCR metadata about text size or styling
  const emphasizedText = lines
    .slice(0, 5)
    .find(line => line.includes('*') || line.includes('_'));

  if (emphasizedText) {
    // Clean up any markdown-style emphasis markers
    const cleaned = emphasizedText.replace(/[*_]/g, '').trim();
    if (isLikelyTitle(cleaned)) {
      return cleaned;
    }
  }

  // Strategy 4: Find the longest line from the first few lines
  // that meets title criteria
  const candidateLines = lines
    .slice(0, 5)
    .filter(isLikelyTitle)
    .sort((a, b) => b.length - a.length);

  if (candidateLines.length > 0) {
    return candidateLines[0];
  }

  // Fallback: Use first non-empty line or default text
  return lines[0] || 'Untitled Recipe';
}
