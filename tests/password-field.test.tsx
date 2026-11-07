import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordField } from "../src/components/password-field";

const warning = "Caps Lock is on. Passwords are case-sensitive.";
afterEach(() => vi.restoreAllMocks());

it.each(["login", "signup"] as const)("keeps a stable %s visibility announcement through reveal and concealment", async mode => {
  render(<form><PasswordField mode={mode} /></form>);
  const input = screen.getByLabelText<HTMLInputElement>("Password");
  const status = document.getElementById(`${mode}-password-visibility`)!;
  expect(status).toHaveAttribute("role", "status");
  expect(status).toBeEmptyDOMElement();
  fireEvent.change(input, { target: { value: "private password" } });
  const button = screen.getByRole("button", { name: /Show .* password/ });
  for (const conceal of [
    () => fireEvent.click(button),
    () => fireEvent.keyDown(button, { key: "Escape" }),
    () => fireEvent.blur(window),
    () => fireEvent(window, new Event("pagehide")),
    () => fireEvent.invalid(input),
    () => input.form!.reset(),
  ]) {
    fireEvent.click(button);
    expect(input).toHaveAttribute("type", "text");
    expect(status).toHaveTextContent("Password is visible. Hide it when you finish checking.");
    expect(button).toHaveAccessibleDescription(/Password is visible/);
    expect(button).toHaveAccessibleDescription(/Press Escape/);
    await act(async () => { conceal(); });
    expect(input).toHaveAttribute("type", "password");
    expect(status).toBeEmptyDOMElement();
    expect(document.getElementById(`${mode}-password-visibility`)).toBe(status);
    expect(button).not.toHaveAccessibleDescription(/Password is visible/);
  }
});

it("keeps visibility notices independent between credential forms", () => {
  render(<><PasswordField mode="login" /><PasswordField mode="signup" /></>);
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  expect(document.getElementById("login-password-visibility")).not.toBeEmptyDOMElement();
  expect(document.getElementById("signup-password-visibility")).toBeEmptyDOMElement();
  fireEvent.click(screen.getByRole("button", { name: "Show sign-up password" }));
  fireEvent.click(screen.getByRole("button", { name: "Hide sign-in password" }));
  expect(document.getElementById("login-password-visibility")).toBeEmptyDOMElement();
  expect(document.getElementById("signup-password-visibility")).not.toBeEmptyDOMElement();
});

it.each(["login", "signup"] as const)("explains remaining and exceeded UTF-8 capacity for %s with recovery and reset", async mode => {
  render(<form><PasswordField mode={mode} /></form>);
  const input = screen.getByLabelText<HTMLInputElement>("Password");
  expect(input).toHaveAccessibleDescription(/256 bytes remaining/);
  for (const [value, guidance, valid] of [
    ["a".repeat(255), "1 byte remaining", true],
    ["\u{1f600}".repeat(64), "Byte limit reached", true],
    ["\u{1f600}".repeat(64) + "a", "1 byte over limit", false],
    ["\u{1f600}".repeat(65), "4 bytes over limit", false],
    ["corrected password", "238 bytes remaining", true],
  ] as const) {
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveAccessibleDescription(new RegExp(guidance));
    expect(input.validity.valid).toBe(valid);
    const budget = document.getElementById(`${mode}-password-budget`);
    if (valid) expect(budget).not.toHaveAttribute("data-over-limit");
    else expect(budget).toHaveAttribute("data-over-limit", "true");
  }
  input.value = "a".repeat(256);
  fireEvent.click(screen.getByRole("button", { name: /Show .* password/ }));
  expect(input).toHaveAccessibleDescription(/Byte limit reached/);
  expect(input).toHaveAttribute("type", "text");
  await act(async () => input.form!.reset());
  expect(input).toHaveAccessibleDescription(/256 bytes remaining/);
  expect(input).toHaveAttribute("type", "password");
});

