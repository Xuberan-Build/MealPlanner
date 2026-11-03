// Callable wiring: auth + input validation (no Firestore/network is touched on these paths).
import {test} from "node:test";
import assert from "node:assert/strict";

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-test";
const {lookupCatalogProducts} = await import("../index.js");

const rejectsWith = (promise, code) => assert.rejects(promise, (e) => e.code === code);

test("requires auth", async () => {
  await rejectsWith(lookupCatalogProducts.run({data: {keys: ["flour"]}}), "unauthenticated");
});

test("validates input", async () => {
  const auth = {uid: "u1", token: {}};
  await rejectsWith(lookupCatalogProducts.run({auth, data: {keys: []}}), "invalid-argument");
  await rejectsWith(lookupCatalogProducts.run({auth, data: {keys: "flour"}}), "invalid-argument");
  await rejectsWith(lookupCatalogProducts.run({auth, data: {keys: ["", "x"]}}), "invalid-argument");
});

test("shareRecipe requires auth and valid input; removed endpoints are gone", async () => {
  const mod = await import("../index.js");
  await rejectsWith(mod.shareRecipe.run({data: {recipeId: "r1", recipientEmail: "a@b.co"}}), "unauthenticated");
  await rejectsWith(mod.shareRecipe.run({auth: {uid: "u1", token: {}}, data: {recipeId: "", recipientEmail: "a@b.co"}}), "invalid-argument");
  assert.equal(mod.addPurchasedCredits, undefined);
  assert.equal(mod.fetchRecipeUrl, undefined);
  assert.equal(mod.helloWorld, undefined);
});
