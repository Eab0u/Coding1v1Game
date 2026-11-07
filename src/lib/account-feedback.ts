import { USERNAME_HINT } from "./username-validation";

const feedback = new Map([
  [USERNAME_HINT, "Check the username in the form you submitted. Use 3–24 letters, numbers or underscores."],
  ["Use a password of at least 12 characters and at most 256 bytes.", "Check your password length and byte budget, then submit the form again."],
  ["Too many attempts. Try again in 15 minutes.", "Wait 15 minutes before trying this username again."],
  ["That username is unavailable.", "Choose another username to create an account, or sign in if this account is yours."],
  ["Incorrect username or password.", "Check both credentials in the sign-in form, including password capitalization, then try again."],
  ["Account service unavailable. Please try again later.", "Your action could not be confirmed. Try again later; if you were signing out, check your account state before leaving a shared device."],
]);

export function accountFeedback(error: unknown) {
  if (typeof error !== "string") return null;
  const guidance = feedback.get(error);
  return guidance ? { message: error, guidance } : null;
}
