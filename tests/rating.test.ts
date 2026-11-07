import { describe, expect, it } from "vitest";
import { initialRating, rateMatch, updateRating, type Rating, type RatingGame } from "../src/lib/rating";

describe("Glicko-2", () => {
  it("matches Glickman's published three-opponent reference example", () => {
    const result = updateRating({ rating: 1500, deviation: 200, volatility: 0.06 }, [
      { opponent: { rating: 1400, deviation: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, deviation: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, deviation: 300, volatility: 0.06 }, score: 0 },
    ]);
    // The paper rounds intermediate calculations; compare within 0.02 points.
    expect(Math.abs(result.rating - 1464.06)).toBeLessThan(0.02);
    expect(Math.abs(result.deviation - 151.52)).toBeLessThan(0.02);
    expect(result.volatility).toBeCloseTo(0.059996, 6);
  });

  it("starts at the application's defaults with independent values", () => {
    const first = initialRating();
    first.rating = 10;
    expect(initialRating()).toEqual({ rating: 800, deviation: 350, volatility: 0.06 });
  });

  it.each(["playerOne", "playerTwo"] as const)("rates a %s win symmetrically from snapshots", (winner) => {
    const one = Object.freeze(initialRating());
    const result = rateMatch(one, one, winner);
    const sign = winner === "playerOne" ? 1 : -1;
    expect(result.playerOneDelta * sign).toBeGreaterThan(0);
    expect(result.playerTwoDelta).toBeCloseTo(-result.playerOneDelta, 10);
    expect(result.playerOne.deviation).toBeLessThan(one.deviation);
    expect(one).toEqual(initialRating());
  });

  it("keeps equal ratings unchanged on a draw and reduces uncertainty", () => {
    const result = rateMatch(initialRating(), initialRating(), null);
    expect(result.playerOneDelta).toBe(0);
    expect(result.playerTwoDelta).toBe(0);
    expect(result.playerOne.deviation).toBeLessThan(350);
  });

  it("moves a stronger player's rating down after a draw", () => {
    const result = rateMatch({ ...initialRating(), rating: 1200 }, initialRating(), null);
    expect(result.playerOneDelta).toBeLessThan(0);
    expect(result.playerTwoDelta).toBeGreaterThan(0);
  });

  it("increases only uncertainty during an inactive period", () => {
    const player = initialRating();
    const result = updateRating(player, []);
    expect(result.rating).toBe(player.rating);
    expect(result.volatility).toBe(player.volatility);
    expect(result.deviation).toBeCloseTo(Math.hypot(350, 173.7178 * 0.06), 10);
  });

  it("handles surprising wins and floors ratings at zero", () => {
    const low = { rating: 0, deviation: 50, volatility: 0.06 };
    const high = { ...low, rating: 1500 };
    const upset = rateMatch(low, high, "playerOne");
    expect(upset.playerOne.volatility).toBeGreaterThan(low.volatility);
    expect(rateMatch(low, low, "playerTwo").playerOne.rating).toBe(0);
  });

  it("makes established ratings move less than placement ratings", () => {
    const opponent = initialRating();
    const established = rateMatch({ ...opponent, deviation: 40 }, opponent, "playerOne");
    expect(established.playerOneDelta).toBeLessThan(rateMatch(opponent, opponent, "playerOne").playerOneDelta);
  });

  it.each([
    { rating: -1 }, { rating: NaN }, { rating: Infinity },
    { deviation: 0 }, { deviation: -1 }, { deviation: Infinity },
    { volatility: 0 }, { volatility: -1 }, { volatility: NaN },
  ])("rejects invalid player or opponent state %j", (invalid) => {
    const state = { ...initialRating(), ...invalid };
    expect(() => updateRating(state, [])).toThrow(RangeError);
    expect(() => updateRating(initialRating(), [{ opponent: state, score: 1 }])).toThrow(RangeError);
  });

  it("rejects invalid outcomes and numerically unrepresentable games", () => {
    expect(() => rateMatch(initialRating(), initialRating(), "bad" as "playerOne")).toThrow(RangeError);
    expect(() => updateRating(initialRating(), [{ opponent: initialRating(), score: 0.2 } as unknown as RatingGame])).toThrow(RangeError);
    expect(() => rateMatch({ ...initialRating(), rating: Number.MAX_VALUE }, initialRating(), null)).toThrow(RangeError);
  });

  it("preserves finite valid state through repeated wins and losses", () => {
    let one: Rating = initialRating();
    let two: Rating = initialRating();
    for (let i = 0; i < 300; i++) {
      const result = rateMatch(one, two, i % 3 === 0 ? "playerTwo" : "playerOne");
      one = result.playerOne;
      two = result.playerTwo;
      for (const value of [one, two]) {
        expect(Number.isFinite(value.rating)).toBe(true);
        expect(value.rating).toBeGreaterThanOrEqual(0);
        expect(value.deviation).toBeGreaterThan(0);
        expect(value.volatility).toBeGreaterThan(0);
      }
    }
  });
});
