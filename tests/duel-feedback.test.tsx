import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DuelFeedback, useDuelFeedback } from "../src/components/duel-feedback";
import { cueNotes, DuelSound, type DuelCue } from "../src/lib/duel-sound";

const nodes: { frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended?: () => void }[] = [];
class Audio {
  static latest: Audio;
  state = "running"; currentTime = 10; destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createOscillator = vi.fn(() => {
    const node = { frequency: { value: 0 }, type: "", connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    nodes.push(node); return node;
  });
  createGain = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } }));
  constructor() { Audio.latest = this; }
}
function Harness() {
  const feedback = useDuelFeedback();
  return <><DuelFeedback feedback={feedback} />{(Object.keys(cueNotes) as DuelCue[]).map(cue => <button key={cue} onClick={() => feedback.notify(cue)}>{cue}</button>)}</>;
}
beforeEach(() => { localStorage.clear(); nodes.length = 0; vi.stubGlobal("AudioContext", Audio); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it.each(Object.keys(cueNotes) as DuelCue[])("schedules distinct bounded %s notes and disconnects them", cue => {
  const sound = new DuelSound(); sound.unlock(); sound.play(cue);
  expect(nodes.map(node => node.frequency.value)).toEqual(cueNotes[cue]);
  nodes.forEach((node, index) => {
    expect(node.stop).toHaveBeenCalledWith(10 + index * .12 + .2);
    node.onended?.(); expect(node.disconnect).toHaveBeenCalledOnce();
  });
  sound.dispose(); expect(Audio.latest.close).toHaveBeenCalledOnce();
});
it("defaults silent, persists consent, shows every cue and stops on mute", () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByText("matched")); expect(nodes).toHaveLength(0);
  expect(screen.getByText("Match found")).toHaveClass("duel-cue--matched");
  fireEvent.click(screen.getByRole("button", { name: "Sound off" }));
  expect(localStorage.getItem("codeduel-sound")).toBe("on");
  for (const cue of Object.keys(cueNotes) as DuelCue[]) fireEvent.click(screen.getByText(cue));
  expect(nodes.length).toBeGreaterThan(10);
  expect(screen.getByText("Defeat")).toHaveClass("duel-cue--loss");
  fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
  expect(Audio.latest.close).toHaveBeenCalledOnce();
  const count = nodes.length; fireEvent.click(screen.getByText("win")); expect(nodes).toHaveLength(count);
  view.unmount();
});
it("restores preference without autoplay and closes audio on unmount", () => {
  localStorage.setItem("codeduel-sound", "on");
  const view = render(<Harness />);
  expect(screen.getByRole("button", { name: "Sound on" })).toHaveAttribute("aria-pressed", "true");
  expect(nodes).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
  fireEvent.click(screen.getByRole("button", { name: "Sound off" }));
  view.unmount(); expect(Audio.latest.close).toHaveBeenCalledOnce();
});
it("degrades gracefully without audio or storage and silences hidden tabs", () => {
  vi.stubGlobal("AudioContext", undefined);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("denied"); });
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Sound off" }));
  fireEvent.click(screen.getByText("win")); expect(screen.getByText("Victory")).toBeVisible();
  vi.stubGlobal("AudioContext", Audio);
  fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
  fireEvent.click(screen.getByRole("button", { name: "Sound off" }));
  const count = nodes.length;
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  act(() => fireEvent.click(screen.getByText("matched")));
  expect(nodes).toHaveLength(count);
});
