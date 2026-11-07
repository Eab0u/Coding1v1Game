import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PasswordField } from "../src/components/password-field";

const warning = "Caps Lock is on. Passwords are case-sensitive.";

it("tracks Caps Lock independently on keydown and keyup and clears stale state on blur", () => {
  render(<form><PasswordField mode="login" /><PasswordField mode="signup" /></form>);
  const [login, signup] = screen.getAllByLabelText<HTMLInputElement>("Password");
  fireEvent.change(login, { target: { value: "Private password" } });
  expect(screen.queryByText(warning)).not.toBeInTheDocument();
  fireEvent.keyDown(login, { key: "A", modifierCapsLock: true });
  expect(screen.getByText(warning)).toHaveAttribute("id", "login-caps-lock");
  expect(login).toHaveAccessibleDescription(/Caps Lock is on/);
  expect(signup).not.toHaveAccessibleDescription(/Caps Lock is on/);
  expect(login).toBeValid();
  expect(login).not.toHaveAttribute("aria-invalid");
  fireEvent.keyUp(login, { key: "CapsLock", modifierCapsLock: false });
  expect(screen.queryByText(warning)).not.toBeInTheDocument();
  fireEvent.keyUp(signup, { key: "CapsLock", modifierCapsLock: true });
  expect(screen.getByText(warning)).toHaveAttribute("role", "status");
  expect(signup).toHaveAccessibleDescription(/Caps Lock is on/);
  fireEvent.blur(signup);
  expect(screen.queryByText(warning)).not.toBeInTheDocument();
  expect(login).toHaveValue("Private password");
});

it("keeps Caps Lock advisory for visible passwords without intercepting submission", () => {
  render(<form><PasswordField mode="login" /></form>);
  const input = screen.getByLabelText<HTMLInputElement>("Password");
  const submit = vi.fn((event: Event) => event.preventDefault());
  input.form!.addEventListener("submit", submit);
  fireEvent.change(input, { target: { value: "Valid password" } });
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  fireEvent.keyDown(input, { key: "A", modifierCapsLock: true });
  expect(input).toHaveAttribute("type", "text");
  expect(screen.getByText(warning)).toBeInTheDocument();
  expect(new FormData(input.form!).get("password")).toBe("Valid password");
  expect(fireEvent.submit(input.form!)).toBe(false);
  expect(submit).toHaveBeenCalledTimes(1);
});

it("shows required-password feedback on validation and clears it after correction", () => {
  render(<form><PasswordField mode="login" /><PasswordField mode="signup" /></form>);
  const [login, signup] = screen.getAllByLabelText<HTMLInputElement>("Password");
  fireEvent.invalid(login);
  expect(login).toHaveAttribute("aria-invalid", "true");
  expect(login).toHaveAccessibleDescription(/Use at least 12 characters/);
  expect(signup).not.toHaveAttribute("aria-invalid");
  fireEvent.change(login, { target: { value: "Valid password" } });
  expect(login).toBeValid();
  expect(login).not.toHaveAttribute("aria-invalid");
  expect(screen.queryByText("Use at least 12 characters.")).not.toBeInTheDocument();
});
