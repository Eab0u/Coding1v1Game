import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
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
