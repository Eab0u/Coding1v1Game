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
  return <><DuelFeedback feedback={feedback} /><button onClick={feedback.unlock}>Unlock audio</button>{(Object.keys(cueNotes) as DuelCue[]).map(cue => <button key={cue} onClick={() => feedback.notify(cue)}>{cue}</button>)}</>;
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
  expect(screen.getByText("Honors shared")).toHaveClass("duel-cue--draw");
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

function remotePreference(newValue: string | null, key: string | null = "codeduel-sound", storageArea: Storage = localStorage) {
  fireEvent(window, new StorageEvent("storage", { key, newValue, storageArea }));
}
it.each([false, true])("silences page departure (cached: %s) and keeps restored pages silent until a gesture", persisted => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const remove = vi.spyOn(window, "removeEventListener");
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Sound off" }));
  const audio = Audio.latest;
  const count = nodes.length;
  fireEvent(window, new PageTransitionEvent("pagehide", { persisted }));
  fireEvent(window, new PageTransitionEvent("pagehide", { persisted }));
  expect(audio.close).toHaveBeenCalledOnce();
  fireEvent(window, new PageTransitionEvent("pageshow", { persisted }));
  fireEvent.click(screen.getByText("win"));
  expect(nodes).toHaveLength(count);
  expect(screen.getByText("Victory")).toBeVisible();
  expect(screen.getByRole("button", { name: "Sound on" })).toHaveAttribute("aria-pressed", "true");
  expect(localStorage.getItem("codeduel-sound")).toBe("on");
  fireEvent.click(screen.getByText("Unlock audio"));
  fireEvent.click(screen.getByText("win"));
  expect(Audio.latest).not.toBe(audio);
  expect(nodes).toHaveLength(count + cueNotes.win.length);
  const restoredAudio = Audio.latest;
  view.unmount();
  expect(restoredAudio.close).toHaveBeenCalledOnce();
  const listener = remove.mock.calls.find(([type]) => type === "pagehide")?.[1];
  expect(listener).toEqual(expect.any(Function));
  // A removed departure listener must not affect an already unmounted hook.
  fireEvent(window, new PageTransitionEvent("pagehide", { persisted }));
  expect(restoredAudio.close).toHaveBeenCalledOnce();
});
it.each(["off", null, "invalid"])("silences active audio when another tab saves %s", value => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Sound off" }));
  const audio = Audio.latest;
  const count = nodes.length;
  remotePreference(value);
  expect(screen.getByRole("button", { name: "Sound off" })).toHaveAttribute("aria-pressed", "false");
  expect(audio.close).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("win"));
  expect(nodes).toHaveLength(count);
  expect(screen.getByText("Victory")).toBeVisible();
});
it("applies remote consent without autoplay or writing back, and requires local unlock", () => {
  render(<Harness />);
  const persist = vi.spyOn(Storage.prototype, "setItem");
  remotePreference("on");
  expect(screen.getByRole("button", { name: "Sound on" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByText("win"));
  expect(nodes).toHaveLength(0);
  expect(persist).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Unlock audio"));
  fireEvent.click(screen.getByText("win"));
  expect(nodes.map(node => node.frequency.value)).toEqual(cueNotes.win);
});
it("ignores unrelated and tab storage, handles storage clear and removes its listener", () => {
  const remove = vi.spyOn(window, "removeEventListener");
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Sound off" }));
  remotePreference("off", "other-setting");
  remotePreference("off", "codeduel-sound", sessionStorage);
  expect(screen.getByRole("button", { name: "Sound on" })).toBeVisible();
  remotePreference(null, null);
  expect(screen.getByRole("button", { name: "Sound off" })).toBeVisible();
  expect(Audio.latest.close).toHaveBeenCalledOnce();
  view.unmount();
  expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
});

it("stops scheduled audio on hide and requires a visible local gesture to resume", () => {
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const remove = vi.spyOn(document, "removeEventListener");
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Sound off" }));
  const audio = Audio.latest;
  const count = nodes.length;
  visibility.mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(audio.close).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("Unlock audio"));
  fireEvent.click(screen.getByText("win"));
  expect(nodes).toHaveLength(count);
  expect(screen.getByText("Victory")).toBeVisible();
  expect(localStorage.getItem("codeduel-sound")).toBe("on");
  expect(screen.getByRole("button", { name: "Sound on" })).toHaveAttribute("aria-pressed", "true");
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  fireEvent.click(screen.getByText("win"));
  expect(nodes).toHaveLength(count);
  fireEvent.click(screen.getByText("Unlock audio"));
  fireEvent.click(screen.getByText("win"));
  expect(nodes).toHaveLength(count + cueNotes.win.length);
  const resumed = Audio.latest;
  expect(resumed).not.toBe(audio);
  visibility.mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(document, new Event("visibilitychange"));
  expect(resumed.close).toHaveBeenCalledOnce();
  view.unmount();
  expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
});
