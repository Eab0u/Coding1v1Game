import { render, screen } from "@testing-library/react";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const current = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth-server", () => ({ auth: { current } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import AccountPage from "../src/app/account/page";
import { USERNAME_HINT } from "../src/lib/username-validation";
beforeEach(() => { current.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });
it("starts matchmaking from the account and exposes the reserved arena", async () => {
  class Socket {
    static latest: Socket;
    send = vi.fn(); close = vi.fn();
    onopen = () => {}; onmessage = (_event: { data: string }) => { void _event; };
    constructor(public url: URL) { Socket.latest = this; }
  }
  vi.stubGlobal("WebSocket", Socket);
  current.mockResolvedValue({ id: "1", username: "Duelist", rating: 923.6 });
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("924")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  expect(Socket.latest.url.pathname).toBe("/matchmaking");
  act(() => Socket.latest.onopen());
  expect(Socket.latest.send).toHaveBeenCalledExactlyOnceWith('{"type":"join"}');
  act(() => Socket.latest.onmessage({ data: JSON.stringify({ type: "matched", match: { id: "reserved", difficulty: "easy" }, opponent: { username: "Rival", rating: 900 } }) }));
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveAttribute("href", "/match/reserved");
});
it("offers accessible login and registration forms", async () => {
  current.mockResolvedValue(null);
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getAllByLabelText("Username")).toHaveLength(2);
  expect(screen.getAllByLabelText("Password")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Sign in" }).closest("form")).toHaveAttribute("action", "/api/auth/login");
  expect(screen.getByRole("button", { name: "Create account" }).closest("form")).toHaveAttribute("action", "/api/auth/signup");
  expect(screen.queryByRole("navigation", { name: "Player account" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Play/ })).not.toBeInTheDocument();
});
it("shows the authenticated player and sign-out action", async () => {
  current.mockResolvedValue({ id: "1", username: "Duelist", rating: 800 });
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome, Duelist");
  expect(screen.getByRole("button", { name: "Sign out" }).closest("form")).toHaveAttribute("action", "/api/auth/logout");
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Play/ })).toBeEnabled();
  expect(screen.getByRole("link", { name: "View your profile" })).toHaveAttribute("href", "/profile/Duelist");
  expect(screen.getByRole("link", { name: "Manage friends" })).toHaveAttribute("href", "/friends");
  expect(screen.getByRole("link", { name: "View leaderboard" })).toHaveAttribute("href", "/leaderboard");
  expect(screen.getByText("800")).toBeInTheDocument();
  expect(screen.queryByText(/matchmaking is coming next/)).not.toBeInTheDocument();
});
it("toggles each password independently without submitting or losing credentials", async () => {
  current.mockResolvedValue(null);
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  const [login, signup] = screen.getAllByLabelText<HTMLInputElement>("Password");
  const form = login.closest("form")!;
  const submitted = vi.fn((event: Event) => event.preventDefault());
  form.addEventListener("submit", submitted);
  fireEvent.change(login, { target: { value: "a long private password" } });
  fireEvent.change(signup, { target: { value: "another private password" } });
  expect(login).toHaveAttribute("type", "password");
  expect(signup).toHaveAttribute("type", "password");
  expect(login).toHaveAttribute("autocomplete", "current-password");
  expect(signup).toHaveAttribute("autocomplete", "new-password");
  const show = screen.getByRole("button", { name: "Show sign-in password" });
  expect(show).toHaveAttribute("aria-controls", login.id);
  expect(show).toHaveAttribute("aria-pressed", "false");
  show.focus();
  fireEvent.click(show);
  expect(login).toHaveAttribute("type", "text");
  expect(signup).toHaveAttribute("type", "password");
  const hide = screen.getByRole("button", { name: "Hide sign-in password" });
  expect(hide).toHaveFocus();
  expect(hide).toHaveAttribute("aria-pressed", "true");
  expect(new FormData(form).get("password")).toBe("a long private password");
  fireEvent.click(hide);
  expect(login).toHaveAttribute("type", "password");
  expect(login).toHaveValue("a long private password");
  fireEvent.click(screen.getByRole("button", { name: "Show sign-up password" }));
  expect(signup).toHaveAttribute("type", "text");
  expect(signup).toHaveValue("another private password");
  expect(login).toHaveAttribute("type", "password");
  expect(submitted).not.toHaveBeenCalled();
});
it("shows a recoverable service error", async () => {
  current.mockRejectedValue(new Error("secret"));
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("alert")).toHaveTextContent("Account service unavailable");
  expect(screen.queryByRole("button", { name: /Play/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  expect(screen.queryByText("secret")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Retry account" })).toHaveAttribute("href", "/account");
  expect(screen.getByRole("link", { name: "Back to arena" })).toHaveAttribute("href", "/");
});

it("rechecks account state on retry and recovers to the current player or guest forms", async () => {
  current.mockRejectedValueOnce(new Error("private database details"));
  const failed = render(await AccountPage({ searchParams: Promise.resolve({ error: "stale auth error" }) }));
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.queryByText("stale auth error")).not.toBeInTheDocument();
  failed.unmount();
  current.mockResolvedValueOnce({ id: "2", username: "Recovered", rating: 950 });
  const recovered = render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { name: "Welcome, Recovered" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  recovered.unmount();
  current.mockResolvedValueOnce(null);
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getAllByLabelText("Password")).toHaveLength(2);
  expect(current).toHaveBeenCalledTimes(3);
});

it("blocks over-limit Unicode passwords locally and recovers independently in each form", async () => {
  current.mockResolvedValue(null);
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  const [login, signup] = screen.getAllByLabelText<HTMLInputElement>("Password");
  fireEvent.change(login, { target: { value: "😀".repeat(65) } });
  expect(login).toHaveAttribute("aria-invalid", "true");
  expect(login.validity.customError).toBe(true);
  expect(login).toHaveAccessibleDescription(/at most 256 bytes/);
  expect(signup.validity.customError).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Show sign-in password" }));
  expect(login.validity.customError).toBe(true);
  expect(login).toHaveValue("😀".repeat(65));
  fireEvent.change(login, { target: { value: "😀".repeat(64) } });
  expect(login.validity.customError).toBe(false);
  expect(login).not.toHaveAttribute("aria-invalid");
  fireEvent.change(signup, { target: { value: "short" } });
  expect(signup.validationMessage).toBe("Use at least 12 characters.");
  expect(login.validity.customError).toBe(false);
  fireEvent.change(signup, { target: { value: "a long enough password" } });
  expect(signup.validity.valid).toBe(true);
  fireEvent.change(signup, { target: { value: "" } });
  expect(signup.validity.valueMissing).toBe(true);
  expect(screen.queryByText("Use at least 12 characters.")).not.toBeInTheDocument();
});


it.each(['guest', 'player', 'unavailable'])('offers account skip navigation for %s state', async state => {
  if (state === 'unavailable') current.mockRejectedValue(new Error('private'));
  else current.mockResolvedValue(state === 'player' ? { id: '1', username: 'Duelist', rating: 800 } : null);
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole('link', { name: 'Skip to account' })).toHaveAttribute('href', '#account-main');
  expect(screen.getByRole('main')).toHaveAttribute('id', 'account-main');
  expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  expect(screen.queryByRole('navigation', { name: 'Account options' }) !== null).toBe(state === 'guest');
});

it('names credential forms and provides focusable direct entry destinations', async () => {
  current.mockResolvedValue(null);
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  for (const [mode, heading, link] of [['login', 'Welcome back', 'Go to sign in'], ['signup', 'Create your player', 'Go to create account']]) {
    expect(screen.getByRole('form', { name: heading })).toHaveAttribute('action', `/api/auth/${mode}`);
    expect(screen.getByRole('link', { name: link })).toHaveAttribute('href', `#account-${mode}`);
    expect(screen.getByRole('heading', { name: heading })).toHaveAttribute('tabindex', '-1');
  }
});

it.each([
  [USERNAME_HINT, "Check the username"],
  ["Incorrect username or password.", "Check both credentials"],
  ["That username is unavailable.", "Choose another username"],
  ["Too many attempts. Try again in 15 minutes.", "Wait 15 minutes"],
  ["Use a password of at least 12 characters and at most 256 bytes.", "Check your password length and byte budget"],
  ["Account service unavailable. Please try again later.", "Your action could not be confirmed"],
])("shows recognized account error %s with specific recovery", async (error, guidance) => {
  current.mockResolvedValue(null);
  render(await AccountPage({ searchParams: Promise.resolve({ error }) }));
  expect(screen.getByRole("alert")).toHaveClass("account-error");
  expect(screen.getByRole("alert")).toHaveTextContent(error);
  expect(screen.getByRole("alert")).toHaveTextContent(guidance);
  expect(screen.getByRole("form", { name: "Welcome back" })).toBeVisible();
});

it.each(["<script>private()</script>", "Contact fake support", "Incorrect username or password. ", "toString", "x".repeat(500)])("ignores arbitrary account URL messages: %s", async error => {
  current.mockResolvedValue(null);
  render(await AccountPage({ searchParams: Promise.resolve({ error }) }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("form", { name: "Welcome back" })).toBeVisible();
});

it("clears the chosen credential form without submitting or clearing its neighbor", async () => {
  current.mockResolvedValue(null);
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  const [login, signup] = screen.getAllByLabelText<HTMLInputElement>("Username");
  const [password] = screen.getAllByLabelText<HTMLInputElement>("Password");
  fireEvent.change(login, { target: { value: "invalid name" } });
  fireEvent.change(password, { target: { value: "short" } });
  fireEvent.change(signup, { target: { value: "Other_Player" } });
  const submit = vi.fn();
  login.form!.addEventListener("submit", submit);
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Clear form" })[0]); });
  expect(login).toHaveValue("");
  expect(password).toHaveValue("");
  expect(login).not.toHaveAttribute("aria-invalid");
  expect(password).not.toHaveAttribute("aria-invalid");
  expect(signup).toHaveValue("Other_Player");
  expect(submit).not.toHaveBeenCalled();
});
