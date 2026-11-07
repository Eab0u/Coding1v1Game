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
  expect(login).toHaveAccessibleDescription(USERNAME_HINT);
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
