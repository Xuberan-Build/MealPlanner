// Simplified functions/index.js without Genkit dependencies

import {onRequest, onCall, HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Define API keys as secrets
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// ============================================================================
// RATE LIMITING
// ============================================================================

// In-memory rate limiter (simple implementation)
// For production, consider using Redis or Firestore-based rate limiting
const rateLimits = new Map();

/**
 * Check rate limit for a user
 * @param {string} userId - User ID
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @return {boolean} Whether request is allowed
 */
function checkRateLimit(userId, maxRequests, windowMs) {
  const now = Date.now();
  const userKey = userId;

  if (!rateLimits.has(userKey)) {
    rateLimits.set(userKey, []);
  }

  const requests = rateLimits.get(userKey);

  // Remove old requests outside the window
  const recentRequests = requests.filter((timestamp) => now - timestamp < windowMs);
  rateLimits.set(userKey, recentRequests);

  // Check if limit exceeded
  if (recentRequests.length >= maxRequests) {
    return false;
  }

  // Add current request
  recentRequests.push(now);
  rateLimits.set(userKey, recentRequests);

  return true;
}

/**
 * Verify authentication and check rate limit
 * @param {object} context - Firebase auth context
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 */
function verifyAuthAndRateLimit(context, maxRequests, windowMs) {
  // Check authentication
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to use this feature");
  }

  const userId = context.auth.uid;

  // Check rate limit
  if (!checkRateLimit(userId, maxRequests, windowMs)) {
    throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Please try again later.",
    );
  }

  return userId;
}

// Simple HTTP function for testing
export const helloWorld = onRequest((request, response) => {
  response.send("Hello from Firebase Functions!");
});

