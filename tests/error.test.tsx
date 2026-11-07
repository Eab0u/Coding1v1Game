import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ErrorRecovery from "../src/app/error";

it("retries the current view only on explicit activation and allows repeated attempts", () => {
  const reset = vi.fn();
  render(<ErrorRecovery error={new Error("private database credentials")} reset={reset} />);
  expect(reset).not.toHaveBeenCalled();
  const retry = screen.getByRole("button", { name: "Try this page again" });
  expect(retry).toHaveAttribute("type", "button");
  fireEvent.click(retry);
  fireEvent.click(retry);
  expect(reset).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("main")).not.toHaveTextContent("private database credentials");
});

it("provides accessible recovery destinations and honest live-match guidance", () => {
  render(<ErrorRecovery error={Object.assign(new Error("secret"), { digest: "internal-reference" })} reset={vi.fn()} />);
  const main = screen.getByRole("main");
  expect(main).toHaveAttribute("id", "error-recovery");
  expect(main).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("link", { name: "Skip to page recovery" })).toHaveAttribute("href", "#error-recovery");
  expect(screen.getByRole("alert")).toHaveTextContent("Try loading it again");
  expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Get back in the game.");
  expect(main).toHaveTextContent("match clock may still be running");
  expect(main).not.toHaveTextContent("internal-reference");
  const nav = screen.getByRole("navigation", { name: "Page recovery" });
  expect(within(nav).getByRole("link", { name: "Back to arena" })).toHaveAttribute("href", "/");
  expect(within(nav).getByRole("link", { name: "Explore standings" })).toHaveAttribute("href", "/leaderboard");
});
