import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { UsernameField } from "../src/components/username-field";
import { credentials } from "../src/lib/auth";
import { USERNAME_HINT, usernameValidationMessage } from "../src/lib/username-validation";

it.each(["abc", "A_0", "a".repeat(24)])("accepts valid names in the client and server: %s", name => {
  expect(usernameValidationMessage(name)).toBe("");
  expect(credentials(name, "valid password").username).toBe(name);
});

it.each(["", "ab", "a".repeat(25), "some name", "name-1", "éclair", "abc\n", "abc\r\n"])("rejects invalid names in the client and server: %j", name => {
  expect(usernameValidationMessage(name)).toBe(USERNAME_HINT);
  expect(() => credentials(name, "valid password")).toThrow(USERNAME_HINT);
});

it("provides independent accessible feedback and recovers without changing typed names", () => {
  render(<form><UsernameField mode="login" /><UsernameField mode="signup" /></form>);
  const [login, signup] = screen.getAllByLabelText<HTMLInputElement>("Username");
  expect(login).toHaveAccessibleDescription(`${USERNAME_HINT} 0 / 24 characters At least 3 more characters needed`);
  expect(login).toHaveAttribute("autocapitalize", "none");
  expect(login).toHaveAttribute("spellcheck", "false");
  fireEvent.change(login, { target: { value: "invalid name" } });
  expect(login).toBeInvalid();
  expect(login).toHaveAttribute("aria-invalid", "true");
  expect(screen.getAllByRole("status")[0]).toHaveTextContent(USERNAME_HINT);
  expect(screen.getAllByRole("status")[1]).toBeEmptyDOMElement();
  expect(signup).not.toHaveAttribute("aria-invalid");
  fireEvent.change(login, { target: { value: "Valid_Name" } });
  expect(login).toBeValid();
  expect(login).not.toHaveAttribute("aria-invalid");
  expect(new FormData(login.form!).get("username")).toBe("Valid_Name");
  expect(screen.getAllByRole("status")[0]).toBeEmptyDOMElement();
});

it("explains a required empty username when validation is attempted", () => {
  render(<form><UsernameField mode="signup" /></form>);
  const input = screen.getByLabelText("Username");
  fireEvent.invalid(input);
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("status")).toHaveTextContent(USERNAME_HINT);
  fireEvent.change(input, { target: { value: "abc" } });
  expect(input).toBeValid();
});

it.each(["login", "signup", "friend"] as const)("clears stale %s validation on native reset", async mode => {
  render(<form><UsernameField mode={mode} /></form>);
  const input = screen.getByRole<HTMLInputElement>("textbox");
  fireEvent.change(input, { target: { value: "invalid name" } });
  expect(input.validity.customError).toBe(true);
  await act(async () => input.form!.reset());
  expect(input).toHaveValue("");
  expect(input.validity.customError).toBe(false);
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  fireEvent.change(input, { target: { value: "Valid_Name" } });
  expect(input).toBeValid();
});


it.each(["login", "signup", "friend"] as const)("refreshes silent %s replacements on focus and invalid events", mode => {
  render(<><form><UsernameField mode={mode} /></form><form><UsernameField mode={mode === "login" ? "signup" : "login"} /></form></>);
  const [input, other] = screen.getAllByRole<HTMLInputElement>("textbox");
  fireEvent.change(input, { target: { value: "invalid name" } });
  fireEvent.change(other, { target: { value: "also invalid" } });
  input.value = "Recovered_Name";
  fireEvent.focus(input);
  expect(input.validity.customError).toBe(false);
  expect(input).toBeValid();
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(screen.getAllByRole("status")[0]).toBeEmptyDOMElement();
  expect(new FormData(input.form!).get("username")).toBe("Recovered_Name");
  expect(other.validity.customError).toBe(true);
  expect(other).toHaveValue("also invalid");

  input.value = "bad replacement";
  fireEvent.focus(input);
  expect(input.validity.customError).toBe(true);
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getAllByRole("status")[0]).not.toBeEmptyDOMElement();
  input.value = "Valid_Again";
  fireEvent.invalid(input);
  expect(input.validity.customError).toBe(false);
  expect(input).not.toHaveAttribute("aria-invalid");

  input.value = "";
  fireEvent.focus(input);
  expect(input.validity.customError).toBe(false);
  expect(input.validity.valueMissing).toBe(true);
  expect(input).not.toHaveAttribute("aria-invalid");
  fireEvent.invalid(input);
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input.validity.customError).toBe(true);
  input.value = "Final_Name";
  fireEvent.focus(input);
  expect(input).toBeValid();
});

it.each(["login", "signup", "friend"] as const)("tracks the %s character budget through boundaries, replacements and reset", async mode => {
  render(<form><UsernameField mode={mode} /><UsernameField mode={mode === "login" ? "signup" : "login"} /></form>);
  const [input, other] = screen.getAllByRole<HTMLInputElement>("textbox");
  const budget = document.getElementById(`${mode}-username-budget`)!;
  expect(budget).not.toHaveAttribute("role");
  for (const [value, guidance, valid] of [
    ["ab", "At least 1 more character needed", false],
    ["abc", "21 characters remaining", true],
    ["a".repeat(23), "1 character remaining", true],
    ["a".repeat(24), "Character limit reached", true],
    ["a".repeat(25), "1 character over limit", false],
    ["a".repeat(26), "2 characters over limit", false],
    ["bad name", "16 characters remaining", false],
    ["Valid_Name", "14 characters remaining", true],
  ] as const) {
    fireEvent.change(input, { target: { value } });
    expect(budget).toHaveTextContent(`${value.length} / 24 characters`);
    expect(input).toHaveAccessibleDescription(new RegExp(guidance));
    expect(input.validity.valid).toBe(valid);
    expect(budget.hasAttribute("data-over-limit")).toBe(value.length > 24);
    expect(other).toHaveAccessibleDescription(/0 \/ 24 characters/);
    expect(other).not.toHaveAttribute("aria-invalid");
  }
  input.value = "Silent_Replacement";
  fireEvent.focus(input);
  expect(budget).toHaveTextContent("18 / 24 characters");
  input.value = "a".repeat(25);
  fireEvent.invalid(input);
  expect(budget).toHaveAttribute("data-over-limit", "true");
  await act(async () => input.form!.reset());
  expect(budget).toHaveTextContent("0 / 24 characters");
  expect(budget).not.toHaveAttribute("data-over-limit");
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(document.getElementById(`${mode}-username-budget`)).toBe(budget);
});
