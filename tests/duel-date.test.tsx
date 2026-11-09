import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DuelDate } from "../src/components/duel-date";

it.each([new Date("2026-11-07T01:05:00Z"), "2026-11-06T20:05:00-05:00"])("renders an absolute UTC completion time for %s", value => {
  const { container } = render(<DuelDate value={value} />);
  expect(screen.getByText(/Completed/)).toHaveTextContent("Completed Nov 7, 2026, 01:05 UTC");
  expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-11-07T01:05:00.000Z");
});

it.each([null, undefined, "", "invalid", new Date(NaN), "2026-11-07", "2026-11-07T01:05:00", "11/07/2026 01:05:00", "2026-11-07T01:05:00+25:00"])("handles unavailable historical dates: %s", value => {
  const { container } = render(<DuelDate value={value} />);
  expect(screen.getByText("Completion date unavailable")).toBeVisible();
  expect(container.querySelector("time")).toBeNull();
});

it("recovers an absolute timestamp after ambiguous history and withholds a later invalid date", () => {
  const view = render(<DuelDate value="2026-11-07T01:05:00" />);
  expect(screen.getByText("Completion date unavailable")).toBeVisible();
  view.rerender(<DuelDate value="2026-11-07T06:35:00.123+05:30" />);
  expect(view.container.querySelector("time")).toHaveAttribute("dateTime", "2026-11-07T01:05:00.123Z");
  expect(screen.getByText(/Completed/)).toHaveTextContent("Completed Nov 7, 2026, 01:05 UTC");
  view.rerender(<DuelDate value={new Date(NaN)} />);
  expect(screen.getByText("Completion date unavailable")).toBeVisible();
  expect(view.container.querySelector("time")).toBeNull();
});

it.each([
  "2026-02-29T01:05:00Z", "2026-02-30T01:05:00Z",
  "2026-04-31T01:05:00-05:00", "1900-02-29T01:05:00Z",
  "2026-00-01T01:05:00Z", "2026-13-01T01:05:00Z",
  "2026-11-00T01:05:00Z", "2026-11-07T24:00:00Z",
  "2026-11-07T01:60:00Z", "2026-11-07T01:05:60Z",
])("withholds impossible calendar dates and clock values: %s", value => {
  const { container } = render(<DuelDate value={value} />);
  expect(screen.getByText("Completion date unavailable")).toBeVisible();
  expect(container.querySelector("time")).toBeNull();
});

it.each(["2024-02-29T23:30:00-02:00", "2000-02-29T23:30:00-02:00"])("accepts leap days before offset conversion: %s", value => {
  const { container } = render(<DuelDate value={value} />);
  expect(container.querySelector("time")).toHaveAttribute("dateTime", value.slice(0, 4) + "-03-01T01:30:00.000Z");
});

it("recovers after an impossible calendar date is corrected", () => {
  const view = render(<DuelDate value="2026-02-30T01:05:00Z" />);
  expect(screen.getByText("Completion date unavailable")).toBeVisible();
  view.rerender(<DuelDate value="2026-02-28T01:05:00Z" />);
  expect(view.container.querySelector("time")).toHaveAttribute("dateTime", "2026-02-28T01:05:00.000Z");
});
