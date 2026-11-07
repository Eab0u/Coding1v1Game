import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DuelDate } from "../src/components/duel-date";

it.each([new Date("2026-11-07T01:05:00Z"), "2026-11-06T20:05:00-05:00"])("renders an absolute UTC completion time for %s", value => {
  const { container } = render(<DuelDate value={value} />);
  expect(screen.getByText(/Completed/)).toHaveTextContent("Completed Nov 7, 2026, 01:05 UTC");
  expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-11-07T01:05:00.000Z");
});

it.each([null, undefined, "", "invalid"])("handles unavailable historical dates: %s", value => {
  const { container } = render(<DuelDate value={value} />);
  expect(screen.getByText("Completion date unavailable")).toBeVisible();
  expect(container.querySelector("time")).toBeNull();
});
