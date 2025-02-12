import { cleanText } from '../utils/textCleaner';

/**
 * Converts time expressions to minutes
 * @param {string} timeStr - Time string (e.g., "1 hour 30 minutes")
 * @returns {number} Time in minutes
 */
function convertToMinutes(timeStr) {
  let total = 0;
  const hourMatch = timeStr.match(/(\d+)\s*(?:hour|hr)/i);
  const minuteMatch = timeStr.match(/(\d+)\s*(?:minute|min)/i);

  if (hourMatch) {
    total += parseInt(hourMatch[1]) * 60;
  }
  if (minuteMatch) {
    total += parseInt(minuteMatch[1]);
  }

  return total;
}

/**
 * Extracts cooking time information from recipe text
 * @param {string} text - Full recipe text
 * @returns {Promise<Object>} Time information object
 */
export async function extractTimeInfo(text) {
  const timeInfo = {
    prepTime: '',
    cookTime: '',
    totalTime: ''
  };

  const cleanedText = cleanText(text);

  // Common time patterns
  const timePatterns = {
    prep: [
      /prep(?:aration)?\s*time:?\s*(.+?)(?:\.|$|\n)/i,
      /prep(?:aration)?:?\s*(.+?)(?:\.|$|\n)/i
    ],
    cook: [
      /cook(?:ing)?\s*time:?\s*(.+?)(?:\.|$|\n)/i,
      /bake(?:ing)?\s*time:?\s*(.+?)(?:\.|$|\n)/i
    ],
    total: [
      /total\s*time:?\s*(.+?)(?:\.|$|\n)/i,
      /time\s*needed:?\s*(.+?)(?:\.|$|\n)/i
    ]
  };

  // Extract prep time
  for (const pattern of timePatterns.prep) {
    const match = cleanedText.match(pattern);
    if (match && match[1]) {
      const minutes = convertToMinutes(match[1]);
      if (minutes > 0) {
        timeInfo.prepTime = `${minutes} min`;
        break;
      }
    }
  }

  // Extract cook time
  for (const pattern of timePatterns.cook) {
    const match = cleanedText.match(pattern);
    if (match && match[1]) {
      const minutes = convertToMinutes(match[1]);
      if (minutes > 0) {
        timeInfo.cookTime = `${minutes} min`;
        break;
      }
    }
  }

  // Extract total time
  for (const pattern of timePatterns.total) {
    const match = cleanedText.match(pattern);
    if (match && match[1]) {
      const minutes = convertToMinutes(match[1]);
      if (minutes > 0) {
        timeInfo.totalTime = `${minutes} min`;
        break;
      }
    }
  }

  // If we have prep and cook time but no total, calculate it
  if (timeInfo.prepTime && timeInfo.cookTime && !timeInfo.totalTime) {
    const prepMinutes = convertToMinutes(timeInfo.prepTime);
    const cookMinutes = convertToMinutes(timeInfo.cookTime);
    timeInfo.totalTime = `${prepMinutes + cookMinutes} min`;
  }

  return timeInfo;
}
