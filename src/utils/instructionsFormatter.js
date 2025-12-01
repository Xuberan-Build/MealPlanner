/**
 * Utility to format plain text instructions into readable HTML
 * Used for displaying instructions that weren't formatted with Smart Format
 */

/**
 * Check if text contains HTML tags
 */
function isHTML(text) {
  const htmlRegex = /<\/?[a-z][\s\S]*>/i;
  return htmlRegex.test(text);
}

/**
 * Bold temperatures (e.g., 375°F, 190°C, 350 degrees)
 */
function boldTemperatures(text) {
  return text
    .replace(/(\d+)°([FC])/g, '<strong>$1°$2</strong>')
    .replace(/(\d+)\s*degrees?/gi, '<strong>$1 degrees</strong>');
}

/**
 * Bold times (e.g., 20 minutes, 1 hour, 2-3 hours)
 */
function boldTimes(text) {
  return text
    .replace(/(\d+(?:-\d+)?)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/gi, '<strong>$1 $2</strong>');
}

/**
 * Bold measurements and numbers at start of instructions
 */
function boldMeasurements(text) {
  return text
    .replace(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(cups?|tbsp?|tsp?|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|grams?|ml|liters?)/gmi,
      '<strong>$1 $2</strong>');
}

/**
 * Convert plain text instructions to formatted HTML
 */
export function formatInstructions(text) {
  // If already HTML, return as-is
  if (!text) return '';
  if (isHTML(text)) return text;

  // Split into sentences based on periods followed by space and capital letter
  // This preserves natural sentence flow
  let formatted = text;

  // Apply formatting
  formatted = boldTemperatures(formatted);
  formatted = boldTimes(formatted);
  formatted = boldMeasurements(formatted);

  // Split into sentences for better readability
  // Match sentences ending with period, exclamation, or question mark followed by space
  const sentences = formatted.split(/([.!?])\s+(?=[A-Z])/);

  // Reconstruct with line breaks
  let result = '';
  for (let i = 0; i < sentences.length; i += 2) {
    if (sentences[i]) {
      const sentence = sentences[i] + (sentences[i + 1] || '');
      result += `<p class="instruction-step">${sentence.trim()}</p>`;
    }
  }

  // If no sentences were detected (no periods), return as single paragraph
  if (!result) {
    result = `<p class="instruction-step">${formatted}</p>`;
  }

  return result;
}

/**
 * Strip HTML tags and return plain text
 */
export function stripHTML(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export default {
  formatInstructions,
  stripHTML,
  isHTML
};
