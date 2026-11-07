import { expect, it } from "vitest";
import { explainResult } from "../src/lib/result-explanation";
import type { DuelResult } from "../src/lib/results";

const player = { username: "Ada", before: 800, after: 808, passed: 8, total: 8, cpu: 10, submitted: 1000 };
function result(overrides: Partial<typeof player> = {}, outcome: DuelResult["outcome"] = "WIN"): DuelResult {
  return { title: "Sample", outcome, players: [player, { ...player, username: "Bob", ...overrides }] };
}
it("explains correctness before faster runtime and earlier submission", () => {
  expect(explainResult(result({ passed: 7, cpu: 1, submitted: 1 }))).toMatch(/^You passed more hidden tests/);
});
it("explains CPU before earlier submission, using full precision", () => {
  expect(explainResult(result({ cpu: 10.00001, submitted: 1 }))).toMatch(/^You had the lower median/);
});
it("explains the earlier submission tiebreaker", () => {
  expect(explainResult(result({ submitted: 1001 }))).toMatch(/^You submitted earlier/);
});
it.each([{ passed: 7 }, { cpu: 11 }, { submitted: 1001 }])("explains losses from the participant perspective: %o", overrides => {
  const duel = result(overrides, "LOSS");
  duel.players.reverse();
  expect(explainResult(duel)).toMatch(/^Your opponent/);
});
it("explains exact draws", () => {
  expect(explainResult(result({}, "DRAW"))).toContain("were all tied");
});
it("handles no judged submissions without claiming an earlier submission", () => {
  const duel = result({}, "DRAW");
  duel.players = duel.players.map(p => ({ ...p, passed: 0, submitted: null }));
  expect(explainResult(duel)).toContain("Neither player had a judged submission");
  duel.players[0].submitted = 1000;
  duel.outcome = "WIN";
  expect(explainResult(duel)).toContain("unavailable");
});
it.each([{ passed: null }, { cpu: null }, { cpu: NaN }, { passed: 9 }, { total: 9 }, { passed: -1 }, { passed: 1.5 }])("does not infer from incomplete or invalid metrics: %o", overrides => {
  const duel = result();
  Object.assign(duel.players[0], overrides);
  expect(explainResult(duel)).toContain("unavailable");
});
it("does not contradict authoritative results or invent absent players", () => {
  expect(explainResult(result({ passed: 7 }, "LOSS"))).toContain("unavailable");
  expect(explainResult(result({ passed: 7 }, "DRAW"))).toContain("unavailable");
  const duel = result();
  duel.players.pop();
  expect(explainResult(duel)).toContain("unavailable");
});
