// src/utils/safeHtml.js
//
// Every piece of recipe HTML the app renders or loads into the editor goes through
// sanitizeRecipeHtml first. Recipe text can come from other users (sharing), web pages
// (URL import), OCR and AI formatting, so it is never trusted.
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'blockquote', 'span', 'a',
];
const ALLOWED_ATTR = ['class', 'href'];

let hooksAdded = false;
function addHooks() {
  if (hooksAdded) return;
  hooksAdded = true;
  // Links open in a new tab without giving the page access to the app.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

/**
 * Clean recipe HTML: formatting tags only, no scripts, event handlers, styles or
 * javascript: links.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeRecipeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  addHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
}

/**
 * Escape plain text so it can be placed inside HTML as text.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