it("conceals both passwords on window blur without clearing values or validation and allows explicit reveal afterward", () => {
  render(<><PasswordField mode="login" /><PasswordField mode="signup" /></>);
  const inputs = screen.getAllByLabelText<HTMLInputElement>("Password");
  for (const input of inputs) {
    fireEvent.change(input, { target: { value: "short" } });
    fireEvent.keyDown(input, { key: "A", modifierCapsLock: true });
  }
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  fireEvent.click(screen.getByRole("button", { name: "Show sign-up password" }));
  // Moving between controls inside the page must preserve the reveal.
  fireEvent.blur(inputs[0]);
  expect(inputs[0]).toHaveAttribute("type", "text");
  fireEvent.blur(window);
  fireEvent.blur(window);
  for (const input of inputs) {
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("short");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.validationMessage).toContain("Use at least 12 characters.");
    expect(input).toHaveAccessibleDescription(/browser window loses focus/);
  }
  expect(screen.queryByText(warning)).not.toBeInTheDocument();
  fireEvent.focus(window);
  expect(inputs[0]).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  expect(inputs[0]).toHaveAttribute("type", "text");
  expect(inputs[1]).toHaveAttribute("type", "password");
});

it("removes the window blur listener on unmount", () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  const { unmount } = render(<PasswordField mode="login" />);
  const listener = add.mock.calls.find(([name]) => name === "blur")![1];
  unmount();
  expect(remove).toHaveBeenCalledWith("blur", listener);
});

it.each(["login", "signup"] as const)("refreshes silent %s replacements when toggling password visibility", mode => {
  const submit = vi.fn(event => event.preventDefault());
  render(<form onSubmit={submit}><PasswordField mode={mode} /><PasswordField mode={mode === "login" ? "signup" : "login"} /></form>);
  const [input, other] = screen.getAllByLabelText<HTMLInputElement>("Password");
  const button = screen.getByRole("button", { name: mode === "login" ? "Show sign-in password" : "Show sign-up password" });
  fireEvent.change(other, { target: { value: "short" } });
  button.focus();
  const cases = [
    { value: "\u{1f600}".repeat(65), bytes: 260, error: "Use at most 256 bytes." },
    { value: "corrected private password", bytes: 26, error: "" },
    { value: "tiny", bytes: 4, error: "Use at least 12 characters." },
    { value: "", bytes: 0, error: "" },
  ];
  cases.forEach(({ value, bytes, error }, index) => {
    input.value = value;
    fireEvent.click(button);
    expect(input).toHaveValue(value);
    expect(input).toHaveAttribute("type", index % 2 === 0 ? "text" : "password");
    expect(input).toHaveAccessibleDescription(new RegExp(`${bytes} / 256 bytes`));
    expect(input.validity.customError).toBe(Boolean(error));
    if (error) expect(input.validationMessage).toContain(error);
    else expect(input).not.toHaveAttribute("aria-invalid");
    expect(button).toHaveFocus();
    expect(other).toHaveAttribute("type", "password");
    expect(other).toHaveValue("short");
    expect(other).toHaveAccessibleDescription(/5 \/ 256 bytes/);
    expect(other.validity.customError).toBe(true);
  });
  expect(input.validity.valueMissing).toBe(true);
  expect(submit).not.toHaveBeenCalled();
});

it.each(["input", "button"])("conceals only the selected password with Escape from its %s", target => {
  const submit = vi.fn(event => event.preventDefault());
  const outerKey = vi.fn();
  render(<form onSubmit={submit} onKeyDown={outerKey}><PasswordField mode="login" /><PasswordField mode="signup" /></form>);
  const [login, signup] = screen.getAllByLabelText<HTMLInputElement>("Password");
  fireEvent.change(login, { target: { value: "short" } });
  fireEvent.change(signup, { target: { value: "another private password" } });
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  fireEvent.click(screen.getByRole("button", { name: "Show sign-up password" }));
  const button = screen.getByRole("button", { name: "Hide sign-in password" });
  const focused = target === "input" ? login : button;
  focused.focus();
  fireEvent.keyDown(focused, { key: "ArrowLeft" });
  expect(login).toHaveAttribute("type", "text");
  outerKey.mockClear();
  expect(fireEvent.keyDown(focused, { key: "Escape" })).toBe(false);
  expect(outerKey).not.toHaveBeenCalled();
  expect(focused).toHaveFocus();
  expect(login).toHaveAttribute("type", "password");
  expect(login).toHaveValue("short");
  expect(login).toHaveAttribute("aria-invalid", "true");
  expect(login.validationMessage).toBe("Use at least 12 characters.");
  expect(login).toHaveAccessibleDescription(/5 \/ 256 bytes/);
  expect(login).toHaveAccessibleDescription(/Press Escape/);
  expect(button).toHaveAccessibleName("Show sign-in password");
  expect(button).toHaveAttribute("aria-pressed", "false");
  expect(signup).toHaveAttribute("type", "text");
  expect(signup).toHaveValue("another private password");
  expect(fireEvent.keyDown(focused, { key: "Escape" })).toBe(true);
  expect(outerKey).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(login).toHaveAttribute("type", "text");
  fireEvent.change(login, { target: { value: "corrected private password" } });
  expect(login).toBeValid();
});

