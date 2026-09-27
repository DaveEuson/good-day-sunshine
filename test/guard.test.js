import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedHosts, hostOk, originOk, envValueOk } from "../guard.js";

test("guard: Host must be this machine (DNS rebinding)", () => {
  const allowed = allowedHosts();
  assert.ok(hostOk("localhost:4242", allowed));
  assert.ok(hostOk("127.0.0.1:4242", allowed));
  assert.ok(hostOk("dash.localhost", allowed));
  assert.equal(hostOk("evil.example.com:4242", allowed), false);
  assert.equal(hostOk("", allowed), false);
});

test("guard: cross-site writes are refused, same-site and non-browser allowed", () => {
  assert.ok(originOk("POST", undefined, "localhost:4242"), "curl / server-to-server has no Origin");
  assert.ok(originOk("POST", "http://localhost:4242", "localhost:4242"));
  assert.ok(originOk("GET", "http://evil.example", "localhost:4242"), "reads are gated by Host instead");
  assert.equal(originOk("PUT", "http://evil.example", "localhost:4242"), false);
  assert.equal(originOk("POST", "null", "localhost:4242"), false);
});

test("guard: .env values cannot smuggle extra lines", () => {
  assert.ok(envValueOk("http://localhost:11434"));
  assert.equal(envValueOk("http://x\nADMIN_FROM_LAN=1"), false);
  assert.equal(envValueOk("a\rb"), false);
  assert.equal(envValueOk(42), false);
});
