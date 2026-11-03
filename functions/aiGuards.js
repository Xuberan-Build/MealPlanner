// functions/aiGuards.js
//
// Guards for the AI import endpoints (URL import, photo/OCR import, pasted text):
//   - the caller must send a valid Firebase ID token;
//   - inputs are capped;
//   - recipe URLs must be public http(s) pages: no localhost, private networks or the cloud
//     metadata server, checked again on every redirect, with a size cap on the page;
//   - each user has a daily allowance of AI calls (counted in Firestore by the caller).

import {isIP} from "node:net";

export const AI_LIMITS = {
  MAX_URL_LENGTH: 2048,
  MAX_OCR_CHARS: 20000,
  MAX_TEXT_CHARS: 20000,
  MAX_PAGE_BYTES: 3 * 1024 * 1024,
  MAX_REDIRECTS: 3,
  MAX_OUTPUT_TOKENS: 1500,
  CALLS_PER_DAY: 25,
};

// Web origins allowed to call the HTTP endpoints from a browser.
export const ALLOWED_ORIGINS = [
  "https://meal-planner-v1-9be19.web.app",
  "https://meal-planner-v1-9be19.firebaseapp.com",
  "https://meal-planner-dev-141e2.web.app",
  "https://meal-planner-dev-141e2.firebaseapp.com",
  "http://localhost:3000",
  "http://localhost:3100",
];

/** Error carrying an HTTP status and a user-facing message. */
export class GuardError extends Error {
  /**
   * @param {number} status - HTTP status
   * @param {string} message - User-facing message
   */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Read the ID token from an "Authorization: Bearer <token>" header.
 * @param {string|undefined} header - Header value
 * @return {string|null} Token
 */
export function parseBearerToken(header) {
  const match = /^Bearer\s+(\S+)$/i.exec(String(header || "").trim());
  return match ? match[1] : null;
}

/**
 * Verify the caller's ID token.
 * @param {object} request - HTTP request
 * @param {function(string): Promise<object>} verifyIdToken - Firebase Admin verifier
 * @return {Promise<string>} The caller's uid
 */
export async function requireUser(request, verifyIdToken) {
  const token = parseBearerToken(request.headers?.authorization);
  if (!token) throw new GuardError(401, "Sign in to import recipes.");
  try {
    const decoded = await verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    throw new GuardError(401, "Your session has expired. Sign in again.");
  }
}

/**
 * Whether an IP address is loopback, private, link-local (incl. the metadata server),
 * carrier-grade NAT, multicast, reserved or otherwise not a public internet address.
 * @param {string} address - IPv4 or IPv6 address
 * @return {boolean} True when the address must not be fetched
 */
export function isPrivateAddress(address) {
  const ip = String(address || "").toLowerCase().replace(/^\[|\]$/g, "");
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (version === 6) {
    if (ip === "::" || ip === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(ip) || ip.startsWith("64:ff9b:") || ip.startsWith("2001:db8:");
  }
  return true; // not an IP at all
}

/**
 * Check a recipe URL before fetching it.
 * @param {string} raw - URL from the client
 * @return {URL} Parsed URL
 */
export function validatePublicUrl(raw) {
  if (typeof raw !== "string" || !raw.trim() || raw.length > AI_LIMITS.MAX_URL_LENGTH) {
    throw new GuardError(400, "Enter a recipe web address.");
  }
  let url;
  try {
    url = new URL(raw.trim());
  } catch (error) {
    throw new GuardError(400, "That doesn't look like a web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new GuardError(400, "Only http and https recipe links can be imported.");
  }
  if (url.username || url.password) {
    throw new GuardError(400, "That web address can't be imported.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") ||
      host.endsWith(".local") || (isIP(host.replace(/^\[|\]$/g, "")) && isPrivateAddress(host))) {
    throw new GuardError(400, "That web address can't be imported.");
  }
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) {
    throw new GuardError(400, "That web address can't be imported.");
  }
  return url;
}

/**
 * Resolve a hostname and refuse it if any address is private.
 * @param {string} hostname - Host to check
 * @param {function(string, object): Promise<Array<{address: string}>>} lookup - dns.promises.lookup
 */
export async function assertPublicHost(hostname, lookup) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new GuardError(400, "That web address can't be imported.");
    return;
  }
  let addresses;
  try {
    addresses = await lookup(host, {all: true});
  } catch (error) {
    throw new GuardError(400, "That website couldn't be found.");
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new GuardError(400, "That web address can't be imported.");
  }
}

/**
 * Fetch a public web page as text: every redirect hop is re-checked and the body is capped.
 * @param {string} raw - URL from the client
 * @param {object} deps - {fetchImpl, lookup, headers}
 * @return {Promise<{status: number, ok: boolean, text: string, url: string}>} Page
 */
export async function safeFetchText(raw, {fetchImpl, lookup, headers = {}}) {
  let url = validatePublicUrl(raw);
  for (let hop = 0; hop <= AI_LIMITS.MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname, lookup);
    const response = await fetchImpl(url.toString(), {method: "GET", headers, redirect: "manual"});
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = validatePublicUrl(new URL(response.headers.get("location"), url).toString());
      continue;
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > AI_LIMITS.MAX_PAGE_BYTES) throw new GuardError(400, "That page is too large to import.");
    const text = await readCapped(response, AI_LIMITS.MAX_PAGE_BYTES);
    return {status: response.status, ok: response.ok, text, url: url.toString()};
  }
  throw new GuardError(400, "That link redirects too many times.");
}

/**
 * Read a response body as text, stopping at maxBytes.
 * @param {Response} response - Fetch response
 * @param {number} maxBytes - Limit
 * @return {Promise<string>} Text
 */
async function readCapped(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== "function") {
    return (await response.text()).slice(0, maxBytes);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new GuardError(400, "That page is too large to import.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

/**
 * Check a text input (OCR or pasted text).
 * @param {*} value - Input
 * @param {number} max - Maximum characters
 * @param {string} label - What it is, for the message
 * @return {string} The text
 */
export function requireText(value, max, label) {
  if (typeof value !== "string" || !value.trim()) throw new GuardError(400, `${label} is required.`);
  if (value.length > max) throw new GuardError(400, `${label} is too long. Try a shorter recipe.`);
  return value;
}
