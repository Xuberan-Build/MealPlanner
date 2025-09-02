// src/services/instructionsFormatterService.js

class InstructionsFormatterService {
  
  /**
   * Intelligently format recipe instructions using AI
   * @param {string} rawInstructions - Raw instruction text
   * @returns {Promise<string>} Formatted HTML instructions
   */
  async formatInstructions(rawInstructions) {
    if (!rawInstructions?.trim()) {
      return '';
    }

    try {
      const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
      
      if (!OPENAI_API_KEY) {
        console.error('OpenAI API key is not defined in environment variables!');
        return this.fallbackFormatting(rawInstructions);
      }

      const prompt = `
      Format the following recipe instructions for better readability. Return formatted HTML that includes:
      
      1. Break text into clear, numbered steps
      2. Bold important elements like temperatures (450°F), times (10 minutes), and key cooking actions
      3. Use proper line breaks between steps
      4. Keep the HTML simple - use only <ol>, <li>, <strong>, <em>, and <br> tags
      5. Maintain the original cooking information exactly - don't change ingredients, quantities, or methods
      
      Raw Instructions:
      """
      ${rawInstructions}
      """
      
      Return only the formatted HTML, no explanation:
      `;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OpenAI request failed: ${response.status} ${errorBody}`);
        return this.fallbackFormatting(rawInstructions);
      }

      const result = await response.json();
      
      if (!result?.choices?.[0]?.message?.content) {
        console.error('Invalid OpenAI response structure');
        return this.fallbackFormatting(rawInstructions);
      }

      const formattedInstructions = result.choices[0].message.content.trim();
      console.log('AI formatted instructions successfully');
      
      return formattedInstructions;

    } catch (error) {
      console.error('Error formatting instructions with AI:', error);
      return this.fallbackFormatting(rawInstructions);
    }
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
