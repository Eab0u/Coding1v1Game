import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ArenaProgress } from "../src/components/arena-progress";

it.each([true, false])("keeps verified scores while guidance follows closure and reopening (player=%s)", player => {
  const view = render(<ArenaProgress player={player} />);
  const status = screen.getByRole("status");
  for (const passed of [0, 3, 8]) {
    for (const phase of ["active", "settling", "completed", "cancelled", "active"] as const) {
      view.rerender(<ArenaProgress player={player} phase={phase} score={{ passed, total: 8 }} />);
      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("value", String(passed));
      expect(bar).toHaveAttribute("aria-valuetext", `${passed} of 8 hidden tests passed`);
      expect(screen.getByRole("status")).toBe(status);
      expect(status).toHaveTextContent(`${passed} of 8 hidden tests passed`);
      expect(bar).toHaveAccessibleDescription(/Best judged test count/);
      if (phase === "completed" || phase === "cancelled") {
        expect(bar).toHaveAccessibleDescription(phase === "completed" ? /View results for the recorded outcome/ : /cancelled.*no ratings changed/);
        expect(bar).not.toHaveAccessibleDescription(/Later attempts|break ties|confirms the result after|no result is confirmed yet/);
      } else if (phase === "settling") {
        expect(bar).toHaveAccessibleDescription(/Submissions are closed.*Already submitted attempts may still be judged/);
        expect(bar).not.toHaveAccessibleDescription(/Later attempts/);
      } else {
        expect(bar).toHaveAccessibleDescription(/Later attempts cannot lower it/);
        if (passed === 8) expect(bar).toHaveAccessibleDescription(/Passing every test does not confirm a win/);
      }
      if (player) expect(bar).toHaveAccessibleDescription(/current edits were submitted/);
      else expect(bar).not.toHaveAccessibleDescription(/current edits were submitted/);
    }
  }
});

it.each([true, false])("uses terminal guidance on reopening with a verified score (player=%s)", player => {
  const view = render(<ArenaProgress player={player} phase="completed" score={{ passed: 8, total: 8 }} />);
  expect(screen.getByRole("progressbar")).toHaveAccessibleDescription(/View results for the recorded outcome/);
  expect(screen.getByText("All tests passed")).toBeVisible();
  view.rerender(<ArenaProgress player={player} phase="cancelled" score={{ passed: 0, total: 8 }} />);
  expect(screen.getByRole("progressbar")).toHaveAccessibleDescription(/no ratings changed/);
  expect(screen.getByText("No tests passed")).toBeVisible();
});

it.each([true, false])("keeps a stable polite score announcement through polling (player=%s)", player => {
  const view = render(<ArenaProgress player={player} />);
  const status = screen.getByRole("status");
  const name = player ? "Your" : "Opponent";
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toHaveAttribute("aria-atomic", "true");
  expect(status).toHaveClass("sr-only");
  expect(status).toHaveTextContent(`${name} best progress: No judged submission yet.`);
  for (const score of [{ passed: 0, total: 8 }, { passed: 3, total: 8 }, { passed: 8, total: 8 }, { passed: 9, total: 8 }, { passed: NaN, total: 8 }, { passed: 2, total: 10 }, null]) {
    view.rerender(<ArenaProgress player={player} score={score} />);
    expect(screen.getByRole("status")).toBe(status);
    const valid = score && Number.isFinite(score.passed) && score.passed <= score.total;
    const text = valid ? `${score.passed} of ${score.total} hidden tests passed.` : score ? "Score unavailable." : "No judged submission yet.";
    expect(status).toHaveTextContent(`${name} best progress: ${text}`);
    expect(status).not.toHaveTextContent(/NaN|9 of 8|win/i);
    const previous = status.firstChild;
    view.rerender(<ArenaProgress player={player} score={score && { ...score }} />);
    expect(status.firstChild).toBe(previous);
  }
});

it("announces each participant independently without including scoring guidance", () => {
  const view = render(<><ArenaProgress player score={{ passed: 2, total: 8 }} /><ArenaProgress score={{ passed: 5, total: 8 }} /></>);
  const [own, opponent] = screen.getAllByRole("status");
  expect(own).toHaveTextContent("Your best progress: 2 of 8 hidden tests passed.");
  expect(opponent).toHaveTextContent("Opponent best progress: 5 of 8 hidden tests passed.");
  view.rerender(<><ArenaProgress player score={{ passed: 8, total: 8 }} /><ArenaProgress score={{ passed: 5, total: 8 }} /></>);
  expect(own).toHaveTextContent("Your best progress: 8 of 8 hidden tests passed.");
  expect(opponent).toHaveTextContent("Opponent best progress: 5 of 8 hidden tests passed.");
  for (const status of [own, opponent]) expect(status).not.toHaveTextContent(/Later attempts|runtime|confirm a win/);
});

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
  expect(screen.getByText("Score unavailable", { exact: true })).toBeVisible();
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

it.each([true, false])("withholds score claims until verified progress recovers (player=%s)", player => {
  const view = render(<ArenaProgress player={player} />);
  const helpId = `${player ? "player" : "opponent"}-progress-help`;
  for (const score of [null, { passed: -1, total: 8 }, { passed: 9, total: 8 }, { passed: NaN, total: 8 }, { passed: 0, total: 0 }]) {
    view.rerender(<ArenaProgress player={player} score={score} />);
    expect(view.container.querySelector(`#${helpId}`)).toBeNull();
    expect(screen.queryByText(/Best judged test count|Later attempts cannot lower|runtime and submission time break ties/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(score ? /next automatic update/ : player ? /Submit your solution when ready/ : /after they submit/)).toBeVisible();
    for (const passed of [0, 3, 8]) {
      view.rerender(<ArenaProgress player={player} score={{ passed, total: 8 }} />);
      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-describedby", helpId);
      expect(view.container.querySelectorAll(`#${helpId}`)).toHaveLength(1);
      expect(bar).toHaveAccessibleDescription(/Best judged test count.*Later attempts cannot lower it/);
      expect(bar).toHaveAttribute("aria-valuetext", `${passed} of 8 hidden tests passed`);
      expect(screen.queryByText(/next automatic update/)).toBeNull();
    }
  }
  view.rerender(<ArenaProgress player={player} />);
  expect(view.container.querySelector(`#${helpId}`)).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
});

it.each([true,false])("replaces automatic-update promises for terminal unavailable scores (player=%s)",player=>{
  const view=render(<ArenaProgress player={player} score={{passed:9,total:8}}/>);
  expect(screen.getByRole('region')).toHaveTextContent('next automatic update');
  for (const phase of ['completed','cancelled'] as const) {
    view.rerender(<ArenaProgress player={player} phase={phase} score={{passed:9,total:8}}/>);
    expect(screen.getByRole('region')).not.toHaveTextContent('next automatic update');
    expect(screen.getByRole('region')).toHaveTextContent(phase==='completed' ? 'View results for the recorded outcome' : 'no ratings changed');
    expect(screen.queryByRole('progressbar')).toBeNull();
  }
  view.rerender(<ArenaProgress player={player} score={{passed:0,total:8}}/>);
  expect(screen.getByRole('progressbar')).toHaveAttribute('value','0');
});