// URL proxy function to handle CORS issues
export const fetchRecipeUrl = onRequest(
    {cors: true},
    async (request, response) => {
      try {
        // Only allow POST requests
        if (request.method !== "POST") {
          response.status(405).send("Method not allowed");
          return;
        }

        const {url} = request.body;

        if (!url) {
          response.status(400).send("URL is required");
          return;
        }

        console.log("Fetching URL:", url);

        // Fetch the URL content
        const fetchResponse = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
            "Accept": "text/html,application/xhtml+xml," +
          "application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
          },
        });

        if (!fetchResponse.ok) {
          throw new Error(
              `Failed to fetch: ${fetchResponse.status} ${fetchResponse.statusText}`,
          );
        }

        const htmlContent = await fetchResponse.text();

        response.json({
          success: true,
          html: htmlContent,
          url: url,
        });
      } catch (error) {
        console.error("Error fetching URL:", error);
        response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

// Secure authenticated function that extracts recipe from URL using OpenAI
export const extractRecipeFromUrl = onRequest(
    {
      cors: true,
      secrets: [openaiApiKey],
    },
    async (request, response) => {
      try {
        // Only allow POST requests
        if (request.method !== "POST") {
          response.status(405).json({
            success: false,
            error: "Method not allowed",
          });
          return;
        }

        const {url} = request.body;

        if (!url) {
          response.status(400).json({
            success: false,
            error: "URL is required",
          });
          return;
        }

        console.log("Extracting recipe from URL:", url);

        // Step 1: Fetch the URL content
        const fetchResponse = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9," +
              "image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": new URL(url).origin,
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
          },
        });

        if (!fetchResponse.ok) {
          // Provide user-friendly error messages for common status codes
          let errorMessage = `Failed to fetch recipe (${fetchResponse.status})`;

          if (fetchResponse.status === 403) {
            errorMessage = "Website blocked the request. Try: 1) Copy/paste the recipe text " +
              "instead, or 2) Use a different recipe URL. Some sites block automated access.";
          } else if (fetchResponse.status === 404) {
            errorMessage = "Recipe not found. Please check the URL and try again.";
          } else if (fetchResponse.status === 429) {
            errorMessage = "Too many requests. Please wait a moment and try again.";
          } else if (fetchResponse.status >= 500) {
            errorMessage = "The recipe website is experiencing issues. Please try again later.";
          }

          throw new Error(errorMessage);
        }

        const htmlContent = await fetchResponse.text();
        console.log("Successfully fetched HTML content, length:", htmlContent.length);

        // Step 2: Convert HTML to text
        const textContent = htmlContent
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();

        // Limit text content to avoid token limits
        const limitedTextContent = textContent.substring(0, 12000);
        console.log("Extracted text content, length:", limitedTextContent.length);

        // Step 3: Call OpenAI to extract recipe information
        const prompt = `
Analyze the following text extracted from a recipe webpage.
Clean up any formatting issues, normalize the content, and extract the key recipe details.
Return the extracted information as a valid JSON object matching the provided schema.

Fields to extract:
- title: The main title of the recipe.
- **ingredients**: array of objects — Each ingredient must have:
  - **amount**: string — Quantity (e.g., "1", "2½", "a pinch")
  - **unit**: string — Unit of measurement (e.g., "cup", "tablespoon", "grams", or empty if none)
  - **ingredientId**: string — Ingredient name only (e.g., "broccoli florets", "soy sauce")
- instructions: The step-by-step instructions.
- prepTime: Estimated preparation time.
- cookTime: Estimated cooking time.
- servings: How many servings the recipe makes.
- dietType: Any dietary classification mentioned (e.g., Vegan, Gluten-Free).
- mealType: The type of meal (e.g., Appetizer, Main Course, Dessert).

If a field (especially optional ones like times, servings, dietType, mealType)
is not clearly present in the text, omit it or return an empty string/array
as appropriate for the schema, but ensure the overall JSON structure is valid.

Webpage Text:
"""
${limitedTextContent}
"""

Output JSON:
`;

        console.log("Calling OpenAI to parse recipe...");
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey.value()}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{role: "user", content: prompt}],
            temperature: 0,
          }),
        });

        if (!aiResponse.ok) {
          const errorBody = await aiResponse.text();
          throw new Error(
              `OpenAI request failed with status ${aiResponse.status}: ${errorBody}`,
          );
        }

        const result = await aiResponse.json();

        if (!result || !result.choices || !result.choices[0]?.message?.content) {
          throw new Error("Invalid response structure from OpenAI.");
        }

        // Parse and return the recipe
        const structuredRecipe = JSON.parse(result.choices[0].message.content);
        console.log("✅ Successfully parsed recipe JSON from OpenAI");

        response.json({
          success: true,
          recipe: structuredRecipe,
        });
      } catch (error) {
        console.error("❌ Error extracting recipe:", error);
        response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

// Secure authenticated function that processes OCR text into structured recipe
export const parseRecipeFromOCR = onRequest(
    {
      cors: true,
      secrets: [openaiApiKey],
    },
    async (request, response) => {
      try {
        console.log("🔍 parseRecipeFromOCR called");

        // Only allow POST requests
        if (request.method !== "POST") {
          response.status(405).json({
            success: false,
            error: "Method not allowed",
          });
          return;
        }

        const {ocrText} = request.body;
        console.log("📦 Request data:", ocrText ? "present" : "missing");

        if (!ocrText) {
          response.status(400).json({
            success: false,
            error: "OCR text is required",
          });
          return;
        }

        console.log("Parsing recipe from OCR text, length:", ocrText.length);

        // Call OpenAI to structure the recipe
        const prompt = `
Analyze the following raw text extracted from a recipe image using OCR.
Clean up any OCR errors, normalize formatting, and extract the key details.
Return the extracted information as a valid JSON object matching the provided schema.

Fields to extract:
- title: The main title of the recipe.
- **ingredients**: array of objects — Each ingredient must have:
  - **amount**: string — Quantity (e.g., "1", "2½", "a pinch")
  - **unit**: string — Unit of measurement (e.g., "cup", "tablespoon", "grams", or empty if none)
  - **ingredientId**: string — Ingredient name only (e.g., "broccoli florets", "soy sauce")
- instructions: The step-by-step instructions.
- prepTime: Estimated preparation time.
- cookTime: Estimated cooking time.
- servings: How many servings the recipe makes.
- dietType: Any dietary classification mentioned (e.g., Vegan, Gluten-Free).
- mealType: The type of meal (e.g., Appetizer, Main Course, Dessert).

If a field (especially optional ones like times, servings, dietType, mealType)
is not clearly present in the text, omit it or return an empty string/array
as appropriate for the schema, but ensure the overall JSON structure is valid.

Raw OCR Text:
"""
${ocrText}
"""

Output JSON:
`;

        console.log("Calling OpenAI to parse recipe from OCR...");
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey.value()}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{role: "user", content: prompt}],
            temperature: 0,
          }),
        });

        if (!aiResponse.ok) {
          const errorBody = await aiResponse.text();
          throw new Error(
              `OpenAI request failed with status ${aiResponse.status}: ${errorBody}`,
          );
        }

        const result = await aiResponse.json();

        if (!result || !result.choices || !result.choices[0]?.message?.content) {
          throw new Error("Invalid response structure from OpenAI.");
        }

        // Parse and return the recipe
        const structuredRecipe = JSON.parse(result.choices[0].message.content);
        console.log("✅ Successfully parsed recipe JSON from OpenAI");

        response.json({
          success: true,
          recipe: structuredRecipe,
        });
      } catch (error) {
        console.error("❌ Error parsing recipe from OCR:", error);
        response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

// ============================================================================
// CREDIT MANAGEMENT CLOUD FUNCTIONS
// ============================================================================

/**
 * Scheduled function to reset monthly free credits
 * Runs on the 1st of every month at 00:01 AM
 */
export const resetMonthlyCredits = onSchedule(
    {
      schedule: "1 0 1 * *", // Cron: minute hour dayOfMonth month dayOfWeek
      timeZone: "America/New_York", // Adjust to your timezone
    },
    async (event) => {
      console.log("🔄 Starting monthly credit reset...");

      try {
        // Get all users with free tier subscription
        const usersSnapshot = await db.collection("users")
            .where("subscription.tier", "==", "free")
            .get();

        console.log(`Found ${usersSnapshot.size} users to reset`);

        const batch = db.batch();
        let batchCount = 0;
        const batches = [];

        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;
          const userData = userDoc.data();
          const currentCredits = userData.credits || {};

          // Calculate change in total available
          const previousFreeRemaining = currentCredits.freeCredits?.remaining || 0;
          const monthlyAllowance = 5; // Free tier gets 5 credits per month
          const creditDelta = monthlyAllowance - previousFreeRemaining;

          // Move current month usage to last month
          const thisMonthUsage = currentCredits.usage?.thisMonth || 0;

          batch.update(userDoc.ref, {
            "credits.freeCredits.total": monthlyAllowance,
            "credits.freeCredits.used": 0,
            "credits.freeCredits.remaining": monthlyAllowance,
            "credits.freeCredits.resetDate": nextMonth,
            "credits.freeCredits.lastResetAt": FieldValue.serverTimestamp(),
            "credits.totalAvailable": FieldValue.increment(creditDelta),
            "credits.usage.lastMonth": thisMonthUsage,
            "credits.usage.thisMonth": 0,
          });

          batchCount++;

          // Firestore batch limit is 500 operations
          if (batchCount >= 500) {
            batches.push(batch.commit());
            batchCount = 0;
          }

          console.log(`✅ Reset credits for user ${userId}: +${creditDelta} credits`);
        }

        // Commit remaining batch
        if (batchCount > 0) {
          batches.push(batch.commit());
        }

        // Wait for all batches to complete
        await Promise.all(batches);

        console.log(`✅ Monthly credit reset complete for ${usersSnapshot.size} users`);
      } catch (error) {
        console.error("❌ Error resetting monthly credits:", error);
        throw error;
      }
    },
);

