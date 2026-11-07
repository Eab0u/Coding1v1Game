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
    for (const passed of [0, 3, 8]) {
      rerender(<ArenaProgress player={player} score={{ passed, total: 8 }}/>);
      const bar = screen.getByRole("progressbar", { name: `${player ? "Your" : "Opponent"} best tests passed: ${passed} / 8` });
      expect(bar).toHaveAttribute("value", String(passed));
      expect(bar).toHaveAttribute("max", "8");
      expect(bar).toHaveAccessibleDescription(/Later attempts cannot lower it/);
      expect(screen.queryByText(/next automatic update/)).toBeNull();
    }
  }
  rerender(<ArenaProgress player={player}/>);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.getByRole("region")).toHaveTextContent("No judged submission yet");
});
