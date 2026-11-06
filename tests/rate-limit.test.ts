import { expect, it } from "vitest";
import { RateLimit } from "../src/lib/rate-limit";

it("shares a quota by key and renews it only at the window boundary", () => {
  const limiter = new RateLimit(2, 100);
  expect(limiter.allow("one", 0)).toBe(true);
  expect(limiter.allow("one", 50)).toBe(true);
  expect(limiter.allow("one", 99)).toBe(false);
  expect(limiter.allow("two", 99)).toBe(true);
  expect(limiter.allow("one", 100)).toBe(true);
});

it("bounds memory without evicting active quotas and reclaims expired keys", () => {
  const limiter = new RateLimit(1, 100, 2);
  expect(limiter.allow("one", 0)).toBe(true);
  expect(limiter.allow("two", 0)).toBe(true);
  expect(limiter.allow("three", 99)).toBe(false);
  expect(limiter.allow("one", 99)).toBe(false);
  expect(limiter.allow("three", 100)).toBe(true);
});
