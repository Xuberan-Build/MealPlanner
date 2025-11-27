// src/services/instructionsFormatterService.js

class InstructionsFormatterService {
  
  /**
   * Format recipe instructions using pattern recognition
   * Note: AI formatting has been disabled for security reasons.
   * All formatting is now done using the fallback pattern-based method.
   *
   * @param {string} rawInstructions - Raw instruction text
   * @returns {Promise<string>} Formatted HTML instructions
   */
  async formatInstructions(rawInstructions) {
    if (!rawInstructions?.trim()) {
      return '';
    }

    // Use pattern-based formatting (secure, no API keys)
    return this.fallbackFormatting(rawInstructions);
  }

  /**
   * Fallback formatting using pattern recognition
   * @param {string} rawInstructions - Raw instruction text
   * @returns {string} Basic formatted HTML
   */
  fallbackFormatting(rawInstructions) {
    if (!rawInstructions?.trim()) {
      return '';
    }

    let formatted = rawInstructions.trim();

    // Split into steps by common patterns
    const stepSeparators = /(?:\d+\.|Step \d+|First,|Then,|Next,|Finally,|\. [A-Z])/g;
    let steps = formatted.split(stepSeparators);
    
    // If no clear steps detected, split by periods followed by capital letters
    if (steps.length <= 1) {
      steps = formatted.split(/\. (?=[A-Z])/);
    }

    // Clean and format each step
    const formattedSteps = steps
      .map(step => step.trim())
      .filter(step => step.length > 10) // Remove very short fragments
      .map(step => {
        // Bold temperatures
        step = step.replace(/(\d+°[CF]|\d+\s*degrees?)/gi, '<strong>$1</strong>');
        
        // Bold cooking times
        step = step.replace(/(\d+[-–]\d+\s*(?:minutes?|hours?|mins?|hrs?)|\d+\s*(?:minutes?|hours?|mins?|hrs?))/gi, '<strong>$1</strong>');
        
        // Bold cooking actions
        step = step.replace(/\b(Preheat|Heat|Cook|Bake|Sauté|Simmer|Boil|Fry|Season|Add|Mix|Combine|Stir|Whisk|Blend)\b/gi, '<strong>$1</strong>');
        
        return step;
      });

    if (formattedSteps.length > 1) {
      return '<ol>' + formattedSteps.map(step => `<li>${step}</li>`).join('') + '</ol>';
    } else {
      return formatted
        .replace(/(\d+°[CF]|\d+\s*degrees?)/gi, '<strong>$1</strong>')
        .replace(/(\d+[-–]\d+\s*(?:minutes?|hours?|mins?|hrs?)|\d+\s*(?:minutes?|hours?|mins?|hrs?))/gi, '<strong>$1</strong>')
        .replace(/\b(Preheat|Heat|Cook|Bake|Sauté|Simmer|Boil|Fry|Season|Add|Mix|Combine|Stir|Whisk|Blend)\b/gi, '<strong>$1</strong>');
    }
  }

  /**
   * Clean HTML to plain text
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  htmlToPlainText(html) {
    return html
      .replace(/<(.|\n)*?>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const instructionsFormatterService = new InstructionsFormatterService();
export default instructionsFormatterService;
