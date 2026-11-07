import { expect, it } from "vitest";
import { passwordValidationMessage } from "../src/lib/password-validation";

it.each(["a".repeat(12), "a".repeat(256), "é".repeat(128), "😀".repeat(64)])("accepts a password within both server limits", password => {
  expect(passwordValidationMessage(password)).toBe("");
});

it.each(["a".repeat(257), "é".repeat(129), "😀".repeat(65), "a".repeat(255) + "\ud800"])("rejects excess UTF-8 bytes, including replacement encoding", password => {
  expect(passwordValidationMessage(password)).toContain("at most 256 bytes");
});

it.each(["", "a".repeat(11)])("rejects passwords below the existing minimum", password => {
  expect(passwordValidationMessage(password)).toContain("at least 12 characters");
});
