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
