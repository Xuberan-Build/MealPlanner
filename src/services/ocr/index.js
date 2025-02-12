import { createWorker } from 'tesseract.js';
import { preprocessImage } from './preprocessor';
import { parseRecipeText } from './parser';

/**
 * Extracts recipe information from an image file
 * @param {File} imageFile - The image file containing the recipe
 * @returns {Promise<Object>} Parsed recipe object
 */
export async function extractRecipeFromImage(imageFile) {
  const worker = await createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  try {
    // Preprocess image for better OCR
    const processedImage = await preprocessImage(imageFile);

    // Configure OCR for recipe text recognition
    const { data: { text } } = await worker.recognize(processedImage, {
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/°⁄½⅓¼⅔¾',
      tessedit_pageseg_mode: '6', // Assume uniform text block
    });

    console.log('Raw OCR text:', text);
    const recipe = await parseRecipeText(text);

    return recipe;
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw error;
  } finally {
    await worker.terminate();
  }
}
