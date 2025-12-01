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

  // Split by double line breaks for paragraphs
  const paragraphs = text.split(/\n\s*\n/);

  const formattedParagraphs = paragraphs.map(paragraph => {
    // Split by single line breaks for steps
    const lines = paragraph.split(/\n/).filter(line => line.trim());

    if (lines.length === 0) return '';

    // Check if lines are already numbered
    const hasNumbers = lines[0].match(/^\d+[\.\)]/);

    if (hasNumbers || lines.length > 1) {
      // Format as ordered list
      const listItems = lines.map((line, index) => {
        // Remove existing numbering if present
        let cleanLine = line.replace(/^\d+[\.\)]\s*/, '').trim();

        // Apply formatting
        cleanLine = boldTemperatures(cleanLine);
        cleanLine = boldTimes(cleanLine);
        cleanLine = boldMeasurements(cleanLine);

        return `<li>${cleanLine}</li>`;
      }).join('');

      return `<ol>${listItems}</ol>`;
    } else {
      // Single line paragraph
      let formatted = lines[0];
      formatted = boldTemperatures(formatted);
      formatted = boldTimes(formatted);
      formatted = boldMeasurements(formatted);
      return `<p>${formatted}</p>`;
    }
  });

  return formattedParagraphs.join('');
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
