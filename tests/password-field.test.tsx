import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordField } from "../src/components/password-field";

const warning = "Caps Lock is on. Passwords are case-sensitive.";
afterEach(() => vi.restoreAllMocks());

it.each(["login", "signup"] as const)("shows the UTF-8 byte budget and recovers from overflow for %s", mode => {
  render(<form><PasswordField mode={mode} /></form>);
  const input = screen.getByLabelText<HTMLInputElement>("Password");
  const budget = document.getElementById(`${mode}-password-budget`)!;
  expect(input).toHaveAccessibleDescription(/0 \/ 256 bytes/);
  expect(budget).not.toHaveAttribute("role", "status");
  fireEvent.change(input, { target: { value: "a".repeat(12) } });
  expect(budget).toHaveTextContent("12 / 256 bytes");
  fireEvent.change(input, { target: { value: "é".repeat(128) } });
  expect(budget).toHaveTextContent("256 / 256 bytes");
  expect(input).toBeValid();
  fireEvent.change(input, { target: { value: "😀".repeat(65) } });
  expect(budget).toHaveTextContent("260 / 256 bytes");
  expect(budget).toHaveAttribute("data-over-limit", "true");
  expect(input).toBeInvalid();
  expect(input).toHaveAccessibleDescription(/Use at most 256 bytes/);
  fireEvent.click(screen.getByRole("button", { name: /Show .* password/ }));
  expect(budget).toHaveTextContent("260 / 256 bytes");
  fireEvent.change(input, { target: { value: "😀".repeat(64) } });
  expect(input).toBeValid();
  expect(budget).not.toHaveAttribute("data-over-limit");
  fireEvent.change(input, { target: { value: "" } });
  expect(budget).toHaveTextContent("0 / 256 bytes");
});

it("keeps byte budgets independent between sign-in and sign-up", () => {
  render(<><PasswordField mode="login" /><PasswordField mode="signup" /></>);
  fireEvent.change(screen.getAllByLabelText("Password")[0], { target: { value: "é".repeat(12) } });
  expect(document.getElementById("login-password-budget")).toHaveTextContent("24 / 256 bytes");
  expect(document.getElementById("signup-password-budget")).toHaveTextContent("0 / 256 bytes");
});

it("conceals both revealed passwords on a hidden tab without losing credentials or revealing them on return", () => {
  const visibility = vi.spyOn(document, "visibilityState", "get");
  render(<form><PasswordField mode="login" /><PasswordField mode="signup" /></form>);
  const inputs = screen.getAllByLabelText<HTMLInputElement>("Password");
  inputs.forEach((input, index) => fireEvent.change(input, { target: { value: `Private password ${index}` } }));
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  fireEvent.click(screen.getByRole("button", { name: "Show sign-up password" }));
  fireEvent.keyDown(inputs[0], { key: "A", modifierCapsLock: true });
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  inputs.forEach(input => expect(input).toHaveAttribute("type", "text"));
  visibility.mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  inputs.forEach((input, index) => {
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue(`Private password ${index}`);
    expect(input).toBeValid();
    expect(input).toHaveAccessibleDescription(/hide when you switch tabs/);
  });
  expect(screen.queryByText(warning)).not.toBeInTheDocument();
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByRole("button", { name: "Show sign-in password" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Show sign-up password" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  expect(inputs[0]).toHaveAttribute("type", "text");
  expect(inputs[1]).toHaveAttribute("type", "password");
});

it("removes the visibility listener on unmount", () => {
  const remove = vi.spyOn(document, "removeEventListener");
  const { unmount } = render(<PasswordField mode="login" />);
  unmount();
  expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
});

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
