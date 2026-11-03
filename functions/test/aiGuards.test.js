import {test} from "node:test";
import assert from "node:assert/strict";
import {
  AI_LIMITS,
  assertPublicHost,
  isPrivateAddress,
  parseBearerToken,
  requireText,
  requireUser,
  safeFetchText,
  validatePublicUrl,
} from "../aiGuards.js";

const status = (s) => (e) => e.status === s;

test("parseBearerToken", () => {
  assert.equal(parseBearerToken("Bearer abc.def"), "abc.def");
  assert.equal(parseBearerToken("bearer  xyz"), "xyz");
  assert.equal(parseBearerToken("Basic abc"), null);
  assert.equal(parseBearerToken(undefined), null);
});

test("requireUser needs a valid ID token", async () => {
  const verify = async (t) => {
    if (t === "good") return {uid: "u1"};
    throw new Error("bad");
  };
  assert.equal(await requireUser({headers: {authorization: "Bearer good"}}, verify), "u1");
  await assert.rejects(requireUser({headers: {}}, verify), status(401));
  await assert.rejects(requireUser({headers: {authorization: "Bearer nope"}}, verify), status(401));
});

test("isPrivateAddress blocks internal ranges and the metadata server", () => {
  ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "nonsense"]
      .forEach((ip) => assert.equal(isPrivateAddress(ip), true, ip));
  ["8.8.8.8", "172.32.0.1", "151.101.1.69", "2606:4700::6810:84e5"]
      .forEach((ip) => assert.equal(isPrivateAddress(ip), false, ip));
});

test("validatePublicUrl accepts recipe links and refuses everything else", () => {
  assert.equal(validatePublicUrl("https://www.allrecipes.com/recipe/1").hostname, "www.allrecipes.com");
  ["", "ftp://x.com", "file:///etc/passwd", "javascript:alert(1)", "http://localhost/x", "http://127.0.0.1/",
    "http://169.254.169.254/computeMetadata/v1/", "http://metadata.google.internal/", "http://[::1]/",
    "http://user:pw@site.com/", "http://site.com:22/", "x".repeat(3000), 42]
      .forEach((u) => assert.throws(() => validatePublicUrl(u), status(400), String(u).slice(0, 40)));
});

test("assertPublicHost refuses names that resolve to private addresses", async () => {
  const lookup = async (h) => (h === "evil.example" ? [{address: "93.184.216.34"}, {address: "10.0.0.5"}] : [{address: "93.184.216.34"}]);
  await assertPublicHost("good.example", lookup);
  await assert.rejects(assertPublicHost("evil.example", lookup), status(400));
  await assert.rejects(assertPublicHost("x", async () => {
    throw new Error("ENOTFOUND");
  }), status(400));
});

const res = (statusCode, body, headers = {}) => ({
  status: statusCode,
  ok: statusCode >= 200 && statusCode < 300,
  headers: {get: (k) => headers[k.toLowerCase()] || null},
  body: null,
  text: async () => body,
});

test("safeFetchText re-checks every redirect hop", async () => {
  const lookup = async (h) => [{address: h === "inside.example" ? "10.0.0.9" : "93.184.216.34"}];
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith("https://a.example")) return res(302, "", {location: "https://b.example/recipe"});
    if (url.startsWith("https://b.example")) return res(200, "<h1>Soup</h1>");
    if (url.startsWith("https://bounce.example")) return res(301, "", {location: "http://inside.example/admin"});
    if (url.startsWith("https://meta.example")) return res(302, "", {location: "http://169.254.169.254/"});
    return res(404, "");
  };
  const page = await safeFetchText("https://a.example/r", {fetchImpl, lookup});
  assert.deepEqual([page.ok, page.text, page.url], [true, "<h1>Soup</h1>", "https://b.example/recipe"]);
  await assert.rejects(safeFetchText("https://bounce.example/", {fetchImpl, lookup}), status(400));
  await assert.rejects(safeFetchText("https://meta.example/", {fetchImpl, lookup}), status(400));
  assert.ok(!calls.some((u) => u.includes("inside.example") || u.includes("169.254")));

  const loop = async () => res(302, "", {location: "https://a.example/again"});
  await assert.rejects(safeFetchText("https://a.example/", {fetchImpl: loop, lookup}), status(400));

  const huge = async () => res(200, "x", {"content-length": String(AI_LIMITS.MAX_PAGE_BYTES + 1)});
  await assert.rejects(safeFetchText("https://a.example/", {fetchImpl: huge, lookup}), status(400));
});

test("requireText caps inputs", () => {
  assert.equal(requireText("soup", 10, "Recipe text"), "soup");
  assert.throws(() => requireText("", 10, "Recipe text"), status(400));
  assert.throws(() => requireText(null, 10, "Recipe text"), status(400));
  assert.throws(() => requireText("x".repeat(11), 10, "Recipe text"), status(400));
});
