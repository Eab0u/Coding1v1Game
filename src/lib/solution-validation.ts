/** Match the server's UTF-16 source length policy in both editors. */
export const MAX_SOLUTION_LENGTH = 65536;

export function solutionError(source: string): string | null {
  if (!source.trim()) return "Enter a solution before submitting.";
  if (source.length > MAX_SOLUTION_LENGTH) return "Solution exceeds the 65,536-character limit. Shorten it before submitting; your code is still available to copy or download.";
  return null;
}
