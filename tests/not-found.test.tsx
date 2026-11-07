import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import NotFound from "../src/app/not-found";

it("offers public recovery without exposing why a resource is unavailable", () => {
  render(<NotFound />);
  const main = screen.getByRole("main");
  expect(main).toHaveAttribute("id", "main-content");
  expect(main).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("link", {name: "Skip to page recovery"})).toHaveAttribute("href", "#main-content");
  expect(within(main).getByRole("heading", {level: 1})).toHaveTextContent("Find your next duel.");
  expect(main).toHaveTextContent("This link is unavailable. Check the address");
  const navigation = screen.getByRole("navigation", {name: "Page recovery"});
  expect(within(navigation).getByRole("link", {name: "Back to arena"})).toHaveAttribute("href", "/");
  expect(within(navigation).getByRole("link", {name: "Explore standings"})).toHaveAttribute("href", "/leaderboard");
});
