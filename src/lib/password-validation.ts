export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 256;

export function passwordValidationMessage(password: string): string {
  if (password.length < PASSWORD_MIN_LENGTH) return "Use at least 12 characters.";
  if (new TextEncoder().encode(password).byteLength > PASSWORD_MAX_BYTES) {
    return "Use at most 256 bytes. Emoji and some letters use more than one byte.";
  }
  return "";
}
