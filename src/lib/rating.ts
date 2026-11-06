/** Glicko-2, using Glickman's revised volatility iteration (March 2022).
 * https://www.glicko.net/glicko/glicko2.pdf
 */
export interface Rating {
  rating: number;
  deviation: number;
  volatility: number;
}

export interface RatingGame {
  opponent: Rating;
  score: 0 | 0.5 | 1;
}

const SCALE = 173.7178;
const TAU = 0.5;
export function initialRating(): Rating {
  return { rating: 800, deviation: 350, volatility: 0.06 };
}

function validate(value: Rating): void {
  if (!Number.isFinite(value.rating) || value.rating < 0 ||
      !Number.isFinite(value.deviation) || value.deviation <= 0 ||
      !Number.isFinite(value.volatility) || value.volatility <= 0) {
    throw new RangeError("Rating must be finite and nonnegative; deviation and volatility must be positive.");
  }
}

function nextVolatility(phi: number, sigma: number, variance: number, delta: number): number {
  const a = 2 * Math.log(sigma);
  const f = (x: number) => {
    const exp = Math.exp(x);
    const sum = phi * phi + variance + exp;
    return exp * (delta * delta - sum) / (2 * sum * sum) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + variance) {
    B = Math.log(delta * delta - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0 && k < 1000) k++;
    if (k === 1000) throw new RangeError("Volatility bracket did not converge.");
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  let iterations = 0;
  while (Math.abs(B - A) > 0.000001) {
    if (++iterations > 1000) throw new RangeError("Volatility iteration did not converge.");
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (!Number.isFinite(C) || !Number.isFinite(fC)) throw new RangeError("Rating exceeds numerical range.");
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

/** Update one rating period from pre-period snapshots. Empty games grow uncertainty.
 * The application floors ratings at zero to match its database constraints.
 */
export function updateRating(player: Rating, games: readonly RatingGame[]): Rating {
  validate(player);
  const phi = player.deviation / SCALE;
  let information = 0;
  let improvement = 0;
  for (const { opponent, score } of games) {
    validate(opponent);
    if (![0, 0.5, 1].includes(score)) throw new RangeError("Invalid game score.");
    const g = 1 / Math.sqrt(1 + 3 * (opponent.deviation / SCALE) ** 2 / Math.PI ** 2);
    const expected = 1 / (1 + Math.exp(-g * (player.rating - opponent.rating) / SCALE));
    information += g * g * expected * (1 - expected);
    improvement += g * (score - expected);
  }
  if (games.length && (!Number.isFinite(information) || information <= 0)) {
    throw new RangeError("Rating exceeds numerical range.");
  }
  const volatility = games.length
    ? nextVolatility(phi, player.volatility, 1 / information, improvement / information)
    : player.volatility;
  const priorVariance = phi * phi + volatility * volatility;
  const deviation = Math.sqrt(1 / (1 / priorVariance + information));
  const result = {
    rating: Math.max(0, player.rating + SCALE * deviation * deviation * improvement),
    deviation: deviation * SCALE,
    volatility,
  };
  validate(result);
  return result;
}

/** One completed duel is one period. Both players use the same pre-match snapshots.
 * Persist both results and history atomically in the future match service.
 */
export function rateMatch(one: Rating, two: Rating, winner: "playerOne" | "playerTwo" | null) {
  if (winner !== null && winner !== "playerOne" && winner !== "playerTwo") {
    throw new RangeError("Invalid match winner.");
  }
  const score = winner === null ? 0.5 : winner === "playerOne" ? 1 : 0;
  const playerOne = updateRating(one, [{ opponent: two, score }]);
  const playerTwo = updateRating(two, [{ opponent: one, score: (1 - score) as 0 | 0.5 | 1 }]);
  return { playerOne, playerTwo, playerOneDelta: playerOne.rating - one.rating, playerTwoDelta: playerTwo.rating - two.rating };
}
