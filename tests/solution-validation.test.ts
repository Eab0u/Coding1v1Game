import { expect, it } from "vitest";
import { MAX_SOLUTION_LENGTH, solutionError } from "../src/lib/solution-validation";

it("rejects blank source and enforces the exact UTF-16 boundary", () => {
  expect(solutionError(" \n\t")).toMatch(/Enter a solution/);
  expect(solutionError("x".repeat(MAX_SOLUTION_LENGTH))).toBeNull();
  expect(solutionError("x".repeat(MAX_SOLUTION_LENGTH + 1))).toMatch(/exceeds/);
  expect(solutionError("😀".repeat(MAX_SOLUTION_LENGTH / 2))).toBeNull();
  expect(solutionError("😀".repeat(MAX_SOLUTION_LENGTH / 2) + "x")).toMatch(/exceeds/);
});
