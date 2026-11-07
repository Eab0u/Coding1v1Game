import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Loading from "../src/app/loading";
import { LoadingStatus } from "../src/components/loading-status";

afterEach(() => vi.useRealTimers());

it("only announces reconnection after an outage and resets it on reopening", () => {
  const connection = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  try {
    const view = render(<LoadingStatus />);
    fireEvent(window, new Event("online"));
    expect(screen.getByRole("status")).not.toHaveTextContent("back online");
    connection.mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    const reload = screen.getByRole("button");
    reload.focus();
    connection.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(screen.getByText(/Your browser is back online/)).toHaveClass("page-loading-reconnected");
    expect(reload).toHaveFocus();
    view.unmount();
    render(<LoadingStatus />);
    expect(screen.getByRole("status")).not.toHaveTextContent("back online");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  } finally { connection.mockRestore(); }
});

it("shows initial offline recovery immediately and preserves controls through reconnection", () => {
  vi.useFakeTimers();
  const connection = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    const view = render(<LoadingStatus />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Your browser reports that you are offline. Reconnect to continue loading.");
    const reload = screen.getByRole("button", { name: "Reload page" });
    expect(reload).toHaveAccessibleDescription(/Unsaved changes may be lost.*does not pause a live duel/);
    reload.focus();
    act(() => vi.advanceTimersByTime(15_000));
    connection.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Your browser is back online. Server availability is not yet confirmed.");
    expect(status).toHaveTextContent("This page is taking longer than usual.");
    expect(screen.getByRole("button")).toBe(reload);
    expect(reload).toHaveFocus();
    connection.mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    expect(status).toHaveTextContent("Your browser reports that you are offline.");
    expect(status).not.toHaveTextContent("back online");
    expect(reload).toHaveFocus();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally { connection.mockRestore(); }
});

it("cleans up connectivity listeners and retains recovery after an early reconnection", () => {
  vi.useFakeTimers();
  const connection = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const remove = vi.spyOn(window, "removeEventListener");
  try {
    const view = render(<LoadingStatus />);
    connection.mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    expect(screen.getByRole("button")).toBeVisible();
    connection.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(screen.getByRole("button")).toBeVisible();
    expect(screen.getByRole("status")).not.toHaveTextContent("offline");
    expect(screen.getByRole("status")).toHaveTextContent("Your browser is back online.");
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByRole("button")).toBeVisible();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("online", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("offline", expect.any(Function));
  } finally { connection.mockRestore(); remove.mockRestore(); }
});

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
  expect(screen.queryByRole("button", { name: "Reload page" })).not.toBeInTheDocument();
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

it("offers an explicit delayed reload with stable, instance-specific loss guidance", () => {
  vi.useFakeTimers();
  const first = render(<LoadingStatus />);
  const reloadDocument = vi.fn();
  act(() => vi.advanceTimersByTime(15_000));
  const reload = within(first.container).getByRole("button", { name: "Reload page" });
  expect(reload).toHaveAttribute("type", "button");
  expect(reload).toHaveAccessibleDescription(/keep waiting.*Unsaved changes may be lost.*does not pause a live duel or resend a code submission/);
  const id = reload.getAttribute("aria-describedby")!;
  expect(document.getElementById(id)).toHaveClass("page-loading-delay");
  reload.focus();
  first.rerender(<LoadingStatus />);
  expect(reload).toHaveFocus();
  expect(reload).toHaveAttribute("aria-describedby", id);
  const second = render(<LoadingStatus />);
  expect(within(second.container).queryByRole("button")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(15_000));
  expect(within(second.container).getByRole("button").getAttribute("aria-describedby")).not.toBe(id);
  expect(reload).toHaveFocus();
  vi.stubGlobal("location", { reload: reloadDocument });
  try {
    expect(reloadDocument).not.toHaveBeenCalled();
    fireEvent.click(reload);
    expect(reloadDocument).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
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
