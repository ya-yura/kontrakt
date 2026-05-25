import test from "node:test";
import assert from "node:assert/strict";
import { getWebHealth } from "../src/health";

test("web health reports ok", () => {
  assert.deepEqual(getWebHealth(), {
    status: "ok",
    service: "web"
  });
});

