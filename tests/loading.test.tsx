import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import Loading from "../src/app/loading";

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
