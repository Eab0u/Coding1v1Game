export const cueNotes = {
  matched: [392, 523, 659], passed: [523, 784], failed: [294, 220],
  win: [523, 659, 784, 1047], loss: [392, 330, 262], draw: [440, 554, 440],
} as const;
export type DuelCue = keyof typeof cueNotes;

// Only unlock from a user gesture. No downloads or autoplay.
export class DuelSound {
  private context?: AudioContext;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch { /* Audio is optional. */ }
  }
  play(cue: DuelCue) {
    const context = this.context;
    if (!context || context.state !== "running") return;
    try {
      cueNotes[cue].forEach((frequency, index) => {
        const start = context.currentTime + index * 0.12;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + 0.2);
      });
    } catch { /* Device failures must not interrupt a duel. */ }
  }
  dispose() {
    const context = this.context;
    this.context = undefined;
    if (context) void context.close().catch(() => {});
  }
}