it.each([false, true])("conceals passwords on page departure (cached: %s) and preserves field feedback", persisted => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  render(<><PasswordField mode="login" /><PasswordField mode="signup" /></>);
  const inputs = screen.getAllByLabelText<HTMLInputElement>("Password");
  inputs.forEach(input => fireEvent.change(input, { target: { value: "short" } }));
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  fireEvent.click(screen.getByRole("button", { name: "Show sign-up password" }));
  fireEvent.keyDown(inputs[0], { key: "A", modifierCapsLock: true });
  fireEvent(window, new PageTransitionEvent("pagehide", { persisted }));
  fireEvent(window, new PageTransitionEvent("pagehide", { persisted }));
  fireEvent(window, new PageTransitionEvent("pageshow", { persisted }));
  inputs.forEach(input => {
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("short");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.validity.customError).toBe(true);
    expect(input).toHaveAccessibleDescription(/5 \/ 256 bytes/);
    expect(input).toHaveAccessibleDescription(/leave this page/);
  });
  expect(screen.queryByText(warning)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  expect(inputs[0]).toHaveAttribute("type", "text");
  expect(inputs[1]).toHaveAttribute("type", "password");
});

it("removes the page departure listener on unmount", () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  const { unmount } = render(<PasswordField mode="login" />);
  const listener = add.mock.calls.find(([name]) => name === "pagehide")![1];
  unmount();
  expect(remove).toHaveBeenCalledWith("pagehide", listener);
});

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

it("clears only the reset form and permits a corrected submission", async () => {
  render(<><form><PasswordField mode="login" /></form><form><PasswordField mode="signup" /></form></>);
  const [login, signup] = screen.getAllByLabelText<HTMLInputElement>("Password");
  fireEvent.change(login, { target: { value: "short" } });
  fireEvent.change(signup, { target: { value: "Other valid password" } });
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  fireEvent.keyDown(login, { key: "A", modifierCapsLock: true });
  await act(async () => login.form!.reset());
  expect(login).toHaveValue("");
  expect(login).toHaveAttribute("type", "password");
  expect(login.validity.customError).toBe(false);
  expect(login).not.toHaveAttribute("aria-invalid");
  expect(document.getElementById("login-password-budget")).toHaveTextContent("0 / 256 bytes");
  expect(screen.queryByText(warning)).not.toBeInTheDocument();
  expect(signup).toHaveValue("Other valid password");
  fireEvent.change(login, { target: { value: "Corrected password" } });
  expect(login).toBeValid();
});

