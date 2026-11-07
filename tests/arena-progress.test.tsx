import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ArenaProgress } from "../src/components/arena-progress";

it.each([false, true])("recovers best progress after invalid polling counts (player=%s)", player => {
  const { rerender } = render(<ArenaProgress player={player} score={null}/>);
  expect(screen.getByRole("region")).toHaveTextContent("No judged submission yet");
  expect(screen.queryByRole("progressbar")).toBeNull();
  for (const score of [
    { passed: -1, total: 8 }, { passed: 9, total: 8 }, { passed: 0, total: 0 },
    { passed: 1.5, total: 8 }, { passed: 1, total: 8.5 },
    { passed: NaN, total: 8 }, { passed: 1, total: Infinity },
    { passed: Number.MAX_SAFE_INTEGER + 1, total: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    rerender(<ArenaProgress player={player} score={score}/>);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("region")).toHaveTextContent("Score unavailable");
    expect(screen.getByRole("region")).toHaveTextContent("next automatic update");
    expect(screen.queryByText("All tests passed")).toBeNull();
    expect(screen.queryByText("Tests remaining")).toBeNull();
    expect(screen.queryByText("No tests passed")).toBeNull();
    expect(screen.getByRole("region")).not.toHaveClass("arena-progress--full", "arena-progress--partial", "arena-progress--zero");
    for (const passed of [0, 3, 8, 0]) {
      rerender(<ArenaProgress player={player} score={{ passed, total: 8 }}/>);
      const bar = screen.getByRole("progressbar", { name: `${player ? "Your" : "Opponent"} best tests passed: ${passed} / 8` });
      expect(bar).toHaveAttribute("value", String(passed));
      expect(bar).toHaveAttribute("max", "8");
      expect(bar).toHaveAccessibleDescription(/Later attempts cannot lower it/);
      expect(screen.getByText(passed === 8 ? "All tests passed" : passed === 0 ? "No tests passed" : "Tests remaining")).toBeVisible();
      expect(screen.getByRole("region")).toHaveClass(passed === 8 ? "arena-progress--full" : passed === 0 ? "arena-progress--zero" : "arena-progress--partial");
      if (passed === 8) expect(bar).toHaveAccessibleDescription(/Passing every test does not confirm a win/);
      else expect(screen.queryByText(/Passing every test does not confirm a win/)).toBeNull();
      expect(screen.queryByText(/next automatic update/)).toBeNull();
    }
  }
  rerender(<ArenaProgress player={player}/>);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.getByRole("region")).toHaveTextContent("No judged submission yet");
  expect(screen.queryByText("All tests passed")).toBeNull();
  expect(screen.queryByText("Tests remaining")).toBeNull();
  expect(screen.queryByText("No tests passed")).toBeNull();
  expect(screen.getByRole("region")).not.toHaveClass("arena-progress--full", "arena-progress--partial", "arena-progress--zero");
});

it.each([true, false])("announces exact best-test counts through polling for player=%s", player => {
  const { rerender } = render(<ArenaProgress player={player} score={null} />);
  expect(screen.queryByRole("progressbar")).toBeNull();
  for (const passed of [0, 3, 8]) {
    rerender(<ArenaProgress player={player} score={{ passed, total: 8 }} />);
    const bar = screen.getByRole("progressbar", { name: `${player ? "Your" : "Opponent"} best tests passed: ${passed} / 8` });
    expect(bar).toHaveAttribute("aria-valuetext", `${passed} of 8 hidden tests passed`);
    expect(bar).toHaveAttribute("value", String(passed));
    expect(bar).toHaveAttribute("max", "8");
    expect(bar).toHaveAccessibleDescription(/runtime and submission time break ties/);
  }
  rerender(<ArenaProgress player={player} score={{ passed: 9, total: 8 }} />);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.getByText(/Score unavailable/)).toBeVisible();
  rerender(<ArenaProgress player={player} score={{ passed: 1, total: 10 }} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 10 hidden tests passed");
});

it("keeps both players' progress names and descriptions separate", () => {
  render(<><ArenaProgress player score={{ passed: 2, total: 8 }} /><ArenaProgress score={{ passed: 5, total: 8 }} /></>);
  const own = screen.getByRole("progressbar", { name: /Your best/ });
  const opponent = screen.getByRole("progressbar", { name: /Opponent best/ });
  expect(own).toHaveAttribute("aria-valuetext", "2 of 8 hidden tests passed");
  expect(opponent).toHaveAttribute("aria-valuetext", "5 of 8 hidden tests passed");
  expect(own).toHaveAccessibleDescription(/current edits were submitted/);
  expect(opponent).not.toHaveAccessibleDescription(/current edits were submitted/);
});

it.each([true, false])("separates waiting guidance from unavailable scores (player=%s)", player => {
  const { rerender } = render(<ArenaProgress player={player} />);
  expect(screen.getByRole('region')).toHaveClass('arena-progress--empty');
  expect(screen.getByText('No judged submission yet')).toHaveClass('arena-progress-summary');
  expect(screen.getByText(player ? /Submit your solution when ready/ : /after they submit/)).toBeVisible();
  expect(screen.queryByRole('progressbar')).toBeNull();
  rerender(<ArenaProgress player={player} score={{passed:9,total:8}} />);
  expect(screen.getByRole('region')).toHaveClass('arena-progress--unavailable');
  expect(screen.getByRole('region')).not.toHaveClass('arena-progress--empty');
  expect(screen.queryByText(/Submit your solution when ready|after they submit/)).toBeNull();
  expect(screen.getByText(/next automatic update/)).toBeVisible();
  rerender(<ArenaProgress player={player} score={{passed:0,total:8}} />);
  expect(screen.getByRole('region')).not.toHaveClass('arena-progress--empty', 'arena-progress--unavailable');
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
});
