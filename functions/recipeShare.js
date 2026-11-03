// functions/recipeShare.js
//
// Server-side recipe sharing. Clients can no longer write recipes into another user's book
// or list the users collection, so sharing goes through the shareRecipe callable:
//   - the recipient is found by their verified sign-in email (Firebase Auth), not by the
//     user-editable `email` field in users/{uid};
//   - only the sender's own recipe can be shared;
//   - the copy is stripped of HTML so a shared recipe can never carry script;
//   - each sender has a daily share limit.

export const MAX_SHARES_PER_DAY = 30;
const MAX_EMAIL_LENGTH = 254;
const MAX_ID_LENGTH = 200;

/** Error with a callable error code, mapped to HttpsError by the caller. */
export class ShareError extends Error {
  /**
   * @param {string} code - HttpsError code
   * @param {string} message - User-facing message
   */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Validate and normalize the callable input.
 * @param {object} data - Callable data
 * @return {{recipeId: string, email: string}} Normalized input
 */
export function validateShareInput(data) {
  const recipeId = typeof data?.recipeId === "string" ? data.recipeId.trim() : "";
  const email = typeof data?.recipientEmail === "string" ? data.recipientEmail.trim().toLowerCase() : "";
  if (!recipeId || recipeId.length > MAX_ID_LENGTH || recipeId.includes("/")) {
    throw new ShareError("invalid-argument", "Choose a recipe to share.");
  }
  if (!email || email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ShareError("invalid-argument", "Enter a valid email address.");
  }
  return {recipeId, email};
}

/**
 * Turn HTML into plain text, keeping line breaks from block tags. Repeats until stable so
 * nested or split tags (e.g. "<scr<script>ipt>") cannot survive, then breaks up any "<"
 * that could still start a tag.
 * @param {string} value - Possibly HTML text
 * @return {string} Plain text
 */
export function toPlainText(value) {
  let text = String(value)
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n");
  let previous;
  do {
    previous = text;
    text = text.replace(/<[^<>]*>/g, "");
  } while (text !== previous);
  return text
      .replace(/<(?=[a-zA-Z!/?])/g, "< ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
}

/**
 * Deep-copy a value, turning every string into plain text.
 * @param {*} value - Recipe field value
 * @param {number} depth - Current depth (guards against pathological nesting)
 * @return {*} Cleaned value
 */
export function stripHtmlDeep(value, depth = 0) {
  if (depth > 20) return null;
  if (typeof value === "string") return toPlainText(value);
  if (Array.isArray(value)) return value.map((v) => stripHtmlDeep(v, depth + 1));
  if (value && typeof value === "object") {
    // Firestore Timestamps and other class instances are kept as they are.
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripHtmlDeep(v, depth + 1)]));
  }
  return value;
}

// Fields that belong to the sender's copy only.
const OWNER_FIELDS = ["id", "userId", "sharedFrom", "createdAt", "updatedAt", "plannedOn", "planned"];

/**
 * Build the recipient's copy of a recipe.
 * @param {object} recipe - Sender's recipe data
 * @param {object} meta - {recipientId, sender: {uid, email, name}, recipeId, now}
 * @return {object} New recipe document data
 */
export function buildSharedRecipe(recipe, {recipientId, sender, recipeId, now}) {
  const copy = {...recipe};
  OWNER_FIELDS.forEach((field) => delete copy[field]);
  return {
    ...stripHtmlDeep(copy),
    userId: recipientId,
    sharedFrom: {
      userId: sender.uid,
      userEmail: sender.email || "",
      userName: toPlainText(sender.name || sender.email || "A friend"),
      originalRecipeId: recipeId,
      sharedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create the callable handler with its dependencies injected (for tests).
 * @param {object} deps - {getUserByEmail, getRecipe, addRecipe, takeShareSlot, now}
 * @return {function(object): Promise<object>} Handler taking the callable request
 */
export function createShareRecipeHandler(deps) {
  return async (request) => {
    if (!request.auth) {
      throw new ShareError("unauthenticated", "Sign in to share recipes.");
    }
    const {recipeId, email} = validateShareInput(request.data);
    const senderEmail = String(request.auth.token?.email || "").toLowerCase();
    if (senderEmail && senderEmail === email) {
      throw new ShareError("invalid-argument", "You cannot share a recipe with yourself.");
    }

    const recipe = await deps.getRecipe(recipeId);
    if (!recipe || recipe.userId !== request.auth.uid) {
      throw new ShareError("not-found", "That recipe was not found in your Recipe Book.");
    }

    const recipient = await deps.getUserByEmail(email);
    if (!recipient) {
      throw new ShareError("not-found", "No Savor Meals account uses that email.");
    }
    if (recipient.uid === request.auth.uid) {
      throw new ShareError("invalid-argument", "You cannot share a recipe with yourself.");
    }

    if (!(await deps.takeShareSlot(request.auth.uid))) {
      throw new ShareError("resource-exhausted", "You have shared a lot today. Try again tomorrow.");
    }

    const now = deps.now();
    await deps.addRecipe(buildSharedRecipe(recipe, {
      recipientId: recipient.uid,
      sender: {uid: request.auth.uid, email: request.auth.token?.email, name: request.auth.token?.name},
      recipeId,
      now,
    }));

    return {recipientName: recipient.displayName || email};
  };
}