it("preserves password feedback and visibility when reset is cancelled", async () => {
  render(<form onReset={event => event.preventDefault()}><PasswordField mode="login" /></form>);
  const input = screen.getByLabelText<HTMLInputElement>("Password");
  fireEvent.change(input, { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  await act(async () => input.form!.reset());
  expect(input).toHaveValue("short");
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(document.getElementById("login-password-budget")).toHaveTextContent("5 / 256 bytes");
});

it.each(["login", "signup"] as const)("refreshes silently filled %s passwords on focus without changing reveal state", mode => {
  render(<><PasswordField mode={mode} /><PasswordField mode={mode === "login" ? "signup" : "login"} /></>);
  const [input, other] = screen.getAllByLabelText<HTMLInputElement>("Password");
  fireEvent.change(input, { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: mode === "login" ? "Show sign-in password" : "Show sign-up password" }));
  // Password managers can replace the native value without a React change event.
  input.value = "a corrected private password";
  fireEvent.focus(input);
  expect(input).toBeValid();
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(input).toHaveAccessibleDescription(/28 \/ 256 bytes/);
  expect(input).toHaveAttribute("type", "text");
  expect(other).toHaveAccessibleDescription(/0 \/ 256 bytes/);
  expect(other).toHaveAttribute("type", "password");
  input.value = "\u{1f600}".repeat(65);
  fireEvent.focus(input);
  expect(input).toBeInvalid();
  expect(input).toHaveAccessibleDescription(/260 \/ 256 bytes/);
  expect(input).toHaveAccessibleDescription(/Use at most 256 bytes/);
  input.value = "";
  fireEvent.focus(input);
  expect(input.validity.customError).toBe(false);
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(input).toHaveAccessibleDescription(/0 \/ 256 bytes/);
  fireEvent.invalid(input);
  expect(input).toHaveAttribute("aria-invalid", "true");
});

it("refreshes the byte budget when a silently filled password fails native validation", () => {
  render(<PasswordField mode="login" />);
  const input = screen.getByLabelText<HTMLInputElement>("Password");
  input.value = "tiny";
  fireEvent.invalid(input);
  expect(input).toHaveAccessibleDescription(/4 \/ 256 bytes/);
  expect(input.validationMessage).toBe("Use at least 12 characters.");
  input.value = "corrected private password";
  fireEvent.focus(input);
  expect(input).toBeValid();
  expect(input).not.toHaveAttribute("aria-invalid");
});

it.each(["login", "signup"] as const)("conceals only the submitted %s form and preserves credentials", mode => {
  const submit = vi.fn(event => event.preventDefault());
  render(<><form aria-label="login" onSubmit={submit}><PasswordField mode="login" /></form><form aria-label="signup" onSubmit={submit}><PasswordField mode="signup" /></form></>);
  const inputs = screen.getAllByLabelText<HTMLInputElement>("Password");
  inputs.forEach(input => fireEvent.change(input, { target: { value: "private password" } }));
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  fireEvent.click(screen.getByRole("button", { name: "Show sign-up password" }));
  const selected = inputs[mode === "login" ? 0 : 1];
  const other = inputs[mode === "login" ? 1 : 0];
  fireEvent.keyDown(selected, { key: "A", modifierCapsLock: true });
  fireEvent.submit(screen.getByRole("form", { name: mode }));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(selected).toHaveAttribute("type", "password");
  expect(selected).toHaveValue("private password");
  expect(selected).toHaveAccessibleDescription(/16 \/ 256 bytes/);
  expect(selected).toHaveAccessibleDescription(/including when a field needs correction/);
  expect(other).toHaveAttribute("type", "text");
  expect(screen.queryByText(warning)).not.toBeInTheDocument();
});

it.each(["username", "password"])("conceals on native %s validation failure and allows correction and reveal", field => {
  render(<form><input aria-label="Username" required /><PasswordField mode="login" /></form>);
  const password = screen.getByLabelText<HTMLInputElement>("Password");
  fireEvent.change(password, { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  fireEvent.invalid(field === "password" ? password : screen.getByLabelText("Username"));
  expect(password).toHaveAttribute("type", "password");
  expect(password).toHaveValue("short");
  expect(password.validationMessage).toBe("Use at least 12 characters.");
  expect(password).toHaveAttribute("aria-invalid", "true");
  fireEvent.change(password, { target: { value: "corrected password" } });
  expect(password.validity.customError).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  expect(password).toHaveAttribute("type", "text");
});

it("removes form concealment listeners on unmount", () => {
  const { unmount } = render(<form aria-label="credentials"><PasswordField mode="login" /></form>);
  const form = screen.getByRole("form", { name: "credentials" });
  const remove = vi.spyOn(form, "removeEventListener");
  unmount();
  expect(remove).toHaveBeenCalledWith("submit", expect.any(Function), true);
  expect(remove).toHaveBeenCalledWith("invalid", expect.any(Function), true);
});