/**
 * Add purchased credits to a user's account
 * Called by payment webhook handlers
 */
export const addPurchasedCredits = onRequest(
    {cors: true},
    async (request, response) => {
      try {
        // Only allow POST requests
        if (request.method !== "POST") {
          response.status(405).json({
            success: false,
            error: "Method not allowed",
          });
          return;
        }

        const {userId, credits, paymentData} = request.body;

        if (!userId || !credits) {
          response.status(400).json({
            success: false,
            error: "userId and credits are required",
          });
          return;
        }

        console.log(`💰 Adding ${credits} purchased credits to user ${userId}`);

        // Use transaction to ensure atomicity
        const result = await db.runTransaction(async (transaction) => {
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists) {
            throw new Error("User not found");
          }

          // Update user credits
          transaction.update(userRef, {
            "credits.paidCredits.balance": FieldValue.increment(credits),
            "credits.paidCredits.totalPurchased": FieldValue.increment(credits),
            "credits.paidCredits.totalSpent": FieldValue.increment(paymentData?.amount || 0),
            "credits.totalAvailable": FieldValue.increment(credits),
          });

          // Create transaction record
          const transactionRef = db.collection("transactions").doc();
          transaction.set(transactionRef, {
            userId,
            type: "purchase",
            amount: paymentData?.amount || 0,
            currency: paymentData?.currency || "USD",
            creditsAdded: credits,
            paymentMethod: paymentData?.provider || "unknown",
            paymentIntentId: paymentData?.transactionId || null,
            status: "completed",
            productId: paymentData?.productId || null,
            productName: paymentData?.productName || null,
            createdAt: FieldValue.serverTimestamp(),
            completedAt: FieldValue.serverTimestamp(),
          });

          // Create notification
          const notificationRef = db.collection("notifications").doc();
          transaction.set(notificationRef, {
            userId,
            type: "purchase_success",
            title: "Credits Added!",
            message: `${credits} credits have been added to your account`,
            icon: "credit-card",
            actionUrl: "/profile",
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });

          const userData = userDoc.data();
          const newBalance = (userData.credits?.totalAvailable || 0) + credits;

          return {
            success: true,
            creditsAdded: credits,
            newBalance,
          };
        });

        console.log(`✅ Successfully added ${credits} credits to user ${userId}`);

        response.json(result);
      } catch (error) {
        console.error("❌ Error adding purchased credits:", error);
        response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    },
);

