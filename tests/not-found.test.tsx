import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import NotFound from "../src/app/not-found";

it("offers public recovery without exposing why a resource is unavailable", () => {
  render(<NotFound />);
  const main = screen.getByRole("main");
  expect(main).toHaveAttribute("id", "main-content");
  expect(main).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("link", {name: "Skip to page recovery"})).toHaveAttribute("href", "#main-content");
  expect(within(main).getByRole("heading", {level: 1})).toHaveTextContent("Get back to your duel.");
  expect(main).toHaveTextContent("This link is unavailable. Check the address");
  const navigation = screen.getByRole("navigation", {name: "Page recovery"});
  expect(within(navigation).getByRole("link", {name: "Back to arena"})).toHaveAttribute("href", "/");
  expect(within(navigation).getByRole("link", {name: "Explore standings"})).toHaveAttribute("href", "/leaderboard");
});

it("explains offline recovery and reconnection without promising restored page access or moving focus", () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    render(<NotFound />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("Browser offline.");
    expect(status).toHaveTextContent("Reconnect before following a recovery link");
    expect(status).toHaveTextContent("server clock continues");
    expect(within(status).getByText(/Reconnect before/).closest("p")).toHaveClass("recovery-guidance");
    const home = screen.getByRole("link", { name: "Back to arena" });
    home.focus();
    online.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Browser back online.");
    expect(status).toHaveTextContent("Server availability and access to this page are not yet confirmed");
    expect(status).toHaveTextContent("reconnecting does not navigate automatically");
    expect(home).toHaveFocus();
    expect(home).toHaveAttribute("href", "/");
    online.mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    expect(status).toHaveTextContent("Browser offline.");
    expect(status).not.toHaveTextContent("Browser back online.");
    expect(home).toHaveFocus();
  } finally { online.mockRestore(); }
});

it("starts silently online, removes connection listeners and resets feedback on reopening", () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const remove = vi.spyOn(window, "removeEventListener");
  try {
    const view = render(<NotFound />);
    fireEvent(window, new Event("online"));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    online.mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    online.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(screen.getByRole("status")).toHaveTextContent("Browser back online.");
    view.unmount();
    expect(remove).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("online", expect.any(Function));
    render(<NotFound />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  } finally { online.mockRestore(); remove.mockRestore(); }
});

it("describes existing-match recovery and continuing clocks without promising access", () => {
  const { rerender } = render(<NotFound />);
  const recovery = screen.getByRole("link", { name: "Back to arena" });
  expect(recovery).toHaveAccessibleDescription(/does not pause a live match.*original match link.*press Play to recover your existing match.*server confirms/i);
  const guidance = document.getElementById(recovery.getAttribute("aria-describedby")!);
  expect(guidance).toHaveClass("recovery-guidance");
  expect(guidance).toBeVisible();
  recovery.focus();
  rerender(<NotFound />);
  expect(recovery).toHaveFocus();
  expect(document.getElementById(recovery.getAttribute("aria-describedby")!)).toBe(guidance);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
