export const USERNAME_PATTERN = "[A-Za-z0-9_]{3,24}";
export const USERNAME_HINT = "Use 3–24 letters, numbers or underscores for your username.";

export function usernameValidationMessage(username: string): string {
  return new RegExp(`^${USERNAME_PATTERN}$`).exec(username)?.[0] === username ? "" : USERNAME_HINT;
}
