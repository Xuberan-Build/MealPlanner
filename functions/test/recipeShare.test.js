import {test} from "node:test";
import assert from "node:assert/strict";
import {
  buildSharedRecipe,
  createShareRecipeHandler,
  toPlainText,
  validateShareInput,
} from "../recipeShare.js";

const rejectsWith = (promise, code) => assert.rejects(promise, (e) => e.code === code);

test("toPlainText removes every tag, including split and unterminated ones", () => {
  assert.equal(toPlainText("<p>Mix the flour</p><p>Bake</p>"), "Mix the flour\nBake");
  assert.equal(toPlainText("<img src=x onerror=alert(1)>Stir"), "Stir");
  assert.equal(toPlainText("<scr<script>ipt>alert(1)</script>"), "alert(1)");
  assert.equal(toPlainText("Heat <img src=x onerror=alert(1)"), "Heat < img src=x onerror=alert(1)");
  assert.equal(toPlainText("Use 1 < 2 cups"), "Use 1 < 2 cups");
  assert.equal(toPlainText("Line<br>Next<br/>Last"), "Line\nNext\nLast");
});

test("validateShareInput normalizes and rejects bad input", () => {
  assert.deepEqual(validateShareInput({recipeId: " r1 ", recipientEmail: " Sam@Example.com "}),
      {recipeId: "r1", email: "sam@example.com"});
  assert.throws(() => validateShareInput({recipeId: "", recipientEmail: "a@b.co"}), {code: "invalid-argument"});
  assert.throws(() => validateShareInput({recipeId: "a/b", recipientEmail: "a@b.co"}), {code: "invalid-argument"});
  assert.throws(() => validateShareInput({recipeId: "r1", recipientEmail: "nope"}), {code: "invalid-argument"});
  assert.throws(() => validateShareInput(null), {code: "invalid-argument"});
});

test("buildSharedRecipe keeps the recipe, cleans HTML and replaces ownership fields", () => {
  const copy = buildSharedRecipe(
      {
        id: "stale", userId: "sender", title: "Soup<script>x</script>", instructions: "<p>Boil</p>",
        ingredients: [{name: "<b>salt</b>", amount: 1}], sharedFrom: {userId: "fake"}, createdAt: 1,
      },
      {recipientId: "rcpt", sender: {uid: "sender", email: "s@x.co", name: "<i>Sam</i>"}, recipeId: "r1", now: "NOW"},
  );
  assert.equal(copy.userId, "rcpt");
  assert.equal(copy.title, "Soupx");
  assert.equal(copy.instructions, "Boil");
  assert.deepEqual(copy.ingredients, [{name: "salt", amount: 1}]);
  assert.equal(copy.id, undefined);
  assert.deepEqual(copy.sharedFrom, {userId: "sender", userEmail: "s@x.co", userName: "Sam", originalRecipeId: "r1", sharedAt: "NOW"});
  assert.equal(copy.createdAt, "NOW");
});

const makeDeps = (overrides = {}) => {
  const added = [];
  return {
    added,
    deps: {
      getRecipe: async (id) => (id === "r1" ? {userId: "sender", title: "Soup"} : {userId: "someone-else", title: "Theirs"}),
      getUserByEmail: async (email) => (email === "friend@x.co" ? {uid: "friend", displayName: "Friend"} : null),
      addRecipe: async (r) => added.push(r),
      takeShareSlot: async () => true,
      now: () => "NOW",
      ...overrides,
    },
  };
};

const auth = {uid: "sender", token: {email: "me@x.co"}};

test("shares your own recipe to the account with that sign-in email", async () => {
  const {deps, added} = makeDeps();
  const result = await createShareRecipeHandler(deps)({auth, data: {recipeId: "r1", recipientEmail: "Friend@x.co"}});
  assert.deepEqual(result, {recipientName: "Friend"});
  assert.equal(added.length, 1);
  assert.equal(added[0].userId, "friend");
});

test("refuses signed-out callers, other people's recipes, unknown emails, yourself and over-limit", async () => {
  const {deps, added} = makeDeps();
  const handler = createShareRecipeHandler(deps);
  await rejectsWith(handler({data: {recipeId: "r1", recipientEmail: "friend@x.co"}}), "unauthenticated");
  await rejectsWith(handler({auth, data: {recipeId: "r2", recipientEmail: "friend@x.co"}}), "not-found");
  await rejectsWith(handler({auth, data: {recipeId: "r1", recipientEmail: "nobody@x.co"}}), "not-found");
  await rejectsWith(handler({auth, data: {recipeId: "r1", recipientEmail: "ME@x.co"}}), "invalid-argument");

  const self = createShareRecipeHandler(makeDeps({getUserByEmail: async () => ({uid: "sender"})}).deps);
  await rejectsWith(self({auth: {uid: "sender", token: {}}, data: {recipeId: "r1", recipientEmail: "alias@x.co"}}), "invalid-argument");

  const limited = createShareRecipeHandler(makeDeps({takeShareSlot: async () => false}).deps);
  await rejectsWith(limited({auth, data: {recipeId: "r1", recipientEmail: "friend@x.co"}}), "resource-exhausted");
  assert.equal(added.length, 0);
});