/**
 * Consume credits for a feature
 * Called when user uses a paid feature (like AI recipe generation)
 */
export const consumeCredits = onCall(
    async (data, context) => {
      try {
        // Verify authentication and check rate limit (20 requests per hour)
        const userId = verifyAuthAndRateLimit(context, 20, 60 * 60 * 1000);

        const {feature, metadata = {}, requiredCredits = 1} = data;

        if (!feature) {
          throw new HttpsError("invalid-argument", "feature is required");
        }

        console.log(`🎫 User ${userId} consuming ${requiredCredits} credit(s) for ${feature}`);

        const result = await db.runTransaction(async (transaction) => {
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists) {
            throw new Error("User not found");
          }

          const userData = userDoc.data();
          const credits = userData.credits || {};

          const freeRemaining = credits.freeCredits?.remaining || 0;
          const paidBalance = credits.paidCredits?.balance || 0;
          const totalAvailable = freeRemaining + paidBalance;

          // Check if enough credits
          if (totalAvailable < requiredCredits) {
            throw new Error("INSUFFICIENT_CREDITS");
          }

          // Determine credit source (use free first)
          const freeUsed = Math.min(freeRemaining, requiredCredits);
          const paidUsed = requiredCredits - freeUsed;

          const balanceBefore = {
            free: freeRemaining,
            paid: paidBalance,
            total: totalAvailable,
          };

          const balanceAfter = {
            free: freeRemaining - freeUsed,
            paid: paidBalance - paidUsed,
            total: totalAvailable - requiredCredits,
          };

          // Update user credits
          const updates = {
            "credits.totalAvailable": FieldValue.increment(-requiredCredits),
            "credits.usage.thisMonth": FieldValue.increment(requiredCredits),
            "credits.usage.allTime": FieldValue.increment(requiredCredits),
          };

          if (freeUsed > 0) {
            updates["credits.freeCredits.remaining"] = FieldValue.increment(-freeUsed);
            updates["credits.freeCredits.used"] = FieldValue.increment(freeUsed);
          }

          if (paidUsed > 0) {
            updates["credits.paidCredits.balance"] = FieldValue.increment(-paidUsed);
          }

          transaction.update(userRef, updates);

          // Create transaction record
          const transactionRef = db.collection("transactions").doc();
          transaction.set(transactionRef, {
            userId,
            type: "credit_used",
            creditsUsed: requiredCredits,
            feature,
            resourceId: metadata.resourceId || null,
            status: "completed",
            createdAt: FieldValue.serverTimestamp(),
            completedAt: FieldValue.serverTimestamp(),
          });

          // Create usage event
          const eventRef = db.collection("usageEvents").doc();
          transaction.set(eventRef, {
            userId,
            eventType: "credit_used",
            feature,
            creditsConsumed: requiredCredits,
            creditType: freeUsed > 0 ? "free" : "paid",
            balanceBefore,
            balanceAfter,
            metadata,
            timestamp: FieldValue.serverTimestamp(),
          });

          console.log(`✅ Consumed ${requiredCredits} credits (free: ${freeUsed}, paid: ${paidUsed})`);

          return {
            success: true,
            creditsUsed: requiredCredits,
            breakdown: {freeUsed, paidUsed},
            balanceBefore,
            balanceAfter,
            newBalance: balanceAfter.total,
          };
        });

        console.log(`✅ Successfully consumed ${requiredCredits} credits for user ${userId}`);
        return result;
      } catch (error) {
        console.error("❌ Error consuming credits:", error);

        // Re-throw as HttpsError for proper client handling
        if (error instanceof HttpsError) {
          throw error;
        }

        if (error.message === "INSUFFICIENT_CREDITS") {
          throw new HttpsError(
              "failed-precondition",
              "Not enough credits available",
              {error: "INSUFFICIENT_CREDITS"},
          );
        }

        throw new HttpsError("internal", `Failed to consume credits: ${error.message}`);
      }
    },
);

