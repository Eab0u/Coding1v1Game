import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const current = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth-server", () => ({ auth: { current } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import AccountPage from "../src/app/account/page";
beforeEach(() => { current.mockReset(); });
it("offers accessible login and registration forms", async () => {
  current.mockResolvedValue(null);
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getAllByLabelText("Username")).toHaveLength(2);
  expect(screen.getAllByLabelText("Password")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Sign in" }).closest("form")).toHaveAttribute("action", "/api/auth/login");
  expect(screen.getByRole("button", { name: "Create account" }).closest("form")).toHaveAttribute("action", "/api/auth/signup");
});
it("shows the authenticated player and sign-out action", async () => {
  current.mockResolvedValue({ id: "1", username: "Duelist", rating: 800 });
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome, Duelist");
  expect(screen.getByRole("button", { name: "Sign out" }).closest("form")).toHaveAttribute("action", "/api/auth/logout");
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
});
it("shows a recoverable service error", async () => {
  current.mockRejectedValue(new Error("secret"));
  render(await AccountPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("alert")).toHaveTextContent("Account service unavailable");
});

