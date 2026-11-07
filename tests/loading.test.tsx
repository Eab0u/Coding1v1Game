import { act, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Loading from "../src/app/loading";

afterEach(() => vi.useRealTimers());

it("offers recovery after fifteen seconds without replacing the live region or stealing focus", () => {
  vi.useFakeTimers();
  const { unmount } = render(<Loading />);
  const status = screen.getByRole("status");
  const recovery = screen.getByRole("link", { name: "Back to arena" });
  const guidance = document.getElementById(recovery.getAttribute("aria-describedby")!);
  expect(recovery).toHaveAccessibleDescription(/server clock continues.*press Play to recover your existing match.*server confirms/i);
  expect(guidance).toHaveClass("recovery-guidance");
  expect(guidance).toBeVisible();
  recovery.focus();
  act(() => vi.advanceTimersByTime(14_999));
  expect(status).toHaveTextContent("Loading page content…");
  expect(screen.queryByText(/You can keep waiting/)).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("This page is taking longer than usual.");
  expect(screen.getByText(/You can keep waiting/)).toHaveTextContent("Reloading does not pause a live duel or resend a code submission.");
  expect(recovery).toHaveFocus();
  expect(document.getElementById(recovery.getAttribute("aria-describedby")!)).toBe(guidance);
  expect(recovery).toHaveAccessibleDescription(/press Play to recover your existing match/);
  act(() => vi.advanceTimersByTime(60_000));
  expect(status).toHaveTextContent("This page is taking longer than usual.");
  expect(vi.getTimerCount()).toBe(0);
  unmount();
});

it("clears pending delay feedback on navigation and starts a fresh wait when reopened", () => {
  vi.useFakeTimers();
  const first = render(<Loading />);
  act(() => vi.advanceTimersByTime(10_000));
  first.unmount();
  expect(vi.getTimerCount()).toBe(0);
  const next = render(<Loading />);
  act(() => vi.advanceTimersByTime(5_000));
  expect(screen.getByRole("status")).toHaveTextContent("Loading page content…");
  act(() => vi.advanceTimersByTime(10_000));
  expect(screen.getByRole("status")).toHaveTextContent("This page is taking longer than usual.");
  next.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("provides an honest live loading status and full-page recovery without automatic navigation", () => {
  render(<Loading />);
  const main = screen.getByRole("main");
  expect(main).toHaveAttribute("id", "main-content");
  expect(main).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("link", { name: "Skip to loading status" })).toHaveAttribute("href", "#main-content");
  expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Opening your page.");
  const status = screen.getByRole("status");
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toHaveAttribute("aria-atomic", "true");
  expect(status).toHaveTextContent("Loading page content…");
  expect(main).toHaveTextContent("its server clock continues");
  expect(within(screen.getByRole("navigation", { name: "Loading navigation" })).getByRole("link", { name: "Back to arena" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