// ============================================================================
// CLEANUP DIET TYPES (One-time utility function)
// ============================================================================

/**
 * Clean up partial diet types from user account
 * Call this function once to remove partial diet types like "p", "pu", "puer", etc.
 */
export const cleanupDietTypes = onCall(
    {
      region: "us-central1",
    },
    async (request) => {
      const userId = request.auth?.uid;

      if (!userId) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      try {
        console.log(`🧹 Cleaning diet types for user: ${userId}`);

        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          throw new HttpsError("not-found", "User document not found");
        }

        const userData = userDoc.data();
        const customDietTypes = userData.customDietTypes || [];

        console.log("📋 Current diet types:", customDietTypes);

        // Filter out partial/invalid types
        const cleanedDietTypes = customDietTypes.filter((type) => {
          // Remove very short types (likely incomplete)
          if (type.length <= 2) {
            console.log(`  🗑️  Removing too short: "${type}"`);
            return false;
          }

          // Remove obvious partials
          const partials = [
            "p", "pu", "Pue", "Puer", "Puert", "Puerto",
            "m", "me", "med", "medi", "medit", "mediter",
            "i", "it", "ita", "ital", "itali",
          ];

          if (partials.includes(type)) {
            console.log(`  🗑️  Removing partial: "${type}"`);
            return false;
          }

          console.log(`  ✅ Keeping: "${type}"`);
          return true;
        });

        // Remove duplicates and sort
        const uniqueCleanedTypes = [...new Set(cleanedDietTypes)].sort();

        // Update Firestore
        await userRef.update({
          customDietTypes: uniqueCleanedTypes,
        });

        const removed = customDietTypes.length - uniqueCleanedTypes.length;

        console.log(`✅ Cleaned up ${removed} invalid diet types`);

        return {
          success: true,
          removed: removed,
          before: customDietTypes,
          after: uniqueCleanedTypes,
        };
      } catch (error) {
        console.error("❌ Error cleaning up diet types:", error);
        throw new HttpsError("internal", `Failed to cleanup: ${error.message}`);
      }
    },
);

// ============================================================================
// Process Pasted Recipe Text with OpenAI
// ============================================================================
export const processRecipeText = onCall(
    {
      secrets: [openaiApiKey],
    },
    async (request) => {
      try {
        // Check authentication
        if (!request.auth) {
          throw new HttpsError("unauthenticated", "You must be logged in");
        }

        const {text} = request.data;

        if (!text || typeof text !== "string") {
          throw new HttpsError("invalid-argument", "Text is required");
        }

        console.log("Processing pasted recipe text...");

        // Call OpenAI to extract recipe information from text
        const prompt = `You are a recipe extraction assistant. Extract structured recipe information from the following text.

Text:
${text}

Extract and return a JSON object with this structure:
{
  "title": "Recipe title",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": "Step-by-step instructions as a single string",
  "prepTime": "prep time if mentioned",
  "cookTime": "cook time if mentioned",
  "servings": "number of servings if mentioned",
  "dietType": "diet type if mentioned (e.g., vegetarian, vegan, etc.)",
  "mealType": "meal type if mentioned (e.g., breakfast, lunch, dinner, snack)"
}

Important:
- Extract ingredients as a list of strings
- Keep instructions as a single text block
- Only include fields that are present in the text
- Return valid JSON only, no markdown formatting`;

        console.log("Calling OpenAI to parse recipe text...");
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey.value()}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{role: "user", content: prompt}],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          const errorBody = await aiResponse.text();
          throw new Error(
              `OpenAI request failed with status ${aiResponse.status}: ${errorBody}`,
          );
        }

        const aiData = await aiResponse.json();
        const recipeContent = aiData.choices?.[0]?.message?.content;

        if (!recipeContent) {
          throw new Error("Invalid response structure from OpenAI.");
        }

        // Parse the JSON response
        const jsonMatch = recipeContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("Could not extract JSON from OpenAI response");
        }

        const recipe = JSON.parse(jsonMatch[0]);
        console.log("✅ Successfully parsed recipe from text");

        return {
          success: true,
          recipe: recipe,
        };
      } catch (error) {
        console.error("❌ Error processing recipe text:", error);

        // Provide user-friendly error messages
        if (error.code === "unauthenticated") {
          throw error;
        } else if (error.message?.includes("OpenAI")) {
          throw new HttpsError("internal", "AI service error. Please try again.");
        } else {
          throw new HttpsError(
              "internal",
              `Failed to process recipe text: ${error.message}`,
          );
        }
      }
    },
);
