// src/services/aiImportClient.js
//
// Calls the signed-in-only HTTP import functions (extractRecipeFromUrl, parseRecipeFromOCR).
// Sends the user's ID token and uses the functions of the project the app is configured for.
import { app, auth } from '../firebase';

const REGION = 'us-central1';
const TIMEOUT_MS = 60000; // the functions allow 60 s

/**
 * @param {string} name - Function name
 * @param {object} body - JSON body
 * @returns {Promise<object>} The parsed JSON response (success: true)
 */
export async function callImportFunction(name, body) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be logged in to import recipes');
  }
  const token = await user.getIdToken();
  const projectId = app?.options?.projectId;
  const url = `https://${REGION}-${projectId}.cloudfunctions.net/${name}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(error.name === 'AbortError'
      ? 'The import took too long. Please try again.'
      : 'Could not reach the recipe import service. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Recipe import failed (${response.status}). Please try again.`);
  }
  return data;
}
